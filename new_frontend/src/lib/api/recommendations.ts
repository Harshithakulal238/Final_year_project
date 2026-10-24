import { api } from "./client";
import type { Lang, TranslationKey } from "@/lib/i18n";

const RECOMMENDATION_API_URL = (
  // In development, use Vite's same-origin proxy just like the existing
  // frontend. This avoids a browser CORS request to the recommendation API.
  import.meta.env.DEV
    ? ""
    : import.meta.env.VITE_RECOMMENDATION_API_URL ?? import.meta.env.VITE_API_URL ?? "http://localhost:5001"
).replace(/\/$/, "");

export type Recommendation = {
  schemeName: string;
  description?: string;
  translations?: SchemeTranslations;
  sourceUrl: string;
  ruleScore: number;
  decisionTreeScore: number;
  finalScore: number;
  ranking?: {
    eligibility: number;
    priority: number;
    fieldMatch: number;
    recency: number;
    finalPercent: number;
  };
  matchedRules: string[];
  failedRules: string[];
  explanation: string[];
};

export type SchemeTranslations = {
  kn?: Record<string, string>;
};

export type SchemeCatalogItem = {
  id: string;
  name: string;
  description: string;
  benefits: string;
  eligibility: string;
  documents: string;
  applicationProcess: string;
  category: string;
  ministry: string;
  sourceUrl: string;
  translations?: SchemeTranslations;
};

export function getLocalizedSchemeText(
  translations: SchemeTranslations | undefined,
  lang: Lang,
  fields: string[],
  fallback: string,
) {
  if (lang === "kn") {
    for (const field of fields) {
      const value = translations?.kn?.[field];
      if (typeof value === "string" && value.trim()) return value;
    }
  }

  return fallback;
}

type Translate = (
  key: TranslationKey,
  vars?: Record<string, string | number>,
) => string;

const ruleNameKeys: Record<string, TranslationKey> = {
  Age: "results.ruleAge",
  Gender: "results.ruleGender",
  Income: "results.ruleIncome",
  Caste: "results.ruleCaste",
  "Minority Community": "results.ruleMinorityCommunity",
  "Ration Card": "results.ruleRationCard",
  Occupation: "results.ruleOccupation",
  Education: "results.ruleEducation",
  Disability: "results.ruleDisability",
  District: "results.ruleDistrict",
};

export function getLocalizedRuleName(ruleName: string, t: Translate) {
  const key = ruleNameKeys[ruleName];
  return key ? t(key) : ruleName;
}

export function getLocalizedEligibilityReason(reason: string, t: Translate) {
  const ageMatch = reason.match(/^Age (\d+) is within the scheme limit$/);
  if (ageMatch) return t("results.reasonAgeWithinLimit", { age: ageMatch[1] });

  const reasonKeys: Record<string, TranslationKey> = {
    "Gender matches the scheme requirement": "results.reasonGenderMatches",
    "User income is within the scheme limit": "results.reasonIncomeWithinLimit",
    "Caste matches the scheme requirement": "results.reasonCasteMatches",
    "Minority community requirement is satisfied": "results.reasonMinoritySatisfied",
    "Ration card matches the scheme requirement": "results.reasonRationCardMatches",
    "Occupation matches the scheme requirement": "results.reasonOccupationMatches",
    "Education matches the scheme requirement": "results.reasonEducationMatches",
    "Disability requirement is satisfied": "results.reasonDisabilitySatisfied",
    "District matches the scheme requirement": "results.reasonDistrictMatches",
  };

  return reasonKeys[reason] ? t(reasonKeys[reason]) : reason;
}

export type TfIdfRecommendation = {
  schemeId: string;
  schemeName: string;
  sourceUrl: string;
  similarityScore: number;
  similarityPercent: number;
  rank: number;
};

export type TfIdfStatistics = {
  users: number;
  schemes: number;
  userSchemeComparisons: number;
  vocabularySize: number;
  vectorDimensions: number;
  topK: number;
  similarityRange: { min: number; max: number } | null;
  averageSimilarity: number | null;
  processingTimeMs: number;
  precisionAtK: number | null;
  recallAtK: number | null;
  f1AtK: number | null;
  labelledDataAvailable: boolean;
};

export function getRecommendations(userId: string) {
  return api<{ user: { name: string }; recommendedSchemes: Recommendation[] }>(
    `/api/recommend/${userId}`,
    {},
    RECOMMENDATION_API_URL,
  );
}

export function getSchemes() {
  return api<{ schemes: SchemeCatalogItem[] }>("/api/schemes", {}, RECOMMENDATION_API_URL);
}

export function getTfIdfRecommendations(userId: string) {
  return api<{ user: { name: string }; recommendedSchemes: TfIdfRecommendation[]; statistics: TfIdfStatistics }>(
    `/api/recommend/${userId}/tfidf`,
    {},
    RECOMMENDATION_API_URL,
  );
}
