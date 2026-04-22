from typing import Any

from pydantic import BaseModel


class ModuleInfo(BaseModel):
    id: str
    name: str
    icon: str
    enabled: bool
    pinned: bool = False
    tab_order: int = 0


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


class SDUIScreenRequest(BaseModel):
    """Body for POST /api/sdui/{module_id} — the AI sends a complete SDUIScreen JSON."""
    screen: dict[str, Any]


class TabConfigRequest(BaseModel):
    """Body for PATCH /api/modules/{module_id}/config — rename a tab and/or change its icon."""
    name: str | None = None
    icon: str | None = None


class PinModuleRequest(BaseModel):
    """Body for PATCH /api/modules/{module_id}/pin — pin a module to the tab bar."""
    tab_order: int | None = None


class ReorderModulesRequest(BaseModel):
    """Body for POST /api/modules/reorder — reorder pinned modules in the tab bar."""
    module_ids: list[str]

