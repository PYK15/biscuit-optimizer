import { useMemo, useState } from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { ForecastResult, HistoricalResponse } from "../types";
import { Card, ChartLoadingOverlay, RefreshingBadge, InfoTip } from "./ui";
import { FORECAST } from "../copy";

export default function ForecastView({
  forecast,
  historical,
  refreshing = false,
}: {
  forecast?: ForecastResult;
  historical?: HistoricalResponse;
  refreshing?: boolean;
}) {
  const targetKeys = forecast ? Object.keys(forecast.targets) : [];
  const [selected, setSelected] = useState(targetKeys[0] ?? "total_cost_inr");
  const activeKey = targetKeys.includes(selected) ? selected : targetKeys[0];

  const chartData = useMemo(() => {
    if (!forecast || !historical || !activeKey) return [];
    const tf = forecast.targets[activeKey];
    const histRows = historical.days.map((d) => ({
      date: String(d.Date).slice(0, 10),
      actual: typeof d[activeKey] === "number" ? (d[activeKey] as number) : undefined,
    }));
    const forecastRows = tf.points.map((p) => ({
      date: p.date,
      low: p.low,
      expected: p.expected,
      high: p.high,
    }));
    const merged = new Map<string, any>();
    histRows.forEach((r) => merged.set(r.date, { ...merged.get(r.date), ...r }));
    forecastRows.forEach((r) => merged.set(r.date, { ...merged.get(r.date), ...r }));
    return Array.from(merged.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [forecast, historical, activeKey]);

  const splitDate = historical?.days.at(-1)?.Date?.toString().slice(0, 10);
  const tf = forecast?.targets[activeKey];

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            <span>Chart target</span>
            <InfoTip {...FORECAST.chartTargetPicker} />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {targetKeys.map((k) => (
              <button
                key={k}
                onClick={() => setSelected(k)}
                className={`min-h-11 rounded-md px-2.5 text-xs font-medium ${
                  k === activeKey
                    ? "bg-brand-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                }`}
              >
                {k}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <RefreshingBadge visible={refreshing} />
            {tf && (
              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <span>
                  Unit: <span className="font-medium">{tf.unit}</span> &middot; MAPE {tf.model_metrics.mape}% &middot; R2{" "}
                  {tf.model_metrics.r2} &middot; beats baselines: {tf.beats_baselines ? "yes" : "no"}
                </span>
                <InfoTip {...FORECAST.accuracyReadout} />
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card
        title={`${activeKey} - actual vs forecast (with 10-90% interval)`}
        titleExtra={
          <span className="inline-flex items-center gap-3 text-[10px] normal-case tracking-normal text-slate-400 dark:text-slate-500">
            <span className="inline-flex items-center gap-1">
              prediction band <InfoTip {...FORECAST.predictionBand} />
            </span>
            <span className="inline-flex items-center gap-1">
              train | forecast split <InfoTip {...FORECAST.splitMarker} />
            </span>
          </span>
        }
        className="relative overflow-hidden"
      >
        <ChartLoadingOverlay visible={refreshing} />
        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 28 }}>
            {/* Chart colors are read from the CSS custom properties defined
                in index.css (--chart-*), which flip automatically with the
                .dark class - Tailwind's dark: utilities can't reach these
                plain SVG/style props, so they'd otherwise stay hardcoded to
                light-mode colors (this previously made the "Actual" line,
                stroke #0f172a, nearly invisible against the dark-mode card
                background #1e293b). */}
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
            {splitDate && (
              <ReferenceLine
                x={splitDate}
                stroke="var(--chart-reference-line)"
                strokeDasharray="4 4"
                label={{ value: "train | forecast", fontSize: 10, position: "insideTopRight", fill: "var(--chart-axis-text)" }}
              />
            )}
            <Area
              dataKey={(d: any) => (d.low !== undefined && d.high !== undefined ? [d.low, d.high] : undefined)}
              name="Prediction interval"
              stroke="none"
              fill="var(--chart-band-fill)"
            />
            <Line type="monotone" dataKey="actual" name="Actual" stroke="var(--chart-actual-line)" dot={false} strokeWidth={2} connectNulls />
            <Line type="monotone" dataKey="expected" name="Forecast" stroke="var(--chart-forecast-line)" strokeDasharray="4 2" dot={false} strokeWidth={2} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
