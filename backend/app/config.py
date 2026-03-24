from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
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

    # AI Agent
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    openai_model: str = "gpt-4o"

    # MCP
    mcp_path: str = "/mcp"


settings = Settings()
