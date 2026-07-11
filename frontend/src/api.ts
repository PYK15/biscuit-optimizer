import type {
  ForecastResult,
  RecommendationsResponse,
  SustainabilityResponse,
  ScorecardResponse,
  HistoricalResponse,
} from "./types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) {
    throw new Error(`${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  historical: () => getJSON<HistoricalResponse>("/historical"),
  forecast: (horizon: number) => getJSON<{ forecast: ForecastResult }>(`/forecast?horizon=${horizon}`),
  recommendations: (horizon: number, useLlm = false) =>
    getJSON<RecommendationsResponse>(`/recommendations?horizon=${horizon}&use_llm=${useLlm}`),
  sustainability: (horizon: number, useLlm = false) =>
    getJSON<SustainabilityResponse>(`/sustainability?horizon=${horizon}&use_llm=${useLlm}`),
  scorecard: (horizon: number) => getJSON<ScorecardResponse>(`/scorecard?horizon=${horizon}`),
};
