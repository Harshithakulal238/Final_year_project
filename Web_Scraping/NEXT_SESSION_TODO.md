# Queued fixes — written down, not executed (2026-08-24)

Three items found during today's diagnosis session. None of these have been
applied to code or data. Each says whether it needs a Groq call.

---

## READY TO RUN (2026-09-10): full 60-scheme re-extraction — supersedes #2 and #6 below

Confirmed the root cause behind #2 and #6 both stalling: `cache.py` only
invalidated a cached extraction when the four raw SOURCE TEXT sections
changed — it had no idea `extract.py`'s `PROMPT_TEMPLATE` itself had changed
across three revisions since 2026-08-24 (the income-split fix, the
source_mismatch "STEP ZERO" check, the weaver/construction-worker occupation
mapping). Result: 45 of the current 60 records were still serving their
original 2026-08-24 extraction, never re-validated against any of those
fixes — not just the 4 records #2 and #6 already named.

**Fixed 2026-09-10**: `cache.py`'s `load_extracted()`/`save_extracted()`/
`needs_extraction()` now also track `extract.PROMPT_VERSION` (a hash of
`PROMPT_TEMPLATE`, recomputed automatically on any edit to it) as its own
field, separate from the source-text hash. Verified locally (no Groq calls):
all 60 cached extractions are now correctly seen as stale under the new
prompt version — 59 via the new prompt-version check, 1 (`iicmscc`) via its
pre-existing cached extraction_error. No cache files were deleted; the
version mismatch alone causes automatic re-extraction on the next run — this
supersedes the manual `rm cache/myscheme/extracted/...` step #6 used to call
for.

`karnataka_schemes.json` was backed up before this to
`karnataka_schemes.json.pre_reextraction_2026-09-10.bak` (60/60 records,
verified byte-identical) — this is now the "last file before the full
re-extraction" reference point, separate from `karnataka_schemes_full.json`
(the pre-field-trim backup) and `karnataka_schemes.json.prealias.bak` (the
pre-alias-removal backup).

**Blocked on**: Groq's persistent 403 ("Access denied. Please check your
network settings.") — still active as of 2026-09-10, unrelated to this fix.

**Run the moment connectivity returns** (raw fetch cache is kept — no
re-fetch from myscheme needed; every extraction re-runs under the current
prompt because of the fix above):
```bash
python pipeline.py --queries state_karnataka,central_karnataka
python verify_fields.py --in karnataka_schemes.json --out _field_verification.json
```
No `--merge` needed — this run covers the same 60 source URLs already in the
file, so a full overwrite and a merge produce the identical result; overwrite
is simpler.

**Pre-flight estimate, computed locally from the real usage log** (not the
static per-call default): `quota.estimated_tokens_per_call()` currently
returns **~3,221 tokens/call** (the actual observed average from real past
extractions), which × 60 = **~193,000 tokens** — about 97% of the 200,000/day
cap. This will very likely fit in one day but has little headroom; if actual
usage runs even slightly above the historical average, `DailyQuotaExhausted
Error` will stop the run cleanly partway through (existing behavior — nothing
lost, records already done are written, safe to resume the next day with the
same command, since the newly-fixed cache correctly recognizes what's already
been redone under the current prompt version).

**Items #2 and #6 below are superseded by this** — both are subsumed by the
full 60-record re-extraction and don't need separate handling once it runs.

---

## 1. Backfill `ifticmcst`'s `documents_required` — no Groq needed

**Scheme**: "Incentive For The Inter Caste Marriage Couple (Scheduled Tribe)"
**slug**: `ifticmcst`
**scheme_id**: `673393d2a3309f621559f094`

`documents_required` is currently `null` in `karnataka_schemes.json`, but this
is not a genuine "not stated in source" null — it's a silently-absorbed
fetch failure. During the network-flaky window on 2026-08-24, the *documents*
sub-endpoint call inside `sources.py`'s `fetch_myscheme_detail()` failed
after 3 retries and gave up, while the *main* detail call for the same scheme
succeeded — so the record wasn't skipped (which would have been visible), it
was written with `documents_text = ""` indistinguishable from a real empty
result. Confirmed live: a fresh call to
`https://api.myscheme.gov.in/schemes/v6/public/schemes/673393d2a3309f621559f094/documents`
on 2026-08-24 returned real content (Aadhaar Card, Bank Account Details,
Marriage Proof, Marriage Photo, Income Certificate, Caste Certificate,
Resident Proof).

**Fix**: re-fetch just that documents sub-endpoint for this one slug, patch
`cache/myscheme/raw/ifticmcst.json`'s `documents_text` field, then re-run
`normalizer.build_record()` for this one record (no LLM call needed —
`documents_required` is a direct API passthrough, never LLM-derived) and
update its entry in `karnataka_schemes.json`.

**Groq cost**: zero. This could technically run any time, including with
today's exhausted quota — deliberately not run today per "queue, don't
execute."

## 2. Re-extract "Incentive for the Intra Caste Marriage within Scheduled Caste Community" — needs 1 Groq call

**slug**: `iicmscc`

Currently `source_mismatch: true`, confirmed a false positive by manually
reading the full raw source (`cache/myscheme/raw/iicmscc.json`) — the actual
content (brief/detailed description, eligibility, benefits) is unambiguous
and correctly describes intra-caste marriage incentives across SC/ST
sub-castes, matching the title exactly. myscheme's own `tags` field
separately says `"Inter-Caste"` (the opposite concept) even though tags
aren't in the LLM's prompt at all — best guess is the model made the same
intra/inter-caste terminology slip myscheme's own tagger made, independently.

**Fix**: delete `cache/myscheme/extracted/iicmscc.json` (invalidates only
this one record's cached extraction — the raw fetch cache stays, no
re-fetch needed) and re-run the pipeline for just this scheme. The
title-aware prompt should be re-tried; if it flags source_mismatch again,
that's a second data point on the false-positive rate worth noting, not
assumed to resolve itself.

**Groq cost**: 1 extraction call (~1,500-3,000 tokens).

## 3. Underlying gap: sub-endpoint fetch failure vs. genuinely-absent data

Right now `sources.py`'s `fetch_myscheme_detail()` has no way to distinguish
"the documents/benefits/etc. sub-fetch failed after retries" from "myscheme
genuinely has nothing there" — both collapse to `""`, which
`normalizer.build_record()` then turns into `null` identically. Item 1 above
is a confirmed instance of this; there could be others silently sitting in
the current 60 records that just haven't been individually traced yet.

**Fix approach** (not implemented): have `fetch_myscheme_detail()` return a
`_fetch_warnings` list (or similar) alongside the detail dict, populated
whenever a sub-endpoint's `get_json()` call gives up after retries — e.g.
`["documents endpoint failed after 3 retries"]`. `normalizer.build_record()`
would carry this into the record (e.g. a `fetch_warnings` field, empty list
when clean) so `null` from a real absence and `null` from a failed fetch are
visibly different in the output and in `validate_anthropic_schemes.py`'s
coverage report, instead of only discoverable by manually cross-referencing
run logs the way item 1 was found today.

**Groq cost**: zero — this is a `sources.py`/`normalizer.py` code change
only, no LLM involved. Queued alongside items 1-2 per your instruction to
write all three down together rather than treat this one as separately
actionable just because it happens to be free.

## 4. KNOWN LIMITATION (not a bug, documented, not queued for a code fix): Backend can't read `income_limit_rural` / `income_limit_urban`

Added 2026-09-04 alongside `income_limit_rural`/`income_limit_urban` (see
`extract.py`'s `PROMPT_TEMPLATE` and `normalizer.py`) — populated instead of
`income_limit` when the source states a different ceiling for rural vs.
urban applicants, so the distinction isn't lost by collapsing two numbers
into one field.

`Backend/services/ruleEngine.js` only reads `income_limit`. It does not know
these two fields exist. **9 schemes currently have a real, correctly
extracted income ceiling that the rule engine cannot see** — it reads
`income_limit: null` and treats them as income-unrestricted:

Charmashilpa Scheme, Skill Development Training Karnataka, Swavalambi/Sanchari
Marata Malige, Skill Upgradation Program Karnataka, Marketing Assistance
Scheme, Padhuke Kuteera Scheme Karnataka, Direct Loan Scheme Karnataka, Dr.
Babu Jagjivan Ram Living cum work shed Construction Scheme, Kayaka Spoorthi
Scheme Karnataka (₹30,000 rural / ₹25,000 urban in 8 of these; ₹32,000 /
₹87,600 in Dr. Babu Jagjivan Ram).

**One more, narrower case, not covered by these two fields at all**: Udyogini
Scheme states *"less than ₹1,50,000 for general and special categories — no
limit for widowed or disabled women"* — a category-based exemption, not
rural/urban. The income-fix prompt instruction correctly generalized to
suppress a flat number here too (₹150,000 would be wrong for a widowed/
disabled applicant), but there's no field for a category-conditional income
limit, so this fact is currently unrepresented anywhere in the schema, not
just unread by Backend.

**Not fixing either of these now** — this is a Backend-side consumption gap
(`ruleEngine.js` would need to read the two new fields and know the
applicant's rural/urban status) and a schema gap (no field for
category-conditional limits) respectively. Both require a decision outside
`Web_Scraping/`'s scope; documenting for whoever picks up the Backend side.

## 5. ARCHITECTURE MISMATCH (not a data problem — documented, needs a Backend/product decision): entity-eligibility schemes in a citizen-eligibility engine

Found 2026-09-07 while investigating why 10 of 60 schemes have zero
`ruleEngine.js`-applicable fields (and are therefore invisible to
`/api/recommend/:userId` — `finalScore = 0` gets filtered out entirely, see
`recommendationRanking.js`; NOT "matches everyone," the opposite). 3 of the
10 turned out to be genuine occupation-mapping gaps and were fixed (see #6
below). The other 5 are structurally different:

- **Interest Subvention Scheme** — read its source directly: *"Enterprises
  promoted by all categories of borrowers, proprietary concerns, partnership
  firms, companies & other legal entities"*. Restricted by **business
  entity type**, not individual citizen demographics.
- **3 cardamom irrigation/curing schemes** + **National Mission on Edible
  Oils–Oil Palm** — restricted to state agriculture/horticulture
  departments, processors, cooperatives, NGOs. Restricted by
  **institutional entity type**.

`ruleEngine.js`'s 10 rules (age, gender, income, caste, minority, ration
card, occupation, education, disability, district) all model **individual
citizen** attributes. None of these 5 schemes have eligibility criteria of
that kind stated anywhere in their source — not because extraction missed
something, but because the schemes target entities, not individuals.
Verified by reading the actual source text for all 5, not inferred from the
pattern.

**Why this isn't fixable from `Web_Scraping/`**: there is nothing truthful
to put in `gender`/`caste_restriction`/`income_limit`/etc. for a scheme
whose applicant is a company or a government department. Inventing a value
would violate the null-over-guess rule this whole pipeline is built on. A
real fix needs either a new rule engine dimension (entity type) or a product
decision to exclude B2G/B2B schemes from a citizen-facing recommender —
both Backend/product decisions, not something to route around with data.

**Not fixing this from here.** Documenting for whoever picks up the Backend
side.

## 6. Occupation mapping gaps — FIXED 2026-09-07 (prompt + checker), pending re-extraction

Found while investigating the same 10 invisible schemes: 3 had a genuine,
source-grounded occupation restriction that neither extraction nor
`verify_fields.py`'s own patterns caught — "weaver" wasn't a recognized
keyword anywhere, so the gap silently produced no flag at all rather than a
`possibly_missed` candidate.

- Nekar Samman Yojana, Kaimagga Vikasa Yojana — *"registered ... weaver"* /
  *"traditional weaving profession"* — maps to `occupation: "unorganised"`
  (handloom weaving is a standard unorganised-sector occupation in Indian
  labor classification; no new vocabulary value needed).
- Supply of Tool Kits to their Trained Workers — *"registered construction
  worker"* — maps to `occupation: "labourer"` (already matched by
  `verify_fields.py`'s existing pattern; this one was a prompt gap only).

`extract.py`'s `PROMPT_TEMPLATE` and `verify_fields.py`'s `OCCUPATION_PATTERNS`
(the `"unorganised"` entry) both updated. **Not yet re-extracted** — Groq
was returning a persistent non-standard 403 both times this was attempted
(2026-09-07). Re-run for these 3 slugs once Groq is reachable:
```bash
rm cache/myscheme/extracted/nsy.json cache/myscheme/extracted/kvy-k.json cache/myscheme/extracted/stkk.json
python pipeline.py --queries state_karnataka,central_karnataka --merge
python verify_fields.py --in karnataka_schemes.json --out _field_verification.json
python backfill_uncertain_fields.py
```
Pre-flight estimate at the time this was queued: ~3 calls, ~9,700 tokens.

**Also found during the same scan, not acted on (not part of the 3
authorized)**: "artisan"/"leather" appear in 9-10 records already correctly
extracted as `self-employed` via the earlier prompt fix, but
`verify_fields.py`'s own patterns still don't recognize those words — the
checker would not catch it if one of these regressed to null later. Also:
"blacksmith" (Financial Assistance to Traditional Artisans/Panchavrutthi
Scheme) and "sericulture reeler" (Incentive Scheme for Sericulture Reelers)
are both currently `occupation: null` with no scan-covered keyword pointing
at them either — but neither is one of the 10 invisible schemes (both have
at least one other applicable field already), so lower urgency. Flagging,
not fixing.

---

**Recommended order once Groq quota is available**: fix #1 first (free,
zero risk), then #3 (free, prevents recurrence, should land before more of
batch 2 runs and creates more silent gaps of the same shape), then #2 (costs
one call, best done after #3 in case that change affects how the retry is
observed/logged), then #6's 3-record re-extraction (also small — ~3 calls).
#4 and #5 both need a Backend-side decision, not more Web_Scraping work.
