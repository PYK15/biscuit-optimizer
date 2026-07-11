import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from data.loader import load_raw, to_daily_aggregates, to_tidy_long, reproduce_executive_table, load_executive_table, validation_summary


def test_raw_shape():
    df = load_raw()
    assert len(df) == 600
    assert df["Date"].nunique() == 30


def test_activity_forward_fill_has_no_gaps():
    df = load_raw()
    assert df["Activity"].isna().sum() == 0
    assert set(df["Activity"].unique()) == {
        "Dough Mixing + Fermentation", "Moulding", "Baking", "Cooling", "Packaging",
    }


def test_daily_aggregates_total_cost_matches_raw_sum():
    daily = to_daily_aggregates()
    tidy = to_tidy_long()
    assert abs(daily["total_cost_inr"].sum() - tidy["Cost (INR)"].sum()) < 1e-6
    assert len(daily) == 30


def test_executive_table_reproduction_matches_reference():
    repro = reproduce_executive_table()
    ref = load_executive_table()
    merged = repro.merge(ref[["Production Stage", "Current Cost (INR)"]], on="Production Stage", suffixes=("_repro", "_ref"))
    assert (merged["Current Cost (INR)_repro"] - merged["Current Cost (INR)_ref"]).abs().max() < 1.0


def test_validation_summary_confirms_flat_source_data():
    summary = validation_summary()
    assert summary["rows_loaded"] == 600
    assert summary["n_days"] == 30
    assert summary["is_effectively_flat"] is True
    assert summary["scope_columns_empty"] is True
