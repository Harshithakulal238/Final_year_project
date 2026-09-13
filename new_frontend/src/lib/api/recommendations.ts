import { api } from "./client";

const RECOMMENDATION_API_URL = (
  // In development, use Vite's same-origin proxy just like the existing
  // frontend. This avoids a browser CORS request to the recommendation API.
  import.meta.env.DEV
    ? ""
    : import.meta.env.VITE_RECOMMENDATION_API_URL ?? import.meta.env.VITE_API_URL ?? "http://localhost:5001"
).replace(/\/$/, "");

export type Recommendation = {
  schemeName: string;
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

export function getTfIdfRecommendations(userId: string) {
  return api<{ user: { name: string }; recommendedSchemes: TfIdfRecommendation[]; statistics: TfIdfStatistics }>(
    `/api/recommend/${userId}/tfidf`,
    {},
    RECOMMENDATION_API_URL,
  );
}