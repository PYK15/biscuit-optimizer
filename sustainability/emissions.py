"""
Computes Scope 1/2/3 GHG emissions from activity data.

The raw source data ships with `Scope 1/2/3 (kgCo2e)` columns that are
entirely empty - this module fills that gap using transparent, documented
emission factors (see config.EMISSION_FACTORS and EMISSION_FACTOR_SOURCE_NOTE).
These are demo-grade approximations, not a certified GHG inventory; every
number produced here should be read as illustrative.

Scope 1 (direct combustion):      Gas (m3) burned in the oven.
Scope 2 (purchased energy):       Grid electricity (kWh) across all machines.
Scope 3 (upstream, optional):     Packaging material and dough ingredients.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import config  # noqa: E402


def compute_emissions(daily: pd.DataFrame) -> pd.DataFrame:
    """Adds scope1_kgco2e, scope2_kgco2e, scope3_kgco2e, total_kgco2e columns
    to a daily-aggregate table (expects qty_Gas, qty_Electricity,
    qty_Packaging material, qty_Dough columns, as produced by
    data.loader.to_daily_aggregates / data.variability.apply_variability)."""
    df = daily.copy()
    f = config.EMISSION_FACTORS

    gas_qty = df.get("qty_Gas", 0.0)
    elec_qty = df.get("qty_Electricity", 0.0)
    packaging_qty = df.get("qty_Packaging material", 0.0)
    dough_qty = df.get("qty_Dough", 0.0)

    df["scope1_kgco2e"] = gas_qty * f["gas_kgco2e_per_m3"]
    df["scope2_kgco2e"] = elec_qty * f["grid_electricity_kgco2e_per_kwh"]
    df["scope3_kgco2e"] = (
        packaging_qty * f["packaging_material_kgco2e_per_kg"]
        + dough_qty * f["dough_ingredient_kgco2e_per_kg"]
    )
    df["total_kgco2e"] = df["scope1_kgco2e"] + df["scope2_kgco2e"] + df["scope3_kgco2e"]
    return df


def non_renewable_resource_index(daily_with_emissions: pd.DataFrame) -> pd.Series:
    """Share of total material *mass/volume throughput* attributable to
    non-renewable inputs (gas + grid electricity's implied fossil share +
    virgin packaging), as a 0-1 index per day. Higher = more fossil-dependent.

    We treat gas and virgin packaging as fully non-renewable, and grid
    electricity as non-renewable in proportion to a demo grid-mix assumption
    (70% fossil-derived - India's grid is coal-heavy; labeled as an
    assumption, not a measured figure).
    """
    df = daily_with_emissions
    grid_fossil_share = 0.70  # ASSUMPTION for demo: coal/gas-heavy grid mix

    gas_qty = df.get("qty_Gas", 0.0)
    elec_qty = df.get("qty_Electricity", 0.0)
    packaging_qty = df.get("qty_Packaging material", 0.0)
    dough_qty = df.get("qty_Dough", 0.0)

    non_renewable = gas_qty + elec_qty * grid_fossil_share + packaging_qty
    total_throughput = gas_qty + elec_qty + packaging_qty + dough_qty
    index = (non_renewable / total_throughput.replace(0, pd.NA)).fillna(0.0)
    return index.rename("non_renewable_index")


if __name__ == "__main__":
    from data.loader import to_daily_aggregates
    from data.variability import apply_variability

    daily = apply_variability(to_daily_aggregates())
    emissions = compute_emissions(daily)
    emissions["non_renewable_index"] = non_renewable_resource_index(emissions)

    print(config.EMISSION_FACTOR_SOURCE_NOTE)
    print()
    cols = ["Date", "scope1_kgco2e", "scope2_kgco2e", "scope3_kgco2e", "total_kgco2e", "non_renewable_index"]
    print(emissions[cols].round(2).to_string(index=False))
