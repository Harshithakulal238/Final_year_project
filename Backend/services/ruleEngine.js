// Eligibility comparisons here use ONLY structured MongoDB fields on the

// scheme and user documents. No free-text field (description, eligibility,

// objective, benefits, documents_required, application_process, etc.) is

// ever read or pattern-matched.

 

const isBlank = (value) =>

  value === null || value === undefined || (typeof value === 'string' && value.trim() === '') || (Array.isArray(value) && value.length === 0);

 

const normalizeToken = (value) => String(value ?? '').trim().toLowerCase();

 

const toTokenArray = (value) => {

  if (isBlank(value)) return [];

  const list = Array.isArray(value) ? value : [value];

  return list.map(normalizeToken).filter(Boolean);

};

 

const toFiniteNumber = (value) => {

  if (isBlank(value)) return null;

  const num = Number(value);

  return Number.isFinite(num) ? num : null;

};

 

const getUserAge = (user) => {

  const directAge = toFiniteNumber(user?.age);

  if (directAge !== null) return directAge;

 

  if (!user?.dob) return null;

 

  const dob = new Date(user.dob);

  if (Number.isNaN(dob.getTime())) return null;

 

  const today = new Date();

  let age = today.getFullYear() - dob.getFullYear();

  const birthdayPending =

    today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate());

  if (birthdayPending) age -= 1;

 

  return age >= 0 ? age : null;

};

 

const notApplicable = (name, message) => ({

  name,

  applicable: false,

  eligible: true,

  ruleScore: null,

  matchedRules: [name],

  failedRules: [],

  explanation: [message],

});

 

const passed = (name, message) => ({

  name,

  applicable: true,

  eligible: true,

  ruleScore: 100,

  matchedRules: [name],

  failedRules: [],

  explanation: [message],

});

 

const failed = (name, message) => ({

  name,

  applicable: true,

  eligible: false,

  ruleScore: 0,

  matchedRules: [],

  failedRules: [name],

  explanation: [message],

});

const missingRequiredInformation = (name, message) => failed(name, message);

 

export function evaluateAgeRule(user, scheme) {

  const ageMin = toFiniteNumber(scheme?.age_min);

  const ageMax = toFiniteNumber(scheme?.age_max);

 

  if (ageMin === null && ageMax === null) {

    return notApplicable('Age', 'Age requirement is not specified for this scheme');

  }

 

  const userAge = getUserAge(user);

  if (userAge === null) {

    return missingRequiredInformation('Age', 'User age is required to verify this scheme');

  }

 

  if (ageMin !== null && userAge < ageMin) {

    return failed('Age', `Age ${userAge} is below the minimum age requirement (${ageMin})`);

  }

 

  if (ageMax !== null && userAge > ageMax) {

    return failed('Age', `Age ${userAge} exceeds the maximum age limit (${ageMax})`);

  }

 

  return passed('Age', `Age ${userAge} is within the scheme limit`);

}

 

export function evaluateGenderRule(user, scheme) {

  const requiredGender = normalizeToken(scheme?.gender);

  if (!requiredGender) {

    return notApplicable('Gender', 'Gender requirement is not specified for this scheme');

  }

 

  const userGender = normalizeToken(user?.gender);

  if (!userGender) {

    return missingRequiredInformation('Gender', 'User gender is required to verify this scheme');

  }

 

  if (userGender !== requiredGender) {

    return failed('Gender', 'Scheme is restricted to a different gender group');

  }

 

  return passed('Gender', 'Gender matches the scheme requirement');

}

 

export function evaluateIncomeRule(user, scheme) {

  const incomeLimit = toFiniteNumber(scheme?.income_limit);

  if (incomeLimit === null) {

    return notApplicable('Income', 'Income limit is not specified for this scheme');

  }

 

  const userIncome = toFiniteNumber(user?.income);

  if (userIncome === null) {

    return missingRequiredInformation('Income', 'User income is required to verify this scheme');

  }

 

  if (userIncome > incomeLimit) {

    return failed('Income', `User income (${userIncome}) exceeds the scheme limit (${incomeLimit})`);

  }

 

  return passed('Income', 'User income is within the scheme limit');

}

 

export function evaluateCasteRule(user, scheme) {

  const restrictions = toTokenArray(scheme?.caste_category);

  if (restrictions.length === 0) {

    return notApplicable('Caste', 'Caste category is not specified for this scheme');

  }

 

  const userCaste = normalizeToken(user?.caste);

  if (!userCaste) {

    return missingRequiredInformation('Caste', 'User caste is required to verify this scheme');

  }

 

  if (!restrictions.includes(userCaste)) {

    return failed('Caste', "Caste does not match the scheme's caste category requirement");

  }

 

  return passed('Caste', 'Caste matches the scheme requirement');

}

 

export function evaluateMinorityCommunityRule(user, scheme) {

  if (scheme?.minority_community_required !== true) {

    return notApplicable('Minority Community', 'Minority community requirement is not specified for this scheme');

  }

 

  const userCaste = normalizeToken(user?.caste);

  if (!userCaste) {

    return missingRequiredInformation('Minority Community', 'User caste is required to verify this scheme');

  }

 

  if (userCaste !== 'minority') {

    return failed('Minority Community', 'Scheme is restricted to minority community applicants');

  }

 

  return passed('Minority Community', 'Minority community requirement is satisfied');

}

 

export function evaluateRationCardRule(user, scheme) {

  const allowedCards = toTokenArray(scheme?.ration_card_type);

  if (allowedCards.length === 0) {

    return notApplicable('Ration Card', 'Ration card requirement is not specified for this scheme');

  }

 

  const userRationCard = normalizeToken(user?.rationCard);

  if (!userRationCard) {

    return missingRequiredInformation('Ration Card', 'User ration card is required to verify this scheme');

  }

 

  if (!allowedCards.includes(userRationCard)) {

    return failed('Ration Card', "Ration card does not match the scheme's ration card requirement");

  }

 

  return passed('Ration Card', 'Ration card matches the scheme requirement');

}

 

export function evaluateOccupationRule(user, scheme) {

  const applicantType = normalizeToken(scheme?.applicant_type);

  if (!applicantType) {

    return notApplicable('Occupation', 'Applicant type is not specified for this scheme');

  }

 

  const userOccupation = normalizeToken(user?.occupation);

  if (!userOccupation) {

    return missingRequiredInformation('Occupation', 'User occupation is required to verify this scheme');

  }

 

  if (userOccupation !== applicantType) {

    return failed('Occupation', "Occupation does not match the scheme's applicant type requirement");

  }

 

  return passed('Occupation', 'Occupation matches the scheme requirement');

}

 

export function evaluateEducationRule(user, scheme) {

  const requiredEducation = normalizeToken(scheme?.education);

  if (!requiredEducation) {

    return notApplicable('Education', 'Education requirement is not specified for this scheme');

  }

 

  const userEducation = normalizeToken(user?.education) || normalizeToken(user?.qualification);

  if (!userEducation) {

    return missingRequiredInformation('Education', 'User education is required to verify this scheme');

  }

 

  if (userEducation !== requiredEducation) {

    return failed('Education', 'Education does not match the scheme requirement');

  }

 

  return passed('Education', 'Education matches the scheme requirement');

}

 

export function evaluateDisabilityRule(user, scheme) {

  if (scheme?.disability_required !== true) {

    return notApplicable('Disability', 'Disability requirement is not specified for this scheme');

  }

 

  if (!Array.isArray(user?.conditions)) {

    return missingRequiredInformation('Disability', 'User conditions are required to verify this scheme');

  }

 

  const conditions = toTokenArray(user.conditions);

  if (!conditions.includes('disabled')) {

    return failed('Disability', 'Scheme is restricted to applicants with a disability');

  }

 

  return passed('Disability', 'Disability requirement is satisfied');

}

 

export function evaluateDistrictRule(user, scheme) {

  const requiredDistrict = normalizeToken(scheme?.district);

  if (!requiredDistrict) {

    return notApplicable('District', 'District requirement is not specified for this scheme');

  }

 

  const userDistrict = normalizeToken(user?.location?.district) || normalizeToken(user?.district);

  if (!userDistrict) {

    return missingRequiredInformation('District', 'User district is required to verify this scheme');

  }

 

  if (userDistrict !== requiredDistrict) {

    return failed('District', "District does not match the scheme's district requirement");

  }

 

  return passed('District', 'District matches the scheme requirement');

}

 

export function evaluateSchemeEligibility(user, scheme) {

  const ruleChecks = [

    evaluateAgeRule(user, scheme),

    evaluateGenderRule(user, scheme),

    evaluateIncomeRule(user, scheme),

    evaluateCasteRule(user, scheme),

    evaluateMinorityCommunityRule(user, scheme),

    evaluateRationCardRule(user, scheme),

    evaluateOccupationRule(user, scheme),

    evaluateEducationRule(user, scheme),

    evaluateDisabilityRule(user, scheme),

    evaluateDistrictRule(user, scheme),

  ];

 

  const eligible = ruleChecks.every((rule) => rule.eligible);

  const matchedRules = ruleChecks.filter((rule) => rule.eligible).map((rule) => rule.name);

  const failedRules = ruleChecks.filter((rule) => !rule.eligible).map((rule) => rule.name);

  const explanation = ruleChecks.flatMap((rule) => rule.explanation || []);

 

  // Only rules whose scheme-side field was actually specified count toward

  // the score, so schemes with fewer stated criteria aren't penalized.

  const applicableRules = ruleChecks.filter((rule) => rule.applicable);

  const ruleScore = applicableRules.length

    ? Number((applicableRules.reduce((sum, rule) => sum + rule.ruleScore, 0) / applicableRules.length).toFixed(2))

    : 100;

 

  return {

    eligible,

    ruleScore,

    matchedRules,

    failedRules,

    explanation,

    ruleDetails: ruleChecks,

  };

}