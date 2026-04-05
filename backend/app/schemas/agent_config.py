from pydantic import BaseModel, ConfigDict


class AgentConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    provider: str
    model: str
    api_key_set: bool
    base_url: str | None
    system_prompt: str | None
    temperature: float
    max_tokens: int
    is_active: bool


class AgentConfigUpdate(BaseModel):
    provider: str | None = None
    model: str | None = None
    api_key: str | None = None
    base_url: str | None = None
    system_prompt: str | None = None
    temperature: float | None = None
    max_tokens: int | None = None
