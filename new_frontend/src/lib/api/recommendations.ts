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
  matchedRules: string[];
  failedRules: string[];
  explanation: string[];
};

export function getRecommendations(userId: string) {
  return api<{ user: { name: string }; recommendedSchemes: Recommendation[] }>(
    `/api/recommend/${userId}`,
    {},
    RECOMMENDATION_API_URL,
  );
}
