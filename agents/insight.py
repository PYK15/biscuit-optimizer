"""
Executive Insight Writer agent.

Turns one day's "Method of the Day" (optimization/decision_engine.py output)
plus the sustainability brief into a short board-ready narrative. Pure
prose-generation over already-computed numbers; falls back to a template if
the LLM is unavailable.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import config  # noqa: E402
from agents.providers import get_model  # noqa: E402


class ExecutiveInsight(BaseModel):
    date: str
    headline: str
    narrative: str
    source: str


class _InsightOutput(BaseModel):
    headline: str
    narrative: str


def _fallback_insight(motd: dict, sustainability_score: float | None) -> tuple[str, str]:
    headline = f"{motd['stage']}: {motd['recommended_method']} ({motd['priority']} priority)"
    narrative = (
        f"On {motd['date']}, the top opportunity is {motd['recommended_method']} on "
        f"{motd['stage']}, worth an estimated Rs {motd['expected_savings_inr']:,.0f} in savings. "
        f"{motd['rationale']}"
    )
    if sustainability_score is not None:
        narrative += f" {motd['sustainability_note']}"
    return headline, narrative


def _build_prompt(motd: dict, sustainability_score: float | None) -> str:
    extra = f"\nCurrent sustainability score: {sustainability_score:.0f}/100." if sustainability_score is not None else ""
    return (
        "Write a board-ready 'Method of the Day' briefing for a biscuit factory's daily "
        "operations review. Produce a short headline (under 12 words) and a 2-3 sentence "
        "narrative. Use only the facts given below - do not invent numbers.\n\n"
        f"Date: {motd['date']}\n"
        f"Priority stage: {motd['stage']}\n"
        f"Recommended method: {motd['recommended_method']}\n"
        f"Priority: {motd['priority']}\n"
        f"Expected savings: Rs {motd['expected_savings_inr']:,.0f}\n"
        f"Rationale signal: {motd['rationale']}\n"
        f"Sustainability note: {motd['sustainability_note']}"
        f"{extra}"
    )


async def _run_llm(motd: dict, sustainability_score: float | None) -> _InsightOutput:
    from pydantic_ai import Agent

    agent = Agent(get_model(), output_type=_InsightOutput)
    result = await agent.run(_build_prompt(motd, sustainability_score))
    return result.output


def write_insight(motd: dict, sustainability_score: float | None = None, use_llm: bool = True) -> ExecutiveInsight:
    source = "rule_fallback"
    headline, narrative = _fallback_insight(motd, sustainability_score)

    if use_llm:
        try:
            out = asyncio.run(_run_llm(motd, sustainability_score))
            headline, narrative = out.headline, out.narrative
            source = "rule+llm"
        except Exception:
            pass

    return ExecutiveInsight(date=motd["date"], headline=headline, narrative=narrative, source=source)


if __name__ == "__main__":
    from optimization.decision_engine import build_horizon_plan

    plan = build_horizon_plan(1)
    motd = plan["days"][0]["method_of_the_day"]
    insight = write_insight(motd, sustainability_score=50.0)
    print(f"[{insight.source}] {insight.headline}\n{insight.narrative}")
