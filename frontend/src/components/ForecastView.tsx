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
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
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
                className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                  k === activeKey ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {k}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <RefreshingBadge visible={refreshing} />
            {tf && (
              <div className="flex items-center gap-1 text-xs text-slate-500">
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
          <span className="inline-flex items-center gap-3 text-[10px] normal-case tracking-normal text-slate-400">
            <span className="inline-flex items-center gap-1">
              prediction band <InfoTip {...FORECAST.predictionBand} />
            </span>
            <span className="inline-flex items-center gap-1">
              train | forecast split <InfoTip {...FORECAST.splitMarker} />
            </span>
          </span>
        }
        className="relative"
      >
        <ChartLoadingOverlay visible={refreshing} />
        <ResponsiveContainer width="100%" height={380}>
          <ComposedChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eef0f4" />
            <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={20} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            {splitDate && <ReferenceLine x={splitDate} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: "train | forecast", fontSize: 10, position: "insideTopRight" }} />}
            <Area dataKey={(d: any) => (d.low !== undefined && d.high !== undefined ? [d.low, d.high] : undefined)} name="Prediction interval" stroke="none" fill="#818cf8" fillOpacity={0.18} />
            <Line type="monotone" dataKey="actual" name="Actual" stroke="#0f172a" dot={false} strokeWidth={2} connectNulls />
            <Line type="monotone" dataKey="expected" name="Forecast" stroke="#4f46e5" strokeDasharray="4 2" dot={false} strokeWidth={2} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
