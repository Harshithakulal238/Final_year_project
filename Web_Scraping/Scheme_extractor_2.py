"""
Karnataka Welfare Scheme Extractor
==================================

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

Usage:
    pip install requests beautifulsoup4 anthropic tenacity

    # with LLM structuring (recommended, needs ANTHROPIC_API_KEY env var)
    python karnataka_scheme_scraper.py --use-llm --out schemes.json

    # heuristic-only, no API key required
    python karnataka_scheme_scraper.py --out schemes.json

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

BASE_URL = "https://www.govtschemes.in"
LIST_URL = f"{BASE_URL}/allschemes/Karnataka"

HEADERS = {
    # Identify yourself honestly and don't spoof a browser UA on a government-adjacent site.
    "User-Agent": "KarnatakaSchemeResearchBot/1.0 (+contact: your-email@example.com)",
}

REQUEST_TIMEOUT = 20
POLITE_DELAY_SECONDS = 1.5  # be gentle — this is someone else's server


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

{
  "description": "1-3 sentence plain-language summary of what the scheme is",
  "objective": "the stated goal/purpose of the scheme, or empty string if not present",
  "benefits": "what the beneficiary receives (amounts, subsidy %, loan caps, etc.), as a single string",
  "eligibility": "who can apply — criteria such as age, gender, income, category, residency",
  "documents_required": "documents needed to apply, as a single comma/semicolon separated string",
  "application_process": "how to apply — online/offline steps, in brief",
  "implementing_agency": "the department/corporation that runs the scheme, or empty string if not stated"
}

Rules:
- Use only information present in the text. Do not invent facts.
- If a field is genuinely not mentioned, return an empty string for it.
- Keep each value concise (a few sentences max), not a full copy of the source text.

RAW TEXT:
---
{raw_text}
---
"""


def extract_fields_llm(raw_text: str, model: str = "claude-sonnet-4-6") -> dict:
    """
    Uses the Anthropic API to turn messy scraped text into the fixed schema above.
    This is the robust option: it doesn't care whether the page uses <h2>Eligibility</h2>
    or a bolded inline label or no heading at all — it reads for meaning.
    Requires: pip install anthropic, and ANTHROPIC_API_KEY set in your environment.
    """
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

    print(f"\nDone. Wrote {len(results)} scheme records to {args.out}")


if __name__ == "__main__":
    main()