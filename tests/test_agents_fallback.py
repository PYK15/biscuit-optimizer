"""
Verifies the graceful-degradation requirement: every agent must return valid
output even when the LLM is unavailable, never crash the demo. We simulate
"LLM unreachable" by either passing use_llm=False (the explicit path) or by
monkeypatching the LLM call to raise (the implicit failure path).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest

from optimization.decision_engine import build_horizon_plan
from agents.classifier import classify_day
from agents.sustainability import advise
from agents.insight import write_insight


def _sample_recs():
    plan = build_horizon_plan(horizon=1)
    return plan["days"][0]["stage_recommendations"], plan["days"][0]["method_of_the_day"]


def test_classifier_explicit_fallback_returns_valid_recommendations():
    recs, _ = _sample_recs()
    out = classify_day(recs, use_llm=False)
    assert len(out) == len(recs)
    for r in out:
        assert r.source == "rule_fallback"
        assert r.rationale  # non-empty templated rationale


def test_classifier_survives_llm_exception(monkeypatch):
    import agents.classifier as classifier_module

    async def _boom(_recs):
        raise RuntimeError("simulated Ollama connection failure")

    monkeypatch.setattr(classifier_module, "_run_llm", _boom)
    recs, _ = _sample_recs()
    out = classifier_module.classify_day(recs, use_llm=True)
    assert len(out) == len(recs)
    assert all(r.source == "rule_fallback" for r in out)


def test_sustainability_advisor_fallback():
    brief = advise("2026-05-30", 50.0, 3000.0, 0.5, [{"driver": "x", "description": "d", "suggested_method": "m", "relative_contribution": 100.0}], use_llm=False)
    assert brief.source == "rule_fallback"
    assert brief.narrative and brief.sdg_note


def test_insight_writer_fallback():
    _, motd = _sample_recs()
    insight = write_insight(motd, sustainability_score=50.0, use_llm=False)
    assert insight.source == "rule_fallback"
    assert insight.headline and insight.narrative
