"""
FastAPI backend. Trains/forecasts once per distinct horizon (cached), and
serves the ML + rule + agent outputs as JSON to the frontend.
"""
from __future__ import annotations

import json
import sys
import threading
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Callable, Generic, TypeVar

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

_T = TypeVar("_T")


class _SingleFlightCache(Generic[_T]):
    """Like functools.lru_cache, but coalesces concurrent calls for the same
    key instead of letting them race. FastAPI runs sync routes in a
    threadpool, and the background startup warm-up runs in its own thread -
    plain lru_cache lets two threads that miss the cache at the same moment
    (e.g. a real request arriving while the warm-up is still training)
    compute the same expensive result independently, competing for CPU and
    making *both* slower than a single solo call. Here, the second caller
    blocks on a per-key lock and reuses the first caller's result instead."""

    def __init__(self, fn: Callable[..., _T]):
        self._fn = fn
        self._cache: dict[tuple, _T] = {}
        self._locks: dict[tuple, threading.Lock] = {}
        self._locks_guard = threading.Lock()

    def __call__(self, *args) -> _T:
        if args in self._cache:
            return self._cache[args]
        with self._locks_guard:
            lock = self._locks.setdefault(args, threading.Lock())
        with lock:
            if args not in self._cache:  # re-check: another thread may have finished while we waited
                self._cache[args] = self._fn(*args)
        return self._cache[args]


def _cached_forecast(horizon: int):
    return forecast(horizon)


_cached_forecast = _SingleFlightCache(_cached_forecast)


def _cached_plan(horizon: int):
    # Reuse the same (possibly already-cached) forecast/training result that
    # /forecast uses for this horizon instead of training again from
    # scratch - training (walk-forward backtest + quantile models per
    # target) is the expensive part, and doing it twice per horizon was the
    # original bug this fixes.
    return build_horizon_plan(horizon, result=_cached_forecast(horizon))


_cached_plan = _SingleFlightCache(_cached_plan)


def _cached_historical_scored():
    return add_sustainability_metrics(apply_variability(to_daily_aggregates()))


_cached_historical_scored = _SingleFlightCache(_cached_historical_scored)


def _warm_cache() -> None:
    """Best-effort background warm-up: trains and caches the default
    horizon's forecast/plan (and loads the historical data) as soon as the
    process starts, so the first real request doesn't have to wait for that
    training itself. Runs in a daemon thread from the lifespan startup hook
    so it never blocks the server from becoming ready to accept requests -
    if a request for the same horizon arrives before this finishes, it just
    computes and populates the cache itself as it always could."""
    try:
        _cached_historical_scored()
        _cached_plan(config.DEFAULT_HORIZON_DAYS)  # also populates _cached_forecast for the same horizon
    except Exception:
        pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    threading.Thread(target=_warm_cache, daemon=True).start()
    yield


app = FastAPI(title="Biscuit Cost-Optimization & Sustainability API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
