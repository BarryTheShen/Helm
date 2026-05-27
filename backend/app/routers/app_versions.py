"""App versioning router — draft, checkpoint, version, publish, preview.

Provides the full versioning lifecycle for apps:
- Working Draft (autosaved app config)
- Checkpoint (snapshot from draft)
- Version (named/publishable state)
- Publish (push to mobile devices)
- Preview (test before publish)
"""

import logging
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import PaginationParams, get_current_user_id
from app.models.app import App
from app.models.app_version import AppVersion
from app.models.app_working_draft import AppWorkingDraft
from app.models.device import Device
from app.models.preview_session import PreviewSession
from app.schemas.app_version import (
    AppCheckpointCreate,
    AppCheckpointOut,
    AppPublishOut,
    AppPublishRequest,
    AppVersionDetailOut,
    AppVersionOut,
    AppVersionRename,
    AppWorkingDraftOut,
    AppWorkingDraftUpdate,
)
from app.schemas.common import PaginatedResponse
from app.schemas.preview import (
    PreviewSessionCreate,
    PreviewSessionOut,
)
from app.services.audit import log_audit
from app.services.device_service import normalize_app_config_snapshot, sync_app_shell_from_config
from app.services.validation_service import validate_app_config, validate_publish_config
from app.services.version_service import make_timestamp_name, resolve_module_references
from app.services.websocket_manager import manager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/apps", tags=["app-versions"])


# ── Helper functions ────────────────────────────────────────────────────────


async def get_app_or_404(
    db: AsyncSession,
    app_id: str,
    user_id: str,
) -> App:
    """Get an app by ID, raising 404 if not found or unauthorized."""
    result = await db.execute(
        select(App).where(App.id == app_id, App.user_id == user_id)
    )
    app = result.scalar_one_or_none()
    if app is None:
        raise HTTPException(status_code=404, detail="App not found")
    return app


async def get_or_create_working_draft(
    db: AsyncSession,
    app: App,
    user_id: str,
) -> AppWorkingDraft:
    """Get existing working draft or create one from live app config."""
    result = await db.execute(
        select(AppWorkingDraft).where(AppWorkingDraft.app_id == app.id)
    )
    draft = result.scalar_one_or_none()
    if draft is not None:
        return draft

    # Create from live app config
    draft = AppWorkingDraft(
        id=str(uuid4()),
        app_id=app.id,
        user_id=user_id,
        config_json={
            "theme": app.theme,
            "design_tokens": app.design_tokens,
            "dark_mode": app.dark_mode,
            "bottom_bar_config": app.bottom_bar_config,
            "launchpad_config": app.launchpad_config,
            "default_launch_module_id": app.default_launch_module_id,
            "name": app.name,
            "icon": app.icon,
            "splash": app.splash,
        },
        last_autosaved_at=datetime.now(timezone.utc),
        dirty=False,
        validation_status="valid",
    )
    db.add(draft)
    await db.flush()
    return draft


async def get_next_app_version_number(
    db: AsyncSession,
    app_id: str,
) -> int:
    """Get the next version number for an app."""
    result = await db.execute(
        select(func.max(AppVersion.version_number)).where(
            AppVersion.app_id == app_id,
        )
    )
    max_num = result.scalar() or 0
    return max_num + 1


# ── Working Draft endpoints ─────────────────────────────────────────────────


@router.get("/{app_id}/draft", response_model=AppWorkingDraftOut)
async def get_app_draft(
    app_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get the current working draft for an app.

    Falls back to creating a draft from the live app config if none exists.
    """
    app = await get_app_or_404(db, app_id, user_id)
    draft = await get_or_create_working_draft(db, app, user_id)
    return draft


@router.put("/{app_id}/draft", response_model=AppWorkingDraftOut)
async def update_app_draft(
    app_id: str,
    body: AppWorkingDraftUpdate,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update (autosave) the working draft for an app."""
    app = await get_app_or_404(db, app_id, user_id)

    result = await db.execute(
        select(AppWorkingDraft).where(AppWorkingDraft.app_id == app_id)
    )
    draft = result.scalar_one_or_none()

    if draft is None:
        draft = AppWorkingDraft(
            id=str(uuid4()),
            app_id=app_id,
            user_id=user_id,
            config_json=body.config_json,
            last_autosaved_at=datetime.now(timezone.utc),
            base_version_id=body.base_version_id,
            dirty=body.dirty,
            validation_status="valid",
        )
        db.add(draft)
    else:
        draft.config_json = body.config_json
        draft.dirty = body.dirty
        draft.base_version_id = body.base_version_id
        draft.last_autosaved_at = datetime.now(timezone.utc)
        draft.validation_status = "valid"

    await log_audit(
        db, user_id, "APP_DRAFT_UPDATED", "app_draft",
        app_id, ip=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(draft)
    return draft


@router.delete("/{app_id}/draft", status_code=200)
async def delete_app_draft(
    app_id: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete the working draft for an app."""
    app = await get_app_or_404(db, app_id, user_id)

    result = await db.execute(
        select(AppWorkingDraft).where(AppWorkingDraft.app_id == app_id)
    )
    draft = result.scalar_one_or_none()

    if draft is not None:
        await db.delete(draft)

    await log_audit(
        db, user_id, "APP_DRAFT_DELETED", "app_draft",
        app_id, ip=request.client.host if request.client else None,
    )
    await db.commit()
    return {"app_id": app_id, "deleted": True}


# ── Checkpoint endpoint ─────────────────────────────────────────────────────


@router.post("/{app_id}/checkpoints", response_model=AppCheckpointOut)
async def create_app_checkpoint(
    app_id: str,
    body: AppCheckpointCreate,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a checkpoint (versioned snapshot) from the current working draft.

    If no working draft exists, the live app config is checkpointed instead.
    """
    app = await get_app_or_404(db, app_id, user_id)
    draft = await get_or_create_working_draft(db, app, user_id)

    config_json = normalize_app_config_snapshot(draft.config_json, app)

    version_number = await get_next_app_version_number(db, app_id)
    timestamp_name = make_timestamp_name()
    display_name = f"v{version_number} — {timestamp_name}"

    version = AppVersion(
        id=str(uuid4()),
        app_id=app_id,
        user_id=user_id,
        version_number=version_number,
        display_name=display_name,
        default_timestamp_name=timestamp_name,
        custom_name=None,
        config_json=config_json,
        resolved_module_versions=[],
        module_reference_policies=[],
        source="checkpoint",
        parent_version_id=draft.base_version_id,
        change_summary=body.change_summary,
        validation_status="valid",
    )
    db.add(version)

    # Mark draft as clean after checkpoint
    draft.dirty = False
    draft.last_autosaved_at = datetime.now(timezone.utc)

    await log_audit(
        db, user_id, "APP_CHECKPOINT_CREATED", "app_version",
        version.id, ip=request.client.host if request.client else None,
    )
    await db.commit()

    return AppCheckpointOut(
        id=version.id,
        version_number=version.version_number,
        display_name=version.display_name,
        created_at=version.created_at,
    )


# ── Version endpoints ───────────────────────────────────────────────────────


@router.get("/{app_id}/versions", response_model=PaginatedResponse[AppVersionOut])
async def list_app_versions(
    app_id: str,
    pagination: PaginationParams = Depends(),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List all versions for an app, newest first."""
    await get_app_or_404(db, app_id, user_id)

    query = (
        select(AppVersion)
        .where(AppVersion.app_id == app_id, AppVersion.user_id == user_id)
        .order_by(AppVersion.version_number.desc())
        .offset(pagination.offset)
        .limit(pagination.limit)
    )
    count_query = select(func.count()).select_from(
        select(AppVersion).where(
            AppVersion.app_id == app_id,
            AppVersion.user_id == user_id,
        ).subquery()
    )

    results = await db.execute(query)
    total = (await db.execute(count_query)).scalar() or 0
    versions = list(results.scalars().all())

    return PaginatedResponse[AppVersionOut](
        items=[AppVersionOut.model_validate(v) for v in versions],
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
        has_more=(pagination.offset + pagination.limit) < total,
    )


@router.get("/{app_id}/versions/{version_id}", response_model=AppVersionDetailOut)
async def get_app_version_detail(
    app_id: str,
    version_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get full version detail including config JSON and module references."""
    await get_app_or_404(db, app_id, user_id)

    result = await db.execute(
        select(AppVersion).where(
            AppVersion.id == version_id,
            AppVersion.app_id == app_id,
            AppVersion.user_id == user_id,
        )
    )
    version = result.scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=404, detail="Version not found")
    return AppVersionDetailOut.model_validate(version)


@router.patch("/{app_id}/versions/{version_id}/rename", response_model=AppVersionOut)
async def rename_app_version(
    app_id: str,
    version_id: str,
    body: AppVersionRename,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Rename a version with a custom name."""
    await get_app_or_404(db, app_id, user_id)

    result = await db.execute(
        select(AppVersion).where(
            AppVersion.id == version_id,
            AppVersion.app_id == app_id,
            AppVersion.user_id == user_id,
        )
    )
    version = result.scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=404, detail="Version not found")

    version.custom_name = body.custom_name
    version.display_name = body.custom_name
    await db.commit()
    await db.refresh(version)
    return AppVersionOut.model_validate(version)


@router.post("/{app_id}/versions/{version_id}/restore-to-draft", response_model=AppWorkingDraftOut)
async def restore_app_version_to_draft(
    app_id: str,
    version_id: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Restore a version's config back to the working draft."""
    app = await get_app_or_404(db, app_id, user_id)

    result = await db.execute(
        select(AppVersion).where(
            AppVersion.id == version_id,
            AppVersion.app_id == app_id,
            AppVersion.user_id == user_id,
        )
    )
    version = result.scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=404, detail="Version not found")

    # Upsert working draft
    result = await db.execute(
        select(AppWorkingDraft).where(AppWorkingDraft.app_id == app_id)
    )
    draft = result.scalar_one_or_none()

    if draft is None:
        draft = AppWorkingDraft(
            id=str(uuid4()),
            app_id=app_id,
            user_id=user_id,
            config_json=version.config_json,
            base_version_id=version.id,
            validation_status="valid",
            dirty=False,
            last_autosaved_at=datetime.now(timezone.utc),
        )
        db.add(draft)
    else:
        draft.config_json = version.config_json
        draft.base_version_id = version.id
        draft.dirty = False
        draft.validation_status = "valid"
        draft.last_autosaved_at = datetime.now(timezone.utc)

    await log_audit(
        db, user_id, "APP_VERSION_RESTORED_TO_DRAFT", "app_version",
        version_id, ip=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(draft)
    return AppWorkingDraftOut.model_validate(draft)


# ── Publish endpoint ────────────────────────────────────────────────────────


@router.post("/{app_id}/versions/{version_id}/publish", response_model=AppPublishOut)
async def publish_app_version(
    app_id: str,
    version_id: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Publish a version — creates a publish event and updates assigned devices.

    This promotes a version to be the live app config. All devices assigned
    to this app will be notified via WebSocket.

    NOTE (FF4-EDGE-002): Module reference resolution is handled by
    `resolve_module_references()` in version_service.py — it iterates over
    module refs in the app config (bottom_bar_config, launchpad_config),
    resolves "use_newest" to the latest valid ModuleVersion via the
    ModuleInstance.current_version_id pointer, and populates both
    resolved_module_versions and module_reference_policies on the AppVersion.

    NOTE (FF4-EDGE-005): Devices that are offline when this endpoint runs
    still get their active_app_version_id updated. When they reconnect,
    they fetch the latest config via GET /api/devices/{device_id}/config.
    The update_status field should be set to 'update_available' for offline
    devices to indicate a pending update. On reconnection, the device can
    detect the status and fetch the new version automatically.
    """
    app = await get_app_or_404(db, app_id, user_id)

    result = await db.execute(
        select(AppVersion).where(
            AppVersion.id == version_id,
            AppVersion.app_id == app_id,
            AppVersion.user_id == user_id,
        )
    )
    version = result.scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=404, detail="Version not found")

    # Mark as published
    version.source = "publish"

    # ── FF4-VER-005: Resolve module references to concrete version IDs ──
    config_json = normalize_app_config_snapshot(version.config_json or {}, app)
    version.config_json = config_json
    resolved, policies = await resolve_module_references(
        db, config_json, user_id,
    )
    version.resolved_module_versions = resolved
    version.module_reference_policies = policies

    # Update app's current published version
    app.current_published_version_id = version.id
    # Keep App row shell in sync for admin APIs and legacy fallback (FF4-APP-002)
    sync_app_shell_from_config(app, config_json)

    # Update all devices assigned to this app
    result = await db.execute(
        select(Device).where(Device.assigned_app_id == app_id)
    )
    devices = list(result.scalars().all())

    # Validate device compatibility before publishing
    is_valid, validation_errors = validate_publish_config(
        config_json,
        devices=devices,
    )
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Publish validation failed",
                "errors": validation_errors,
            },
        )
    for device in devices:
        device.active_app_version_id = version.id
        # Mark device as having a pending update (FF4-EDGE-005)
        device.update_status = "update_available"

    await log_audit(
        db, user_id, "APP_VERSION_PUBLISHED", "app_version",
        version_id, ip=request.client.host if request.client else None,
    )
    await db.commit()

    # Broadcast app_version_published to all connected clients
    for device in devices:
        await manager.send(
            user_id,
            {
                "type": "app_version_published",
                "app_id": app_id,
                "app_version_id": version.id,
                "version_number": version.version_number,
                "display_name": version.display_name,
                "published_at": version.created_at.isoformat() if version.created_at else None,
            },
        )

    return AppPublishOut(
        version_id=version.id,
        version_number=version.version_number,
        display_name=version.display_name,
        published_at=version.created_at,
        device_count=len(devices),
    )


# ── Preview endpoints ───────────────────────────────────────────────────────


@router.post("/{app_id}/preview/web", response_model=PreviewSessionOut)
async def start_web_app_preview(
    app_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Start a web admin preview session with the current app config.

    Resolves the app config from the working draft and creates a
    time-limited preview session.
    """
    app = await get_app_or_404(db, app_id, user_id)
    draft = await get_or_create_working_draft(db, app, user_id)

    expires_at = datetime.now(timezone.utc).replace(hour=23, minute=59, second=59)

    session = PreviewSession(
        id=str(uuid4()),
        user_id=user_id,
        target_type="web_admin",
        app_id=app_id,
        module_id=None,
        device_id=None,
        resolved_config_json=draft.config_json,
        status="active",
        expires_at=expires_at,
    )
    db.add(session)
    await log_audit(
        db, user_id, "APP_PREVIEW_STARTED", "preview_session",
        session.id, ip=None,
    )
    await db.commit()
    await db.refresh(session)
    return PreviewSessionOut.model_validate(session)


@router.post("/{app_id}/preview/device", response_model=PreviewSessionOut)
async def start_device_app_preview(
    app_id: str,
    body: PreviewSessionCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Start a mobile device preview session.

    Creates a preview session targeted at a specific device and notifies
    the device via WebSocket.
    """
    app = await get_app_or_404(db, app_id, user_id)
    draft = await get_or_create_working_draft(db, app, user_id)

    if not body.device_id:
        raise HTTPException(status_code=400, detail="device_id is required for device preview")

    # Verify device belongs to user
    result = await db.execute(
        select(Device).where(
            Device.id == body.device_id,
            Device.user_id == user_id,
        )
    )
    device = result.scalar_one_or_none()
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")

    expires_at = datetime.now(timezone.utc).replace(hour=23, minute=59, second=59)

    session = PreviewSession(
        id=str(uuid4()),
        user_id=user_id,
        target_type="mobile_device",
        app_id=app_id,
        module_id=None,
        device_id=body.device_id,
        resolved_config_json=draft.config_json,
        status="active",
        expires_at=expires_at,
    )
    db.add(session)
    await db.flush()

    # Mark device's preview session
    device.preview_session_id = session.id

    await log_audit(
        db, user_id, "APP_PREVIEW_STARTED", "preview_session",
        session.id, ip=None,
    )
    await db.commit()
    await db.refresh(session)

    # Broadcast preview_session_started to device's user
    await manager.send(
        user_id,
        {
            "type": "preview_session_started",
            "device_id": body.device_id,
            "session_id": session.id,
            "app_id": app_id,
            "preview_config": draft.config_json,
            "expires_at": expires_at.isoformat(),
        },
    )

    return PreviewSessionOut.model_validate(session)
