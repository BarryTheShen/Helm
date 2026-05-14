"""PreviewSession schemas — preview lifecycle management."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class PreviewSessionCreate(BaseModel):
    """Start a preview session."""
    target_type: str = Field(default="web_admin", pattern=r"^(web_admin|mobile_device)$")
    app_id: str | None = Field(default=None, description="App to preview (if app-level)")
    module_id: str | None = Field(default=None, description="Module to preview (if module-level)")
    device_id: str | None = Field(default=None, description="Target device for mobile previews")


class PreviewSessionOut(BaseModel):
    """Preview session state."""
    id: str
    target_type: str
    app_id: str | None = None
    module_id: str | None = None
    device_id: str | None = None
    resolved_config_json: dict[str, Any] | None = None
    resolved_sdui_json: dict[str, Any] | None = None
    status: str = "active"
    created_at: datetime
    expires_at: datetime
    exited_at: datetime | None = None

    model_config = {"from_attributes": True}


class PreviewSessionExit(BaseModel):
    """Exit a preview session."""
    pass


class PreviewSessionExtend(BaseModel):
    """Extend a preview session's expiry."""
    additional_minutes: int = Field(default=30, ge=1, le=1440)
