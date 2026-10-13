"""Orchestrator + CLI entry point for the myscheme.gov.in -> Groq LLM pipeline.

Covers the full union of schemes a Karnataka citizen can apply for: state-level
Karnataka schemes plus every central-level scheme (nationwide "All" ones and the
handful explicitly earmarked "Karnataka") — see config.MYSCHEME_QUERIES and
README.md's coverage investigation for why the plain state-only search URL
undercounts real coverage by roughly 13x (56 vs. ~753).

Resumable by design: every fetch and every LLM extraction is cached to disk per
scheme slug (see cache.py) as soon as it succeeds, so killing this process at
any point — crash, Ctrl+C, a bad network blip — and rerunning the exact same
command picks up where it left off. No re-fetching, no re-spending Groq tokens
on schemes already done. A cached extraction FAILURE is not treated as done —
it's retried on every subsequent run until it succeeds.

Run in QUERY SUBSETS via --queries, writing to the SAME output file across
runs:
    # batch 1 — the ~60 Karnataka-specific schemes (state + central-KA)
    python pipeline.py --queries state_karnataka,central_karnataka

    # batch 2 — the ~693 nationwide central schemes, run later, MERGED into
    # the same file rather than overwriting batch 1's records
    python pipeline.py --queries central_all --merge

Without --merge, run() OVERWRITES --out completely with only the records this
invocation produced — this is deliberate for batch 1, which is replacing the
old Scheme_extractor_2.py-era karnataka_schemes.json (garbled descriptions)
outright, not merging into it. With --merge, existing records in --out are
loaded first and combined with this run's new records, deduped by
source_url (new wins on any collision) — this is what lets batch 2 add to
batch 1's output instead of clobbering it, and is also what makes rerunning
this file after an interruption safe in general.

Fails loudly (before making a single HTTP request) if GROQ_API_KEY isn't set
in Web_Scraping/.env — see extract.py's get_groq_api_key(). There is no
heuristic fallback in this pipeline.

Run `python pipeline.py --help` for all options.
"""

import argparse
import json
import os
import sys
import time
from collections import defaultdict
from datetime import datetime, timezone

import cache
import config
import extract
import lock
import normalizer
import quota
import sources

from pymongo import MongoClient
from pymongo.errors import PyMongoError

def _sample_mixed(listings: list, limit: int) -> list:
    """Picks `limit` listings round-robin across query buckets (state_karnataka
    / central_all / central_karnataka) instead of a plain prefix slice — so
    `--limit N` always samples a realistic mix of state and central schemes,
    not N copies of whichever query config.MYSCHEME_QUERIES happens to list
    first."""
    buckets = defaultdict(list)
    for listing in listings:
        buckets[listing.query_label].append(listing)

    bucket_iters = [iter(b) for b in buckets.values()]
    sample = []
    while len(sample) < limit and bucket_iters:
        for it in list(bucket_iters):
            if len(sample) >= limit:
                break
            try:
                sample.append(next(it))
            except StopIteration:
                bucket_iters.remove(it)
    return sample


def get_mongo_client(uri: str):
    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        client.admin.command("ping")
        return client
    except PyMongoError as exc:
        print(f"  [warn] unable to connect to MongoDB: {exc}", file=sys.stderr)
        return None


def save_schemes_to_db(results: list, mongo_uri: str, db_name: str, collection_name: str) -> None:
    client = get_mongo_client(mongo_uri)
    if client is None:
        print("  [error] MongoDB save skipped because the connection failed.", file=sys.stderr)
        return

    try:
        collection = client[db_name][collection_name]
        for record in results:
            filter_query = {"source_url": record["source_url"]}
            collection.update_one(filter_query, {"$set": record}, upsert=True)
        print(f"  [info] saved {len(results)} scheme records to {db_name}.{collection_name}")
    except PyMongoError as exc:
        print(f"  [error] failed to save schemes to MongoDB: {exc}", file=sys.stderr)
    finally:
        client.close()


def _fetch_with_cache(listing) -> dict:
    cached = cache.load_raw(listing.myscheme_slug)
    if cached is not None:
        return cached

    detail = sources.fetch_myscheme_detail(listing)
    time.sleep(config.POLITE_DELAY_SECONDS)
    if detail is not None:
        cache.save_raw(listing.myscheme_slug, detail)
    return detail


def _extract_with_cache(slug: str, detail: dict, api_key: str, scheme_name: str) -> dict:
    input_hash = cache.hash_inputs(detail)
    cached = cache.load_extracted(slug, input_hash, extract.PROMPT_VERSION)
    if cached is not None:
        return cached

    llm_fields = extract.extract_fields_llm(detail, api_key, scheme_name=scheme_name)
    # Stamped here, at the moment of an actual fetch+extract against the live
    # source — not at merge/write time — and carried forward unchanged on
    # every future cache hit, so last_verified always means "last time this
    # record's data was actually checked against myscheme," never "last time
    # this file happened to be rewritten."
    llm_fields["_verified_at"] = datetime.now(timezone.utc).isoformat()
    cache.save_extracted(slug, input_hash, extract.PROMPT_VERSION, llm_fields)

    # Adaptive pacing: the fixed LLM_DELAY_SECONDS is the proven baseline; on
    # top of it, if Groq's own live headers say we're close to the per-minute
    # token budget, wait out the actual reset window instead of hoping the
    # fixed delay was enough. See config.RATE_LIMIT_SAFETY_MARGIN_TOKENS.
    delay = config.LLM_DELAY_SECONDS
    rate_info = llm_fields.get("_rate_limit") or {}
    remaining = rate_info.get("remaining_tokens")
    reset_seconds = rate_info.get("reset_tokens_seconds")
    if remaining is not None and remaining < config.RATE_LIMIT_SAFETY_MARGIN_TOKENS and reset_seconds:
        delay = max(delay, reset_seconds)
    time.sleep(delay)

    return llm_fields


def _preflight_check(listings: list) -> None:
    """Estimates whether this run's likely-new extractions fit in today's
    remaining rolling-24h quota (see quota.py) BEFORE fetching or calling
    Groq even once, and refuses to start if not — the alternative (found out
    on 2026-08-24) is running for hours and hitting the cap mid-way with no
    warning. Raises extract.DailyQuotaExhaustedError-shaped info via
    RuntimeError rather than starting; this is deliberately conservative
    (see cache.needs_extraction's docstring for why the count is an
    optimistic estimate, not exact)."""
    needs_extraction = [l for l in listings if cache.needs_extraction(l.myscheme_slug, extract.PROMPT_VERSION)]
    if not needs_extraction:
        print("[preflight] every scheme in this run is already cached with a successful "
              "extraction — no new Groq calls expected.")
        return

    per_call = quota.estimated_tokens_per_call()
    estimated_tokens = len(needs_extraction) * per_call
    remaining = quota.remaining_daily_budget()

    print(f"[preflight] {len(needs_extraction)}/{len(listings)} schemes need a fresh Groq call "
          f"(~{per_call:,.0f} tokens/call estimated) -> ~{estimated_tokens:,.0f} tokens needed. "
          f"Remaining rolling-24h budget: ~{remaining:,} / {config.DAILY_TOKEN_CAP:,}.")

    if estimated_tokens > remaining:
        wait_hint = quota.oldest_entry_age_seconds()
        raise RuntimeError(
            f"Refusing to start: this run needs ~{estimated_tokens:,.0f} tokens for "
            f"{len(needs_extraction)} new extraction(s), but only ~{remaining:,} tokens remain "
            f"in today's rolling 24h budget ({config.DAILY_TOKEN_CAP:,}/day cap). Run a smaller "
            f"--limit, or wait — the oldest usage counted right now ages out of the window in "
            f"~{wait_hint/60:.0f} min, which frees SOME budget (not necessarily enough for this "
            f"whole run; rerun this check to see current headroom)."
        )


def _load_existing_records(out_path: str) -> list:
    if not os.path.exists(out_path):
        return []
    try:
        with open(out_path, encoding="utf-8") as f:
            existing = json.load(f)
    except (json.JSONDecodeError, OSError):
        return []
    return existing if isinstance(existing, list) else []


def run(limit, out_path: str, query_labels: list = None, merge: bool = False,
        save_db: bool = False, mongo_uri: str = None,
        mongo_db: str = "karnataka_schemes_enhance",
        mongo_collection: str = "schemes") -> list:
    print(f"[pid] {os.getpid()}")
    lock.acquire("pipeline.py")
    try:
        return _run(limit, out_path, query_labels, merge, save_db, mongo_uri, mongo_db, mongo_collection)
    finally:
        lock.release()


def _run(limit, out_path: str, query_labels: list, merge: bool,
         save_db: bool = False, mongo_uri: str = None,
         mongo_db: str = "karnataka_schemes_enhance",
         mongo_collection: str = "schemes") -> list:
    # Fail loudly BEFORE any scraping — never silently fall back.
    api_key = extract.get_groq_api_key()

    queries = config.MYSCHEME_QUERIES
    if query_labels:
        known = {q["label"] for q in config.MYSCHEME_QUERIES}
        unknown = [l for l in query_labels if l not in known]
        if unknown:
            raise ValueError(f"Unknown query label(s) {unknown} — valid labels: {sorted(known)}")
        queries = [q for q in config.MYSCHEME_QUERIES if q["label"] in query_labels]

    print(f"Fetching scheme listings from myscheme.gov.in ({len(queries)} quer{'y' if len(queries)==1 else 'ies'}: "
          f"{', '.join(q['label'] for q in queries)}) ...")
    listings = sources.fetch_myscheme_list(queries=queries)
    print(f"Found {len(listings)} unique schemes across the selected quer{'y' if len(queries)==1 else 'ies'}.")

    if not listings:
        # Refuse to overwrite the output file with an empty result — a total
        # fetch failure (e.g. myscheme.gov.in's CloudFront distribution
        # geo-blocking the request, or any other network/API error) must
        # never silently wipe out existing data. There is no scenario where
        # myscheme.gov.in genuinely has zero matching schemes across all
        # three coverage queries.
        raise RuntimeError(
            "fetch_myscheme_list() returned 0 schemes across all queries — this is "
            "almost certainly a fetch failure (see the [warn]/[error] lines above), "
            "not a real empty result. Refusing to write an empty output file over "
            f"{out_path}. Fix the underlying fetch problem and re-run."
        )

    if limit:
        listings = _sample_mixed(listings, limit)
        counts = defaultdict(int)
        for l in listings:
            counts[l.query_label] += 1
        breakdown = ", ".join(f"{label}={n}" for label, n in counts.items())
        print(f"Limiting to a {len(listings)}-scheme mixed sample for this run ({breakdown}).")

    _preflight_check(listings)

    records = []
    failures = []
    quota_stop = None

    for i, listing in enumerate(listings, start=1):
        print(f"  ({i}/{len(listings)}) [{listing.query_label}] {listing.name}")

        detail = _fetch_with_cache(listing)
        if detail is None:
            print(f"    [warn] could not fetch detail for {listing.name!r}; skipping this scheme", file=sys.stderr)
            continue

        try:
            llm_fields = _extract_with_cache(listing.myscheme_slug, detail, api_key, scheme_name=detail["scheme_name"])
        except extract.DailyQuotaExhaustedError as exc:
            # Stop the WHOLE run here, not just this scheme — every remaining
            # scheme would fail identically, and retrying into an exhausted
            # daily cap wastes time without producing anything. Whatever's in
            # `records` so far is still written out below; nothing is lost.
            quota_stop = exc
            print(f"\n[stop] Daily Groq quota exhausted after {i-1}/{len(listings)} schemes processed "
                  f"this run: {exc}", file=sys.stderr)
            break

        if llm_fields.get("_extraction_error"):
            failures.append((detail["scheme_name"], llm_fields["_extraction_error"]))

        # scheme_level/source are still computed and passed here, but
        # normalizer.build_record() no longer stores either in the output
        # record (removed 2026-09-09 — Backend never read scheme_level, and
        # source was only ever used to build the also-removed
        # field_provenance). Kept as parameters rather than deleted, since
        # they're cheap and meaningful for whatever calls this — e.g. a
        # future second source module still needs to say which one it is.
        scheme_level = config.LEVEL_BY_QUERY_LABEL[listing.query_label]
        records.append(normalizer.build_record(detail, listing.url, llm_fields, source="myscheme", scheme_level=scheme_level))

    if not records and quota_stop is not None:
        print(f"[stop] No new records were produced before the quota stop — {out_path} left untouched.")
        return []

    if not records:
        raise RuntimeError(
            f"Fetched {len(listings)} scheme listing(s) but every detail fetch failed — "
            f"refusing to write an empty output file over {out_path}. See the [warn] "
            "lines above for why each detail fetch failed."
        )

    # merge=False (batch 1 / default): this run's records are the ENTIRE output —
    # out_path is overwritten completely, discarding whatever was there before
    # (including a stale pre-pipeline file). merge=True (batch 2+): existing
    # records in out_path are loaded first and combined with this run's new
    # ones, deduped by source_url with the new record winning any collision —
    # this is what lets a later batch add to an earlier one's output instead
    # of clobbering it.
    #
    # A quota stop forces merge behavior even when merge=False was requested:
    # this run didn't finish everything it set out to (quota_stop is set), so
    # a blind overwrite would regress out_path to fewer records than a prior
    # complete run already produced. Only a run that actually finished its
    # full listing gets to do the clean "this replaces everything" overwrite.
    effective_merge = merge or (quota_stop is not None)
    combined = (_load_existing_records(out_path) if effective_merge else []) + records
    seen_urls = set()
    deduped = []
    for record in reversed(combined):
        if record["source_url"] in seen_urls:
            continue
        seen_urls.add(record["source_url"])
        deduped.append(record)
    deduped.reverse()

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(deduped, f, indent=2, ensure_ascii=False)

    if save_db:
        mongo_uri = mongo_uri or os.getenv("MONGODB_URI")
        if not mongo_uri:
            print("[error] MongoDB URI not configured. Set --mongo-uri or MONGODB_URI in the environment.", file=sys.stderr)
        else:
            print(f"\n[3/3] Saving {len(deduped)} schemes to MongoDB {mongo_db}.{mongo_collection} ...")
            save_schemes_to_db(deduped, mongo_uri, mongo_db, mongo_collection)

    print(f"\nDone. Wrote {len(deduped)} total records to {out_path}"
          + (f" ({len(records)} from this run, {len(deduped) - len(records)} carried over)" if effective_merge else ""))
    if quota_stop is not None:
        print(f"\n[stop] This run ended early due to the daily quota — {i}/{len(listings)} schemes "
              f"were reached this run. Rerun the same command later (after budget frees up) to pick "
              f"up the rest; already-done schemes are cached and won't re-spend tokens.", file=sys.stderr)
    if failures:
        print(f"\n{len(failures)} record(s) had LLM extraction failures after retries "
              f"(cached as failed, so they'll be retried automatically on the next run "
              f"rather than needing anything manual — see cache.py):", file=sys.stderr)
        for name, err in failures:
            print(f"  - {name}: {err}", file=sys.stderr)

    return deduped


def main():
    parser = argparse.ArgumentParser(
        description="Scrape the full state+central Karnataka scheme coverage from myscheme.gov.in, extracted via Groq LLM."
    )
    parser.add_argument("--limit", type=int, default=None,
                         help="Only process a mixed sample of N schemes across the selected queries (for testing)")
    parser.add_argument("--out", default=config.DEFAULT_OUTPUT_PATH, help="Output JSON file path")
    parser.add_argument("--queries", default=None,
                         help="Comma-separated subset of config.MYSCHEME_QUERIES labels to run "
                              "(state_karnataka, central_all, central_karnataka). Default: all three.")
    parser.add_argument("--merge", action="store_true",
                         help="Merge this run's records into any existing --out file (deduped by source_url, "
                              "new wins) instead of overwriting it completely. Use for a later batch that "
                              "should add to an earlier batch's output.")
    parser.add_argument("--save-db", action="store_true", help="Save the final deduped records to MongoDB")
    parser.add_argument("--mongo-uri", default=os.getenv("MONGODB_URI"), help="MongoDB connection URI")
    parser.add_argument("--mongo-db", default=os.getenv("DB_NAME", "karnataka_schemes_enhance"),
                        help="MongoDB database name")
    parser.add_argument("--mongo-collection", default=os.getenv("MONGO_COLLECTION_NAME", "schemes"),
                        help="MongoDB collection name")
    args = parser.parse_args()

    query_labels = [s.strip() for s in args.queries.split(",")] if args.queries else None
    run(args.limit, args.out, query_labels=query_labels, merge=args.merge, save_db=args.save_db,
        mongo_uri=args.mongo_uri, mongo_db=args.mongo_db, mongo_collection=args.mongo_collection)


if __name__ == "__main__":
    main()
