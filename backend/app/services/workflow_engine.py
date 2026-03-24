"""Workflow engine — simple trigger→action automation system.

For MVP: Type A (event-triggered) and Type C (scheduled) workflows.
Workflow definitions are stored in the workflows table.
"""

import asyncio
from datetime import datetime, timezone
from typing import Any

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from loguru import logger
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.workflow import Workflow, TriggerType

# Shared scheduler instance
scheduler = AsyncIOScheduler(timezone="UTC")


async def start_scheduler() -> None:
    """Start APScheduler and load persisted scheduled workflows."""
    scheduler.start()
    await _load_scheduled_workflows()
    logger.info("Workflow scheduler started")


async def stop_scheduler() -> None:
    scheduler.shutdown(wait=False)
    logger.info("Workflow scheduler stopped")


async def _load_scheduled_workflows() -> None:
    """Re-register all active scheduled workflows from DB on startup."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Workflow).where(
                Workflow.trigger_type == TriggerType.SCHEDULE,
                Workflow.is_active == True,  # noqa: E712
            )
        )
        workflows = result.scalars().all()
        for wf in workflows:
            _schedule_workflow(wf)
        logger.info(f"Loaded {len(workflows)} scheduled workflows")


def _schedule_workflow(workflow: Workflow) -> None:
    """Register a workflow's cron schedule with APScheduler."""
    cron_expr = workflow.trigger_config.get("cron") if workflow.trigger_config else None
    if not cron_expr:
        return
    job_id = f"workflow_{workflow.id}"
    # Remove existing job if present (idempotent)
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
    scheduler.add_job(
        _execute_workflow,
        trigger=CronTrigger.from_crontab(cron_expr),
        id=job_id,
        args=[str(workflow.id)],
        replace_existing=True,
        misfire_grace_time=300,
    )
    logger.debug(f"Scheduled workflow {workflow.id} with cron={cron_expr}")


async def fire_trigger(trigger_type: TriggerType, user_id: str, event_data: dict[str, Any]) -> None:
    """Called by routers/services when a triggerable event occurs."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Workflow).where(
                Workflow.trigger_type == trigger_type,
                Workflow.user_id == user_id,
                Workflow.is_active == True,  # noqa: E712
            )
        )
        workflows = result.scalars().all()

    for wf in workflows:
        asyncio.create_task(_execute_workflow(str(wf.id), event_data))


async def _execute_workflow(
    workflow_id: str,
    event_data: dict[str, Any] | None = None,
) -> None:
    """Execute a single workflow's actions."""
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Workflow).where(Workflow.id == workflow_id)
        )
        workflow = result.scalar_one_or_none()
        if workflow is None or not workflow.is_active:
            return

        logger.info(f"Executing workflow {workflow.id} ({workflow.name}) for user={workflow.user_id}")

        from app.mcp.tools import execute_tool

        action_config = workflow.action_config or {}
        tool_name = action_config.get("tool")
        tool_args = action_config.get("args", {})

        if not tool_name:
            logger.warning(f"Workflow {workflow.id} has no tool configured")
            return

        # Merge event data into args if provided
        if event_data:
            tool_args = {**tool_args, **event_data}

        try:
            result_data = await execute_tool(tool_name, tool_args, str(workflow.user_id))
            workflow.last_run_at = datetime.now(timezone.utc)
            workflow.run_count = (workflow.run_count or 0) + 1
            await db.commit()
            logger.info(f"Workflow {workflow.id} completed: {result_data}")
        except Exception as exc:
            logger.error(f"Workflow {workflow.id} failed: {exc}")


async def register_workflow(workflow: Workflow) -> None:
    """Register a newly created workflow (called after DB insert)."""
    if workflow.trigger_type == TriggerType.SCHEDULE and workflow.is_active:
        _schedule_workflow(workflow)


async def unregister_workflow(workflow_id: str) -> None:
    """Remove a workflow from the scheduler."""
    job_id = f"workflow_{workflow_id}"
    if scheduler.get_job(job_id):
        scheduler.remove_job(job_id)
