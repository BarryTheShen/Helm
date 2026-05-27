"""Cleanup service — identify and remove test/QA artifacts from the database.

This service supports the FF4-INTRO-001 requirement: after testing, all test
apps, modules, and templates must be removable to restore a clean state.

Naming convention: content with names starting with "test" or "Test", OR
content explicitly flagged as test data (e.g. default "New Module" from QA
clicks, "QA Test Module" / "QA Module" prefixes), is eligible for cleanup.

CASCADE SCOPE:
  - Deleting an App cascades to: all app_versions, screens, published_screens,
    module_instances linked to that app, and any related workflow_state entries.
  - Deleting a ModuleInstance cascades to: screen_instance entries and
    references from workflow triggers.
  - Deleting an SDUITemplate cascades to: published_template_screens.
  - Deleting a Workflow unregisters it from the workflow engine.
  - Custom SDUI modules remove associated module_states draft/live rows.
  - The admin UI shows a confirmation dialog before calling this endpoint,
    so the operator is aware of the broad deletion scope.
  - This service deletes test artifacts one entity type at a time. If a
    cascade foreign-key constraint fails (e.g. orphaned references), the
    error is caught per-entity and logged so remaining deletions proceed.
"""

import logging

from dataclasses import dataclass, field

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.app import App
from app.models.module_instance import ModuleInstance
from app.models.module_state import ModuleState
from app.models.template import SDUITemplate
from app.models.workflow import Workflow
from app.services.sdui_state import delete_module_states, module_state_keys_to_clear

logger = logging.getLogger(__name__)

# Must match backend/app/routers/modules.py _CUSTOM_MODULES_KEY
_CUSTOM_MODULES_KEY = "_custom_modules"


@dataclass
class CleanupResult:
    """Summary of cleanup operation."""

    apps_deleted: int = 0
    module_instances_deleted: int = 0
    templates_deleted: int = 0
    custom_modules_deleted: int = 0
    workflows_deleted: int = 0
    errors: list[str] = field(default_factory=list)
    details: list[str] = field(default_factory=list)


def _is_test_name(name: str | None) -> bool:
    """Return True if name starts with 'test' or 'Test'."""
    if not name:
        return False
    return name.lower().startswith("test")


def _is_cleanup_eligible_name(name: str | None) -> bool:
    """Return True if a human-visible name looks like QA/test junk."""
    if not name:
        return False
    if _is_test_name(name):
        return True
    if name == "New Module":
        return True
    lowered = name.lower()
    if lowered.startswith("qa test") or lowered.startswith("qa module"):
        return True
    return False


async def _preview_custom_modules(db: AsyncSession, result: CleanupResult) -> None:
    """Count custom SDUI modules that would be removed."""
    states = (
        await db.execute(
            select(ModuleState).where(ModuleState.module_type == _CUSTOM_MODULES_KEY)
        )
    ).scalars().all()

    for state in states:
        for mod in (state.state_json or {}).get("modules", []):
            name = mod.get("name")
            if _is_cleanup_eligible_name(name):
                result.custom_modules_deleted += 1
                result.details.append(
                    f"CustomModule: {name!r} id={mod.get('id')} (user={state.user_id})"
                )


async def _execute_custom_modules_cleanup(db: AsyncSession, result: CleanupResult) -> None:
    """Remove eligible custom SDUI modules and their module_states rows."""
    states = (
        await db.execute(
            select(ModuleState).where(ModuleState.module_type == _CUSTOM_MODULES_KEY)
        )
    ).scalars().all()

    for state in states:
        modules: list[dict] = list((state.state_json or {}).get("modules", []))
        kept: list[dict] = []
        removed: list[dict] = []

        for mod in modules:
            if _is_cleanup_eligible_name(mod.get("name")):
                removed.append(mod)
            else:
                kept.append(mod)

        if not removed:
            continue

        for mod in removed:
            module_id = mod.get("id")
            if module_id:
                await delete_module_states(
                    db, state.user_id, module_state_keys_to_clear(module_id)
                )
            result.custom_modules_deleted += 1
            result.details.append(
                f"Deleted CustomModule: {mod.get('name')!r} id={module_id} (user={state.user_id})"
            )
            logger.info(
                "Cleanup: deleted custom module %r id=%s user=%s",
                mod.get("name"),
                module_id,
                state.user_id,
            )

        state.state_json = {"modules": kept}
        state.version += 1


async def _preview_workflows(db: AsyncSession, result: CleanupResult) -> None:
    """Count test-prefixed workflows that would be removed."""
    workflows = (
        await db.execute(select(Workflow).where(Workflow.name.ilike("test%")))
    ).scalars().all()

    for wf in workflows:
        result.workflows_deleted += 1
        result.details.append(f"Workflow: {wf.name!r} (id={wf.id}, user={wf.user_id})")


async def _execute_workflows_cleanup(db: AsyncSession, result: CleanupResult) -> None:
    """Remove test-prefixed workflows and unregister them from the engine."""
    from app.services.workflow_engine import unregister_workflow

    workflows = (
        await db.execute(select(Workflow).where(Workflow.name.ilike("test%")))
    ).scalars().all()

    for wf in workflows:
        try:
            await unregister_workflow(str(wf.id))
        except Exception as exc:
            logger.warning("Cleanup: unregister_workflow failed for %s: %s", wf.id, exc)
        await db.delete(wf)
        result.workflows_deleted += 1
        result.details.append(f"Deleted Workflow: {wf.name!r} (id={wf.id})")
        logger.info("Cleanup: deleted Workflow %r (id=%s)", wf.name, wf.id)


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

    await _preview_custom_modules(db, result)
    await _preview_workflows(db, result)

    return result


async def execute_cleanup(db: AsyncSession) -> CleanupResult:
    """Remove all test artifacts from the database.

    Each entity type is deleted in its own try/except block so that a failure
    deleting one type (e.g. due to a FK constraint on App) does not prevent
    cleanup of the other types.
    """
    result = CleanupResult()

    # --- Delete test apps ---
    try:
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
                logger.info("Cleanup: deleted App %r (id=%s)", aname, aid)
    except Exception as exc:
        msg = f"Error deleting test Apps: {exc}"
        result.errors.append(msg)
        logger.error(msg, exc_info=True)

    # --- Delete test module instances ---
    try:
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
                logger.info("Cleanup: deleted ModuleInstance %s (id=%s)", mname, mid)
    except Exception as exc:
        msg = f"Error deleting test ModuleInstances: {exc}"
        result.errors.append(msg)
        logger.error(msg, exc_info=True)

    # --- Delete test templates ---
    try:
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
                logger.info("Cleanup: deleted Template %r (id=%s)", tname, tid)
    except Exception as exc:
        msg = f"Error deleting test Templates: {exc}"
        result.errors.append(msg)
        logger.error(msg, exc_info=True)

    # --- Delete test custom SDUI modules ---
    try:
        await _execute_custom_modules_cleanup(db, result)
    except Exception as exc:
        msg = f"Error deleting test custom modules: {exc}"
        result.errors.append(msg)
        logger.error(msg, exc_info=True)

    # --- Delete test workflows ---
    try:
        await _execute_workflows_cleanup(db, result)
    except Exception as exc:
        msg = f"Error deleting test workflows: {exc}"
        result.errors.append(msg)
        logger.error(msg, exc_info=True)

    # Commit all successful deletions together; rollback if any still fail
    try:
        await db.commit()
    except Exception as exc:
        await db.rollback()
        msg = f"Commit failed during cleanup: {exc}"
        result.errors.append(msg)
        logger.error(msg, exc_info=True)

    if not result.errors:
        logger.info(
            "Cleanup complete: %d apps, %d module instances, %d templates, "
            "%d custom modules, %d workflows deleted",
            result.apps_deleted,
            result.module_instances_deleted,
            result.templates_deleted,
            result.custom_modules_deleted,
            result.workflows_deleted,
        )
    else:
        logger.warning(
            "Cleanup completed with %d error(s): %s",
            len(result.errors),
            "; ".join(result.errors),
        )

    return result
