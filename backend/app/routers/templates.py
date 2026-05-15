from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import PaginationParams, get_current_user, get_current_user_id
from app.models.module_state import ModuleState
from app.models.module_working_draft import ModuleWorkingDraft
from app.models.screen_history import ScreenHistory
from app.models.template import SDUITemplate
from app.models.template_version import TemplateVersion
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.template_version import (
    TemplateVersionCreate,
    TemplateVersionDetailOut,
    TemplateVersionOut,
    TemplateVersionRename,
)
from app.schemas.templates import (
    ApplyTemplateRequest,
    TemplateCreate,
    TemplateDetailOut,
    TemplateOut,
    TemplateUpdate,
)
from app.services.audit import log_audit
from app.services.sdui_state import (
    draft_screen_key,
    validate_sdui_screen_payload,
    send_draft_update,
)
from app.services.version_service import create_module_checkpoint, make_timestamp_name

logger = __import__("logging").getLogger(__name__)

router = APIRouter(prefix="/api/templates", tags=["templates"])

VALID_CATEGORIES = {"dashboard", "planner", "tracker", "form", "custom"}


def _prepare_template_screen_or_422(screen_json: dict, module_id: str) -> dict:
    """Normalize and validate a template SDUI payload.

    Validates all component types against the registered V2 component set
    (including nested Container children). Returns 422 with a clear message
    listing any invalid types found.
    """
    normalized_screen, errors = validate_sdui_screen_payload(screen_json)
    if errors:
        error_detail = "\n".join(f"  - {e}" for e in errors)
        raise HTTPException(
            status_code=422,
            detail=(
                f"SDUI template validation failed for module '{module_id}':\n"
                f"{error_detail}\n"
                "Provide a valid row-first screen with registered V2 component types."
            ),
        )
    assert normalized_screen is not None
    return normalized_screen


async def _record_screen_history(
    db: AsyncSession,
    user_id: str,
    module_id: str,
    screen_json: dict,
    source: str,
) -> ScreenHistory:
    """Record a screen history entry with the next version number."""
    max_version = await db.execute(
        select(func.max(ScreenHistory.version)).where(
            ScreenHistory.module_id == module_id,
            ScreenHistory.user_id == user_id,
        )
    )
    version = (max_version.scalar() or 0) + 1
    entry = ScreenHistory(
        id=str(uuid4()),
        user_id=user_id,
        module_id=module_id,
        screen_json=screen_json,
        version=version,
        source=source,
    )
    db.add(entry)
    return entry


@router.get("", response_model=PaginatedResponse[TemplateOut])
async def list_templates(
    pagination: PaginationParams = Depends(),
    category: str | None = Query(default=None),
    search: str | None = Query(default=None),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List templates: own private + all public. Filterable by category and search term."""
    base_filter = or_(
        SDUITemplate.is_public == True,  # noqa: E712
        SDUITemplate.created_by == current_user_id,
    )
    query = select(SDUITemplate).where(base_filter)

    if category:
        query = query.where(SDUITemplate.category == category)
    if search:
        pattern = f"%{search}%"
        query = query.where(
            or_(
                SDUITemplate.name.ilike(pattern),
                SDUITemplate.description.ilike(pattern),
            )
        )

    count_query = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(SDUITemplate.created_at.desc())
    query = query.offset(pagination.offset).limit(pagination.limit)
    results = (await db.execute(query)).scalars().all()

    return PaginatedResponse[TemplateOut](
        items=[TemplateOut.model_validate(t) for t in results],
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
        has_more=(pagination.offset + pagination.limit) < total,
    )


@router.post("", response_model=TemplateDetailOut, status_code=201)
async def create_template(
    body: TemplateCreate,
    request: Request,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a new SDUI template."""
    if body.category not in VALID_CATEGORIES:
        raise HTTPException(status_code=422, detail=f"Invalid category. Must be one of: {', '.join(sorted(VALID_CATEGORIES))}")

    screen_json = _prepare_template_screen_or_422(body.screen_json, "template")

    template = SDUITemplate(
        id=str(uuid4()),
        name=body.name,
        description=body.description,
        category=body.category,
        screen_json=screen_json,
        created_by=current_user_id,
        is_public=body.is_public,
    )
    db.add(template)
    await log_audit(db, current_user_id, "TEMPLATE_CREATED", "template", template.id, ip=request.client.host if request.client else None)
    await db.commit()
    await db.refresh(template)
    return TemplateDetailOut.model_validate(template)


@router.get("/{template_id}", response_model=TemplateDetailOut)
async def get_template(
    template_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get a single template with full screen_json."""
    template = await db.get(SDUITemplate, template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    if not template.is_public and template.created_by != current_user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return TemplateDetailOut.model_validate(template)


@router.put("/{template_id}", response_model=TemplateDetailOut)
async def update_template(
    template_id: str,
    body: TemplateUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a template. Only owner or admin."""
    template = await db.get(SDUITemplate, template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    if template.created_by != str(current_user.id) and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only the owner or an admin can update this template")

    if body.category is not None and body.category not in VALID_CATEGORIES:
        raise HTTPException(status_code=422, detail=f"Invalid category. Must be one of: {', '.join(sorted(VALID_CATEGORIES))}")

    update_data = body.model_dump(exclude_unset=True)
    if "screen_json" in update_data:
        raw_screen = update_data["screen_json"]
        # Check the original payload (before normalization adds empty sections/rows)
        if "rows" not in raw_screen and "sections" not in raw_screen:
            raise HTTPException(
                status_code=422,
                detail="screen_json must contain either a row-first 'rows' array or a legacy 'sections' array.",
            )
        update_data["screen_json"] = _prepare_template_screen_or_422(raw_screen, template_id)

    for key, value in update_data.items():
        setattr(template, key, value)

    await log_audit(db, str(current_user.id), "TEMPLATE_UPDATED", "template", template_id, ip=request.client.host if request.client else None)
    await db.commit()
    await db.refresh(template)
    return TemplateDetailOut.model_validate(template)


@router.delete("/{template_id}", status_code=200)
async def delete_template(
    template_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a template. Only owner or admin."""
    template = await db.get(SDUITemplate, template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    if template.created_by != str(current_user.id) and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only the owner or an admin can delete this template")

    await log_audit(db, str(current_user.id), "TEMPLATE_DELETED", "template", template_id, ip=request.client.host if request.client else None)
    await db.delete(template)
    await db.commit()
    return {"id": template_id, "deleted": True}


@router.post("/{template_id}/apply", status_code=200)
async def apply_template(
    template_id: str,
    body: ApplyTemplateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Apply a template to a module by creating a draft."""
    template = await db.get(SDUITemplate, template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    if not template.is_public and template.created_by != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")

    user_id = str(current_user.id)
    module_id = body.module_id
    screen_json = _prepare_template_screen_or_422(template.screen_json, module_id)

    # ── Auto-checkpoint before applying to existing module ─────────────────
    # If the module already has a working draft with content, create a
    # checkpoint to preserve it before overwriting with the template.
    if body.auto_checkpoint:
        existing_wd = await db.execute(
            select(ModuleWorkingDraft).where(
                ModuleWorkingDraft.module_id == module_id,
                ModuleWorkingDraft.user_id == user_id,
            )
        )
        existing = existing_wd.scalar_one_or_none()
        if existing is not None and existing.sdui_json and existing.sdui_json.get("rows"):
            try:
                await create_module_checkpoint(
                    db, module_id, user_id,
                    sdui_json=existing.sdui_json,
                    change_summary="Auto-checkpoint before template apply",
                    source="template_apply",
                )
                logger.info(
                    "Auto-checkpoint created for module %s before template apply",
                    module_id,
                )
            except Exception as exc:
                logger.warning(
                    "Auto-checkpoint failed for module %s: %s (continuing with apply)",
                    module_id, exc,
                )

    # ── Write to new ModuleWorkingDraft system ─────────────────────────────
    wd_result = await db.execute(
        select(ModuleWorkingDraft).where(
            ModuleWorkingDraft.module_id == module_id,
            ModuleWorkingDraft.user_id == user_id,
        )
    )
    working_draft = wd_result.scalar_one_or_none()
    if working_draft is None:
        working_draft = ModuleWorkingDraft(
            module_id=module_id,
            user_id=user_id,
            sdui_json=screen_json,
            dirty=True,
        )
        db.add(working_draft)
    else:
        working_draft.sdui_json = screen_json
        working_draft.dirty = True

    # ── Also write to old ModuleState draft for backward compatibility ─────
    draft_key = draft_screen_key(module_id)
    result = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == user_id,
            ModuleState.module_type == draft_key,
        )
    )
    old_draft = result.scalar_one_or_none()
    if old_draft is None:
        old_draft = ModuleState(
            id=str(uuid4()),
            user_id=user_id,
            module_type=draft_key,
            state_json=screen_json,
            version=1,
        )
        db.add(old_draft)
    else:
        old_draft.state_json = screen_json
        old_draft.version += 1

    await _record_screen_history(db, user_id, module_id, screen_json, source="template")
    await db.commit()

    await send_draft_update(user_id, module_id, screen_json, old_draft.version)

    return {
        "module_id": module_id,
        "version": old_draft.version,
        "template_id": template_id,
        "working_draft_version": True,
        "applied": True,
    }


@router.post("/import", response_model=TemplateDetailOut, status_code=201)
async def import_template(
    body: TemplateCreate,
    request: Request,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Import a template from raw JSON using the shared SDUI save contract."""
    if body.category not in VALID_CATEGORIES:
        raise HTTPException(status_code=422, detail=f"Invalid category. Must be one of: {', '.join(sorted(VALID_CATEGORIES))}")

    screen_json = _prepare_template_screen_or_422(body.screen_json, "template")

    template = SDUITemplate(
        id=str(uuid4()),
        name=body.name,
        description=body.description,
        category=body.category,
        screen_json=screen_json,
        created_by=current_user_id,
        is_public=body.is_public,
    )
    db.add(template)
    await log_audit(db, current_user_id, "TEMPLATE_CREATED", "template", template.id, ip=request.client.host if request.client else None)
    await db.commit()
    await db.refresh(template)
    return TemplateDetailOut.model_validate(template)


@router.get("/{template_id}/rows")
async def get_template_rows(
    template_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get only rows/sections from a template's screen_json for row-level drag."""
    template = await db.get(SDUITemplate, template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    if not template.is_public and template.created_by != current_user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    screen = template.screen_json or {}
    return {
        "template_id": template_id,
        "rows": screen.get("rows", []),
        "sections": screen.get("sections", []),
    }


# ── Template Versioning endpoints ───────────────────────────────────────────


@router.get("/{template_id}/versions", response_model=PaginatedResponse[TemplateVersionOut])
async def list_template_versions(
    template_id: str,
    pagination: PaginationParams = Depends(),
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """List all versions for a template, newest first."""
    template = await db.get(SDUITemplate, template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    if not template.is_public and template.created_by != current_user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    query = (
        select(TemplateVersion)
        .where(
            TemplateVersion.template_id == template_id,
            TemplateVersion.user_id == current_user_id,
        )
        .order_by(TemplateVersion.version_number.desc())
        .offset(pagination.offset)
        .limit(pagination.limit)
    )
    count_query = select(func.count()).select_from(
        select(TemplateVersion).where(
            TemplateVersion.template_id == template_id,
            TemplateVersion.user_id == current_user_id,
        ).subquery()
    )

    results = await db.execute(query)
    total = (await db.execute(count_query)).scalar() or 0
    versions = list(results.scalars().all())

    return PaginatedResponse[TemplateVersionOut](
        items=[TemplateVersionOut.model_validate(v) for v in versions],
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
        has_more=(pagination.offset + pagination.limit) < total,
    )


@router.post("/{template_id}/versions", response_model=TemplateVersionDetailOut, status_code=201)
async def create_template_version(
    template_id: str,
    body: TemplateVersionCreate,
    request: Request,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Create a versioned snapshot from the current template JSON."""
    template = await db.get(SDUITemplate, template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    if not template.is_public and template.created_by != current_user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get next version number
    result = await db.execute(
        select(func.max(TemplateVersion.version_number)).where(
            TemplateVersion.template_id == template_id,
        )
    )
    max_num = result.scalar() or 0
    version_number = max_num + 1

    timestamp_name = make_timestamp_name()
    display_name = f"v{version_number} — {timestamp_name}"

    version = TemplateVersion(
        id=str(uuid4()),
        template_id=template_id,
        user_id=current_user_id,
        version_number=version_number,
        display_name=display_name,
        default_timestamp_name=timestamp_name,
        custom_name=None,
        template_json=body.template_json,
        source="manual",
        change_summary=body.change_summary,
        validation_status="valid",
    )
    db.add(version)

    # Update template's current_version_id
    template.current_version_id = version.id

    await log_audit(
        db, current_user_id, "TEMPLATE_VERSION_CREATED", "template_version",
        version.id, ip=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(version)
    return TemplateVersionDetailOut.model_validate(version)


@router.get("/{template_id}/versions/{version_id}", response_model=TemplateVersionDetailOut)
async def get_template_version_detail(
    template_id: str,
    version_id: str,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Get full template version detail including template JSON."""
    template = await db.get(SDUITemplate, template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    if not template.is_public and template.created_by != current_user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(TemplateVersion).where(
            TemplateVersion.id == version_id,
            TemplateVersion.template_id == template_id,
        )
    )
    version = result.scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=404, detail="Version not found")
    return TemplateVersionDetailOut.model_validate(version)


@router.patch("/{template_id}/versions/{version_id}/rename", response_model=TemplateVersionOut)
async def rename_template_version(
    template_id: str,
    version_id: str,
    body: TemplateVersionRename,
    current_user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    """Rename a template version with a custom name."""
    template = await db.get(SDUITemplate, template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    if not template.is_public and template.created_by != current_user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(TemplateVersion).where(
            TemplateVersion.id == version_id,
            TemplateVersion.template_id == template_id,
            TemplateVersion.user_id == current_user_id,
        )
    )
    version = result.scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=404, detail="Version not found")

    version.custom_name = body.custom_name
    version.display_name = body.custom_name
    await db.commit()
    await db.refresh(version)
    return TemplateVersionOut.model_validate(version)


@router.post("/{template_id}/versions/{version_id}/apply", status_code=200)
async def apply_template_version(
    template_id: str,
    version_id: str,
    body: ApplyTemplateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Apply a template version to a module by creating a draft.

    Looks up the versioned template JSON and applies it the same way as
    the regular template apply endpoint.
    """
    template = await db.get(SDUITemplate, template_id)
    if template is None:
        raise HTTPException(status_code=404, detail="Template not found")
    if not template.is_public and template.created_by != str(current_user.id):
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(TemplateVersion).where(
            TemplateVersion.id == version_id,
            TemplateVersion.template_id == template_id,
        )
    )
    version = result.scalar_one_or_none()
    if version is None:
        raise HTTPException(status_code=404, detail="Version not found")

    user_id = str(current_user.id)
    module_id = body.module_id
    screen_json = _prepare_template_screen_or_422(version.template_json, module_id)

    # ── Auto-checkpoint before applying version to existing module ─────────
    if body.auto_checkpoint:
        existing_wd = await db.execute(
            select(ModuleWorkingDraft).where(
                ModuleWorkingDraft.module_id == module_id,
                ModuleWorkingDraft.user_id == user_id,
            )
        )
        existing = existing_wd.scalar_one_or_none()
        if existing is not None and existing.sdui_json and existing.sdui_json.get("rows"):
            try:
                await create_module_checkpoint(
                    db, module_id, user_id,
                    sdui_json=existing.sdui_json,
                    change_summary="Auto-checkpoint before template version apply",
                    source="template_version_apply",
                )
                logger.info(
                    "Auto-checkpoint created for module %s before template version apply",
                    module_id,
                )
            except Exception as exc:
                logger.warning(
                    "Auto-checkpoint failed for module %s: %s (continuing with apply)",
                    module_id, exc,
                )

    # ── Write to new ModuleWorkingDraft system ─────────────────────────────
    wd_result = await db.execute(
        select(ModuleWorkingDraft).where(
            ModuleWorkingDraft.module_id == module_id,
            ModuleWorkingDraft.user_id == user_id,
        )
    )
    working_draft = wd_result.scalar_one_or_none()
    if working_draft is None:
        working_draft = ModuleWorkingDraft(
            module_id=module_id,
            user_id=user_id,
            sdui_json=screen_json,
            dirty=True,
        )
        db.add(working_draft)
    else:
        working_draft.sdui_json = screen_json
        working_draft.dirty = True

    # ── Also write to old ModuleState draft for backward compatibility ─────
    draft_key = draft_screen_key(module_id)
    result = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == user_id,
            ModuleState.module_type == draft_key,
        )
    )
    old_draft = result.scalar_one_or_none()
    if old_draft is None:
        old_draft = ModuleState(
            id=str(uuid4()),
            user_id=user_id,
            module_type=draft_key,
            state_json=screen_json,
            version=1,
        )
        db.add(old_draft)
    else:
        old_draft.state_json = screen_json
        old_draft.version += 1

    await _record_screen_history(db, user_id, module_id, screen_json, source="template_version")
    await db.commit()

    await send_draft_update(user_id, module_id, screen_json, old_draft.version)

    return {
        "module_id": module_id,
        "version": old_draft.version,
        "template_id": template_id,
        "version_id": version_id,
        "working_draft_version": True,
        "applied": True,
    }
