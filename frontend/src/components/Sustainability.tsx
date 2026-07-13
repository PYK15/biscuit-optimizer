import { useMemo, useState } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { SustainabilityResponse } from "../types";
import { Card, RefreshingBadge, Stat, InfoTip, FilterSelect, EmptyState } from "./ui";
import { SUSTAINABILITY } from "../copy";

function scoreColor(score: number) {
  if (score >= 60) return "#059669";
  if (score >= 45) return "#d97706";
  return "#dc2626";
}

export default function Sustainability({
  sustainability,
  refreshing = false,
}: {
  sustainability?: SustainabilityResponse;
  refreshing?: boolean;
}) {
  const [driverFilter, setDriverFilter] = useState("all");

  const drivers = useMemo(() => Array.from(new Set(sustainability?.top_levers.map((l) => l.driver) ?? [])), [sustainability]);

  if (!sustainability) return null;
  const { historical, forecast, top_levers, advisor_brief } = sustainability;
  const latestHistorical = historical.at(-1);
  const filteredLevers = top_levers.filter((l) => driverFilter === "all" || l.driver === driverFilter);

  const chartData = [
    ...historical.map((d) => ({
      date: d.Date.slice(0, 10),
      scope1: d.scope1_kgco2e,
      scope2: d.scope2_kgco2e,
      scope3: d.scope3_kgco2e,
      score: d.sustainability_score,
    })),
    ...forecast.map((d) => ({
      date: d.date,
      scope1_f: d.scope1_kgco2e,
      scope2_f: d.scope2_kgco2e,
      scope3_f: d.scope3_kgco2e,
      score_f: d.sustainability_score,
    })),
  ];
  const splitDate = historical.at(-1)?.Date?.slice(0, 10);

  return (
    <div className="space-y-4">
      <RefreshingBadge visible={refreshing} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <div className="flex items-center gap-4">
            <div
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 text-xl font-bold"
              style={{ borderColor: scoreColor(advisor_brief.sustainability_score), color: scoreColor(advisor_brief.sustainability_score) }}
            >
              {advisor_brief.sustainability_score.toFixed(0)}
            </div>
            <div>
              <div className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Sustainability score
                <InfoTip {...SUSTAINABILITY.sustainabilityScore} />
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">relative to 30-day baseline mean (rule-based index, not a raw measurement)</div>
            </div>
          </div>
        </Card>
        <Card>
          <Stat
            label="Non-renewable resource index"
            value={`${(advisor_brief.non_renewable_index * 100).toFixed(0)}%`}
            sub="Gas + fossil-grid electricity + virgin packaging share"
            info={SUSTAINABILITY.nonRenewableIndex}
          />
        </Card>
        <Card>
          <Stat
            label="Total emissions (latest day)"
            value={`${advisor_brief.total_kgco2e.toFixed(0)} kgCO2e`}
            sub="Scope 1 + 2 + 3"
            info={SUSTAINABILITY.scope1}
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card>
          <Stat
            label="Total waste (latest recorded day)"
            value={latestHistorical ? `${latestHistorical.total_waste_kg.toFixed(1)} kg` : "-"}
            sub="Ingredient + biscuit + packaging waste, historical actuals only"
            info={SUSTAINABILITY.waste}
          />
        </Card>
        <Card>
          <Stat
            label="Water use (latest recorded day)"
            value={latestHistorical ? `${latestHistorical.water_kl.toFixed(2)} kl` : "-"}
            sub="Weaker-modeled target - treat as directional, see info"
            info={SUSTAINABILITY.water}
          />
        </Card>
      </div>

      <Card
        title="Scope 1/2/3 emissions - historical & forecast (kgCO2e)"
        titleExtra={
          <span className="inline-flex items-center gap-3 text-[10px] normal-case tracking-normal text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1">Scope 1 <InfoTip {...SUSTAINABILITY.scope1} /></span>
            <span className="inline-flex items-center gap-1">Scope 2 <InfoTip {...SUSTAINABILITY.scope2} /></span>
            <span className="inline-flex items-center gap-1">Scope 3 <InfoTip {...SUSTAINABILITY.scope3} /></span>
          </span>
        }
      >
        <ResponsiveContainer width="100%" height={340} className="overflow-hidden">
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 28 }}>
            {/* See ForecastView.tsx for why these read from CSS custom
                properties (index.css --chart-*) instead of hardcoded hex -
                Recharts' axis/grid/tooltip/legend are plain SVG/inline-style
                props that Tailwind's dark: variant can't reach. */}
            <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: "var(--chart-axis-text)" }}
              stroke="var(--chart-axis-text)"
              interval="preserveStartEnd"
              minTickGap={24}
              angle={-35}
              textAnchor="end"
              height={40}
            />
            <YAxis tick={{ fontSize: 10, fill: "var(--chart-axis-text)" }} stroke="var(--chart-axis-text)" width={40} />
            <Tooltip
              contentStyle={{ backgroundColor: "var(--chart-tooltip-bg)", border: "1px solid var(--chart-tooltip-border)", borderRadius: 8 }}
              labelStyle={{ color: "var(--chart-tooltip-text)" }}
              itemStyle={{ color: "var(--chart-tooltip-text)" }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11 }}
              formatter={(value) => <span style={{ color: "var(--chart-legend-text)" }}>{value}</span>}
            />
            {splitDate && <ReferenceLine x={splitDate} stroke="var(--chart-reference-line)" strokeDasharray="4 4" />}
            <Bar dataKey="scope1" stackId="hist" name="Scope 1 (gas)" fill="#f97316" />
            <Bar dataKey="scope2" stackId="hist" name="Scope 2 (electricity)" fill="#0ea5e9" />
            <Bar dataKey="scope3" stackId="hist" name="Scope 3 (upstream)" fill="#a3a3a3" />
            <Bar dataKey="scope1_f" stackId="fcst" name="Scope 1 (forecast)" fill="#fdba74" />
            <Bar dataKey="scope2_f" stackId="fcst" name="Scope 2 (forecast)" fill="#7dd3fc" />
            <Bar dataKey="scope3_f" stackId="fcst" name="Scope 3 (forecast)" fill="#d4d4d4" />
            <Line type="monotone" dataKey="score" name="Sustainability score" stroke="#4f46e5" yAxisId={0} dot={false} hide />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card
          title="Top reduction levers"
          titleExtra={<InfoTip {...SUSTAINABILITY.reductionLever} />}
        >
          <div className="mb-3">
            <FilterSelect label="Driver" value={driverFilter} options={drivers} onChange={setDriverFilter} />
          </div>
          {filteredLevers.length === 0 ? (
            <EmptyState title="No levers match this filter" detail="Choose a different driver or select All." />
          ) : (
            <ul className="space-y-3">
              {filteredLevers.map((l) => (
                <li key={l.driver} className="rounded-lg bg-slate-50 p-3 dark:bg-slate-700/50">
                  <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{l.description}</div>
                  <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Suggested method: <span className="font-medium text-brand-700 dark:text-brand-300">{l.suggested_method}</span> &middot;{" "}
                    {l.relative_contribution}% of score gap
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Sustainability Advisor">
          <p className="text-sm text-slate-700 dark:text-slate-300">{advisor_brief.narrative}</p>
          <p className="mt-2 text-xs italic text-slate-500 dark:text-slate-400">{advisor_brief.sdg_note}</p>
          <div className="mt-3 text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
            source: {advisor_brief.source === "rule+llm" ? "rule layer + LLM narrative" : "rule layer (templated fallback)"}
          </div>
        </Card>
      </div>
    </div>
  );
}
