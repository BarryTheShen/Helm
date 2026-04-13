"""Providers router — lists available LLM providers and their presets."""

from fastapi import APIRouter

from app.providers import list_providers

router = APIRouter(prefix="/api/providers", tags=["providers"])


@router.get("")
async def get_providers():
    """Return all supported LLM providers with their presets."""
    return {"providers": list_providers()}
