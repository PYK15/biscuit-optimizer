import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import config
from data.loader import to_daily_aggregates
from data.variability import apply_variability


def test_variability_overlay_breaks_flatness():
    daily = to_daily_aggregates()
    aug = apply_variability(daily)
    cov = aug["total_cost_inr"].std() / aug["total_cost_inr"].mean()
    assert cov > 0.02  # meaningfully non-flat vs raw CoV of ~0


def test_variability_is_deterministic_given_seed():
    daily = to_daily_aggregates()
    a = apply_variability(daily, seed=123)
    b = apply_variability(daily, seed=123)
    assert (a["total_cost_inr"] - b["total_cost_inr"]).abs().max() < 1e-9


def test_variability_noop_when_flag_disabled(monkeypatch):
    monkeypatch.setattr(config, "SYNTHETIC_VARIABILITY", False)
    daily = to_daily_aggregates()
    out = apply_variability(daily)
    assert (out["total_cost_inr"] - daily["total_cost_inr"]).abs().max() < 1e-9
