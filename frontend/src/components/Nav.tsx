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
  return (
    <nav className="flex gap-1 border-b border-slate-200 bg-white px-6 pt-3">
      {TABS.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          className={`rounded-t-md px-4 py-2 text-sm font-medium transition-colors ${
            active === t.id
              ? "border border-b-white border-slate-200 bg-white text-indigo-700"
              : "text-slate-500 hover:text-slate-800"
          }`}
          style={active === t.id ? { marginBottom: "-1px" } : undefined}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
