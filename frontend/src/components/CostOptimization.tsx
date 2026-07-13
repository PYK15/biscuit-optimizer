import { useMemo, useState, type ReactNode } from "react";
import type { RecommendationsResponse, HistoricalResponse } from "../types";
import { Card, PriorityBadge, RefreshingBadge, SourceBadge, InfoTip, FilterSelect, TrendBadge, EmptyState, type InfoCopy } from "./ui";
import { OPTIMIZATION } from "../copy";
import { computeTrend, fmtInr } from "../insights";

function Th({ children, info }: { children: ReactNode; info?: InfoCopy }) {
  return (
    <th className="py-2 pr-3">
      <span className="inline-flex items-center gap-1">
        {children}
        {info && <InfoTip {...info} />}
      </span>
    </th>
  );
}

export default function CostOptimization({
  recommendations,
  historical,
  refreshing = false,
}: {
  recommendations?: RecommendationsResponse;
  historical?: HistoricalResponse;
  refreshing?: boolean;
}) {
  const [dayIdx, setDayIdx] = useState(0);
  const [stageFilter, setStageFilter] = useState("all");

  const stages = useMemo(
    () => Array.from(new Set(recommendations?.days.flatMap((d) => d.stage_recommendations.map((r) => r.stage)) ?? [])),
    [recommendations]
  );

  if (!recommendations) return null;
  const day = recommendations.days[Math.min(dayIdx, recommendations.days.length - 1)];
  const prevDay = dayIdx > 0 ? recommendations.days[dayIdx - 1] : undefined;

  function trendFor(stage: string, currentCost: number) {
    if (prevDay) {
      const prevRec = prevDay.stage_recommendations.find((r) => r.stage === stage);
      return computeTrend(currentCost, prevRec?.predicted_cost_inr);
    }
    const prevActual = historical?.days.at(-1)?.[`cost_${stage}`];
    return computeTrend(currentCost, typeof prevActual === "number" ? prevActual : undefined);
  }

  const rows = day.stage_recommendations
    .filter((r) => stageFilter === "all" || r.stage === stageFilter)
    .slice()
    .sort((a, b) => b.predicted_cost_inr - a.predicted_cost_inr);

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <RefreshingBadge visible={refreshing} />
          <FilterSelect label="Stage" value={stageFilter} options={stages} onChange={setStageFilter} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Scrub forecast day:</span>
          {recommendations.days.map((d, i) => (
            <button
              key={d.date}
              onClick={() => setDayIdx(i)}
              className={`min-h-11 rounded-md px-2.5 text-xs font-medium ${
                i === dayIdx
                  ? "bg-brand-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
              }`}
            >
              {d.date}
            </button>
          ))}
        </div>
      </Card>

      {rows.length === 0 ? (
        <EmptyState title="No stages match this filter" detail="Choose a different stage or select All." />
      ) : (
        <>
          {/* Desktop/tablet: table */}
          <Card title={`Executive Cost Optimization - ${day.date}`} className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <th className="py-2 pr-3">Stage</th>
                    <Th info={OPTIMIZATION.predictedCost}>Predicted Cost</Th>
                    <Th info={OPTIMIZATION.contributionPct}>Contribution %</Th>
                    <Th info={OPTIMIZATION.recommendedMethod}>Recommended Method</Th>
                    <Th info={OPTIMIZATION.priority}>Priority</Th>
                    <Th info={OPTIMIZATION.savingsPct}>Est. Savings</Th>
                    <Th info={OPTIMIZATION.rationale}>Executive Insight</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((rec) => (
                    <tr key={rec.stage} className="border-b border-slate-100 align-top dark:border-slate-700">
                      <td className="py-3 pr-3 font-medium text-slate-800 dark:text-slate-100">{rec.stage}</td>
                      <td className="py-3 pr-3 font-mono">
                        <div className="flex items-center gap-1.5">
                          {fmtInr(rec.predicted_cost_inr)}
                          <TrendBadge trend={trendFor(rec.stage, rec.predicted_cost_inr)} goodDirection="down" />
                        </div>
                      </td>
                      <td className="py-3 pr-3">{rec.cost_contribution_pct.toFixed(1)}%</td>
                      <td className="py-3 pr-3">
                        <div className="font-medium text-brand-700 dark:text-brand-300">{rec.recommended_method}</div>
                        {rec.secondary_methods.length > 0 && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">also: {rec.secondary_methods.join(", ")}</div>
                        )}
                      </td>
                      <td className="py-3 pr-3">
                        <PriorityBadge priority={rec.priority} />
                      </td>
                      <td className="py-3 pr-3 font-mono">
                        ~{rec.estimated_savings_pct}%
                        <div className="text-xs text-slate-500 dark:text-slate-400">{fmtInr(rec.estimated_savings_inr)} (planning estimate)</div>
                      </td>
                      <td className="max-w-sm py-3 pr-3 text-slate-600 dark:text-slate-300">
                        <div className="flex items-start gap-2">
                          <span>{rec.rationale}</span>
                          <SourceBadge source={rec.source} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile: stacked cards instead of a cramped horizontal-scroll table */}
          <div className="space-y-3 md:hidden">
            {rows.map((rec) => (
              <Card key={rec.stage}>
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-slate-800 dark:text-slate-100">{rec.stage}</div>
                  <PriorityBadge priority={rec.priority} />
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Predicted cost</div>
                    <div className="flex items-center gap-1.5 font-mono">
                      {fmtInr(rec.predicted_cost_inr)}
                      <TrendBadge trend={trendFor(rec.stage, rec.predicted_cost_inr)} goodDirection="down" />
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Contribution</div>
                    <div>{rec.cost_contribution_pct.toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Method</div>
                    <div className="font-medium text-brand-700 dark:text-brand-300">{rec.recommended_method}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Est. savings</div>
                    <div className="font-mono">~{rec.estimated_savings_pct}%</div>
                  </div>
                </div>
                <div className="mt-2 flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <span>{rec.rationale}</span>
                  <SourceBadge source={rec.source} />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <Card title="Method of the Day narrative">
        <p className="text-sm text-slate-700 dark:text-slate-300">{day.executive_insight.narrative}</p>
        <p className="mt-2 text-xs italic text-slate-500 dark:text-slate-400">{day.method_of_the_day.sustainability_note}</p>
      </Card>
    </div>
  );
}
