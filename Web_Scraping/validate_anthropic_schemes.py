"""Coverage + link-quality report for a karnataka_schemes.json-shaped file.
Runs standalone against any existing JSON file — does NOT re-scrape or touch
MongoDB. Safe to run any time you want to check data quality without
spending Groq API calls.

Usage:
    python validate_anthropic_schemes.py --in karnataka_schemes.json
    python validate_anthropic_schemes.py --in karnataka_schemes.json --skip-link-check

WHY check_title_consistency() EXISTS
-----------------------------------------
Confirmed live case: myscheme.gov.in's own database had a rural livelihoods
programme's text attached to a scheme titled "Madilu Kit" (a maternity kit) —
fully-formed, fluent, well-typed prose describing the WRONG scheme. Type and
controlled-vocabulary checks (everything else in this file) cannot catch that
class of error by construction: a wrong-but-plausible value passes every one
of them. extract.py's source_mismatch flag (see its module docstring) catches
this at extraction time by checking the source against the scheme's own name;
this function is a second, independent, zero-API-cost check against the SAME
signal from a different angle — myscheme's own `tags`/`nodalDepartmentName`
metadata (fetched but not sent through the LLM) versus the scheme's own
title/extracted content. Matching is transliteration/spelling-tolerant (fuzzy
ratio, not exact substring) because an early exact-match version of this
check threw 6 false positives out of 7 flags on real data — spelling variants
like "Bhagyalaxmi"/"Bhagya Lakshmi" and "Krushy"/"Krushi" are not mismatches.
This function only ever prints a flag for a human to look at — it must never
auto-reject or auto-correct a record; there is no second, verified source to
prefer over a flagged one.
"""

import argparse
import difflib
import json
import os
import re
import sys
import time

import requests

import config

SCALAR_FIELDS = [
    "scheme_name", "description", "eligibility", "age_min", "age_max", "gender",
    "income_limit", "applicant_type", "district", "education",
    "benefits", "application_process", "application_link", "documents_required",
    "source_url", "scheme_status",
]
ARRAY_FIELDS = ["caste_category", "special_conditions", "ration_card_type"]
BOOL_FIELDS = ["minority_community_required", "disability_required"]

# The fields Backend/services/ruleEngine.js actually gates eligibility on.
ELIGIBILITY_GATING_FIELDS = [
    "age_min", "age_max", "gender", "income_limit", "caste_category",
    "minority_community_required", "ration_card_type", "applicant_type",
    "education", "disability_required", "district",
]


def is_unset(field, value):
    if field in ARRAY_FIELDS:
        return not value
    if field in BOOL_FIELDS:
        return value is not True
    return value is None or value == ""


def matches_everyone_unconditionally(record) -> bool:
    return all(is_unset(f, record.get(f)) for f in ELIGIBILITY_GATING_FIELDS)


def print_coverage(records):
    total = len(records)
    print(f"Total records: {total}\n")

    print(f"{'field':24s} {'has value':>10s} {'null/empty':>11s}   %populated")
    print("-" * 66)
    for field in SCALAR_FIELDS:
        populated = sum(1 for r in records if not is_unset(field, r.get(field)))
        print(f"{field:24s} {populated:10d} {total - populated:11d}   {100*populated/total:5.1f}%")
    for field in ARRAY_FIELDS:
        populated = sum(1 for r in records if not is_unset(field, r.get(field)))
        print(f"{field:24s} {populated:10d} {total - populated:11d}   {100*populated/total:5.1f}%  (array; non-empty count)")
    for field in BOOL_FIELDS:
        populated = sum(1 for r in records if r.get(field) is True)
        print(f"{field:24s} {populated:10d} {total - populated:11d}   {100*populated/total:5.1f}%  (bool; True count — False is default)")

    # extraction_error and source_mismatch were removed from karnataka_schemes.json
    # on 2026-09-09 (Backend/services/ruleEngine.js never read either) — this used
    # to report counts for both here. Checking r.get() on either now always returns
    # None/falsy regardless of the real underlying state, so those counts would
    # silently read "0" forever rather than a real answer — worse than not
    # reporting them at all, since "0" looks like a clean bill of health. Removed
    # rather than left to mislead. karnataka_schemes_full.json (the pre-trim
    # backup) still has both fields if you need this history.
    print("\n(extraction-failure and source-mismatch counts are no longer available — "
          "those fields were trimmed from the live schema on 2026-09-09; "
          "see karnataka_schemes_full.json for that history)")

    unconditional = [r for r in records if matches_everyone_unconditionally(r)]
    print(f"\nSchemes where ALL {len(ELIGIBILITY_GATING_FIELDS)} eligibility-gating fields are unset")
    print(f"(match every user unconditionally): {len(unconditional)} / {total}")
    for r in unconditional[:10]:
        print(f"  - {r.get('scheme_name')}")
    if len(unconditional) > 10:
        print(f"  ... and {len(unconditional) - 10} more")


def check_links(records, delay=1.5, timeout=15):
    links = [(r.get("scheme_name"), r.get("application_link")) for r in records if r.get("application_link")]
    if not links:
        print("\nNo populated application_link values to check.")
        return

    print(f"\nChecking {len(links)} application_link value(s) with HEAD (GET fallback), "
          f"{delay}s between requests ...\n")

    # A URL reused across multiple different schemes is a strong signal it's a
    # generic department portal, not a scheme-specific apply page.
    from collections import Counter
    from urllib.parse import urlparse
    url_counts = Counter(url for _, url in links)

    for name, url in links:
        parsed = urlparse(url)
        if not parsed.scheme:
            # No http(s):// — e.g. "www.example.in". requests would just raise
            # MissingSchema on this, so skip the network call and flag it
            # directly: this is myscheme's own data, copied verbatim by design
            # (see normalizer.py) — never patched up here, only reported.
            print(f"- {name!r}\n    {url}\n    -> NOT CHECKED  [SUSPECT: no URL scheme (e.g. missing https://) — copied verbatim from source]\n")
            continue

        result = "?"
        try:
            resp = requests.head(url, headers=config.HEADERS, timeout=timeout, allow_redirects=True)
            if resp.status_code in (405, 403) or resp.status_code >= 400:
                resp = requests.get(url, headers=config.HEADERS, timeout=timeout, allow_redirects=True, stream=True)
                resp.close()
            final_url = resp.url
            redirected = final_url.rstrip("/") != url.rstrip("/")
            status_label = "LIVE" if resp.status_code < 400 else f"HTTP {resp.status_code}"
            result = f"{status_label}" + (f" -> redirected to {final_url}" if redirected else "")
        except requests.exceptions.SSLError as exc:
            result = f"SSL ERROR: {exc}"
        except requests.exceptions.ConnectionError:
            result = "DEAD (connection failed / DNS resolution failed)"
        except requests.exceptions.Timeout:
            result = "DEAD (timeout)"
        except requests.RequestException as exc:
            result = f"ERROR: {exc}"

        smell = ""
        if url_counts[url] > 1:
            smell = f"  [SUSPECT: same URL used by {url_counts[url]} different schemes — likely a generic portal, not scheme-specific]"
        if parsed.path in ("", "/"):
            smell += "  [SUSPECT: bare domain root, no scheme-specific path]"

        print(f"- {name!r}\n    {url}\n    -> {result}{smell}\n")
        time.sleep(delay)


_STOPWORDS = set("""
a an the of to in on for and or is are was were be been being with without within
by at from as that this these those it its their his her they them he she we you i
will shall may can could would should must not no yes if than then so such which who
whom what when where why how all any some each every other another more most less
least into onto over under between among per also about above after before again
further once here there own same too very s t just don now applicant applicants
scheme schemes program programme government karnataka state central eligible
eligibility criteria beneficiary beneficiaries india indian
""".split())

_WORD_RE = re.compile(r"[a-zA-Z]{3,}")


def _content_words(text: str) -> list:
    return [w.lower() for w in _WORD_RE.findall(text or "") if w.lower() not in _STOPWORDS]


def _fuzzy_match(word: str, candidates: list, threshold: float = 0.82) -> bool:
    return any(difflib.SequenceMatcher(None, word, c).ratio() >= threshold for c in candidates)


def check_title_consistency(records, raw_cache_dir):
    """Flags records whose scheme_name has a distinctive word (3+ letters,
    not a generic stopword) that doesn't fuzzy-match ANY word in the source's
    own body text, tags, or nodal department — i.e. myscheme's own metadata
    disagrees with the scheme's own title. See module docstring for why this
    exists and why matching is fuzzy. Read-only, prints only — never mutates
    a record."""
    flagged = []
    for r in records:
        slug = r["source_url"].rstrip("/").rsplit("/", 1)[-1]
        raw_path = os.path.join(raw_cache_dir, f"{slug}.json")
        if not os.path.exists(raw_path):
            continue
        with open(raw_path, encoding="utf-8") as f:
            raw = json.load(f)

        body = " ".join(raw.get(f) or "" for f in
                         ("brief_description", "detailed_description", "eligibility_text", "benefits_text"))
        tags_text = " ".join(raw.get("tags") or [])
        nodal_department = raw.get("nodal_department") or ""
        candidates = _content_words(body) + _content_words(tags_text) + _content_words(nodal_department)

        title_words = _content_words(r["scheme_name"])
        unmatched = [w for w in title_words if not _fuzzy_match(w, candidates)]
        if unmatched:
            flagged.append({
                "scheme_name": r["scheme_name"],
                "unmatched_title_words": unmatched,
                "tags": raw.get("tags") or [],
                "nodal_department": nodal_department,
            })

    print(f"\nTitle/metadata consistency check (fuzzy, flags for human review only — "
          f"never auto-corrected): {len(flagged)} / {len(records)} flagged")
    for item in flagged:
        print(f"  - {item['scheme_name']!r}: title word(s) {item['unmatched_title_words']} not found "
              f"(fuzzy) anywhere in source body/tags/department")
        print(f"      tags: {item['tags']}  |  nodal_department: {item['nodal_department']!r}")
    return flagged


def main():
    parser = argparse.ArgumentParser(description="Validate a karnataka_schemes.json-shaped file.")
    parser.add_argument("--in", dest="in_path", default=config.DEFAULT_OUTPUT_PATH)
    parser.add_argument("--skip-link-check", action="store_true", help="Skip the application_link HEAD-check pass")
    args = parser.parse_args()

    with open(args.in_path, encoding="utf-8") as f:
        records = json.load(f)

    print_coverage(records)
    check_title_consistency(records, config.RAW_CACHE_DIR)

    if not args.skip_link_check:
        check_links(records)


if __name__ == "__main__":
    main()
