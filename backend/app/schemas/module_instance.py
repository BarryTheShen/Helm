"""Pydantic schemas for ModuleInstance endpoints."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class ModuleInstanceCreate(BaseModel):
    module_type: str
    name: str
    template_id: str | None = None
    version: str = "0.0.0"


class ModuleInstallRequest(BaseModel):
    """Request body for POST /api/modules/install."""

    template_id: str
    name: str | None = None
    config: dict | None = None


class ModuleInstanceUpdate(BaseModel):
    name: str | None = None
    status: str | None = None  # active | disabled | uninstalled


class ModuleInstanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    user_id: str
    template_id: str | None
    module_type: str
    name: str
    version: str
    manifest_snapshot: str | None
    status: str
    installed_at: datetime
    updated_at: datetime

    # installed_at maps to created_at on the model (TimestampMixin)
    @classmethod
    def from_orm_alias(cls, obj: object) -> "ModuleInstanceOut":
        """Convenience builder that maps created_at → installed_at."""
        return cls.model_validate(
            {
                "id": obj.id,  # type: ignore[attr-defined]
                "user_id": obj.user_id,  # type: ignore[attr-defined]
                "template_id": obj.template_id,  # type: ignore[attr-defined]
                "module_type": obj.module_type,  # type: ignore[attr-defined]
                "name": obj.name,  # type: ignore[attr-defined]
                "version": obj.version,  # type: ignore[attr-defined]
                "manifest_snapshot": obj.manifest_snapshot,  # type: ignore[attr-defined]
                "status": obj.status,  # type: ignore[attr-defined]
                "installed_at": obj.created_at,  # type: ignore[attr-defined]
                "updated_at": obj.updated_at,  # type: ignore[attr-defined]
            }
        )
