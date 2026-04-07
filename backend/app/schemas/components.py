from typing import Any

from pydantic import BaseModel, ConfigDict


class ComponentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: str
    tier: str
    name: str
    icon: str
    description: str
    props_schema: dict[str, Any]
    default_props: dict[str, Any]
    is_active: bool


class ComponentCreate(BaseModel):
    type: str
    tier: str
    name: str
    icon: str
    description: str
    props_schema: dict[str, Any]
    default_props: dict[str, Any]


class ComponentUpdate(BaseModel):
    name: str | None = None
    icon: str | None = None
    description: str | None = None
    props_schema: dict[str, Any] | None = None
    default_props: dict[str, Any] | None = None
    is_active: bool | None = None
