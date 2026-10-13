# Web_Scraping

Scrapes Karnataka government scheme data for the Sahayak recommendation engine.

**This README covers `pipeline.py`** — the active myscheme.gov.in + Groq LLM
scraper that produces `karnataka_schemes.json`. An older, separate script,
`Scheme_extractor_2.py` (govtschemes.in + myscheme.gov.in, heuristic or Gemini
extraction — historically also wrote to `karnataka_schemes.json`, before
`pipeline.py` took over that filename), used to live in this folder for
reference/comparison. It was deleted 2026-09-12 — fully superseded, no unique
capability, and its own past output was the garbled-data bug that motivated
building `pipeline.py` in the first place (see "WHY NO FALLBACK" in
`extract.py`).

## Coverage: state + central, not just state

`pipeline.py` covers the full union of schemes a Karnataka citizen can apply
for, via three separate myscheme.gov.in API queries (`config.MYSCHEME_QUERIES`):

| label | filter | count (2026-08-24) |
|---|---|---|
| `state_karnataka` | `level=State, beneficiaryState=Karnataka` | 56 |
| `central_all` | `level=Central, beneficiaryState=All` | 693 |
| `central_karnataka` | `level=Central, beneficiaryState=Karnataka` | 4 |

The obvious URL, `myscheme.gov.in/search/state/Karnataka`, only covers the
first row — it hard-codes `level=State` into its own search filter, silently
excluding all nationwide central schemes. Internally, which query found a
scheme is tracked via `config.LEVEL_BY_QUERY_LABEL` (state vs. central,
never re-inferred from prose), but this is not written out to
`karnataka_schemes.json` — see "What's in the output schema" below.

## Setting up on a new device

### Case 1: a teammate who has the project repo, but not this `Web_Scraping/` folder

**What to copy from you**: every `.py` file, `requirements.txt`, `.env.example`,
and this README. **Do not copy `.env`** — it holds your personal
`GROQ_API_KEY`; they need their own (get one at
https://console.groq.com/keys, it's free to sign up). Copying
`karnataka_schemes.json` is optional — useful as a starting point, not
required to run the pipeline.

**`cache/` is optional — decide deliberately, it changes real cost:**
- **Bring it**: 59 of the current 60 schemes reproduce their exact cached
  result with **zero** new Groq calls (`cache.load_extracted()` matches by a
  content hash of the source text — see `cache.py`). The 60th,
  `iicmscc` (Incentive for the Intra Caste Marriage within Scheduled Caste
  Community), has a cached *failure*, not a result, so it always re-attempts
  extraction regardless of what cache you bring.
- **Don't bring it**: all 60 need a fresh fetch + a fresh Groq call. See
  timing/cost below — still comfortably inside one day's quota, just not free.

**Install** (Python 3.9 or newer — what this pipeline has actually been run
and verified under):
```bash
pip install -r requirements.txt
```
As of 2026-09-12, `requirements.txt` is exactly what's used in this folder —
`requests` + `python-dotenv` for `pipeline.py`'s own import chain
(`cache`/`config`/`extract`/`lock`/`normalizer`/`quota`/`sources.py` —
everything else in that chain is Python stdlib), plus `pymongo` for
`inspect_mongo.py`. If you only want `pipeline.py` and not the MongoDB
inspector, `pip install requests python-dotenv` alone is enough.

**Configure**: copy `.env.example` to `.env` and fill in their own
`GROQ_API_KEY`.

**Run**, to reproduce the current 60-scheme scope exactly (not the bare
`python pipeline.py`, which pulls all three queries — the full ~753-scheme
national coverage, a different and much larger run):
```bash
python pipeline.py --queries state_karnataka,central_karnataka
```

**Overwritten, not merged**: if they copied your `karnataka_schemes.json`
over too, this command **replaces it completely** — `merge` defaults to
`False`, and without `--merge`, `_run()` never even loads the existing file
before writing (see `pipeline.py`'s `run()`). To add to what they have
instead of replacing it, they must pass `--merge` explicitly.

**Timing and cost**: ~20 minutes if starting from zero cache (dominated by
Groq's pacing, not the scraping — see "How long it takes" below); ~150,000
of Groq's 200,000-token daily cap (60 schemes × ~2,500 tokens/call estimate)
— comfortably inside a full day's budget, and a new key/device always starts
with the full 200,000 since the rolling-24h usage log
(`quota/usage_log.jsonl`) doesn't exist yet.

**If `GROQ_API_KEY` is missing or still the placeholder**: `pipeline.py`
fails immediately, before any network request — `extract.get_groq_api_key()`
raises with a message pointing straight at `.env`.

**If the key is present but wrong/revoked**: nothing checks validity up
front — pre-flight only estimates token counts, it never makes a real call.
The run proceeds through the entire listing, and every single scheme's
extraction fails (401/403); each comes back with all its LLM-derived fields
`null`. **This does NOT show up in `karnataka_schemes.json` itself** — the
field that used to flag an extraction failure (`extraction_error`) was
removed from the output schema on 2026-09-09 (see "What's in the output
schema" below). The only place a bad key surfaces is the terminal's
end-of-run failure summary — watch it.

**Network**: both `api.myscheme.gov.in` and Groq's API (`api.groq.com`) must
be reachable. myscheme.gov.in's own CDN can geo-block a request depending on
where the running machine appears to be located — see "Troubleshooting"
below; there's no code-side fix for that one.

### Case 2: a completely fresh device — nothing on it at all

0. **Get the code onto the device** — copy the whole `Web_Scraping/` folder
   (or the whole repo). This is the only thing that comes over: no `.env`,
   no `cache/`, no existing `karnataka_schemes.json`.
1. **Install Python 3.9 or newer.**
2. **Install dependencies** — same reasoning as Case 1:
   ```bash
   pip install -r requirements.txt
   ```
   or, for `pipeline.py` alone, `pip install requests python-dotenv`.
3. **Create `Web_Scraping/.env`** from the template, with a real key:
   ```
   GROQ_API_KEY=<your own key from https://console.groq.com/keys>
   ```
4. **Run the exact command that reproduces the current 60-scheme scope:**
   ```bash
   python pipeline.py --queries state_karnataka,central_karnataka
   ```

**Overwritten vs. merged**: moot here — nothing was copied, so there's no
existing `karnataka_schemes.json` to overwrite or merge into. This run
creates it fresh.

**Timing, cost, bad-key behavior, and network requirements**: identical to
Case 1 above — none of that depends on whether a prior `cache/` existed,
only on whether one is present when the run starts.

### Known limitation: the current file predates a 2026-09-10 cache fix, and hasn't been re-extracted yet

The current `karnataka_schemes.json` will differ from what the pipeline
produces once it's next run — and the differences are expected to be
corrections, not regressions. Checked directly against the extraction
cache's own timestamps: **45 of the current 60 records were extracted on
2026-08-24**, before several later prompt fixes existed — the
`income_limit_rural`/`income_limit_urban` split, the source-mismatch "STEP
ZERO" title check, and the weaver/construction-worker occupation-vocabulary
mapping. The root cause: `cache.load_extracted()` used to invalidate by
source-text content hash only, with no notion of prompt version, so a
record's cached result never automatically updated just because the prompt
that produces it got better.

**This root cause is fixed as of 2026-09-10** — `cache.py` now also tracks
`extract.PROMPT_VERSION` (a hash of `PROMPT_TEMPLATE` itself) on every cache
entry; a prompt change now invalidates every affected entry automatically,
with no manual cache deletion needed (see `cache.py`'s module docstring).
Verified locally: all 60 existing cache entries are correctly seen as stale
under this new check. **The fix prevents this from happening silently
again — it does not retroactively repair the 45 already-stale records in the
current file.** That still needs an actual re-extraction run, queued in
`NEXT_SESSION_TODO.md` and blocked only on Groq's ongoing 403.

Two confirmed, named examples of what a clean run will very likely fix:
- **Nekar Samman Yojana**, **Kaimagga Vikasa Yojana - Karnataka**, and
  **Supply of Tool Kits to their Trained Workers** currently have
  `applicant_type: null` — extracted 2026-08-24, before the occupation
  vocabulary mapped "weaver" → `unorganised` and "registered construction
  worker" → `labourer`. A clean run would very likely fill these in
  correctly instead of leaving them null.
- **Incentive for the Intra Caste Marriage within Scheduled Caste Community**
  (`iicmscc`) is currently entirely null — not a genuine "nothing here"
  result, but a cached HTTP 403 failure from the most recent re-extraction
  attempt (2026-09-07). A clean run with working Groq access would very
  likely produce real content here instead of null.

## Running the scraper

**Directory**: run from inside `Web_Scraping/` (the commands below assume that).

**1. Install dependencies:**
```bash
pip install -r requirements.txt
```

**2. Set up `.env`** — create `Web_Scraping/.env` (not committed; gitignore it
if this repo is ever put under git) containing:
```
GROQ_API_KEY=your_groq_api_key_here
```
Get a key at https://console.groq.com/keys. The pipeline **fails immediately**,
before making any request, if this is missing or still the placeholder value —
there is no fallback extraction path, by design.

**3. Run it, in batches:**
```bash
# batch 1 — the ~60 Karnataka-specific schemes (state + central-KA), ~20 min
python pipeline.py --queries state_karnataka,central_karnataka

# batch 2 — the ~693 nationwide central schemes, run separately (hours), and
# MERGE into batch 1's output rather than overwriting it
python pipeline.py --queries central_all --merge

# or just run everything in one call, no batching
python pipeline.py
```
Extracts fields via Groq (`openai/gpt-oss-120b`) and writes `karnataka_schemes.json`.

**`--merge` matters**: without it, a run **overwrites `--out` completely**
with only the records that run produced — this is what batch 1 wants, since
it's replacing the pre-pipeline `karnataka_schemes.json` (the old
`Scheme_extractor_2.py`-era file with garbled descriptions) outright, not
merging into it. With `--merge`, existing records in `--out` are loaded first
and combined with this run's new ones, deduped by `source_url` (new wins on
any collision) — this is what lets batch 2 add to batch 1's output instead of
clobbering it, and generally what makes rerunning after any batch is already
on disk safe.

**Useful flags:**
```bash
python pipeline.py --limit 10 --out _test.json            # mixed test sample first
python pipeline.py --queries central_all                  # only run one query subset
python pipeline.py --out somewhere_else.json               # write elsewhere
```

**Resumable by design**: every fetch and every LLM extraction is cached to
disk per scheme slug under `cache/myscheme/{raw,extracted}/` (see `cache.py`)
as soon as it succeeds. Killing this process at any point — crash, Ctrl+C, a
bad network blip — and rerunning the exact same command picks up exactly
where it left off: no re-fetching, no re-spending Groq tokens on schemes
already done. A cached extraction *failure* is not treated as done — it's
retried on every subsequent run until it succeeds. A cached extraction also
becomes stale, and is automatically retried, if `extract.PROMPT_TEMPLATE`
itself changes since that record was last extracted (`extract.PROMPT_VERSION`
is stored and checked alongside the source-text hash — added 2026-09-10; see
`cache.py`'s module docstring for the incident that motivated it). This also
means batch 2
will never re-fetch or re-extract anything batch 1 already processed, even
though both draw from the same `sources.py`/`extract.py`/cache — the two
batches' query filters are mutually exclusive by construction (state vs.
central), so there's no overlap to begin with, and the cache makes that
free either way.

The cache is safe to delete entirely for a from-scratch re-run — it's
regenerated on demand. **One known exception**, worth knowing before you trust
a cache-based resume: `cache/myscheme/raw/ifticmcst.json`'s `documents_text`
was hand-patched on 2026-09-07 after the automated fetch of that one
sub-endpoint silently failed during a network-flaky window (see
`NEXT_SESSION_TODO.md` item 1 for the full story). Its file modification time
(2026-09-07) is visibly two weeks after every sibling from the same original
scrape batch (2026-08-24), which is how this was caught. Every other cache
file was produced by the pipeline itself, never hand-edited.

**Daily quota tracking and pre-flight refusal** (see `quota.py`): this
account's Groq key is capped at **200,000 tokens/day**, enforced as a
rolling 24h window (confirmed live, not a fixed midnight reset — see
`quota.py`'s docstring). Every Groq call logs its actual token usage to
`quota/usage_log.jsonl`. Before touching Groq at all, `pipeline.py` and
`verify_title_match.py` both estimate how many schemes in the run still need
a fresh call, multiply by the observed average tokens/call, and **refuse to
start** if that estimate exceeds the remaining rolling-24h budget — printing
why and by how much, rather than running for hours and hitting the cap
mid-way with no warning (which happened on 2026-08-24). If the cap is hit
mid-run anyway (estimate was optimistic, or usage moved between the
pre-flight check and the run), `extract.py` detects the specific
tokens-per-day error shape from Groq's response body and raises
`DailyQuotaExhaustedError`, which stops the run cleanly — records already
produced are still written, not lost.

**Process lock** (see `lock.py`): `pipeline.py` and `verify_title_match.py`
both acquire `cache/groq.lock` before making any Groq call and release it on
exit, since both spend against the same shared daily quota and must not run
concurrently with each other or with a second copy of themselves — exactly
what happened on 2026-08-24, when a background run believed killed was still
alive and double-spent an already-near-exhausted quota alongside a fresh
attempt. A second run refuses to start with `AlreadyRunningError` naming the
PID already holding the lock; `cat cache/groq.lock` at any time shows what's
currently running and its PID, for a reliable kill target
(`taskkill /PID <pid> /F`). A lock left behind by a force-killed process is
detected as stale (dead PID) and safely taken over by the next run.

**How long it takes**: dominated by Groq call pacing, not the scraping — the
configured key's tier is rate-limited to 8,000 tokens/minute (confirmed live
via the `x-ratelimit-*` response headers), and each extraction call (a long
prompt carrying all the controlled-vocabulary constraints, plus this model's
own reasoning tokens) commonly uses 1,500-3,000+ tokens, so calls are paced
15 seconds apart (`LLM_DELAY_SECONDS` in `config.py`), with an adaptive
top-up if Groq's own live rate-limit headers say the budget is thin
(`RATE_LIMIT_SAFETY_MARGIN_TOKENS`). Roughly **~20 minutes** for batch 1
(~60 schemes), **~4 hours** for batch 2 (~693 schemes) — safely interruptible
and resumable given the caching above.

**Output files, exact paths** (all under `Web_Scraping/`):
- `karnataka_schemes.json` (or whatever `--out` points at) — the final
  merged dataset, one JSON object per scheme.
- `cache/myscheme/raw/{slug}.json` — one file per scheme, the fetched detail
  before LLM extraction.
- `cache/myscheme/extracted/{slug}.json` — one file per scheme, the Groq
  extraction result plus the input hash it was computed from.

## Running just the validator

To check an existing output file's field coverage and link quality **without
re-scraping or spending any Groq calls**:
```bash
python validate_anthropic_schemes.py --in karnataka_schemes.json
```
This prints a per-field populated/null table, flags any records where an LLM
extraction call failed after retries (tracked separately from a genuine "not
stated in the source" null), and lists schemes where every eligibility-gating
field is unset (they'll match every user unconditionally).

It also HEAD-checks (GET fallback) every populated `application_link`,
rate-limited at 1.5s between requests, reporting live/dead/redirecting and
flagging smells rather than fixing them — `application_link` is always kept
exactly as myscheme provides it, never patched up (e.g. no `https://` ever
prepended):
- the same URL reused across multiple different schemes (almost always a
  generic department portal, not a scheme-specific apply page)
- bare-domain-root links with no scheme-specific path
- links with no URL scheme at all (e.g. `www.example.in`, missing `https://`)
  — flagged directly without attempting a request, since that would just be
  a guaranteed-fail `MissingSchema` error

Skip the (slower) link check if you only want the coverage table:
```bash
python validate_anthropic_schemes.py --in karnataka_schemes.json --skip-link-check
```

## Troubleshooting

**`403 Forbidden` / "The Amazon CloudFront distribution is configured to
block access from your country"** — this is myscheme.gov.in's own CDN
geo-restricting the request; it is not a bug in this script and there is no
code fix for it. It depends entirely on where the machine running the script
appears to be network-located, not on anything in the request itself — the
same code can succeed from one machine and fail from another. If you hit
this, either run the script from a location/network myscheme.gov.in doesn't
block, or route the request through one (e.g. a VPN/proxy exiting from an
allowed region).

The pipeline will never write an empty output file over an existing one when
this (or any other total fetch failure) happens — `run()` raises instead of
writing `[]` if the scheme listing comes back empty, or if every individual
scheme's detail fetch fails. If you see a `RuntimeError` instead of a written
file, that's this guard working as intended; your previous output file (if
any) is untouched.

## What this pipeline does and doesn't do

- **Source**: myscheme.gov.in only. govtschemes.in was dropped — see
  `config.py`'s module docstring for why.
- **Extraction**: every record goes through Groq (`openai/gpt-oss-120b`,
  OpenAI-compatible API). There is no heuristic/regex fallback in this
  pipeline — a missing or failed extraction shows up as a visible null,
  never a silent guess. (Extraction failures and source/title mismatches are
  still detected and null out every affected field internally — see "What's
  in the output schema" below for why that fact itself isn't a field
  anymore.)
- **Never invented**: `description`, `eligibility`, and the structured
  eligibility fields (age/gender/income/caste/occupation/district/education/
  special conditions/ration card/minority/disability) are all grounded in the
  actual source text and constrained to fixed controlled vocabularies
  (`config.py`) that are validated in code after the LLM call, not just
  requested in the prompt.
- **Not sent through the LLM at all**: `scheme_name`, `source_url`,
  `application_link`, `scheme_status`, `benefits`, `application_process`, and
  `documents_required` are copied directly from myscheme.gov.in's own
  structured API fields, since those are already clean (not scraped HTML,
  not free text) and asking a generative model to reproduce text it was
  handed verbatim only adds paraphrase risk for no benefit.
- **`application_link` deadness is not a scraper bug**: it's copied verbatim
  from myscheme.gov.in's own database, which contains a mix of live links,
  dead `.kar.nic.in` domains, bare-domain values missing a URL scheme, and
  generic department-portal homepages reused across unrelated schemes. The
  validator's link check exists to surface this, not to fix it — there's
  nothing to extract differently here, and this file is never patched up
  (e.g. no `https://` ever prepended onto a bare domain).

## What's in the output schema

Every record carries exactly 21 keys: the 18 originally requested
(`scheme_name`, `description`, `eligibility`, `age_min`, `age_max`, `gender`,
`income_limit`, `caste_category`, `applicant_type`, `district`, `education`,
`special_conditions`, `benefits`, `application_process`, `application_link`,
`documents_required`, `source_url`, `scheme_status`), plus 3 more
`Backend/services/ruleEngine.js` also gates eligibility on
(`ration_card_type`, `minority_community_required`, `disability_required`).

**RENAMED 2026-09-09** (23 keys → 21): this record used to carry both
`caste_restriction` and `caste_category` (same value, two keys), and both
`occupation` and `applicant_type` (same value, two keys) — a Backend-compat
alias step (`config.BACKEND_COMPAT_ALIASES`, now deleted) added the second
name of each pair. Reading `Backend/services/ruleEngine.js` directly
confirmed `evaluateCasteRule` reads only `scheme.caste_category` and
`evaluateOccupationRule` reads only `scheme.applicant_type` — the pipeline's
own name in each pair (`caste_restriction`, `occupation`) was never read by
the backend at all, just carried along as dead weight. Each pair is now
written once, under the backend's name only. `extract.py`'s LLM-facing
prompt and internal working dict still use the old names — see that file's
module docstring for why (short version: 63 existing cache files are keyed
by them, and the content hash that gates a cache hit doesn't change on a
field rename, so renaming there without a matching cache migration would
crash on the next cache hit). `normalizer.py` is the one place the rename
happens for what's actually written to disk.

**As of 2026-09-09, that's it** — this pipeline previously also wrote
`scheme_level`, `income_limit_rural`, `income_limit_urban`, `source_mismatch`,
`uncertain_fields`, `field_provenance`, `last_verified`, `source`,
`extraction_method`, `extraction_model`, and `extraction_error`. All 11 were
removed after confirming, by reading `Backend/services/ruleEngine.js` and
`Backend/server.js` directly, that nothing there ever consumed any of them.
`normalizer.py` and `config.py` no longer produce them, so a fresh pipeline
run won't reintroduce them.

**This was a real, partly irreversible loss for the 60 records already
scraped, not just a code cleanup** — and as of 2026-09-12, the one file that
still held the pre-trim state, `karnataka_schemes_full.json`, was itself
deleted (confirmed redundant with a separate whole-folder backup the user
keeps outside this repo, not with anything else still in `Web_Scraping/`).
So within this folder, these are now gone for good short of a fresh
re-extraction:
- `income_limit_rural` / `income_limit_urban` held real, separately-verified
  rural/urban income splits for 9 schemes (e.g. Charmashilpa Scheme:
  ₹30,000 rural / ₹25,000 urban) — `income_limit` alone can't represent two
  different numbers, so this fact is simply absent from the live file, not
  just unread. Only recoverable now via a fresh re-extraction (already
  queued, see `NEXT_SESSION_TODO.md`) or the user's own external backup.
- `source_mismatch` was the only signal that a record's source text had been
  confirmed to describe a *different* scheme than its title (the "Madilu
  Kit" case — see `extract.py`'s module docstring). Removing the field
  doesn't un-null the data (a mismatched record's fields were already forced
  null at extraction time, and stay null), but a record flagged this way is
  indistinguishable in `karnataka_schemes.json` from a scheme that genuinely
  has nothing stated — and that distinction no longer exists anywhere in
  this folder.
- `uncertain_fields` held the free-checker's (`verify_fields.py`) per-field
  notes distinguishing "the source states nothing" from "the source says
  something but we couldn't confidently resolve it." Unlike the two items
  above, this one is NOT gone — `verify_fields.py` still computes it fresh
  into `_field_verification.json` on every run, it just doesn't get merged
  back into the live schema file. (`backfill_uncertain_fields.py`, the
  script that used to do that merge, was deleted 2026-09-12 — its whole
  purpose was incompatible with this schema and it had refused to run since
  2026-09-09 anyway.)
- `extraction_error` was the only signal a record's nulls came from a failed
  Groq call (network/API failure) rather than a genuine "not stated." That
  distinction is also gone from this folder now.

**Scripts that read these fields were updated accordingly**, not left
silently broken: `verify_fields.py` and `verify_title_match.py` no longer
check `source_mismatch`/`extraction_error` (both check for populated
description/eligibility text directly instead, which is the actual
precondition either flag was a proxy for); `validate_anthropic_schemes.py`'s
extraction-failure and source-mismatch coverage counts were removed rather
than left to silently report a false "0" forever. The `caste_restriction`→
`caste_category` / `occupation`→`applicant_type` rename (same day) similarly
updated `verify_fields.py` (its `check_single`/`check_array` calls read the
record's own field names directly) and `validate_anthropic_schemes.py`'s
`SCALAR_FIELDS`/`ARRAY_FIELDS` coverage lists (each used to count the same
alias pair as two separate fields).

## Updating this file

Any change to how the scraper is invoked — command, flags, required env vars,
dependencies, output filenames, the output schema, or the order of steps —
must update this README in the same change, not as a follow-up.
