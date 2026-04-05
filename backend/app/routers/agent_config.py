import base64
import hashlib
from uuid import uuid4

from cryptography.fernet import Fernet
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user
from app.models.agent_config import AgentConfig
from app.models.user import User
from app.schemas.agent_config import AgentConfigOut, AgentConfigUpdate


def _get_fernet() -> Fernet:
    """Derive a Fernet key from the app's secret key."""
    key_material = settings.secret_key.encode()
    digest = hashlib.sha256(key_material).digest()
    fernet_key = base64.urlsafe_b64encode(digest)
    return Fernet(fernet_key)


def _encrypt_api_key(api_key: str) -> str:
    """Encrypt an API key string, return base64-encoded ciphertext."""
    return _get_fernet().encrypt(api_key.encode()).decode()


def _decrypt_api_key(encrypted: str) -> str:
    """Decrypt an encrypted API key string, return plaintext."""
    return _get_fernet().decrypt(encrypted.encode()).decode()

router = APIRouter(prefix="/api/agent", tags=["agent-config"])


async def _get_or_create_config(db: AsyncSession, user_id: str) -> AgentConfig:
    result = await db.execute(
        select(AgentConfig).where(
            AgentConfig.user_id == user_id,
            AgentConfig.is_active == True,  # noqa: E712
        )
    )
    config = result.scalar_one_or_none()
    if config is None:
        config = AgentConfig(
            id=str(uuid4()),
            user_id=user_id,
            provider="openai",
            model="gpt-4o",
            api_key_encrypted=None,
            temperature=0.7,
            max_tokens=4096,
            is_active=True,
        )
        db.add(config)
        await db.flush()
    return config


@router.get("/config", response_model=AgentConfigOut)
async def get_agent_config(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    config = await _get_or_create_config(db, str(current_user.id))
    return AgentConfigOut(
        id=str(config.id),
        provider=config.provider,
        model=config.model,
        api_key_set=bool(config.api_key_encrypted),
        base_url=config.base_url,
        system_prompt=config.system_prompt,
        temperature=config.temperature,
        max_tokens=config.max_tokens,
        is_active=config.is_active,
    )


@router.put("/config", response_model=AgentConfigOut)
async def update_agent_config(
    body: AgentConfigUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    config = await _get_or_create_config(db, str(current_user.id))
    if body.provider is not None:
        config.provider = body.provider
    if body.model is not None:
        config.model = body.model
    if body.api_key is not None:
        config.api_key_encrypted = _encrypt_api_key(body.api_key)
    if body.base_url is not None:
        config.base_url = body.base_url
    if body.system_prompt is not None:
        config.system_prompt = body.system_prompt
    if body.temperature is not None:
        config.temperature = body.temperature
    if body.max_tokens is not None:
        config.max_tokens = body.max_tokens
    await db.flush()
    return AgentConfigOut(
        id=str(config.id),
        provider=config.provider,
        model=config.model,
        api_key_set=bool(config.api_key_encrypted),
        base_url=config.base_url,
        system_prompt=config.system_prompt,
        temperature=config.temperature,
        max_tokens=config.max_tokens,
        is_active=config.is_active,
    )
