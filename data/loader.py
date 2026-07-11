"""
Loads the raw biscuit-factory Excel logs and reshapes them into clean,
analysis-ready tables:

- `load_raw()`            -> the 600-row sheet, forward-filled, typed.
- `to_tidy_long()`         -> one row per (date, material) observation.
- `to_daily_aggregates()`  -> one row per day: cost/waste/water/energy totals
                              plus per-stage cost columns.
- `load_executive_table()` -> the 6-row target/reference table.
- `reproduce_executive_table()` -> rebuilds that table from the raw daily log
                              to prove the two data sources are consistent.
- `validation_summary()`   -> prints/returns sanity checks, including the
                              "is this data flat?" honesty check required by
                              the project brief.

Run this module directly (`python -m data.loader`) to see the validation
summary on the console.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import config  # noqa: E402


def load_raw() -> pd.DataFrame:
    """Load the 600-row wide daily production log, forward-filling the
    sparsely-populated Activity/Machine columns within each day's block."""
    df = pd.read_excel(config.RAW_DAILY_XLSX, sheet_name=config.RAW_DAILY_SHEET)
    df["Date"] = pd.to_datetime(df["Date"])

    # Activity/Machine are only populated on the first row of each stage
    # block; forward-fill within each day so every row knows its stage/machine.
    df["Activity"] = df.groupby(df["Date"])["Activity"].transform(
        lambda s: s.ffill()
    )
    df["Machine"] = df["Machine"].ffill()
    # A new day's first Machine value is Mixer, so no cross-day leakage occurs
    # for Machine; Activity is re-filled per-day above to avoid leakage.

    df["Cost (INR)"] = df["Cost (INR)"].fillna(0.0)
    df["Waste (kgs)"] = df["Waste (kgs)"].fillna(0.0)
    df["Non-GHG (cu. m)"] = df["Non-GHG (cu. m)"].fillna(0.0)

    return df


def to_tidy_long() -> pd.DataFrame:
    """One row per (date, material) reading - the tidy long format used by
    the rest of the pipeline."""
    df = load_raw()
    tidy = df[
        [
            "Date",
            "Activity",
            "Machine",
            "Material",
            "Qty",
            "Measurement Unit",
            "Cost (INR)",
            "Non-GHG (cu. m)",
            "Waste (kgs)",
            "Water (kl)",
        ]
    ].rename(columns={"Activity": "Stage"})
    return tidy


def to_daily_aggregates() -> pd.DataFrame:
    """One row per day with total cost, per-stage cost, per-material qty,
    waste, water, and energy - the feature table forecasting is built on."""
    tidy = to_tidy_long()

    daily_total_cost = tidy.groupby("Date")["Cost (INR)"].sum().rename("total_cost_inr")
    daily_waste = tidy.groupby("Date")["Waste (kgs)"].sum().rename("total_waste_kg")
    daily_water = tidy.groupby("Date")["Water (kl)"].max().rename("water_kl")
    daily_pollutant = tidy.groupby("Date")["Non-GHG (cu. m)"].sum().rename("non_ghg_cum")

    stage_cost = (
        tidy.groupby(["Date", "Stage"])["Cost (INR)"]
        .sum()
        .unstack("Stage")
        .add_prefix("cost_")
        .fillna(0.0)
    )

    material_qty = (
        tidy.groupby(["Date", "Material"])["Qty"]
        .sum()
        .unstack("Material")
        .add_prefix("qty_")
        .fillna(0.0)
    )

    # Per-stage waste (kg), attributed via the same Stage forward-fill used
    # for cost - lets the rule layer flag which stage is generating rejects.
    stage_waste = (
        tidy.groupby(["Date", "Stage"])["Waste (kgs)"]
        .sum()
        .unstack("Stage")
        .add_prefix("waste_")
        .fillna(0.0)
    )

    daily = pd.concat(
        [daily_total_cost, daily_waste, daily_water, daily_pollutant, stage_cost, material_qty, stage_waste],
        axis=1,
    ).reset_index()

    daily["day_of_week"] = daily["Date"].dt.dayofweek
    daily["is_weekend"] = daily["day_of_week"].isin([5, 6]).astype(int)
    daily["day_of_month"] = daily["Date"].dt.day

    return daily.sort_values("Date").reset_index(drop=True)


def load_executive_table() -> pd.DataFrame:
    """The 6-row (5-stage) reference workbook that defines the target output
    shape for the classification layer."""
    return pd.read_excel(config.RAW_EXEC_XLSX, sheet_name=config.RAW_EXEC_SHEET)


def reproduce_executive_table(daily: pd.DataFrame | None = None) -> pd.DataFrame:
    """Rebuild the executive cost-optimization table straight from the raw
    30-day daily log, to verify the two source files are consistent.

    Current Cost (INR)     = sum of that stage's cost over the 30 days.
    Cost Contribution %    = stage cost / total cost across all stages.
    Estimated Annual Sav.  = 30-day stage cost * upper bound of its savings %
                              range (this is how the source workbook's numbers
                              were derived - confirmed by back-solving them).
    """
    if daily is None:
        daily = to_daily_aggregates()

    cost_cols = [c for c in daily.columns if c.startswith("cost_")]
    stage_totals = daily[cost_cols].sum().rename(
        lambda c: c.replace("cost_", "")
    )
    grand_total = stage_totals.sum()

    # Static reference metadata copied from the executive workbook's authored
    # business judgement (savings ranges / recommended methods are domain
    # decisions, not something to re-derive numerically from 30 days of data).
    meta = {
        "Dough Mixing + Fermentation": {
            "opportunity": "Ingredient yield improvement, batch optimization",
            "savings_range": "3-5%",
            "savings_upper": 0.05,
            "method": "Lean Manufacturing, Recipe Optimization",
            "priority": "High",
        },
        "Packaging": {
            "opportunity": "Packaging material reduction and line efficiency",
            "savings_range": "5-10%",
            "savings_upper": 0.10,
            "method": "Lean, Supplier Optimization",
            "priority": "High",
        },
        "Baking": {
            "opportunity": "Gas and energy optimization, heat recovery",
            "savings_range": "8-15%",
            "savings_upper": 0.15,
            "method": "Energy Optimization, Predictive Maintenance",
            "priority": "Very High",
        },
        "Moulding": {
            "opportunity": "Reduce rejects and downtime",
            "savings_range": "2-4%",
            "savings_upper": 0.04,
            "method": "Six Sigma, OEE Improvement",
            "priority": "Medium",
        },
        "Cooling": {
            "opportunity": "Airflow optimization and energy reduction",
            "savings_range": "2-5%",
            "savings_upper": 0.05,
            "method": "Energy Management",
            "priority": "Medium",
        },
    }

    rows = []
    for stage in config.STAGES:
        cost = float(stage_totals.get(stage, 0.0))
        m = meta[stage]
        rows.append(
            {
                "Production Stage": stage,
                "Current Cost (INR)": round(cost),
                "Cost Contribution %": round(100 * cost / grand_total, 2),
                "Optimization Opportunity": m["opportunity"],
                "Estimated Savings %": m["savings_range"],
                "Estimated Annual Savings (INR)": round(cost * m["savings_upper"]),
                "Recommended Method": m["method"],
                "Priority": m["priority"],
                "Executive Insight": f"Focus on {m['opportunity'].lower()} to reduce cost.",
            }
        )
    return pd.DataFrame(rows).sort_values("Current Cost (INR)", ascending=False).reset_index(drop=True)


def validation_summary() -> dict:
    """Sanity-check the raw data and report the flat-cost finding that
    motivates SYNTHETIC_VARIABILITY (see data/variability.py)."""
    raw = load_raw()
    daily = to_daily_aggregates()
    exec_ref = load_executive_table()
    exec_repro = reproduce_executive_table(daily)

    n_days = daily["Date"].nunique()
    total_cost_std = daily["total_cost_inr"].std()
    total_cost_mean = daily["total_cost_inr"].mean()
    coef_var = 0.0 if total_cost_mean == 0 else total_cost_std / total_cost_mean

    # Compare reproduced vs reference executive table (rounding tolerance)
    merged = exec_repro.merge(
        exec_ref[["Production Stage", "Current Cost (INR)", "Cost Contribution %"]],
        on="Production Stage",
        suffixes=("_repro", "_ref"),
    )
    merged["cost_diff"] = (merged["Current Cost (INR)_repro"] - merged["Current Cost (INR)_ref"]).abs()
    max_cost_diff = merged["cost_diff"].max()

    summary = {
        "rows_loaded": len(raw),
        "n_days": int(n_days),
        "expected_rows": 600,
        "expected_days": 30,
        "date_range": (str(daily["Date"].min().date()), str(daily["Date"].max().date())),
        "total_cost_mean_inr": round(float(total_cost_mean), 2),
        "total_cost_std_inr": round(float(total_cost_std), 4),
        "total_cost_coef_of_variation": round(float(coef_var), 6),
        "is_effectively_flat": bool(coef_var < 0.01),
        "executive_table_reproduction_max_abs_diff_inr": round(float(max_cost_diff), 2),
        "executive_table_reproduction_matches": bool(max_cost_diff < 1.0),
        "materials_found": sorted(raw["Material"].dropna().unique().tolist()),
        "stages_found": sorted(raw["Activity"].dropna().unique().tolist()),
        "machines_found": sorted(raw["Machine"].dropna().unique().tolist()),
        "scope_columns_empty": bool(
            raw[["Scope 1 (kgCo2e)", "Scope 2 (kgCo2e)", "Scope 3 (kgCo2e)"]].isna().all().all()
        ),
    }
    return summary


def _print_summary(s: dict) -> None:
    print("=" * 72)
    print("DATA VALIDATION SUMMARY")
    print("=" * 72)
    print(f"Rows loaded:            {s['rows_loaded']} (expected {s['expected_rows']})")
    print(f"Days covered:           {s['n_days']} (expected {s['expected_days']})")
    print(f"Date range:             {s['date_range'][0]} -> {s['date_range'][1]}")
    print(f"Stages found:           {s['stages_found']}")
    print(f"Machines found:         {s['machines_found']}")
    print(f"Materials found:        {s['materials_found']}")
    print(f"Scope 1/2/3 columns empty in source: {s['scope_columns_empty']}")
    print("-" * 72)
    print(f"Daily total cost mean:  Rs {s['total_cost_mean_inr']:,}")
    print(f"Daily total cost std:   Rs {s['total_cost_std_inr']}")
    print(f"Coefficient of variation: {s['total_cost_coef_of_variation']}")
    if s["is_effectively_flat"]:
        print(
            "  -> CONFIRMED: source data is near-constant (CoV < 1%). A naive\n"
            "     forecaster would score ~99% 'accuracy' and mean nothing.\n"
            "     SYNTHETIC_VARIABILITY should be enabled for a meaningful demo\n"
            f"     (currently: {config.SYNTHETIC_VARIABILITY})."
        )
    print("-" * 72)
    print(
        f"Executive table reproduction max |diff|: "
        f"Rs {s['executive_table_reproduction_max_abs_diff_inr']}"
    )
    print(f"Executive table reproduced correctly:    {s['executive_table_reproduction_matches']}")
    print("=" * 72)


if __name__ == "__main__":
    _print_summary(validation_summary())
