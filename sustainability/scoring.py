"""
Rolls emissions, waste, water and non-renewable-resource usage into a single
0-100 Sustainability Score, plus the waste/water intensity metrics the
dashboard and agents consume.

FORMULA (documented, not a standard):
  score = 100 - 100 * (
        0.40 * norm(emissions_intensity)
      + 0.25 * norm(non_renewable_index)
      + 0.20 * norm(waste_intensity)
      + 0.15 * norm(water_intensity)
  )
  where each norm(x) maps a metric to [0, 1] via a *relative-deviation* scale
  centered on that metric's own historical mean: norm(x) = clip(0.5 + (x -
  mean) / mean, 0, 1). A value exactly at the historical mean scores 0.5; a
  value 50% above/below the mean saturates to 1.0/0.0. This is deliberately
  NOT min-max scaling against the observed 30-day range - with a near-flat
  baseline series, min-max would blow up sub-1% noise into full 0-100 score
  swings that look dramatic but are not economically meaningful. The
  relative-deviation scale keeps score movements proportional to how much the
  underlying metric actually changed.

Higher score = better (lower emissions/waste/water/fossil-dependence per unit
of output). Weights reflect that carbon intensity is the single largest
factor a biscuit plant can act on (energy/gas), followed by fossil dependence,
then waste, then water.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import config  # noqa: E402
from sustainability.emissions import compute_emissions, non_renewable_resource_index  # noqa: E402

SCORE_WEIGHTS = {
    "emissions_intensity": 0.40,
    "non_renewable_index": 0.25,
    "waste_intensity": 0.20,
    "water_intensity": 0.15,
}


def _relative_norm(s: pd.Series) -> pd.Series:
    """Maps a metric to [0, 1] relative to its own historical mean (0.5 =
    at-mean; saturates at +/-50% deviation). See module docstring for why
    this is used instead of min-max scaling."""
    mean = s.mean()
    if abs(mean) < 1e-9:
        return pd.Series(0.5, index=s.index)
    return (0.5 + (s - mean) / mean).clip(0.0, 1.0)


def add_sustainability_metrics(daily: pd.DataFrame) -> pd.DataFrame:
    """Adds emissions, intensity, non-renewable index and the 0-100
    sustainability score to a daily-aggregate table."""
    df = compute_emissions(daily)
    df["non_renewable_index"] = non_renewable_resource_index(df)

    output_qty = df.get("qty_Dough", pd.Series(1.0, index=df.index)).replace(0, pd.NA)
    df["emissions_intensity"] = (df["total_kgco2e"] / output_qty).fillna(0.0)
    df["waste_intensity"] = (df["total_waste_kg"] / output_qty).fillna(0.0)
    df["water_intensity"] = (df["water_kl"] / output_qty).fillna(0.0)

    norm_emissions = _relative_norm(df["emissions_intensity"])
    norm_nonrenew = _relative_norm(df["non_renewable_index"])
    norm_waste = _relative_norm(df["waste_intensity"])
    norm_water = _relative_norm(df["water_intensity"])

    penalty = (
        SCORE_WEIGHTS["emissions_intensity"] * norm_emissions
        + SCORE_WEIGHTS["non_renewable_index"] * norm_nonrenew
        + SCORE_WEIGHTS["waste_intensity"] * norm_waste
        + SCORE_WEIGHTS["water_intensity"] * norm_water
    )
    df["sustainability_score"] = (100 * (1 - penalty)).round(1)
    return df


def top_reduction_levers(daily_scored: pd.DataFrame, n: int = 3) -> list[dict]:
    """Ranks the four scoring components by their average normalized penalty
    contribution over the period, returning the top-n as actionable levers."""
    df = daily_scored
    components = {
        "emissions_intensity": ("Reduce gas & grid-electricity intensity per unit output", "Energy Optimization"),
        "non_renewable_index": ("Shift packaging/energy mix away from fossil-derived inputs", "Supplier Optimization"),
        "waste_intensity": ("Cut ingredient/biscuit/packaging waste per unit output", "Six Sigma / Kaizen"),
        "water_intensity": ("Reduce water use per unit output (cooling/cleaning)", "Lean Manufacturing"),
    }
    scores = {}
    for key in components:
        norm = _relative_norm(df[key])
        scores[key] = float((norm * SCORE_WEIGHTS[key]).mean())

    ranked = sorted(scores.items(), key=lambda kv: kv[1], reverse=True)[:n]
    return [
        {
            "driver": key,
            "description": components[key][0],
            "suggested_method": components[key][1],
            "relative_contribution": round(100 * value / (sum(scores.values()) or 1), 1),
        }
        for key, value in ranked
    ]


def _relative_norm_scalar(value: float, mean: float) -> float:
    if abs(mean) < 1e-9:
        return 0.5
    return min(max(0.5 + (value - mean) / mean, 0.0), 1.0)


def forecast_sustainability(forecast_result, historical_scored: pd.DataFrame) -> list[dict]:
    """Projects the sustainability score forward for each day in a
    models.forecaster.ForecastResult, using the already-forecast qty/waste/
    water targets (qty_Gas, qty_Electricity, qty_Packaging material,
    qty_Dough, total_waste_kg, water_kl) and the emission factors from
    sustainability/emissions.py. Normalizes against the *historical* mean of
    each intensity metric so forecast and historical scores sit on the same
    scale."""
    f = config.EMISSION_FACTORS
    hist_means = {
        "emissions_intensity": historical_scored["emissions_intensity"].mean(),
        "non_renewable_index": historical_scored["non_renewable_index"].mean(),
        "waste_intensity": historical_scored["waste_intensity"].mean(),
        "water_intensity": historical_scored["water_intensity"].mean(),
    }

    rows = []
    for i in range(forecast_result.horizon_days):
        date = forecast_result.targets["total_cost_inr"].points[i].date
        gas = forecast_result.targets["qty_Gas"].points[i].expected
        elec = forecast_result.targets["qty_Electricity"].points[i].expected
        packaging = forecast_result.targets["qty_Packaging material"].points[i].expected
        dough = max(forecast_result.targets["qty_Dough"].points[i].expected, 1e-9)
        waste = forecast_result.targets["total_waste_kg"].points[i].expected
        water = forecast_result.targets["water_kl"].points[i].expected

        scope1 = gas * f["gas_kgco2e_per_m3"]
        scope2 = elec * f["grid_electricity_kgco2e_per_kwh"]
        scope3 = packaging * f["packaging_material_kgco2e_per_kg"] + dough * f["dough_ingredient_kgco2e_per_kg"]
        total_kgco2e = scope1 + scope2 + scope3

        non_renewable_index = (gas + elec * 0.70 + packaging) / max(gas + elec + packaging + dough, 1e-9)
        emissions_intensity = total_kgco2e / dough
        waste_intensity = waste / dough
        water_intensity = water / dough

        penalty = (
            SCORE_WEIGHTS["emissions_intensity"] * _relative_norm_scalar(emissions_intensity, hist_means["emissions_intensity"])
            + SCORE_WEIGHTS["non_renewable_index"] * _relative_norm_scalar(non_renewable_index, hist_means["non_renewable_index"])
            + SCORE_WEIGHTS["waste_intensity"] * _relative_norm_scalar(waste_intensity, hist_means["waste_intensity"])
            + SCORE_WEIGHTS["water_intensity"] * _relative_norm_scalar(water_intensity, hist_means["water_intensity"])
        )
        rows.append(
            {
                "date": date,
                "scope1_kgco2e": round(scope1, 2),
                "scope2_kgco2e": round(scope2, 2),
                "scope3_kgco2e": round(scope3, 2),
                "total_kgco2e": round(total_kgco2e, 2),
                "non_renewable_index": round(non_renewable_index, 4),
                "sustainability_score": round(100 * (1 - penalty), 1),
            }
        )
    return rows


if __name__ == "__main__":
    from data.loader import to_daily_aggregates
    from data.variability import apply_variability

    daily = apply_variability(to_daily_aggregates())
    scored = add_sustainability_metrics(daily)
    print(scored[["Date", "sustainability_score", "emissions_intensity", "non_renewable_index"]].round(3).to_string(index=False))
    print("\nTop reduction levers:")
    for lever in top_reduction_levers(scored):
        print(" -", lever)
