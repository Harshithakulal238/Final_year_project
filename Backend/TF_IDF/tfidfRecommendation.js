const normalize = (value) => String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const array = (value) => (Array.isArray(value) ? value : value == null || value === '' ? [] : [value]);

function ageFromDob(dob) {
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - date.getFullYear();
  if (now.getMonth() < date.getMonth() || (now.getMonth() === date.getMonth() && now.getDate() < date.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function add(tokens, key, value) {
  for (const item of array(value)) {
    const token = normalize(item);
    if (token) tokens.push(`${key}_${token}`);
  }
}

function userTokens(user) {
  const tokens = [];
  add(tokens, 'gender', user.gender);
  add(tokens, 'caste', user.caste || user.casteCategory);
  add(tokens, 'occupation', user.occupation || user.employmentType);
  add(tokens, 'education', user.education || user.qualification);
  add(tokens, 'ration', user.rationCard);
  add(tokens, 'condition', user.conditions || user.specialConditions);
  add(tokens, 'district', user.location?.district || user.district);
  const age = Number.isFinite(Number(user.age)) ? Number(user.age) : ageFromDob(user.dob);
  if (age !== null && age !== undefined) tokens.push(`age_${age}`);
  return tokens;
}

function schemeTokens(scheme) {
  const tokens = [];
  add(tokens, 'gender', scheme.gender);
  add(tokens, 'caste', scheme.caste_category);
  add(tokens, 'occupation', scheme.applicant_type);
  add(tokens, 'education', scheme.education);
  add(tokens, 'ration', scheme.ration_card_type);
  add(tokens, 'district', scheme.district);
  if (scheme.disability_required === true) tokens.push('condition_disabled');
  if (scheme.minority_community_required === true) tokens.push('caste_minority');
  const min = Number(scheme.age_min);
  const max = Number(scheme.age_max);
  if (Number.isFinite(min) || Number.isFinite(max)) {
    for (let age = Math.max(0, Number.isFinite(min) ? min : 0); age <= Math.min(120, Number.isFinite(max) ? max : 120); age += 1) tokens.push(`age_${age}`);
  }
  return tokens;
}

function frequency(tokens) {
  const counts = new Map();
  for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1);
  return counts;
}

function cosine(left, right) {
  let dot = 0, leftMagnitude = 0, rightMagnitude = 0;
  for (const value of left.values()) leftMagnitude += value * value;
  for (const value of right.values()) rightMagnitude += value * value;
  for (const [term, value] of left) dot += value * (right.get(term) || 0);
  return leftMagnitude && rightMagnitude ? dot / Math.sqrt(leftMagnitude * rightMagnitude) : 0;
}

export function getTfIdfRecommendations(user, schemes, topK = 10) {
  const startedAt = performance.now();
  const schemeDocuments = schemes.map(schemeTokens);
  const userDocument = userTokens(user);
  const documents = [...schemeDocuments, userDocument];
  const documentFrequency = new Map();
  for (const document of documents) for (const term of new Set(document)) documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
  const totalDocuments = documents.length;
  const vector = (tokens) => {
    const counts = frequency(tokens);
    const values = new Map();
    for (const [term, count] of counts) {
      const tf = count / tokens.length;
      const idf = Math.log((totalDocuments + 1) / ((documentFrequency.get(term) || 0) + 1)) + 1;
      values.set(term, Number((tf * idf).toFixed(8)));
    }
    return values;
  };
  const userVector = vector(userDocument);
  const results = schemes.map((scheme, index) => {
    const similarityScore = Number(cosine(userVector, vector(schemeDocuments[index])).toFixed(6));
    return { schemeId: String(scheme._id), schemeName: scheme.scheme_name || scheme.schemeName || scheme.name || 'Unknown Scheme', sourceUrl: scheme.source_url || scheme.url || '', similarityScore, similarityPercent: Number((similarityScore * 100).toFixed(2)) };
  }).sort((a, b) => b.similarityScore - a.similarityScore).slice(0, topK).map((item, index) => ({ ...item, rank: index + 1 }));
  const allScores = results.map((item) => item.similarityScore);
  return {
    recommendations: results,
    statistics: {
      vocabularySize: documentFrequency.size,
      vectorDimensions: documentFrequency.size,
      topK: results.length,
      similarityRange: allScores.length ? { min: Math.min(...allScores), max: Math.max(...allScores) } : null,
      averageSimilarity: allScores.length ? Number((allScores.reduce((sum, score) => sum + score, 0) / allScores.length).toFixed(6)) : null,
      processingTimeMs: Number((performance.now() - startedAt).toFixed(2)),
      precisionAtK: null,
      recallAtK: null,
      f1AtK: null,
      labelledDataAvailable: false,
    },
  };
}