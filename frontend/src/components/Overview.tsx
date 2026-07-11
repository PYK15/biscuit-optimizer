import type { ForecastResult, RecommendationsResponse, SustainabilityResponse } from "../types";
import { Card, Stat, PriorityBadge, InfoTip } from "./ui";
import { OVERVIEW } from "../copy";

function fmtInr(n: number) {
  return `Rs ${n.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export default function Overview({
  forecast,
  recommendations,
  sustainability,
}: {
  forecast?: ForecastResult;
  recommendations?: RecommendationsResponse;
  sustainability?: SustainabilityResponse;
}) {
  const totalCost = forecast?.targets["total_cost_inr"];
  const nextDay = totalCost?.points[0];
  const weeklyTotal = totalCost?.points.slice(0, 7).reduce((s, p) => s + p.expected, 0);
  const motd = recommendations?.days[0]?.method_of_the_day;
  const insight = recommendations?.days[0]?.executive_insight;
  const score = sustainability?.advisor_brief?.sustainability_score;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <Stat
            label="Next-day total cost"
            value={nextDay ? fmtInr(nextDay.expected) : "-"}
            sub={nextDay ? `Range: ${fmtInr(nextDay.low)} - ${fmtInr(nextDay.high)}` : undefined}
            info={OVERVIEW.nextDayCost}
          />
        </Card>
        <Card>
          <Stat
            label="Forecasted weekly cost"
            value={weeklyTotal ? fmtInr(weeklyTotal) : "-"}
            sub="Sum of next 7 forecast days"
            info={OVERVIEW.weeklyCost}
          />
        </Card>
        <Card>
          <Stat
            label="Model accuracy (total cost)"
            value={totalCost ? `MAPE ${totalCost.model_metrics.mape}%` : "-"}
            sub={totalCost ? `R2 ${totalCost.model_metrics.r2} vs naive/seasonal baselines` : undefined}
            info={OVERVIEW.modelAccuracy}
          />
        </Card>
        <Card>
          <Stat
            label="Sustainability score"
            value={score !== undefined ? `${score.toFixed(0)} / 100` : "-"}
            sub="Relative to 30-day baseline"
            info={OVERVIEW.sustainabilityScore}
          />
        </Card>
      </div>

      {motd && (
        <Card
          title="Method of the Day"
          titleExtra={<InfoTip {...OVERVIEW.methodOfTheDay} />}
          className="border-indigo-200 bg-indigo-50/40"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-slate-800">
                {motd.stage} &rarr; {motd.recommended_method}
              </div>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">{insight?.narrative ?? motd.rationale}</p>
            </div>
            <div className="flex items-center gap-3">
              <PriorityBadge priority={motd.priority} />
              <span className="rounded-md bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
                Save ~{fmtInr(motd.expected_savings_inr)}
              </span>
            </div>
          </div>
          <p className="mt-3 text-xs italic text-slate-500">{motd.sustainability_note}</p>
        </Card>
      )}
    </div>
  );
}
