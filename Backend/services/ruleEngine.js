const blank = (value) => value == null
  || (typeof value === 'string' && value.trim() === '')
  || (Array.isArray(value) && value.length === 0);
const token = (value) => String(value ?? '').trim().toLowerCase();
const tokens = (value) => blank(value)
  ? []
  : (Array.isArray(value) ? value : [value]).map(token).filter(Boolean);
const number = (value) => blank(value) || !Number.isFinite(Number(value)) ? null : Number(value);

const ignored = (name, message) => ({
  name,
  applicable: false,
  eligible: true,
  status: 'not_applicable',
  ruleScore: null,
  matchedRules: [],
  failedRules: [],
  needsMoreInformation: [],
  explanation: [message],
});
const passed = (name, message) => ({
  name,
  applicable: true,
  eligible: true,
  status: 'eligible',
  ruleScore: 100,
  matchedRules: [name],
  failedRules: [],
  needsMoreInformation: [],
  explanation: [message],
});
const failed = (name, message) => ({
  name,
  applicable: true,
  eligible: false,
  status: 'ineligible',
  ruleScore: 0,
  matchedRules: [],
  failedRules: [name],
  needsMoreInformation: [],
  explanation: [message],
});
const needsInformation = (name, message) => ({
  name,
  applicable: true,
  eligible: null,
  status: 'needs_more_information',
  ruleScore: null,
  matchedRules: [],
  failedRules: [],
  needsMoreInformation: [name],
  explanation: [message],
});

function ageOf(user) {
  const direct = number(user?.age);
  if (direct !== null) return direct;
  const dob = new Date(user?.dob);
  if (!user?.dob || Number.isNaN(dob.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  if (now.getMonth() < dob.getMonth()
    || (now.getMonth() === dob.getMonth() && now.getDate() < dob.getDate())) age--;
  return age >= 0 ? age : null;
}

function userConditions(user) {
  if (Array.isArray(user?.conditions)) return user.conditions;
  if (Array.isArray(user?.specialConditions)) return user.specialConditions;
  return null;
}

function canonicalCondition(value) {
  const condition = token(value).replace(/[\s-]+/g, '_');
  if (['pregnancy', 'pregnant', 'expectant_mother'].includes(condition)) return 'pregnant';
  if (['widow', 'widowed'].includes(condition)) return 'widow';
  if (['disability', 'person_with_disability', 'person_with_disabilities'].includes(condition)) return 'disabled';
  return condition;
}

export function evaluateAgeRule(user, scheme) {
  const min = number(scheme?.age_min);
  const max = number(scheme?.age_max);
  if (min === null && max === null) return ignored('Age', 'Age requirement is not specified for this scheme');
  const age = ageOf(user);
  if (age === null) return needsInformation('Age', 'User age is required to verify this scheme requirement');
  if (min !== null && age < min) return failed('Age', `Age ${age} is below the minimum age requirement (${min})`);
  if (max !== null && age > max) return failed('Age', `Age ${age} exceeds the maximum age limit (${max})`);
  return passed('Age', `Age ${age} is within the scheme limit`);
}

export function evaluateGenderRule(user, scheme) {
  const required = token(scheme?.gender);
  if (!required || ['any', 'all'].includes(required)) return ignored('Gender', 'Gender requirement is not specified for this scheme');
  const actual = token(user?.gender);
  if (!actual) return needsInformation('Gender', 'User gender is required to verify this scheme requirement');
  if (!['male', 'female', 'other'].includes(required)) {
    return needsInformation('Gender', 'Scheme gender requirement could not be verified');
  }
  return actual === required
    ? passed('Gender', 'Gender matches the scheme requirement')
    : failed('Gender', 'Scheme is restricted to a different gender group');
}

export function evaluateIncomeRule(user, scheme) {
  const limit = number(scheme?.income_limit);
  if (limit === null) return ignored('Income', 'Income limit is not specified for this scheme');
  const income = number(user?.income);
  if (income === null) return needsInformation('Income', 'User income is required to verify this scheme limit');
  return income <= limit
    ? passed('Income', 'User income is within the scheme limit')
    : failed('Income', `User income (${income}) exceeds the scheme limit (${limit})`);
}

export function evaluateCasteRule(user, scheme) {
  const allowed = tokens(scheme?.caste_category ?? scheme?.caste_restriction);
  if (!allowed.length || allowed.some((value) => ['any', 'all'].includes(value))) {
    return ignored('Caste', 'Caste category is not specified for this scheme');
  }
  const caste = token(user?.caste ?? user?.casteCategory);
  if (!caste) return needsInformation('Caste', 'User caste category is required to verify this scheme requirement');
  return allowed.includes(caste)
    ? passed('Caste', 'Caste matches the scheme requirement')
    : failed('Caste', "Caste does not match the scheme's caste category requirement");
}

export function evaluateMinorityCommunityRule(user, scheme) {
  if (scheme?.minority_community_required !== true) {
    return ignored('Minority Community', 'Minority community requirement is not specified for this scheme');
  }
  const caste = token(user?.caste ?? user?.casteCategory);
  if (!caste) return needsInformation('Minority Community', 'User minority status is required to verify this scheme requirement');
  return caste === 'minority'
    ? passed('Minority Community', 'Minority community requirement is satisfied')
    : failed('Minority Community', 'Scheme is restricted to minority community applicants');
}

export function evaluateRationCardRule(user, scheme) {
  const allowed = tokens(scheme?.ration_card_type);
  if (!allowed.length || allowed.some((value) => ['any', 'all'].includes(value))) {
    return ignored('Ration Card', 'Ration card requirement is not specified for this scheme');
  }
  const card = token(user?.rationCard);
  if (!card) return needsInformation('Ration Card', 'User ration card is required to verify this scheme requirement');
  return allowed.includes(card)
    ? passed('Ration Card', 'Ration card matches the scheme requirement')
    : failed('Ration Card', "Ration card does not match the scheme's ration card requirement");
}

export function evaluateOccupationRule(user, scheme) {
  const required = token(scheme?.applicant_type);
  if (!required || ['any', 'all', 'women', 'woman', 'female', 'men', 'man', 'male'].includes(required)) {
    return ignored('Occupation', 'Occupation requirement is not specified for this scheme');
  }
  const occupation = token(user?.occupation ?? user?.employmentType);
  if (!occupation) return needsInformation('Occupation', 'User occupation is required to verify this scheme requirement');
  return occupation === required
    ? passed('Occupation', 'Occupation matches the scheme requirement')
    : failed('Occupation', "Occupation does not match the scheme's applicant type requirement");
}

export function evaluateEducationRule(user, scheme) {
  const required = token(scheme?.education);
  if (!required || ['any', 'all'].includes(required)) return ignored('Education', 'Education requirement is not specified for this scheme');
  const education = token(user?.education ?? user?.qualification);
  if (!education) return needsInformation('Education', 'User education is required to verify this scheme requirement');
  return education === required
    ? passed('Education', 'Education matches the scheme requirement')
    : failed('Education', 'Education does not match the scheme requirement');
}

export function evaluateDisabilityRule(user, scheme) {
  if (scheme?.disability_required !== true) return ignored('Disability', 'Disability requirement is not specified for this scheme');
  const conditions = userConditions(user);
  if (conditions === null) return needsInformation('Disability', 'User disability status is required to verify this scheme requirement');
  return tokens(conditions).map(canonicalCondition).includes('disabled')
    ? passed('Disability', 'Disability requirement is satisfied')
    : failed('Disability', 'Scheme is restricted to applicants with a disability');
}

export function evaluateSpecialConditionsRule(user, scheme) {
  const required = tokens(scheme?.special_conditions).map(canonicalCondition);
  if (!required.length) return ignored('Special Conditions', 'No special conditions are specified for this scheme');
  const conditions = userConditions(user);
  if (conditions === null) {
    return needsInformation('Special Conditions', 'User special conditions are required to verify this scheme requirement');
  }
  const actual = tokens(conditions).map(canonicalCondition);
  const missing = required.filter((condition) => !actual.includes(condition));
  if (missing.length) {
    return failed('Special Conditions', `Scheme requires: ${missing.join(', ')}`);
  }
  return passed('Special Conditions', 'User special conditions match the scheme requirement');
}

export function evaluateDistrictRule(user, scheme) {
  const required = token(scheme?.district);
  if (!required || ['any', 'all', 'karnataka'].includes(required)) {
    return ignored('District', 'District requirement is not specified for this scheme');
  }
  const district = token(user?.location?.district ?? user?.district);
  if (!district) return needsInformation('District', 'User district is required to verify this scheme requirement');
  return district === required
    ? passed('District', 'District matches the scheme requirement')
    : failed('District', "District does not match the scheme's district requirement");
}

export function evaluateSchemeEligibility(user, scheme) {
  const ruleDetails = [
    evaluateAgeRule(user, scheme),
    evaluateGenderRule(user, scheme),
    evaluateIncomeRule(user, scheme),
    evaluateCasteRule(user, scheme),
    evaluateMinorityCommunityRule(user, scheme),
    evaluateRationCardRule(user, scheme),
    evaluateOccupationRule(user, scheme),
    evaluateEducationRule(user, scheme),
    evaluateDisabilityRule(user, scheme),
    evaluateSpecialConditionsRule(user, scheme),
    evaluateDistrictRule(user, scheme),
  ];
  const applicable = ruleDetails.filter((rule) => rule.applicable);
  const scored = applicable.filter((rule) => rule.ruleScore !== null);
  const failedRules = ruleDetails.flatMap((rule) => rule.failedRules);
  const needsMoreInformation = ruleDetails.flatMap((rule) => rule.needsMoreInformation);
  const status = failedRules.length
    ? 'ineligible'
    : needsMoreInformation.length
      ? 'needs_more_information'
      : 'eligible';

  return {
    eligible: status === 'eligible' ? true : status === 'ineligible' ? false : null,
    status,
    ruleScore: applicable.length === 0
      ? 100
      : scored.length
        ? Number((scored.reduce((sum, rule) => sum + rule.ruleScore, 0) / scored.length).toFixed(2))
        : 0,
    matchedRules: applicable.filter((rule) => rule.eligible === true).map((rule) => rule.name),
    failedRules,
    needsMoreInformation,
    explanation: ruleDetails.flatMap((rule) => rule.explanation),
    ruleDetails,
  };
}
