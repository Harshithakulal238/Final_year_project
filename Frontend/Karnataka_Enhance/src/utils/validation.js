export const validateProfile = (values, step = null) => {
  const errors = {};
  const warnings = {};

  if (step === 1 || step === null) {
    if (!values.name?.trim()) errors.name = 'Full name is required';
    if (!values.age) errors.age = 'Age is required';
    if (!values.gender) errors.gender = 'Gender is required';
    if (!values.district) errors.district = 'District is required';
    if (!values.taluk) errors.taluk = 'Taluk is required';
    if (!values.locationType) errors.locationType = 'Please choose Urban or Rural';
  }

  if (step === 2 || step === null) {
    if (!values.income) errors.income = 'Annual income is required';
    if (!values.rationCard) errors.rationCard = 'Ration card type is required';
    if (!values.casteCategory) errors.casteCategory = 'Caste category is required';

    if (values.income?.includes('10 Lakh') && values.rationCard === 'BPL') {
      warnings.rationCard = 'High income with BPL is unusual. Please verify your ration card status.';
    }
  }

  if (step === 3 || step === null) {
    if (!values.studentStatus) errors.studentStatus = 'Student status is required';
    if (!values.qualification) errors.qualification = 'Qualification is required';
  }

  if (step === 4 || step === null) {
    if (!values.employmentType) errors.employmentType = 'Employment type is required';

    if (values.gender === 'Male' && values.specialConditions?.includes('Pregnant')) {
      errors.specialConditions = 'Male users cannot select Pregnant';
    }
    if (values.gender === 'Male' && values.specialConditions?.includes('Lactating Mother')) {
      errors.specialConditions = 'Male users cannot select Lactating Mother';
    }
  }

  return { errors, warnings };
};
