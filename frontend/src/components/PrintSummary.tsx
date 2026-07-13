import type { ForecastResult, RecommendationsResponse, SustainabilityResponse, ScorecardResponse, HistoricalResponse } from "../types";
import { buildRoadmap, buildGlanceIndicators, fmtInr } from "../insights";

/**
 * Always rendered in the DOM (hidden on screen, shown only under
 * `@media print` via the `.print-only` class in index.css) so printing
 * produces a clean one-page shift-handoff summary regardless of which tab
 * is currently active on screen. Pure synthesis of already-fetched data -
 * same source (insights.ts) as the Overview glance strip and Roadmap tab.
 */
export default function PrintSummary({
  horizon,
  forecast,
  recommendations,
  sustainability,
  scorecard,
  historical,
}: {
  horizon: number;
  forecast?: ForecastResult;
  recommendations?: RecommendationsResponse;
  sustainability?: SustainabilityResponse;
  scorecard?: ScorecardResponse;
  historical?: HistoricalResponse;
}) {
  const glance = buildGlanceIndicators(recommendations, sustainability, historical, forecast);
  const topRoadmap = buildRoadmap(recommendations, sustainability, scorecard).slice(0, 5);
  const nextDay = forecast?.targets["total_cost_inr"]?.points[0];
  const motd = recommendations?.days[0]?.method_of_the_day;

  return (
    <div className="print-only p-8 text-black">
      <h1 className="text-2xl font-bold">Biscuit Ops - Shift Handoff Summary</h1>
      <p className="text-xs text-gray-500">
        Generated {new Date().toLocaleString()} - {horizon}-day forecast horizon
      </p>

      <h2 className="mt-6 text-base font-semibold">Today at a Glance</h2>
      <ul className="mt-2 space-y-1 text-sm">
        {glance.map((g) => (
          <li key={g.key}>
            <span className="font-medium">{g.label}:</span> {g.value} - {g.detail}
          </li>
        ))}
      </ul>

      <h2 className="mt-6 text-base font-semibold">Headline Numbers</h2>
      <table className="mt-2 w-full border-collapse text-sm">
        <tbody>
          <tr>
            <td className="border border-gray-300 p-2 font-medium">Next-day total cost</td>
            <td className="border border-gray-300 p-2">{nextDay ? fmtInr(nextDay.expected) : "-"}</td>
          </tr>
          <tr>
            <td className="border border-gray-300 p-2 font-medium">Sustainability score</td>
            <td className="border border-gray-300 p-2">
              {sustainability ? `${sustainability.advisor_brief.sustainability_score.toFixed(0)} / 100` : "-"}
            </td>
          </tr>
          <tr>
            <td className="border border-gray-300 p-2 font-medium">Method of the Day</td>
            <td className="border border-gray-300 p-2">
              {motd ? `${motd.stage} -> ${motd.recommended_method} (save ~${fmtInr(motd.expected_savings_inr)})` : "-"}
            </td>
          </tr>
        </tbody>
      </table>

      <h2 className="mt-6 text-base font-semibold">Top {topRoadmap.length} Roadmap Actions</h2>
      <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
        {topRoadmap.map((item) => (
          <li key={item.key}>
            <span className="font-medium">{item.action}</span> ({item.priority}, {item.timeframe}) - {item.whyNow} Expected impact: {item.impact}.
          </li>
        ))}
      </ol>

      <p className="mt-6 text-[10px] text-gray-400">
        Rule-based recommendations synthesized from ML forecasts and a deterministic rule layer - see the "How This
        Works" panel in the app for the full methodology.
      </p>
    </div>
  );
}
