"""Pydantic schemas for App endpoints."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator


class AppCreate(BaseModel):
    """Schema for creating a new app."""

    name: str = Field(..., min_length=1, max_length=255)
    icon: str | None = None
    splash: str | None = None
    theme: dict | str = Field(default_factory=dict)
    design_tokens: dict = Field(default_factory=dict)
    dark_mode: bool = False
    default_launch_module_id: str | None = None
    bottom_bar_config: list = Field(default_factory=list)
    launchpad_config: list = Field(default_factory=list)


class AppUpdate(BaseModel):
    """Schema for updating an app."""

    name: str | None = Field(None, min_length=1, max_length=255)
    icon: str | None = None
    splash: str | None = None
    theme: dict | str | None = None
    design_tokens: dict | None = None
    dark_mode: bool | None = None
    default_launch_module_id: str | None = None
    bottom_bar_config: list | None = None
    launchpad_config: list | None = None


class BottomBarConfigUpdate(BaseModel):
    """Schema for updating bottom bar configuration."""

    bottom_bar_config: list = Field(..., max_length=5)


class AppModulesUpdate(BaseModel):
    """Schema for adding/removing modules from an app."""

    module_instance_ids: list[str] = Field(..., description="List of module instance IDs to include in app")


class AppResponse(BaseModel):
    """Schema for app response (basic info)."""

    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    name: str
    icon: str | None
    splash: str | None
    theme: dict
    design_tokens: dict
    dark_mode: bool
    default_launch_module_id: str | None
    bottom_bar_config: list
    launchpad_config: list
    created_at: datetime
    updated_at: datetime

    @field_validator("theme", mode="before")
    @classmethod
    def normalize_theme(cls, v):
        """Normalize theme: coerce string values (e.g. 'light') to dict.

        Some legacy apps store theme as a JSON string ('light') instead of
        a JSON object ({}). Accept both forms and always return a dict.
        """
        if isinstance(v, str):
            return {"preset": v}
        return v
