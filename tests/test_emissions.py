import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from data.loader import load_raw, to_daily_aggregates
from sustainability.emissions import compute_emissions, non_renewable_resource_index
from sustainability.scoring import add_sustainability_metrics, top_reduction_levers


def test_source_scope_columns_are_empty():
    raw = load_raw()
    assert raw["Scope 1 (kgCo2e)"].isna().all()
    assert raw["Scope 2 (kgCo2e)"].isna().all()
    assert raw["Scope 3 (kgCo2e)"].isna().all()


def test_emissions_are_computed_and_positive():
    daily = to_daily_aggregates()
    emissions = compute_emissions(daily)
    assert (emissions["scope1_kgco2e"] > 0).all()
    assert (emissions["scope2_kgco2e"] > 0).all()
    assert (emissions["scope3_kgco2e"] > 0).all()
    assert (emissions["total_kgco2e"] == emissions[["scope1_kgco2e", "scope2_kgco2e", "scope3_kgco2e"]].sum(axis=1)).all()


def test_non_renewable_index_bounded():
    daily = to_daily_aggregates()
    emissions = compute_emissions(daily)
    idx = non_renewable_resource_index(emissions)
    assert (idx >= 0).all() and (idx <= 1).all()


def test_sustainability_score_bounded_and_levers_present():
    daily = to_daily_aggregates()
    scored = add_sustainability_metrics(daily)
    assert scored["sustainability_score"].between(0, 100).all()
    levers = top_reduction_levers(scored)
    assert len(levers) == 3
    assert all("suggested_method" in l for l in levers)
