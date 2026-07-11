import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import config
from optimization.decision_engine import build_horizon_plan
from optimization.rules import StageMetrics, recommend


EXECUTIVE_WORKBOOK_PRIMARY_METHOD = {
    "Dough Mixing + Fermentation": "Lean Manufacturing",
    "Packaging": "Lean Manufacturing",
    "Baking": "Energy Optimization",
    "Moulding": "Six Sigma",
    "Cooling": "Energy Optimization",
}


def test_day0_reproduces_executive_workbook_mapping():
    """Acceptance criterion: classifier output matches the executive
    workbook's stage->method mapping on the first forecast day, since no
    forecast-driven signal has had a chance to shift it yet."""
    plan = build_horizon_plan(horizon=1)
    recs_by_stage = {r["stage"]: r for r in plan["days"][0]["stage_recommendations"]}
    for stage, expected_method in EXECUTIVE_WORKBOOK_PRIMARY_METHOD.items():
        assert recs_by_stage[stage]["recommended_method"] == expected_method


def test_priority_reacts_to_zero_signal_baseline():
    """With no forecast signal beyond the documented baseline, the rule
    layer should still identify the correct primary method - priority itself
    is intentionally allowed to move with cost weight (see rules.py)."""
    zero_signal = StageMetrics(
        stage="Baking", predicted_cost=1.0, cost_contribution_pct=0.0,
        cost_uncertainty_pct=0.0, energy_cost_share=0.0, waste_share_pct=0.0,
    )
    rec = recommend(zero_signal)
    assert rec["recommended_method"] == "Energy Optimization"


def test_horizon_plan_covers_all_stages_each_day():
    plan = build_horizon_plan(horizon=4)
    assert plan["horizon_days"] == 4
    assert len(plan["days"]) == 4
    for day in plan["days"]:
        stages = {r["stage"] for r in day["stage_recommendations"]}
        assert stages == set(config.STAGES)
        assert "method_of_the_day" in day
        motd = day["method_of_the_day"]
        assert motd["stage"] in config.STAGES
        assert motd["expected_savings_inr"] >= 0
