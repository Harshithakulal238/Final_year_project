const DEFAULT_WEIGHTS = { structured: 0.60, semantic: 0.25, tfidf: 0.15 };
const FIELD_WEIGHTS = { Income: 0.18, Age: 0.15, Occupation: 0.13, Caste: 0.12, Gender: 0.10, Education: 0.10, 'Ration Card': 0.08, Disability: 0.06, 'Minority Community': 0.04, District: 0.04 };

function config(name, fallback) { const value = Number(process.env[`RECOMMENDATION_${name.toUpperCase()}_WEIGHT`]); return Number.isFinite(value) && value >= 0 ? value : fallback; }
export function getHybridWeights() { return { structured: config('structured', DEFAULT_WEIGHTS.structured), semantic: config('semantic', DEFAULT_WEIGHTS.semantic), tfidf: config('tfidf', DEFAULT_WEIGHTS.tfidf) }; }

function structuredMatch(ruleEvaluation) {
  const total = Object.values(FIELD_WEIGHTS).reduce((sum, value) => sum + value, 0);
  const matched = ruleEvaluation.ruleDetails.filter(rule => rule.applicable && rule.eligible).reduce((sum, rule) => sum + (FIELD_WEIGHTS[rule.name] || 0), 0);
  // Unspecified scheme criteria are absent from the numerator: they are not matches.
  return Number((matched / total).toFixed(6));
}

export function rankEligibleScheme(_user, _scheme, ruleEvaluation, scores = {}) {
  const weights = getHybridWeights();
  const structured = structuredMatch(ruleEvaluation);
  const semantic = Number(scores.semanticSimilarity) || 0;
  const tfidf = Number(scores.tfidfSimilarity) || 0;
  const finalScore = weights.structured * structured + weights.semantic * semantic + weights.tfidf * tfidf;
  return { structuredMatch: Number((structured * 100).toFixed(2)), semanticSimilarity: Number((semantic * 100).toFixed(2)), tfidfSimilarity: Number((tfidf * 100).toFixed(2)), weights, finalPercent: Number((finalScore * 100).toFixed(2)), finalScore: Number(finalScore.toFixed(6)) };
}
