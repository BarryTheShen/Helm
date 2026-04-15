from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class TriggerCreate(BaseModel):
    name: str
    trigger_type: Literal["schedule", "data_change", "server_event"]
    config_json: str = "{}"
    action_chain_json: str = "[]"
    enabled: bool = True


class TriggerUpdate(BaseModel):
    name: str | None = None
    trigger_type: Literal["schedule", "data_change", "server_event"] | None = None
    config_json: str | None = None
    action_chain_json: str | None = None
    enabled: bool | None = None


class TriggerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    trigger_type: str
    config_json: str
    action_chain_json: str
    enabled: bool
    created_at: datetime
    updated_at: datetime
