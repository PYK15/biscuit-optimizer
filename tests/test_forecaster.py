import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from models.forecaster import TARGETS, forecast


def test_forecast_shape_and_intervals():
    result = forecast(horizon=5)
    assert result.horizon_days == 5
    assert set(result.targets.keys()) == set(TARGETS.keys())

    for target, tf in result.targets.items():
        assert len(tf.points) == 5
        for p in tf.points:
            assert p.low <= p.expected <= p.high
            assert p.low >= 0


def test_backtest_metrics_are_reported_for_model_and_both_baselines():
    result = forecast(horizon=3)
    total_cost = result.targets["total_cost_inr"]
    assert total_cost.model_metrics.mae >= 0
    assert total_cost.naive_metrics.mae >= 0
    assert total_cost.seasonal_naive_metrics.mae >= 0
    assert isinstance(total_cost.beats_baselines, bool)
