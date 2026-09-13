function fieldMatchScore(ruleEvaluation) {
  // Eligibility remains the gate. Ranking then counts only real, applicable
  // structured user-to-scheme matches; unspecified fields contribute nothing.
  const matchedFields = ruleEvaluation.ruleDetails.filter((rule) => rule.applicable && rule.eligible).length;
  return Number((100 * matchedFields / ruleEvaluation.ruleDetails.length).toFixed(2));
}

export function rankEligibleScheme(_user, _scheme, ruleEvaluation) {
  const fieldMatch = fieldMatchScore(ruleEvaluation);

  return {
    eligibility: Number(ruleEvaluation.ruleScore || 0),
    priority: 0,
    fieldMatch,
    recency: 0,
    finalPercent: fieldMatch,
    finalScore: Number((fieldMatch / 100).toFixed(4)),
  };
}