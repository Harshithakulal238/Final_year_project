"""Shared constants for the web_scraping pipeline — URLs, headers, output path,
the myscheme.gov.in API key, the Groq LLM config, and the controlled
vocabularies the LLM extraction is constrained to.

Source: myscheme.gov.in only (https://www.myscheme.gov.in/search/state/Karnataka),
the official National Government scheme portal. govtschemes.in was dropped from
this pipeline — see README.md for why (its Drupal byline/boilerplate text kept
leaking into `description`, and it needed a much noisier heuristic extraction
path). Scraped via myscheme.gov.in's own public REST API (see sources.py), not
HTML/Selenium.

The MYSCHEME_API_KEY below is not a private credential: myscheme.gov.in's own
frontend ships it in cleartext inside its published JS bundle
(chunks/pages/_app-*.js) so every visitor's browser can call this exact public
search/detail API. It was found by inspecting that bundle and verified live
against the real API before being used here. robots.txt at myscheme.gov.in
allows crawling ("Allow: /").
"""

import os

# --------------------------------------------------------------------------------------
# myscheme.gov.in (official National Government scheme portal, client-rendered —
# scraped via its own public REST API, not HTML/Selenium; see sources.py)
# --------------------------------------------------------------------------------------
MYSCHEME_SITE_BASE = "https://www.myscheme.gov.in"
MYSCHEME_API_BASE = "https://api.myscheme.gov.in"
MYSCHEME_STATE_URL = f"{MYSCHEME_SITE_BASE}/search/state/Karnataka"
MYSCHEME_API_KEY = "tYTy5eEhlu9rFjyxuCr7ra7ACp4dv1RH8gWuHTDc"

# --------------------------------------------------------------------------------------
# Coverage queries — the union of everything a Karnataka citizen can apply for.
# MYSCHEME_STATE_URL above (level=State, beneficiaryState=Karnataka) only covers the
# first of these three; verified live on 2026-08-24 via api.myscheme.gov.in directly:
#   state_karnataka    level=State,   beneficiaryState=Karnataka  -> 56 schemes
#   central_all        level=Central, beneficiaryState=All        -> 693 schemes
#     (nationwide central schemes — a Karnataka citizen is equally eligible for these;
#     "All" is myscheme's own value for "not restricted to a subset of states")
#   central_karnataka  level=Central, beneficiaryState=Karnataka  -> 4 schemes
#     (central schemes explicitly earmarked for Karnataka specifically)
# The plain state-only query undercounts real coverage by roughly 13x. Each query's
# "label" is attached to every SchemeListing it produces (see sources.py) so a mixed
# sample can be drawn across all three instead of always taking whichever query the
# API happens to return first.
# --------------------------------------------------------------------------------------
MYSCHEME_QUERIES = [
    {
        "label": "state_karnataka",
        "filters": [
            {"identifier": "level", "value": "State"},
            {"identifier": "beneficiaryState", "value": "Karnataka"},
        ],
    },
    {
        "label": "central_all",
        "filters": [
            {"identifier": "level", "value": "Central"},
            {"identifier": "beneficiaryState", "value": "All"},
        ],
    },
    {
        "label": "central_karnataka",
        "filters": [
            {"identifier": "level", "value": "Central"},
            {"identifier": "beneficiaryState", "value": "Karnataka"},
        ],
    },
]

# Every record's scheme_level field is derived from which query found it — never
# re-inferred from prose — collapsing central_all/central_karnataka into one
# "central" value since that distinction (nationwide vs. Karnataka-earmarked) is
# already fully recoverable from source_url + the myscheme API if ever needed;
# scheme_level itself only needs to answer "state or central".
LEVEL_BY_QUERY_LABEL = {
    "state_karnataka": "state",
    "central_all": "central",
    "central_karnataka": "central",
}

# --------------------------------------------------------------------------------------
# Networking
# --------------------------------------------------------------------------------------
HEADERS = {
    # Identify yourself honestly and don't spoof a browser UA on a government-adjacent site.
    "User-Agent": "SahayakSchemeResearchBot/1.0 (+contact: your-email@example.com)",
}
MYSCHEME_HEADERS = {
    **HEADERS,
    "x-api-key": MYSCHEME_API_KEY,
    "Accept": "application/json",
    "Origin": MYSCHEME_SITE_BASE,
    "Referer": f"{MYSCHEME_SITE_BASE}/",
}
REQUEST_TIMEOUT = 20
POLITE_DELAY_SECONDS = 1.5  # be gentle — this is someone else's server
# This Groq key's tier is rate-limited to 8000 tokens/minute (checked live via
# the x-ratelimit-* response headers). A single extraction call — long prompt
# with all the controlled-vocabulary constraints plus this model's reasoning
# tokens — commonly uses 1500-3000+ tokens, so 1s between calls isn't enough
# headroom and triggers repeated 429s. 15s keeps well within budget.
LLM_DELAY_SECONDS = 15.0

# --------------------------------------------------------------------------------------
# Output
# --------------------------------------------------------------------------------------
DEFAULT_OUTPUT_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "karnataka_schemes.json")

# --------------------------------------------------------------------------------------
# Per-slug resumability cache (see cache.py). At ~753 schemes the full extraction pass
# takes hours; this is what lets an interrupted run resume without re-fetching or
# re-spending Groq tokens on schemes already done. Safe to delete entirely for a
# from-scratch re-run — it's regenerated on demand, never hand-edited.
# --------------------------------------------------------------------------------------
CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cache", "myscheme")
RAW_CACHE_DIR = os.path.join(CACHE_DIR, "raw")
EXTRACTED_CACHE_DIR = os.path.join(CACHE_DIR, "extracted")

# If Groq's live x-ratelimit-remaining-tokens (read off every response) drops below
# this, pipeline.py's adaptive pacing sleeps out the rest of x-ratelimit-reset-tokens
# before the next call, on top of the normal LLM_DELAY_SECONDS below — a safety margin
# covering one more worst-case call (this file's own measured range tops out ~3000
# tokens/call) so a multi-hour unattended run doesn't drift into repeated 429s.
RATE_LIMIT_SAFETY_MARGIN_TOKENS = 3000

# --------------------------------------------------------------------------------------
# Groq extraction (OpenAI-compatible API)
# --------------------------------------------------------------------------------------
GROQ_API_BASE = "https://api.groq.com/openai/v1"
# Confirmed present via GET /openai/v1/models on 2026-08-16 (active=true, 131072-token
# context). General-purpose, not a Llama chat model (those are being phased out on Groq).
GROQ_MODEL = os.getenv("GROQ_MODEL", "openai/gpt-oss-120b")
GROQ_MAX_TOKENS = 2000
GROQ_REQUEST_TIMEOUT = 60
GROQ_RETRIES = 3

# --------------------------------------------------------------------------------------
# Quota tracking (see quota.py) — confirmed live via Groq's own 429 error body on
# 2026-08-24: "...on tokens per day (TPD): Limit 200000, Used 199850, Requested 485.
# Please try again in 2m24.72s..." This is a ROLLING 24h window, not a fixed
# midnight-UTC reset — near-simultaneous calls that day reported wildly different
# "try again in" durations (22s to 3m12s), only explainable by each request's
# remaining budget being computed against a trailing 24h window of actual usage.
# quota.py's remaining_daily_budget() mirrors that: sums the last 24h, not "since
# midnight." This is this account's observed limit, not a documented Groq constant —
# re-verify against console.groq.com/settings/billing if the tier ever changes.
# --------------------------------------------------------------------------------------
DAILY_TOKEN_CAP = 200_000
QUOTA_LOG_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "quota", "usage_log.jsonl")
# Fallback only — quota.estimated_tokens_per_call() prefers the real observed
# average from QUOTA_LOG_PATH once there's data. This is the midpoint of the
# "1500-3000+ tokens/call" range documented above, for a pre-flight estimate
# before any calls have been logged yet.
ESTIMATED_TOKENS_PER_CALL_DEFAULT = 2500

# --------------------------------------------------------------------------------------
# Process lock (see lock.py) — one shared lock across every Groq-calling script
# (pipeline.py, verify_title_match.py, anything future), not per-script, because the
# resource being protected is the shared daily quota above, not any one script's own
# state. A stray background run double-spending against an already-exhausted quota
# alongside a fresh run is exactly what happened on 2026-08-24 — see lock.py.
# --------------------------------------------------------------------------------------
LOCK_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cache", "groq.lock")

# --------------------------------------------------------------------------------------
# The fields every scheme record carries: the 18 requested fields, plus 3 more
# Backend/services/ruleEngine.js also gates eligibility on (ration_card_type,
# minority_community_required, disability_required) — free extras since the LLM is
# already reading the eligibility text anyway.
#
# TRIMMED 2026-09-09: this list previously also carried scheme_level,
# income_limit_rural, income_limit_urban, and uncertain_fields — none of them read
# anywhere in Backend/services/ruleEngine.js (verified directly), so they were
# dropped from the OUTPUT schema. income_limit_rural/income_limit_urban held real,
# separately-extracted rural/urban income splits (not derivable from income_limit
# alone); uncertain_fields held the free-checker's per-field confidence notes.
# Neither is recoverable from the fields below — only from karnataka_schemes_full.json
# (the pre-trim backup, not regenerated by this pipeline) or a fresh re-extraction.
# Several other fields (source_mismatch, extraction_error, extraction_method,
# extraction_model, last_verified, field_provenance, source) were dropped the same
# way; they were never part of this list to begin with (added directly in
# normalizer.py), so there's nothing to remove from SCHEME_FIELDS for those, but the
# same backup/re-extraction caveat applies to them too — see normalizer.py.
#
# RENAMED 2026-09-09: caste_restriction -> caste_category, occupation ->
# applicant_type. These used to be written under BOTH names — the name below
# plus a same-value alias under Backend/services/ruleEngine.js's own name
# (formerly BACKEND_COMPAT_ALIASES, now deleted) — because ruleEngine.js was
# never checked to see if it actually read the pipeline's own names too. It
# doesn't (verified directly: evaluateCasteRule reads only scheme.caste_category,
# evaluateOccupationRule reads only scheme.applicant_type), so the pipeline's
# own name was pure dead weight in the output — every record carried the exact
# same value twice under two keys. Now written once, under the name the
# backend actually reads. The LLM-facing extraction stage (extract.py) still
# calls these fields "occupation"/"caste_restriction" internally, purely to
# stay compatible with the existing extraction cache (cache/myscheme/extracted/)
# — normalizer.py is the one place that renames them for the final record.
# --------------------------------------------------------------------------------------
SCHEME_FIELDS = [
    "scheme_name",
    "description",
    "eligibility",
    "age_min",
    "age_max",
    "gender",
    "income_limit",
    "caste_category",
    "applicant_type",
    "district",
    "education",
    "special_conditions",
    "ration_card_type",
    "minority_community_required",
    "disability_required",
    "benefits",
    "application_process",
    "application_link",
    "documents_required",
    "source_url",
    "scheme_status",
]

# --------------------------------------------------------------------------------------
# Controlled vocabularies. The LLM is constrained to these exact value sets in
# the extraction prompt AND every returned value is re-validated against them
# in extract.py before being written out — a value outside the set is treated
# as unstated (null / not included), never kept as a plausible-looking guess.
# --------------------------------------------------------------------------------------

# Karnataka district list — copied verbatim from new_frontend/src/lib/karnataka.ts
# (KARNATAKA_DISTRICTS, re-read fresh on 2026-08-16, not from memory).
# Backend/services/ruleEngine.js's evaluateDistrictRule does an exact
# case-insensitive match against user.location.district, which the
# registration form populates from this exact list — so a value here must
# match one of these spellings verbatim (after case-folding) to ever match a
# real user. Re-sync this list by hand if that file's KARNATAKA_DISTRICTS
# array changes.
CANONICAL_DISTRICTS = [
    "Bagalkot", "Ballari", "Belagavi", "Bengaluru Rural", "Bengaluru Urban",
    "Bidar", "Chamarajanagar", "Chikkaballapur", "Chikkamagaluru", "Chitradurga",
    "Dakshina Kannada", "Davanagere", "Dharwad", "Gadag", "Hassan",
    "Haveri", "Kalaburagi", "Kodagu", "Kolar", "Koppal",
    "Mandya", "Mysuru", "Raichur", "Ramanagara", "Shivamogga",
    "Tumakuru", "Udupi", "Uttara Kannada", "Vijayanagara", "Vijayapura",
    "Yadgir",
]

# Real occupation dropdown values from new_frontend/src/lib/schemes.ts
# (OCCUPATIONS), which is what ruleEngine.js's evaluateOccupationRule actually
# compares scheme.applicant_type against (via user.occupation). The pipeline
# previously hardcoded "Agriculture, Student, Unemployed, Self-Employed,
# Government" in its LLM prompt — none of those (except by case-fold
# coincidence) can ever equal a real user's occupation field.
OCCUPATION_VOCABULARY = [
    "student", "farmer", "labourer", "unorganised", "self-employed",
    "salaried", "unemployed", "homemaker", "retired",
]

CASTE_VOCABULARY = ["SC", "ST", "OBC", "General", "Minority"]

RATION_CARD_VOCABULARY = ["APL", "BPL", "AAY"]

EDUCATION_VOCABULARY = [
    "10th Pass", "12th Pass", "Diploma", "Bachelor's Degree", "Master's Degree", "PhD",
]

SPECIAL_CONDITIONS_VOCABULARY = [
    "Widow", "Disabled", "Pregnant", "Lactating Mother", "Senior Citizen",
    "Minority", "BPL", "Orphan",
]

GENDER_VOCABULARY = ["male", "female"]
