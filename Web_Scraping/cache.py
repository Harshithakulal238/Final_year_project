"""Per-slug on-disk cache for the myscheme.gov.in pipeline (see pipeline.py) —
this is what makes an interrupted ~753-scheme run resumable without re-hitting
myscheme's API or re-spending Groq tokens on schemes already done.

Two independent caches, both under config.CACHE_DIR:
  - raw/{slug}.json        the fetched detail dict, written right after a
                            successful fetch. A hit here just skips re-fetching.
  - extracted/{slug}.json  the Groq extraction result, written after EVERY
                            attempt (success or failure — nothing is silently
                            lost), but only counted as a cache HIT by
                            load_extracted() when the stored input hash matches
                            the scheme's current SOURCE TEXT, the stored prompt
                            version matches extract.py's CURRENT prompt, and
                            the stored result has no extraction_error. A failed
                            attempt is therefore retried on every subsequent
                            run until it succeeds, never silently skipped.

WHY PROMPT VERSION IS TRACKED SEPARATELY FROM THE SOURCE-TEXT HASH
--------------------------------------------------------------------
Added 2026-09-10, after confirming a real, silent consequence of NOT tracking
it: `hash_inputs()` only ever covered the four raw text sections extract.py's
prompt reads — it had no way to know if extract.py's PROMPT_TEMPLATE itself
had changed. Every prompt fix made across this project (the income_limit_
rural/urban split, the source_mismatch "STEP ZERO" title check, the weaver/
construction-worker occupation mapping) only affected records extracted
*after* that fix landed — anything already cached kept serving its old,
pre-fix result forever, because the source text hadn't changed, only the
code reading it had. Confirmed concretely: 45 of the 60 records in
karnataka_schemes.json were still on their original 2026-08-24 extraction,
never re-validated against three subsequent prompt versions, and 3 of those
(Nekar Samman Yojana, Kaimagga Vikasa Yojana - Karnataka, Supply of Tool Kits
to their Trained Workers) are confirmed still carrying the pre-fix
`occupation: null` as a direct result.

`load_extracted`/`save_extracted`/`needs_extraction` now all take a
`prompt_version` (see extract.PROMPT_VERSION — a hash of PROMPT_TEMPLATE
itself, recomputed automatically whenever that template's text changes) and
store/compare it as its OWN field, separate from `_input_hash`. Kept as two
separate checks rather than folded into one combined hash so a cache miss's
cause is legible from the file itself: a source-text change and a prompt
change are different events, one relevant to whether myscheme's own listing
changed, the other to whether this codebase's extraction logic changed — the
same "don't collapse two different kinds of null/staleness into one signal"
principle this pipeline already applies to its output schema.
"""

import hashlib
import json
import os

import config


def _slug_path(directory: str, slug: str) -> str:
    return os.path.join(directory, f"{slug}.json")


def _ensure_dirs() -> None:
    os.makedirs(config.RAW_CACHE_DIR, exist_ok=True)
    os.makedirs(config.EXTRACTED_CACHE_DIR, exist_ok=True)


def hash_inputs(detail: dict) -> str:
    """Hashes exactly the four text sections extract.py's prompt reads (see
    its _build_prompt), not the whole detail dict — so an unrelated field
    (tags, implementing_agency, ...) changing on a re-fetch doesn't invalidate
    a perfectly good cached extraction."""
    parts = [
        detail.get("brief_description") or "",
        detail.get("detailed_description") or "",
        detail.get("eligibility_text") or "",
        detail.get("benefits_text") or "",
    ]
    joined = "\x1f".join(parts)  # unit separator; won't collide with real text
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()


def load_raw(slug: str):
    path = _slug_path(config.RAW_CACHE_DIR, slug)
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_raw(slug: str, detail: dict) -> None:
    _ensure_dirs()
    with open(_slug_path(config.RAW_CACHE_DIR, slug), "w", encoding="utf-8") as f:
        json.dump(detail, f, indent=2, ensure_ascii=False)


def load_extracted(slug: str, input_hash: str, prompt_version: str):
    """Returns the cached LLM fields dict only on a genuine hit: file exists,
    its stored source-text hash matches `input_hash`, its stored prompt
    version matches `prompt_version` (see extract.PROMPT_VERSION), and it has
    no extraction_error. Anything else (missing, stale source hash, stale
    prompt version, or a cached failure) returns None so the caller
    re-extracts. A cache file from before 2026-09-10 has no `_prompt_version`
    key at all — `.get()` returns None, which never equals a real hash
    string, so every pre-existing cache entry correctly misses exactly once
    against the first prompt-version-aware run, with no separate migration
    step needed."""
    path = _slug_path(config.EXTRACTED_CACHE_DIR, slug)
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        cached = json.load(f)
    if cached.get("_input_hash") != input_hash:
        return None
    if cached.get("_prompt_version") != prompt_version:
        return None
    if cached.get("llm_fields", {}).get("_extraction_error"):
        return None
    return cached["llm_fields"]


def save_extracted(slug: str, input_hash: str, prompt_version: str, llm_fields: dict) -> None:
    """Writes every attempt, success or failure — a failure written here is
    what load_extracted() reads as 'not done yet, retry me'."""
    _ensure_dirs()
    with open(_slug_path(config.EXTRACTED_CACHE_DIR, slug), "w", encoding="utf-8") as f:
        json.dump(
            {"_input_hash": input_hash, "_prompt_version": prompt_version, "llm_fields": llm_fields},
            f, indent=2, ensure_ascii=False,
        )


def needs_extraction(slug: str, prompt_version: str) -> bool:
    """Cheap pre-flight quota-estimate check (see quota.py) — used BEFORE any
    fetching happens, so there's no input_hash available yet to do the exact
    source-text check load_extracted() does; that half stays deliberately
    optimistic (a slug with a successful extraction under the CURRENT prompt
    version counts as 'probably won't need a fresh call,' even though the
    source text could in principle have changed since — load_extracted() is
    what catches that at actual extraction time). The prompt-version half,
    unlike the source-text half, doesn't need a fetch to check exactly —
    it's a fixed value known upfront — so it's checked exactly here, not
    optimistically: a slug cached under a stale prompt version is always
    counted as needing extraction, never silently assumed done. This is the
    fix for the exact gap that let 45 records go stale after later prompt
    changes without the pre-flight token estimate ever reflecting it."""
    path = _slug_path(config.EXTRACTED_CACHE_DIR, slug)
    if not os.path.exists(path):
        return True
    with open(path, encoding="utf-8") as f:
        cached = json.load(f)
    if cached.get("_prompt_version") != prompt_version:
        return True
    return bool(cached.get("llm_fields", {}).get("_extraction_error"))
