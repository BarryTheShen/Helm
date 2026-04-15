from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import PaginationParams, get_current_user_id
from app.models.data_source import DataSource
from app.schemas.common import PaginatedResponse
from app.schemas.data_source import DataSourceCreate, DataSourceOut, DataSourceQueryParams, DataSourceUpdate
from app.services.audit import log_audit
from app.services.data_connectors import get_canonical_schema, query_data_source

router = APIRouter(prefix="/api/data-sources", tags=["data-sources"])


@router.get("", response_model=PaginatedResponse[DataSourceOut])
async def list_data_sources(
    pagination: PaginationParams = Depends(),
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    total = (await db.execute(
        select(func.count()).select_from(DataSource).where(DataSource.user_id == user_id)
    )).scalar_one()

    result = await db.execute(
        select(DataSource)
        .where(DataSource.user_id == user_id)
        .order_by(DataSource.created_at)
        .offset(pagination.offset)
        .limit(pagination.limit)
    )
    sources = result.scalars().all()

    return PaginatedResponse(
        items=[DataSourceOut.model_validate(s) for s in sources],
        total=total,
        limit=pagination.limit,
        offset=pagination.offset,
        has_more=pagination.offset + pagination.limit < total,
    )


@router.post("", response_model=DataSourceOut, status_code=status.HTTP_201_CREATED)
async def create_data_source(
    body: DataSourceCreate,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    source = DataSource(
        id=str(uuid4()),
        user_id=user_id,
        name=body.name,
        type=body.type,
        connector=body.connector,
        config_json=body.config_json,
    )
    db.add(source)
    await db.commit()
    await db.refresh(source)

    await log_audit(
        db, user_id, "DATA_SOURCE_CREATED", "data_source", source.id,
        ip=request.client.host if request.client else None,
    )

    return DataSourceOut.model_validate(source)


@router.get("/{source_id}/schema")
async def get_data_source_schema(
    source_id: str,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DataSource).where(
            DataSource.id == source_id,
            DataSource.user_id == user_id,
        )
    )
    source = result.scalar_one_or_none()
    if source is None:
        raise HTTPException(status_code=404, detail="Data source not found")

    schema = get_canonical_schema(source.type)
    if schema is None:
        return {"source_id": source_id, "type": source.type, "schema": None}

    return {"source_id": source_id, "type": source.type, "schema": schema}


@router.post("/{source_id}/query")
async def query_data(
    source_id: str,
    body: DataSourceQueryParams,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DataSource).where(
            DataSource.id == source_id,
            DataSource.user_id == user_id,
        )
    )
    source = result.scalar_one_or_none()
    if source is None:
        raise HTTPException(status_code=404, detail="Data source not found")

    data = await query_data_source(
        source_type=source.type,
        user_id=user_id,
        db=db,
        filters=body.filters,
        limit=body.limit,
        offset=body.offset,
    )

    return {"source_id": source_id, "type": source.type, "data": data, "count": len(data)}


@router.put("/{source_id}", response_model=DataSourceOut)
async def update_data_source(
    source_id: str,
    body: DataSourceUpdate,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DataSource).where(
            DataSource.id == source_id,
            DataSource.user_id == user_id,
        )
    )
    source = result.scalar_one_or_none()
    if source is None:
        raise HTTPException(status_code=404, detail="Data source not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(source, field, value)
    await db.commit()
    await db.refresh(source)

    await log_audit(
        db, user_id, "DATA_SOURCE_UPDATED", "data_source", source.id,
        ip=request.client.host if request.client else None,
    )

    return DataSourceOut.model_validate(source)


@router.delete("/{source_id}", status_code=204)
async def delete_data_source(
    source_id: str,
    request: Request,
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DataSource).where(
            DataSource.id == source_id,
            DataSource.user_id == user_id,
        )
    )
    source = result.scalar_one_or_none()
    if source is None:
        raise HTTPException(status_code=404, detail="Data source not found")
    await db.delete(source)
    await db.commit()

    await log_audit(
        db, user_id, "DATA_SOURCE_DELETED", "data_source", source_id,
        ip=request.client.host if request.client else None,
    )
