"""Session 10 data migration — create default apps and module instances.

This script:
1. Creates 7 default ModuleInstances per user (home, chat, modules, calendar, forms, alerts, settings)
2. Creates one default App per user with 5-slot bottom bar config
3. Links ModuleInstances to App via AppModuleRef (bottom bar + launchpad)
4. Assigns default app to all existing devices
5. Backfills module_instance_id in module_states table

PREREQUISITE: Run AFTER alembic migration that adds assigned_app_id column to devices table.

Usage:
    cd backend
    .venv/bin/python scripts/migrate_session10_data.py --dry-run  # Preview changes
    .venv/bin/python scripts/migrate_session10_data.py            # Apply migration
"""

from __future__ import annotations

import argparse
import asyncio
import sys
import uuid
from pathlib import Path

# Add backend to path so we can import app modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import AsyncSessionLocal, engine
from app.models.app import App
from app.models.app_module_ref import AppModuleRef
from app.models.device import Device
from app.models.module_instance import ModuleInstance
from app.models.module_state import ModuleState
from app.models.user import User


# Built-in module types with default names and icons
BUILTIN_MODULES = [
    {"module_type": "home", "name": "Home", "icon": "home"},
    {"module_type": "chat", "name": "Chat", "icon": "message-circle"},
    {"module_type": "modules", "name": "Modules", "icon": "grid"},
    {"module_type": "calendar", "name": "Calendar", "icon": "calendar"},
    {"module_type": "forms", "name": "Forms", "icon": "file-text"},
    {"module_type": "alerts", "name": "Alerts", "icon": "bell"},
    {"module_type": "settings", "name": "Settings", "icon": "settings"},
]

# Default bottom bar: home (0), chat (1), modules (2), calendar (3), forms (4)
DEFAULT_BOTTOM_BAR = ["home", "chat", "modules", "calendar", "forms"]

# Launchpad: alerts, settings
DEFAULT_LAUNCHPAD = ["alerts", "settings"]


async def check_prerequisites(session: AsyncSession) -> bool:
    """Verify assigned_app_id column exists in devices table."""
    try:
        result = await session.execute(text("PRAGMA table_info(devices)"))
        columns = [row[1] for row in result.fetchall()]
        if "assigned_app_id" not in columns:
            print("❌ PREREQUISITE FAILED: assigned_app_id column not found in devices table")
            print("   Run alembic migration first: cd backend && alembic upgrade head")
            return False
        return True
    except Exception as e:
        print(f"❌ Error checking prerequisites: {e}")
        return False


async def get_migration_stats(session: AsyncSession) -> dict:
    """Gather statistics about what needs to be migrated."""
    stats = {}

    # Count users
    result = await session.execute(select(User))
    users = result.scalars().all()
    stats["total_users"] = len(users)

    # Count existing module instances
    result = await session.execute(select(ModuleInstance))
    stats["existing_module_instances"] = len(result.scalars().all())

    # Count existing apps
    result = await session.execute(select(App))
    stats["existing_apps"] = len(result.scalars().all())

    # Count devices without assigned app
    result = await session.execute(
        select(Device).where(Device.assigned_app_id.is_(None))
    )
    stats["unassigned_devices"] = len(result.scalars().all())

    # Count module_states without module_instance_id
    result = await session.execute(
        select(ModuleState).where(ModuleState.module_instance_id.is_(None))
    )
    stats["module_states_to_backfill"] = len(result.scalars().all())

    return stats


async def migrate_user(
    session: AsyncSession,
    user: User,
    dry_run: bool = False
) -> dict:
    """Migrate a single user to the new app architecture.

    Returns dict with migration results for this user.
    """
    result = {
        "user_id": user.id,
        "username": user.username,
        "module_instances_created": 0,
        "app_created": False,
        "app_module_refs_created": 0,
        "devices_assigned": 0,
        "module_states_backfilled": 0,
        "errors": [],
    }

    try:
        # Step 1: Check if user already has module instances
        existing_instances_result = await session.execute(
            select(ModuleInstance).where(ModuleInstance.user_id == user.id)
        )
        existing_instances = {
            mi.module_type: mi for mi in existing_instances_result.scalars().all()
        }

        # Step 2: Create missing ModuleInstances for built-in modules
        module_instances = {}
        for module_def in BUILTIN_MODULES:
            module_type = module_def["module_type"]

            if module_type in existing_instances:
                # Use existing instance
                module_instances[module_type] = existing_instances[module_type]
            else:
                # Create new instance
                instance = ModuleInstance(
                    id=str(uuid.uuid4()),
                    user_id=user.id,
                    template_id=None,  # Built-in modules have no template
                    module_type=module_type,
                    name=module_def["name"],
                    version="1.0.0",
                    status="active",
                )
                module_instances[module_type] = instance

                if not dry_run:
                    session.add(instance)

                result["module_instances_created"] += 1

        # Step 3: Check if user already has an app
        existing_app_result = await session.execute(
            select(App).where(App.user_id == user.id)
        )
        existing_app = existing_app_result.scalars().first()

        if existing_app:
            # User already has an app, skip app creation
            app = existing_app
        else:
            # Step 4: Create default App
            app = App(
                id=str(uuid.uuid4()),
                user_id=user.id,
                name="My App",
                icon="smartphone",
                theme={},
                design_tokens={},
                dark_mode=False,
                bottom_bar_config=[],  # Will be populated via AppModuleRef
                launchpad_config=[],   # Will be populated via AppModuleRef
            )

            if not dry_run:
                session.add(app)

            result["app_created"] = True

        # Step 5: Create AppModuleRef entries for bottom bar (slots 0-4)
        for slot_position, module_type in enumerate(DEFAULT_BOTTOM_BAR):
            if module_type not in module_instances:
                result["errors"].append(f"Module type {module_type} not found for bottom bar")
                continue

            ref = AppModuleRef(
                id=str(uuid.uuid4()),
                app_id=app.id,
                module_instance_id=module_instances[module_type].id,
                order=slot_position,
                slot_position=slot_position,
            )

            if not dry_run:
                session.add(ref)

            result["app_module_refs_created"] += 1

        # Step 6: Create AppModuleRef entries for launchpad (slot_position=null)
        for order, module_type in enumerate(DEFAULT_LAUNCHPAD):
            if module_type not in module_instances:
                result["errors"].append(f"Module type {module_type} not found for launchpad")
                continue

            ref = AppModuleRef(
                id=str(uuid.uuid4()),
                app_id=app.id,
                module_instance_id=module_instances[module_type].id,
                order=len(DEFAULT_BOTTOM_BAR) + order,
                slot_position=None,  # Launchpad items have no slot position
            )

            if not dry_run:
                session.add(ref)

            result["app_module_refs_created"] += 1

        # Step 7: Assign app to all user's devices
        devices_result = await session.execute(
            select(Device).where(Device.user_id == user.id)
        )
        devices = devices_result.scalars().all()

        for device in devices:
            if device.assigned_app_id is None:
                if not dry_run:
                    device.assigned_app_id = app.id
                result["devices_assigned"] += 1

        # Step 8: Backfill module_instance_id in module_states
        module_states_result = await session.execute(
            select(ModuleState).where(
                ModuleState.user_id == user.id,
                ModuleState.module_instance_id.is_(None)
            )
        )
        module_states = module_states_result.scalars().all()

        for module_state in module_states:
            # Find corresponding ModuleInstance by module_type
            # Strip "sdui__" prefix if present (legacy naming convention)
            module_type = module_state.module_type
            if module_type.startswith("sdui__"):
                module_type = module_type[6:]  # Remove "sdui__" prefix

            # Also strip "__draft" suffix if present
            if module_type.endswith("__draft"):
                module_type = module_type[:-7]  # Remove "__draft" suffix

            # Handle special cases
            if module_type.startswith("invalid_module"):
                # Skip invalid/draft modules
                continue

            if module_type in module_instances:
                if not dry_run:
                    module_state.module_instance_id = module_instances[module_type].id
                result["module_states_backfilled"] += 1
            else:
                # Not a built-in module, skip silently (could be custom module or legacy data)
                pass

        if not dry_run:
            await session.flush()

    except Exception as e:
        result["errors"].append(str(e))

    return result


async def run_migration(dry_run: bool = False) -> int:
    """Run the full migration across all users."""
    print("=" * 80)
    print("Session 10 Data Migration")
    print("=" * 80)
    print()

    if dry_run:
        print("🔍 DRY RUN MODE — No changes will be committed")
        print()

    async with AsyncSessionLocal() as session:
        # Check prerequisites
        print("Checking prerequisites...")
        if not await check_prerequisites(session):
            return 1
        print("✅ Prerequisites passed")
        print()

        # Gather stats
        print("Gathering migration statistics...")
        stats = await get_migration_stats(session)
        print(f"  Total users: {stats['total_users']}")
        print(f"  Existing module instances: {stats['existing_module_instances']}")
        print(f"  Existing apps: {stats['existing_apps']}")
        print(f"  Unassigned devices: {stats['unassigned_devices']}")
        print(f"  Module states to backfill: {stats['module_states_to_backfill']}")
        print()

        if stats['total_users'] == 0:
            print("No users found. Nothing to migrate.")
            return 0

        # Get all users
        result = await session.execute(select(User))
        users = result.scalars().all()

        print(f"Migrating {len(users)} users...")
        print()

        # Migrate each user
        results = []
        for user in users:
            user_result = await migrate_user(session, user, dry_run=dry_run)
            results.append(user_result)

            # Print progress
            status = "✅" if not user_result["errors"] else "⚠️"
            print(f"{status} {user.username} (user_id: {user.id})")
            if user_result["module_instances_created"] > 0:
                print(f"   Created {user_result['module_instances_created']} module instances")
            if user_result["app_created"]:
                print(f"   Created default app")
            if user_result["app_module_refs_created"] > 0:
                print(f"   Created {user_result['app_module_refs_created']} app-module links")
            if user_result["devices_assigned"] > 0:
                print(f"   Assigned app to {user_result['devices_assigned']} devices")
            if user_result["module_states_backfilled"] > 0:
                print(f"   Backfilled {user_result['module_states_backfilled']} module states")
            if user_result["errors"]:
                for error in user_result["errors"]:
                    print(f"   ❌ Error: {error}")

        print()
        print("=" * 80)
        print("Migration Summary")
        print("=" * 80)

        total_instances = sum(r["module_instances_created"] for r in results)
        total_apps = sum(1 for r in results if r["app_created"])
        total_refs = sum(r["app_module_refs_created"] for r in results)
        total_devices = sum(r["devices_assigned"] for r in results)
        total_backfilled = sum(r["module_states_backfilled"] for r in results)
        total_errors = sum(len(r["errors"]) for r in results)

        print(f"  Module instances created: {total_instances}")
        print(f"  Apps created: {total_apps}")
        print(f"  App-module links created: {total_refs}")
        print(f"  Devices assigned: {total_devices}")
        print(f"  Module states backfilled: {total_backfilled}")
        print(f"  Errors: {total_errors}")
        print()

        if dry_run:
            print("🔍 DRY RUN COMPLETE — No changes committed")
            await session.rollback()
        else:
            print("💾 Committing changes...")
            await session.commit()
            print("✅ Migration complete!")

        return 1 if total_errors > 0 else 0


async def main() -> int:
    parser = argparse.ArgumentParser(
        description="Session 10 data migration — create default apps and module instances"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without committing to database"
    )
    args = parser.parse_args()

    try:
        return await run_migration(dry_run=args.dry_run)
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        await engine.dispose()


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
