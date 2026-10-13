"""FREE field-level verification — zero Groq calls. For every record in an
existing pipeline output, checks whether each POPULATED value actually has
textual support in that scheme's own raw cached source (keyword/regex
matching only), and separately flags nulls where the source looks like it
states something the record missed.

WHY THIS IS SEPARATE FROM verify_title_match.py
----------------------------------------------------
verify_title_match.py asks one coarse question per record ("does this
description/eligibility plausibly belong to a scheme with this name?") via
an LLM call. This script asks a much finer-grained question per FIELD
("does 'age_min: 18' actually appear, in some form, in the source text?")
via plain string matching — no model call, no quota spent, and no ambiguity
about grounding for the cases a keyword match CAN decide. Only genuinely
ambiguous fields (keyword check inconclusive) should ever need an LLM call,
which is what the paired verify_fields_llm.py trial spends its budget on.

WHAT COUNTS AS "SUPPORTED"
-------------------------------
Numeric fields (age_min, age_max, income_limit): the literal digit string
must appear in source, OR — for income_limit only — some lakh/crore/plain-
rupee expression in the source must convert (via the same Indian-numbering
lakh/crore logic used throughout this codebase) to the exact stored value.
These are reported as two DIFFERENT categories (literal vs. transformed),
per the request that invented-looking numbers be told apart from
legitimately-converted ones.

Categorical fields (gender, applicant_type, caste_category, education,
district, ration_card_type, special_conditions, minority_community_required,
disability_required): a keyword/regex pattern for that specific value must
match somewhere in the source. The pattern sets below mirror the same
keyword logic already used elsewhere in this codebase (the deleted
ceg_scraper.py's extractors, Scheme_extractor_2.py's, and this file's own
vocabulary in config.py) — this is NOT a new invention of what "supporting
language" means, it's the same signal this project has used for extraction
itself, now run in the opposite direction as a check.

LIMITATIONS (why "unsupported" escalates to an LLM check rather than being
treated as a final verdict): keyword absence does not prove a value is
wrong — it could be a legitimate paraphrase the regex doesn't happen to
catch (this session already found real examples of exactly that during the
Madilu/source_mismatch investigation: "Krushy" vs. "Krushi", "Bhagyalaxmi"
vs. "Bhagya Lakshmi"). Keyword PRESENCE does not prove a value is right
either — it doesn't distinguish "the scheme requires this" from "the source
mentions this in a negated or unrelated context" (e.g. "government
employees are NOT eligible" would still match a naive "government" keyword
check). This script is a cheap triage pass, not a verdict.
"""

import argparse
import json
import re

import config

# --------------------------------------------------------------------------------------
# Categorical field -> {value: pattern} maps. Mirrors config.py's controlled
# vocabularies exactly (same values, same casing) and the keyword logic this
# codebase already used for extraction (ceg_scraper.py / Scheme_extractor_2.py).
# --------------------------------------------------------------------------------------

GENDER_PATTERNS = {
    "female": r"\b(women|woman|female|girl|mother|pregnant|lactating|widow)\b",
    "male": r"\b(men|man|male|boy|father|husband)\b",
}

OCCUPATION_PATTERNS = {
    # "weaver" was missing entirely until this pass caught it: Nekar Samman
    # Yojana and Kaimagga Vikasa Yojana are both restricted to handloom/
    # power-loom weavers, but no pattern here looked for that word at all —
    # this check silently found nothing to flag, which is why the gap went
    # unnoticed rather than showing up as a possibly_missed candidate.
    "unorganised": r"\bunorganised\b|unorganized\s+sector|\bweavers?\b|handloom|power[\s-]?loom",
    "farmer": r"\bfarmers?\b|\bfarming\b|agricultur",
    "labourer": r"\blabou?rers?\b|\bworkmen\b|construction\s+worker",
    "self-employed": r"self[\s-]?employed|entrepreneur|own\s+business",
    "student": r"\bstudents?\b",
    # Bare "\bemployed\b" was a real false-positive source (confirmed on 3
    # real records): a shared eligibility template across several Karnataka
    # artisan/craft schemes says "family members should NOT be employed in
    # government or semi-government organizations" — that's an exclusion
    # clause about the applicant's FAMILY, not a statement that the
    # applicant is salaried. Dropped; "salaried"/"salary" alone are specific
    # enough not to false-trigger on that boilerplate.
    "salaried": r"\bsalaried\b|\bsalary\b",
    "unemployed": r"\bunemployed\b",
    "homemaker": r"\bhomemaker|housewife\b",
    "retired": r"\bretired\b|\bpensioner\b",
}

CASTE_PATTERNS = {
    # "schedule castes" (missing the "d") is myscheme's own consistent spelling
    # in several records' source text, not a scraper artifact — confirmed by
    # checking 4+ records directly. "scheduled" alone still matches either form.
    #
    # The bare abbreviation is matched CASE-SENSITIVELY (?-i: overrides the
    # re.IGNORECASE all these patterns are run under) — confirmed real
    # collision: "B.Sc. in Horticulture" / "M.Sc in agriculture" (degree
    # names, lowercase "c") false-matched \bsc\b on Arivu Education Loan
    # Scheme, a Minority-only scholarship with no caste restriction at all.
    # Official scheme text writes the caste category in true uppercase
    # ("SC", never "Sc"), so requiring exact case cleanly separates the two.
    # "ST" gets the same treatment defensively against "St." (Saint) in
    # institution names (e.g. "St. Joseph's College") — no confirmed live
    # collision yet, but the risk is structurally identical and cheap to close.
    "SC": r"schedule[d]?\s+caste|(?-i:\bSC\b)",
    "ST": r"schedule[d]?\s+tribe|(?-i:\bST\b)",
    "OBC": r"\bobc\b",
    # Bare "\bgeneral\b" over-matches ordinary English ("general public", "in
    # general" — confirmed on 2 real records during this verification pass).
    # "General category"/"unreserved category" is how Indian government
    # scheme text actually phrases the reservation category.
    "General": r"general\s+categor|unreserved\s+categor",
    "Minority": r"\bminority\b|\bmuslim\b|\bchristian\b|\bsikh\b|\bjain\b|\bparsi\b|\bbuddhist\b",
}

RATION_CARD_PATTERNS = {
    "APL": r"\bapl\b",
    "BPL": r"\bbpl\b|below poverty line",
    "AAY": r"\baay\b|antyodaya",
}

EDUCATION_PATTERNS = {
    "PhD": r"\bphd\b|doctorate",
    "Master's Degree": r"post\s*graduate|postgraduate|master'?s|\bpg\b",
    "Diploma": r"diploma",
    "Bachelor's Degree": r"graduate|graduation|bachelor'?s|\bdegree\b",
    "12th Pass": r"12th|puc|class\s*12|higher secondary",
    "10th Pass": r"10th|class\s*10|sslc|matric",
}

SPECIAL_CONDITIONS_PATTERNS = {
    "Widow": r"\bwidow",
    "Disabled": r"\bdisab|physically\s+handicapped|differently[\s-]abled",
    "Pregnant": r"\bpregnant\b",
    "Lactating Mother": r"\blactating\b",
    "Senior Citizen": r"senior\s+citizen|\belderly\b",
    "Minority": r"\bminority\b|\bmuslim\b|\bchristian\b|\bsikh\b|\bjain\b|\bparsi\b|\bbuddhist\b",
    "BPL": r"\bbpl\b|below\s+poverty\s+line",
    "Orphan": r"\borphan",
}

MINORITY_BOOL_PATTERN = r"\bminority\b|\bmuslim\b|\bchristian\b|\bsikh\b|\bjain\b|\bparsi\b|\bbuddhist\b"
DISABILITY_BOOL_PATTERN = r"disabled|disability|physically handicapped|blind|deaf|orthopedic"


def _source_corpus(raw: dict) -> str:
    """Full corpus, all four sections — used for confirming a POPULATED
    value has support somewhere (any section legitimately counts, since
    extract.py's own prompt allows benefits_text as a secondary eligibility
    source)."""
    return " ".join(raw.get(f) or "" for f in
                     ("brief_description", "detailed_description", "eligibility_text", "benefits_text"))


def _eligibility_corpus(raw: dict) -> str:
    """Eligibility-relevant sections ONLY, excluding benefits_text — used
    for the INVERSE "did we miss a real criterion" check. benefits_text
    routinely states differential subsidy RATES by group ("75% for SC/ST,
    50% for General") which look identical to an eligibility keyword match
    but mean something different: the scheme is open to everyone and pays
    more to one group, not restricted to that group. Confirmed by hand on
    real records (the cardamom irrigation schemes) during this
    verification pass. A hit here is a much stronger "possibly missed"
    signal than a hit that only exists in benefits_text."""
    return " ".join(raw.get(f) or "" for f in
                     ("brief_description", "detailed_description", "eligibility_text"))


def _matches(pattern: str, text: str) -> bool:
    return bool(re.search(pattern, text, re.IGNORECASE))


_DEPT_NEARBY_RE = re.compile(r"department|ministry|\bboard\b|corporation|directorate", re.IGNORECASE)


def _gender_signal(text: str, pattern: str) -> bool:
    """True if `pattern` matches somewhere in `text` NOT immediately next to
    a department/agency-name word — confirmed false positive on a real
    record: "Women and Child Welfare Department" is the implementing
    agency's name, not an eligibility restriction on applicants."""
    for m in re.finditer(pattern, text, re.IGNORECASE):
        window = text[max(0, m.start() - 40):m.end() + 40]
        if not _DEPT_NEARBY_RE.search(window):
            return True
    return False


_DEPENDENT_NEARBY_RE = re.compile(r"\bchild(?:ren)?\b|\bbaby\b|\binfant\b", re.IGNORECASE)


def _age_match_is_dependents(text: str, match_start: int, match_end: int, window: int = 30) -> bool:
    """True if an age-boundary match is about a DEPENDENT's age, not the
    applicant's — confirmed false positive: Thayi Magu Sahaya Hastha (a
    maternity/childcare scheme) states "the child must be under 3 years of
    age," which is a benefit-duration condition on the child, not an
    age_max restriction on the applicant. Age phrases this close to
    "child"/"baby"/"infant" are excluded rather than counted as an
    applicant-age signal."""
    nearby = text[max(0, match_start - window):match_end + window]
    return bool(_DEPENDENT_NEARBY_RE.search(nearby))


# --------------------------------------------------------------------------------------
# Numeric amount extraction — same Indian-numbering (lakh/crore) conversion
# logic used throughout this codebase (ceg_scraper.py's parse_rupees_to_int,
# Scheme_extractor_2.py's, extract.py's prompt instructions), run here in
# reverse: find every amount-like expression in the source and see what it
# converts to, rather than converting a single matched expression forward.
# --------------------------------------------------------------------------------------

_AMOUNT_RE = re.compile(
    r"(?:rs\.?|₹)\s*([\d,]+(?:\.\d+)?)\s*(lakh|lac|crore|cr)?|"
    r"([\d,]+(?:\.\d+)?)\s*(lakh|lac|crore|cr)\b",
    re.IGNORECASE,
)


def _to_rupees(num_str: str, unit: str):
    """Returns None rather than raising on a degenerate match (e.g. a lone
    comma from messy scraped text like "Rs. ,000/-") — this is a best-effort
    scan over noisy real-world text, not a strict parser fed known-good
    input, so a malformed individual match should be skipped, not fatal."""
    cleaned = (num_str or "").replace(",", "").strip()
    if not cleaned:
        return None
    try:
        num = float(cleaned)
    except ValueError:
        return None
    unit = (unit or "").lower()
    if unit in ("lakh", "lac"):
        return int(num * 100000)
    if unit in ("crore", "cr"):
        return int(num * 10000000)
    return int(num)


def _all_amounts_in_source(text: str) -> set:
    amounts = set()
    for m in _AMOUNT_RE.finditer(text or ""):
        value = None
        if m.group(1):
            value = _to_rupees(m.group(1), m.group(2))
        elif m.group(3):
            value = _to_rupees(m.group(3), m.group(4))
        if value is not None:
            amounts.add(value)
    return amounts


def _literal_number_in_source(n: int, text: str) -> bool:
    # Word-boundary match on the bare digit string (18, 55, 150000, ...) and
    # on the Indian-comma-grouped form (1,50,000) if applicable.
    if re.search(rf"\b{n}\b", text or ""):
        return True
    grouped = f"{n:,}"  # Western grouping, e.g. 150,000 — check this form too
    if grouped != str(n) and grouped in (text or ""):
        return True
    return False


# --------------------------------------------------------------------------------------
# Per-record verification
# --------------------------------------------------------------------------------------

def verify_record(record: dict, raw: dict) -> dict:
    corpus = _source_corpus(raw)          # for confirming a POPULATED value has support anywhere
    elig_corpus = _eligibility_corpus(raw)  # for the INVERSE "did we miss a criterion" check
    findings = {
        "unsupported_populated": [],   # [(field, value, category)] category: "invented" | "no_keyword_match"
        "transformed_ok": [],          # [(field, value)] — legitimate unit conversion, confirmed supported
        "possibly_missed": [],         # [(field, evidence)] — likely-real miss (signal in eligibility-relevant text)
        "benefits_only_mentions": [],  # [(field, evidence)] — weak signal: only in benefits_text (often a
                                        # differential subsidy RATE for that group, not an eligibility gate —
                                        # see _eligibility_corpus's docstring). Reported, NOT auto-escalated.
    }

    # ---- numeric fields ----
    for field in ("age_min", "age_max"):
        val = record.get(field)
        if val is not None:
            if _literal_number_in_source(val, corpus):
                pass  # supported literally
            elif field == "age_max" and _literal_number_in_source(val + 1, corpus) and \
                    re.search(rf"\b(?:below|under|less than)\b[^.]{{0,20}}\b{val + 1}\b", corpus, re.IGNORECASE):
                # "below 60" -> age_max=59 is a defensible exclusive-boundary
                # reading, not a fabrication (confirmed by hand on a real
                # case: Continuation of Pension (K.B.O.C.W.W.B) says "below
                # 60 years of age"). Same spirit as income's lakh/crore
                # transformation — a legitimate reading of the literal text,
                # just not a verbatim digit match.
                findings["transformed_ok"].append((field, val))
            elif field == "age_min" and _literal_number_in_source(val - 1, corpus) and \
                    re.search(rf"\b(?:above|over|more than)\b[^.]{{0,20}}\b{val - 1}\b", corpus, re.IGNORECASE):
                findings["transformed_ok"].append((field, val))
            else:
                findings["unsupported_populated"].append((field, val, "invented"))
        else:
            # inverse check: does ELIGIBILITY-relevant text state THIS
            # boundary specifically? A shared min/max pattern was a real bug
            # here — confirmed on Accident Assistance (K.B.O.C.W.W.B): its
            # only age phrase is "minimum of 18 years" (already captured as
            # age_min=18), but a combined pattern flagged age_max too, since
            # "minimum" was in the same alternation as "maximum"/"below"/
            # "up to". A range phrase ("18 to 55 years") legitimately
            # implies BOTH boundaries; a single-sided phrase should only
            # flag the boundary it actually states.
            range_pattern = r"\b(\d{1,3})\s*(?:years?|yrs?)\s*(?:to|and|-)\s*(\d{1,3})\s*(?:years?|yrs?)"
            if field == "age_min":
                single_pattern = r"(?:minimum|at\s+least|above|over|more\s+than)\s*(?:age\s*)?(?:of\s*)?\d{1,3}\s*years"
            else:
                single_pattern = r"(?:maximum|below|under|up\s+to|not\s+more\s+than|less\s+than)\s*(?:age\s*)?(?:of\s*)?\d{1,3}\s*years"
            # Excludes matches about a DEPENDENT's age, not the applicant's —
            # confirmed false positive: Thayi Magu Sahaya Hastha (maternity/
            # childcare scheme) states "the child must be under 3 years of
            # age," a benefit-duration condition on the child, not an
            # age_max restriction on the applicant. See
            # _age_match_is_dependents's docstring.
            has_real_signal = any(
                not _age_match_is_dependents(elig_corpus, m.start(), m.end())
                for pattern in (range_pattern, single_pattern)
                for m in re.finditer(pattern, elig_corpus, re.IGNORECASE)
            )
            if has_real_signal:
                findings["possibly_missed"].append((field, "eligibility-relevant text contains a phrase stating this specific age boundary"))

    income_val = record.get("income_limit")
    income_phrase = r"income.{0,40}(?:less than|below|not exceed|upto|up to|not more than)"
    if income_val is not None:
        if _literal_number_in_source(income_val, corpus):
            pass  # literal
        elif income_val in _all_amounts_in_source(corpus):
            findings["transformed_ok"].append(("income_limit", income_val))
        else:
            findings["unsupported_populated"].append(("income_limit", income_val, "invented"))
    elif record.get("income_limit_rural") is not None or record.get("income_limit_urban") is not None:
        # Correctly represented via the rural/urban split fields instead —
        # income_limit=null here is the RIGHT answer, not a miss. See
        # extract.py's PROMPT_TEMPLATE and normalizer.py.
        pass
    else:
        # only flag on an income-restriction PHRASE, not just any rupee figure
        # (benefit amounts are rupee figures too and are not eligibility criteria)
        if re.search(income_phrase, elig_corpus, re.IGNORECASE):
            findings["possibly_missed"].append(("income_limit", "eligibility-relevant text contains an income-ceiling phrase"))

    # ---- gender: needs two exclusions bare keyword matching can't express ----
    def check_gender():
        """Two confirmed false-positive sources for the null-case (inverse)
        check, both found on real records:
        1. PAIRED mentions ("men and women", "male & female", "Rs.X for men,
           Rs.Y for women") mean the scheme is open to both — gender=null is
           CORRECT there, not a miss. Only flag when just one gender's
           pattern matches and the other doesn't.
        2. DEPARTMENT/AGENCY NAMES ("Women and Child Welfare Department" as
           the implementing agency) aren't eligibility text at all. A gender
           keyword match within ~40 chars of "department"/"ministry"/
           "board"/"corporation"/"directorate" is treated as a name
           reference, not a signal.
        The forward check (a POPULATED gender value needs support somewhere)
        doesn't have either problem and stays a plain keyword check."""
        val = record.get("gender")
        if val:
            pattern = GENDER_PATTERNS.get(val)
            if pattern and _matches(pattern, corpus):
                pass
            else:
                findings["unsupported_populated"].append(("gender", val, "no_keyword_match"))
            return

        female_hit = _gender_signal(elig_corpus, GENDER_PATTERNS["female"])
        male_hit = _gender_signal(elig_corpus, GENDER_PATTERNS["male"])
        if female_hit and male_hit:
            pass  # both genders mentioned -> open to both, correctly null
        elif female_hit or male_hit:
            which = "female" if female_hit else "male"
            findings["possibly_missed"].append(("gender", f"eligibility-relevant text matches gender={which!r} pattern (not paired with the other gender)"))
        elif _matches(GENDER_PATTERNS["female"], corpus) or _matches(GENDER_PATTERNS["male"], corpus):
            findings["benefits_only_mentions"].append(("gender", "only benefits_text matches a gender pattern"))

    # ---- categorical single-value fields ----
    def check_single(field, patterns):
        val = record.get(field)
        if val:
            pattern = patterns.get(val)
            if pattern and _matches(pattern, corpus):
                pass
            else:
                findings["unsupported_populated"].append((field, val, "no_keyword_match"))
        else:
            for candidate, pattern in patterns.items():
                if _matches(pattern, elig_corpus):
                    findings["possibly_missed"].append((field, f"eligibility-relevant text matches {field}={candidate!r} pattern"))
                    break
                if _matches(pattern, corpus):
                    findings["benefits_only_mentions"].append((field, f"only benefits_text matches {field}={candidate!r} pattern (likely a differential rate, not a restriction)"))
                    break

    check_gender()
    check_single("applicant_type", OCCUPATION_PATTERNS)
    check_single("education", EDUCATION_PATTERNS)

    # ---- categorical array fields ----
    def check_array(field, patterns, skip_candidates=()):
        """skip_candidates: vocabulary values not to flag as possibly_missed
        even on a pattern match, because the same underlying fact is already
        captured elsewhere in the record via a dedicated field — e.g.
        caste_category=['Minority'] would be redundant with
        minority_community_required=True, which several records already set.
        Confirmed by cross-checking: 11 of 13 caste_category 'Minority'
        matches were on records that already had minority_community_required
        True — not missed data, just not duplicated into a second field."""
        vals = record.get(field) or []
        for val in vals:
            pattern = patterns.get(val)
            if pattern and _matches(pattern, corpus):
                pass
            else:
                findings["unsupported_populated"].append((field, val, "no_keyword_match"))
        if not vals:
            for candidate, pattern in patterns.items():
                if candidate in skip_candidates:
                    continue
                if _matches(pattern, elig_corpus):
                    findings["possibly_missed"].append((field, f"eligibility-relevant text matches {field}={candidate!r} pattern"))
                    break
                if _matches(pattern, corpus):
                    findings["benefits_only_mentions"].append((field, f"only benefits_text matches {field}={candidate!r} pattern (likely a differential rate, not a restriction)"))
                    break

    # Cross-field redundancy: several vocabulary values legitimately live in
    # more than one field (config.py's CASTE_VOCABULARY, SPECIAL_CONDITIONS_
    # VOCABULARY, and RATION_CARD_VOCABULARY all include overlapping values,
    # and minority_community_required is a dedicated bool for the same fact
    # caste_category/special_conditions's "Minority" also covers). The
    # model consistently picks ONE home for a fact, not all of them — flagging
    # every OTHER field as "possibly missed" the same fact is not a real gap.
    # Confirmed on real records: minority_community_required=True on all 5
    # records flagged for missing special_conditions=['Minority']; Griha
    # Lakshmi has BPL in ration_card_type (flagged missing it in
    # special_conditions) while Bhagyalaxmi has it in special_conditions
    # (flagged missing it in ration_card_type) — same fact, different valid
    # field, both directions.
    minority_already_captured = ("Minority",) if record.get("minority_community_required") is True else ()
    bpl_in_ration_card = "BPL" in (record.get("ration_card_type") or [])
    bpl_in_special_conditions = "BPL" in (record.get("special_conditions") or [])

    check_array("caste_category", CASTE_PATTERNS, skip_candidates=minority_already_captured)
    check_array("ration_card_type", RATION_CARD_PATTERNS,
                skip_candidates=("BPL",) if bpl_in_special_conditions else ())
    check_array("special_conditions", SPECIAL_CONDITIONS_PATTERNS,
                skip_candidates=minority_already_captured + (("BPL",) if bpl_in_ration_card else ()))

    # ---- district (31-value canonical list; no pattern dict needed) ----
    district = record.get("district")
    if district:
        if not re.search(re.escape(district), corpus, re.IGNORECASE):
            findings["unsupported_populated"].append(("district", district, "no_keyword_match"))
    else:
        for d in config.CANONICAL_DISTRICTS:
            if re.search(rf"\b{re.escape(d)}\b", elig_corpus, re.IGNORECASE):
                findings["possibly_missed"].append(("district", f"eligibility-relevant text mentions district name {d!r} (may still be incidental, e.g. an implementing office's location, not a residency restriction)"))
                break

    # ---- booleans ----
    if record.get("minority_community_required") is True:
        if not _matches(MINORITY_BOOL_PATTERN, corpus):
            findings["unsupported_populated"].append(("minority_community_required", True, "no_keyword_match"))
    elif _matches(MINORITY_BOOL_PATTERN, elig_corpus):
        findings["possibly_missed"].append(("minority_community_required", "eligibility-relevant text matches minority-community pattern"))
    elif _matches(MINORITY_BOOL_PATTERN, corpus):
        findings["benefits_only_mentions"].append(("minority_community_required", "only benefits_text matches minority-community pattern"))

    if record.get("disability_required") is True:
        if not _matches(DISABILITY_BOOL_PATTERN, corpus):
            findings["unsupported_populated"].append(("disability_required", True, "no_keyword_match"))
    elif _matches(DISABILITY_BOOL_PATTERN, elig_corpus):
        findings["possibly_missed"].append(("disability_required", "eligibility-relevant text matches disability pattern"))
    elif _matches(DISABILITY_BOOL_PATTERN, corpus):
        findings["benefits_only_mentions"].append(("disability_required", "only benefits_text matches disability pattern"))

    return findings


def run(in_path: str, out_path: str):
    with open(in_path, encoding="utf-8") as f:
        records = json.load(f)

    # NOTE (2026-09-09): this used to skip source_mismatch:true records here
    # (e.g. Madilu Kit) — that field was removed from karnataka_schemes.json
    # (Backend never read it), so r.get("source_mismatch") is now always
    # None and this check can no longer fire. A record that was previously
    # excluded as "known bad, don't bother verifying" is now run through the
    # same keyword checks as every other record — since its fields are all
    # null, it will typically just come back with a handful of
    # possibly_missed candidates like any other sparse record, with no
    # signal left anywhere that it was actually a confirmed source mismatch.
    # That distinction still exists in karnataka_schemes_full.json only.
    report = []
    for r in records:
        slug = r["source_url"].rstrip("/").rsplit("/", 1)[-1]
        try:
            with open(f"cache/myscheme/raw/{slug}.json", encoding="utf-8") as f:
                raw = json.load(f)
        except FileNotFoundError:
            report.append({"scheme_name": r["scheme_name"], "slug": slug, "error": "no raw cache found"})
            continue

        findings = verify_record(r, raw)
        total_flags = len(findings["unsupported_populated"]) + len(findings["possibly_missed"])
        report.append({
            "scheme_name": r["scheme_name"],
            "slug": slug,
            "source_url": r["source_url"],
            "total_flags": total_flags,
            **findings,
        })

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)

    print(f"Verified {len(report)} records. Report written to {out_path}.")
    ambiguous = [r for r in report if r.get("total_flags", 0) > 0]
    print(f"{len(ambiguous)} record(s) have at least one flag.")


def main():
    parser = argparse.ArgumentParser(description="Free (no-Groq) field-level verification against raw cached source.")
    parser.add_argument("--in", dest="in_path", default=config.DEFAULT_OUTPUT_PATH)
    parser.add_argument("--out", dest="out_path", default="_field_verification.json")
    args = parser.parse_args()
    run(args.in_path, args.out_path)


if __name__ == "__main__":
    main()
