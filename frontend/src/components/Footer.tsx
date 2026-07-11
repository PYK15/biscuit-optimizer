import type { Footer as FooterType } from "../types";

export default function Footer({ footer, onLearnMore }: { footer?: FooterType; onLearnMore?: () => void }) {
  if (!footer) return null;
  return (
    <footer className="mt-10 border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
        <span>Data source: {footer.data_source}</span>
        <span>
          Synthetic variability:{" "}
          <span className={footer.synthetic_variability ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>
            {footer.synthetic_variability ? "ON (demo demand drivers active)" : "OFF - source data is near-constant, forecast is trivial"}
          </span>
        </span>
        <span>
          LLM provider: <span className="font-medium text-slate-700">{footer.llm_provider}</span>
        </span>
        {onLearnMore && (
          <button onClick={onLearnMore} className="font-medium text-indigo-600 underline-offset-2 hover:underline">
            What does this mean? See "How This Works"
          </button>
        )}
      </div>
    </footer>
  );
}
