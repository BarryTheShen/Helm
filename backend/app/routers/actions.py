"""
Actions router — executes named server-side functions from SDUI actions.

Architecture Decision: Session 2, Section 5. SDUI components use
`{type: 'server_action', function: 'name', params: {...}}` instead of raw URLs.
The function registry (action_registry.py) whitelists allowed functions.
"""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services.action_registry import registry

router = APIRouter(prefix="/api/actions", tags=["actions"])


class ActionRequest(BaseModel):
    function: str
    params: dict[str, Any] = {}


class ActionResponse(BaseModel):
    status: str
    result: dict[str, Any] = {}


@router.post("/execute", response_model=ActionResponse)
async def execute_action(
    body: ActionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Execute a named server-side action function.

    The function must be registered in the action registry (whitelist model).
    All functions are scoped to the authenticated user.
    """
    if not registry.is_registered(body.function):
        raise HTTPException(status_code=404, detail=f"Unknown action: {body.function}")

    try:
        result = await registry.execute(
            name=body.function,
            user_id=str(current_user.id),
            params=body.params,
            db=db,
        )
        return ActionResponse(status="ok", result=result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Action failed: {exc}")


@router.get("/functions")
async def list_functions(
    current_user: User = Depends(get_current_user),
):
    """List all available server-side action functions."""
    return {"functions": registry.list_functions()}
