"""Fetches scheme listings and detail content from myscheme.gov.in — the only
source this pipeline uses (see config.py's module docstring for why
govtschemes.in was dropped).

myscheme.gov.in is a client-rendered SPA whose own page HTML carries no data
at all (confirmed by inspecting its __NEXT_DATA__ payload — it's empty); the
real data comes from a separate REST API host, api.myscheme.gov.in, found via
the browser's Performance/Resource Timing entries (it's cross-origin, so a
normal same-origin network log won't show it). Calling that API directly with
`requests` is more reliable than rendering the page with Selenium and is what
this module does.
"""

import json
import sys
import time
from dataclasses import dataclass, field
from typing import Optional

import requests

import config


@dataclass
class SchemeListing:
    name: str
    url: str
    source: str  # always "myscheme"
    categories: list = field(default_factory=list)
    myscheme_slug: Optional[str] = None
    query_label: Optional[str] = None  # which config.MYSCHEME_QUERIES entry found this scheme


def get_json(url: str, params: dict = None, retries: int = 3) -> Optional[dict]:
    for attempt in range(1, retries + 1):
        try:
            resp = requests.get(url, headers=config.MYSCHEME_HEADERS, params=params, timeout=config.REQUEST_TIMEOUT)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            print(f"  [warn] API call failed ({attempt}/{retries}) for {url}: {exc}", file=sys.stderr)
            if attempt < retries:
                time.sleep(2 * attempt)
    print(f"  [error] giving up on {url}", file=sys.stderr)
    return None


def fetch_myscheme_list(queries: list = None, page_size: int = 50) -> list:
    """Runs every query in `queries` (each a dict with "label" and "filters" —
    see config.MYSCHEME_QUERIES) against the public search API, paginating each
    one to exhaustion, and returns ONE deduped list of SchemeListing across all
    of them. Dedup is by slug: a scheme can't in practice satisfy more than one
    of the three coverage queries (level is either State or Central, and
    beneficiaryState is either "All" or a specific state, never both), but
    deduping defensively here is what makes the queries safely additive —
    callers never have to reason about cross-query overlap themselves.

    Defaults to config.MYSCHEME_QUERIES (the full state+central coverage set);
    pass an explicit subset (e.g. just the state query) to narrow it."""
    if queries is None:
        queries = config.MYSCHEME_QUERIES

    listings = []
    seen_slugs = set()

    for query in queries:
        query_json = json.dumps(query["filters"])
        offset = 0
        total = None
        while total is None or offset < total:
            payload = get_json(
                f"{config.MYSCHEME_API_BASE}/search/v6/schemes",
                params={
                    "lang": "en", "q": query_json, "keyword": "", "sort": "multiple_sort",
                    "from": offset, "size": page_size,
                },
            )
            if not payload or payload.get("statusCode") != 200:
                break

            data = payload.get("data") or {}
            hits = data.get("hits") or {}
            items = hits.get("items") if isinstance(hits, dict) else hits
            if total is None:
                total = (data.get("summary") or {}).get("total", len(items or []))
            if not items:
                break

            for hit in items:
                fields = hit.get("fields") or {}
                slug = fields.get("slug")
                if not slug or slug in seen_slugs:
                    continue
                seen_slugs.add(slug)
                listings.append(SchemeListing(
                    name=(fields.get("schemeName") or "").strip(),
                    url=f"{config.MYSCHEME_SITE_BASE}/schemes/{slug}",
                    source="myscheme",
                    categories=fields.get("tags") or [],
                    myscheme_slug=slug,
                    query_label=query["label"],
                ))

            offset += page_size
            time.sleep(config.POLITE_DELAY_SECONDS)

    return listings


def _flatten_slate_text(nodes, joiner: str = "; ") -> str:
    """myscheme.gov.in returns rich text (eligibility, benefits, documents,
    application steps) as Slate.js JSON trees, not plain strings — flattens
    that into plain text."""
    if not nodes:
        return ""

    def children_text(children):
        return "".join(c.get("text", "") for c in (children or []) if isinstance(c, dict) and "text" in c)

    pieces = []

    def walk(node_list):
        for node in node_list or []:
            if not isinstance(node, dict):
                continue
            node_type = node.get("type")
            children = node.get("children") or []
            if node_type in ("ol_list", "ul_list"):
                for item in children:
                    text = children_text(item.get("children")).strip()
                    if text:
                        pieces.append(text)
            elif node_type == "paragraph":
                text = children_text(children).strip()
                if text:
                    pieces.append(text)
            elif children:
                walk(children)

    walk(nodes)
    return joiner.join(pieces)


def fetch_myscheme_detail(listing: SchemeListing) -> dict:
    """Fetches myscheme.gov.in's structured detail + documents-required
    endpoints and returns each section as its OWN field — deliberately NOT
    flattened into one labeled text blob the way the old pipeline did
    ("Scheme: X\\n\\nTags: ...\\n\\nDescription: ..."). That flat-blob format
    is what caused the old bug: a naive "first 4 lines" extractor grabbed the
    Scheme:/Tags:/Implementing agency: label lines instead of the real
    description, and a fixed 1500-char slice sometimes ran out before
    reaching the Eligibility: section for records with long descriptions.
    Keeping sections separate means extract.py can hand the LLM exactly the
    right source text for each output field instead of asking it to
    re-split one shared string by label.

    application_link and scheme_status are read directly from myscheme's own
    structured fields (never LLM-derived) — more reliable than any text
    extraction, structured or not.
    """
    detail_payload = get_json(
        f"{config.MYSCHEME_API_BASE}/schemes/v6/public/schemes",
        params={"slug": listing.myscheme_slug, "lang": "en"},
    )
    if not detail_payload or detail_payload.get("statusCode") != 200:
        return None

    record = detail_payload.get("data") or {}
    scheme_id = record.get("_id", "")
    en = record.get("en") or {}
    basic = en.get("basicDetails") or {}
    content = en.get("schemeContent") or {}
    eligibility_block = en.get("eligibilityCriteria") or {}

    brief_description = content.get("briefDescription") or ""
    detailed_description = _flatten_slate_text(content.get("detailedDescription"))
    benefits_text = _flatten_slate_text(content.get("benefits"))
    eligibility_text = _flatten_slate_text(eligibility_block.get("eligibilityDescription"))

    application_link = ""
    application_pieces = []
    for mode_entry in en.get("applicationProcess") or []:
        mode_text = _flatten_slate_text(mode_entry.get("process"))
        if mode_text:
            application_pieces.append(f"{mode_entry.get('mode', '')}: {mode_text}")
        url = (mode_entry.get("url") or "").strip()
        if url and not application_link:
            application_link = url
    application_process_text = " | ".join(application_pieces)

    # fetch_warnings: field name -> reason, for a sub-fetch that failed or
    # returned non-200 after retries, as opposed to succeeding and genuinely
    # finding nothing. Confirmed real case (see NEXT_SESSION_TODO.md item 1):
    # the documents sub-endpoint for slug ifticmcst failed after 3 retries
    # during a network-flaky window, and the record was written with
    # documents_text="" — indistinguishable from myscheme genuinely having no
    # documents listed. Stored in the RAW CACHE only — normalizer.py no
    # longer threads this into karnataka_schemes.json (the uncertain_fields
    # output field it used to feed was removed 2026-09-09, since Backend
    # never read it). This dict is currently unconsumed downstream; kept here
    # so the underlying fetch-failure detection survives if a consumer for it
    # exists again later, rather than deleting the signal outright.
    fetch_warnings = {}
    documents_text = ""
    if scheme_id:
        documents_payload = get_json(
            f"{config.MYSCHEME_API_BASE}/schemes/v6/public/schemes/{scheme_id}/documents",
            params={"lang": "en"},
        )
        if documents_payload and documents_payload.get("statusCode") == 200:
            documents_en = ((documents_payload.get("data") or {}).get("en")) or {}
            documents_text = _flatten_slate_text(documents_en.get("documents_required"))
        else:
            fetch_warnings["documents_required"] = (
                "documents sub-endpoint fetch failed or returned non-200 after retries "
                "— not confirmed to genuinely have no documents"
            )
    else:
        fetch_warnings["documents_required"] = "no scheme_id available to fetch documents from"

    # myscheme.gov.in gives close date directly — more reliable than a
    # keyword scan (which is exactly what previously misread an FAQ visitor's
    # "my registration expired" as the SCHEME being closed).
    close_date = basic.get("schemeCloseDate")
    scheme_status = "Closed" if close_date else "Active"

    # Not sent through the LLM, not written to the final record — used only by
    # validate_anthropic_schemes.py's tags/department consistency check (see
    # README's investigation notes on the "Madilu Kit" source-mislabeling bug):
    # myscheme's OWN topic classification for the scheme, independent of its
    # prose fields, so a title/department mismatch is a same-source internal
    # inconsistency signal rather than something requiring outside ground truth.
    nodal_department = (basic.get("nodalDepartmentName") or {}).get("label") or ""

    return {
        "scheme_name": basic.get("schemeName") or listing.name,
        "tags": basic.get("tags") or [],
        "implementing_agency": basic.get("implementingAgency") or "",
        "nodal_department": nodal_department,
        "brief_description": brief_description,
        "detailed_description": detailed_description,
        "benefits_text": benefits_text,
        "eligibility_text": eligibility_text,
        "documents_text": documents_text,
        "application_process_text": application_process_text,
        "application_link": application_link,
        "scheme_status": scheme_status,
        "fetch_warnings": fetch_warnings,
    }
