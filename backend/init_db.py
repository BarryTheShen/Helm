#!/usr/bin/env python3
"""Initialize the Helm database with tables and admin user."""

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import settings
from app.models.base import Base
from app.models.user import User
from app.utils.security import hash_password
from app.database import AsyncSessionLocal


async def init_database():
    """Create all tables and seed admin user."""
    print(f"Initializing database at {settings.database_url}")

    # Create engine and tables
    engine = create_async_engine(settings.database_url)
    async with engine.begin() as conn:
        print("Creating tables...")
        await conn.run_sync(Base.metadata.create_all)
        print("✓ Tables created")

    # Create admin user with unified password
    async with AsyncSessionLocal() as db:
        # Check if admin already exists
        from sqlalchemy import select
        result = await db.execute(select(User).where(User.username == "barry"))
        existing = result.scalar_one_or_none()

        if existing:
            print("✓ Admin user 'barry' already exists")
        else:
            admin = User(
                username="barry",
                password_hash=hash_password("BarryShen1121!"),
                role="admin"
            )
            db.add(admin)
            await db.commit()
            print("✓ Admin user 'barry' created with password 'BarryShen1121!'")

    await engine.dispose()
    print("\n✓ Database initialization complete!")
    print("  Username: barry")
    print("  Password: BarryShen1121!")


if __name__ == "__main__":
    asyncio.run(init_database())
