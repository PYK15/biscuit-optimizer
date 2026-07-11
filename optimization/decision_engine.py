"""
Combines the ML forecast (models/forecaster.py) with the deterministic rule
layer (optimization/rules.py) into a per-day "plan": which stage to
prioritize, which method to deploy, expected INR savings, and a sustainability
note - the headline output the manufacturer acts on.

Static per-stage ratios (energy cost share, waste share) are derived once
from the 30-day historical log and held constant across the forecast horizon
- material mix *within* a stage (e.g. Baking's cost being ~100% gas) is a
process characteristic that doesn't change day to day, even though the
absolute cost does. This is a documented simplifying assumption.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import config  # noqa: E402
from data.loader import to_daily_aggregates, to_tidy_long  # noqa: E402
from data.variability import apply_variability  # noqa: E402
from models.forecaster import ForecastResult, forecast  # noqa: E402
from optimization.rules import STAGE_ENERGY_MATERIALS, StageMetrics, recommend  # noqa: E402

STAGE_COST_TARGET = {stage: f"cost_{stage}" for stage in config.STAGES}


def stage_energy_shares() -> dict[str, float]:
    tidy = to_tidy_long()
    stage_cost = tidy.groupby("Stage")["Cost (INR)"].sum()
    is_energy = tidy["Material"].isin(["Electricity", "Gas"])
    energy_cost = tidy[is_energy].groupby("Stage")["Cost (INR)"].sum()
    share = (energy_cost / stage_cost).fillna(0.0)
    return {stage: float(share.get(stage, 0.0)) for stage in config.STAGES}


def stage_waste_shares() -> dict[str, float]:
    daily = to_daily_aggregates()
    waste_cols = {stage: f"waste_{stage}" for stage in config.STAGES}
    avg_waste = {stage: float(daily.get(col, pd.Series([0.0])).mean()) for stage, col in waste_cols.items()}
    total = sum(avg_waste.values()) or 1.0
    return {stage: v / total for stage, v in avg_waste.items()}


def build_day_recommendations(
    result: ForecastResult,
    day_index: int,
    energy_shares: dict[str, float],
    waste_shares: dict[str, float],
) -> list[dict]:
    total_point = result.targets["total_cost_inr"].points[day_index]
    recs = []
    for stage in config.STAGES:
        target_key = STAGE_COST_TARGET[stage]
        point = result.targets[target_key].points[day_index]
        expected = point.expected
        uncertainty_pct = (point.high - point.low) / expected if expected else 0.0
        contribution_pct = 100 * expected / total_point.expected if total_point.expected else 0.0

        metrics = StageMetrics(
            stage=stage,
            predicted_cost=expected,
            cost_contribution_pct=contribution_pct,
            cost_uncertainty_pct=uncertainty_pct,
            energy_cost_share=energy_shares.get(stage, 0.0),
            waste_share_pct=waste_shares.get(stage, 0.0),
        )
        rec = recommend(metrics)
        rec["date"] = point.date
        recs.append(rec)
    return recs


def method_of_the_day(recs: list[dict]) -> dict:
    top = max(recs, key=lambda r: r["estimated_savings_inr"])
    sustainability_note = None
    if top["recommended_method"] in ("Energy Optimization", "Predictive Maintenance (TPM)"):
        sustainability_note = (
            f"Deploying {top['recommended_method']} on {top['stage']} also reduces gas/electricity "
            "draw directly, lowering Scope 1/2 emissions alongside cost."
        )
    elif top["recommended_method"] in ("Six Sigma", "OEE Improvement"):
        sustainability_note = (
            f"Reducing rejects in {top['stage']} lowers ingredient/biscuit waste and its embedded "
            "upstream (Scope 3) emissions, not just direct cost."
        )
    else:
        sustainability_note = (
            f"{top['recommended_method']} on {top['stage']} primarily targets cost efficiency; "
            "monitor sustainability score for secondary resource-use effects."
        )

    return {
        "date": top["date"],
        "stage": top["stage"],
        "recommended_method": top["recommended_method"],
        "priority": top["priority"],
        "expected_savings_inr": top["estimated_savings_inr"],
        "rationale": top["rule_rationale"],
        "sustainability_note": sustainability_note,
    }


def build_horizon_plan(horizon: int = config.DEFAULT_HORIZON_DAYS, result: ForecastResult | None = None) -> dict:
    """`result` lets a caller pass in an already-computed/cached ForecastResult
    for this horizon (see api/main.py's `_cached_plan`) instead of training
    the forecaster again from scratch - training is the expensive part
    (walk-forward backtest + quantile models per target), so reusing it here
    avoids doing that work twice for the same horizon. Defaults to computing
    it directly when called standalone (e.g. the tests and the __main__ block
    below), so existing callers are unaffected."""
    if result is None:
        result = forecast(horizon)
    energy_shares = stage_energy_shares()
    waste_shares = stage_waste_shares()

    days = []
    for i in range(horizon):
        recs = build_day_recommendations(result, i, energy_shares, waste_shares)
        days.append(
            {
                "date": recs[0]["date"],
                "stage_recommendations": recs,
                "method_of_the_day": method_of_the_day(recs),
            }
        )
    return {
        "horizon_days": horizon,
        "synthetic_variability": config.SYNTHETIC_VARIABILITY,
        "days": days,
    }


if __name__ == "__main__":
    plan = build_horizon_plan(config.DEFAULT_HORIZON_DAYS)
    for day in plan["days"]:
        motd = day["method_of_the_day"]
        print(f"{day['date']}: METHOD OF THE DAY -> {motd['stage']} / {motd['recommended_method']} "
              f"(priority={motd['priority']}, est. savings=Rs {motd['expected_savings_inr']:,.0f})")
        for rec in day["stage_recommendations"]:
            print(f"    {rec['stage']:30s} cost=Rs{rec['predicted_cost_inr']:>9,.0f} "
                  f"contrib={rec['cost_contribution_pct']:>5.1f}%  -> {rec['recommended_method']:28s} "
                  f"[{rec['priority']}] save~{rec['estimated_savings_pct']}%")
