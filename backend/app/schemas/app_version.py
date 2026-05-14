"""AppVersion schemas — versioning and checkpoint model for apps."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AppCheckpointCreate(BaseModel):
    """Create a checkpoint from the current working draft."""
    change_summary: str | None = Field(default=None, max_length=1000)


class AppCheckpointOut(BaseModel):
    """Response after creating a checkpoint."""
    id: str
    version_number: int
    display_name: str
    created_at: datetime


class AppVersionOut(BaseModel):
    """A versioned snapshot of an app's configuration."""
    id: str
    app_id: str
    version_number: int
    display_name: str
    default_timestamp_name: str
    custom_name: str | None = None
    source: str
    parent_version_id: str | None = None
    change_summary: str | None = None
    validation_status: str = "unknown"
    schema_version: str = "2.0"
    created_at: datetime

    model_config = {"from_attributes": True}


class AppVersionDetailOut(AppVersionOut):
    """Full version detail including the config JSON and module references."""
    config_json: dict[str, Any]
    resolved_module_versions: list[dict[str, Any]] = []
    module_reference_policies: list[dict[str, Any]] = []


class AppVersionRename(BaseModel):
    """Rename a version with a custom name."""
    custom_name: str = Field(..., min_length=1, max_length=255)


class AppVersionRestore(BaseModel):
    """Restore a version to the working draft."""
    as_draft: bool = Field(default=True, description="Restore as draft")


class AppPublishRequest(BaseModel):
    """Publish an app version to mobile devices."""
    version_id: str | None = Field(default=None, description="Specific version to publish. If empty, publishes the working draft.")
    change_summary: str | None = Field(default=None, max_length=1000)
    device_ids: list[str] | None = Field(default=None, description="Specific devices to update. If empty, updates all assigned devices.")


class AppPublishOut(BaseModel):
    """Response after publishing an app version."""
    version_id: str
    version_number: int
    display_name: str
    published_at: datetime
    device_count: int
    success: bool = True


class AppWorkingDraftOut(BaseModel):
    """Current working draft state for an app."""
    id: str
    app_id: str
    config_json: dict[str, Any]
    last_autosaved_at: datetime | None = None
    base_version_id: str | None = None
    validation_status: str = "unknown"
    dirty: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class AppWorkingDraftUpdate(BaseModel):
    """Update the working draft (autosave)."""
    config_json: dict[str, Any]
    base_version_id: str | None = None
    dirty: bool = True
