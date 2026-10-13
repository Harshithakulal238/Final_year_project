"""Turns myscheme.gov.in's structured detail fields (see sources.py's
fetch_myscheme_detail()) into the scheme schema, using Groq's OpenAI-compatible
chat completions API — no heuristic/regex fallback exists in this pipeline.

WHY NO FALLBACK
------------------
The previous version of this pipeline silently fell back to a regex heuristic
whenever ANTHROPIC_API_KEY was missing — and it WAS missing the entire time,
so all 116 previously-scraped records came out heuristic-extracted without
anyone noticing until an audit caught it (garbled descriptions, mislabeled
eligibility text, an occupation vocabulary that could never match a real
user). This version fails loudly instead: get_groq_api_key() raises
immediately if GROQ_API_KEY isn't set, before any scraping happens.

WHY SOME FIELDS BYPASS THE LLM ENTIRELY
------------------------------------------
`scheme_name`, `source_url`, `application_link`, `scheme_status`, `benefits`,
`application_process`, and `documents_required` are NOT sent through the LLM.
myscheme.gov.in already returns these as clean, structured text via its own
REST API (Slate-flattened, no scraped-HTML boilerplate to strip) — asking a
generative model to reproduce text it was already handed verbatim adds
paraphrase risk for zero benefit. Only fields that genuinely require reading
comprehension — a real description, the actual eligibility criteria, and the
individual structured facts buried in that eligibility prose — go through
Groq.

WHY THIS FILE STILL SAYS "occupation" / "caste_restriction"
------------------------------------------------------------
normalizer.py's output record calls these fields "applicant_type" and
"caste_category" (renamed 2026-09-09 to match the only names Backend/
services/ruleEngine.js actually reads — see normalizer.py's module
docstring). The prompt below and EMPTY_LLM_RESULT still use the OLD names on
purpose: this is the internal contract between the prompt, _validate_and_
normalize, and the on-disk extraction cache (cache/myscheme/extracted/*.json,
63 files as of this rename) — cache.load_extracted() matches cache entries by
a content hash of the source text, NOT by field names, so every existing
cache entry would still register as a hit after this rename but would be
missing whatever key changed, crashing normalizer.build_record() the moment
a cache hit was replayed. Renaming here would need a matching migration of
every cached file; renaming only at the normalizer.py boundary (which was
already doing a rename — from these names to backend-compat aliases — before
this change) avoids that risk for zero cost. If you ever rename these for
real, migrate cache/myscheme/extracted/*.json's keys in the same change.

WHY CONTROLLED VOCABULARIES ARE ENFORCED TWICE
--------------------------------------------------
The prompt below lists the exact allowed values for occupation/caste/
education/district/etc. (see config.py) so the model is constrained up
front. But a model can still ignore instructions, so every returned value is
re-validated against those same lists in this file before being written out;
anything outside the allowed set is dropped to null/empty rather than kept as
a plausible-looking guess. This is also what fixes the old bug where the
prompt itself hardcoded a wrong occupation vocabulary ("Agriculture,
Student, Unemployed, Self-Employed, Government") that could never match a
real user's profile — the correct vocabulary now lives in one place
(config.py) and both the prompt and the validator read from it.

WHY THE PROMPT CHECKS source_mismatch BEFORE ANYTHING ELSE
----------------------------------------------------------------
Confirmed live case: the "Madilu Kit" scheme (a maternity kit) had a
completely unrelated rural livelihoods programme's text attached to it in
myscheme.gov.in's OWN database — verified against a fresh, uncached API call,
so not a fetch/cache bug on this side. The source text was 2000+ characters of
fluent, detailed prose, so the LLM had no way to distinguish "the source is
empty, say null" (the hard rule above already handles that) from "the source
is full and confident but about the wrong scheme" — a different failure mode
the original prompt never asked the model to check for. `scheme_name` is now
threaded into the prompt and the model is asked to verify the source is
actually about that scheme before extracting anything; if not, it must set
`source_mismatch: true` and null every other field. That flag is ALSO
enforced in code afterward (see extract_fields_llm), for the same reason the
controlled vocabularies are re-checked in code: asking nicely in the prompt
is not enough on its own.

This can only ever set fields to null, never repair or guess which of two
readings is correct — there is no second, verified myscheme record to prefer
over a flagged one, so the only trustworthy output on a mismatch is "unknown,
flagged for a human," never an automated best guess.
"""

import hashlib
import json
import os
import re
import sys
import time

import requests
from dotenv import load_dotenv

import config
import quota

load_dotenv()

EMPTY_LLM_RESULT = {
    "description": None,
    "eligibility": None,
    "age_min": None,
    "age_max": None,
    "gender": None,
    "income_limit": None,
    # Only populated when the source states DIFFERENT ceilings for rural vs.
    # urban applicants (a real, recurring pattern — confirmed on 9 Karnataka
    # artisan/craft schemes sharing one eligibility template) — income_limit
    # itself stays null in that case rather than picking one value and
    # losing the distinction the rule engine needs to apply the right
    # threshold per applicant. See PROMPT_TEMPLATE.
    "income_limit_rural": None,
    "income_limit_urban": None,
    "caste_restriction": [],
    "occupation": None,
    "district": None,
    "education": None,
    "special_conditions": [],
    "ration_card_type": [],
    "minority_community_required": False,
    "disability_required": False,
    # False by default — a total extraction failure is not the same claim as
    # "checked and consistent"; see EMPTY_LLM_RESULT's callers.
    "source_mismatch": False,
}

# Every key here EXCEPT source_mismatch itself gets forced back to its empty
# default (see extract_fields_llm) whenever the model reports source_mismatch —
# a source that isn't about the named scheme cannot be trusted for ANY field,
# not just description/eligibility, since every structured field below is also
# read out of that same untrustworthy text.
_FIELDS_TO_NULL_ON_MISMATCH = [k for k in EMPTY_LLM_RESULT if k != "source_mismatch"]


class MissingApiKeyError(RuntimeError):
    pass


def get_groq_api_key() -> str:
    """Fails loudly if GROQ_API_KEY isn't set. No fallback path exists in
    this pipeline for a missing key — see module docstring."""
    key = os.getenv("GROQ_API_KEY")
    if not key or not key.strip() or key.strip() == "your_groq_api_key_here":
        raise MissingApiKeyError(
            "GROQ_API_KEY is not set in Web_Scraping/.env. This pipeline requires "
            "the Groq LLM extraction path and has no heuristic fallback — refusing "
            "to run rather than silently producing low-quality data. Add "
            "GROQ_API_KEY=<your key> to Web_Scraping/.env (get one at "
            "https://console.groq.com/keys) and try again."
        )
    return key.strip()


def _trim(text: str, max_chars: int = 20000) -> str:
    """Defensive cap only — scheme texts are short; this guards against an
    unexpectedly huge outlier, it is not a designed truncation."""
    text = text or ""
    return text[:max_chars]


PROMPT_TEMPLATE = """You are extracting structured facts about an Indian government welfare
scheme (Karnataka) from text taken DIRECTLY from myscheme.gov.in's own database.
Read the labelled source sections below and return ONLY a JSON object (no markdown
fences, no commentary) with exactly these keys.

THE SCHEME THIS TEXT IS SUPPOSED TO BE ABOUT: "{scheme_name}"

STEP ZERO, BEFORE ANYTHING ELSE: check whether the source sections below actually
describe a scheme called "{scheme_name}" — same subject matter, same kind of
beneficiary, same purpose. Source databases sometimes have the wrong body text
attached to a title (a real, confirmed example: a scheme titled "Madilu Kit" — a
maternity kit — had a completely unrelated rural livelihoods/entrepreneurship
programme's text attached to it in myscheme's own database). A minor spelling or
transliteration difference in the name is fine and is NOT a mismatch. A source
that is substantively about a different kind of scheme IS a mismatch, even if the
text itself is detailed, fluent, and confident-sounding — confident prose about
the wrong subject is still wrong. If you are unsure whether it's the same scheme
or a genuinely different one, treat it as a mismatch — do not resolve the
ambiguity in either direction.

HARD RULE: use only information present in the source sections below. Never invent,
infer, guess, or fill in a plausible-looking value. If a fact is genuinely not stated
anywhere in the source text, its value MUST be null (for single values) or an empty
array (for list values) — never a placeholder, never a default, never something
paraphrased from the scheme name alone.

{{
  "source_mismatch": <true if the source sections below substantively describe a
      DIFFERENT scheme/programme than "{scheme_name}" (see STEP ZERO above) —
      false if they are about this scheme, even if some details are thin or
      missing. If true, every field below MUST be null / empty array / false —
      do not extract anything else from a source that isn't about this scheme,
      even if some of it looks plausible.>,
  "description": <string or null — a real 1-3 sentence description of what this
      scheme actually is, built ONLY from the BRIEF DESCRIPTION and DETAILED
      DESCRIPTION sections below. Do not restate the scheme name as if it were a
      description. null if both source sections are empty OR if source_mismatch
      is true.>,
  "eligibility": <string or null — the actual eligibility criteria as descriptive
      text, built from the ELIGIBILITY TEXT section (primary source) and, if that
      is sparse or empty, the DETAILED DESCRIPTION section as a secondary source.
      This must be the real criteria, not a copy of the description or benefits.
      null if no eligibility information is stated anywhere in the source.>,
  "age_min": <integer minimum applicant age, or null if not stated>,
  "age_max": <integer maximum applicant age, or null if not stated>,
  "gender": <"male" or "female" (lowercase) if the scheme is restricted to one
      gender, or null if open to any gender / not stated. NEVER the string "any" —
      null is how "no restriction" must be represented.>,
  "income_limit": <integer annual family income ceiling in INR (convert lakh/crore
      to a plain number, e.g. "2 lakh" -> 200000), or null if not stated OR if the
      source states DIFFERENT ceilings for rural vs. urban applicants — in that
      case leave this null and use income_limit_rural / income_limit_urban below
      instead. Do NOT average, pick the lower/higher, or otherwise collapse two
      different stated values into this one field — a rule engine applying this
      threshold needs the right number for the right applicant, not a number that
      matches neither population correctly.>,
  "income_limit_rural": <integer annual family income ceiling for RURAL applicants
      specifically, ONLY if the source explicitly states a different ceiling for
      rural vs. urban applicants (e.g. "Rs.30,000 in rural areas and Rs.25,000 in
      urban areas" -> income_limit_rural: 30000). null if the source states only
      one ceiling (use income_limit instead) or no ceiling at all.>,
  "income_limit_urban": <integer annual family income ceiling for URBAN applicants
      specifically — same rule as income_limit_rural above, but for urban. null
      under the same conditions.>,
  "caste_restriction": <array, each item one of exactly: {caste_vocab} —
      empty array if not restricted by caste/category>,
  "occupation": <string or null, EXACTLY ONE of: {occupation_vocab} — the
      occupation/employment type the scheme requires, or null if not
      occupation-specific. Map real-world phrasing to the closest vocabulary
      term even when that exact word is never used:
        - artisans, craftspeople, production-unit operators, SHG (self-help
          group) members, cooperative society members, and business/
          enterprise loan or subsidy applicants all map to "self-employed" —
          the scheme is funding or supporting their own business/production
          activity, which is what "self-employed" means here, even though
          the source text may never literally say "self-employed" or
          "entrepreneur".
        - weavers (handloom or power-loom) map to "unorganised" — handloom
          weaving is a standard unorganised-sector occupation in Indian
          labor classification, even though the source text says "weaver,"
          never "unorganised".
        - registered construction workers map to "labourer".
      Do not use any value outside this exact list, and do not map an
      occupation just because it's mentioned in passing (e.g. an
      implementing agency's name) rather than as an actual eligibility
      requirement.>,
  "district": <string or null, EXACTLY ONE of: {district_vocab} — ONLY if the
      scheme is restricted to residents of ONE specific district; state-wide
      schemes (the large majority) MUST be null. Do not use any value outside
      this exact list, and do not guess a district from an implementing office's
      location.>,
  "education": <string or null, EXACTLY ONE of: {education_vocab} — the minimum
      education qualification required, or null if not stated>,
  "special_conditions": <array, each item one of exactly: {special_conditions_vocab}
      — special applicant conditions explicitly required, empty array if none>,
  "ration_card_type": <array, each item one of exactly: {ration_card_vocab} —
      empty array if not restricted by ration card type>,
  "minority_community_required": <true only if the scheme explicitly requires
      membership in a religious minority community (Muslim/Christian/Sikh/
      Jain/Buddhist/Parsi), false otherwise>,
  "disability_required": <true only if the scheme explicitly requires the
      applicant to have a disability, false otherwise>
}}

SOURCE SECTIONS
---------------
BRIEF DESCRIPTION:
{brief_description}

DETAILED DESCRIPTION:
{detailed_description}

ELIGIBILITY TEXT:
{eligibility_text}

BENEFITS (secondary source only — sometimes contains eligibility facts like
income ceilings that the site put here instead of in ELIGIBILITY TEXT):
{benefits_text}
"""

# A hash of the STATIC template text above (before scheme-specific values are
# .format()-ed in) — recomputed automatically every time this file is loaded,
# so any edit to PROMPT_TEMPLATE changes this value with no separate
# bump-a-version-number step to remember. cache.py's load_extracted()/
# needs_extraction() compare this against what's stored on each cache entry;
# a mismatch means the entry was extracted under an older prompt and is
# treated as needing re-extraction, regardless of whether the source text
# changed. Added 2026-09-10 — see cache.py's module docstring for why: this
# is the fix for the gap that let 45 records go stale silently across three
# prompt revisions without the cache ever noticing.
PROMPT_VERSION = hashlib.sha256(PROMPT_TEMPLATE.encode("utf-8")).hexdigest()[:16]


def _build_prompt(detail: dict, scheme_name: str) -> str:
    return PROMPT_TEMPLATE.format(
        scheme_name=scheme_name,
        caste_vocab=json.dumps(config.CASTE_VOCABULARY),
        occupation_vocab=json.dumps(config.OCCUPATION_VOCABULARY),
        district_vocab=json.dumps(config.CANONICAL_DISTRICTS),
        education_vocab=json.dumps(config.EDUCATION_VOCABULARY),
        special_conditions_vocab=json.dumps(config.SPECIAL_CONDITIONS_VOCABULARY),
        ration_card_vocab=json.dumps(config.RATION_CARD_VOCABULARY),
        brief_description=_trim(detail.get("brief_description")) or "(empty)",
        detailed_description=_trim(detail.get("detailed_description")) or "(empty)",
        eligibility_text=_trim(detail.get("eligibility_text")) or "(empty)",
        benefits_text=_trim(detail.get("benefits_text")) or "(empty)",
    )


class DailyQuotaExhaustedError(RuntimeError):
    """The daily (not per-minute) Groq token cap has been hit — see
    quota.py's module docstring for why this is tracked as a rolling 24h
    window. Deliberately NOT a subclass of requests.exceptions.HTTPError:
    callers' existing `except requests.exceptions.HTTPError` retry blocks
    must NOT catch this and retry — retrying into an exhausted daily cap
    within a retry loop's seconds-to-minutes timescale is futile, and every
    subsequent scheme in the same batch would fail identically. This is
    meant to propagate all the way up to the batch-level caller (pipeline.py
    / verify_title_match.py's run()), which should stop the whole run
    cleanly rather than keep looping into more failures."""

    def __init__(self, limit: int, used: int, requested: int, retry_after_seconds: float):
        self.limit = limit
        self.used = used
        self.requested = requested
        self.retry_after_seconds = retry_after_seconds
        super().__init__(
            f"Groq daily token quota exhausted: {used:,}/{limit:,} used, {requested:,} more "
            f"requested. Groq's own earliest-retry estimate: {retry_after_seconds:.0f}s from now."
        )


_TPD_RE = re.compile(
    r"tokens per day \(TPD\):\s*Limit (\d+),\s*Used (\d+),\s*Requested (\d+)\.\s*"
    r"Please try again in ([\w.]+)\.",
)


def _check_tpd_exhausted(status_code: int, body_text: str) -> None:
    """Raises DailyQuotaExhaustedError if `body_text` is specifically a
    tokens-per-day rejection — confirmed live format (2026-08-24):
    {"error":{"message":"...on tokens per day (TPD): Limit 200000, Used
    199850, Requested 485. Please try again in 2m24.72s...",
    "type":"tokens","code":"rate_limit_exceeded"}}. A 429 that does NOT
    match this specific shape (e.g. a per-minute limit) returns normally —
    those stay retryable, only a DAILY cap is not."""
    if status_code != 429:
        return
    m = _TPD_RE.search(body_text or "")
    if not m:
        return
    limit, used, requested, duration_text = m.groups()
    retry_after = _parse_groq_duration(duration_text) or 0.0
    raise DailyQuotaExhaustedError(int(limit), int(used), int(requested), retry_after)


def post_groq_chat(messages: list, max_tokens: int, api_key: str, temperature: float = 0):
    """The one place every Groq chat-completions call in this codebase goes
    through (extract_fields_llm's extraction call AND
    verify_title_match.py's judge call both route through this) — so quota
    logging (quota.py) and daily-cap detection apply uniformly regardless of
    caller, instead of each call site needing to reimplement both.

    Returns (content, headers). Raises DailyQuotaExhaustedError immediately
    on a confirmed TPD rejection (see _check_tpd_exhausted) — not retried
    here; the caller's retry loop doesn't see this as a normal HTTPError.
    Any other error (a per-minute 429, 5xx, network error) is raised
    normally via raise_for_status()/requests exceptions for the caller's own
    retry/backoff logic to handle exactly as before."""
    resp = requests.post(
        f"{config.GROQ_API_BASE}/chat/completions",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json={
            "model": config.GROQ_MODEL,
            "messages": messages,
            "response_format": {"type": "json_object"},
            "temperature": temperature,
            "max_tokens": max_tokens,
        },
        timeout=config.GROQ_REQUEST_TIMEOUT,
    )
    if resp.status_code == 429:
        _check_tpd_exhausted(resp.status_code, resp.text)
        # Falls through here only for a NON-TPD 429 (e.g. per-minute) — logged
        # as a 0-token attempt below (nothing was generated), then raised via
        # raise_for_status() for the caller's normal retry path.
        quota.log_usage(0, purpose="rejected-non-tpd-429")
    resp.raise_for_status()
    body = resp.json()
    usage = body.get("usage") or {}
    quota.log_usage(usage.get("total_tokens", 0), purpose="chat_completion")
    return body["choices"][0]["message"]["content"], resp.headers


_DURATION_RE = re.compile(r"^(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?(?:(\d+)ms)?$")


def _parse_groq_duration(text: str):
    """Parses Groq's rate-limit reset duration strings ("644ms", "1m26.4s",
    "2.5s", ...) into seconds. Returns None on anything unrecognized."""
    m = _DURATION_RE.match((text or "").strip())
    if not m or not any(m.groups()):
        return None
    minutes, seconds, millis = m.groups()
    total = 0.0
    if minutes:
        total += int(minutes) * 60
    if seconds:
        total += float(seconds)
    if millis:
        total += int(millis) / 1000
    return total


def _parse_rate_limit_headers(headers) -> dict:
    """Best-effort read of Groq's live x-ratelimit-* response headers (present
    as of 2026-08-24, verified via a direct test call). This is only a pacing
    HINT for pipeline.py's adaptive delay — never required for correctness —
    so any parse failure returns {} rather than raising."""
    try:
        remaining = int(headers.get("x-ratelimit-remaining-tokens", ""))
    except (TypeError, ValueError):
        return {}
    reset_seconds = _parse_groq_duration(headers.get("x-ratelimit-reset-tokens", ""))
    return {"remaining_tokens": remaining, "reset_tokens_seconds": reset_seconds}


def _validate_and_normalize(parsed: dict) -> dict:
    """Re-checks every LLM-returned value against the same controlled
    vocabularies given in the prompt. A value outside the allowed set is
    dropped rather than trusted — the model following instructions is not
    guaranteed, so this is enforced in code, not just asked for in English."""
    result = dict(EMPTY_LLM_RESULT)

    def as_str(v):
        if v is None:
            return None
        v = str(v).strip()
        return v or None

    def as_int(v, lo=0, hi=120):
        if v is None or v == "":
            return None
        try:
            n = int(float(v))
        except (TypeError, ValueError):
            return None
        return n if lo <= n <= hi else None

    def as_list(v, allowed):
        if not isinstance(v, list):
            return []
        allowed_lower = {a.lower(): a for a in allowed}
        out = []
        for item in v:
            item_str = str(item).strip().lower()
            if item_str in allowed_lower and allowed_lower[item_str] not in out:
                out.append(allowed_lower[item_str])
        return out

    def as_choice(v, allowed):
        if v is None:
            return None
        v_str = str(v).strip()
        for a in allowed:
            if a.lower() == v_str.lower():
                return a
        return None

    result["description"] = as_str(parsed.get("description"))
    result["eligibility"] = as_str(parsed.get("eligibility"))

    age_min = as_int(parsed.get("age_min"))
    age_max = as_int(parsed.get("age_max"))
    if age_min is not None and age_max is not None and age_min > age_max:
        age_min = age_max = None  # internally inconsistent range — untrustworthy, not kept
    result["age_min"] = age_min
    result["age_max"] = age_max

    result["gender"] = as_choice(parsed.get("gender"), config.GENDER_VOCABULARY)

    income = as_int(parsed.get("income_limit"), lo=0, hi=100_000_000)
    result["income_limit"] = income
    result["income_limit_rural"] = as_int(parsed.get("income_limit_rural"), lo=0, hi=100_000_000)
    result["income_limit_urban"] = as_int(parsed.get("income_limit_urban"), lo=0, hi=100_000_000)

    result["caste_restriction"] = as_list(parsed.get("caste_restriction"), config.CASTE_VOCABULARY)
    result["occupation"] = as_choice(parsed.get("occupation"), config.OCCUPATION_VOCABULARY)
    result["district"] = as_choice(parsed.get("district"), config.CANONICAL_DISTRICTS)
    result["education"] = as_choice(parsed.get("education"), config.EDUCATION_VOCABULARY)
    result["special_conditions"] = as_list(parsed.get("special_conditions"), config.SPECIAL_CONDITIONS_VOCABULARY)
    result["ration_card_type"] = as_list(parsed.get("ration_card_type"), config.RATION_CARD_VOCABULARY)
    result["minority_community_required"] = parsed.get("minority_community_required") is True
    result["disability_required"] = parsed.get("disability_required") is True

    result["source_mismatch"] = parsed.get("source_mismatch") is True
    if result["source_mismatch"]:
        # Code-enforced, not just prompt-requested: a source that isn't about
        # this scheme cannot be trusted for ANY field, so every other value is
        # forced back to its empty default regardless of what the model
        # returned for it — the model following instructions is not
        # guaranteed, same principle as the vocabulary checks above.
        for field in _FIELDS_TO_NULL_ON_MISMATCH:
            result[field] = EMPTY_LLM_RESULT[field]

    return result


def extract_fields_llm(detail: dict, api_key: str, scheme_name: str = "") -> dict:
    """Single Groq call per scheme. Retries with backoff on transient
    failures (network errors, rate limits, malformed JSON); if every attempt
    fails, returns EMPTY_LLM_RESULT with `_extraction_error` set so the
    failure is visible in the output and the validator can report it
    separately from a genuine "the source doesn't state this" null — a
    failed call must never be indistinguishable from a real null.

    DailyQuotaExhaustedError is deliberately NOT caught here — it propagates
    straight up to the batch-level caller (pipeline.py's run()), which stops
    the whole run cleanly instead of retrying every remaining scheme into
    the same exhausted quota one at a time. See post_groq_chat()."""
    messages = [
        {"role": "system", "content": "You extract structured facts from government scheme text. Return ONLY a JSON object, never invented facts."},
        {"role": "user", "content": _build_prompt(detail, scheme_name)},
    ]
    last_error = None

    for attempt in range(1, config.GROQ_RETRIES + 1):
        try:
            raw_reply, headers = post_groq_chat(messages, config.GROQ_MAX_TOKENS, api_key)
            cleaned = re.sub(r"^```(json)?|```$", "", raw_reply.strip(), flags=re.MULTILINE).strip()
            parsed = json.loads(cleaned)
            result = _validate_and_normalize(parsed)
            result["_extraction_error"] = None
            result["_rate_limit"] = _parse_rate_limit_headers(headers)
            return result
        except requests.exceptions.HTTPError as exc:
            status = exc.response.status_code if exc.response is not None else None
            body = exc.response.text[:500] if exc.response is not None else ""
            last_error = f"HTTP {status}: {body}"
            if status == 429:
                print(f"  [warn] rate limited on {scheme_name!r} (attempt {attempt}/{config.GROQ_RETRIES}); backing off", file=sys.stderr)
                time.sleep(5 * attempt)
            elif status and status >= 500:
                print(f"  [warn] Groq server error on {scheme_name!r} (attempt {attempt}/{config.GROQ_RETRIES}): {body}", file=sys.stderr)
                time.sleep(3 * attempt)
            else:
                print(f"  [error] Groq request failed on {scheme_name!r}: HTTP {status}: {body}", file=sys.stderr)
                break  # non-retryable (e.g. 400/401) — no point retrying
        except (requests.RequestException, KeyError, json.JSONDecodeError) as exc:
            last_error = str(exc)
            print(f"  [warn] extraction failed for {scheme_name!r} (attempt {attempt}/{config.GROQ_RETRIES}): {exc}", file=sys.stderr)
            time.sleep(2 * attempt)

    result = dict(EMPTY_LLM_RESULT)
    result["_extraction_error"] = last_error or "unknown error"
    return result
