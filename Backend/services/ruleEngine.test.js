import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateSchemeEligibility } from './ruleEngine.js';

const matchingUser = {
  age: 30,
  gender: 'female',
  income: 0,
  caste: 'obc',
  rationCard: 'bpl',
  occupation: 'student',
  education: 'graduate',
  conditions: ['widow', 'pregnant', 'disabled'],
  location: { district: 'Bengaluru' },
};

test('marks a profile matching all specified criteria as eligible', () => {
  const result = evaluateSchemeEligibility(matchingUser, {
    age_min: 18,
    age_max: 40,
    gender: 'female',
    income_limit: 100,
    caste_category: ['obc'],
    ration_card_type: ['bpl'],
    applicant_type: 'student',
    education: 'graduate',
    special_conditions: ['widowed', 'pregnancy'],
    disability_required: true,
    district: 'Bengaluru',
  });

  assert.equal(result.status, 'eligible');
  assert.equal(result.eligible, true);
  assert.deepEqual(result.failedRules, []);
  assert.ok(result.matchedRules.includes('Special Conditions'));
});

test('excludes a scheme when a known mandatory condition does not match', () => {
  const result = evaluateSchemeEligibility(
    { ...matchingUser, conditions: ['pregnant'] },
    { gender: 'male', special_conditions: ['widow'] },
  );

  assert.equal(result.status, 'ineligible');
  assert.equal(result.eligible, false);
  assert.ok(result.failedRules.includes('Gender'));
  assert.ok(result.failedRules.includes('Special Conditions'));
});

test('marks missing required user information as needs more information', () => {
  const result = evaluateSchemeEligibility(
    { gender: 'female', conditions: undefined },
    { age_min: 18, income_limit: 100000, special_conditions: ['widow'] },
  );

  assert.equal(result.status, 'needs_more_information');
  assert.equal(result.eligible, null);
  assert.deepEqual(result.failedRules, []);
  assert.deepEqual(result.needsMoreInformation, ['Age', 'Income', 'Special Conditions']);
});

test('checks pregnancy and widow status from both supported profile condition fields', () => {
  const scheme = { special_conditions: ['pregnant', 'widow'] };

  assert.equal(evaluateSchemeEligibility({ conditions: ['pregnancy', 'widowed'] }, scheme).status, 'eligible');
  assert.equal(evaluateSchemeEligibility({ specialConditions: ['pregnant', 'widow'] }, scheme).status, 'eligible');
  const mismatch = evaluateSchemeEligibility({ conditions: ['pregnant'] }, scheme);
  assert.equal(mismatch.status, 'ineligible');
  assert.deepEqual(mismatch.failedRules, ['Special Conditions']);
});

test('treats a known empty conditions list as a failed required condition', () => {
  const result = evaluateSchemeEligibility(
    { conditions: [] },
    { special_conditions: ['widow'] },
  );

  assert.equal(result.status, 'ineligible');
  assert.deepEqual(result.failedRules, ['Special Conditions']);
});

test('distinguishes missing education and district from definite mismatches', () => {
  const missingEducation = evaluateSchemeEligibility(
    { ...matchingUser, education: undefined, qualification: undefined },
    { education: 'graduate' },
  );
  assert.equal(missingEducation.status, 'needs_more_information');
  assert.ok(missingEducation.needsMoreInformation.includes('Education'));

  const mismatchDistrict = evaluateSchemeEligibility(
    { ...matchingUser, location: { district: 'Mysuru' } },
    { district: 'Bengaluru' },
  );
  assert.equal(mismatchDistrict.status, 'ineligible');
  assert.ok(mismatchDistrict.failedRules.includes('District'));
});

test('keeps zero income valid and treats whitespace income as missing', () => {
  assert.equal(evaluateSchemeEligibility({ income: 0 }, { income_limit: 0 }).status, 'eligible');
  const missing = evaluateSchemeEligibility({ income: '   ' }, { income_limit: 100 });
  assert.equal(missing.status, 'needs_more_information');
  assert.ok(missing.needsMoreInformation.includes('Income'));
});

test('does not impose criteria absent from scheme data', () => {
  const result = evaluateSchemeEligibility({}, {});
  assert.equal(result.status, 'eligible');
  assert.equal(result.eligible, true);
  assert.equal(result.ruleScore, 100);
});
