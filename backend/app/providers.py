"""LLM Provider Registry — presets for OpenAI-compatible API providers.

Every provider here exposes an OpenAI-compatible /chat/completions endpoint.
The agent proxy uses base_url + "/chat/completions" for all of them, so no
per-provider streaming logic is needed.

Users pick a provider in the app → we fill in base_url and default model.
They can still override model/base_url per-user via AgentConfig.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass(frozen=True)
class ProviderPreset:
    """Immutable descriptor for a supported LLM provider."""

    id: str
    name: str
    base_url: str
    default_model: str
    requires_api_key: bool = True
    description: str = ""
    models: list[str] = field(default_factory=list)


# ── Provider Presets ─────────────────────────────────────────────────────────

PROVIDERS: dict[str, ProviderPreset] = {}


def _register(p: ProviderPreset) -> None:
    PROVIDERS[p.id] = p


_register(ProviderPreset(
    id="openai",
    name="OpenAI",
    base_url="https://api.openai.com/v1",
    default_model="gpt-4o",
    description="OpenAI official API (GPT-4o, GPT-4o-mini, o1, o3, etc.)",
    models=["gpt-4o", "gpt-4o-mini", "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano", "o1", "o3", "o3-mini", "o4-mini"],
))

_register(ProviderPreset(
    id="openrouter",
    name="OpenRouter",
    base_url="https://openrouter.ai/api/v1",
    default_model="stepfun/step-3.5-flash:free",
    description="Unified gateway to 200+ models (free and paid). Works in all regions.",
    models=[
        "openai/gpt-4o", "anthropic/claude-sonnet-4", "google/gemini-2.5-flash-preview",
        "deepseek/deepseek-chat-v3-0324:free", "stepfun/step-3.5-flash:free",
        "meta-llama/llama-4-maverick:free",
    ],
))

_register(ProviderPreset(
    id="siliconflow",
    name="SiliconFlow",
    base_url="https://api.siliconflow.cn/v1",
    default_model="deepseek-ai/DeepSeek-V3",
    description="Chinese cloud AI platform. Fast inference, competitive pricing.",
    models=[
        "deepseek-ai/DeepSeek-V3", "deepseek-ai/DeepSeek-R1",
        "Qwen/Qwen3-8B", "Qwen/Qwen3-30B-A3B",
        "Pro/deepseek-ai/DeepSeek-V3", "Pro/deepseek-ai/DeepSeek-R1",
    ],
))

_register(ProviderPreset(
    id="ollama",
    name="Ollama (Local)",
    base_url="http://localhost:11434/v1",
    default_model="llama3.2",
    requires_api_key=False,
    description="Run models locally on your machine. Free, private, no API key needed.",
    models=["llama3.2", "llama3.1", "qwen2.5", "deepseek-r1", "gemma2", "mistral", "phi3"],
))

_register(ProviderPreset(
    id="deepseek",
    name="DeepSeek",
    base_url="https://api.deepseek.com/v1",
    default_model="deepseek-chat",
    description="DeepSeek official API. Strong reasoning models at low cost.",
    models=["deepseek-chat", "deepseek-reasoner"],
))

_register(ProviderPreset(
    id="groq",
    name="Groq",
    base_url="https://api.groq.com/openai/v1",
    default_model="llama-3.3-70b-versatile",
    description="Ultra-fast inference on custom LPU hardware. Free tier available.",
    models=["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "gemma2-9b-it", "mistral-saba-24b"],
))

_register(ProviderPreset(
    id="together",
    name="Together AI",
    base_url="https://api.together.xyz/v1",
    default_model="meta-llama/Llama-3.3-70B-Instruct-Turbo",
    description="Open-source model hosting with fast inference.",
    models=[
        "meta-llama/Llama-3.3-70B-Instruct-Turbo",
        "deepseek-ai/DeepSeek-R1",
        "Qwen/Qwen2.5-72B-Instruct-Turbo",
    ],
))

_register(ProviderPreset(
    id="custom",
    name="Custom (OpenAI-compatible)",
    base_url="",
    default_model="",
    requires_api_key=True,
    description="Any OpenAI-compatible API. Enter your own base URL and model.",
    models=[],
))


def get_provider(provider_id: str) -> ProviderPreset | None:
    """Look up a provider by ID. Returns None for unknown IDs."""
    return PROVIDERS.get(provider_id)


def list_providers() -> list[dict]:
    """Return all providers as dicts suitable for API responses."""
    return [
        {
            "id": p.id,
            "name": p.name,
            "base_url": p.base_url,
            "default_model": p.default_model,
            "requires_api_key": p.requires_api_key,
            "description": p.description,
            "models": p.models,
        }
        for p in PROVIDERS.values()
    ]
