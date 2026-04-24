"""Pydantic schemas for Device endpoints."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class DeviceCreate(BaseModel):
    """Schema for device registration."""

    device_id: str = Field(..., description="Unique device identifier (UUID from mobile)")
    device_name: str = Field(..., min_length=1, max_length=255)


class DeviceUpdate(BaseModel):
    """Schema for updating device."""

    device_name: str | None = Field(None, min_length=1, max_length=255)
    config_json: dict | None = None


class DeviceAppAssignment(BaseModel):
    """Schema for assigning app to device."""

    app_id: str = Field(..., description="App ID to assign to device")


class DeviceResponse(BaseModel):
    """Schema for device response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    device_name: str
    device_id: str
    config_json: dict
    last_seen: datetime | None
    assigned_app_id: str | None
    created_at: datetime
    updated_at: datetime


class DeviceConfigResponse(BaseModel):
    """Schema for device app config response (for mobile)."""

    app_id: str
    name: str
    icon: str | None
    splash: str | None
    theme: dict
    design_tokens: dict
    dark_mode: bool
    default_launch_module_id: str | None
    bottom_bar_config: list
    launchpad_config: list
