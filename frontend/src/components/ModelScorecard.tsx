import type { ReactNode } from "react";
import type { ScorecardResponse } from "../types";
import { Card, RefreshingBadge, InfoTip, type InfoCopy } from "./ui";
import { SCORECARD } from "../copy";

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

export default function ModelScorecard({
  scorecard,
  refreshing = false,
}: {
  scorecard?: ScorecardResponse;
  refreshing?: boolean;
}) {
  if (!scorecard) return null;
  const { targets, synthetic_variability } = scorecard.scorecard;

  return (
    <div className="space-y-4">
      <RefreshingBadge visible={refreshing} />
      {!synthetic_variability && (
        <Card className="border-amber-300 bg-amber-50">
          <p className="text-sm font-medium text-amber-800">
            SYNTHETIC_VARIABILITY is OFF. Source data is near-constant (daily cost std ~= 0); these
            metrics reflect a trivial forecasting task. Enable SYNTHETIC_VARIABILITY for a representative
            demonstration.
          </p>
        </Card>
      )}
      <Card title="Backtest scorecard (walk-forward, one-step-ahead)">
        <p className="mb-3 text-xs text-slate-500">
          With only 30 days of history, seasonal-naive (t-7) is a strong baseline given the injected
          weekly seasonality. The model is judged fairly against both naive baselines rather than a
          cherry-picked one.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-400">
                <th className="py-2 pr-3">Target</th>
                <th className="py-2 pr-3">Unit</th>
                <Th info={SCORECARD.mae}>Model MAE</Th>
                <Th info={SCORECARD.rmse}>Model RMSE</Th>
                <Th info={SCORECARD.mape}>Model MAPE %</Th>
                <Th info={SCORECARD.r2}>Model R2</Th>
                <Th info={SCORECARD.naiveBaseline}>Naive MAE</Th>
                <Th info={SCORECARD.seasonalNaiveBaseline}>Seasonal-Naive MAE</Th>
                <Th info={SCORECARD.beatsBaselines}>Beats baselines</Th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(targets).map(([name, t]) => (
                <tr key={name} className="border-b border-slate-100">
                  <td className="py-2 pr-3 font-medium text-slate-800">{name}</td>
                  <td className="py-2 pr-3 text-slate-500">{t.unit}</td>
                  <td className="py-2 pr-3 font-mono">{t.model.mae}</td>
                  <td className="py-2 pr-3 font-mono">{t.model.rmse}</td>
                  <td className="py-2 pr-3 font-mono">{t.model.mape}</td>
                  <td className="py-2 pr-3 font-mono">{t.model.r2}</td>
                  <td className="py-2 pr-3 font-mono text-slate-500">{t.naive.mae}</td>
                  <td className="py-2 pr-3 font-mono text-slate-500">{t.seasonal_naive.mae}</td>
                  <td className="py-2 pr-3">
                    <span className={t.beats_baselines ? "text-emerald-600" : "text-slate-400"}>
                      {t.beats_baselines ? "Yes" : "No"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
