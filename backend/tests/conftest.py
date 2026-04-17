"""Shared pytest fixtures for Helm backend tests."""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.database import get_db, is_sandbox_mode
from app.main import app
from app.models.base import Base

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest.fixture(scope="function")
async def db_engine():
    engine = create_async_engine(
        TEST_DB_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture(scope="function")
async def db_session(db_engine):
    factory = async_sessionmaker(
        db_engine, class_=AsyncSession, expire_on_commit=False, autoflush=False
    )
    async with factory() as session:
        yield session


@pytest.fixture(scope="function")
async def client(db_engine):
    factory = async_sessionmaker(
        db_engine, class_=AsyncSession, expire_on_commit=False, autoflush=False
    )

    async def override_get_db():
        async with factory() as session:
            if is_sandbox_mode():
                _original_commit = session.commit

                async def _sandbox_commit() -> None:
                    await session.flush()

                session.commit = _sandbox_commit  # type: ignore[assignment]
                try:
                    yield session
                finally:
                    session.commit = _original_commit  # type: ignore[assignment]
                    await session.rollback()
            else:
                try:
                    yield session
                    await session.commit()
                except Exception:
                    await session.rollback()
                    raise

    app.dependency_overrides[get_db] = override_get_db

    # Also patch AsyncSessionLocal so that services opening their own sessions
    # (e.g. fire_trigger in workflow_engine) use the test DB.
    import app.database as _db_mod
    import app.mcp.tools as _mcp_tools_mod
    import app.services.workflow_engine as _wf_mod
    original_session_local = _db_mod.AsyncSessionLocal
    original_mcp_session_local = _mcp_tools_mod.AsyncSessionLocal
    _db_mod.AsyncSessionLocal = factory
    _mcp_tools_mod.AsyncSessionLocal = factory
    _wf_mod.AsyncSessionLocal = factory

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac

    _db_mod.AsyncSessionLocal = original_session_local
    _mcp_tools_mod.AsyncSessionLocal = original_mcp_session_local
    _wf_mod.AsyncSessionLocal = original_session_local
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
async def auth_client(client):
    """Returns an AsyncClient pre-authenticated as a fresh admin user."""
    await client.post(
        "/auth/setup",
        json={"username": "testadmin", "password": "password123"},
    )
    resp = await client.post(
        "/auth/login",
        json={
            "username": "testadmin",
            "password": "password123",
            "device_id": "test-device-001",
            "device_name": "Test Device",
        },
    )
    token = resp.json()["session_token"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client


@pytest.fixture(scope="function")
async def test_user(db_session):
    """Create a test user in the database."""
    from app.models.user import User
    from app.utils.security import hash_password

    user = User(
        id="test-user-123",
        username="testuser",
        password_hash=hash_password("password123"),
        role="user",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user
