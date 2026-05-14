"""Module versioning router — draft, checkpoint, version, restore, preview.

Replaces the old approve/reject draft model with:
- Working Draft (autosaved)
- Checkpoint (snapshot from draft)
- Version (named/published state)
- Preview (test before publish)
- Restore (rollback to historical version)

Backward compatible: old draft endpoints continue to work.
"""

import logging
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import PaginationParams, get_current_user, get_current_user_id
from app.models.module_instance import ModuleInstance
from app.models.module_state import ModuleState
from app.models.module_version import ModuleVersion
from app.models.module_working_draft import ModuleWorkingDraft
from app.models.preview_session import PreviewSession
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.module_version import (
    ModuleCheckpointCreate,
    ModuleCheckpointOut,
    ModuleVersionDetailOut,
    ModuleVersionOut,
    ModuleVersionRename,
    ModuleWorkingDraftOut,
    ModuleWorkingDraftUpdate,
)
from app.schemas.preview import (
    PreviewSessionCreate,
    PreviewSessionExit,
    PreviewSessionExtend,
    PreviewSessionOut,
)
from app.services.audit import log_audit
from app.services.sdui_state import (
    draft_screen_key,
    live_screen_key,
    normalize_screen_for_client,
    persist_live_screen,
    prepare_sdui_screen_for_storage,
    send_draft_cleared,
    send_draft_update,
    send_live_screen_update,
)
from app.services.version_service import (
    create_module_checkpoint,
    list_module_versions,
    make_timestamp_name,
    restore_version_to_draft,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/modules", tags=["module-versions"])


# ── Working Draft endpoints ────────────────────────────────────────────────


@router.get("/{module_id}/draft", response_model=ModuleWorkingDraftOut)
async def get_module_draft(
    module_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get the current working draft for a module.

    Falls back to the old ModuleState-based draft for backward compatibility.
    """
    # Try new working draft table first
    result = await db.execute(
        select(ModuleWorkingDraft).where(
            ModuleWorkingDraft.module_id == module_id,
            ModuleWorkingDraft.user_id == user_id,
        )
    )
    draft = result.scalar_one_or_none()
    if draft is not None:
        return draft

    # Fallback: check old ModuleState-based draft
    old_draft_key = draft_screen_key(module_id)
    result = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == user_id,
            ModuleState.module_type == old_draft_key,
        )
    )
    old_draft = result.scalars().first()
    if old_draft is not None:
        # Create working draft from old draft data
        working_draft = ModuleWorkingDraft(
            id=str(uuid4()),
            module_id=module_id,
            user_id=user_id,
            sdui_json=old_draft.state_json,
            last_autosaved_at=datetime.now(timezone.utc),
            dirty=False,
            validation_status="valid",
        )
        db.add(working_draft)
        await db.flush()
        return working_draft

    # No draft exists at all
    raise HTTPException(status_code=404, detail="No draft found for this module")


@router.put("/{module_id}/draft", response_model=ModuleWorkingDraftOut)
async def update_module_draft(
    module_id: str,
    body: ModuleWorkingDraftUpdate,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Update (autosave) the working draft for a module.

    Validates the SDUI JSON before saving.
    """
    # Validate SDUI JSON
    try:
        validated_screen = prepare_sdui_screen_for_storage(body.sdui_json, module_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    result = await db.execute(
        select(ModuleWorkingDraft).where(
            ModuleWorkingDraft.module_id == module_id,
            ModuleWorkingDraft.user_id == user_id,
        )
    )
    draft = result.scalar_one_or_none()

    if draft is None:
        draft = ModuleWorkingDraft(
            id=str(uuid4()),
            module_id=module_id,
            user_id=user_id,
            sdui_json=validated_screen,
            last_autosaved_at=datetime.now(timezone.utc),
            base_version_id=body.base_version_id,
            dirty=body.dirty,
            validation_status="valid",
        )
        db.add(draft)
    else:
        draft.sdui_json = validated_screen
        draft.dirty = body.dirty
        draft.base_version_id = body.base_version_id
        draft.last_autosaved_at = datetime.now(timezone.utc)
        draft.validation_status = "valid"

    await log_audit(
        db, user_id, "MODULE_DRAFT_UPDATED", "module_draft",
        module_id, ip=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(draft)

    # Send WS update for backward compat with old draft flow
    await send_draft_update(user_id, module_id, validated_screen, 1)

    return draft


@router.delete("/{module_id}/draft", status_code=200)
async def delete_module_draft(
    module_id: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Delete the working draft for a module."""
    result = await db.execute(
        select(ModuleWorkingDraft).where(
            ModuleWorkingDraft.module_id == module_id,
            ModuleWorkingDraft.user_id == user_id,
        )
    )
    draft = result.scalar_one_or_none()

    if draft is not None:
        await db.delete(draft)

    # Also clear old-style draft
    old_draft_key = draft_screen_key(module_id)
    result = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == user_id,
            ModuleState.module_type == old_draft_key,
        )
    )
    old_draft = result.scalars().first()
    if old_draft is not None:
        await db.delete(old_draft)

    await log_audit(
        db, user_id, "MODULE_DRAFT_DELETED", "module_draft",
        module_id, ip=request.client.host if request.client else None,
    )
    await db.commit()

    await send_draft_cleared(user_id, module_id)
    return {"module_id": module_id, "deleted": True}


# ── Checkpoint endpoints ───────────────────────────────────────────────────


@router.post("/{module_id}/checkpoints", response_model=ModuleCheckpointOut)
async def create_checkpoint(
    module_id: str,
    body: ModuleCheckpointCreate,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a checkpoint (versioned snapshot) from the current working draft.

    If no working draft exists, the live screen is checkpointed instead.
    """
    # Try to get SDUI JSON from working draft first
    result = await db.execute(
        select(ModuleWorkingDraft).where(
            ModuleWorkingDraft.module_id == module_id,
            ModuleWorkingDraft.user_id == user_id,
        )
    )
    draft = result.scalar_one_or_none()

    if draft is not None and draft.sdui_json:
        sdui_json = draft.sdui_json
    else:
        # Fallback: get live screen from ModuleState
        result = await db.execute(
            select(ModuleState).where(
                ModuleState.user_id == user_id,
                ModuleState.module_type == live_screen_key(module_id),
            )
        )
        live_state = result.scalars().first()
        if live_state is None or not live_state.state_json:
            raise HTTPException(
                status_code=400,
                detail="No working draft or live screen to checkpoint. Save something first.",
            )
        sdui_json = live_state.state_json

    version = await create_module_checkpoint(
        db,
        module_id=module_id,
        user_id=user_id,
        sdui_json=sdui_json,
        change_summary=body.change_summary,
        source="checkpoint",
    )

    # Mark draft as clean after checkpoint
    if draft is not None:
        draft.dirty = False
        draft.last_autosaved_at = datetime.now(timezone.utc)

    await log_audit(
        db, user_id, "CHECKPOINT_CREATED", "module_version",
        version.id, ip=request.client.host if request.client else None,
    )
    await db.commit()

    return ModuleCheckpointOut(
        id=version.id,
        version_number=version.version_number,
        display_name=version.display_name,
        created_at=version.created_at,
    )


# ── Version endpoints ──────────────────────────────────────────────────────


@router.get("/{module_id}/versions", response_model=PaginatedResponse[ModuleVersionOut])
async def list_versions(
    module_id: str,
    pagination: PaginationParams = Depends(),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List all versions for a module, newest first."""
    versions, total = await list_module_versions(
        db, module_id, user_id,
        offset=pagination.offset,
        limit=pagination.limit,
    )
    return PaginatedResponse[ModuleVersionOut](
        items=[ModuleVersionOut.model_validate(v) for v in versions],
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
        has_more=(pagination.offset + pagination.limit) < total,
    )


@router.get("/{module_id}/versions/{version_id}", response_model=ModuleVersionDetailOut)
async def get_version_detail(
    module_id: str,
    version_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get full version detail including SDUI JSON content."""
    result = await db.execute(
        select(ModuleVersion).where(
            ModuleVersion.id == version_id,
            ModuleVersion.module_id == module_id,
            ModuleVersion.user_id == user_id,
        )
    )
    version = result.scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=404, detail="Version not found")
    return ModuleVersionDetailOut.model_validate(version)


@router.patch("/{module_id}/versions/{version_id}/rename", response_model=ModuleVersionOut)
async def rename_version(
    module_id: str,
    version_id: str,
    body: ModuleVersionRename,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Rename a version with a custom name."""
    result = await db.execute(
        select(ModuleVersion).where(
            ModuleVersion.id == version_id,
            ModuleVersion.module_id == module_id,
            ModuleVersion.user_id == user_id,
        )
    )
    version = result.scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=404, detail="Version not found")

    version.custom_name = body.custom_name
    version.display_name = body.custom_name
    await db.commit()
    await db.refresh(version)
    return ModuleVersionOut.model_validate(version)


@router.post("/{module_id}/versions/{version_id}/restore-to-draft", response_model=ModuleWorkingDraftOut)
async def restore_version(
    module_id: str,
    version_id: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Restore a version's content back to the working draft."""
    try:
        draft = await restore_version_to_draft(
            db, module_id, version_id, user_id, as_draft=True,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    await log_audit(
        db, user_id, "VERSION_RESTORED_TO_DRAFT", "module_version",
        version_id, ip=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(draft)
    return ModuleWorkingDraftOut.model_validate(draft)


@router.post("/{module_id}/versions/{version_id}/publish", status_code=200)
async def publish_version(
    module_id: str,
    version_id: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Publish a version as the live screen.

    This is the equivalent of the old "approve draft" action.
    """
    result = await db.execute(
        select(ModuleVersion).where(
            ModuleVersion.id == version_id,
            ModuleVersion.module_id == module_id,
            ModuleVersion.user_id == user_id,
        )
    )
    version = result.scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=404, detail="Version not found")

    screen_json = version.sdui_json

    new_version, cleared_existing_draft = await persist_live_screen(
        db,
        user_id=user_id,
        module_id=module_id,
        screen=screen_json,
    )

    # Update module instance current version
    result = await db.execute(
        select(ModuleInstance).where(ModuleInstance.id == module_id)
    )
    instance = result.scalar_one_or_none()
    if instance is not None:
        instance.current_version_id = version.id

    await log_audit(
        db, user_id, "VERSION_PUBLISHED", "module_version",
        version_id, ip=request.client.host if request.client else None,
    )
    await db.commit()

    if cleared_existing_draft:
        await send_draft_cleared(user_id, module_id)
    await send_live_screen_update(user_id, module_id, screen_json, new_version)

    return {"module_id": module_id, "version_id": version_id, "version": new_version, "published": True}


# ── Module-level Preview endpoints ─────────────────────────────────────────


@router.post("/{module_id}/preview", response_model=PreviewSessionOut)
async def start_module_preview(
    module_id: str,
    body: PreviewSessionCreate,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Start a preview session for a module.

    Creates a snapshot of the current working draft and opens a
    time-limited preview.
    """
    # Get the SDUI JSON from working draft or live screen
    result = await db.execute(
        select(ModuleWorkingDraft).where(
            ModuleWorkingDraft.module_id == module_id,
            ModuleWorkingDraft.user_id == user_id,
        )
    )
    draft = result.scalar_one_or_none()

    if draft is not None and draft.sdui_json:
        preview_sdui = draft.sdui_json
    else:
        result = await db.execute(
            select(ModuleState).where(
                ModuleState.user_id == user_id,
                ModuleState.module_type == live_screen_key(module_id),
            )
        )
        live_state = result.scalars().first()
        preview_sdui = live_state.state_json if live_state else {}

    expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

    session = PreviewSession(
        id=str(uuid4()),
        user_id=user_id,
        target_type=body.target_type,
        module_id=module_id,
        app_id=body.app_id,
        device_id=body.device_id,
        resolved_sdui_json=preview_sdui,
        status="active",
        expires_at=expires_at,
    )
    db.add(session)
    await log_audit(
        db, user_id, "PREVIEW_STARTED", "preview_session",
        session.id, ip=None,
    )
    await db.commit()
    await db.refresh(session)
    return PreviewSessionOut.model_validate(session)


# ── Preview Session endpoints (shared) ─────────────────────────────────────


@router.get("/preview-sessions/{session_id}", response_model=PreviewSessionOut)
async def get_preview_session(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get preview session details."""
    result = await db.execute(
        select(PreviewSession).where(
            PreviewSession.id == session_id,
            PreviewSession.user_id == user_id,
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Preview session not found")
    return PreviewSessionOut.model_validate(session)


@router.post("/preview-sessions/{session_id}/exit", response_model=PreviewSessionOut)
async def exit_preview_session(
    session_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Exit a preview session."""
    result = await db.execute(
        select(PreviewSession).where(
            PreviewSession.id == session_id,
            PreviewSession.user_id == user_id,
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Preview session not found")

    session.status = "exited"
    session.exited_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(session)
    return PreviewSessionOut.model_validate(session)


@router.post("/preview-sessions/{session_id}/extend", response_model=PreviewSessionOut)
async def extend_preview_session(
    session_id: str,
    body: PreviewSessionExtend,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Extend a preview session's expiry time."""
    result = await db.execute(
        select(PreviewSession).where(
            PreviewSession.id == session_id,
            PreviewSession.user_id == user_id,
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=404, detail="Preview session not found")

    session.expires_at = session.expires_at + timedelta(minutes=body.additional_minutes)
    await db.commit()
    await db.refresh(session)
    return PreviewSessionOut.model_validate(session)


# ── Backward Compat: keep old approve/reject endpoints working ─────────────


@router.post("/{module_id}/draft/approve", status_code=200)
async def approve_draft_legacy(
    module_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """[Legacy] Approve a draft — creates a checkpoint and publishes it.

    Maintained for backward compatibility with existing frontend code.
    Internally creates a version checkpoint and publishes it.
    """
    user_id = str(current_user.id)

    # Get SDUI JSON from old-style draft or new working draft
    sdui_json = None

    # Try new working draft first
    result = await db.execute(
        select(ModuleWorkingDraft).where(
            ModuleWorkingDraft.module_id == module_id,
            ModuleWorkingDraft.user_id == user_id,
        )
    )
    draft = result.scalar_one_or_none()
    if draft is not None and draft.sdui_json:
        sdui_json = draft.sdui_json

    # Fallback to old draft
    if sdui_json is None:
        old_draft_key = draft_screen_key(module_id)
        result = await db.execute(
            select(ModuleState).where(
                ModuleState.user_id == user_id,
                ModuleState.module_type == old_draft_key,
            )
        )
        old_draft = result.scalars().first()
        if old_draft is None:
            raise HTTPException(
                status_code=404,
                detail=f"No draft found for module '{module_id}'",
            )
        sdui_json = old_draft.state_json
        # Clear old draft
        await db.delete(old_draft)

    # Create checkpoint
    version = await create_module_checkpoint(
        db, module_id, user_id, sdui_json,
        change_summary="Approved from draft",
        source="approve",
    )

    # Publish to live
    new_live_version, _ = await persist_live_screen(
        db, user_id=user_id, module_id=module_id, screen=sdui_json,
    )

    await log_audit(
        db, user_id, "SCREEN_APPROVED", "screen",
        module_id, ip=request.client.host if request.client else None,
    )
    await db.commit()

    await send_draft_cleared(user_id, module_id)
    await send_live_screen_update(user_id, module_id, sdui_json, new_live_version)

    return {
        "module_id": module_id,
        "version": new_live_version,
        "checkpoint_id": version.id,
        "approved": True,
    }


@router.post("/{module_id}/draft/reject", status_code=200)
async def reject_draft_legacy(
    module_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """[Legacy] Reject a draft — discard it.

    Maintained for backward compatibility.
    """
    user_id = str(current_user.id)

    # Clear new working draft
    result = await db.execute(
        select(ModuleWorkingDraft).where(
            ModuleWorkingDraft.module_id == module_id,
            ModuleWorkingDraft.user_id == user_id,
        )
    )
    draft = result.scalar_one_or_none()
    if draft is not None:
        await db.delete(draft)

    # Clear old-style draft
    old_key = draft_screen_key(module_id)
    result = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == user_id,
            ModuleState.module_type == old_key,
        )
    )
    old_draft = result.scalars().first()
    if old_draft is not None:
        await db.delete(old_draft)
    elif draft is None:
        # Neither draft existed
        raise HTTPException(
            status_code=404,
            detail=f"No draft found for module '{module_id}'",
        )

    await log_audit(
        db, user_id, "SCREEN_REJECTED", "screen",
        module_id, ip=request.client.host if request.client else None,
    )
    await db.commit()

    await send_draft_cleared(user_id, module_id)
    return {"module_id": module_id, "rejected": True}
