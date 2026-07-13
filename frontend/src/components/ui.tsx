import { useId, useRef, useState, type ReactNode } from "react";
import type { Trend } from "../insights";

export function Card({ title, children, className = "", titleExtra }: { title?: string; children: ReactNode; className?: string; titleExtra?: ReactNode }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow dark:border-slate-700 dark:bg-slate-800 ${className}`}
    >
      {title && (
        // h2, not h3: the app's only other heading is the h1 page title, so
        // this keeps the heading hierarchy sequential (no skipped levels)
        // for screen-reader navigation.
        <h2 className="mb-3 flex flex-wrap items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {title}
          {titleExtra}
        </h2>
      )}
      {children}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  info,
  trend,
  trendGoodDirection = "down",
}: {
  label: string;
  value: string;
  sub?: string;
  info?: InfoCopy;
  trend?: Trend;
  trendGoodDirection?: "up" | "down";
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
        {info && <InfoTip {...info} />}
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-2">
        <span className="text-2xl font-semibold text-slate-800 dark:text-slate-100">{value}</span>
        {trend && <TrendBadge trend={trend} goodDirection={trendGoodDirection} />}
      </div>
      {sub && <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sub}</div>}
    </div>
  );
}

/**
 * Small up/down/flat indicator with the real % change vs. a prior period.
 * `goodDirection` controls color semantics: for cost, "down" is good (green)
 * and "up" is bad (rose); for a score, it's the reverse. Never color-only -
 * always paired with an arrow glyph and the numeric %.
 */
export function TrendBadge({ trend, goodDirection = "down" }: { trend?: Trend; goodDirection?: "up" | "down" }) {
  if (!trend || trend.direction === "flat") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-500 dark:bg-slate-700 dark:text-slate-400">
        <span aria-hidden="true">&#8213;</span> flat
      </span>
    );
  }
  const isGood = trend.direction === goodDirection;
  const arrow = trend.direction === "up" ? "▲" : "▼";
  const colorClass = isGood
    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
    : "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium ${colorClass}`}>
      <span aria-hidden="true">{arrow}</span>
      {trend.pct.toFixed(1)}%
    </span>
  );
}

export interface InfoCopy {
  what: string;
  how: string;
  why: string;
}

/**
 * Small "(i)" affordance shown next to any metric label. Hover/focus reveals
 * a WHAT/HOW/WHY-IT-MATTERS popover on desktop; tap opens it on mobile
 * (no hover state), and it closes on blur/mouse-leave. The visible glyph
 * stays small and unobtrusive, but the actual button hit area is 24x24px
 * (WCAG 2.2 AA minimum target size) via padding around the glyph.
 */
export function InfoTip({ what, how, why }: InfoCopy) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const closeTimer = useRef<number | undefined>(undefined);

  const show = () => {
    window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hide = () => {
    closeTimer.current = window.setTimeout(() => setOpen(false), 80);
  };

  return (
    <span className="relative inline-flex" onMouseEnter={show} onMouseLeave={hide}>
      <button
        type="button"
        aria-describedby={id}
        aria-expanded={open}
        aria-label="What is this metric?"
        data-info-trigger
        onClick={(e) => {
          e.stopPropagation();
          // A click always ensures the tip is open rather than toggling it -
          // Playwright (and real touchscreens) fire a hover/enter just before
          // the click, so a toggle here would immediately close what the
          // hover had just opened.
          show();
        }}
        onFocus={show}
        onBlur={hide}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full normal-case text-slate-500 hover:text-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 dark:text-slate-400 dark:hover:text-brand-400"
      >
        <span className="flex h-3.5 w-3.5 items-center justify-center rounded-full border border-slate-300 bg-white text-[9px] font-bold leading-none dark:border-slate-600 dark:bg-slate-800">
          i
        </span>
      </button>
      {open && (
        <div
          id={id}
          role="tooltip"
          data-info-popover
          className="absolute left-1/2 top-full z-30 mt-1 w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 text-left text-xs normal-case leading-relaxed text-slate-600 shadow-lg dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300"
        >
          <p><span className="font-semibold text-slate-800 dark:text-slate-100">What: </span>{what}</p>
          <p className="mt-1.5"><span className="font-semibold text-slate-800 dark:text-slate-100">How: </span>{how}</p>
          <p className="mt-1.5"><span className="font-semibold text-slate-800 dark:text-slate-100">Why it matters: </span>{why}</p>
        </div>
      )}
    </span>
  );
}

const PRIORITY_COLORS: Record<string, string> = {
  "Very High": "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  High: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  Medium: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
  Low: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
};

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_COLORS[priority] ?? "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}>
      {priority}
    </span>
  );
}

export function SourceBadge({ source }: { source: string }) {
  const isLlm = source === "rule+llm";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
        isLlm ? "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
      }`}
      title={isLlm ? "Rationale written by the LLM over rule-layer outputs" : "LLM unavailable/disabled - templated rationale from the rule layer"}
    >
      {isLlm ? "LLM" : "Rule"}
    </span>
  );
}

export function HorizonControl({ horizon, onChange }: { horizon: number; onChange: (h: number) => void }) {
  return (
    <div className="flex min-h-11 items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
      <label htmlFor="horizon" className="font-medium">
        Forecast horizon
      </label>
      <input
        id="horizon"
        type="range"
        min={1}
        max={14}
        value={horizon}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-32 accent-brand-600 sm:w-40"
      />
      <span className="w-16 rounded-md bg-slate-100 px-2 py-0.5 text-center font-mono text-xs dark:bg-slate-700 dark:text-slate-200">{horizon} days</span>
    </div>
  );
}

/** Dropdown filter used by Cost Optimization (stage) and Sustainability (driver). */
export function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex min-h-11 items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
      <span className="font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-9 rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
      >
        <option value="all">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

/** 44x44px-minimum icon-only button (dark-mode toggle, print, nav hamburger). */
export function IconButton({
  onClick,
  label,
  children,
  active = false,
  className = "",
  ...rest
}: {
  onClick: () => void;
  label: string;
  children: ReactNode;
  active?: boolean;
  className?: string;
} & Record<`data-${string}`, string | boolean | undefined>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-md border text-lg transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 active:scale-95 ${
        active
          ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-700 dark:bg-brand-900/40 dark:text-brand-300"
          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      } ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Loading({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-3 p-10 text-center text-sm text-slate-400 dark:text-slate-500">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600 dark:border-slate-600 dark:border-t-brand-400" />
      {label}
    </div>
  );
}

export function RefreshingBadge({ visible, label = "Updating for new horizon..." }: { visible: boolean; label?: string }) {
  if (!visible) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-500 dark:text-brand-400">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500 dark:bg-brand-400" />
      {label}
    </span>
  );
}

export function ChartLoadingOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-[1px] dark:bg-slate-800/70">
      <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-brand-600 shadow dark:bg-slate-700 dark:text-brand-300">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-brand-300 border-t-brand-600 dark:border-brand-600 dark:border-t-brand-300" />
        Updating forecast...
      </div>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="m-6 flex flex-col items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-300">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="text-xl leading-none">&#9888;</span>
        <div>
          <p className="font-semibold">Couldn't reach the backend</p>
          <p className="mt-1 text-rose-600 dark:text-rose-400">{message}</p>
          <p className="mt-1 text-xs text-rose-500 dark:text-rose-400/80">
            Check that the API is running (see DEPLOYMENT.md / run.ps1) and that VITE_API_BASE_URL points to it.
          </p>
        </div>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="min-h-9 rounded-md border border-rose-300 bg-white px-3 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:bg-transparent dark:text-rose-300 dark:hover:bg-rose-950/60"
        >
          Retry
        </button>
      )}
    </div>
  );
}

/** Friendly "nothing here yet" state for a data-driven view with no rows. */
export function EmptyState({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-600">
      <span aria-hidden="true" className="text-2xl">&#128203;</span>
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{title}</p>
      {detail && <p className="max-w-sm text-xs text-slate-400 dark:text-slate-500">{detail}</p>}
    </div>
  );
}
