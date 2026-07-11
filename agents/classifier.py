"""
Cost-Optimization Classifier agent.

IMPORTANT: this agent never invents the stage, method, priority, or savings
number - those come entirely from the deterministic rule layer
(optimization/rules.py). The LLM's only job is to turn the rule output into a
short, board-ready rationale sentence. If the LLM is unreachable (e.g. Ollama
not running), classify_day() falls back to a templated rationale and the
system keeps working with zero crashes.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path
from typing import Literal

from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import config  # noqa: E402
from agents.providers import get_model  # noqa: E402

Method = Literal[
    "Lean Manufacturing", "JIT", "Six Sigma", "Predictive Maintenance (TPM)",
    "Energy Optimization", "Kaizen", "Supplier Optimization", "Recipe Optimization",
    "OEE Improvement",
]
Priority = Literal["Low", "Medium", "High", "Very High"]


class StageRecommendation(BaseModel):
    stage: str
    date: str
    predicted_cost_inr: float
    cost_contribution_pct: float
    dominant_driver: str
    recommended_method: Method
    secondary_methods: list[str]
    priority: Priority
    estimated_savings_pct: float
    estimated_savings_inr: float
    rationale: str
    source: Literal["rule+llm", "rule_fallback"]


class _RationaleItem(BaseModel):
    stage: str
    rationale: str


class _DayRationales(BaseModel):
    items: list[_RationaleItem]


def _fallback_rationale(rec: dict) -> str:
    return (
        f"Focus on {rec['recommended_method']} for {rec['stage']} to capture an estimated "
        f"{rec['estimated_savings_pct']}% (~Rs {rec['estimated_savings_inr']:,.0f}) saving - "
        f"{rec['rule_rationale']}."
    )


def _build_prompt(recs: list[dict]) -> str:
    lines = [
        "You are writing one-sentence executive rationales for a biscuit factory's "
        "daily cost-optimization plan. For EACH stage below, write a single crisp, "
        "board-ready sentence explaining WHY the recommended method was chosen, "
        "referencing the concrete numbers given. Do not change the method, stage, "
        "priority, or numbers - only explain them in plain language.",
        "",
    ]
    for r in recs:
        lines.append(
            f"- Stage: {r['stage']} | Date: {r['date']} | Predicted cost: Rs {r['predicted_cost_inr']:,.0f} "
            f"({r['cost_contribution_pct']:.1f}% of daily total) | Recommended method: {r['recommended_method']} "
            f"| Priority: {r['priority']} | Estimated savings: {r['estimated_savings_pct']}% "
            f"(~Rs {r['estimated_savings_inr']:,.0f}) | Signal: {r['rule_rationale']}"
        )
    return "\n".join(lines)


async def _run_llm(recs: list[dict]) -> dict[str, str]:
    from pydantic_ai import Agent

    agent = Agent(get_model(), output_type=_DayRationales)
    result = await agent.run(_build_prompt(recs))
    return {item.stage: item.rationale for item in result.output.items}


def classify_day(recs: list[dict], use_llm: bool = True) -> list[StageRecommendation]:
    """Takes the rule-layer output for one day (list of dicts from
    optimization.rules.recommend, with a 'date' key added) and returns
    strict StageRecommendation objects, enriched with an LLM rationale when
    available and falling back to a templated rationale otherwise."""
    rationales: dict[str, str] = {}
    source = "rule_fallback"

    if use_llm:
        try:
            rationales = asyncio.run(_run_llm(recs))
            if rationales:
                source = "rule+llm"
        except Exception:
            rationales = {}

    out = []
    for r in recs:
        rationale = rationales.get(r["stage"]) or _fallback_rationale(r)
        out.append(
            StageRecommendation(
                stage=r["stage"],
                date=r["date"],
                predicted_cost_inr=r["predicted_cost_inr"],
                cost_contribution_pct=r["cost_contribution_pct"],
                dominant_driver=r["dominant_driver"],
                recommended_method=r["recommended_method"],
                secondary_methods=r["secondary_methods"],
                priority=r["priority"],
                estimated_savings_pct=r["estimated_savings_pct"],
                estimated_savings_inr=r["estimated_savings_inr"],
                rationale=rationale,
                source=source if r["stage"] in rationales else "rule_fallback",
            )
        )
    return out


if __name__ == "__main__":
    from optimization.decision_engine import build_horizon_plan

    plan = build_horizon_plan(1)
    day = plan["days"][0]
    results = classify_day(day["stage_recommendations"], use_llm=True)
    for rec in results:
        print(f"[{rec.source}] {rec.stage}: {rec.recommended_method} ({rec.priority}) - {rec.rationale}")
