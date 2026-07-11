"""
Sustainability Advisor agent.

Like the classifier, this agent never computes the score or the emissions
numbers itself - those come from sustainability/scoring.py and
sustainability/emissions.py. The LLM only writes the SDG-aligned narrative
and picks which of the pre-computed top_reduction_levers to foreground.
Falls back to a templated narrative if the LLM is unavailable.
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import config  # noqa: E402
from agents.providers import get_model  # noqa: E402


class SustainabilityBrief(BaseModel):
    date: str
    sustainability_score: float
    total_kgco2e: float
    non_renewable_index: float
    top_levers: list[dict]
    narrative: str
    sdg_note: str
    source: str


class _NarrativeOutput(BaseModel):
    narrative: str
    sdg_note: str


def _fallback_narrative(score: float, levers: list[dict]) -> tuple[str, str]:
    top = levers[0]["description"] if levers else "energy and waste reduction"
    narrative = (
        f"Sustainability score is {score:.0f}/100. The largest lever available is: {top}."
    )
    sdg_note = (
        "Aligns with SDG 12 (Responsible Consumption & Production) and SDG 13 (Climate Action) "
        "via reduced non-renewable energy use and waste intensity."
    )
    return narrative, sdg_note


def _build_prompt(date: str, score: float, total_kgco2e: float, non_renewable_index: float, levers: list[dict]) -> str:
    lever_lines = "\n".join(
        f"- {l['description']} (suggested method: {l['suggested_method']}, "
        f"relative contribution to score gap: {l['relative_contribution']}%)"
        for l in levers
    )
    return (
        "You are a sustainability advisor for a biscuit manufacturing plant. Given the "
        f"following pre-computed figures for {date}, write:\n"
        "1) a 2-sentence narrative for factory executives explaining the sustainability score "
        "and what it means operationally, and\n"
        "2) a 1-sentence note connecting the top lever to relevant UN Sustainable Development "
        "Goals (SDGs).\n"
        "Do not invent new numbers - only explain the ones given.\n\n"
        f"Sustainability score: {score:.1f}/100\n"
        f"Total emissions: {total_kgco2e:.0f} kgCO2e\n"
        f"Non-renewable resource index: {non_renewable_index:.2f} (0=fully renewable, 1=fully fossil)\n"
        f"Top reduction levers:\n{lever_lines}"
    )


async def _run_llm(date, score, total_kgco2e, non_renewable_index, levers) -> _NarrativeOutput:
    from pydantic_ai import Agent

    agent = Agent(get_model(), output_type=_NarrativeOutput)
    result = await agent.run(_build_prompt(date, score, total_kgco2e, non_renewable_index, levers))
    return result.output


def advise(date: str, score: float, total_kgco2e: float, non_renewable_index: float, levers: list[dict], use_llm: bool = True) -> SustainabilityBrief:
    source = "rule_fallback"
    narrative, sdg_note = _fallback_narrative(score, levers)

    if use_llm:
        try:
            out = asyncio.run(_run_llm(date, score, total_kgco2e, non_renewable_index, levers))
            narrative, sdg_note = out.narrative, out.sdg_note
            source = "rule+llm"
        except Exception:
            pass

    return SustainabilityBrief(
        date=date,
        sustainability_score=score,
        total_kgco2e=total_kgco2e,
        non_renewable_index=non_renewable_index,
        top_levers=levers,
        narrative=narrative,
        sdg_note=sdg_note,
        source=source,
    )


if __name__ == "__main__":
    from data.loader import to_daily_aggregates
    from data.variability import apply_variability
    from sustainability.scoring import add_sustainability_metrics, top_reduction_levers

    daily = add_sustainability_metrics(apply_variability(to_daily_aggregates()))
    last = daily.iloc[-1]
    levers = top_reduction_levers(daily)
    brief = advise(str(last["Date"].date()), last["sustainability_score"], last["total_kgco2e"], last["non_renewable_index"], levers)
    print(f"[{brief.source}] {brief.narrative}\n{brief.sdg_note}")
