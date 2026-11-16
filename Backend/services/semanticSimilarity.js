const FIELD_ALIASES = {
  gender: {
    female: ['female', 'woman', 'women'],
    male: ['male', 'man', 'men'],
    other: ['other', 'non-binary', 'nonbinary'],
  },
  caste: {
    sc: ['sc', 'scheduled caste'],
    st: ['st', 'scheduled tribe'],
    obc: ['obc', 'other backward class', 'backward class'],
    minority: ['minority', 'muslim', 'christian', 'sikh', 'jain', 'buddhist', 'parsi'],
  },
  occupation: {
    farmer: ['farmer', 'agriculture', 'agricultural', 'cultivator'],
    labourer: ['labourer', 'laborer', 'worker', 'construction worker'],
    'self-employed': ['self-employed', 'self employed', 'entrepreneur', 'business owner'],
    unorganised: ['unorganised', 'unorganized', 'informal sector'],
    student: ['student', 'scholar'],
    homemaker: ['homemaker', 'housewife', 'home maker'],
  },
  rationCard: {
    bpl: ['bpl', 'below poverty line'],
    aay: ['aay', 'antyodaya anna yojana'],
    apl: ['apl', 'above poverty line'],
  },
  conditions: {
    pregnant: ['pregnant', 'pregnancy', 'expectant mother', 'maternity'],
    widow: ['widow', 'widowed'],
    disabled: ['disabled', 'disability', 'person with disability', 'persons with disabilities'],
  },
};

function normalize(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function values(value) {
  if (Array.isArray(value)) return value;
  return value == null || value === '' ? [] : [value];
}

function aliasesFor(field, value) {
  const normalized = normalize(value);
  return FIELD_ALIASES[field]?.[normalized] ?? [normalized];
}

function profileConcepts(user) {
  const concepts = [];
  for (const field of ['gender', 'caste', 'occupation', 'rationCard']) {
    if (normalize(user?.[field])) concepts.push(aliasesFor(field, user[field]));
  }

  const conditions = user?.conditions ?? user?.specialConditions;
  for (const condition of values(conditions)) {
    if (normalize(condition)) concepts.push(aliasesFor('conditions', condition));
  }

  const district = normalize(user?.location?.district ?? user?.district);
  if (district) concepts.push([district]);

  const education = normalize(user?.education ?? user?.qualification);
  if (education) concepts.push([education]);
  return concepts.filter((concept) => concept[0]);
}

function schemeText(scheme) {
  return normalize([
    scheme?.scheme_name,
    scheme?.schemeName,
    scheme?.name,
    scheme?.description,
    scheme?.eligibility,
    scheme?.benefits,
    scheme?.objective,
    scheme?.applicant_type,
    scheme?.caste_category,
    scheme?.special_conditions,
    scheme?.ration_card_type,
    scheme?.education,
    scheme?.district,
  ].flat(Infinity).filter((value) => value != null).join(' '));
}

function containsPhrase(text, phrase) {
  return ` ${text} `.includes(` ${normalize(phrase)} `);
}

export function getSemanticSimilarity(user, scheme) {
  const concepts = profileConcepts(user);
  if (!concepts.length) return 0;
  const text = schemeText(scheme);
  const matched = concepts.filter((aliases) => aliases.some((alias) => containsPhrase(text, alias))).length;
  return Number((matched / concepts.length).toFixed(6));
}
