"""Pydantic schemas for device error reporting."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class DeviceErrorCreate(BaseModel):
    """Schema for device error report creation."""

    error_type: str = Field(default="render_error", description="Type of error")
    error_message: str = Field(..., min_length=1, max_length=1000)
    error_details: dict[str, Any] | None = Field(
        default=None, description="Additional error context"
    )


class PreviewSessionErrorCreate(BaseModel):
    """Schema for preview session error report creation."""

    error_type: str = Field(default="preview_failure", description="Type of error")
    error_message: str = Field(..., min_length=1, max_length=1000)
    error_details: dict[str, Any] | None = Field(
        default=None, description="Additional error context"
    )
    device_id: str | None = Field(
        default=None, description="Device ID if applicable"
    )


class DeviceErrorReportOut(BaseModel):
    """Schema for device error report response."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    device_id: str | None = None
    preview_session_id: str | None = None
    error_type: str
    error_message: str
    error_details: dict[str, Any] | None = None
    source: str
    reviewed: bool = False
    created_at: datetime
