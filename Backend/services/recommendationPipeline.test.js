import test from 'node:test';
import assert from 'node:assert/strict';

import { rankRecommendationCandidates } from './recommendationPipeline.js';

const profile = {
  age: 42,
  gender: 'female',
  income: 120000,
  caste: 'SC',
  rationCard: 'BPL',
  occupation: 'homemaker',
  conditions: ['widow'],
  location: { state: 'Karnataka', district: 'Kolar' },
};

const widowScheme = {
  _id: 'widow-scheme',
  scheme_name: 'Widow Pension',
  description: 'Karnataka pension assistance for widows and women below the income limit.',
  eligibility: 'Applicants must be widowed women from BPL households.',
  gender: 'female',
  age_min: 40,
  income_limit: 200000,
  caste_category: ['SC'],
  ration_card_type: ['BPL'],
  special_conditions: ['widowed'],
  source_url: 'https://example.test/widow',
};

test('ranks eligible and information-needed candidates using all configured scores', async () => {
  const excludedPregnancyScheme = {
    _id: 'pregnancy-scheme',
    scheme_name: 'Maternity Benefit',
    description: 'Financial assistance for pregnant women.',
    gender: 'female',
    special_conditions: ['pregnant'],
    source_url: 'https://example.test/maternity',
  };
  const excludedIncomeScheme = {
    _id: 'income-scheme',
    scheme_name: 'Low Income Support',
    gender: 'female',
    income_limit: 50000,
    source_url: 'https://example.test/income',
  };
  const recommendations = await rankRecommendationCandidates(profile, [
    widowScheme,
    excludedPregnancyScheme,
    excludedIncomeScheme,
  ]);
  const byName = new Map(recommendations.map((item) => [item.scheme.scheme_name, item]));

  assert.deepEqual([...byName.keys()], ['Widow Pension']);
  const widow = byName.get('Widow Pension');
  assert.equal(widow.ruleEvaluation.status, 'eligible');
  assert.ok(widow.semanticTextSimilarity > 0);
  assert.ok(widow.ranking.semanticSimilarity > 0);
  assert.ok(widow.ranking.tfidfSimilarity > 0);
  assert.ok(widow.decisionTreeScore > 0);
  assert.deepEqual(widow.ranking.weights, { structured: 0.6, semantic: 0.25, tfidf: 0.15 });

  const expectedScore = (
    widow.ranking.structuredMatch * 0.6
    + widow.ranking.semanticSimilarity * 0.25
    + widow.ranking.tfidfSimilarity * 0.15
  ) / 100;
  assert.ok(Math.abs(widow.ranking.finalScore - expectedScore) < 0.0001);

});

test('keeps mandatory mismatches out and labels missing profile fields as pending', async () => {
  const missingProfile = {
    gender: 'female',
    conditions: undefined,
  };
  const recommendations = await rankRecommendationCandidates(missingProfile, [
    {
      _id: 'missing-profile',
      scheme_name: 'Applicant Support',
      gender: 'female',
      age_min: 18,
      income_limit: 100000,
      special_conditions: ['widow'],
      source_url: 'https://example.test/applicant',
    },
    {
      _id: 'failed-condition',
      scheme_name: 'Widow Support',
      gender: 'male',
      special_conditions: ['widow'],
      source_url: 'https://example.test/widow',
    },
  ]);

  assert.equal(recommendations.length, 1);
  assert.equal(recommendations[0].scheme.scheme_name, 'Applicant Support');
  assert.equal(recommendations[0].ruleEvaluation.status, 'needs_more_information');
  assert.deepEqual(
    recommendations[0].ruleEvaluation.needsMoreInformation,
    ['Age', 'Income', 'Special Conditions'],
  );
});
