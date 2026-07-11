"""
Overlays realistic, documented demand drivers on top of the near-constant raw
30-day dummy series so that forecasting is a genuine learning task rather than
"predict the same number every day".

WHAT THIS ADDS AND WHY (all seeded with config.RANDOM_SEED, fully deterministic):

1. Weekly seasonality  - Saturday output ~12% lower, Sunday ~22% lower, than a
   weekday, reflecting reduced weekend staffing/output common in FMCG plants.
2. Monthly trend       - a mild +0.35%/day cumulative ramp in production
   volume, reflecting gradual demand growth across the month.
3. Input-price drift   - Gas and Electricity unit prices follow a slow,
   independent random walk (~+/-8% by day 30) layered on top of the flat
   contract price in the source data, reflecting real commodity/tariff
   volatility that a flat 30-day dummy log cannot show.
4. Gaussian noise       - +/-3% multiplicative noise on quantities, +/-2% on
   cost, to reflect normal day-to-day operational variance.

Toggle with config.SYNTHETIC_VARIABILITY. When False, `apply_variability`
returns the input unchanged and the caller is expected to surface the honesty
banner (see data/loader.py validation_summary / API layer).
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import config  # noqa: E402

QTY_COLS_PREFIX = "qty_"
COST_COLS_PREFIX = "cost_"

# Materials whose unit price is allowed to drift (commodity/tariff exposure).
PRICE_DRIFT_MATERIALS = ["Electricity", "Gas", "Packaging material", "Dough"]
PRICE_DRIFT_MAX_PCT = {
    "Electricity": 0.06,
    "Gas": 0.08,
    "Packaging material": 0.05,
    "Dough": 0.04,
}


def _weekly_factor(dates: pd.Series) -> np.ndarray:
    dow = dates.dt.dayofweek.to_numpy()  # 0=Mon ... 6=Sun
    factor = np.ones(len(dow))
    factor[dow == 5] = 0.88  # Saturday
    factor[dow == 6] = 0.78  # Sunday
    return factor


def _monthly_trend(dates: pd.Series, daily_growth: float = 0.0035) -> np.ndarray:
    day_index = (dates - dates.min()).dt.days.to_numpy()
    return 1.0 + daily_growth * day_index


def _price_drift(dates: pd.Series, material: str, rng: np.random.Generator) -> np.ndarray:
    """Deterministic (seeded) smooth random walk, scaled to stay within
    +/- PRICE_DRIFT_MAX_PCT[material] over the observed date range."""
    n = len(dates)
    steps = rng.normal(loc=0.0, scale=1.0, size=n)
    walk = np.cumsum(steps)
    max_abs = np.abs(walk).max() or 1.0
    scaled = walk / max_abs * PRICE_DRIFT_MAX_PCT[material]
    return 1.0 + scaled


def _noise(n: int, scale: float, rng: np.random.Generator) -> np.ndarray:
    return rng.normal(loc=1.0, scale=scale, size=n)


def build_variability_factors(dates: pd.Series, seed: int = config.RANDOM_SEED) -> pd.DataFrame:
    """Returns a DataFrame indexed like `dates` with the multiplicative
    factors described in the module docstring, so callers can inspect /
    plot exactly what was injected (transparency requirement)."""
    rng = np.random.default_rng(seed)
    dates = pd.to_datetime(dates).reset_index(drop=True)

    factors = pd.DataFrame({"Date": dates})
    factors["weekly_factor"] = _weekly_factor(dates)
    factors["trend_factor"] = _monthly_trend(dates)
    factors["qty_noise"] = _noise(len(dates), 0.03, rng)
    factors["cost_noise"] = _noise(len(dates), 0.02, rng)

    for material in PRICE_DRIFT_MATERIALS:
        factors[f"price_drift_{material}"] = _price_drift(dates, material, rng)

    return factors


def apply_variability(daily: pd.DataFrame, seed: int = config.RANDOM_SEED) -> pd.DataFrame:
    """Applies the documented variability overlay to a daily-aggregate table
    (as produced by data.loader.to_daily_aggregates). Original columns are
    preserved with a `_raw` suffix so the effect of the overlay is auditable.

    No-op (returns `daily` unchanged) when config.SYNTHETIC_VARIABILITY is
    False - callers must surface the honesty banner themselves in that case.
    """
    if not config.SYNTHETIC_VARIABILITY:
        return daily.copy()

    df = daily.copy()
    factors = build_variability_factors(df["Date"], seed=seed)
    df = df.merge(factors, on="Date", how="left")

    volume_factor = df["weekly_factor"] * df["trend_factor"] * df["qty_noise"]

    qty_cols = [c for c in df.columns if c.startswith(QTY_COLS_PREFIX)]
    cost_cols = [c for c in df.columns if c.startswith(COST_COLS_PREFIX)]
    waste_stage_cols = [c for c in df.columns if c.startswith("waste_")]

    for col in qty_cols:
        df[f"{col}_raw"] = df[col]
        df[col] = df[col] * volume_factor

    for col in waste_stage_cols:
        df[f"{col}_raw"] = df[col]
        df[col] = df[col] * volume_factor

    for col in cost_cols:
        df[f"{col}_raw"] = df[col]
        df[col] = df[col] * volume_factor * df["cost_noise"]

    df["total_waste_kg_raw"] = df["total_waste_kg"]
    df["total_waste_kg"] = df["total_waste_kg"] * volume_factor

    df["water_kl_raw"] = df["water_kl"]
    df["water_kl"] = df["water_kl"] * volume_factor

    df["total_cost_inr_raw"] = df["total_cost_inr"]
    df["total_cost_inr"] = df[cost_cols].sum(axis=1)

    # Apply material-specific price drift on top of volume for the materials
    # whose unit price we model as drifting (Electricity, Gas, Packaging
    # material, Dough) - both at the quantity-weighted material level and
    # folded back into total cost.
    material_to_qty_col = {
        "Electricity": "qty_Electricity",
        "Gas": "qty_Gas",
        "Packaging material": "qty_Packaging material",
        "Dough": "qty_Dough",
    }
    for material, qty_col in material_to_qty_col.items():
        drift_col = f"price_drift_{material}"
        # Reflect price drift in whichever stage-cost column carries this
        # material's spend so total cost moves with commodity price, not
        # just volume. Dough/Gas/Packaging map 1:1 to a stage; Electricity
        # is split across all stage cost columns proportionally.
        if material == "Electricity":
            elec_cost_cols = [c for c in cost_cols]  # electricity spread across all stages
            for c in elec_cost_cols:
                df[c] = df[c] * (0.5 + 0.5 * df[drift_col])  # damped: elec is part of blended stage cost
        elif material == "Dough":
            col = "cost_Dough Mixing + Fermentation"
            if col in df.columns:
                df[col] = df[col] * df[drift_col]
        elif material == "Gas":
            col = "cost_Baking"
            if col in df.columns:
                df[col] = df[col] * df[drift_col]
        elif material == "Packaging material":
            col = "cost_Packaging"
            if col in df.columns:
                df[col] = df[col] * df[drift_col]

    df["total_cost_inr"] = df[cost_cols].sum(axis=1)

    return df


if __name__ == "__main__":
    from data.loader import to_daily_aggregates

    daily = to_daily_aggregates()
    aug = apply_variability(daily)
    print("SYNTHETIC_VARIABILITY:", config.SYNTHETIC_VARIABILITY)
    print(
        aug[["Date", "total_cost_inr", "total_cost_inr_raw"]]
        .assign(pct_change=lambda d: 100 * (d["total_cost_inr"] / d["total_cost_inr_raw"] - 1))
        .round(2)
        .to_string(index=False)
    )
    print(f"\nTotal cost CoV after overlay: {aug['total_cost_inr'].std() / aug['total_cost_inr'].mean():.4f}")
