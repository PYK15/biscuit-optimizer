import type { ForecastResult, RecommendationsResponse, SustainabilityResponse, HistoricalResponse } from "../types";
import { Card, Stat, PriorityBadge, InfoTip, EmptyState } from "./ui";
import { OVERVIEW } from "../copy";
import { buildGlanceIndicators, computeTrend, fmtInr } from "../insights";

const STATUS_STYLES: Record<string, { chip: string; icon: string; label: string }> = {
  good: { chip: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300", icon: "✓", label: "OK" },
  warn: { chip: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300", icon: "⚠", label: "Watch" },
  bad: { chip: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300", icon: "✕", label: "Attention" },
};

export default function Overview({
  forecast,
  recommendations,
  sustainability,
  historical,
}: {
  forecast?: ForecastResult;
  recommendations?: RecommendationsResponse;
  sustainability?: SustainabilityResponse;
  historical?: HistoricalResponse;
}) {
  const totalCost = forecast?.targets["total_cost_inr"];
  const nextDay = totalCost?.points[0];
  const weeklyTotal = totalCost?.points.slice(0, 7).reduce((s, p) => s + p.expected, 0);
  const motd = recommendations?.days[0]?.method_of_the_day;
  const insight = recommendations?.days[0]?.executive_insight;
  const score = sustainability?.advisor_brief?.sustainability_score;

  const latestHistoricalCost = historical?.days.at(-1)?.total_cost_inr;
  const costTrend = computeTrend(nextDay?.expected, typeof latestHistoricalCost === "number" ? latestHistoricalCost : undefined);
  const prevScore = sustainability?.historical && sustainability.historical.length > 1 ? sustainability.historical.at(-2)?.sustainability_score : undefined;
  const scoreTrend = computeTrend(score, prevScore);

  const glance = buildGlanceIndicators(recommendations, sustainability, historical, forecast);

  if (!forecast && !recommendations && !sustainability) {
    return <EmptyState title="No data yet" detail="Waiting on the first response from the backend." />;
  }

  return (
    <div className="space-y-6">
      {glance.length > 0 && (
        <Card title="Today at a Glance">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {glance.map((g) => {
              const s = STATUS_STYLES[g.status];
              return (
                <div key={g.key} className={`flex items-start gap-2 rounded-lg border p-3 ${s.chip}`}>
                  <span aria-hidden="true" className="mt-0.5 text-base leading-none">{s.icon}</span>
                  <div className="min-w-0">
                    {/* No opacity here (unlike the icon/border) - diluting
                        this text's color with the background pushed contrast
                        just under the 4.5:1 AA threshold (4.48 measured). */}
                    <div className="text-[11px] font-semibold uppercase tracking-wide">
                      {g.label} <span className="sr-only">({s.label})</span>
                    </div>
                    <div className="truncate text-sm font-semibold">{g.value}</div>
                    <div className="text-xs opacity-90">{g.detail}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <Stat
            label="Next-day total cost"
            value={nextDay ? fmtInr(nextDay.expected) : "-"}
            sub={nextDay ? `Range: ${fmtInr(nextDay.low)} - ${fmtInr(nextDay.high)}` : undefined}
            info={OVERVIEW.nextDayCost}
            trend={costTrend}
            trendGoodDirection="down"
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
            trend={scoreTrend}
            trendGoodDirection="up"
          />
        </Card>
      </div>

      {motd && (
        <Card
          title="Method of the Day"
          titleExtra={<InfoTip {...OVERVIEW.methodOfTheDay} />}
          className="border-brand-200 bg-brand-50/40 dark:border-brand-800 dark:bg-brand-900/20"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                {motd.stage} &rarr; {motd.recommended_method}
              </div>
              <p className="mt-1 max-w-3xl text-sm text-slate-600 dark:text-slate-300">{insight?.narrative ?? motd.rationale}</p>
            </div>
            <div className="flex items-center gap-3">
              <PriorityBadge priority={motd.priority} />
              <span className="rounded-md bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                Save ~{fmtInr(motd.expected_savings_inr)}
              </span>
            </div>
          </div>
          <p className="mt-3 text-xs italic text-slate-500 dark:text-slate-400">{motd.sustainability_note}</p>
        </Card>
      )}
    </div>
  );
}
