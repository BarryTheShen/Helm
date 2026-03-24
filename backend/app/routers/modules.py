from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.module_state import ModuleState
from app.models.user import User
from app.schemas.modules import (
    DeviceConfigResponse,
    DeviceConfigUpdate,
    ModuleActionRequest,
    ModuleInfo,
    ModuleListResponse,
    ModuleStateResponse,
)

router = APIRouter(prefix="/api", tags=["modules"])

AVAILABLE_MODULES: list[ModuleInfo] = [
    ModuleInfo(id="chat", name="Chat", icon="💬", enabled=True),
    ModuleInfo(id="calendar", name="Calendar", icon="📅", enabled=True),
    ModuleInfo(id="alerts", name="Alerts", icon="🔔", enabled=True),
    ModuleInfo(id="forms", name="Forms", icon="📝", enabled=True),
    ModuleInfo(id="settings", name="Settings", icon="⚙️", enabled=True),
]

DEFAULT_MODULE_STATES: dict[str, dict[str, Any]] = {
    "chat": {"type": "chat", "props": {"messages": [], "streaming": False}, "version": 0},
    "calendar": {"type": "calendar", "props": {"events": [], "view": "month"}, "version": 0},
    "alerts": {"type": "alerts", "props": {"alerts": []}, "version": 0},
    "forms": {"type": "form", "props": {"forms": []}, "version": 0},
    "settings": {"type": "settings", "props": {}, "version": 0},
}


@router.get("/modules", response_model=ModuleListResponse)
async def list_modules(current_user: User = Depends(get_current_user)):
    return ModuleListResponse(modules=AVAILABLE_MODULES)


@router.get("/modules/{module_id}/state", response_model=ModuleStateResponse)
async def get_module_state(
    module_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == str(current_user.id),
            ModuleState.module_type == module_id,
        )
    )
    state = result.scalar_one_or_none()
    if state is None:
        default = DEFAULT_MODULE_STATES.get(module_id)
        if default is None:
            raise HTTPException(status_code=404, detail="Module not found")
        return ModuleStateResponse(
            type=default["type"],
            props=default["props"],
            version=0,
            updated_at=datetime.now(timezone.utc).isoformat(),
        )
    return ModuleStateResponse(
        type=state.module_type,
        props=state.state_json,
        version=state.version,
        updated_at=state.updated_at.isoformat(),
    )


@router.post("/modules/{module_id}/action")
async def module_action(
    module_id: str,
    body: ModuleActionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Generic action handler — modules can extend this
    return {"status": "ok", "module": module_id, "action": body.action}


@router.get("/devices/config", response_model=DeviceConfigResponse)
async def get_device_config(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.models.device import Device
    from app.models.session import Session
    from fastapi import Request
    # Return default config — in full implementation would be per-device
    return DeviceConfigResponse(
        tab_bar_modules=["chat", "calendar", "alerts"],
        default_module="chat",
        nav_mode="tabs",
    )


@router.put("/devices/config", response_model=DeviceConfigResponse)
async def update_device_config(
    body: DeviceConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Persist to device record — simplified for MVP
    config = {
        "tab_bar_modules": body.tab_bar_modules or ["chat", "calendar", "alerts"],
        "default_module": body.default_module or "chat",
        "nav_mode": body.nav_mode or "tabs",
    }
    return DeviceConfigResponse(**config)
