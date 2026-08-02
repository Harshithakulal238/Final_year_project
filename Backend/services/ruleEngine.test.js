import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateSchemeEligibility } from './ruleEngine.js';

test('uses structured eligibility fields instead of generic scheme names when checking gender restriction', () => {
  const user = {
    gender: 'male',
    age: 30,
    income: 80000,
    casteCategory: 'OBC',
    district: 'Bengaluru',
    employmentType: 'private',
    qualification: 'graduate',
  };

  const scheme = {
    scheme_name: 'General Support Scheme',
    gender: 'female',
    age_min: 18,
    age_max: 40,
    income_limit: 120000,
    caste_restriction: ['obc'],
  };

  const result = evaluateSchemeEligibility(user, scheme);

  assert.equal(result.eligible, false);
  assert.ok(result.failedRules.includes('Gender'));
});

test('accepts users whose structured fields match the scheme criteria', () => {
  const user = {
    gender: 'female',
    age: 30,
    income: 80000,
    casteCategory: 'OBC',
    district: 'Bengaluru',
    employmentType: 'self-employed',
    qualification: 'graduate',
  };

  const scheme = {
    scheme_name: 'General Support Scheme',
    gender: 'female',
    age_min: 18,
    age_max: 40,
    income_limit: 120000,
    caste_restriction: ['obc'],
  };

  const result = evaluateSchemeEligibility(user, scheme);

  assert.equal(result.eligible, true);
});
