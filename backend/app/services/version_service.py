"""Version service — shared version tree logic, timestamp naming.

Provides helpers for:
- Generating timestamp-based default version names
- Creating versions from working draft checkpoints
- Restoring versions to working drafts
- Listing version history
"""

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.module_instance import ModuleInstance
from app.models.module_version import ModuleVersion
from app.models.module_working_draft import ModuleWorkingDraft
from app.models.screen_history import ScreenHistory


def make_timestamp_name(dt: datetime | None = None) -> str:
    """Generate a human-readable timestamp-based version name."""
    dt = dt or datetime.now(timezone.utc)
    return dt.strftime("%Y-%m-%d %H:%M UTC")


def make_default_version_name(version_number: int) -> str:
    """Generate a default display name for a version."""
    ts = make_timestamp_name()
    return f"v{version_number} — {ts}"


async def get_next_version_number(
    db: AsyncSession,
    module_id: str,
) -> int:
    """Get the next version number for a module."""
    result = await db.execute(
        select(func.max(ModuleVersion.version_number)).where(
            ModuleVersion.module_id == module_id,
        )
    )
    max_num = result.scalar() or 0
    return max_num + 1


async def create_module_checkpoint(
    db: AsyncSession,
    module_id: str,
    user_id: str,
    sdui_json: dict,
    change_summary: str | None = None,
    source: str = "checkpoint",
    parent_version_id: str | None = None,
) -> ModuleVersion:
    """Create a new version checkpoint from SDUI JSON content.

    Returns the created ModuleVersion.
    """
    version_number = await get_next_version_number(db, module_id)
    timestamp_name = make_timestamp_name()
    display_name = f"v{version_number} — {timestamp_name}"

    version = ModuleVersion(
        module_id=module_id,
        user_id=user_id,
        version_number=version_number,
        display_name=display_name,
        default_timestamp_name=timestamp_name,
        custom_name=None,
        sdui_json=sdui_json,
        source=source,
        parent_version_id=parent_version_id,
        change_summary=change_summary,
        validation_status="valid",
    )
    db.add(version)
    await db.flush()

    # Update module instance's current version pointer
    result = await db.execute(
        select(ModuleInstance).where(ModuleInstance.id == module_id)
    )
    instance = result.scalar_one_or_none()
    if instance is not None:
        instance.current_version_id = version.id

    return version


async def restore_version_to_draft(
    db: AsyncSession,
    module_id: str,
    version_id: str,
    user_id: str,
    as_draft: bool = True,
) -> ModuleWorkingDraft:
    """Restore a version's SDUI JSON back to the working draft.

    If as_draft is True, the content goes to the working draft table.
    If False, it directly updates the module's live screen state.
    """
    # Fetch the version
    result = await db.execute(
        select(ModuleVersion).where(
            ModuleVersion.id == version_id,
            ModuleVersion.module_id == module_id,
        )
    )
    version = result.scalar_one_or_none()
    if version is None:
        raise ValueError(f"Version {version_id} not found for module {module_id}")

    # Upsert the working draft
    result = await db.execute(
        select(ModuleWorkingDraft).where(
            ModuleWorkingDraft.module_id == module_id,
            ModuleWorkingDraft.user_id == user_id,
        )
    )
    draft = result.scalar_one_or_none()

    if draft is None:
        draft = ModuleWorkingDraft(
            module_id=module_id,
            user_id=user_id,
            sdui_json=version.sdui_json,
            base_version_id=version.id,
            validation_status="valid",
            dirty=False,
            last_autosaved_at=datetime.now(timezone.utc),
        )
        db.add(draft)
    else:
        draft.sdui_json = version.sdui_json
        draft.base_version_id = version.id
        draft.dirty = False
        draft.validation_status = "valid"
        draft.last_autosaved_at = datetime.now(timezone.utc)

    await db.flush()
    return draft


async def list_module_versions(
    db: AsyncSession,
    module_id: str,
    user_id: str,
    offset: int = 0,
    limit: int = 50,
) -> tuple[list[ModuleVersion], int]:
    """List all versions for a module, newest first."""
    query = (
        select(ModuleVersion)
        .where(
            ModuleVersion.module_id == module_id,
            ModuleVersion.user_id == user_id,
        )
        .order_by(ModuleVersion.version_number.desc())
        .offset(offset)
        .limit(limit)
    )
    count_query = select(func.count()).select_from(
        select(ModuleVersion).where(
            ModuleVersion.module_id == module_id,
            ModuleVersion.user_id == user_id,
        ).subquery()
    )

    results = await db.execute(query)
    total = (await db.execute(count_query)).scalar() or 0

    return list(results.scalars().all()), total


async def migrate_screen_history_to_version(
    db: AsyncSession,
    module_id: str,
    user_id: str,
    history_entry: ScreenHistory,
) -> ModuleVersion | None:
    """Migrate a single ScreenHistory entry to a ModuleVersion.

    Returns the created ModuleVersion or None if already migrated.
    """
    # Check if a version already exists for this screen_history id
    result = await db.execute(
        select(ModuleVersion).where(
            ModuleVersion.module_id == module_id,
            ModuleVersion.user_id == user_id,
            ModuleVersion.source == f"migrated:{history_entry.id}",
        )
    )
    if result.scalar_one_or_none() is not None:
        return None

    version_number = await get_next_version_number(db, module_id)
    timestamp_name = make_timestamp_name(history_entry.created_at)
    display_name = f"v{version_number} — {timestamp_name}"

    version = ModuleVersion(
        module_id=module_id,
        user_id=user_id,
        version_number=version_number,
        display_name=display_name,
        default_timestamp_name=timestamp_name,
        custom_name=history_entry.source,
        sdui_json=history_entry.screen_json,
        source=f"migrated:{history_entry.id}",
        parent_version_id=None,
        change_summary=f"Migrated from ScreenHistory (v{history_entry.version}, source: {history_entry.source})",
        validation_status="valid",
    )
    db.add(version)
    return version


async def migrate_all_screen_history(db: AsyncSession) -> dict[str, int]:
    """Migrate all unmigrated ScreenHistory entries to ModuleVersion table.

    This is safe to call on every startup — it checks for already-migrated
    entries by looking at the ModuleVersion.source field (which is set to
    "migrated:{history_entry.id}" for migrated entries).

    Returns a dict with:
      - total: total ScreenHistory entries found
      - migrated: number of new entries migrated this call
      - skipped: number already migrated on a previous call
      - errors: number of entries that failed to migrate
    """
    logger = __import__("logging").getLogger(__name__)

    # Load all ScreenHistory entries
    result = await db.execute(
        select(ScreenHistory).order_by(ScreenHistory.created_at)
    )
    all_entries: list[ScreenHistory] = list(result.scalars().all())
    total = len(all_entries)
    migrated = 0
    skipped = 0
    errors = 0

    for entry in all_entries:
        try:
            # Check if this entry is already migrated
            check = await db.execute(
                select(ModuleVersion).where(
                    ModuleVersion.source == f"migrated:{entry.id}",
                )
            )
            if check.scalar_one_or_none() is not None:
                skipped += 1
                continue

            # Determine the module_id — prefer module_instance_id, fall back to module_id
            module_id = entry.module_instance_id or entry.module_id
            if not module_id:
                logger.warning(
                    "ScreenHistory %s has no module_instance_id or module_id, skipping",
                    entry.id,
                )
                errors += 1
                continue

            await migrate_screen_history_to_version(
                db,
                module_id=module_id,
                user_id=entry.user_id,
                history_entry=entry,
            )
            migrated += 1
        except Exception as exc:
            logger.error(
                "Failed to migrate ScreenHistory %s: %s",
                entry.id, exc,
            )
            errors += 1

    if total > 0:
        logger.info(
            "ScreenHistory migration: %d total, %d migrated, %d skipped, %d errors",
            total, migrated, skipped, errors,
        )

    return {
        "total": total,
        "migrated": migrated,
        "skipped": skipped,
        "errors": errors,
    }
