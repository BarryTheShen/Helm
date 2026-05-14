"""Notes router — CRUD endpoints for user notes."""
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.note import Note
from app.models.user import User
from app.schemas.note import NoteCreate, NoteOut, NotesResponse, NoteUpdate
from app.services.audit import log_audit

router = APIRouter(prefix="/api/notes", tags=["notes"])


@router.get("", response_model=NotesResponse)
async def list_notes(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all notes for the current user."""
    # Count total
    count_stmt = select(func.count()).select_from(Note).where(Note.user_id == str(current_user.id))
    total = (await db.execute(count_stmt)).scalar_one()

    # Fetch notes ordered by most recent
    stmt = (
        select(Note)
        .where(Note.user_id == str(current_user.id))
        .order_by(Note.created_at.desc())
    )
    result = await db.execute(stmt)
    notes = result.scalars().all()

    return NotesResponse(
        notes=[NoteOut.model_validate(n) for n in notes],
        total=total,
    )


@router.post("", response_model=NoteOut, status_code=201)
async def create_note(
    body: NoteCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new note."""
    note = Note(
        id=str(uuid4()),
        user_id=str(current_user.id),
        title=body.title,
        content=body.content,
    )
    db.add(note)
    await db.flush()
    await log_audit(
        db,
        str(current_user.id),
        "NOTE_CREATED",
        "note",
        str(note.id),
        ip=request.client.host if request.client else None,
    )
    await db.commit()
    await db.refresh(note)

    return NoteOut.model_validate(note)


@router.get("/{note_id}", response_model=NoteOut)
async def get_note(
    note_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single note by ID."""
    stmt = select(Note).where(Note.id == note_id, Note.user_id == str(current_user.id))
    result = await db.execute(stmt)
    note = result.scalar_one_or_none()

    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    return NoteOut.model_validate(note)


@router.patch("/{note_id}", response_model=NoteOut)
async def update_note(
    note_id: str,
    body: NoteUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a note (title or content)."""
    stmt = select(Note).where(Note.id == note_id, Note.user_id == str(current_user.id))
    result = await db.execute(stmt)
    note = result.scalar_one_or_none()

    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    update_data = body.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(note, field, value)

    await db.flush()
    await db.refresh(note)
    await log_audit(
        db,
        str(current_user.id),
        "NOTE_UPDATED",
        "note",
        str(note.id),
        ip=request.client.host if request.client else None,
    )
    await db.commit()

    return NoteOut.model_validate(note)


@router.delete("/{note_id}")
async def delete_note(
    note_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a note."""
    stmt = select(Note).where(Note.id == note_id, Note.user_id == str(current_user.id))
    result = await db.execute(stmt)
    note = result.scalar_one_or_none()

    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    await log_audit(
        db,
        str(current_user.id),
        "NOTE_DELETED",
        "note",
        note_id,
        ip=request.client.host if request.client else None,
    )
    await db.delete(note)
    await db.commit()

    return {"message": "Note deleted"}
