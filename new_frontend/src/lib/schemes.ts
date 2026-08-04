export type Scheme = {
  id: string;
  name: string;
  category: string;
  description: string;
  benefits: string;
  ministry: string;
  applyUrl: string;
  documents: string[];
  eligibility: {
    minAge?: number;
    maxAge?: number;
    gender?: "male" | "female" | "any";
    maxIncome?: number;
    rationCard?: ("APL" | "BPL" | "AAY" | "any")[];
    caste?: ("General" | "OBC" | "SC" | "ST" | "Minority" | "any")[];
    occupation?: string[];
    conditions?: string[]; // required special conditions
  };
  targetGroup: string[];
};

export const SCHEMES: Scheme[] = [
  {
    id: "pmjay",
    name: "Ayushman Bharat PM-JAY",
    category: "Health",
    description:
      "Health insurance covering secondary and tertiary hospitalization up to ₹5 lakh per family per year.",
    benefits: "₹5,00,000/year cashless hospitalization for the whole family.",
    ministry: "Ministry of Health & Family Welfare",
    applyUrl: "https://pmjay.gov.in/",
    documents: ["Aadhaar", "Ration card", "Income certificate"],
    eligibility: {
      maxIncome: 250000,
      rationCard: ["BPL", "AAY"],
      caste: ["any"],
    },
    targetGroup: ["low-income", "family"],
  },
  {
    id: "ujjwala",
    name: "Pradhan Mantri Ujjwala Yojana",
    category: "Energy",
    description:
      "Free LPG connection to women from BPL households to promote clean cooking fuel.",
    benefits: "Free LPG connection + first refill and stove support.",
    ministry: "Ministry of Petroleum & Natural Gas",
    applyUrl: "https://pmuy.gov.in/",
    documents: ["Aadhaar", "BPL ration card", "Bank passbook"],
    eligibility: {
      gender: "female",
      minAge: 18,
      maxIncome: 200000,
      rationCard: ["BPL", "AAY"],
    },
    targetGroup: ["women", "low-income"],
  },
  {
    id: "matru-vandana",
    name: "Pradhan Mantri Matru Vandana Yojana",
    category: "Maternity",
    description:
      "Maternity benefit for pregnant and lactating mothers for their first living child.",
    benefits: "₹5,000 in three instalments to a mother's bank account.",
    ministry: "Ministry of Women & Child Development",
    applyUrl: "https://wcd.nic.in/schemes/pradhan-mantri-matru-vandana-yojana",
    documents: ["Aadhaar", "MCP card", "Bank passbook"],
    eligibility: {
      gender: "female",
      minAge: 18,
      conditions: ["pregnant"],
    },
    targetGroup: ["women", "pregnant"],
  },
  {
    id: "vidhwa-pension",
    name: "Indira Gandhi National Widow Pension Scheme",
    category: "Pension",
    description:
      "Monthly pension for widows from BPL households aged 40 years and above.",
    benefits: "₹300–₹500 per month direct pension.",
    ministry: "Ministry of Rural Development",
    applyUrl: "https://nsap.nic.in/",
    documents: ["Aadhaar", "Widow certificate", "BPL card"],
    eligibility: {
      gender: "female",
      minAge: 40,
      maxIncome: 200000,
      rationCard: ["BPL", "AAY"],
      conditions: ["widow"],
    },
    targetGroup: ["widow", "women"],
  },
  {
    id: "disability-pension",
    name: "Indira Gandhi National Disability Pension",
    category: "Pension",
    description: "Pension for persons with severe/multiple disabilities from BPL households.",
    benefits: "₹300–₹500 per month pension for persons with disability.",
    ministry: "Ministry of Rural Development",
    applyUrl: "https://nsap.nic.in/",
    documents: ["Aadhaar", "Disability certificate", "BPL card"],
    eligibility: {
      minAge: 18,
      maxAge: 79,
      maxIncome: 200000,
      rationCard: ["BPL", "AAY"],
      conditions: ["disabled"],
    },
    targetGroup: ["disabled"],
  },
  {
    id: "kisan",
    name: "PM Kisan Samman Nidhi",
    category: "Agriculture",
    description: "Income support to small and marginal farmer families across India.",
    benefits: "₹6,000 per year in three instalments to farmer bank accounts.",
    ministry: "Ministry of Agriculture & Farmers Welfare",
    applyUrl: "https://pmkisan.gov.in/",
    documents: ["Aadhaar", "Land records", "Bank passbook"],
    eligibility: {
      minAge: 18,
      occupation: ["farmer"],
    },
    targetGroup: ["farmer"],
  },
  {
    id: "shram-yogi",
    name: "PM Shram Yogi Maandhan",
    category: "Pension",
    description:
      "Voluntary pension scheme for unorganised sector workers with monthly income up to ₹15,000.",
    benefits: "Assured ₹3,000 monthly pension after age 60.",
    ministry: "Ministry of Labour & Employment",
    applyUrl: "https://maandhan.in/",
    documents: ["Aadhaar", "Savings bank account", "Mobile number"],
    eligibility: {
      minAge: 18,
      maxAge: 40,
      maxIncome: 180000,
      occupation: ["labourer", "unorganised", "self-employed"],
    },
    targetGroup: ["worker", "unorganised"],
  },
  {
    id: "scholarship-sc",
    name: "Post Matric Scholarship for SC Students",
    category: "Education",
    description:
      "Financial assistance to SC students pursuing post-matriculation studies in recognised institutions.",
    benefits: "Tuition fees + maintenance allowance for the full course duration.",
    ministry: "Ministry of Social Justice & Empowerment",
    applyUrl: "https://scholarships.gov.in/",
    documents: ["Aadhaar", "Caste certificate", "Income certificate", "Marksheet"],
    eligibility: {
      minAge: 15,
      maxAge: 35,
      maxIncome: 250000,
      caste: ["SC"],
      occupation: ["student"],
    },
    targetGroup: ["student", "sc"],
  },
  {
    id: "scholarship-st",
    name: "Post Matric Scholarship for ST Students",
    category: "Education",
    description: "Financial assistance to ST students pursuing post-matriculation studies.",
    benefits: "Tuition + maintenance allowance + book grants.",
    ministry: "Ministry of Tribal Affairs",
    applyUrl: "https://scholarships.gov.in/",
    documents: ["Aadhaar", "ST certificate", "Income certificate", "Marksheet"],
    eligibility: {
      minAge: 15,
      maxAge: 35,
      maxIncome: 250000,
      caste: ["ST"],
      occupation: ["student"],
    },
    targetGroup: ["student", "st"],
  },
  {
    id: "obc-scholarship",
    name: "Post Matric Scholarship for OBC Students",
    category: "Education",
    description: "Scholarship for OBC students pursuing higher studies.",
    benefits: "Course fee reimbursement + maintenance allowance.",
    ministry: "Ministry of Social Justice & Empowerment",
    applyUrl: "https://scholarships.gov.in/",
    documents: ["Aadhaar", "OBC certificate", "Income certificate"],
    eligibility: {
      minAge: 15,
      maxAge: 35,
      maxIncome: 150000,
      caste: ["OBC"],
      occupation: ["student"],
    },
    targetGroup: ["student", "obc"],
  },
  {
    id: "awas",
    name: "Pradhan Mantri Awas Yojana (Gramin)",
    category: "Housing",
    description: "Financial assistance to build pucca houses for the rural homeless and BPL families.",
    benefits: "Up to ₹1.30 lakh assistance for constructing a pucca house.",
    ministry: "Ministry of Rural Development",
    applyUrl: "https://pmayg.nic.in/",
    documents: ["Aadhaar", "Bank passbook", "SECC data"],
    eligibility: {
      minAge: 18,
      maxIncome: 300000,
      rationCard: ["BPL", "AAY", "APL"],
    },
    targetGroup: ["housing", "family"],
  },
  {
    id: "vridha-pension",
    name: "Indira Gandhi National Old Age Pension",
    category: "Pension",
    description: "Monthly pension for senior citizens aged 60+ from BPL households.",
    benefits: "₹200–₹500 per month depending on age slab.",
    ministry: "Ministry of Rural Development",
    applyUrl: "https://nsap.nic.in/",
    documents: ["Aadhaar", "Age proof", "BPL card"],
    eligibility: {
      minAge: 60,
      maxIncome: 200000,
      rationCard: ["BPL", "AAY"],
    },
    targetGroup: ["elderly"],
  },
];

SCHEMES.push({
  id: "minority-scholarship",
  name: "Pre/Post Matric Scholarship for Minorities",
  category: "Education",
  description:
    "Scholarship for students from notified minority communities (Muslim, Christian, Sikh, Buddhist, Jain, Parsi) pursuing school or higher education.",
  benefits: "Tuition fee, maintenance and book allowance for the full course duration.",
  ministry: "Ministry of Minority Affairs",
  applyUrl: "https://scholarships.gov.in/",
  documents: ["Aadhaar", "Minority community certificate", "Income certificate", "Marksheet"],
  eligibility: {
    minAge: 10,
    maxAge: 35,
    maxIncome: 250000,
    caste: ["Minority"],
    occupation: ["student"],
  },
  targetGroup: ["student", "minority"],
});

export const OCCUPATIONS = [
  "student",
  "farmer",
  "labourer",
  "unorganised",
  "self-employed",
  "salaried",
  "unemployed",
  "homemaker",
  "retired",
];