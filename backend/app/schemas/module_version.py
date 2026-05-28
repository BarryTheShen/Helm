"""ModuleVersion schemas — versioning and checkpoint model for modules."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, RootModel


class ModuleCheckpointCreate(BaseModel):
    """Create a checkpoint from the current working draft."""
    change_summary: str | None = Field(default=None, max_length=1000)


class ModuleCheckpointOut(BaseModel):
    """Response after creating a checkpoint."""
    id: str
    version_number: int
    display_name: str
    created_at: datetime


class ModuleVersionOut(BaseModel):
    """A versioned snapshot of a module's SDUI screen."""
    id: str
    module_id: str
    version_number: int
    display_name: str
    default_timestamp_name: str
    custom_name: str | None = None
    source: str
    parent_version_id: str | None = None
    change_summary: str | None = None
    validation_status: str = "unknown"
    schema_version: str = "2.0"
    status: str = "active"
    created_at: datetime

    model_config = {"from_attributes": True}


class ModuleVersionDetailOut(ModuleVersionOut):
    """Full version detail including the SDUI JSON content."""
    sdui_json: dict[str, Any]


class ModuleVersionRename(BaseModel):
    """Rename a version with a custom name."""
    custom_name: str = Field(..., min_length=1, max_length=255)


class ModuleVersionRestore(BaseModel):
    """Restore a version to the working draft."""
    as_draft: bool = Field(default=True, description="Restore as draft (vs direct publish)")


class ModuleWorkingDraftOut(BaseModel):
    """Current working draft state for a module."""
    id: str
    module_id: str
    sdui_json: dict[str, Any]
    last_autosaved_at: datetime | None = None
    base_version_id: str | None = None
    validation_status: str = "unknown"
    dirty: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ModuleWorkingDraftUpdate(BaseModel):
    """Update the working draft (autosave)."""
    sdui_json: dict[str, Any]
    base_version_id: str | None = None
    dirty: bool = True


class ModuleUsageOut(BaseModel):
    """Schema for module usage info showing which apps use this module."""
    module_id: str
    used_by_apps: list[dict[str, str]] = Field(default_factory=list, description="List of {app_id, app_name}")


class ModuleVersionWithStatusOut(ModuleVersionOut):
    """Version detail including lifecycle status (active/archived)."""
    status: str = "active"
