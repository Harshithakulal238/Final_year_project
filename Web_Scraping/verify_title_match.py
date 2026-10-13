"""ONE-OFF TRIAL, not a permanent pipeline stage. Standalone second-pass check:
for each record in an existing output file, makes ONE separate, cheap Groq call
asking "does this description + eligibility text plausibly describe a scheme
with this exact name?" — independent of and after normal extraction, to
measure how many more source_mismatch-class problems (see extract.py) a
dedicated verification pass catches that the extraction-time check missed,
before deciding whether that's worth permanently doubling the Groq call count
on the full ~753-scheme run.

Records with no populated description AND no populated eligibility are
skipped — there's nothing to ask about. (Before 2026-09-09 this checked
source_mismatch/extraction_error explicitly; both fields were removed from
karnataka_schemes.json since Backend never read them — checking directly for
"is there text to judge" is the real precondition either flag was a proxy
for.)

This script only prints/writes a report. It never modifies the input file or
any record.

Usage:
    python verify_title_match.py --in karnataka_schemes.json --limit 10   # test on a few first
    python verify_title_match.py --in karnataka_schemes.json              # full run

Resumable the same way as pipeline.py: results are written to --out after
EVERY record, and a scheme_name already present there (with no
verdict_error) is skipped on a rerun rather than re-verified.

Shares pipeline.py's safety machinery rather than reimplementing it: Groq
calls go through extract.post_groq_chat() (quota logging + daily-cap
detection in one place — see extract.py), and run() takes the same
lock.py mutual-exclusion lock pipeline.py does, since both scripts spend
against the SAME shared daily quota and must not run concurrently with each
other or with themselves (see lock.py's docstring for why that matters).
"""

import argparse
import json
import os
import re
import sys
import time

import requests
from dotenv import load_dotenv

import config
import extract  # reuses get_groq_api_key(), post_groq_chat(), DailyQuotaExhaustedError
import lock
import quota

load_dotenv()

PROMPT_TEMPLATE = """Scheme name: "{scheme_name}"

Description: {description}

Eligibility: {eligibility}

Question: does this description and eligibility text plausibly describe a REAL
government scheme with the exact name above — same subject matter, same kind
of beneficiary, same purpose? A minor spelling/transliteration difference in
the name is fine. Text that is clearly about a substantively different kind of
scheme (different purpose, different beneficiaries) is NOT plausible, even if
the text itself reads as detailed and confident.

Respond with ONLY a JSON object, no markdown fences, no commentary:
{{"plausible": true or false, "reason": "<one short sentence>"}}
"""


def _call_groq_judge(scheme_name: str, description: str, eligibility: str, api_key: str) -> dict:
    prompt = PROMPT_TEMPLATE.format(
        scheme_name=scheme_name,
        description=description or "(empty)",
        eligibility=eligibility or "(empty)",
    )
    messages = [
        {"role": "system", "content": "You judge whether given text plausibly matches a named scheme. Return ONLY a JSON object."},
        {"role": "user", "content": prompt},
    ]
    # Routes through extract.py's shared low-level caller — quota logging and
    # daily-cap detection happen there, in the one place both this script and
    # pipeline.py's extraction call go through. See extract.py's
    # post_groq_chat() and DailyQuotaExhaustedError.
    raw_reply, _headers = extract.post_groq_chat(messages, max_tokens=150, api_key=api_key)
    cleaned = re.sub(r"^```(json)?|```$", "", raw_reply.strip(), flags=re.MULTILINE).strip()
    parsed = json.loads(cleaned)
    return {
        "plausible": parsed.get("plausible") is True,
        "reason": str(parsed.get("reason") or "").strip(),
    }


def _judge_with_retry(name, description, eligibility, api_key):
    """Mirrors extract.py's extract_fields_llm() retry structure exactly
    (same GROQ_RETRIES count, same 429/5xx/non-retryable-4xx handling, same
    backoff multipliers) rather than an ad-hoc simplified version — this
    trial hit real network flakiness earlier in this session and deserves
    the same-proven handling, not a lighter-weight reimplementation.

    extract.DailyQuotaExhaustedError is deliberately NOT caught here (same
    reasoning as extract_fields_llm) — it propagates straight up to run(),
    which stops the whole verification pass cleanly instead of retrying
    every remaining record into the same exhausted quota one at a time."""
    last_error = None
    for attempt in range(1, config.GROQ_RETRIES + 1):
        try:
            return _call_groq_judge(name, description, eligibility, api_key), None
        except requests.exceptions.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else None
            body = exc.response.text[:500] if exc.response is not None else ""
            last_error = f"HTTP {status}: {body}"
            if status == 429:
                print(f"  [warn] rate limited on {name!r} (attempt {attempt}/{config.GROQ_RETRIES}); backing off", file=sys.stderr)
                time.sleep(5 * attempt)
            elif status and status >= 500:
                print(f"  [warn] Groq server error on {name!r} (attempt {attempt}/{config.GROQ_RETRIES}): {body}", file=sys.stderr)
                time.sleep(3 * attempt)
            else:
                print(f"  [error] non-retryable Groq error on {name!r}: HTTP {status}: {body}", file=sys.stderr)
                break  # e.g. 400/401 — retrying the same malformed request won't help
        except (requests.RequestException, KeyError, json.JSONDecodeError) as exc:
            last_error = str(exc)
            print(f"  [warn] verification call failed on {name!r} (attempt {attempt}/{config.GROQ_RETRIES}): {exc}", file=sys.stderr)
            time.sleep(2 * attempt)

    return {"plausible": None, "reason": None}, last_error


def run(in_path: str, out_path: str, limit: int = None):
    print(f"[pid] {os.getpid()}")
    lock.acquire("verify_title_match.py")
    try:
        _run(in_path, out_path, limit)
    finally:
        lock.release()


def _run(in_path: str, out_path: str, limit: int = None):
    api_key = extract.get_groq_api_key()

    with open(in_path, encoding="utf-8") as f:
        records = json.load(f)

    # NOTE (2026-09-09): this used to explicitly check source_mismatch/
    # extraction_error — both removed from karnataka_schemes.json (Backend
    # never read either). Checking directly for "is there anything to judge"
    # rather than "why might there be nothing" is actually more robust: it's
    # the real precondition either flag was a proxy for, and it also covers
    # any future reason a record might have empty description/eligibility
    # that isn't one of those two removed flags.
    eligible = [r for r in records if r.get("description") or r.get("eligibility")]
    skipped = len(records) - len(eligible)
    candidates = eligible[:limit] if limit else eligible

    # Resumable like the main pipeline's cache: already-verified scheme_names
    # in an existing --out file are skipped, so a kill mid-run (see this
    # session's own history) doesn't waste the calls that already succeeded.
    results = []
    done_names = set()
    if os.path.exists(out_path):
        with open(out_path, encoding="utf-8") as f:
            try:
                results = json.load(f)
                done_names = {x["scheme_name"] for x in results if x.get("verdict_error") is None}
            except json.JSONDecodeError:
                results = []

    remaining = [r for r in candidates if r["scheme_name"] not in done_names]
    print(f"Verifying {len(candidates)} records ({skipped} skipped — no description or "
          f"eligibility text to judge; {len(candidates) - len(remaining)} "
          f"already verified in {out_path}) ...")

    if remaining:
        per_call = quota.estimated_tokens_per_call()
        estimated_tokens = len(remaining) * per_call
        remaining_budget = quota.remaining_daily_budget()
        print(f"[preflight] {len(remaining)} calls needed (~{per_call:,.0f} tokens/call) -> "
              f"~{estimated_tokens:,.0f} tokens. Remaining rolling-24h budget: "
              f"~{remaining_budget:,} / {config.DAILY_TOKEN_CAP:,}.")
        if estimated_tokens > remaining_budget:
            raise RuntimeError(
                f"Refusing to start: ~{estimated_tokens:,.0f} tokens needed for {len(remaining)} "
                f"verification calls, but only ~{remaining_budget:,} remain in today's rolling "
                f"24h budget. Use --limit for a smaller batch, or wait for budget to free up."
            )

    for i, r in enumerate(remaining, start=1):
        name = r["scheme_name"]
        print(f"  ({i}/{len(remaining)}) {name}")
        try:
            verdict, verdict_error = _judge_with_retry(name, r.get("description"), r.get("eligibility"), api_key)
        except extract.DailyQuotaExhaustedError as exc:
            # Stop the whole pass here — every remaining record would fail
            # identically. Results already written for prior records stand.
            print(f"\n[stop] Daily Groq quota exhausted after {i-1}/{len(remaining)} records "
                  f"verified this run: {exc}", file=sys.stderr)
            break
        if verdict_error:
            print(f"    [warn] verification call failed after retry: {verdict_error}", file=sys.stderr)

        results = [x for x in results if x["scheme_name"] != name]
        results.append({
            "scheme_name": name,
            "source_url": r.get("source_url"),
            "plausible": verdict["plausible"],
            "reason": verdict["reason"],
            "verdict_error": verdict_error,
        })
        # Written after EVERY record, not just at the end — a kill mid-run
        # loses at most one in-flight call, matching cache.py's design intent.
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        time.sleep(config.LLM_DELAY_SECONDS)

    flagged = [x for x in results if x["plausible"] is False]
    errored = [x for x in results if x["verdict_error"]]
    print(f"\nDone. {len(flagged)} flagged implausible, {len(errored)} verification calls failed, "
          f"{len(results) - len(flagged) - len(errored)} plausible.")
    print(f"Full results in {out_path}")

    if flagged:
        print("\nFlagged as implausible:")
        for x in flagged:
            print(f"  - {x['scheme_name']!r}: {x['reason']}")


def main():
    parser = argparse.ArgumentParser(description="One-off trial: second-pass LLM title-match verification.")
    parser.add_argument("--in", dest="in_path", default=config.DEFAULT_OUTPUT_PATH)
    parser.add_argument("--out", dest="out_path", default="_title_verification.json")
    parser.add_argument("--limit", type=int, default=None, help="Only verify the first N eligible records (for testing)")
    args = parser.parse_args()
    run(args.in_path, args.out_path, limit=args.limit)


if __name__ == "__main__":
    main()
