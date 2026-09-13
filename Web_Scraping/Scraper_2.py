"""
myScheme.gov.in (Karnataka) Scraper — Playwright + Gemini
============================================================
myscheme.gov.in/search/state/Karnataka is a Next.js SPA — confirmed by direct
fetch: the raw HTML has no scheme data at all, everything renders client-side.
Playwright is required (not requests/BeautifulSoup alone). robots.txt has no
disallow for this path (confirmed by direct fetch).

Output schema matches your existing `schemes` collection exactly.

USAGE
-----
    pip install playwright pymongo requests
    playwright install chromium

    export GEMINI_API_KEY=your_key_here
    python myscheme_scraper.py --out myscheme_karnataka.json
    python myscheme_scraper.py --limit 5 --out sample.json
    python myscheme_scraper.py --save-db --mongo-uri "..." --mongo-db karnataka_enhance
"""

import argparse
import hashlib
import json
import os
import re
import sys
import time
from dataclasses import dataclass, asdict, field
from datetime import datetime, timezone
from typing import Optional

import requests
from playwright.sync_api import sync_playwright

BASE_URL = "https://www.myscheme.gov.in"
SEARCH_URL = f"{BASE_URL}/search/state/Karnataka"
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
GEMINI_MODEL = "gemini-3.5-flash"

DEFAULT_MONGO_URI = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017")
DEFAULT_MONGO_DB = os.getenv("MONGO_DB_NAME", "karnataka_enhance")
DEFAULT_MONGO_COLLECTION = os.getenv("MONGO_COLLECTION_NAME", "schemes")


@dataclass
class SchemeListing:
    scheme_name: str
    source_url: str
    categories: list = field(default_factory=list)


@dataclass
class SchemeRecord:
    source_url: str
    age_max: Optional[int] = None
    age_min: Optional[int] = None
    applicant_type: Optional[str] = None
    application_process: str = ""
    benefits: str = ""
    caste_category: list = field(default_factory=list)
    categories: list = field(default_factory=list)
    description: str = ""
    disability_required: bool = False
    documents_required: str = ""
    education: Optional[str] = None
    eligibility: str = ""
    extraction_method: str = ""
    gender: Optional[str] = None
    implementing_agency: str = ""
    income_limit: Optional[int] = None
    minority_community_required: bool = False
    objective: str = ""
    ration_card_type: list = field(default_factory=list)
    raw_text_length: int = 0
    scheme_name: str = ""
    scraped_at: str = ""


# --------------------------------------------------------------------------------------
# STEP 1 — list page (Playwright: wait for client-rendered scheme cards)
# --------------------------------------------------------------------------------------

def fetch_scheme_list(page, search_url: str = SEARCH_URL, max_scroll: int = 15) -> list:
    """Loads the Karnataka search results and pulls every scheme detail link.
    Defensive selector strategy: myScheme's card classes are generated/hashed
    (typical Next.js + Tailwind build), so instead of relying on a specific
    class name, this matches on the one stable thing: hrefs under /schemes/.
    Also scrolls/clicks "load more" if present, since results are commonly
    paginated via infinite scroll on this kind of SPA — verify this behavior
    matches what you see on first run and adjust max_scroll if needed.
    """
    page.goto(search_url, wait_until="networkidle", timeout=45000)
    page.wait_for_timeout(2000)  # let client-side data fetch complete

    seen_urls = set()
    listings = []

    for _ in range(max_scroll):
        anchors = page.query_selector_all("a[href*='/schemes/']")
        new_found = 0
        for a in anchors:
            href = a.get_attribute("href")
            if not href:
                continue
            full_url = href if href.startswith("http") else BASE_URL + href
            if full_url in seen_urls or "/schemes/" not in full_url:
                continue
            seen_urls.add(full_url)
            name = (a.inner_text() or "").strip()
            listings.append(SchemeListing(scheme_name=name, source_url=full_url))
            new_found += 1

        # Try common "load more" patterns; stop scrolling if nothing changes
        load_more = page.query_selector("button:has-text('Load More'), button:has-text('View More')")
        if load_more:
            load_more.click()
            page.wait_for_timeout(1500)
        else:
            page.mouse.wheel(0, 3000)
            page.wait_for_timeout(1200)

        if new_found == 0:
            break

    print(f"[list] found {len(listings)} scheme links", file=sys.stderr)
    return listings


# --------------------------------------------------------------------------------------
# STEP 2 — detail page (Playwright render, then extract text)
# --------------------------------------------------------------------------------------

def fetch_scheme_page_text(page, url: str) -> str:
    page.goto(url, wait_until="networkidle", timeout=45000)
    page.wait_for_timeout(1500)
    # main content area — fall back to full body text if a specific
    # container isn't found, same graceful-degradation pattern as the
    # earlier scrapers in this pipeline
    for selector in ["main", "[role='main']", "article", "body"]:
        el = page.query_selector(selector)
        if el:
            text = el.inner_text()
            if text and len(text) > 200:
                return text
    return page.inner_text("body")


# --------------------------------------------------------------------------------------
# STEP 3 — Gemini: one combined call, output schema matches your `schemes` collection
# --------------------------------------------------------------------------------------

EXTRACTION_PROMPT = """You are extracting Karnataka government welfare scheme
information from the text below (from myScheme.gov.in). Return ONLY a JSON
object (no markdown fences, no commentary) with EXACTLY these keys:

{{
  "scheme_name": "string",
  "description": "1-3 sentence plain-language summary",
  "objective": "stated goal/purpose, or empty string",
  "benefits": "what the beneficiary receives, as a single string",
  "eligibility": "eligibility text in plain prose",
  "documents_required": "documents needed to apply",
  "application_process": "how to apply",
  "implementing_agency": "department/corporation running it, or empty string",
  "categories": ["array", "of", "category", "tags", "if", "shown"],
  "gender": "Female" or "Male" or null if not gender-restricted,
  "age_min": integer or null,
  "age_max": integer or null,
  "income_limit": integer in rupees (parse "Rs 6 lakh" -> 600000) or null if no cap,
  "caste_category": array from ["SC","ST","OBC","General"], only if explicitly required, else [],
  "ration_card_type": array from ["BPL","Antyodaya","APL"], only if explicitly required, else [],
  "minority_community_required": true or false,
  "education": "10th"/"12th"/"diploma"/"graduate"/"postgraduate" or null,
  "disability_required": true or false,
  "applicant_type": "farmer"/"student"/"unemployed"/"women" or null
}}

Rules:
- Use only information present in the text. Do not invent facts.
- Unmentioned criteria = null / [] / false (the "unrestricted" value), never guessed.

TEXT:
---
{raw_text}
---
"""


def extract_with_gemini(raw_text: str, model: str = GEMINI_MODEL, timeout: int = 40) -> dict:
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY not set. Get a free key at https://aistudio.google.com "
            "then: export GEMINI_API_KEY=your_key_here"
        )
    prompt = EXTRACTION_PROMPT.format(raw_text=raw_text[:12000])
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"temperature": 0, "responseMimeType": "application/json"},
    }
    url = GEMINI_API_URL.format(model=model)
    resp = requests.post(url, params={"key": api_key}, json=payload, timeout=timeout)
    resp.raise_for_status()
    data = resp.json()
    text_out = data["candidates"][0]["content"]["parts"][0]["text"].strip()
    text_out = re.sub(r"^```(json)?|```$", "", text_out, flags=re.MULTILINE).strip()
    return json.loads(text_out)


# --------------------------------------------------------------------------------------
# Orchestration
# --------------------------------------------------------------------------------------

def scrape_all(limit: Optional[int] = None) -> list:
    records = []
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(user_agent="KarnatakaSchemeResearchBot/1.0 (+contact: your-email@example.com)")

        listings = fetch_scheme_list(page)
        if limit:
            listings = listings[:limit]

        for i, listing in enumerate(listings, start=1):
            print(f"[{i}/{len(listings)}] {listing.scheme_name or listing.source_url}", file=sys.stderr)
            try:
                raw_text = fetch_scheme_page_text(page, listing.source_url)
            except Exception as exc:  # noqa: BLE001
                print(f"  [warn] failed to load {listing.source_url}: {exc}", file=sys.stderr)
                continue

            content_hash = hashlib.sha256(raw_text.encode("utf-8")).hexdigest()
            try:
                fields = extract_with_gemini(raw_text)
                method = "llm"
            except Exception as exc:  # noqa: BLE001
                print(f"  [warn] Gemini extraction failed: {exc}", file=sys.stderr)
                fields = {"scheme_name": listing.scheme_name}
                method = "failed"

            records.append(SchemeRecord(
                source_url=listing.source_url,
                age_max=fields.get("age_max"),
                age_min=fields.get("age_min"),
                applicant_type=fields.get("applicant_type"),
                application_process=fields.get("application_process", ""),
                benefits=fields.get("benefits", ""),
                caste_category=fields.get("caste_category", []) or [],
                categories=fields.get("categories", []) or [],
                description=fields.get("description", ""),
                disability_required=bool(fields.get("disability_required", False)),
                documents_required=fields.get("documents_required", ""),
                education=fields.get("education"),
                eligibility=fields.get("eligibility", ""),
                extraction_method=method,
                gender=fields.get("gender"),
                implementing_agency=fields.get("implementing_agency", ""),
                income_limit=fields.get("income_limit"),
                minority_community_required=bool(fields.get("minority_community_required", False)),
                objective=fields.get("objective", ""),
                ration_card_type=fields.get("ration_card_type", []) or [],
                raw_text_length=len(raw_text),
                scheme_name=fields.get("scheme_name") or listing.scheme_name,
                scraped_at=datetime.now(timezone.utc).isoformat(),
            ))
            _ = content_hash  # kept on the record via future DB layer if needed
            time.sleep(1.0)

        browser.close()
    return records


def save_to_mongo(records: list, uri: str, db_name: str, collection_name: str) -> None:
    from pymongo import MongoClient
    from pymongo.errors import PyMongoError
    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=5000)
        client.admin.command("ping")
        collection = client[db_name][collection_name]
        for r in records:
            collection.update_one({"source_url": r["source_url"]}, {"$set": r}, upsert=True)
        print(f"[db] saved {len(records)} records to {db_name}.{collection_name}", file=sys.stderr)
        client.close()
    except PyMongoError as exc:
        print(f"[db] failed: {exc}", file=sys.stderr)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="myscheme_karnataka.json")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--save-db", action="store_true")
    parser.add_argument("--mongo-uri", default=DEFAULT_MONGO_URI)
    parser.add_argument("--mongo-db", default=DEFAULT_MONGO_DB)
    parser.add_argument("--mongo-collection", default=DEFAULT_MONGO_COLLECTION)
    args = parser.parse_args()

    records = scrape_all(args.limit)
    dicts = [asdict(r) for r in records]

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(dicts, f, indent=2, ensure_ascii=False)
    print(f"Wrote {len(dicts)} records to {args.out}", file=sys.stderr)

    if args.save_db:
        save_to_mongo(dicts, args.mongo_uri, args.mongo_db, args.mongo_collection)


if __name__ == "__main__":
    main()