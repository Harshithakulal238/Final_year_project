"""ONE-OFF: LLM verification pass for records the FREE checker
(verify_fields.py) flagged as ambiguous — one Groq call per flagged record,
checking every questionable field against that scheme's raw source text in
one shot, rather than guessing from a keyword match alone.

This is the "paid part" of the two-stage design: verify_fields.py handles
everything plain string matching can decide (numeric literal/lakh-crore
matches, keyword presence) for free; only fields that check left genuinely
undecided (a value with no keyword support, or a null where the source
looks like it states something) reach this script.

Report-only: never writes back to karnataka_schemes.json or any cache. Output
is a separate JSON report.

Shares pipeline.py's safety machinery: Groq calls go through
extract.post_groq_chat() (quota logging + daily-cap detection), and this
script takes lock.py's shared mutual-exclusion lock like every other
Groq-calling script here.

Usage:
    python verify_fields_llm.py --field-report _field_verification.json --limit 20
"""

import argparse
import json
import os
import re
import sys
import time

import requests

import config
import extract
import lock
import quota

PROMPT_TEMPLATE = """You are checking previously-extracted structured facts about an Indian
government welfare scheme against the scheme's own raw source text, looking for
values that are wrong or missing — not re-extracting from scratch.

SCHEME NAME: "{scheme_name}"

RAW SOURCE TEXT
----------------
BRIEF DESCRIPTION: {brief_description}

DETAILED DESCRIPTION: {detailed_description}

ELIGIBILITY TEXT: {eligibility_text}

BENEFITS: {benefits_text}

QUESTIONABLE FIELDS TO CHECK (flagged by an automated keyword check as
possibly wrong or possibly missing — your job is to give the real verdict
using the actual source text above, not the keyword check's guess)
------------------------------------------------------------------------
{questionable_fields}

For EACH field listed above, return one verdict object. verdict must be
exactly one of:
  "correct"            — the current value is right, keep it
  "wrong_should_be"     — the current value is wrong; correct_value gives what it should be (or null, if the source states no such restriction)
  "missing_should_add"  — the field is null/empty but the source clearly states a value; correct_value gives it
  "uncertain"           — the source genuinely doesn't make it clear either way; do not guess

HARD RULE: never invent a value not actually stated in the source text above.
If you are not sure, say "uncertain" — do not guess just to fill in
correct_value.

Respond with ONLY a JSON object, no markdown fences, no commentary:
{{"field_verdicts": [{{"field": "<name>", "verdict": "<one of the four above>", "correct_value": <value or null>, "reason": "<one short sentence>"}}, ...]}}
"""


def _trim(text, max_chars=4000):
    return (text or "")[:max_chars]


def _build_questionable_fields_text(flagged: dict) -> str:
    lines = []
    for field, val, cat in flagged.get("unsupported_populated", []):
        lines.append(f'- {field} is currently {val!r} (keyword check found no support for this value; {cat})')
    for field, evidence in flagged.get("possibly_missed", []):
        lines.append(f'- {field} is currently null/empty, but {evidence}')
    return "\n".join(lines)


def _call_groq_verify(record: dict, raw: dict, flagged: dict, api_key: str) -> dict:
    prompt = PROMPT_TEMPLATE.format(
        scheme_name=record["scheme_name"],
        brief_description=_trim(raw.get("brief_description")) or "(empty)",
        detailed_description=_trim(raw.get("detailed_description")) or "(empty)",
        eligibility_text=_trim(raw.get("eligibility_text")) or "(empty)",
        benefits_text=_trim(raw.get("benefits_text")) or "(empty)",
        questionable_fields=_build_questionable_fields_text(flagged),
    )
    messages = [
        {"role": "system", "content": "You verify extracted facts against source text. Return ONLY a JSON object, never invented facts."},
        {"role": "user", "content": prompt},
    ]
    raw_reply, _headers = extract.post_groq_chat(messages, max_tokens=800, api_key=api_key)
    cleaned = re.sub(r"^```(json)?|```$", "", raw_reply.strip(), flags=re.MULTILINE).strip()
    parsed = json.loads(cleaned)
    return parsed.get("field_verdicts", [])


def _verify_with_retry(record, raw, flagged, api_key):
    """Same retry structure as extract.py/verify_title_match.py — see those
    for why (429/5xx backoff, non-retryable 4xx bail immediately,
    DailyQuotaExhaustedError NOT caught here, propagates to run())."""
    last_error = None
    for attempt in range(1, config.GROQ_RETRIES + 1):
        try:
            return _call_groq_verify(record, raw, flagged, api_key), None
        except requests.exceptions.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else None
            body = exc.response.text[:500] if exc.response is not None else ""
            last_error = f"HTTP {status}: {body}"
            if status == 429:
                print(f"  [warn] rate limited (attempt {attempt}/{config.GROQ_RETRIES}); backing off", file=sys.stderr)
                time.sleep(5 * attempt)
            elif status and status >= 500:
                time.sleep(3 * attempt)
            else:
                print(f"  [error] non-retryable: HTTP {status}: {body}", file=sys.stderr)
                break
        except (requests.RequestException, KeyError, json.JSONDecodeError) as exc:
            last_error = str(exc)
            time.sleep(2 * attempt)
    return None, last_error


def run(field_report_path: str, schemes_path: str, out_path: str, limit: int = None):
    print(f"[pid] {os.getpid()}")
    lock.acquire("verify_fields_llm.py")
    try:
        _run(field_report_path, schemes_path, out_path, limit)
    finally:
        lock.release()


def _run(field_report_path, schemes_path, out_path, limit):
    api_key = extract.get_groq_api_key()

    with open(field_report_path, encoding="utf-8") as f:
        field_report = json.load(f)
    with open(schemes_path, encoding="utf-8") as f:
        schemes = {r["scheme_name"]: r for r in json.load(f)}

    def severity(r):
        return len(r.get("unsupported_populated", [])) * 3 + len(r.get("possibly_missed", []))

    flagged = [r for r in field_report if severity(r) > 0]
    flagged.sort(key=severity, reverse=True)  # highest-value (most flags) first
    if limit:
        flagged = flagged[:limit]

    # Resumable: skip records already verified in an existing --out.
    results = []
    done_names = set()
    if os.path.exists(out_path):
        with open(out_path, encoding="utf-8") as f:
            try:
                results = json.load(f)
                done_names = {x["scheme_name"] for x in results if x.get("call_error") is None}
            except json.JSONDecodeError:
                results = []

    remaining = [r for r in flagged if r["scheme_name"] not in done_names]

    per_call = quota.estimated_tokens_per_call()
    estimated_tokens = len(remaining) * per_call
    remaining_budget = quota.remaining_daily_budget()
    print(f"[preflight] {len(flagged)} flagged records total, {len(remaining)} not yet verified. "
          f"~{per_call:,.0f} tokens/call estimated -> ~{estimated_tokens:,.0f} tokens needed. "
          f"LOCAL remaining-budget estimate: ~{remaining_budget:,} / {config.DAILY_TOKEN_CAP:,} "
          f"(this session's quota log has no record of usage from before it existed today — "
          f"this number is a floor, not a guarantee; the real server-side budget could be lower).")

    processed = 0
    quota_stop = None
    for i, r in enumerate(remaining, start=1):
        name = r["scheme_name"]
        record = schemes.get(name)
        if record is None:
            continue
        try:
            with open(f"cache/myscheme/raw/{r['slug']}.json", encoding="utf-8") as f:
                raw = json.load(f)
        except FileNotFoundError:
            continue

        print(f"  ({i}/{len(remaining)}) {name} (severity {severity(r)})")
        try:
            verdicts, call_error = _verify_with_retry(record, raw, r, api_key)
        except extract.DailyQuotaExhaustedError as exc:
            quota_stop = exc
            print(f"\n[stop] Daily Groq quota exhausted after {processed}/{len(remaining)} records "
                  f"verified this run: {exc}", file=sys.stderr)
            break

        if call_error:
            print(f"    [warn] verification call failed after retry: {call_error}", file=sys.stderr)

        results = [x for x in results if x["scheme_name"] != name]
        results.append({
            "scheme_name": name,
            "slug": r["slug"],
            "field_verdicts": verdicts,
            "call_error": call_error,
        })
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(results, f, indent=2, ensure_ascii=False)
        processed += 1
        time.sleep(config.LLM_DELAY_SECONDS)

    print(f"\nDone. {processed}/{len(remaining)} records processed this run. Results in {out_path}.")
    left = len(remaining) - processed
    if left > 0:
        print(f"{left} flagged record(s) not yet verified — rerun the same command to continue "
              f"(already-verified records are skipped).", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser(description="LLM verification pass for free-check-flagged records.")
    parser.add_argument("--field-report", default="_field_verification.json")
    parser.add_argument("--in", dest="schemes_path", default=config.DEFAULT_OUTPUT_PATH)
    parser.add_argument("--out", dest="out_path", default="_field_verification_llm.json")
    parser.add_argument("--limit", type=int, default=None, help="Only verify the top-N highest-severity flagged records")
    args = parser.parse_args()
    run(args.field_report, args.schemes_path, args.out_path, limit=args.limit)


if __name__ == "__main__":
    main()
