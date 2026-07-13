// Shared, pure frontend synthesis over already-fetched API data - no new
// backend calls or logic. Used by Overview's "Today at a Glance" strip, the
// Roadmap tab, and the print summary, so all three read from one source of
// truth instead of three slightly-different reimplementations.
import type { RecommendationsResponse, SustainabilityResponse, ScorecardResponse, HistoricalResponse, ForecastResult } from "./types";

export function fmtInr(n: number) {
  return `Rs ${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

// ---------------------------------------------------------------------------
// Roadmap synthesis (moved from components/Roadmap.tsx so it can be reused)
// ---------------------------------------------------------------------------
const PRIORITY_RANK: Record<string, number> = { "Very High": 4, High: 3, Medium: 2, Low: 1 };

// Coarse effort classification for the 9 fixed OPTIMIZATION_METHODS (config.py).
// Not a model output - a domain heuristic for how a plant manager plans
// around each method (quick shop-floor tweak vs. multi-week structural change).
const QUICK_WIN_METHODS = new Set(["Kaizen", "Energy Optimization", "Recipe Optimization", "JIT", "Supplier Optimization"]);

const TIMEFRAME_BY_PRIORITY: Record<string, string> = {
  "Very High": "This week",
  High: "This week",
  Medium: "This month",
  Low: "Ongoing",
};

export interface RoadmapItem {
  key: string;
  action: string;
  stages: string[];
  whyNow: string;
  impact: string;
  timeframe: string;
  confidenceLabel: string;
  confidenceTooltip: string;
  priority: string;
  priorityRank: number;
  effort: "quick" | "strategic";
  source: "cost" | "sustainability";
}

export function confidenceFor(scorecard: ScorecardResponse | undefined, targetKey: string): { label: string; tooltip: string; level: "high" | "medium" | "low" } {
  const entry = scorecard?.scorecard.targets[targetKey];
  if (!entry) {
    return { label: "Confidence: n/a", tooltip: "No backtested accuracy is available for this specific target yet.", level: "medium" };
  }
  const mape = entry.model.mape;
  let level: "high" | "medium" | "low";
  let label: string;
  if (mape <= 5) { level = "high"; label = "High confidence"; }
  else if (mape <= 10) { level = "medium"; label = "Medium confidence"; }
  else { level = "low"; label = "Low confidence"; }
  const beatsNote = entry.beats_baselines
    ? "and beat both the naive and seasonal-naive baselines in backtesting"
    : "though it did not beat the seasonal-naive baseline in backtesting - a strong weekly pattern makes that a tough bar with only 30 days of history";
  return {
    label: `${label} (MAPE ${mape}%)`,
    tooltip: `Confidence is tied to this system's own walk-forward backtest for "${targetKey}": the model's predictions were typically within ${mape}% of actual values on held-out days, ${beatsNote}.`,
    level,
  };
}

export function buildRoadmap(
  recommendations: RecommendationsResponse | undefined,
  sustainability: SustainabilityResponse | undefined,
  scorecard: ScorecardResponse | undefined
): RoadmapItem[] {
  const items: RoadmapItem[] = [];
  if (!recommendations) return items;

  // One item per (stage, method) pair, using the earliest/most urgent
  // occurrence across the selected forecast horizon's days.
  const byStageMethod = new Map<string, { rec: RecommendationsResponse["days"][number]["stage_recommendations"][number]; date: string; occurrences: number }>();
  for (const day of recommendations.days) {
    for (const rec of day.stage_recommendations) {
      const key = `${rec.stage}::${rec.recommended_method}`;
      const existing = byStageMethod.get(key);
      if (!existing) {
        byStageMethod.set(key, { rec, date: day.date, occurrences: 1 });
      } else {
        existing.occurrences += 1;
        if (PRIORITY_RANK[rec.priority] > PRIORITY_RANK[existing.rec.priority]) {
          existing.rec = rec;
          existing.date = day.date;
        }
      }
    }
  }

  for (const [key, { rec, date, occurrences }] of byStageMethod) {
    const { label: confidenceLabel, tooltip: confidenceTooltip } = confidenceFor(scorecard, `cost_${rec.stage}`);
    const trendNote =
      occurrences > 1
        ? `flagged on ${occurrences} of the next ${recommendations.days.length} forecast days`
        : `predicted for ${date}`;
    items.push({
      key,
      action: `Deploy ${rec.recommended_method} on ${rec.stage}`,
      stages: [rec.stage],
      whyNow: `${rec.dominant_driver} is the dominant cost driver for ${rec.stage} (${trendNote}, ${rec.cost_contribution_pct.toFixed(0)}% of that day's total cost).`,
      impact: `~${fmtInr(rec.estimated_savings_inr)} (~${rec.estimated_savings_pct}% of stage cost)`,
      timeframe: TIMEFRAME_BY_PRIORITY[rec.priority] ?? "This month",
      confidenceLabel,
      confidenceTooltip,
      priority: rec.priority,
      priorityRank: PRIORITY_RANK[rec.priority] ?? 1,
      effort: QUICK_WIN_METHODS.has(rec.recommended_method) ? "quick" : "strategic",
      source: "cost",
    });
  }

  if (sustainability) {
    const { label: confidenceLabel, tooltip: confidenceTooltip } = confidenceFor(scorecard, "total_kgco2e");
    for (const lever of sustainability.top_levers) {
      const priority = lever.relative_contribution >= 30 ? "High" : lever.relative_contribution >= 15 ? "Medium" : "Low";
      items.push({
        key: `sustainability::${lever.driver}`,
        action: `Apply ${lever.suggested_method} to reduce ${lever.driver}`,
        stages: ["Sustainability"],
        whyNow: `${lever.description} - accounts for ${lever.relative_contribution}% of the current gap to the best 30-day sustainability score.`,
        impact: `Sustainability score improvement (${lever.relative_contribution}% of score gap); no direct cost figure - see Sustainability tab`,
        timeframe: TIMEFRAME_BY_PRIORITY[priority],
        confidenceLabel,
        confidenceTooltip,
        priority,
        priorityRank: PRIORITY_RANK[priority] ?? 1,
        effort: QUICK_WIN_METHODS.has(lever.suggested_method) ? "quick" : "strategic",
        source: "sustainability",
      });
    }
  }

  return items.sort((a, b) => b.priorityRank - a.priorityRank);
}

// ---------------------------------------------------------------------------
// Trend indicators (up/down arrow + real % change vs. previous day)
// ---------------------------------------------------------------------------
export interface Trend {
  direction: "up" | "down" | "flat";
  pct: number; // magnitude only, always >= 0
}

export function computeTrend(current: number | undefined, previous: number | undefined): Trend | undefined {
  if (current === undefined || previous === undefined || !isFinite(previous) || previous === 0) return undefined;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  if (Math.abs(pct) < 0.5) return { direction: "flat", pct: 0 };
  return { direction: pct > 0 ? "up" : "down", pct: Math.abs(pct) };
}

// ---------------------------------------------------------------------------
// "Today at a Glance" status strip
// ---------------------------------------------------------------------------
export interface GlanceIndicator {
  key: string;
  label: string;
  value: string;
  status: "good" | "warn" | "bad";
  detail: string;
}

const PRIORITY_STATUS: Record<string, GlanceIndicator["status"]> = {
  "Very High": "bad",
  High: "warn",
  Medium: "warn",
  Low: "good",
};

export function buildGlanceIndicators(
  recommendations: RecommendationsResponse | undefined,
  sustainability: SustainabilityResponse | undefined,
  historical: HistoricalResponse | undefined,
  forecast: ForecastResult | undefined
): GlanceIndicator[] {
  const out: GlanceIndicator[] = [];

  const today = recommendations?.days[0];
  if (today) {
    const top = today.stage_recommendations.slice().sort((a, b) => PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority])[0];
    if (top) {
      out.push({
        key: "priority-stage",
        label: "Highest-priority stage",
        value: `${top.stage} (${top.priority})`,
        status: PRIORITY_STATUS[top.priority] ?? "warn",
        detail: `${top.recommended_method} recommended - ${top.dominant_driver} driving cost.`,
      });
    }
  }

  const latestHistoricalCost = historical?.days.at(-1)?.total_cost_inr;
  const nextDayCost = today?.stage_recommendations.reduce((s, r) => s + r.predicted_cost_inr, 0);
  const costTrend = computeTrend(nextDayCost, typeof latestHistoricalCost === "number" ? latestHistoricalCost : undefined);
  if (costTrend) {
    out.push({
      key: "cost-swing",
      label: "Predicted cost vs. yesterday",
      value: `${costTrend.direction === "up" ? "+" : costTrend.direction === "down" ? "-" : ""}${costTrend.pct.toFixed(1)}%`,
      status: costTrend.direction === "up" ? (costTrend.pct > 8 ? "bad" : "warn") : "good",
      detail:
        costTrend.direction === "up"
          ? "Total cost is predicted to rise - check the Cost Optimization tab."
          : costTrend.direction === "down"
            ? "Total cost is predicted to fall."
            : "Total cost is predicted to stay flat.",
    });
  }

  const scoreHistory = sustainability?.historical;
  const latestScore = sustainability?.advisor_brief?.sustainability_score;
  const prevScore = scoreHistory && scoreHistory.length > 1 ? scoreHistory.at(-2)?.sustainability_score : undefined;
  const scoreTrend = computeTrend(latestScore, prevScore);
  if (latestScore !== undefined) {
    out.push({
      key: "sustainability-direction",
      label: "Sustainability score",
      value: `${latestScore.toFixed(0)}/100${scoreTrend && scoreTrend.direction !== "flat" ? ` (${scoreTrend.direction === "up" ? "+" : "-"}${scoreTrend.pct.toFixed(1)}%)` : ""}`,
      status: latestScore >= 60 ? "good" : latestScore >= 45 ? "warn" : "bad",
      detail: scoreTrend
        ? scoreTrend.direction === "up"
          ? "Improving vs. yesterday."
          : scoreTrend.direction === "down"
            ? "Declining vs. yesterday - check top reduction levers."
            : "Flat vs. yesterday."
        : "Relative to 30-day baseline.",
    });
  }

  const totalCostAccuracy = forecast?.targets["total_cost_inr"];
  if (totalCostAccuracy) {
    const mape = totalCostAccuracy.model_metrics.mape;
    const level: GlanceIndicator["status"] = mape <= 5 ? "good" : mape <= 10 ? "warn" : "bad";
    out.push({
      key: "forecast-confidence",
      label: "Forecast confidence (total cost)",
      value: `MAPE ${mape}%`,
      status: level,
      detail:
        level === "good"
          ? "Predictions are typically within 5% of actuals - safe to act on directly."
          : level === "warn"
            ? "Predictions are typically within 5-10% of actuals - treat as a strong signal, sanity-check before big commitments."
            : "Accuracy is weaker than usual for this horizon - treat as directional only.",
    });
  }

  return out;
}
