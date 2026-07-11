"""
Deterministic rule layer for stage -> cost-optimization-method scoring.

This runs BEFORE any LLM call. It is what makes a recommendation defensible
under questioning: given the same inputs, it always returns the same method,
priority, and savings estimate. The Pydantic-AI agent (agents/classifier.py)
only writes the executive rationale in prose and breaks near-ties - it never
overrides a clear rule signal.

Scoring model (0-100 per method per stage):
  - energy_score      : driven by the stage's energy (gas+electricity) cost
                         share and absolute energy cost - triggers Energy
                         Optimization / Predictive Maintenance (TPM).
  - variance_score    : driven by the forecast interval width relative to the
                         expected value (uncertainty/demand volatility) -
                         triggers JIT / Lean Manufacturing.
  - waste_score       : driven by the stage's historical share of total waste
                         - triggers Six Sigma / OEE Improvement.
  - material_score    : driven by raw-material (dough/packaging) cost share -
                         triggers Recipe Optimization / Supplier Optimization.
  - baseline_score    : a small constant per stage matching the executive
                         workbook's documented default so the classifier
                         reproduces that table on day 0 (see acceptance
                         criteria) even before any forecast signal exists.
"""
from __future__ import annotations

from dataclasses import dataclass, field

# Stage -> materials whose cost is "energy" for that stage's block.
STAGE_ENERGY_MATERIALS = {
    "Dough Mixing + Fermentation": ["Electricity"],
    "Moulding": ["Electricity"],
    "Baking": ["Gas"],
    "Cooling": ["Electricity"],
    "Packaging": ["Electricity"],
}

# Default method mapping + priority, taken directly from the executive
# workbook - used as the day-0 / tie-break baseline.
STAGE_DEFAULTS = {
    "Dough Mixing + Fermentation": {
        "primary": "Lean Manufacturing",
        "secondary": ["Recipe Optimization"],
        "priority": "High",
        "savings_pct": 5.0,
    },
    "Packaging": {
        "primary": "Lean Manufacturing",
        "secondary": ["Supplier Optimization"],
        "priority": "High",
        "savings_pct": 10.0,
    },
    "Baking": {
        "primary": "Energy Optimization",
        "secondary": ["Predictive Maintenance (TPM)"],
        "priority": "Very High",
        "savings_pct": 15.0,
    },
    "Moulding": {
        "primary": "Six Sigma",
        "secondary": ["OEE Improvement"],
        "priority": "Medium",
        "savings_pct": 4.0,
    },
    "Cooling": {
        "primary": "Energy Optimization",
        "secondary": ["Kaizen"],
        "priority": "Medium",
        "savings_pct": 5.0,
    },
}


@dataclass
class StageMetrics:
    stage: str
    predicted_cost: float
    cost_contribution_pct: float
    cost_uncertainty_pct: float  # (high-low)/expected from the forecast interval
    energy_cost_share: float  # energy cost / stage cost
    waste_share_pct: float  # this stage's share of total waste (historical avg)
    dominant_driver: str = ""


@dataclass
class MethodScore:
    method: str
    score: float
    reason: str


def score_methods(m: StageMetrics) -> list[MethodScore]:
    defaults = STAGE_DEFAULTS[m.stage]
    scores: dict[str, MethodScore] = {}

    def bump(method: str, amount: float, reason: str) -> None:
        if method in scores:
            scores[method] = MethodScore(method, scores[method].score + amount, scores[method].reason + "; " + reason)
        else:
            scores[method] = MethodScore(method, amount, reason)

    # Baseline signal so day-0 (no meaningful variance/waste signal yet)
    # reproduces the executive workbook exactly.
    bump(defaults["primary"], 40.0, "matches documented stage baseline")
    for s in defaults["secondary"]:
        bump(s, 20.0, "documented secondary lever for this stage")

    # Energy signal
    if m.energy_cost_share > 0.25:
        bump("Energy Optimization", 25 * m.energy_cost_share, f"energy is {m.energy_cost_share:.0%} of stage cost")
        bump("Predictive Maintenance (TPM)", 15 * m.energy_cost_share, "high energy draw often signals equipment inefficiency")

    # Demand variance / uncertainty signal
    if m.cost_uncertainty_pct > 0.15:
        bump("JIT", 30 * m.cost_uncertainty_pct, f"forecast uncertainty is {m.cost_uncertainty_pct:.0%} of expected cost")
        bump("Lean Manufacturing", 15 * m.cost_uncertainty_pct, "high variance favors leaner buffer stock")

    # Waste / reject signal
    if m.waste_share_pct > 0.20:
        bump("Six Sigma", 30 * m.waste_share_pct, f"stage accounts for {m.waste_share_pct:.0%} of total waste")
        bump("OEE Improvement", 15 * m.waste_share_pct, "waste share suggests downtime/reject losses")

    # Cost-contribution signal (bigger stages get more attention regardless)
    if m.cost_contribution_pct > 30:
        bump("Kaizen", 10.0, f"stage is {m.cost_contribution_pct:.0f}% of total cost - continuous improvement warranted")

    # Material-heavy stages -> sourcing/recipe levers
    if m.stage == "Dough Mixing + Fermentation":
        bump("Recipe Optimization", 10.0, "dough/ingredient yield is the stage's dominant lever")
    if m.stage == "Packaging":
        bump("Supplier Optimization", 10.0, "packaging material is the stage's dominant input cost")

    return sorted(scores.values(), key=lambda s: s.score, reverse=True)


def priority_from_score(top_score: float, cost_contribution_pct: float) -> str:
    """Derives priority from the winning method's score and the stage's cost
    weight, so priority reacts to forecast shifts rather than being static."""
    weighted = top_score * (0.5 + 0.5 * min(cost_contribution_pct / 40.0, 1.0))
    if weighted >= 55:
        return "Very High"
    if weighted >= 40:
        return "High"
    if weighted >= 25:
        return "Medium"
    return "Low"


def estimated_savings_pct(m: StageMetrics, top: MethodScore) -> float:
    """Blends the stage's documented baseline savings range with the live
    signal strength, so savings estimates move (mildly) with the forecast
    rather than being frozen at the workbook's static number."""
    base = STAGE_DEFAULTS[m.stage]["savings_pct"]
    signal_adj = min(top.score / 100.0, 1.5)
    return round(base * (0.7 + 0.3 * signal_adj), 2)


def recommend(m: StageMetrics) -> dict:
    ranked = score_methods(m)
    top = ranked[0]
    secondary = [s.method for s in ranked[1:3]]
    priority = priority_from_score(top.score, m.cost_contribution_pct)
    savings_pct = estimated_savings_pct(m, top)

    return {
        "stage": m.stage,
        "predicted_cost_inr": round(m.predicted_cost, 2),
        "cost_contribution_pct": round(m.cost_contribution_pct, 2),
        "dominant_driver": m.dominant_driver or top.reason.split(";")[0],
        "recommended_method": top.method,
        "secondary_methods": secondary,
        "priority": priority,
        "estimated_savings_pct": savings_pct,
        "estimated_savings_inr": round(m.predicted_cost * savings_pct / 100.0, 2),
        "rule_rationale": top.reason,
        "all_scores": {s.method: round(s.score, 1) for s in ranked},
    }
