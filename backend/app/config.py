import os
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
    access_token_expire_hours: int = 720  # 30 days
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
    # Both standard chat models and reasoning/thinking models are supported.
    # Override per-user via DB agent_config, or set OPENROUTER_MODEL in .env.
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "stepfun/step-3.5-flash:free"

    # MCP
    mcp_path: str = "/mcp"

    # External Agent — when set, the backend forwards mobile-app chat to this service
    # instead of calling the LLM provider directly.
    # Example: EXTERNAL_AGENT_URL=http://localhost:7860
    external_agent_url: str = ""

    # Demo features
    # Set to false to disable the 2-minute "Time Check" notification broadcast.
    # Enabled by default in dev so the Alerts tab shows live WebSocket push demos.
    demo_time_alerts: bool = True


settings = Settings()

# Fail fast if encryption key is missing, unless the developer has explicitly
# opted out via HELM_ALLOW_INSECURE_DEV=1. Without a key, any endpoint that
# reads/writes encrypted columns will fail at runtime with a cryptic error;
# it is far safer to refuse to start.
if not settings.encryption_key and os.environ.get("HELM_ALLOW_INSECURE_DEV") != "1":
    raise RuntimeError(
        "ENCRYPTION_KEY is not set. "
        "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\" "
        "and add it to your .env file as ENCRYPTION_KEY=<value>. "
        "To skip this check in local dev (insecure), set HELM_ALLOW_INSECURE_DEV=1."
    )
