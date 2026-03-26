from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env relative to this file so it works regardless of cwd.
# config.py lives at backend/app/config.py → parent.parent.parent is the repo root.
_REPO_ROOT = Path(__file__).parent.parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_REPO_ROOT / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Database
    database_url: str = "sqlite+aiosqlite:///./helm.db"

    # Security
    secret_key: str = "dev-secret-key-change-in-production"
    encryption_key: str = ""
    access_token_expire_hours: int = 24
    refresh_token_expire_days: int = 30

    # Server
    server_name: str = "Helm"
    server_version: str = "0.1.0"
    server_host: str = "0.0.0.0"
    server_port: int = 8000

    # AI Agent — env-level defaults (overridden per-user via DB agent_config)
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o"
    # OpenRouter (recommended — works in all regions, has free models)
    # Use a chat-tuned model, NOT a pure reasoning model (e.g. stepfun/step-3.5-flash:free).
    # Reasoning-only models return empty content when the tools parameter is included,
    # which breaks the streaming chat handler.  arcee trinity handles tool calling reliably.
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "arcee-ai/trinity-large-preview:free"

    # MCP
    mcp_path: str = "/mcp"


settings = Settings()
