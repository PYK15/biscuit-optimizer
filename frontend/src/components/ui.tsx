import { useId, useRef, useState, type ReactNode } from "react";

export function Card({ title, children, className = "", titleExtra }: { title?: string; children: ReactNode; className?: string; titleExtra?: ReactNode }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {title && (
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-slate-500">
          {title}
          {titleExtra}
        </h3>
      )}
      {children}
    </div>
  );
}

export function Stat({ label, value, sub, info }: { label: string; value: string; sub?: string; info?: InfoCopy }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
        {info && <InfoTip {...info} />}
      </div>
      <div className="mt-1 text-2xl font-semibold text-slate-800">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
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
 * (no hover state), and it closes on blur/mouse-leave.
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
        className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-[9px] font-bold normal-case leading-none text-slate-400 hover:border-indigo-400 hover:text-indigo-600 focus:border-indigo-400 focus:text-indigo-600 focus:outline-none"
      >
        i
      </button>
      {open && (
        <div
          id={id}
          role="tooltip"
          data-info-popover
          className="absolute left-1/2 top-full z-30 mt-1.5 w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 text-left text-xs normal-case leading-relaxed text-slate-600 shadow-lg"
        >
          <p><span className="font-semibold text-slate-800">What: </span>{what}</p>
          <p className="mt-1.5"><span className="font-semibold text-slate-800">How: </span>{how}</p>
          <p className="mt-1.5"><span className="font-semibold text-slate-800">Why it matters: </span>{why}</p>
        </div>
      )}
    </span>
  );
}

const PRIORITY_COLORS: Record<string, string> = {
  "Very High": "bg-rose-100 text-rose-700",
  High: "bg-amber-100 text-amber-700",
  Medium: "bg-sky-100 text-sky-700",
  Low: "bg-slate-100 text-slate-600",
};

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${PRIORITY_COLORS[priority] ?? "bg-slate-100 text-slate-600"}`}>
      {priority}
    </span>
  );
}

export function SourceBadge({ source }: { source: string }) {
  const isLlm = source === "rule+llm";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
        isLlm ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-500"
      }`}
      title={isLlm ? "Rationale written by the LLM over rule-layer outputs" : "LLM unavailable/disabled - templated rationale from the rule layer"}
    >
      {isLlm ? "LLM" : "Rule"}
    </span>
  );
}

export function HorizonControl({ horizon, onChange }: { horizon: number; onChange: (h: number) => void }) {
  return (
    <div className="flex items-center gap-3 text-sm text-slate-600">
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
        className="w-40 accent-indigo-600"
      />
      <span className="w-16 rounded-md bg-slate-100 px-2 py-0.5 text-center font-mono text-xs">{horizon} days</span>
    </div>
  );
}

export function Loading({ label = "Loading..." }: { label?: string }) {
  return <div className="p-10 text-center text-sm text-slate-400">{label}</div>;
}

export function RefreshingBadge({ visible, label = "Updating for new horizon..." }: { visible: boolean; label?: string }) {
  if (!visible) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-500">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-indigo-500" />
      {label}
    </span>
  );
}

export function ChartLoadingOverlay({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-white/70 backdrop-blur-[1px]">
      <div className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-indigo-600 shadow">
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-indigo-300 border-t-indigo-600" />
        Updating forecast...
      </div>
    </div>
  );
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <div className="m-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
      {message}
    </div>
  );
}
