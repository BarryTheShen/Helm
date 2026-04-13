"""Tests for the provider registry and provider resolution logic."""

import sys
from pathlib import Path
from unittest.mock import MagicMock

import pytest

# Add backend/app to sys.path so imports work without install
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.providers import (
    PROVIDERS,
    get_provider,
    list_providers,
    ProviderPreset,
)


# ── Registry Tests ────────────────────────────────────────────────────────────

class TestProviderRegistry:
    def test_known_providers_exist(self):
        expected = {"openai", "openrouter", "siliconflow", "ollama", "deepseek", "groq", "together", "custom"}
        assert expected == set(PROVIDERS.keys())

    def test_get_provider_returns_preset(self):
        p = get_provider("openai")
        assert p is not None
        assert p.name == "OpenAI"
        assert p.base_url == "https://api.openai.com/v1"

    def test_get_provider_unknown_returns_none(self):
        assert get_provider("nonexistent") is None

    def test_ollama_no_api_key_required(self):
        p = get_provider("ollama")
        assert p is not None
        assert p.requires_api_key is False

    def test_siliconflow_preset(self):
        p = get_provider("siliconflow")
        assert p is not None
        assert "siliconflow" in p.base_url
        assert p.default_model == "deepseek-ai/DeepSeek-V3"
        assert p.requires_api_key is True

    def test_deepseek_preset(self):
        p = get_provider("deepseek")
        assert p is not None
        assert p.base_url == "https://api.deepseek.com/v1"
        assert "deepseek-chat" in p.models

    def test_groq_preset(self):
        p = get_provider("groq")
        assert p is not None
        assert "groq.com" in p.base_url

    def test_together_preset(self):
        p = get_provider("together")
        assert p is not None
        assert "together.xyz" in p.base_url

    def test_custom_provider_has_empty_defaults(self):
        p = get_provider("custom")
        assert p is not None
        assert p.base_url == ""
        assert p.default_model == ""
        assert p.models == []

    def test_list_providers_returns_all(self):
        result = list_providers()
        assert len(result) == len(PROVIDERS)
        ids = {p["id"] for p in result}
        assert "openai" in ids
        assert "siliconflow" in ids
        assert "ollama" in ids

    def test_list_providers_dict_shape(self):
        result = list_providers()
        for p in result:
            assert "id" in p
            assert "name" in p
            assert "base_url" in p
            assert "default_model" in p
            assert "requires_api_key" in p
            assert "description" in p
            assert "models" in p

    def test_all_providers_have_descriptions(self):
        for pid, p in PROVIDERS.items():
            assert p.description, f"Provider {pid} has no description"

    def test_all_cloud_providers_require_api_key(self):
        cloud = ["openai", "openrouter", "siliconflow", "deepseek", "groq", "together"]
        for pid in cloud:
            assert PROVIDERS[pid].requires_api_key, f"{pid} should require API key"

    def test_provider_preset_is_frozen(self):
        p = get_provider("openai")
        with pytest.raises(AttributeError):
            p.name = "Modified"  # type: ignore


# ── Provider Resolution Tests ─────────────────────────────────────────────────

class TestProviderResolution:
    """Test _resolve_provider_settings from agent_proxy."""

    def _make_config(self, **kwargs) -> MagicMock:
        config = MagicMock()
        config.provider = kwargs.get("provider", "openai")
        config.api_key_encrypted = kwargs.get("api_key_encrypted", None)
        config.base_url = kwargs.get("base_url", None)
        config.model = kwargs.get("model", None)
        return config

    def test_resolve_ollama_no_key_needed(self):
        from app.services.agent_proxy import _resolve_provider_settings
        config = self._make_config(provider="ollama")
        api_key, base_url, model = _resolve_provider_settings(config)
        assert api_key == "ollama"  # dummy key
        assert "11434" in base_url
        assert model == "llama3.2"

    def test_resolve_siliconflow_uses_env(self):
        from app.services.agent_proxy import _resolve_provider_settings
        from app.config import settings
        original = settings.siliconflow_api_key
        try:
            settings.siliconflow_api_key = "sf-test-key-123"
            config = self._make_config(provider="siliconflow")
            api_key, base_url, model = _resolve_provider_settings(config)
            assert api_key == "sf-test-key-123"
            assert "siliconflow" in base_url
            assert model == "deepseek-ai/DeepSeek-V3"
        finally:
            settings.siliconflow_api_key = original

    def test_resolve_none_config_uses_default_provider(self):
        from app.services.agent_proxy import _resolve_provider_settings
        from app.config import settings
        original_provider = settings.default_provider
        original_key = settings.openrouter_api_key
        try:
            settings.default_provider = "openrouter"
            settings.openrouter_api_key = "or-test-key"
            api_key, base_url, model = _resolve_provider_settings(None)
            assert api_key == "or-test-key"
            assert "openrouter" in base_url
        finally:
            settings.default_provider = original_provider
            settings.openrouter_api_key = original_key

    def test_resolve_user_overrides_take_priority(self):
        from app.services.agent_proxy import _resolve_provider_settings
        config = self._make_config(
            provider="openai",
            base_url="https://custom.example.com/v1",
            model="custom-model",
        )
        _, base_url, model = _resolve_provider_settings(config)
        assert base_url == "https://custom.example.com/v1"
        assert model == "custom-model"

    def test_resolve_fallback_to_openrouter_when_no_key(self):
        from app.services.agent_proxy import _resolve_provider_settings
        from app.config import settings
        original_dk = settings.deepseek_api_key
        original_or = settings.openrouter_api_key
        try:
            settings.deepseek_api_key = ""
            settings.openrouter_api_key = "or-fallback"
            config = self._make_config(provider="deepseek")
            api_key, _, _ = _resolve_provider_settings(config)
            assert api_key == "or-fallback"
        finally:
            settings.deepseek_api_key = original_dk
            settings.openrouter_api_key = original_or
