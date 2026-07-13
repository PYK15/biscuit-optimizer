import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import type {
  ForecastResult,
  RecommendationsResponse,
  SustainabilityResponse,
  ScorecardResponse,
  HistoricalResponse,
} from "./types";
import Nav, { type TabId } from "./components/Nav";
import Footer from "./components/Footer";
import Overview from "./components/Overview";
import ForecastView from "./components/ForecastView";
import CostOptimization from "./components/CostOptimization";
import Sustainability from "./components/Sustainability";
import ModelScorecard from "./components/ModelScorecard";
import Roadmap from "./components/Roadmap";
import HowThisWorks from "./components/HowThisWorks";
import PrintSummary from "./components/PrintSummary";
import { HorizonControl, Loading, ErrorBox, IconButton } from "./components/ui";
import { useDarkMode } from "./hooks/useDarkMode";

const TAB_SUBTITLES: Record<TabId, string> = {
  overview: "Today's headline numbers and the single most impactful action to take right now.",
  forecast: "What we expect to happen next, and how sure we are about it.",
  optimization: "Where cost is predicted to go by production stage, and what to do about it.",
  sustainability: "Emissions, waste and water performance, and the levers that move the score.",
  scorecard: "How accurate these forecasts actually are, proven on data the model never saw.",
  roadmap: "A single prioritized action plan, built from the Cost Optimization and Sustainability tabs.",
};

export default function App() {
  const [tab, setTab] = useState<TabId>("overview");
  const [horizon, setHorizon] = useState(7);
  const [howThisWorksOpen, setHowThisWorksOpen] = useState(false);
  const [dark, toggleDark] = useDarkMode();
  const [retryKey, setRetryKey] = useState(0);

  const [historical, setHistorical] = useState<HistoricalResponse>();
  const [forecast, setForecast] = useState<ForecastResult>();
  const [recommendations, setRecommendations] = useState<RecommendationsResponse>();
  const [sustainability, setSustainability] = useState<SustainabilityResponse>();
  const [scorecard, setScorecard] = useState<ScorecardResponse>();
  const [error, setError] = useState<string>();
  // initialLoading blocks the whole page only until the first successful
  // load. Subsequent horizon changes use `refreshing` instead, so tab
  // content (charts, tables) stays visible with an inline indicator rather
  // than the entire page blanking out on every horizon change.
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    api.historical().then(setHistorical).catch((e) => setError(String(e)));
  }, [retryKey]);

  useEffect(() => {
    setError(undefined);
    if (hasLoadedOnce.current) {
      setRefreshing(true);
    } else {
      setInitialLoading(true);
    }
    Promise.all([
      api.forecast(horizon).then((r) => setForecast(r.forecast)),
      api.recommendations(horizon).then(setRecommendations),
      api.sustainability(horizon).then(setSustainability),
      api.scorecard(horizon).then(setScorecard),
    ])
      .catch((e) => setError(String(e)))
      .finally(() => {
        hasLoadedOnce.current = true;
        setInitialLoading(false);
        setRefreshing(false);
      });
  }, [horizon, retryKey]);

  const footer = recommendations?.footer ?? historical?.footer;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
      <header className="no-print border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800 sm:px-6 sm:py-4">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg">
                Biscuit Cost-Optimization &amp; Sustainability
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Predictive cost, waste &amp; emissions system for factory operations review
              </p>
            </div>
            <div className="flex items-center gap-2 lg:hidden">
              <IconButton onClick={() => window.print()} label="Print summary" data-print-button>
                <span aria-hidden="true">&#128424;</span>
              </IconButton>
              <IconButton onClick={toggleDark} label="Toggle dark mode" active={dark} data-dark-mode-toggle>
                <span aria-hidden="true">{dark ? "☀" : "☽"}</span>
              </IconButton>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <HorizonControl horizon={horizon} onChange={setHorizon} />
            <button
              onClick={() => setHowThisWorksOpen(true)}
              data-how-this-works-trigger
              className="min-h-11 rounded-md border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 dark:border-brand-800 dark:bg-brand-900/30 dark:text-brand-300 dark:hover:bg-brand-900/50"
            >
              How This Works
            </button>
            <div className="hidden items-center gap-2 lg:flex">
              <IconButton onClick={() => window.print()} label="Print summary" data-print-button>
                <span aria-hidden="true">&#128424;</span>
              </IconButton>
              <IconButton onClick={toggleDark} label="Toggle dark mode" active={dark} data-dark-mode-toggle>
                <span aria-hidden="true">{dark ? "☀" : "☽"}</span>
              </IconButton>
            </div>
          </div>
        </div>
      </header>

      <Nav active={tab} onChange={setTab} />

      <main className="no-print mx-auto max-w-7xl px-4 py-6 sm:px-6">
        {error && <ErrorBox message={error} onRetry={() => setRetryKey((k) => k + 1)} />}
        {initialLoading && !error && <Loading label="Training models and generating recommendations..." />}
        {!initialLoading && !error && (
          <div key={tab} className="tab-panel">
            <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">{TAB_SUBTITLES[tab]}</p>
            {tab === "overview" && (
              <Overview forecast={forecast} recommendations={recommendations} sustainability={sustainability} historical={historical} />
            )}
            {tab === "forecast" && <ForecastView forecast={forecast} historical={historical} refreshing={refreshing} />}
            {tab === "optimization" && <CostOptimization recommendations={recommendations} historical={historical} refreshing={refreshing} />}
            {tab === "sustainability" && <Sustainability sustainability={sustainability} refreshing={refreshing} />}
            {tab === "scorecard" && <ModelScorecard scorecard={scorecard} refreshing={refreshing} />}
            {tab === "roadmap" && (
              <Roadmap recommendations={recommendations} sustainability={sustainability} scorecard={scorecard} refreshing={refreshing} />
            )}
          </div>
        )}
      </main>

      <Footer footer={footer} onLearnMore={() => setHowThisWorksOpen(true)} />
      <HowThisWorks open={howThisWorksOpen} onClose={() => setHowThisWorksOpen(false)} />

      <PrintSummary
        horizon={horizon}
        forecast={forecast}
        recommendations={recommendations}
        sustainability={sustainability}
        scorecard={scorecard}
        historical={historical}
      />
    </div>
  );
}
