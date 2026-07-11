export interface Footer {
  data_source: string;
  synthetic_variability: boolean;
  llm_provider: string;
}

export interface ForecastPoint {
  date: string;
  low: number;
  expected: number;
  high: number;
}

export interface BacktestMetrics {
  mae: number;
  rmse: number;
  mape: number;
  r2: number;
}

export interface TargetForecast {
  target: string;
  unit: string;
  points: ForecastPoint[];
  model_metrics: BacktestMetrics;
  naive_metrics: BacktestMetrics;
  seasonal_naive_metrics: BacktestMetrics;
  beats_baselines: boolean;
}

export interface ForecastResult {
  horizon_days: number;
  synthetic_variability: boolean;
  targets: Record<string, TargetForecast>;
}

export interface StageRecommendation {
  stage: string;
  date: string;
  predicted_cost_inr: number;
  cost_contribution_pct: number;
  dominant_driver: string;
  recommended_method: string;
  secondary_methods: string[];
  priority: "Low" | "Medium" | "High" | "Very High";
  estimated_savings_pct: number;
  estimated_savings_inr: number;
  rationale: string;
  source: "rule+llm" | "rule_fallback";
}

export interface MethodOfTheDay {
  date: string;
  stage: string;
  recommended_method: string;
  priority: string;
  expected_savings_inr: number;
  rationale: string;
  sustainability_note: string;
}

export interface ExecutiveInsight {
  date: string;
  headline: string;
  narrative: string;
  source: string;
}

export interface RecommendationDay {
  date: string;
  stage_recommendations: StageRecommendation[];
  method_of_the_day: MethodOfTheDay;
  executive_insight: ExecutiveInsight;
}

export interface RecommendationsResponse {
  horizon_days: number;
  days: RecommendationDay[];
  footer: Footer;
}

export interface SustainabilityLever {
  driver: string;
  description: string;
  suggested_method: string;
  relative_contribution: number;
}

export interface SustainabilityHistoricalRow {
  Date: string;
  scope1_kgco2e: number;
  scope2_kgco2e: number;
  scope3_kgco2e: number;
  total_kgco2e: number;
  non_renewable_index: number;
  sustainability_score: number;
  total_waste_kg: number;
  water_kl: number;
}

export interface SustainabilityForecastRow {
  date: string;
  scope1_kgco2e: number;
  scope2_kgco2e: number;
  scope3_kgco2e: number;
  total_kgco2e: number;
  non_renewable_index: number;
  sustainability_score: number;
}

export interface AdvisorBrief {
  date: string;
  sustainability_score: number;
  total_kgco2e: number;
  non_renewable_index: number;
  top_levers: SustainabilityLever[];
  narrative: string;
  sdg_note: string;
  source: string;
}

export interface SustainabilityResponse {
  historical: SustainabilityHistoricalRow[];
  forecast: SustainabilityForecastRow[];
  top_levers: SustainabilityLever[];
  advisor_brief: AdvisorBrief;
  footer: Footer;
}

export interface ScorecardTargetEntry {
  unit: string;
  model: BacktestMetrics;
  naive: BacktestMetrics;
  seasonal_naive: BacktestMetrics;
  beats_baselines: boolean;
}

export interface ScorecardResponse {
  scorecard: {
    synthetic_variability: boolean;
    horizon_days: number;
    targets: Record<string, ScorecardTargetEntry>;
  };
  footer: Footer;
}

export interface HistoricalDay {
  Date: string;
  total_cost_inr: number;
  total_waste_kg: number;
  water_kl: number;
  sustainability_score: number;
  [key: string]: number | string;
}

export interface ValidationSummary {
  rows_loaded: number;
  n_days: number;
  expected_rows: number;
  expected_days: number;
  date_range: [string, string];
  total_cost_mean_inr: number;
  total_cost_std_inr: number;
  total_cost_coef_of_variation: number;
  is_effectively_flat: boolean;
  executive_table_reproduction_max_abs_diff_inr: number;
  executive_table_reproduction_matches: boolean;
  materials_found: string[];
  stages_found: string[];
  machines_found: string[];
  scope_columns_empty: boolean;
}

export interface HistoricalResponse {
  days: HistoricalDay[];
  validation: ValidationSummary;
  footer: Footer;
}
