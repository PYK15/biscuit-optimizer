import { useEffect } from "react";

export default function HowThisWorks({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="no-print fixed inset-0 z-50 flex justify-end bg-slate-900/40" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="How This Works"
        data-how-this-works-panel
        className="h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl dark:bg-slate-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">How This Works</h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="min-h-11 min-w-11 rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
          >
            Close
          </button>
        </div>
        <p className="mb-6 text-xs text-slate-400 dark:text-slate-500">A 2-minute plain-language walkthrough of the whole system.</p>

        <section className="mb-6">
          <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">1. What this system does</h3>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            This dashboard predicts tomorrow's biscuit production cost, material usage, waste, and carbon
            emissions before they happen, then recommends what to actually do about them - which
            continuous-improvement method to deploy, on which production stage, and roughly how much it
            should save. It turns a forecast into an action plan, not just a chart.
          </p>
        </section>

        <section className="mb-6">
          <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">2. Where the predictions come from</h3>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Every forecast starts from 30 days of real factory data: material quantities, costs, waste and
            emissions per production stage. A machine learning model (a HistGradientBoostingRegressor, a
            model well-suited to small tabular datasets) is trained on that history to predict each target a
            chosen number of days into the future, with a confidence range - not just a single number.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            <span className="font-medium text-amber-700 dark:text-amber-400">Honest disclosure:</span> the raw 30 days of source
            data were nearly flat day to day, which would make forecasting trivial and the demo pointless. So
            a documented layer of synthetic variability (weekly patterns, a monthly trend, commodity price
            drift, and random noise - all seeded and reproducible) is optionally added on top of the real
            data to create a realistic forecasting problem. This is disclosed here and in the footer of every
            page, rather than hidden, because a demo that quietly smooths over "the data was too flat to be
            interesting" would be misleading about what the model is actually being tested against.
          </p>
        </section>

        <section className="mb-6">
          <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">3. How "which method to use" is decided</h3>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Recommendations are <span className="font-medium">rule-engine-first, AI-explains-second</span>.
            A deterministic set of rules looks at each stage's predicted cost, its dominant cost driver, and
            how large the opportunity is, and from that picks the method, the priority level, and the
            estimated savings - the same inputs always produce the same recommendation. An LLM is then
            optionally used only to write the plain-language rationale explaining that already-made decision
            in natural language. The LLM never chooses the method, priority, or savings number itself - if it
            is unavailable, a templated explanation from the rule layer is shown instead (look for the "Rule"
            vs "LLM" badge next to any rationale text).
          </p>
        </section>

        <section className="mb-6">
          <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">4. How accurate is this, really</h3>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Accuracy is measured with walk-forward backtesting: the model is retrained repeatedly using only
            data up to a given day, then tested on the next day it has never seen, for the last 7 days of
            history. For total production cost, this shows predictions are typically within about 3% of the
            actual value (MAPE ~3.3%), and the model explains about 83% of day-to-day cost variation (R2 ~0.83).
            It is also checked against two simple baselines - "assume tomorrow equals today" and "assume today
            equals the same weekday last week" - so it can't get credit for a trend a trivial guess would also
            catch.
          </p>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-800 dark:text-slate-100">5. What to trust vs. what to double-check</h3>
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Not every number is equally certain. Cost, packaging, moulding, and cooling forecasts backtest
            well and can be relied on directly. Raw material quantities (dough, electricity, gas, packaging)
            are harder to beat against the "same weekday last week" baseline, simply because there's only 30
            days of history and a strong weekly cycle in the data - that's an expected limitation of a small
            sample, not a bug. <span className="font-medium">Water usage (water_kl) is the weakest-modeled
            target</span> - it backtests with a negative R2, meaning a flat average would explain its
            day-to-day pattern about as well as the model currently does. Treat water forecasts as directional
            only, and check the Model Scorecard tab (every row has its own MAE/RMSE/MAPE/R2 with an info
            tooltip) before making a decision that depends on a specific number.
          </p>
        </section>
      </div>
    </div>
  );
}
