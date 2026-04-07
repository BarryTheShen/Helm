import contextvars
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings

_sandbox_mode: contextvars.ContextVar[bool] = contextvars.ContextVar("_sandbox_mode", default=False)


def set_sandbox_mode(value: bool) -> None:
    _sandbox_mode.set(value)


def is_sandbox_mode() -> bool:
    return _sandbox_mode.get()


engine = create_async_engine(
    settings.database_url,
    echo=False,
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {},
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        if is_sandbox_mode():
            # Sandbox mode: let the handler run normally, but rollback at the end
            # instead of committing. Override commit() to flush only (so the
            # handler's queries see their own writes within the transaction).
            _original_commit = session.commit

            async def _sandbox_commit() -> None:
                await session.flush()

            session.commit = _sandbox_commit  # type: ignore[assignment]
            try:
                yield session
            finally:
                # Restore original commit and rollback everything
                session.commit = _original_commit  # type: ignore[assignment]
                await session.rollback()
        else:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise
