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

const matchingUser = {
  age: 30,
  gender: 'female',
  income: 0,
  caste: 'obc',
  rationCard: 'bpl',
  occupation: 'student',
  education: 'graduate',
  conditions: ['disabled'],
  location: { district: 'Bengaluru' },
};

test('age requirement distinguishes matched, failed, missing, and absent constraints', () => {
  assert.equal(evaluateSchemeEligibility(matchingUser, { age_min: 18, age_max: 40 }).eligible, true);
  assert.equal(evaluateSchemeEligibility({ ...matchingUser, age: 17 }, { age_min: 18 }).eligible, false);
  const missing = evaluateSchemeEligibility({ ...matchingUser, age: undefined }, { age_min: 18 });
  assert.equal(missing.eligible, false);
  assert.ok(missing.failedRules.includes('Age'));
  assert.equal(evaluateSchemeEligibility({ ...matchingUser, age: undefined }, {}).eligible, true);
});

test('education requirement distinguishes matched, failed, missing, and absent constraints', () => {
  assert.equal(evaluateSchemeEligibility(matchingUser, { education: 'graduate' }).eligible, true);
  assert.equal(evaluateSchemeEligibility({ ...matchingUser, education: 'diploma' }, { education: 'graduate' }).eligible, false);
  for (const value of [undefined, null, '', '   ']) {
    const missing = evaluateSchemeEligibility({ ...matchingUser, education: value, qualification: value }, { education: 'graduate' });
    assert.equal(missing.eligible, false);
    assert.ok(missing.failedRules.includes('Education'));
  }
  assert.equal(evaluateSchemeEligibility({ ...matchingUser, education: undefined }, {}).eligible, true);
});

test('district requirement distinguishes matched, failed, missing, and absent constraints', () => {
  assert.equal(evaluateSchemeEligibility(matchingUser, { district: 'Bengaluru' }).eligible, true);
  assert.equal(evaluateSchemeEligibility({ ...matchingUser, location: { district: 'Mysuru' } }, { district: 'Bengaluru' }).eligible, false);
  for (const value of [undefined, null, '', '   ']) {
    const missing = evaluateSchemeEligibility({ ...matchingUser, location: { district: value }, district: value }, { district: 'Bengaluru' });
    assert.equal(missing.eligible, false);
    assert.ok(missing.failedRules.includes('District'));
  }
  assert.equal(evaluateSchemeEligibility({ ...matchingUser, location: { district: '' } }, {}).eligible, true);
});

test('all other required criteria reject missing user data while zero income remains valid', () => {
  const cases = [
    ['Gender', { gender: 'female' }, { gender: '   '}],
    ['Income', { income_limit: 100 }, { income: '   '}],
    ['Caste', { caste_category: ['obc'] }, { caste: '   '}],
    ['Minority Community', { minority_community_required: true }, { caste: null }],
    ['Ration Card', { ration_card_type: ['bpl'] }, { rationCard: '' }],
    ['Occupation', { applicant_type: 'student' }, { occupation: '   '}],
    ['Disability', { disability_required: true }, { conditions: undefined }],
  ];

  for (const [ruleName, scheme, userOverride] of cases) {
    const result = evaluateSchemeEligibility({ ...matchingUser, ...userOverride }, scheme);
    assert.equal(result.eligible, false, `${ruleName} requirement must reject missing user data`);
    assert.ok(result.failedRules.includes(ruleName));
  }

  const zeroIncome = evaluateSchemeEligibility({ ...matchingUser, income: 0 }, { income_limit: 0 });
  assert.equal(zeroIncome.eligible, true);
});