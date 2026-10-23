"""
TO RUN:python scheme_extractor_2.py --use-llm --save-db;








Two-stage pipeline against govtschemes.in (unofficial aggregator, good bootstrap/demo
source — swap BASE_URL / LIST_URL to point at an official portal once you wire those in):

  Stage 1 — fetch_scheme_list():
      Scrapes the state listing page and returns every scheme's name, detail URL,
      and category tags (from the table you get at /allschemes/Karnataka).

  Stage 2 — fetch_scheme_details():
      Visits each scheme's detail page, pulls the clean main-content text, then
      structures it into a fixed JSON schema. Two extraction backends are provided:

        - extract_fields_llm()        -> uses the Anthropic API (robust to HTML/
                                          theme changes, recommended)
        - extract_fields_heuristic()  -> pure regex/keyword splitting, no API key
                                          needed, works as an offline fallback

      A THIRD pass, extract_structured_eligibility(), then turns the isolated
      eligibility text into queryable fields whose NAMES AND VALUE CASING
      deliberately mirror the `users` collection in karnataka_enhance
      (gender: "Female", casteCategory: "OBC", rationCard: "BPL", etc.) so a
      scheme document and a user document can be compared directly with no
      translation step in between.

CHANGELOG (this revision)
--------------------------
  - FIXED a critical bug in parse_rupees_to_int(): the old number regex assumed
    Western comma-grouping (3,000,000) and silently truncated Indian-formatted
    figures like "Rs. 3,00,000" down to just "3". Every income-limit value
    extracted before this fix should be treated as suspect and re-extracted.
  - SPLIT the old extract_caste_restriction() (which conflated caste category
    and ration-card/BPL status into one list) into three separate, schema-
    aligned extractors: extract_caste_category(), extract_ration_card_type(),
    and extract_minority_community_required().
  - Value casing now matches the users collection exactly ("Female" not
    "female", "SC"/"BPL" not "sc"/"bpl") so equality comparisons in the
    matching step work without a translation layer.
  - Dropped the `state` field from structured eligibility — every scheme in
    this pipeline is Karnataka-scoped by construction, so it never varies and
    adds nothing to a match/filter query.
  - fetch_scheme_details() now runs structured extraction on the ALREADY-
    ISOLATED eligibility text (fields["eligibility"]) instead of the entire
    raw page text, falling back to raw_text only if that came back empty —
    more accurate, and removes a second, redundant "find eligibility" regex
    that could previously disagree with the LLM/heuristic stage's own split.

Usage:
    pip install requests beautifulsoup4 anthropic pymongo

    # with LLM structuring (recommended, needs ANTHROPIC_API_KEY env var)
    python karnataka_scheme_scraper.py --use-llm --out schemes.json

    # heuristic-only, no API key required
    python karnataka_scheme_scraper.py --out schemes.json

    # save straight to MongoDB too (note: your real DB is "karnataka_enhance",
    # not the DEFAULT_MONGO_DB below — pass --mongo-db karnataka_enhance or
    # set MONGO_DB_NAME in your environment)
    python karnataka_scheme_scraper.py --use-llm --save-db --mongo-db karnataka_enhance

    # limit how many schemes to fetch (useful while testing)
    python karnataka_scheme_scraper.py --limit 5 --out sample.json
"""

import argparse
import json
import os
import re
import sys
import time
from dataclasses import dataclass, asdict, field
from datetime import datetime, timezone
from typing import Optional

import requests
from bs4 import BeautifulSoup
from pymongo import MongoClient
from pymongo.errors import PyMongoError

BASE_URL = "https://www.govtschemes.in"
LIST_URL = f"{BASE_URL}/allschemes/Karnataka"

HEADERS = {
    # Identify yourself honestly and don't spoof a browser UA on a government-adjacent site.
    "User-Agent": "KarnatakaSchemeResearchBot/1.0 (+contact: your-email@example.com)",
}

REQUEST_TIMEOUT = 20
POLITE_DELAY_SECONDS = 1.5  # be gentle — this is someone else's server

DEFAULT_MONGO_URI = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017")
DEFAULT_MONGO_DB = os.getenv("MONGO_DB_NAME", "karnataka_schemes_enhance")
DEFAULT_MONGO_COLLECTION = os.getenv("MONGO_COLLECTION_NAME", "schemes")


# --------------------------------------------------------------------------------------
# Structured eligibility extraction — field names/casing mirror the `users` collection
# --------------------------------------------------------------------------------------

def normalize_field(value):
    if value is None:
        return ""
    if isinstance(value, list):
        cleaned = [normalize_field(v) for v in value]
        return [v for v in cleaned if v]
    value = str(value).strip()
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def parse_rupees_to_int(value):
    """Parses a rupee amount into an int. FIXED: the previous number regex
    (`[0-9]+(?:,[0-9]{3})*`) assumed Western comma-grouping and silently
    truncated Indian-formatted figures — "3,00,000" became "3" because the
    middle ",00" group is only 2 digits, not the 3 the old pattern required.
    This version just grabs the whole digit-and-comma run and strips commas
    before converting, which is correct for both grouping conventions."""
    if value is None:
        return None
    match = re.search(r"([\d,]+(?:\.\d+)?)", str(value))
    if not match:
        return None
    num = float(match.group(1).replace(",", ""))
    text = str(value).lower()
    if "lakh" in text or "lac" in text:
        return int(num * 100000)
    if "crore" in text or "cr" in text:
        return int(num * 10000000)
    if re.search(r"\bk\b", text):  # word boundary — avoids false-matching "k" inside other words
        return int(num * 1000)
    return int(num)


def extract_age_values(text):
    if not text:
        return {"age_min": None, "age_max": None}

    patterns = [
        r"age[^\n]{0,80}?between\s*((?:\d+))\s*(?:years?|yrs?)?\s*(?:and|to|-|\-)\s*((?:\d+))\s*(?:years?|yrs?)",
        r"age[^\n]{0,80}?should\s+be\s*(?:between\s+)?((?:\d+))\s*(?:years?|yrs?)?\s*(?:and|to|-|\-)\s*((?:\d+))\s*(?:years?|yrs?)",
        r"((?:\d+))\s*(?:years?|yrs?)?\s*(?:to|and|-|\-)\s*((?:\d+))\s*(?:years?|yrs?)\s*(?:of\s+age)?",
        r"age[^\n]{0,80}?((?:\d+))\s*(?:years?|yrs?)?\s*(?:to|and|-|\-)\s*((?:\d+))\s*(?:years?|yrs?)",
    ]

    for pattern in patterns:
        age_match = re.search(pattern, text, flags=re.IGNORECASE)
        if age_match:
            return {"age_min": int(age_match.group(1)), "age_max": int(age_match.group(2))}

    min_match = re.search(r"(?:minimum|at\s+least|minimum\s+age)\s*(?:of)?\s*(\d+)", text, flags=re.IGNORECASE)
    if min_match:
        return {"age_min": int(min_match.group(1)), "age_max": None}

    max_match = re.search(r"(?:maximum|below|not\s+more\s+than|up\s+to)\s*(?:age\s*)?(?:of)?\s*(\d+)", text, flags=re.IGNORECASE)
    if max_match:
        return {"age_min": None, "age_max": int(max_match.group(1))}

    return {"age_min": None, "age_max": None}


def extract_income_limit(text):
    if not text:
        return None
    patterns = [
        r"annual(?:\s+family)?\s+income.*?(?:less\s+than|below|not\s+more\s+than|not\s+exceed(?:ing)?|upto|up\s+to).*?rs\.?\s*([\d,]+(?:\.\d+)?)\s*(lakh|lac|crore|cr)?",
        r"income.*?(?:less\s+than|below|not\s+more\s+than|not\s+exceed(?:ing)?|upto|up\s+to).*?rs\.?\s*([\d,]+(?:\.\d+)?)\s*(lakh|lac|crore|cr)?",
        r"family\s+income.*?(?:less\s+than|below|not\s+more\s+than|not\s+exceed(?:ing)?|upto|up\s+to).*?rs\.?\s*([\d,]+(?:\.\d+)?)\s*(lakh|lac|crore|cr)?",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return parse_rupees_to_int(f"{match.group(1)} {match.group(2) or ''}")
    return None


def extract_gender(text):
    """Casing matches the users collection ("Female"/"Male"), not lowercase,
    so a downstream `scheme.gender == user.gender` comparison just works."""
    if not text:
        return None
    text_lower = text.lower()
    if re.search(r"\b(women|woman|female|girl|mother|pregnant|lactating|widow)\b", text_lower):
        return "Female"
    if re.search(r"\b(men|man|male|boy|father|husband)\b", text_lower):
        return "Male"
    return None


def extract_caste_category(text):
    """Renamed + narrowed from the old extract_caste_restriction(): this now
    returns ONLY caste-related categories, matching the `casteCategory` field
    on the user side. Ration-card status (BPL/Antyodaya/APL) is a different
    dimension — see extract_ration_card_type() — because your own users
    collection already treats casteCategory and rationCard as two separate
    fields, and a scheme requiring "SC/ST OR BPL" needs both checked
    independently, not folded into one list."""
    if not text:
        return []
    restrictions = []
    text_lower = text.lower()
    if "scheduled caste" in text_lower or re.search(r"\bsc\b", text_lower):
        restrictions.append("SC")
    if "scheduled tribe" in text_lower or re.search(r"\bst\b", text_lower):
        restrictions.append("ST")
    if re.search(r"\bobc\b", text_lower):
        restrictions.append("OBC")
    if re.search(r"\bgeneral\b", text_lower) and "general public" not in text_lower:
        restrictions.append("General")
    return restrictions


def extract_ration_card_type(text):
    """NEW — split out from the old caste list. Mirrors `rationCard` on the
    user side (e.g. "BPL")."""
    if not text:
        return []
    types = []
    text_lower = text.lower()
    if "bpl" in text_lower or "below poverty line" in text_lower:
        types.append("BPL")
    if "antyodaya" in text_lower:
        types.append("Antyodaya")
    if re.search(r"\bapl\b", text_lower):
        types.append("APL")
    return types


def extract_minority_community_required(text):
    """NEW — mirrors the boolean `minorityCommunity` field on the user side,
    instead of the old approach of burying the string "minority" inside the
    caste-restriction list."""
    if not text:
        return False
    return bool(re.search(
        r"\bminority\b|\bmuslim\b|\bchristian\b|\bsikh\b|\bjain\b|\bparsi\b|\bbuddhist\b",
        text, flags=re.IGNORECASE,
    ))


def extract_education(text):
    if not text:
        return None
    text_lower = text.lower()
    if re.search(r"(10th|class 10|sslc|matric)", text_lower):
        return "10th"
    if re.search(r"(12th|puc|class 12|higher secondary)", text_lower):
        return "12th"
    if re.search(r"diploma", text_lower):
        return "diploma"
    if re.search(r"graduate|graduation|degree", text_lower):
        return "graduate"
    if re.search(r"post graduate|postgraduate|masters|pg", text_lower):
        return "postgraduate"
    return None


def extract_disability_requirement(text):
    """Bool — mirrors checking for "Disabled" inside the user's
    `specialConditions` array on the matching side."""
    if not text:
        return False
    return bool(re.search(r"(disabled|disability|physically handicapped|blind|deaf|orthopedic)", text, flags=re.IGNORECASE))


def extract_applicant_type(text):
    if not text:
        return None
    text_lower = text.lower()
    if "farmer" in text_lower or "agriculture" in text_lower:
        return "farmer"
    if "student" in text_lower:
        return "student"
    if "unemployed" in text_lower:
        return "unemployed"
    if "women" in text_lower or "female" in text_lower:
        return "women"
    return None


def extract_structured_eligibility(raw_text):
    """Takes eligibility text (ideally the already-isolated `fields["eligibility"]`
    string, not the whole page — see fetch_scheme_details()) and returns a dict
    whose keys and value casing are chosen to match the `users` collection
    directly, so scheme <-> user comparisons need no translation layer."""
    if not raw_text:
        return {
            "gender": None,
            "age_min": None,
            "age_max": None,
            "income_limit": None,
            "caste_category": [],
            "ration_card_type": [],
            "minority_community_required": False,
            "education": None,
            "disability_required": False,
            "applicant_type": None,
        }

    text = normalize_field(raw_text)

    age_values = extract_age_values(text)
    return {
        "gender": extract_gender(text),
        "age_min": age_values["age_min"],
        "age_max": age_values["age_max"],
        "income_limit": extract_income_limit(text),
        "caste_category": extract_caste_category(text),
        "ration_card_type": extract_ration_card_type(text),
        "minority_community_required": extract_minority_community_required(text),
        "education": extract_education(text),
        "disability_required": extract_disability_requirement(text),
        "applicant_type": extract_applicant_type(text),
    }


# --------------------------------------------------------------------------------------
# Data model
# --------------------------------------------------------------------------------------

@dataclass
class SchemeListing:
    name: str
    url: str
    categories: list = field(default_factory=list)


@dataclass
class SchemeDetail:
    scheme_name: str
    source_url: str
    categories: list = field(default_factory=list)
    description: str = ""
    objective: str = ""
    benefits: str = ""
    eligibility: str = ""
    documents_required: str = ""
    application_process: str = ""
    implementing_agency: str = ""
    gender: Optional[str] = None
    age_min: Optional[int] = None
    age_max: Optional[int] = None
    income_limit: Optional[int] = None
    caste_category: list = field(default_factory=list)
    ration_card_type: list = field(default_factory=list)
    minority_community_required: bool = False
    education: Optional[str] = None
    disability_required: bool = False
    applicant_type: Optional[str] = None
    raw_text_length: int = 0
    extraction_method: str = ""
    scraped_at: str = ""


# --------------------------------------------------------------------------------------
# Networking helper (simple retry, no extra dependency required)
# --------------------------------------------------------------------------------------

def get_soup(url: str, retries: int = 3) -> Optional[BeautifulSoup]:
    for attempt in range(1, retries + 1):
        try:
            resp = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
            resp.raise_for_status()
            return BeautifulSoup(resp.text, "html.parser")
        except requests.RequestException as exc:
            print(f"  [warn] fetch failed ({attempt}/{retries}) for {url}: {exc}", file=sys.stderr)
            time.sleep(2 * attempt)
    print(f"  [error] giving up on {url}", file=sys.stderr)
    return None


# --------------------------------------------------------------------------------------
# Stage 1 — scheme list
# --------------------------------------------------------------------------------------

def fetch_scheme_list(list_url: str = LIST_URL) -> list:
    """
    Parses the Karnataka scheme table (Sr. No | Scheme Name | Scheme Type | Language)
    and returns one SchemeListing per row. Each scheme name is a link to its detail page;
    the "Scheme Type" cell contains taxonomy-term chips (Loan, Subsidy, Health, etc.)
    that we capture as `categories`.
    """
    soup = get_soup(list_url)
    if soup is None:
        return []

    schemes = []
    table = soup.find("table")
    if table is None:
        print("[error] no table found on list page — site layout may have changed", file=sys.stderr)
        return []

    for row in table.find_all("tr"):
        cells = row.find_all("td")
        if len(cells) < 2:
            continue  # header row or malformed row

        name_cell = cells[1]
        link = name_cell.find("a")
        if link is None or not link.get("href"):
            continue

        name = link.get_text(strip=True)
        href = link["href"]
        full_url = href if href.startswith("http") else BASE_URL + href

        categories = []
        if len(cells) >= 3:
            type_cell = cells[2]
            # category chips are anchor tags pointing at /taxonomy/term/<id>
            categories = [
                a.get_text(strip=True)
                for a in type_cell.find_all("a")
                if a.get_text(strip=True)
            ]

        schemes.append(SchemeListing(name=name, url=full_url, categories=categories))

    return schemes


# --------------------------------------------------------------------------------------
# Stage 2a — pull clean text from a scheme detail page
# --------------------------------------------------------------------------------------

def extract_main_text(soup: BeautifulSoup) -> str:
    """
    Grabs the readable body content of a scheme page, stripping nav/header/footer/
    sidebar chrome. Tries a few common Drupal content-region selectors first, then
    falls back to the largest text block on the page — this fallback matters because
    government-adjacent sites change themes without notice, and you want the scraper
    to degrade gracefully instead of returning an empty string.
    """
    candidates = [
        soup.find("main"),
        soup.find("article"),
        soup.find(id="main-content"),
        soup.find(class_=re.compile(r"field--name-body")),
        soup.find(class_=re.compile(r"node__content")),
    ]

    for candidate in candidates:
        if candidate is not None:
            text = candidate.get_text(separator="\n", strip=True)
            text = _strip_boilerplate_lines(text)
            if len(text) > 200:  # sanity check — avoid grabbing an empty wrapper
                return text

    # last-resort fallback: biggest <div> by text length
    divs = soup.find_all("div")
    if divs:
        best = max(divs, key=lambda d: len(d.get_text(strip=True)))
        return _strip_boilerplate_lines(best.get_text(separator="\n", strip=True))

    return _strip_boilerplate_lines(soup.get_text(separator="\n", strip=True))


# Lines matching these patterns carry no scheme content — breadcrumbs, nav labels,
# and repeated site chrome that would otherwise pollute the first few "lines" the
# heuristic extractor relies on for the description field.
_BOILERPLATE_LINE_PATTERNS = [
    re.compile(r"^breadcrumb", re.IGNORECASE),
    re.compile(r"^home\s*$", re.IGNORECASE),
    re.compile(r"^skip to (main )?content$", re.IGNORECASE),
    re.compile(r"^(share|print|subscribe|follow us)\b", re.IGNORECASE),
    re.compile(r"^(facebook|twitter|whatsapp|telegram)\s*$", re.IGNORECASE),
]


def _strip_boilerplate_lines(text: str) -> str:
    lines = text.split("\n")
    kept = [
        line
        for line in lines
        if line.strip() and not any(p.search(line.strip()) for p in _BOILERPLATE_LINE_PATTERNS)
    ]
    return "\n".join(kept)


# --------------------------------------------------------------------------------------
# Stage 2b — structure the text: LLM-based (recommended)
# --------------------------------------------------------------------------------------

EXTRACTION_SCHEMA_PROMPT = """You are extracting structured facts from a page describing a
government welfare scheme. Read the raw text below and return ONLY a JSON object
(no markdown fences, no commentary) with exactly these keys:

{{
  "description": "1-3 sentence plain-language summary of what the scheme is",
  "objective": "the stated goal/purpose of the scheme, or empty string if not present",
  "benefits": "what the beneficiary receives (amounts, subsidy %, loan caps, etc.), as a single string",
  "eligibility": "who can apply — criteria such as age, gender, income, category, residency",
  "documents_required": "documents needed to apply, as a single comma/semicolon separated string",
  "application_process": "how to apply — online/offline steps, in brief",
  "implementing_agency": "the department/corporation that runs the scheme, or empty string if not stated"
}}

Rules:
- Use only information present in the text. Do not invent facts.
- If a field is genuinely not mentioned, return an empty string for it.
- Keep each value concise (a few sentences max), not a full copy of the source text.

RAW TEXT:
---
{raw_text}
---
"""


"""def extract_fields_llm(raw_text: str, model: str = "claude-sonnet-4-6") -> dict:
    
    Uses the Anthropic API to turn messy scraped text into the fixed schema above.
    This is the robust option: it doesn't care whether the page uses <h2>Eligibility</h2>
    or a bolded inline label or no heading at all — it reads for meaning.
    Requires: pip install anthropic, and ANTHROPIC_API_KEY set in your environment.
    
    import anthropic  # imported lazily so --use-llm is the only path that needs it

    client = anthropic.Anthropic()  # picks up ANTHROPIC_API_KEY from env

    # Truncate defensively — scheme pages are short, but this guards against outliers.
    trimmed = raw_text[:8000]
    prompt = EXTRACTION_SCHEMA_PROMPT.format(raw_text=trimmed)

    response = client.messages.create(
        model=model,
        max_tokens=1000,
        messages=[{"role": "user", "content": prompt}],
    )

    text_out = "".join(
        block.text for block in response.content if getattr(block, "type", None) == "text"
    ).strip()

    # Defensive parsing in case the model wraps output in a code fence anyway.
    text_out = re.sub(r"^```(json)?|```$", "", text_out.strip(), flags=re.MULTILINE).strip()

    try:
        return json.loads(text_out)
    except json.JSONDecodeError:
        print("  [warn] LLM did not return valid JSON, falling back to heuristic extraction", file=sys.stderr)
        return extract_fields_heuristic(raw_text)"""
        
def extract_fields_llm(raw_text: str, model: str = "gemini-3.6-flash") -> dict:
    """
    Uses Google's Gemini API to convert scraped scheme text into
    the fixed JSON schema.

    Requires:
        pip install google-genai
        GEMINI_API_KEY environment variable
    """

    import json
    import re
    import sys
    from google import genai
    from google.genai import types
    
    from dotenv import load_dotenv
    import os

    load_dotenv()
    api_key = os.getenv("GEMINI_API_KEY")

    

    client = genai.Client(api_key=api_key)

    # Prevent sending extremely long pages
    trimmed = raw_text[:8000]

    prompt = EXTRACTION_SCHEMA_PROMPT.format(raw_text=trimmed)

    try:
        response = client.models.generate_content(
            model=model,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.1,
                response_mime_type="application/json",
            ),
        )

        text_out = response.text.strip()

        # Remove markdown code fences if Gemini adds them
        text_out = re.sub(
            r"^```(?:json)?\s*|\s*```$",
            "",
            text_out,
            flags=re.MULTILINE,
        ).strip()

        return json.loads(text_out)

    except Exception as e:
        print(
            f"  [warn] Gemini extraction failed ({e}); using heuristic fallback",
            file=sys.stderr,
        )
        return extract_fields_heuristic(raw_text)


# --------------------------------------------------------------------------------------
# Stage 2c — structure the text: heuristic, no API key needed (fallback)
# --------------------------------------------------------------------------------------

SECTION_KEYWORDS = {
    "objective": [r"objective", r"aim(?:s)? of (?:the|this) scheme", r"purpose"],
    "benefits": [r"benefits?", r"features?"],
    "eligibility": [r"eligibilit(?:y|ies)", r"who can apply", r"eligibility criteria"],
    "documents_required": [r"documents? required", r"required documents?", r"documents? needed"],
    "application_process": [r"how to apply", r"application process", r"steps? to apply"],
    "implementing_agency": [r"implementing agency", r"nodal (?:department|agency)"],
}


_ALL_SECTION_PATTERN = re.compile(
    "|".join(p for patterns in SECTION_KEYWORDS.values() for p in patterns), re.IGNORECASE
)
_SENTENCE_END = re.compile(r"[.!?](?:\s|$)")


def _trim_to_last_sentence(text: str, max_chars: int = 600) -> str:
    """Cut at max_chars, then back off to the last full sentence boundary so
    fields don't end mid-word/mid-clause like 'Corporation' with nothing after it."""
    if len(text) <= max_chars:
        return text.strip()
    truncated = text[:max_chars]
    matches = list(_SENTENCE_END.finditer(truncated))
    if matches:
        return truncated[: matches[-1].end()].strip()
    return truncated.strip()


def _looks_like_title_or_nav(line: str, scheme_name: str) -> bool:
    if not line:
        return True
    normalized = re.sub(r"[^a-z0-9]", "", line.lower())
    scheme_normalized = re.sub(r"[^a-z0-9]", "", scheme_name.lower())
    return bool(scheme_normalized) and normalized == scheme_normalized


def extract_fields_heuristic(raw_text: str, scheme_name: str = "") -> dict:
    """
    Cheap, dependency-free fallback: splits raw text into rough sections by hunting
    for keyword cues, then captures everything up to the *next* section's heading
    (rather than a fixed line count) so values don't get cut off mid-sentence.
    Less accurate than the LLM path (it doesn't understand meaning, only keyword
    position), but useful for a first pass or when you don't have an API key yet.
    """
    raw_text = _strip_boilerplate_lines(raw_text)  # defensive, in case called standalone
    lines = [l.strip() for l in raw_text.split("\n") if l.strip()]
    result = {k: "" for k in SECTION_KEYWORDS}

    # description: first few real content lines, skipping the page title / nav crumbs
    content_lines = [l for l in lines if not _looks_like_title_or_nav(l, scheme_name)]
    result["description"] = _trim_to_last_sentence(" ".join(content_lines[:4]), max_chars=400)

    for field_name, patterns in SECTION_KEYWORDS.items():
        combined_pattern = re.compile("|".join(patterns), re.IGNORECASE)
        for i, line in enumerate(lines):
            if not combined_pattern.search(line):
                continue

            # collect lines after this header until the NEXT section header appears
            # (a short line elsewhere in SECTION_KEYWORDS), or we hit a hard cap —
            # this is what stops mid-sentence truncation without over-collecting
            # into the following section.
            collected = [line]
            for j in range(i + 1, min(i + 15, len(lines))):
                is_next_header = len(lines[j]) < 60 and _ALL_SECTION_PATTERN.search(lines[j])
                if is_next_header:
                    break
                collected.append(lines[j])

            result[field_name] = _trim_to_last_sentence(" ".join(collected))
            break

    return result


# --------------------------------------------------------------------------------------
# Stage 2 orchestrator
# --------------------------------------------------------------------------------------

def get_mongo_client(uri: str) -> Optional[MongoClient]:
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


def fetch_scheme_details(listing: SchemeListing, use_llm: bool) -> SchemeDetail:
    soup = get_soup(listing.url)
    if soup is None:
        return SchemeDetail(
            scheme_name=listing.name,
            source_url=listing.url,
            categories=listing.categories,
            extraction_method="failed",
            scraped_at=datetime.now(timezone.utc).isoformat(),
        )

    raw_text = extract_main_text(soup)

    if use_llm:
        try:
            fields = extract_fields_llm(raw_text)
            method = "llm"
        except Exception as exc:  # noqa: BLE001 — degrade gracefully, don't crash the batch
            print(f"  [warn] LLM extraction failed ({exc}); using heuristic fallback", file=sys.stderr)
            fields = extract_fields_heuristic(raw_text, scheme_name=listing.name)
            method = "heuristic-fallback"
    else:
        fields = extract_fields_heuristic(raw_text, scheme_name=listing.name)
        method = "heuristic"

    # Prefer the already-isolated eligibility text over re-scanning the whole
    # page — more accurate, and avoids a second, independent "find eligibility"
    # regex that could disagree with the LLM/heuristic stage's own split.
    eligibility_text = fields.get("eligibility") or raw_text
    structured = extract_structured_eligibility(eligibility_text)

    return SchemeDetail(
        scheme_name=listing.name,
        source_url=listing.url,
        categories=listing.categories,
        description=fields.get("description", ""),
        objective=fields.get("objective", ""),
        benefits=fields.get("benefits", ""),
        eligibility=fields.get("eligibility", ""),
        documents_required=fields.get("documents_required", ""),
        application_process=fields.get("application_process", ""),
        implementing_agency=fields.get("implementing_agency", ""),
        gender=structured.get("gender"),
        age_min=structured.get("age_min"),
        age_max=structured.get("age_max"),
        income_limit=structured.get("income_limit"),
        caste_category=structured.get("caste_category", []),
        ration_card_type=structured.get("ration_card_type", []),
        minority_community_required=structured.get("minority_community_required", False),
        education=structured.get("education"),
        disability_required=structured.get("disability_required", False),
        applicant_type=structured.get("applicant_type"),
        raw_text_length=len(raw_text),
        extraction_method=method,
        scraped_at=datetime.now(timezone.utc).isoformat(),
    )


# --------------------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Extract Karnataka welfare scheme details.")
    parser.add_argument("--list-url", default=LIST_URL, help="State scheme listing page URL")
    parser.add_argument("--out", default="karnataka_schemes.json", help="Output JSON file path")
    parser.add_argument("--limit", type=int, default=None, help="Only process first N schemes (testing)")
    parser.add_argument(
        "--use-llm",
        action="store_true",
        help="Use Anthropic API for structuring (needs ANTHROPIC_API_KEY env var)",
    )
    parser.add_argument(
        "--save-db",
        action="store_true",
        help="Save extracted schemes to MongoDB",
    )
    parser.add_argument("--mongo-uri", default=None, help="MongoDB connection URI")
    parser.add_argument("--mongo-db", default=DEFAULT_MONGO_DB, help="MongoDB database name")
    parser.add_argument("--mongo-collection", default=DEFAULT_MONGO_COLLECTION, help="MongoDB collection name")
    args = parser.parse_args()

    print(f"[1/2] Fetching scheme list from {args.list_url} ...")
    listings = fetch_scheme_list(args.list_url)
    print(f"      Found {len(listings)} schemes.")

    if args.limit:
        listings = listings[: args.limit]
        print(f"      Limiting to first {len(listings)} for this run.")

    results = []
    print(f"[2/2] Fetching + extracting details ({'LLM' if args.use_llm else 'heuristic'} mode) ...")
    for i, listing in enumerate(listings, start=1):
        print(f"      ({i}/{len(listings)}) {listing.name}")
        detail = fetch_scheme_details(listing, use_llm=args.use_llm)
        results.append(asdict(detail))
        time.sleep(POLITE_DELAY_SECONDS)  # politeness delay between requests

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2, ensure_ascii=False)

    if args.save_db:
        mongo_uri = args.mongo_uri or DEFAULT_MONGO_URI
        if not mongo_uri:
            print("[error] MongoDB URI not configured. Set --mongo-uri or MONGODB_URI in the environment.", file=sys.stderr)
        else:
            print(f"[3/3] Saving {len(results)} schemes to MongoDB {args.mongo_db}.{args.mongo_collection} ...")
            save_schemes_to_db(results, mongo_uri, args.mongo_db, args.mongo_collection)

    print(f"\nDone. Wrote {len(results)} scheme records to {args.out}")


if __name__ == "__main__":
    main()