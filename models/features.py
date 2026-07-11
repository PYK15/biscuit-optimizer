"""
Feature engineering shared by backtesting and forecasting: lag features,
rolling means, and calendar features, all derived purely from the target
series itself plus its date - no target leaks into another target's features.
"""
from __future__ import annotations

import numpy as np
import pandas as pd

FEATURE_COLUMNS = ["lag1", "lag7", "roll_mean3", "roll_mean7", "day_of_week", "is_weekend", "day_of_month", "trend_idx"]


def calendar_features(dates: pd.Series, trend_origin: pd.Timestamp) -> pd.DataFrame:
    dates = pd.to_datetime(dates)
    return pd.DataFrame(
        {
            "day_of_week": dates.dt.dayofweek.to_numpy(),
            "is_weekend": dates.dt.dayofweek.isin([5, 6]).astype(int).to_numpy(),
            "day_of_month": dates.dt.day.to_numpy(),
            "trend_idx": (dates - trend_origin).dt.days.to_numpy(),
        },
        index=dates.index if hasattr(dates, "index") else None,
    )


def build_feature_table(dates: pd.Series, values: pd.Series) -> pd.DataFrame:
    """Builds the full lag/rolling/calendar feature table for one target
    series. Rows whose lag7 is undefined (first 7 observations) are dropped -
    the caller receives a feature table aligned 1:1 with a trimmed `y`.
    """
    dates = pd.to_datetime(pd.Series(dates).reset_index(drop=True))
    values = pd.Series(values).reset_index(drop=True)

    df = pd.DataFrame({"Date": dates, "y": values})
    df["lag1"] = df["y"].shift(1)
    df["lag7"] = df["y"].shift(7)
    df["roll_mean3"] = df["y"].shift(1).rolling(3).mean()
    df["roll_mean7"] = df["y"].shift(1).rolling(7).mean()

    cal = calendar_features(df["Date"], trend_origin=df["Date"].min())
    df = pd.concat([df, cal], axis=1)

    df = df.dropna().reset_index(drop=True)
    return df


def next_step_features(
    history_dates: list[pd.Timestamp],
    history_values: list[float],
    next_date: pd.Timestamp,
    trend_origin: pd.Timestamp,
) -> pd.DataFrame:
    """Builds the feature row for a single future date given the full history
    (actual + previously-forecast values appended) seen so far - used for
    recursive multi-step forecasting."""
    values = pd.Series(history_values)
    lag1 = values.iloc[-1]
    lag7 = values.iloc[-7] if len(values) >= 7 else values.mean()
    roll_mean3 = values.iloc[-3:].mean()
    roll_mean7 = values.iloc[-7:].mean() if len(values) >= 7 else values.mean()

    cal = calendar_features(pd.Series([next_date]), trend_origin=trend_origin)
    row = pd.DataFrame(
        {
            "lag1": [lag1],
            "lag7": [lag7],
            "roll_mean3": [roll_mean3],
            "roll_mean7": [roll_mean7],
            **{c: cal[c].to_numpy() for c in ["day_of_week", "is_weekend", "day_of_month", "trend_idx"]},
        }
    )
    return row[FEATURE_COLUMNS]
