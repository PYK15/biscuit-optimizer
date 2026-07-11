"""
Builds a Pydantic-AI model object from config.LLM_PROVIDER. Ollama (local,
free) is the default; switching to Claude or OpenAI is a one-line env-var
change (LLM_PROVIDER=anthropic|openai), no code changes required.

Every agent in this package must call `get_model()` here rather than
constructing a provider directly, so the whole system stays swappable.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
import config  # noqa: E402


def get_model():
    if config.LLM_PROVIDER == "none":
        # Deliberately fails fast with no network attempt - every caller in
        # agents/ wraps get_model() in a try/except and falls back to its
        # templated rule-based rationale, so this is the intended way to run
        # the whole system with zero LLM calls (used by public deployments).
        raise RuntimeError("LLM_PROVIDER=none - rule-based fallback is the active path by design.")
    if config.LLM_PROVIDER == "ollama":
        from pydantic_ai.models.openai import OpenAIChatModel
        from pydantic_ai.providers.ollama import OllamaProvider

        return OpenAIChatModel(
            config.OLLAMA_MODEL,
            provider=OllamaProvider(base_url=config.OLLAMA_BASE_URL),
        )
    if config.LLM_PROVIDER == "anthropic":
        from pydantic_ai.models.anthropic import AnthropicModel

        return AnthropicModel(config.ANTHROPIC_MODEL)
    if config.LLM_PROVIDER == "openai":
        from pydantic_ai.models.openai import OpenAIChatModel

        return OpenAIChatModel(config.OPENAI_MODEL)
    raise ValueError(f"Unknown LLM_PROVIDER: {config.LLM_PROVIDER}")
