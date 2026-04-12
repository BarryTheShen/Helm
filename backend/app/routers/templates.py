from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import PaginationParams, get_current_user, get_current_user_id
from app.models.module_state import ModuleState
from app.models.screen_history import ScreenHistory
from app.models.template import SDUITemplate
from app.models.user import User
from app.schemas.common import PaginatedResponse
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
    prepare_sdui_screen_for_storage,
    send_draft_update,
)

router = APIRouter(prefix="/api/templates", tags=["templates"])

VALID_CATEGORIES = {"dashboard", "planner", "tracker", "form", "custom"}


def _prepare_template_screen_or_422(screen_json: dict, module_id: str) -> dict:
    """Normalize template SDUI payloads using the shared module save contract."""
    try:
        return prepare_sdui_screen_for_storage(screen_json, module_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


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
        update_data["screen_json"] = _prepare_template_screen_or_422(update_data["screen_json"], template_id)

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

    # Create/update a draft (same pattern as the existing draft system)
    draft_key = draft_screen_key(module_id)
    result = await db.execute(
        select(ModuleState).where(
            ModuleState.user_id == user_id,
            ModuleState.module_type == draft_key,
        )
    )
    draft = result.scalar_one_or_none()
    if draft is None:
        draft = ModuleState(
            id=str(uuid4()),
            user_id=user_id,
            module_type=draft_key,
            state_json=screen_json,
            version=1,
        )
        db.add(draft)
    else:
        draft.state_json = screen_json
        draft.version += 1

    await _record_screen_history(db, user_id, module_id, screen_json, source="template")
    await db.commit()

    await send_draft_update(user_id, module_id, screen_json, draft.version)

    return {"module_id": module_id, "version": draft.version, "template_id": template_id, "applied": True}


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
