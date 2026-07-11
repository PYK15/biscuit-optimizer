import { useMemo } from "react";
import type { RecommendationsResponse, SustainabilityResponse, ScorecardResponse } from "../types";
import { Card, PriorityBadge, RefreshingBadge, InfoTip, FadeInItem } from "./ui";
import { useStaggeredReveal } from "../hooks/useStaggeredReveal";

function fmtInr(n: number) {
  return `Rs ${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

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

interface RoadmapItem {
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

function confidenceFor(scorecard: ScorecardResponse | undefined, targetKey: string): { label: string; tooltip: string } {
  const entry = scorecard?.scorecard.targets[targetKey];
  if (!entry) {
    return { label: "Confidence: n/a", tooltip: "No backtested accuracy is available for this specific target yet." };
  }
  const mape = entry.model.mape;
  let label: string;
  if (mape <= 5) label = "High confidence";
  else if (mape <= 10) label = "Medium confidence";
  else label = "Low confidence";
  const beatsNote = entry.beats_baselines
    ? "and beat both the naive and seasonal-naive baselines in backtesting"
    : "though it did not beat the seasonal-naive baseline in backtesting - a strong weekly pattern makes that a tough bar with only 30 days of history";
  return {
    label: `${label} (MAPE ${mape}%)`,
    tooltip: `Confidence is tied to this system's own walk-forward backtest for "${targetKey}": the model's predictions were typically within ${mape}% of actual values on held-out days, ${beatsNote}.`,
  };
}

function buildRoadmap(
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

function RoadmapCard({ item, rank }: { item: RoadmapItem; rank: number }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
            {rank}
          </span>
          <div>
            <div className="text-sm font-semibold text-slate-800">{item.action}</div>
            <div className="mt-0.5 text-xs text-slate-500">Affects: {item.stages.join(", ")}</div>
          </div>
        </div>
        <PriorityBadge priority={item.priority} />
      </div>
      <p className="mt-2 text-sm text-slate-600">
        <span className="font-medium text-slate-700">Why now: </span>
        {item.whyNow}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        <span>
          <span className="font-medium text-emerald-700">Expected impact:</span> {item.impact}
        </span>
        <span>
          <span className="font-medium text-slate-700">Timeframe:</span> {item.timeframe}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="font-medium text-slate-700">{item.confidenceLabel}</span>
          <InfoTip
            what="How sure the system is that the signal driving this action is real."
            how={item.confidenceTooltip}
            why="Act on high-confidence items directly; treat low-confidence items as worth investigating rather than committing budget to immediately."
          />
        </span>
      </div>
    </div>
  );
}

export default function Roadmap({
  recommendations,
  sustainability,
  scorecard,
  refreshing = false,
}: {
  recommendations?: RecommendationsResponse;
  sustainability?: SustainabilityResponse;
  scorecard?: ScorecardResponse;
  refreshing?: boolean;
}) {
  // /recommendations already returns every day of the horizon in one
  // response (see api/main.py) - revealedDays only paces how many of those
  // already-fetched days feed into the roadmap synthesis below, so the
  // ranked list fills in (and re-ranks as later, possibly higher-priority
  // days come into view) progressively instead of appearing all at once.
  const revealedDays = useStaggeredReveal(recommendations?.horizon_days);
  const visibleRecommendations = useMemo(
    () => (recommendations ? { ...recommendations, days: recommendations.days.slice(0, revealedDays) } : undefined),
    [recommendations, revealedDays]
  );

  const items = useMemo(
    () => buildRoadmap(visibleRecommendations, sustainability, scorecard),
    [visibleRecommendations, sustainability, scorecard]
  );

  if (!recommendations) return null;

  const quickWins = items.filter((i) => i.effort === "quick");
  const strategic = items.filter((i) => i.effort === "strategic");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <RefreshingBadge visible={refreshing} />
        {revealedDays < recommendations.horizon_days && (
          <span
            data-reveal-progress="roadmap"
            data-revealed={revealedDays}
            data-target={recommendations.horizon_days}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-500"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-400" />
            Revealing new forecast days... ({revealedDays}/{recommendations.horizon_days})
          </span>
        )}
      </div>

      <Card>
        <p className="text-sm text-slate-600">
          This ranked action plan is synthesized entirely from the Cost Optimization and Sustainability tabs'
          own data for the currently selected {recommendations.horizon_days}-day forecast horizon - no new
          predictions are made here, only prioritization and grouping of what those two tabs already produced.
        </p>
      </Card>

      <Card title="Ranked action plan">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500">No actions to rank yet.</p>
        ) : (
          <ol className="space-y-3">
            {items.map((item, i) => (
              <FadeInItem key={item.key} as="li">
                <RoadmapCard item={item} rank={i + 1} />
              </FadeInItem>
            ))}
          </ol>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Quick wins - low effort, act now">
          <p className="mb-3 text-xs text-slate-500">
            Methods a shift lead can typically start without capital approval: Kaizen, Energy Optimization,
            Recipe Optimization, JIT, Supplier Optimization.
          </p>
          {quickWins.length === 0 ? (
            <p className="text-sm text-slate-400">None ranked for this horizon.</p>
          ) : (
            <ul className="space-y-2">
              {quickWins.map((item) => (
                <li key={item.key} className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-slate-700">
                  {item.action} <span className="text-xs text-slate-500">({item.timeframe})</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Strategic investments - structural change">
          <p className="mb-3 text-xs text-slate-500">
            Methods that usually need budget, scheduling, or cross-team coordination: Predictive Maintenance
            (TPM), Six Sigma, Lean Manufacturing, OEE Improvement.
          </p>
          {strategic.length === 0 ? (
            <p className="text-sm text-slate-400">None ranked for this horizon.</p>
          ) : (
            <ul className="space-y-2">
              {strategic.map((item) => (
                <li key={item.key} className="rounded-md bg-indigo-50 px-3 py-2 text-sm text-slate-700">
                  {item.action} <span className="text-xs text-slate-500">({item.timeframe})</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
