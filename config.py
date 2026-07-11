"""
Central configuration for the biscuit cost-optimization / sustainability system.
All tunable flags, emission factors, and provider settings live here so the rest
of the codebase never hardcodes a magic number.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
ROOT_DIR = Path(__file__).resolve().parent
DATA_DIR = ROOT_DIR / "data"
REPORTS_DIR = ROOT_DIR / "reports"
REPORTS_DIR.mkdir(exist_ok=True)

RAW_DAILY_XLSX = DATA_DIR / "Biscuit_Coopt_Calc_30_Days_Dummy_Data.xlsx"
RAW_DAILY_SHEET = "30_Days_Dummy_Data"

RAW_EXEC_XLSX = DATA_DIR / "Biscuit_Executive_Cost_Optimization_Formatted.xlsx"
RAW_EXEC_SHEET = "Executive Cost Optimization"

# ---------------------------------------------------------------------------
# Forecasting
# ---------------------------------------------------------------------------
DEFAULT_HORIZON_DAYS = 7
RANDOM_SEED = 42

# The raw 30-day dummy data is near-deterministic (flat daily cost, tiny
# jitter). SYNTHETIC_VARIABILITY=True overlays a documented, seeded set of
# demand drivers (weekly seasonality, monthly trend, price drift, noise) on
# top of the raw series so the forecasting task is genuinely non-trivial.
# See data/variability.py for exactly what is added and why.
SYNTHETIC_VARIABILITY = os.getenv("SYNTHETIC_VARIABILITY", "True").lower() in (
    "1",
    "true",
    "yes",
)

# ---------------------------------------------------------------------------
# LLM provider (Pydantic-AI agents reason over ML outputs only - never forecast)
# ---------------------------------------------------------------------------
# Default is "ollama" for local/dev convenience (a local Ollama server is
# usually already running). Public deployments should set LLM_PROVIDER=none
# explicitly - every agent already has a templated rule-based fallback, so
# "none" makes that fallback the only active path with no network calls and
# no API key required. "none" is also what any unset/misconfigured provider
# safely degrades to via agents/providers.py.
LLM_PROVIDER = os.getenv("LLM_PROVIDER", "ollama")  # none | ollama | anthropic | openai
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.1")
OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/v1")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# ---------------------------------------------------------------------------
# Deployment / server
# ---------------------------------------------------------------------------
# PORT is read by the Procfile's start command ($PORT), not by this file
# directly - kept here too so any code that wants the port has one source of
# truth instead of a second hardcoded default.
PORT = int(os.getenv("PORT", "8000"))

# Comma-separated list of allowed CORS origins for the deployed frontend, e.g.
# "https://my-app.vercel.app,https://my-app-git-main.vercel.app". Defaults to
# "*" (allow everything) for local dev and initial deployment testing - lock
# this down to the real frontend origin(s) once known (see DEPLOYMENT.md).
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",") if o.strip()]

# ---------------------------------------------------------------------------
# Emission factors (documented assumptions for a demo - NOT audited figures)
# ---------------------------------------------------------------------------
# Sources (approximate, publicly cited ranges used for a representative demo):
#   - Grid electricity (India, CEA baseline ~2023 CO2 emission database):
#     ~0.71-0.82 kgCO2e/kWh depending on state/year -> we use 0.79 kgCO2e/kWh.
#   - Piped natural gas combustion (IPCC/DEFRA style factor):
#     ~2.0 kgCO2e/m3 (natural gas, stoichiometric combustion, demo value).
#   - Packaging material (generic flexible plastic/board blend, cradle-to-gate,
#     DEFRA/ecoinvent style average): ~1.5 kgCO2e/kg (Scope 3, upstream).
#   - Ingredient (wheat flour + sugar blend cradle-to-gate average):
#     ~0.6 kgCO2e/kg (Scope 3, upstream).
# All factors are clearly labeled "assumed for demo" in reports/UI.
EMISSION_FACTORS = {
    "grid_electricity_kgco2e_per_kwh": 0.79,   # Scope 2
    "gas_kgco2e_per_m3": 2.0,                   # Scope 1
    "packaging_material_kgco2e_per_kg": 1.5,    # Scope 3 (upstream)
    "dough_ingredient_kgco2e_per_kg": 0.6,      # Scope 3 (upstream)
}
EMISSION_FACTOR_SOURCE_NOTE = (
    "Emission factors are demo assumptions based on publicly cited approximate "
    "ranges (India grid intensity ~0.71-0.82 kgCO2e/kWh -> using 0.79; natural "
    "gas combustion ~2.0 kgCO2e/m3; packaging ~1.5 kgCO2e/kg; dough ingredients "
    "~0.6 kgCO2e/kg). Not sourced from a certified inventory - replace with "
    "site-specific factors for production use."
)

# ---------------------------------------------------------------------------
# Cost-bearing / non-cost-bearing material classification (from raw schema)
# ---------------------------------------------------------------------------
COST_BEARING_MATERIALS = {"Dough", "Electricity", "Gas", "Packaging material", "Lubricant"}
WASTE_MATERIALS = {"Ingredient waste", "Biscuit waste", "Packaging waste"}
POLLUTANT_MATERIALS = {"Ingredient pollutant", "Gas pollutant"}

STAGES = [
    "Dough Mixing + Fermentation",
    "Moulding",
    "Baking",
    "Cooling",
    "Packaging",
]

MACHINES = ["Mixer", "Laminator", "Gauge Roll", "Rotary Cutter", "Oven", "Conveyor", "Packer"]

OPTIMIZATION_METHODS = [
    "Lean Manufacturing",
    "JIT",
    "Six Sigma",
    "Predictive Maintenance (TPM)",
    "Energy Optimization",
    "Kaizen",
    "Supplier Optimization",
    "Recipe Optimization",
    "OEE Improvement",
]

PRIORITIES = ["Low", "Medium", "High", "Very High"]
