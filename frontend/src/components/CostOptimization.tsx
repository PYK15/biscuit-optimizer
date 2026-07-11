import { useState, type ReactNode } from "react";
import type { RecommendationsResponse } from "../types";
import { Card, PriorityBadge, RefreshingBadge, SourceBadge, InfoTip, type InfoCopy } from "./ui";
import { OPTIMIZATION } from "../copy";

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

function fmtInr(n: number) {
  return `Rs ${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function CostOptimization({
  recommendations,
  refreshing = false,
}: {
  recommendations?: RecommendationsResponse;
  refreshing?: boolean;
}) {
  const [dayIdx, setDayIdx] = useState(0);
  if (!recommendations) return null;
  const day = recommendations.days[Math.min(dayIdx, recommendations.days.length - 1)];

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-2">
          <RefreshingBadge visible={refreshing} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-slate-600">Scrub forecast day:</span>
          {recommendations.days.map((d, i) => (
            <button
              key={d.date}
              onClick={() => setDayIdx(i)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                i === dayIdx ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {d.date}
            </button>
          ))}
        </div>
      </Card>

      <Card title={`Executive Cost Optimization - ${day.date}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-400">
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
              {day.stage_recommendations
                .slice()
                .sort((a, b) => b.predicted_cost_inr - a.predicted_cost_inr)
                .map((rec) => (
                  <tr key={rec.stage} className="border-b border-slate-100 align-top">
                    <td className="py-3 pr-3 font-medium text-slate-800">{rec.stage}</td>
                    <td className="py-3 pr-3 font-mono">{fmtInr(rec.predicted_cost_inr)}</td>
                    <td className="py-3 pr-3">{rec.cost_contribution_pct.toFixed(1)}%</td>
                    <td className="py-3 pr-3">
                      <div className="font-medium text-indigo-700">{rec.recommended_method}</div>
                      {rec.secondary_methods.length > 0 && (
                        <div className="text-xs text-slate-400">also: {rec.secondary_methods.join(", ")}</div>
                      )}
                    </td>
                    <td className="py-3 pr-3">
                      <PriorityBadge priority={rec.priority} />
                    </td>
                    <td className="py-3 pr-3 font-mono">
                      ~{rec.estimated_savings_pct}%<div className="text-xs text-slate-400">{fmtInr(rec.estimated_savings_inr)} (planning estimate)</div>
                    </td>
                    <td className="max-w-sm py-3 pr-3 text-slate-600">
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

      <Card title="Method of the Day narrative">
        <p className="text-sm text-slate-700">{day.executive_insight.narrative}</p>
        <p className="mt-2 text-xs italic text-slate-500">{day.method_of_the_day.sustainability_note}</p>
      </Card>
    </div>
  );
}
