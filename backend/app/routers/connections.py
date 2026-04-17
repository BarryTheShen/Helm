import base64
import hashlib
import json
from uuid import uuid4

from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import PaginationParams, get_current_user_id
from app.models.connection import Connection
from app.schemas.common import PaginatedResponse
from app.schemas.connection import ConnectionCreate, ConnectionOut, ConnectionUpdate
from app.services.audit import log_audit

router = APIRouter(prefix="/api/connections", tags=["connections"])


def _get_fernet() -> Fernet:
    """Derive a Fernet key from the app's secret key."""
    key_material = settings.secret_key.encode()
    digest = hashlib.sha256(key_material).digest()
    fernet_key = base64.urlsafe_b64encode(digest)
    return Fernet(fernet_key)


def _encrypt_credentials(credentials: dict) -> str:
    """Encrypt credentials dict, return base64-encoded ciphertext."""
    json_str = json.dumps(credentials)
    return _get_fernet().encrypt(json_str.encode()).decode()


def _decrypt_credentials(encrypted: str) -> dict:
    """Decrypt encrypted credentials string, return dict."""
    json_str = _get_fernet().decrypt(encrypted.encode()).decode()
    return json.loads(json_str)


@router.get("", response_model=PaginatedResponse[ConnectionOut])
async def list_connections(
    pagination: PaginationParams = Depends(),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    total = (await db.execute(
        select(func.count()).select_from(Connection).where(Connection.user_id == user_id)
    )).scalar_one()

    result = await db.execute(
        select(Connection)
        .where(Connection.user_id == user_id)
        .order_by(Connection.created_at)
        .offset(pagination.offset)
        .limit(pagination.limit)
    )
    connections = result.scalars().all()

    return PaginatedResponse(
        items=[ConnectionOut.model_validate(c) for c in connections],
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
        has_more=pagination.offset + pagination.limit < total,
    )


@router.post("", response_model=ConnectionOut, status_code=status.HTTP_201_CREATED)
async def create_connection(
    body: ConnectionCreate,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    # Check for duplicate name
    existing = (await db.execute(
        select(Connection).where(
            Connection.user_id == user_id,
            Connection.name == body.name,
        )
    )).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Connection '{body.name}' already exists",
        )

    connection = Connection(
        id=str(uuid4()),
        user_id=user_id,
        name=body.name,
        provider=body.provider,
        credentials_encrypted=_encrypt_credentials(body.credentials),
    )
    db.add(connection)
    await db.commit()
    await db.refresh(connection)

    await log_audit(
        db, user_id, "CONNECTION_CREATED", "connection", connection.id,
        ip=request.client.host if request.client else None,
    )

    return ConnectionOut.model_validate(connection)


@router.get("/{connection_id}", response_model=ConnectionOut)
async def get_connection(
    connection_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Connection).where(
            Connection.id == connection_id,
            Connection.user_id == user_id,
        )
    )
    connection = result.scalar_one_or_none()
    if connection is None:
        raise HTTPException(status_code=404, detail="Connection not found")

    return ConnectionOut.model_validate(connection)


@router.put("/{connection_id}", response_model=ConnectionOut)
async def update_connection(
    connection_id: str,
    body: ConnectionUpdate,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Connection).where(
            Connection.id == connection_id,
            Connection.user_id == user_id,
        )
    )
    connection = result.scalar_one_or_none()
    if connection is None:
        raise HTTPException(status_code=404, detail="Connection not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        if field == "credentials":
            # Re-encrypt credentials if changed
            connection.credentials_encrypted = _encrypt_credentials(value)
        else:
            setattr(connection, field, value)

    await db.commit()
    await db.refresh(connection)

    await log_audit(
        db, user_id, "CONNECTION_UPDATED", "connection", connection.id,
        ip=request.client.host if request.client else None,
    )

    return ConnectionOut.model_validate(connection)


@router.delete("/{connection_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_connection(
    connection_id: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Connection).where(
            Connection.id == connection_id,
            Connection.user_id == user_id,
        )
    )
    connection = result.scalar_one_or_none()
    if connection is None:
        raise HTTPException(status_code=404, detail="Connection not found")

    await db.delete(connection)
    await db.commit()

    await log_audit(
        db, user_id, "CONNECTION_DELETED", "connection", connection_id,
        ip=request.client.host if request.client else None,
    )
