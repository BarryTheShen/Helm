from typing import Any

from pydantic import BaseModel


class ModuleInfo(BaseModel):
    id: str
    name: str
    icon: str
    enabled: bool


class ModuleListResponse(BaseModel):
    modules: list[ModuleInfo]


class ModuleStateResponse(BaseModel):
    type: str
    props: dict[str, Any]
    version: int
    updated_at: str


class ModuleActionRequest(BaseModel):
    action: str
    payload: dict[str, Any] = {}


class DeviceConfigResponse(BaseModel):
    tab_bar_modules: list[str]
    default_module: str
    nav_mode: str


class DeviceConfigUpdate(BaseModel):
    tab_bar_modules: list[str] | None = None
    default_module: str | None = None
    nav_mode: str | None = None
