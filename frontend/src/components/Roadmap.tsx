import { useMemo } from "react";
import type { RecommendationsResponse, SustainabilityResponse, ScorecardResponse } from "../types";
import { Card, PriorityBadge, RefreshingBadge, InfoTip, EmptyState } from "./ui";
import { buildRoadmap, type RoadmapItem } from "../insights";

const QUICK_WIN_METHODS_LABEL = "Kaizen, Energy Optimization, Recipe Optimization, JIT, Supplier Optimization";
const STRATEGIC_METHODS_LABEL = "Predictive Maintenance (TPM), Six Sigma, Lean Manufacturing, OEE Improvement";

function RoadmapCard({ item, rank }: { item: RoadmapItem; rank: number }) {
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
            {rank}
          </span>
          <div>
            <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{item.action}</div>
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Affects: {item.stages.join(", ")}</div>
          </div>
        </div>
        <PriorityBadge priority={item.priority} />
      </div>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        <span className="font-medium text-slate-700 dark:text-slate-200">Why now: </span>
        {item.whyNow}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        <span>
          <span className="font-medium text-emerald-700 dark:text-emerald-400">Expected impact:</span> {item.impact}
        </span>
        <span>
          <span className="font-medium text-slate-700 dark:text-slate-200">Timeframe:</span> {item.timeframe}
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="font-medium text-slate-700 dark:text-slate-200">{item.confidenceLabel}</span>
          <InfoTip
            what="How sure the system is that the signal driving this action is real."
            how={item.confidenceTooltip}
            why="Act on high-confidence items directly; treat low-confidence items as worth investigating rather than committing budget to immediately."
          />
        </span>
      </div>
    </li>
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
  const items = useMemo(
    () => buildRoadmap(recommendations, sustainability, scorecard),
    [recommendations, sustainability, scorecard]
  );

  if (!recommendations) return null;

  const quickWins = items.filter((i) => i.effort === "quick");
  const strategic = items.filter((i) => i.effort === "strategic");

  return (
    <div className="space-y-4">
      <RefreshingBadge visible={refreshing} />

      <Card>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          This ranked action plan is synthesized entirely from the Cost Optimization and Sustainability tabs'
          own data for the currently selected {recommendations.horizon_days}-day forecast horizon - no new
          predictions are made here, only prioritization and grouping of what those two tabs already produced.
        </p>
      </Card>

      <Card title="Ranked action plan">
        {items.length === 0 ? (
          <EmptyState title="No actions to rank yet" detail="Data will populate once the forecast finishes loading." />
        ) : (
          <ol className="space-y-3">
            {items.map((item, i) => (
              <RoadmapCard key={item.key} item={item} rank={i + 1} />
            ))}
          </ol>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="Quick wins - low effort, act now">
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            Methods a shift lead can typically start without capital approval: {QUICK_WIN_METHODS_LABEL}.
          </p>
          {quickWins.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">None ranked for this horizon.</p>
          ) : (
            <ul className="space-y-2">
              {quickWins.map((item) => (
                <li key={item.key} className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-slate-700 dark:bg-emerald-950/30 dark:text-slate-200">
                  {item.action} <span className="text-xs text-slate-500 dark:text-slate-400">({item.timeframe})</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Strategic investments - structural change">
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
            Methods that usually need budget, scheduling, or cross-team coordination: {STRATEGIC_METHODS_LABEL}.
          </p>
          {strategic.length === 0 ? (
            <p className="text-sm text-slate-400 dark:text-slate-500">None ranked for this horizon.</p>
          ) : (
            <ul className="space-y-2">
              {strategic.map((item) => (
                <li key={item.key} className="rounded-md bg-brand-50 px-3 py-2 text-sm text-slate-700 dark:bg-brand-900/30 dark:text-slate-200">
                  {item.action} <span className="text-xs text-slate-500 dark:text-slate-400">({item.timeframe})</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
