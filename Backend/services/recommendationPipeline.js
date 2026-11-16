import { getTfIdfRecommendations } from '../TF_IDF/tfidfRecommendation.js';
import { evaluateSchemeEligibility } from './ruleEngine.js';
import { rankEligibleScheme } from './recommendationRanking.js';
import { scoreRecommendationCandidates } from './decisionTreeService.js';
import { getSemanticSimilarity } from './semanticSimilarity.js';

export async function rankRecommendationCandidates(user, schemes) {
  const evaluations = schemes.map((scheme) => ({
    scheme,
    ruleEvaluation: evaluateSchemeEligibility(user, scheme),
  }));
  const candidates = evaluations.filter(({ ruleEvaluation }) => ruleEvaluation.status !== 'ineligible');
  if (!candidates.length) return [];

  const tfidf = getTfIdfRecommendations(user, schemes, schemes.length).recommendations;
  const tfidfById = new Map(tfidf.map((result) => [result.schemeId, result.similarityScore]));
  const treeScores = await scoreRecommendationCandidates({
    user,
    schemes: candidates.map(({ scheme }) => scheme),
  });
  const treeById = new Map(treeScores.map((result) => [result.schemeId, result.decisionTreeScore]));

  return candidates.map(({ scheme, ruleEvaluation }) => {
    const schemeId = String(scheme._id);
    const decisionTreeScore = treeById.get(schemeId);
    if (!Number.isFinite(decisionTreeScore)) {
      throw new Error(`Decision-tree score is missing for scheme ${schemeId}`);
    }

    const semanticTextSimilarity = getSemanticSimilarity(user, scheme);
    // Keep the legacy decision-tree signal inside the configured semantic-ranking component, not the eligibility gate.
    const semanticSimilarity = Number(((semanticTextSimilarity + decisionTreeScore) / 2).toFixed(6));
    const ranking = rankEligibleScheme(user, scheme, ruleEvaluation, {
      semanticSimilarity,
      tfidfSimilarity: tfidfById.get(schemeId) ?? 0,
    });

    return { scheme, ruleEvaluation, ranking, decisionTreeScore, semanticTextSimilarity };
  });
}
