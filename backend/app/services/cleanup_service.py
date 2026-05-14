"""Cleanup service — identify and remove test/QA artifacts from the database.

This service supports the FF4-INTRO-001 requirement: after testing, all test
apps, modules, and templates must be removable to restore a clean state.

Naming convention: content with names starting with "test" or "Test", OR
content explicitly flagged as test data, is eligible for cleanup.
"""

from dataclasses import dataclass, field

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app import App
from app.models.module_instance import ModuleInstance
from app.models.template import SDUITemplate


@dataclass
class CleanupResult:
    """Summary of cleanup operation."""

    apps_deleted: int = 0
    module_instances_deleted: int = 0
    templates_deleted: int = 0
    errors: list[str] = field(default_factory=list)
    details: list[str] = field(default_factory=list)


def _is_test_name(name: str | None) -> bool:
    """Return True if name starts with 'test' or 'Test'."""
    if not name:
        return False
    return name.lower().startswith("test")


async def preview_cleanup(db: AsyncSession) -> CleanupResult:
    """Preview which test artifacts would be removed — no actual deletion."""
    result = CleanupResult()

    # Find test apps
    apps = (
        (await db.execute(select(App).where(App.name.ilike("test%"))))
        .scalars()
        .all()
    )
    for app in apps:
        result.apps_deleted += 1
        result.details.append(f"App: {app.name!r} (id={app.id})")

    # Find test module instances
    modules = (
        (
            await db.execute(
                select(ModuleInstance).where(ModuleInstance.name.ilike("test%"))
            )
        )
        .scalars()
        .all()
    )
    for mod in modules:
        result.module_instances_deleted += 1
        result.details.append(
            f"ModuleInstance: {mod.name!r} type={mod.module_type} (id={mod.id})"
        )

    # Find test templates
    templates = (
        (
            await db.execute(
                select(SDUITemplate).where(SDUITemplate.name.ilike("test%"))
            )
        )
        .scalars()
        .all()
    )
    for tmpl in templates:
        result.templates_deleted += 1
        result.details.append(
            f"Template: {tmpl.name!r} (id={tmpl.id})"
        )

    return result


async def execute_cleanup(db: AsyncSession) -> CleanupResult:
    """Remove all test artifacts from the database."""
    result = CleanupResult()

    try:
        # Find and delete test apps
        test_app_ids = (
            (
                await db.execute(
                    select(App.id).where(App.name.ilike("test%"))
                )
            )
            .scalars()
            .all()
        )
        app_names = {}
        for app_id in test_app_ids:
            app = await db.get(App, app_id)
            if app:
                app_names[app_id] = app.name

        if test_app_ids:
            await db.execute(delete(App).where(App.id.in_(test_app_ids)))
            for aid, aname in app_names.items():
                result.apps_deleted += 1
                result.details.append(f"Deleted App: {aname!r} (id={aid})")

        # Find and delete test module instances
        test_mod_ids = (
            (
                await db.execute(
                    select(ModuleInstance.id).where(
                        ModuleInstance.name.ilike("test%")
                    )
                )
            )
            .scalars()
            .all()
        )
        mod_names = {}
        for mod_id in test_mod_ids:
            mod = await db.get(ModuleInstance, mod_id)
            if mod:
                mod_names[mod_id] = f"{mod.name} ({mod.module_type})"

        if test_mod_ids:
            await db.execute(
                delete(ModuleInstance).where(ModuleInstance.id.in_(test_mod_ids))
            )
            for mid, mname in mod_names.items():
                result.module_instances_deleted += 1
                result.details.append(f"Deleted ModuleInstance: {mname} (id={mid})")

        # Find and delete test templates
        test_tmpl_ids = (
            (
                await db.execute(
                    select(SDUITemplate.id).where(
                        SDUITemplate.name.ilike("test%")
                    )
                )
            )
            .scalars()
            .all()
        )
        tmpl_names = {}
        for tmpl_id in test_tmpl_ids:
            tmpl = await db.get(SDUITemplate, tmpl_id)
            if tmpl:
                tmpl_names[tmpl_id] = tmpl.name

        if test_tmpl_ids:
            await db.execute(
                delete(SDUITemplate).where(SDUITemplate.id.in_(test_tmpl_ids))
            )
            for tid, tname in tmpl_names.items():
                result.templates_deleted += 1
                result.details.append(f"Deleted Template: {tname!r} (id={tid})")

        await db.commit()

    except Exception as e:
        await db.rollback()
        result.errors.append(str(e))

    return result
