# Web Scraping Project Context

This document explains the two scraping folders in the Sahayak project. Use it as background context when asking an AI assistant to explain, debug, or modify the scraping code.

## Project Purpose

The scraping code builds a JSON dataset of Indian government welfare schemes relevant to people in Karnataka. The Sahayak backend uses scheme fields such as age, gender, income, caste/category, occupation, district, ration-card type, disability, and minority status to evaluate eligibility against a user's profile. The main current output is `Web_Scraping/karnataka_schemes.json`.

There are two different generations of the scraper:

- `Web_Scraping/` is the current, modular myScheme API + Groq pipeline. This is the implementation to treat as the active system.
- `Web_Scraping_old/` contains the earlier page-scraping implementation. It is historical/reference code, not imported by the current pipeline.

The active folder also still contains `Scheme_extractor_2.py` and `Scraper_2.py`. These are legacy/reference scripts inside the active folder; they are not the entry points used by `pipeline.py`.

## Current Pipeline: `Web_Scraping/`

### High-level flow

```text
myscheme.gov.in public REST API
        |
        v
sources.py: collect and deduplicate listing records
        |
        v
sources.py: fetch structured detail sections and documents
        |
        +--> cache/raw/{slug}.json
        |
        v
extract.py: Groq interprets only fields requiring language understanding
        |
        +--> cache/extracted/{slug}.json
        |
        v
normalizer.py: combine API values + validated LLM values into backend schema
        |
        v
pipeline.py: write/merge karnataka_schemes.json; optionally upsert MongoDB
```

This current pipeline does not use Playwright or scrape rendered HTML. The myScheme site is a client-rendered web app, but its own public REST API is called directly with `requests`. The pipeline only uses myScheme as its source; it does not use `govtschemes.in`.

### Coverage

`config.py` defines three additive queries:

- `state_karnataka`: State-level schemes for Karnataka.
- `central_all`: Central schemes available nationwide.
- `central_karnataka`: Central schemes specifically tagged for Karnataka.

The intended dataset is the union of all three, because a Karnataka resident may qualify for both Karnataka state schemes and national central schemes. Running only a state/Karnataka query omits nationwide central schemes. The labels are retained on in-memory listing objects to track which query found a scheme, but the final current output does not include `scheme_level`.

### Active file responsibilities

- `pipeline.py`: CLI and orchestration. Fetches listings, optionally takes a mixed sample with `--limit`, checks quota, uses caches, calls the normalizer, writes JSON, and can save to MongoDB. It protects the output from being replaced by an empty result if listing/detail fetching fails completely.
- `config.py`: API URLs/headers, query filters, request delays, Groq model and limits, cache/output paths, token budget, process-lock path, output schema field list, and allowed vocabularies for district, occupation, caste, education, ration card, and special conditions.
- `sources.py`: Calls myScheme's search/detail/document REST endpoints, paginates the listing queries, deduplicates by scheme slug, and flattens API Slate.js rich-text sections into plain text. Structured values such as the application URL and status come directly from the source API.
- `extract.py`: Builds the Groq prompt and validates the model response. It asks the model to interpret description/eligibility and structured eligibility facts, checks values against controlled vocabularies, handles retries/quota errors, and rejects or nulls data if the source text appears to describe a different scheme than the title. There is intentionally no regex/heuristic fallback in this pipeline: a missing Groq key stops the run rather than silently generating lower-quality output.
- `normalizer.py`: The single boundary that maps source/API values and extracted fields to the final schema. It maps internal extraction names `caste_restriction` to output `caste_category`, and `occupation` to output `applicant_type`, matching the backend's rule engine.
- `cache.py`: Stores raw source details and extracted LLM results by scheme slug. Extracted results are reused only when both the source-text hash and prompt-version hash match and the previous extraction succeeded. Failed extractions are retried on later runs.
- `quota.py`: Records Groq token use in a rolling 24-hour JSONL log, estimates remaining daily budget, and estimates tokens per extraction for preflight checks.
- `lock.py`: Prevents two Groq-consuming scripts from running concurrently against the same API quota. It writes a PID lock and handles stale locks.
- `verify_fields.py`: Free, report-only, regex/keyword-based check of whether populated fields are supported by the cached source and whether some null fields may be missing.
- `verify_fields_llm.py`: Groq-based follow-up for ambiguous flags from `verify_fields.py`. It writes a separate report, not the dataset.
- `verify_title_match.py`: One-off Groq second opinion on whether a record's description/eligibility plausibly matches its scheme name. Report-only; uses the shared quota log and lock.
- `validate_anthropic_schemes.py`: Historical filename. It validates schema coverage and checks application links; it does not call Anthropic. It reports quality issues and does not repair the data.
- `inspect_mongo.py`: Read-only inspection of the MongoDB database/collection used by the backend.
- `Scheme_extractor_2.py`, `Scraper_2.py`: Legacy/reference implementations; `pipeline.py` does not import them.
- `karnataka_schemes.json`: Main output dataset, unless `--out` specifies another path.
- `cache/myscheme/raw/`: Cached API detail payloads, one JSON file per slug.
- `cache/myscheme/extracted/`: Cached LLM extraction results, one JSON file per slug.
- `quota/usage_log.jsonl`: Local record of API token usage.
- `.env`: Local secrets/configuration. Do not share or paste its contents. The active pipeline expects `GROQ_API_KEY` here.
- `.env.example`: Template for local environment configuration.
- `NEXT_SESSION_TODO.md`: Project notes about known issues and pending data/validation work; read it before making decisions that depend on current known limitations.
- `README.md`: Operational documentation for the active pipeline, but some statements currently conflict with the checked-out files; see "Important caveats" below.

### Current output shape

`normalizer.py` writes one record per scheme with 21 keys:

`scheme_name`, `description`, `eligibility`, `age_min`, `age_max`, `gender`, `income_limit`, `caste_category`, `applicant_type`, `district`, `education`, `special_conditions`, `ration_card_type`, `minority_community_required`, `disability_required`, `benefits`, `application_process`, `application_link`, `documents_required`, `source_url`, and `scheme_status`.

The API supplies clean structured values such as the scheme name, application link/status, benefits, application process, and required documents; these bypass the LLM. The LLM handles interpretation-heavy prose and eligibility details. Unknown values should remain `null`, `false`, or empty arrays as appropriate; the extractor is instructed not to invent facts. Controlled categorical values are checked in code after the model responds.

The live schema intentionally no longer contains some diagnostic or extra fields that older data may contain, including `source_mismatch`, `extraction_error`, `extraction_method`, `last_verified`, `scheme_level`, `income_limit_rural`, and `income_limit_urban`. Do not assume a field exists just because an older JSON file or cache contains it.

### Running the current pipeline

Run commands from `Web_Scraping/`:

```bash
python pipeline.py --queries state_karnataka,central_karnataka
python pipeline.py --queries central_all --merge
```

The first command processes the Karnataka state and Karnataka-targeted central queries. The second adds nationwide central schemes to the existing output. By default, a run overwrites the output with the records from that run; `--merge` combines with the existing file and deduplicates by `source_url`, with new records winning. A quota stop forces safe merge behavior so partial progress does not shrink a previously complete file. `--limit N` is for a small mixed test sample, not a complete dataset.

The process requires network access to `api.myscheme.gov.in` and `api.groq.com`, and a valid `GROQ_API_KEY`. Long runs are resumable because successful fetches and extractions are cached. If Groq access fails, do not interpret null extraction fields as proof that the scheme has no eligibility details.

## Legacy Pipeline: `Web_Scraping_old/`

This folder is a much smaller, older page-based design. It has `Scraper_2.py`, `Scheme_extractor_2.py`, `requirements.txt`, `karnataka_schemes.json`, and `sample.json`.

### `Scheme_extractor_2.py`

This is the older `govtschemes.in` implementation. It requests the Karnataka listing page with `requests`, parses the HTML table with BeautifulSoup, visits each scheme detail page, and tries to remove page navigation/boilerplate from the text. It structures scheme descriptions, benefits, eligibility, documents, and application steps using either:

- A Gemini call (`google-genai`) when `--use-llm` is passed.
- A regex/keyword heuristic when LLM mode is not used or the Gemini attempt fails.

It then runs regex-based eligibility extraction over the isolated eligibility text, producing structured values for age, gender, income, caste, ration card, minority, education, disability, and applicant type. It can write JSON and optionally upsert into MongoDB by `source_url`.

Important implementation detail: its CLI help/docstrings still mention Anthropic in places, but the live function imports Google `genai` and uses Gemini. If you are debugging provider setup, trust the imports and actual function implementation, not stale comments. Its source is an unofficial aggregator, unlike the current pipeline's myScheme API source.

### `Scraper_2.py`

This is another older implementation, targeting myScheme's rendered website rather than its REST API. It opens Chromium with Playwright, loads the Karnataka search page, scrolls/clicks for additional scheme cards, visits each detail page, and extracts rendered text from `main`/`article`/`body`. It sends text to Gemini and expects a fixed JSON shape; extraction failures are recorded with a `failed` method and mostly empty fields rather than using the other script's regex extractor. It can write JSON and optionally upsert to MongoDB.

This approach is heavier and more sensitive to site rendering/selectors than the active API client. Its search URL is only the Karnataka state search page, so it should not be assumed to cover the nationwide central schemes included by the current three-query pipeline.

### Relationship between old and active folders

The two legacy files also appear in `Web_Scraping/` as reference scripts. The checked-in copies under `Web_Scraping/` and `Web_Scraping_old/` have matching implementations in the inspected sections, but the supported current flow is still `python pipeline.py`; neither legacy script is part of that flow. `Web_Scraping_old/requirements.txt` is broad and includes packages for multiple scraping experiments, not a reliable minimal dependency list for the current pipeline.

## Key Differences

| Concern | Current `Web_Scraping/` pipeline | Legacy `Web_Scraping_old/` scripts |
|---|---|---|
| Entry point | `pipeline.py` | `Scheme_extractor_2.py` or `Scraper_2.py` |
| Source | myScheme REST API | `govtschemes.in` HTML or myScheme rendered HTML |
| Fetching | `requests` against structured endpoints | BeautifulSoup HTML parsing or Playwright Chromium |
| LLM | Groq, required for interpretation | Gemini; heuristic fallback in `Scheme_extractor_2.py` |
| Coverage design | State + nationwide central + Karnataka-targeted central queries | Typically Karnataka page/list only |
| Reliability mechanisms | Per-scheme caches, prompt-version invalidation, quota estimation/logging, process lock, safe merge | Basic retries, delay, JSON output; no equivalent shared resumable/quota architecture |
| Data shaping | Centralized `normalizer.py`, current backend schema | Data classes and fields shaped inside each script; older schema |
| Intended status | Active | Historical/reference |

## Important Caveats for AI Assistants

1. Do not say the active system uses Playwright or scrapes HTML. `pipeline.py` uses the myScheme REST API via `sources.py`.
2. Do not say the active system uses Gemini or Anthropic. Its extraction provider is Groq. Gemini belongs to the legacy scripts; Anthropic references are stale comments/names.
3. Do not claim the active pipeline has a heuristic fallback. It intentionally fails fast without a Groq key and preserves unknown values rather than guessing.
4. Do not treat `Web_Scraping_old/` as the code imported by `pipeline.py`. It is a separate historical implementation.
5. Do not paste or expose `.env`, API keys, MongoDB URIs, or other credentials.
6. Distinguish an absent value from a failed or stale extraction. The live output schema has removed some diagnostics, while caches and logs retain separate signals. Inspect the raw cache, extraction cache, validation report, and TODO notes before diagnosing a suspicious null.

## Repository Mismatches to Keep in Mind

- `Web_Scraping/README.md` says the older `Scheme_extractor_2.py` was deleted, but it exists in the checked-out active folder.
- The README describes `requests` and `python-dotenv` (plus `pymongo` for Mongo inspection) as the relevant dependencies. The checked-in `requirements.txt` instead contains a much broader legacy-oriented package list and does not list `python-dotenv`, even though current `extract.py` imports `dotenv`.
- `Web_Scraping/sample.json` uses the older output shape (for example, `categories`, `raw_text_length`, `extraction_method`, and `scraped_at`), not the current 21-key output schema. Do not use it as the schema authority for `pipeline.py`.
- Some filenames/comments are historical: `validate_anthropic_schemes.py` is a validator, not an Anthropic scraper; legacy `Scheme_extractor_2.py` comments mention Anthropic although the active code path uses Gemini.

When changing the system, follow the actual current call path (`pipeline.py` -> `sources.py` / `extract.py` -> `normalizer.py`) and confirm the backend's field expectations before changing the output schema.