"""Devices router — device registration and app assignment endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user_id
from app.schemas.device import (
    DeviceAppAssignment,
    DeviceConfigResponse,
    DeviceCreate,
    DeviceResponse,
    DeviceUpdate,
)
from app.services import device_service
from app.services.audit import log_audit
from app.services.websocket_manager import manager

router = APIRouter(prefix="/api/devices", tags=["devices"])


@router.post("", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED)
async def register_device(
    body: DeviceCreate,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Register a new device or update existing device's last_seen.

    Self-service endpoint for mobile devices. If device_id already exists,
    updates last_seen instead of creating new row.
    """
    device = await device_service.register_device(
        db=db,
        user_id=user_id,
        device_name=body.device_name,
        device_id=body.device_id,
    )

    await db.commit()
    await db.refresh(device)  # Refresh to get server-generated timestamps

    await log_audit(
        db,
        user_id,
        "DEVICE_REGISTERED",
        "device",
        device.id,
        ip=request.client.host if request.client else None,
    )

    return DeviceResponse.model_validate(device)


@router.get("", response_model=list[DeviceResponse])
async def list_devices(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List all devices for the current user."""
    devices = await device_service.list_devices(db, user_id)
    return [DeviceResponse.model_validate(device) for device in devices]


@router.get("/{device_id}", response_model=DeviceResponse)
async def get_device(
    device_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get device by ID."""
    devices = await device_service.list_devices(db, user_id)
    device = next((d for d in devices if d.id == device_id), None)

    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")

    return DeviceResponse.model_validate(device)


@router.put("/{device_id}/app", response_model=DeviceResponse)
async def assign_app_to_device(
    device_id: str,
    body: DeviceAppAssignment,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Assign an app to a device.

    Validates that both device and app belong to the user.
    Broadcasts device_app_assigned WebSocket event.
    """
    device = await device_service.assign_app_to_device(
        db=db,
        device_id=device_id,
        app_id=body.app_id,
        user_id=user_id,
    )

    if device is None:
        raise HTTPException(
            status_code=404,
            detail="Device or app not found, or unauthorized",
        )

    await db.commit()
    await db.refresh(device)  # Refresh to get updated timestamp

    await log_audit(
        db,
        user_id,
        "DEVICE_APP_ASSIGNED",
        "device",
        device_id,
        ip=request.client.host if request.client else None,
    )

    # Broadcast device app assignment to user's connected clients
    await manager.send(
        user_id,
        {
            "type": "device_app_assigned",
            "device_id": device_id,
            "app_id": body.app_id,
        },
    )

    return DeviceResponse.model_validate(device)


@router.get("/{device_id}/config", response_model=DeviceConfigResponse)
async def get_device_config(
    device_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get device's app config (for mobile).

    Returns full app configuration with enriched bottom_bar_config and
    launchpad_config (includes module_type, name, icon metadata).

    Mobile uses this endpoint to fetch the assigned app config on startup.
    """
    config = await device_service.get_device_app_config(db, device_id)

    if config is None:
        raise HTTPException(
            status_code=404,
            detail="Device not found or no app assigned",
        )

    return DeviceConfigResponse.model_validate(config)


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unregister_device(
    device_id: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Unregister (delete) a device."""
    deleted = await device_service.unregister_device(db, device_id, user_id)

    if not deleted:
        raise HTTPException(status_code=404, detail="Device not found")

    await db.commit()

    await log_audit(
        db,
        user_id,
        "DEVICE_UNREGISTERED",
        "device",
        device_id,
        ip=request.client.host if request.client else None,
    )
