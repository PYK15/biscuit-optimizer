"""
FastAPI backend. Trains/forecasts once per distinct horizon (cached), and
serves the ML + rule + agent outputs as JSON to the frontend.
"""
from __future__ import annotations

import json
import sys
from functools import lru_cache
from pathlib import Path

from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import config  # noqa: E402
from agents.classifier import classify_day  # noqa: E402
from agents.insight import write_insight  # noqa: E402
from agents.sustainability import advise  # noqa: E402
from data.loader import to_daily_aggregates, validation_summary  # noqa: E402
from data.variability import apply_variability  # noqa: E402
from models.forecaster import forecast, write_scorecard  # noqa: E402
from optimization.decision_engine import build_horizon_plan  # noqa: E402
from sustainability.scoring import add_sustainability_metrics, forecast_sustainability, top_reduction_levers  # noqa: E402

app = FastAPI(title="Biscuit Cost-Optimization & Sustainability API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@lru_cache(maxsize=8)
def _cached_forecast(horizon: int):
    return forecast(horizon)


@lru_cache(maxsize=8)
def _cached_plan(horizon: int):
    return build_horizon_plan(horizon)


@lru_cache(maxsize=1)
def _cached_historical_scored():
    return add_sustainability_metrics(apply_variability(to_daily_aggregates()))


def _footer() -> dict:
    return {
        "data_source": "Biscuit_Coopt_Calc_30_Days_Dummy_Data.xlsx",
        "synthetic_variability": config.SYNTHETIC_VARIABILITY,
        "llm_provider": config.LLM_PROVIDER,
    }


@app.get("/")
def root():
    return {"status": "ok", **_footer()}


@app.get("/historical")
def historical():
    daily = _cached_historical_scored()
    cols = [c for c in daily.columns if not c.endswith("_raw")]
    records = json.loads(daily[cols].to_json(orient="records", date_format="iso"))
    validation = validation_summary()
    return {"days": records, "validation": validation, "footer": _footer()}


@app.get("/forecast")
def get_forecast(horizon: int = Query(config.DEFAULT_HORIZON_DAYS, ge=1, le=30)):
    result = _cached_forecast(horizon)
    return {"forecast": json.loads(result.model_dump_json()), "footer": _footer()}


@app.get("/sustainability")
def get_sustainability(horizon: int = Query(config.DEFAULT_HORIZON_DAYS, ge=1, le=30), use_llm: bool = False):
    daily_scored = _cached_historical_scored()
    result = _cached_forecast(horizon)
    forecast_rows = forecast_sustainability(result, daily_scored)
    levers = top_reduction_levers(daily_scored)

    last_hist = daily_scored.iloc[-1]
    historical_brief = advise(
        str(last_hist["Date"].date()),
        float(last_hist["sustainability_score"]),
        float(last_hist["total_kgco2e"]),
        float(last_hist["non_renewable_index"]),
        levers,
        use_llm=use_llm,
    )

    hist_cols = [
        "Date", "scope1_kgco2e", "scope2_kgco2e", "scope3_kgco2e", "total_kgco2e",
        "non_renewable_index", "sustainability_score", "total_waste_kg", "water_kl",
    ]
    historical_records = json.loads(daily_scored[hist_cols].to_json(orient="records", date_format="iso"))

    return {
        "historical": historical_records,
        "forecast": forecast_rows,
        "top_levers": levers,
        "advisor_brief": json.loads(historical_brief.model_dump_json()),
        "footer": _footer(),
    }


@app.get("/recommendations")
def get_recommendations(horizon: int = Query(config.DEFAULT_HORIZON_DAYS, ge=1, le=30), use_llm: bool = False):
    plan = _cached_plan(horizon)
    daily_scored = _cached_historical_scored()

    days_out = []
    for day in plan["days"]:
        stage_recs = classify_day(day["stage_recommendations"], use_llm=use_llm)
        insight = write_insight(day["method_of_the_day"], sustainability_score=float(daily_scored["sustainability_score"].iloc[-1]), use_llm=use_llm)
        days_out.append(
            {
                "date": day["date"],
                "stage_recommendations": [json.loads(r.model_dump_json()) for r in stage_recs],
                "method_of_the_day": day["method_of_the_day"],
                "executive_insight": json.loads(insight.model_dump_json()),
            }
        )

    return {
        "horizon_days": plan["horizon_days"],
        "days": days_out,
        "footer": _footer(),
    }


@app.get("/scorecard")
def get_scorecard(horizon: int = Query(config.DEFAULT_HORIZON_DAYS, ge=1, le=30)):
    result = _cached_forecast(horizon)
    write_scorecard(result)
    scorecard_path = config.REPORTS_DIR / "model_scorecard.json"
    return {"scorecard": json.loads(scorecard_path.read_text()), "footer": _footer()}
