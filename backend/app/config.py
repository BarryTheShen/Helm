from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Resolve .env relative to this file so it works regardless of cwd.
# config.py lives at backend/app/config.py → parent.parent is backend/.
_BACKEND_DIR = Path(__file__).parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_BACKEND_DIR / ".env"),
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

    # CORS — comma-separated origins, or "*" for dev
    allowed_origins: str = "*"

    # Server
    server_name: str = "Helm"
    server_version: str = "0.1.0"
    server_host: str = "0.0.0.0"
    server_port: int = 9000

    # AI Agent — env-level defaults (overridden per-user via DB agent_config)
    # Default provider used when no per-user config exists.
    # Valid: openai, openrouter, siliconflow, ollama, deepseek, groq, together, custom
    default_provider: str = "openrouter"

    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o"
    # OpenRouter (recommended — works in all regions, has free models)
    openrouter_api_key: str = ""
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "stepfun/step-3.5-flash:free"
    # SiliconFlow — Chinese cloud AI platform
    siliconflow_api_key: str = ""
    siliconflow_base_url: str = "https://api.siliconflow.cn/v1"
    siliconflow_model: str = "deepseek-ai/DeepSeek-V3"
    # Ollama — local models, no API key needed
    ollama_base_url: str = "http://localhost:11434/v1"
    ollama_model: str = "llama3.2"
    # DeepSeek — official API
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com/v1"
    deepseek_model: str = "deepseek-chat"
    # Groq — ultra-fast inference
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    groq_model: str = "llama-3.3-70b-versatile"
    # Together AI — open-source model hosting
    together_api_key: str = ""
    together_base_url: str = "https://api.together.xyz/v1"
    together_model: str = "meta-llama/Llama-3.3-70B-Instruct-Turbo"

    # MCP
    mcp_path: str = "/mcp"

    # External Agent — when set, the backend forwards mobile-app chat to this service
    # instead of calling the LLM provider directly.
    # Example: EXTERNAL_AGENT_URL=http://localhost:7860
    external_agent_url: str = ""


settings = Settings()
