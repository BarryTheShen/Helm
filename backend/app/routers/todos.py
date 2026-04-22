from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.todo import Todo
from app.models.user import User
from app.schemas.todo import TodoCreate, TodoOut, TodosResponse, TodoUpdate
from app.services.audit import log_audit

router = APIRouter(prefix="/api/todos", tags=["todos"])


@router.get("", response_model=TodosResponse)
async def list_todos(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all todos for the current user."""
    query = select(Todo).where(
        Todo.user_id == str(current_user.id)
    ).order_by(Todo.created_at.desc())

    result = await db.execute(query)
    todos = result.scalars().all()

    return TodosResponse(
        todos=[
            TodoOut(
                id=str(t.id),
                text=t.text,
                completed=t.completed,
                created_at=t.created_at,
                updated_at=t.updated_at,
            )
            for t in todos
        ]
    )


@router.post("", response_model=TodoOut, status_code=201)
async def create_todo(
    body: TodoCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new todo item."""
    todo = Todo(
        id=str(uuid4()),
        user_id=str(current_user.id),
        text=body.text,
        completed=body.completed,
    )
    db.add(todo)
    await db.flush()
    await log_audit(
        db,
        str(current_user.id),
        "TODO_CREATED",
        "todo",
        str(todo.id),
        ip=request.client.host if request.client else None
    )
    await db.commit()

    return TodoOut(
        id=str(todo.id),
        text=todo.text,
        completed=todo.completed,
        created_at=todo.created_at,
        updated_at=todo.updated_at,
    )


@router.patch("/{todo_id}", response_model=TodoOut)
async def update_todo(
    todo_id: str,
    body: TodoUpdate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update a todo item (text or completed status)."""
    result = await db.execute(
        select(Todo).where(
            Todo.id == todo_id,
            Todo.user_id == str(current_user.id),
        )
    )
    todo = result.scalar_one_or_none()
    if todo is None:
        raise HTTPException(status_code=404, detail="Todo not found")

    update_data = body.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(todo, field, value)

    await db.flush()
    await db.refresh(todo)
    await log_audit(
        db,
        str(current_user.id),
        "TODO_UPDATED",
        "todo",
        str(todo.id),
        ip=request.client.host if request.client else None
    )
    await db.commit()

    return TodoOut(
        id=str(todo.id),
        text=todo.text,
        completed=todo.completed,
        created_at=todo.created_at,
        updated_at=todo.updated_at,
    )


@router.delete("/{todo_id}")
async def delete_todo(
    todo_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a todo item."""
    result = await db.execute(
        select(Todo).where(
            Todo.id == todo_id,
            Todo.user_id == str(current_user.id),
        )
    )
    todo = result.scalar_one_or_none()
    if todo is None:
        raise HTTPException(status_code=404, detail="Todo not found")

    await log_audit(
        db,
        str(current_user.id),
        "TODO_DELETED",
        "todo",
        todo_id,
        ip=request.client.host if request.client else None
    )
    await db.delete(todo)
    await db.commit()

    return {"message": "Todo deleted"}
