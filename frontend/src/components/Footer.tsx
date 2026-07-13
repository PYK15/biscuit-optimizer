import type { Footer as FooterType } from "../types";

export default function Footer({ footer, onLearnMore }: { footer?: FooterType; onLearnMore?: () => void }) {
  if (!footer) return null;
  return (
    <footer className="no-print mt-10 border-t border-slate-200 bg-white px-4 py-4 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 sm:px-6">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
        <span>Data source: {footer.data_source}</span>
        <span>
          Synthetic variability:{" "}
          {/* emerald-700/amber-700, not -600: at this 12px footer size,
              -600 measured 3.65:1 against white, under the 4.5:1 AA floor. */}
          <span className={footer.synthetic_variability ? "font-medium text-emerald-700 dark:text-emerald-400" : "font-medium text-amber-700 dark:text-amber-400"}>
            {footer.synthetic_variability ? "ON (demo demand drivers active)" : "OFF - source data is near-constant, forecast is trivial"}
          </span>
        </span>
        <span>
          LLM provider: <span className="font-medium text-slate-700 dark:text-slate-300">{footer.llm_provider}</span>
        </span>
        {onLearnMore && (
          <button
            onClick={onLearnMore}
            className="min-h-11 font-medium text-brand-600 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 dark:text-brand-400"
          >
            What does this mean? See "How This Works"
          </button>
        )}
      </div>
    </footer>
  );
}
