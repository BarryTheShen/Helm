from datetime import datetime

from pydantic import BaseModel, ConfigDict


class SettingsUpdate(BaseModel):
    display_name: str | None = None
    email: str | None = None
    endpoint_url: str | None = None
    dark_mode: bool | None = None
    password: str | None = None


class SettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    display_name: str | None
    email: str | None
    endpoint_url: str | None
    dark_mode: bool
    created_at: datetime
    updated_at: datetime
