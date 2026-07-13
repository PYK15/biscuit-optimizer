import { useState } from "react";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "forecast", label: "Forecast" },
  { id: "optimization", label: "Cost Optimization" },
  { id: "sustainability", label: "Sustainability" },
  { id: "scorecard", label: "Model Scorecard" },
  { id: "roadmap", label: "Roadmap" },
] as const;

export type TabId = (typeof TABS)[number]["id"];

export default function Nav({ active, onChange }: { active: TabId; onChange: (t: TabId) => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeLabel = TABS.find((t) => t.id === active)?.label ?? "";

  return (
    <nav className="no-print relative border-b border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      {/* Desktop / tablet: horizontal tab row */}
      <div className="hidden gap-1 px-6 pt-3 md:flex">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            aria-current={active === t.id ? "page" : undefined}
            className={`min-h-11 rounded-t-md px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 ${
              active === t.id
                ? "border border-b-white bg-white text-brand-700 dark:border-slate-700 dark:border-b-slate-800 dark:bg-slate-800 dark:text-brand-300"
                : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
            }`}
            style={active === t.id ? { marginBottom: "-1px" } : undefined}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Mobile: hamburger menu button + dropdown list */}
      <div className="md:hidden">
        {/* No aria-label override - the accessible name is derived purely
            from visible/sr-only content so it can never drift out of sync
            with what's on screen (WCAG 2.5.3 Label in Name). */}
        <button
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-menu"
          data-mobile-nav-trigger
          className="flex min-h-11 w-full items-center justify-between px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          <span className="flex items-center gap-2">
            <span aria-hidden="true" className="text-lg leading-none">&#9776;</span>
            <span className="sr-only">Navigation, current tab:</span> {activeLabel}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {mobileOpen ? "Close" : "Menu"}
            <span className="sr-only"> navigation</span>
          </span>
        </button>
        {mobileOpen && (
          <div id="mobile-nav-menu" className="flex flex-col border-t border-slate-200 pb-2 dark:border-slate-700">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  onChange(t.id);
                  setMobileOpen(false);
                }}
                aria-current={active === t.id ? "page" : undefined}
                className={`min-h-11 px-6 py-3 text-left text-sm font-medium ${
                  active === t.id
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
                    : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );
}
