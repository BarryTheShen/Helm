"""TemplateVersion schemas — versioning for SDUI templates."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class TemplateVersionCreate(BaseModel):
    """Create a new template version from current template JSON."""
    template_json: dict[str, Any]
    change_summary: str | None = Field(default=None, max_length=1000)


class TemplateVersionOut(BaseModel):
    """A versioned snapshot of a template's screen JSON."""
    id: str
    template_id: str
    version_number: int
    display_name: str
    default_timestamp_name: str
    custom_name: str | None = None
    source: str
    parent_version_id: str | None = None
    change_summary: str | None = None
    validation_status: str = "unknown"
    created_at: datetime

    model_config = {"from_attributes": True}


class TemplateVersionDetailOut(TemplateVersionOut):
    """Full version detail including the template JSON content."""
    template_json: dict[str, Any]


class TemplateVersionRename(BaseModel):
    """Rename a version with a custom name."""
    custom_name: str = Field(..., min_length=1, max_length=255)
