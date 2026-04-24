from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import PaginationParams, require_admin
from app.models.device import Device
from app.models.session import Session
from app.models.user import User
from app.schemas.common import PaginatedResponse
from app.schemas.users import UserCreate, UserDetailOut, UserOut, UserUpdate
from app.services.audit import log_audit
from app.utils.security import hash_password

router = APIRouter(prefix="/api/users", tags=["users"])


def _user_out(u: User) -> UserOut:
    return UserOut(id=str(u.id), username=u.username, role=u.role, created_at=u.created_at)


@router.get("", response_model=PaginatedResponse[UserOut])
async def list_users(
    search: str | None = None,
    pagination: PaginationParams = Depends(),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    base_where = []
    if search:
        # Escape SQL wildcards to prevent pattern matching abuse
        escaped_search = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        base_where.append(User.username.ilike(f"%{escaped_search}%"))

    count_q = select(func.count()).select_from(User)
    if base_where:
        count_q = count_q.where(*base_where)
    total = (await db.execute(count_q)).scalar_one()

    query = select(User)
    if base_where:
        query = query.where(*base_where)
    query = query.order_by(User.created_at).offset(pagination.offset).limit(pagination.limit)
    result = await db.execute(query)
    items = [_user_out(u) for u in result.scalars().all()]

    return PaginatedResponse(
        items=items,
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
        has_more=pagination.offset + pagination.limit < total,
    )


@router.post("", response_model=UserOut, status_code=201)
async def create_user(
    body: UserCreate,
    request: Request,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    existing = await db.execute(select(User).where(User.username == body.username))
    if existing.scalar_one_or_none() is not None:
        raise HTTPException(status_code=409, detail="Username already exists")

    user = User(
        id=str(uuid4()),
        username=body.username,
        password_hash=hash_password(body.password),
        role=body.role,
    )
    db.add(user)
    await db.flush()
    await log_audit(db, str(current_user.id), "USER_CREATED", "user", str(user.id), ip=request.client.host if request.client else None)
    return _user_out(user)


@router.get("/{user_id}", response_model=UserDetailOut)
async def get_user(
    user_id: str,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserDetailOut:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    device_count_q = await db.execute(
        select(func.count()).select_from(Device).where(Device.user_id == user_id)
    )
    active_session_q = await db.execute(
        select(func.count()).select_from(Session).where(
            Session.user_id == user_id, Session.is_active.is_(True)
        )
    )
    return UserDetailOut(
        id=str(user.id),
        username=user.username,
        role=user.role,
        created_at=user.created_at,
        device_count=device_count_q.scalar_one(),
        active_session_count=active_session_q.scalar_one(),
    )


@router.put("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: str,
    body: UserUpdate,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserOut:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    if body.role and body.role != "admin" and str(current_user.id) == user_id:
        raise HTTPException(status_code=400, detail="Cannot demote yourself from admin")

    if body.username is not None:
        existing = await db.execute(
            select(User).where(User.username == body.username, User.id != user_id)
        )
        if existing.scalar_one_or_none() is not None:
            raise HTTPException(status_code=409, detail="Username already exists")
        user.username = body.username

    if body.password is not None:
        user.password_hash = hash_password(body.password)

    if body.role is not None:
        user.role = body.role

    await db.flush()
    return _user_out(user)


@router.delete("/{user_id}", status_code=204)
async def delete_user(
    user_id: str,
    request: Request,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:
    if str(current_user.id) == user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    await log_audit(db, str(current_user.id), "USER_DELETED", "user", user_id, ip=request.client.host if request.client else None)
    await db.delete(user)
    await db.flush()
