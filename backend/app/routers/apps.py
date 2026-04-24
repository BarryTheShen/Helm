"""Apps router — CRUD endpoints for App management."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user_id
from app.schemas.app import (
    AppCreate,
    AppModulesUpdate,
    AppResponse,
    AppUpdate,
    BottomBarConfigUpdate,
)
from app.services import app_service
from app.services.audit import log_audit
from app.services.websocket_manager import manager

router = APIRouter(prefix="/api/apps", tags=["apps"])


@router.post("", response_model=AppResponse, status_code=status.HTTP_201_CREATED)
async def create_app(
    body: AppCreate,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a new app.

    Validates bottom bar config (5-slot cap, valid module_instance_ids).
    """
    # Validate bottom bar config if provided
    if body.bottom_bar_config:
        is_valid, error_msg = await app_service.validate_bottom_bar_config(
            db, user_id, body.bottom_bar_config
        )
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)

    app = await app_service.create_app(
        db=db,
        user_id=user_id,
        name=body.name,
        icon=body.icon,
        splash=body.splash,
        theme=body.theme,
        design_tokens=body.design_tokens,
        dark_mode=body.dark_mode,
        default_launch_module_id=body.default_launch_module_id,
        bottom_bar_config=body.bottom_bar_config,
        launchpad_config=body.launchpad_config,
    )

    await db.commit()

    await log_audit(
        db,
        user_id,
        "APP_CREATED",
        "app",
        app.id,
        ip=request.client.host if request.client else None,
    )

    return AppResponse.model_validate(app)


@router.get("", response_model=list[AppResponse])
async def list_apps(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List all apps for the current user."""
    apps = await app_service.list_apps(db, user_id)
    return [AppResponse.model_validate(app) for app in apps]


@router.get("/{app_id}", response_model=AppResponse)
async def get_app(
    app_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get app by ID with enriched bottom bar config.

    Returns enriched bottom_bar_config with module_type, name, icon metadata
    joined from ModuleInstance. This allows mobile to map module_instance_id
    to routes without additional fetches.
    """
    app = await app_service.get_app(db, app_id, user_id)

    if app is None:
        raise HTTPException(status_code=404, detail="App not found")

    return AppResponse.model_validate(app)


@router.put("/{app_id}", response_model=AppResponse)
async def update_app(
    app_id: str,
    body: AppUpdate,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update app fields.

    Validates bottom bar config if provided (5-slot cap, valid module_instance_ids).
    Broadcasts app_config_update WebSocket event to all devices assigned to this app.
    """
    # Validate bottom bar config if provided
    if body.bottom_bar_config is not None:
        is_valid, error_msg = await app_service.validate_bottom_bar_config(
            db, user_id, body.bottom_bar_config
        )
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)

    # Filter out None values
    updates = {k: v for k, v in body.model_dump().items() if v is not None}

    app = await app_service.update_app(db, app_id, user_id, **updates)

    if app is None:
        raise HTTPException(status_code=404, detail="App not found")

    await db.commit()
    await db.refresh(app)  # Refresh to get updated timestamp

    await log_audit(
        db,
        user_id,
        "APP_UPDATED",
        "app",
        app_id,
        ip=request.client.host if request.client else None,
    )

    # Broadcast app config update to all connected clients
    await manager.send(
        user_id,
        {
            "type": "app_config_update",
            "app_id": app_id,
            "config": {
                "name": app.name,
                "icon": app.icon,
                "theme": app.theme,
                "design_tokens": app.design_tokens,
                "dark_mode": app.dark_mode,
                "bottom_bar_config": app.bottom_bar_config,
                "launchpad_config": app.launchpad_config,
            },
        },
    )

    return AppResponse.model_validate(app)


@router.delete("/{app_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_app(
    app_id: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete app and cascade to AppModuleRef rows.

    Devices assigned to this app will have assigned_app_id set to NULL (SET NULL FK).
    """
    deleted = await app_service.delete_app(db, app_id, user_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="App not found")

    await db.commit()

    await log_audit(
        db,
        user_id,
        "APP_DELETED",
        "app",
        app_id,
        ip=request.client.host if request.client else None,
    )


@router.put("/{app_id}/bottom-bar", response_model=AppResponse)
async def update_bottom_bar(
    app_id: str,
    body: BottomBarConfigUpdate,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update bottom bar configuration.

    Validates 5-slot cap and module_instance_ids.
    Broadcasts app_config_update WebSocket event.
    """
    # Validate bottom bar config
    is_valid, error_msg = await app_service.validate_bottom_bar_config(
        db, user_id, body.bottom_bar_config
    )
    if not is_valid:
        raise HTTPException(status_code=400, detail=error_msg)

    app = await app_service.update_app(
        db, app_id, user_id, bottom_bar_config=body.bottom_bar_config
    )

    if app is None:
        raise HTTPException(status_code=404, detail="App not found")

    await db.commit()
    await db.refresh(app)  # Refresh to get updated timestamp

    await log_audit(
        db,
        user_id,
        "APP_BOTTOM_BAR_UPDATED",
        "app",
        app_id,
        ip=request.client.host if request.client else None,
    )

    # Broadcast app config update
    await manager.send(
        user_id,
        {
            "type": "app_config_update",
            "app_id": app_id,
            "config": {
                "bottom_bar_config": app.bottom_bar_config,
            },
        },
    )

    return AppResponse.model_validate(app)


@router.put("/{app_id}/modules", response_model=AppResponse)
async def update_app_modules(
    app_id: str,
    body: AppModulesUpdate,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Add/remove modules from app.

    This endpoint is a placeholder for future implementation.
    Currently, modules are managed via bottom_bar_config and launchpad_config.
    """
    raise HTTPException(
        status_code=501,
        detail="Module management via AppModuleRef not yet implemented. Use bottom_bar_config and launchpad_config instead.",
    )
