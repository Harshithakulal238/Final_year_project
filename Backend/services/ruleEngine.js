const normalize = (value) => String(value ?? '').toLowerCase().trim();

const getSchemeText = (scheme) => {
  const fields = [
    scheme?.scheme_name,
    scheme?.schemeName,
    scheme?.name,
    scheme?.description,
    scheme?.objective,
    scheme?.benefits,
    scheme?.eligibility,
    scheme?.documents_required,
    scheme?.application_process,
    scheme?.implementing_agency,
    scheme?.categories,
  ];

  return fields
    .filter(Boolean)
    .map((field) => Array.isArray(field) ? field.join(' ') : String(field))
    .join(' ')
    .toLowerCase();
};

const parseNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;

  const cleaned = String(value).replace(/[^0-9.]/g, '');
  if (!cleaned) return null;

  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
};

const toLakh = (value) => {
  const num = parseNumber(value);
  if (num === null) return null;
  return num <= 100000 ? num / 100000 : num; // rough normalization for rupees
};

const extractIncomeLimit = (text) => {
  const patterns = [
    /annual(?:\s+family)?\s+income.*?rs\.?\s*([0-9,]+(?:\.[0-9]+)?)\s*(?:lakh|lac|k|crore|cr)?/i,
    /income.*?(?:less\s+than|below|not\s+more\s+than|not\s+exceed(?:ing)?).*?rs\.?\s*([0-9,]+(?:\.[0-9]+)?)\s*(?:lakh|lac|k|crore|cr)?/i,
    /income\s*(?:limit|cap).*?rs\.?\s*([0-9,]+(?:\.[0-9]+)?)\s*(?:lakh|lac|k|crore|cr)?/i,
    /family\s+income.*?(?:less\s+than|below|not\s+exceed(?:ing)?|upto|up\s+to).*?rs\.?\s*([0-9,]+(?:\.[0-9]+)?)\s*(?:lakh|lac|k|crore|cr)?/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return parseNumber(match[1]);
    }
  }

  return null;
};

const extractAgeRange = (text) => {
  const patterns = [
    /age(?:\s+(?:of|limit))?\s*(?:should\s+be|is|between|from)\s*(?:between\s+)?([0-9]+)\s*(?:years?|yrs?)\s*(?:to|and|-)\s*([0-9]+)\s*(?:years?|yrs?)/i,
    /age(?:\s+(?:of|limit))?\s*(?:should\s+be|is|between|from)\s*([0-9]+)\s*(?:years?|yrs?)\s*(?:to|and|-)\s*([0-9]+)\s*(?:years?|yrs?)/i,
    /minimum\s+age\s*(?:of)?\s*([0-9]+)|at\s+least\s+([0-9]+)/i,
    /maximum\s+age\s*(?:of)?\s*([0-9]+)|below\s+([0-9]+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const values = match.slice(1).filter(Boolean).map(Number);
      if (values.length >= 2) {
        return { min: values[0], max: values[1] };
      }

      if (values.length === 1) {
        return { min: values[0], max: null };
      }
    }
  }

  return null;
};

const getUserIncome = (user) => {
  const raw = user?.income || user?.annualIncome || user?.familyIncome || user?.monthlyIncome;
  if (!raw) return null;

  if (typeof raw === 'number') return raw;

  const value = raw.toString();
  if (value.includes('lakh') || value.includes('lac')) {
    const lakhValue = parseNumber(value.replace(/lakh|lac/i, ''));
    return lakhValue ? lakhValue * 100000 : null;
  }

  const plain = parseNumber(value);
  return plain;
};

const getUserAge = (user) => {
  const raw = user?.age;
  if (raw === undefined || raw === null || raw === '') return null;
  return Number(raw);
};

const getStructuredAgeRange = (scheme) => {
  const ageMin = scheme?.age_min ?? scheme?.ageMin ?? scheme?.minimum_age ?? scheme?.minAge;
  const ageMax = scheme?.age_max ?? scheme?.ageMax ?? scheme?.maximum_age ?? scheme?.maxAge;

  if (ageMin === undefined && ageMax === undefined) return null;

  const normalizedMin = ageMin === undefined || ageMin === null || ageMin === '' ? null : Number(ageMin);
  const normalizedMax = ageMax === undefined || ageMax === null || ageMax === '' ? null : Number(ageMax);

  if (normalizedMin === null && normalizedMax === null) return null;

  return {
    min: Number.isFinite(normalizedMin) ? normalizedMin : null,
    max: Number.isFinite(normalizedMax) ? normalizedMax : null,
  };
};

const getStructuredGender = (scheme) => {
  const value = scheme?.gender || scheme?.beneficiary_gender || scheme?.target_gender || scheme?.applicant_gender;
  return value === undefined || value === null || value === '' ? null : String(value).trim();
};

const normalizeGenderValue = (value) => {
  const normalized = normalize(value);
  if (!normalized) return null;
  if (['female', 'woman', 'women', 'girl', 'mother', 'widow', 'pregnant', 'lactating'].includes(normalized)) return 'female';
  if (['male', 'man', 'men', 'boy', 'father', 'husband'].includes(normalized)) return 'male';
  return normalized;
};

const genderMatchesRequirement = (requiredGender, userGender) => {
  const requirement = normalizeGenderValue(requiredGender);
  const value = normalizeGenderValue(userGender);

  if (!requirement || !value) return true;
  if (requirement === 'female') return ['female', 'woman', 'women'].includes(value);
  if (requirement === 'male') return ['male', 'man', 'men'].includes(value);
  return requirement === value;
};

const getStructuredIncomeLimit = (scheme) => {
  const raw = scheme?.income_limit ?? scheme?.incomeLimit ?? scheme?.annual_income_limit ?? scheme?.annualIncomeLimit ?? scheme?.max_income ?? scheme?.maximumIncome;
  if (raw === undefined || raw === null || raw === '') return null;

  const amount = Number(raw);
  if (Number.isFinite(amount)) return amount;

  return parseNumber(String(raw));
};

const normalizeIncomeLimit = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;

  if (num > 1000000) return num;
  if (num >= 1000 && num <= 100000) return num;
  if (num < 1000) return num * 100000;

  return num;
};

const getStructuredCasteRestrictions = (scheme) => {
  const raw = scheme?.caste_restriction ?? scheme?.casteRestriction ?? scheme?.category ?? scheme?.categories;

  if (Array.isArray(raw)) {
    return raw.map((item) => String(item).trim()).filter(Boolean);
  }

  if (typeof raw === 'string') {
    return raw.split(/[;,|]/).map((item) => item.trim()).filter(Boolean);
  }

  return [];
};

const matchesCasteRestriction = (userCaste, restrictions) => {
  if (!restrictions || restrictions.length === 0) return true;

  const normalizedUserCaste = normalize(userCaste || '');
  const restrictionText = restrictions
    .map((item) => String(item).toLowerCase())
    .join(' ');

  if (/sc|scheduled caste/i.test(restrictionText) && !(normalizedUserCaste.includes('sc') || normalizedUserCaste.includes('schedule'))) {
    return false;
  }

  if (/st|scheduled tribe/i.test(restrictionText) && !(normalizedUserCaste.includes('st') || normalizedUserCaste.includes('schedule'))) {
    return false;
  }

  if (/obc/i.test(restrictionText) && !normalizedUserCaste.includes('obc')) {
    return false;
  }

  if (/minority/i.test(restrictionText) && !/minority|muslim|christian|sikh|jain|parsi|buddhist/i.test(normalizedUserCaste)) {
    return false;
  }

  return true;
};

export function evaluateAgeRule(user, scheme) {
  const schemeText = getSchemeText(scheme);
  const ageRange = getStructuredAgeRange(scheme) || extractAgeRange(schemeText);
  const userAge = getUserAge(user);

  if (!ageRange || userAge === null) {
    return {
      name: 'Age',
      eligible: true,
      ruleScore: 10,
      matchedRules: ['Age'],
      failedRules: [],
      explanation: ['Age rule not specified for this scheme'],
    };
  }

  if (ageRange.min && userAge < ageRange.min) {
    return {
      name: 'Age',
      eligible: false,
      ruleScore: 0,
      matchedRules: [],
      failedRules: ['Age'],
      explanation: [`Age ${userAge} is below the minimum age requirement (${ageRange.min})`],
    };
  }

  if (ageRange.max && userAge > ageRange.max) {
    return {
      name: 'Age',
      eligible: false,
      ruleScore: 0,
      matchedRules: [],
      failedRules: ['Age'],
      explanation: [`Age ${userAge} exceeds the maximum age limit (${ageRange.max})`],
    };
  }

  return {
    name: 'Age',
    eligible: true,
    ruleScore: 10,
    matchedRules: ['Age'],
    failedRules: [],
    explanation: [`Age ${userAge} is within the scheme limit`],
  };
}

export function evaluateGenderRule(user, scheme) {
  const text = getSchemeText(scheme);
  const userGender = normalize(user?.gender || '');
  const structuredGender = getStructuredGender(scheme);

  if (structuredGender) {
    if (!genderMatchesRequirement(structuredGender, userGender)) {
      return {
        name: 'Gender',
        eligible: false,
        ruleScore: 0,
        matchedRules: [],
        failedRules: ['Gender'],
        explanation: ['Scheme is restricted to a different gender group'],
      };
    }

    return {
      name: 'Gender',
      eligible: true,
      ruleScore: 10,
      matchedRules: ['Gender'],
      failedRules: [],
      explanation: ['Gender matches the scheme requirement'],
    };
  }

  if (!/female|women|woman|girl|lady|mother|pregnant|lactating|widow/i.test(text) &&
      !/male|men|man|boy|father|husband/i.test(text) &&
      !structuredGender) {
    return {
      name: 'Gender',
      eligible: true,
      ruleScore: 10,
      matchedRules: ['Gender'],
      failedRules: [],
      explanation: ['Gender rule not specified for this scheme'],
    };
  }

  const femaleKeywords = /(female|women|woman|girl|mother|pregnant|lactating|widow)/i;
  const maleKeywords = /(male|men|man|boy|father|husband)/i;

  if (femaleKeywords.test(text) && !['female', 'woman', 'women'].includes(userGender)) {
    return {
      name: 'Gender',
      eligible: false,
      ruleScore: 0,
      matchedRules: [],
      failedRules: ['Gender'],
      explanation: ['Scheme is restricted to women/female applicants'],
    };
  }

  if (maleKeywords.test(text) && !['male', 'man', 'men'].includes(userGender)) {
    return {
      name: 'Gender',
      eligible: false,
      ruleScore: 0,
      matchedRules: [],
      failedRules: ['Gender'],
      explanation: ['Scheme is restricted to male applicants'],
    };
  }

  return {
    name: 'Gender',
    eligible: true,
    ruleScore: 10,
    matchedRules: ['Gender'],
    failedRules: [],
    explanation: ['Gender matches the scheme requirement'],
  };
}

export function evaluateIncomeRule(user, scheme) {
  const text = getSchemeText(scheme);
  const structuredIncomeLimit = getStructuredIncomeLimit(scheme);
  const incomeLimit = structuredIncomeLimit !== null ? normalizeIncomeLimit(structuredIncomeLimit) : extractIncomeLimit(text);
  const userIncome = getUserIncome(user);

  if (incomeLimit === null || userIncome === null) {
    return {
      name: 'Income',
      eligible: true,
      ruleScore: 10,
      matchedRules: ['Income'],
      failedRules: [],
      explanation: ['Income rule not specified or user income is unavailable'],
    };
  }

  const incomeValue = incomeLimit >= 100000 ? incomeLimit : incomeLimit * 100000;

  if (userIncome > incomeValue) {
    return {
      name: 'Income',
      eligible: false,
      ruleScore: 0,
      matchedRules: [],
      failedRules: ['Income'],
      explanation: [`User income (${userIncome}) exceeds the scheme limit (${incomeValue})`],
    };
  }

  return {
    name: 'Income',
    eligible: true,
    ruleScore: 10,
    matchedRules: ['Income'],
    failedRules: [],
    explanation: ['User income is within the scheme limit'],
  };
}

export function evaluateCasteRule(user, scheme) {
  const text = getSchemeText(scheme);
  const caste = normalize(user?.casteCategory || user?.caste || '');
  const structuredRestrictions = getStructuredCasteRestrictions(scheme);

  if (structuredRestrictions.length > 0) {
    if (!matchesCasteRestriction(caste, structuredRestrictions)) {
      return {
        name: 'Caste',
        eligible: false,
        ruleScore: 0,
        matchedRules: [],
        failedRules: ['Caste'],
        explanation: ['Caste does not match the structured caste requirement'],
      };
    }

    return {
      name: 'Caste',
      eligible: true,
      ruleScore: 10,
      matchedRules: ['Caste'],
      failedRules: [],
      explanation: ['Caste matches the scheme requirement'],
    };
  }

  if (!/(sc|st|obc|general|minority|bpl|scheduled caste|scheduled tribe|other backward)/i.test(text)) {
    return {
      name: 'Caste',
      eligible: true,
      ruleScore: 10,
      matchedRules: ['Caste'],
      failedRules: [],
      explanation: ['Caste restriction is not specified for this scheme'],
    };
  }

  if (/sc|scheduled caste/i.test(text) && !(caste.includes('sc') || caste.includes('schedule'))) {
    return {
      name: 'Caste',
      eligible: false,
      ruleScore: 0,
      matchedRules: [],
      failedRules: ['Caste'],
      explanation: ['Scheme is only for Scheduled Caste applicants'],
    };
  }

  if (/st|scheduled tribe/i.test(text) && !(caste.includes('st') || caste.includes('schedule'))) {
    return {
      name: 'Caste',
      eligible: false,
      ruleScore: 0,
      matchedRules: [],
      failedRules: ['Caste'],
      explanation: ['Scheme is only for Scheduled Tribe applicants'],
    };
  }

  if (/obc/i.test(text) && !caste.includes('obc')) {
    return {
      name: 'Caste',
      eligible: false,
      ruleScore: 0,
      matchedRules: [],
      failedRules: ['Caste'],
      explanation: ['Scheme is only for OBC applicants'],
    };
  }

  if (/minority/i.test(text) && !/minority|muslim|christian|sikh|jain|parsi|buddhist/i.test(caste)) {
    return {
      name: 'Caste',
      eligible: false,
      ruleScore: 0,
      matchedRules: [],
      failedRules: ['Caste'],
      explanation: ['Scheme is only for minority community applicants'],
    };
  }

  return {
    name: 'Caste',
    eligible: true,
    ruleScore: 10,
    matchedRules: ['Caste'],
    failedRules: [],
    explanation: ['Caste matches the scheme requirement'],
  };
}

export function evaluateOccupationRule(user, scheme) {
  const text = getSchemeText(scheme);
  const employment = normalize(user?.employmentType || user?.occupation || '');
  const studentStatus = normalize(user?.studentStatus || '');

  if (!/(farmer|student|unemployed|self-employed|agriculture|business|artisan|minority|employment)/i.test(text)) {
    return {
      name: 'Occupation',
      eligible: true,
      ruleScore: 10,
      matchedRules: ['Occupation'],
      failedRules: [],
      explanation: ['Occupation requirement is not specified'],
    };
  }

  if (/farmer|agriculture/i.test(text) && !(employment.includes('agriculture') || employment.includes('farmer'))) {
    return {
      name: 'Occupation',
      eligible: false,
      ruleScore: 0,
      matchedRules: [],
      failedRules: ['Occupation'],
      explanation: ['Scheme is meant for farmers or agricultural workers'],
    };
  }

  if (/student/i.test(text) && !studentStatus.includes('yes')) {
    return {
      name: 'Occupation',
      eligible: false,
      ruleScore: 0,
      matchedRules: [],
      failedRules: ['Occupation'],
      explanation: ['Scheme is for students only'],
    };
  }

  if (/unemployed|self-employed|business/i.test(text) && employment && !/unemployed|self-employed|private|government|business|agriculture/i.test(employment)) {
    return {
      name: 'Occupation',
      eligible: false,
      ruleScore: 0,
      matchedRules: [],
      failedRules: ['Occupation'],
      explanation: ['Occupation does not match the scheme eligibility'],
    };
  }

  return {
    name: 'Occupation',
    eligible: true,
    ruleScore: 10,
    matchedRules: ['Occupation'],
    failedRules: [],
    explanation: ['Occupation matches the scheme requirement'],
  };
}

export function evaluateDistrictRule(user, scheme) {
  const text = getSchemeText(scheme);
  const district = normalize(user?.district || '');

  if (!/(district|residen(t|ce)|karnataka)/i.test(text) || !district) {
    return {
      name: 'District',
      eligible: true,
      ruleScore: 10,
      matchedRules: ['District'],
      failedRules: [],
      explanation: ['District requirement is not specified or not available'],
    };
  }

  if (/karnataka/i.test(text) && !district) {
    return {
      name: 'District',
      eligible: false,
      ruleScore: 0,
      matchedRules: [],
      failedRules: ['District'],
      explanation: ['Scheme requires Karnataka residency'],
    };
  }

  return {
    name: 'District',
    eligible: true,
    ruleScore: 10,
    matchedRules: ['District'],
    failedRules: [],
    explanation: ['User district is compatible with Karnataka residency'],
  };
}

export function evaluateEducationRule(user, scheme) {
  const text = getSchemeText(scheme);
  const qualification = normalize(user?.qualification || user?.education || '');

  if (!/(10th|12th|diploma|graduat|post graduate|phd|education|student|class 8|class 8th|minimum marks)/i.test(text)) {
    return {
      name: 'Education',
      eligible: true,
      ruleScore: 10,
      matchedRules: ['Education'],
      failedRules: [],
      explanation: ['Education requirement is not specified'],
    };
  }

  if (/class 8|8th|8th standard/i.test(text) && !/8th|class 8|class 8th|10th|12th|diploma|degree|graduat|post graduate|phd/i.test(qualification)) {
    return {
      name: 'Education',
      eligible: false,
      ruleScore: 0,
      matchedRules: [],
      failedRules: ['Education'],
      explanation: ['Education does not meet the minimum qualification for this scheme'],
    };
  }

  return {
    name: 'Education',
    eligible: true,
    ruleScore: 10,
    matchedRules: ['Education'],
    failedRules: [],
    explanation: ['Education requirement is satisfied'],
  };
}

export function evaluateDisabilityRule(user, scheme) {
  const text = getSchemeText(scheme);
  const conditions = Array.isArray(user?.specialConditions) ? user.specialConditions : [];
  const hasDisability = conditions.some((condition) => normalize(condition).includes('disabled'));

  if (!/(disabled|disability|physically handicapped|blind|deaf|orthopedic)/i.test(text)) {
    return {
      name: 'Disability',
      eligible: true,
      ruleScore: 10,
      matchedRules: ['Disability'],
      failedRules: [],
      explanation: ['Disability criteria are not specified'],
    };
  }

  if (/disabled|disability/i.test(text) && !hasDisability) {
    return {
      name: 'Disability',
      eligible: false,
      ruleScore: 0,
      matchedRules: [],
      failedRules: ['Disability'],
      explanation: ['Scheme is specifically for disabled applicants'],
    };
  }

  return {
    name: 'Disability',
    eligible: true,
    ruleScore: 10,
    matchedRules: ['Disability'],
    failedRules: [],
    explanation: ['Disability requirement is satisfied'],
  };
}

export function evaluateSchemeEligibility(user, scheme) {
  const ruleChecks = [
    evaluateAgeRule(user, scheme),
    evaluateGenderRule(user, scheme),
    evaluateIncomeRule(user, scheme),
    evaluateCasteRule(user, scheme),
    evaluateOccupationRule(user, scheme),
    evaluateDistrictRule(user, scheme),
    evaluateEducationRule(user, scheme),
    evaluateDisabilityRule(user, scheme),
  ];

  const eligible = ruleChecks.every((rule) => rule.eligible);
  const matchedRules = ruleChecks.filter((rule) => rule.eligible).map((rule) => rule.name);
  const failedRules = ruleChecks.filter((rule) => !rule.eligible).map((rule) => rule.name);
  const ruleScoreTotal = ruleChecks.reduce((sum, rule) => sum + Number(rule.ruleScore || 0), 0);
  const ruleScore = Number((ruleScoreTotal / ruleChecks.length).toFixed(2));
  const explanation = ruleChecks.flatMap((rule) => rule.explanation || []);

  return {
    eligible,
    ruleScore,
    matchedRules,
    failedRules,
    explanation,
    ruleDetails: ruleChecks,
  };
}
