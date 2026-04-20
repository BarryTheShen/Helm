"""
Trigger Engine — executes action chains defined in TriggerDefinition records.

Handles two trigger types: data_change and server_event.
Cron/schedule triggers are handled exclusively by workflow_engine (Workflow.trigger_type
== "onSchedule" via APScheduler CronTrigger). TriggerDefinition no longer supports
trigger_type="schedule" — see schemas/trigger.py and routers/triggers.py.
"""
from __future__ import annotations

import json
import logging
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.trigger import TriggerDefinition

logger = logging.getLogger(__name__)


async def fire_trigger(trigger: TriggerDefinition, db: AsyncSession) -> list[dict[str, Any]]:
    """Execute a trigger's action chain.

    Parses action_chain_json and runs each action through the action registry.
    Returns a list of results, one per action in the chain.
    """
    from app.services.action_registry import registry

    try:
        actions = json.loads(trigger.action_chain_json)
    except (json.JSONDecodeError, TypeError):
        logger.error("Invalid action_chain_json for trigger %s", trigger.id)
        return [{"status": "error", "detail": "Invalid action_chain_json"}]

    if not isinstance(actions, list):
        actions = [actions]

    results: list[dict[str, Any]] = []
    for action in actions:
        action_type = action.get("type", action.get("action", ""))
        params = action.get("params", action.get("payload", {}))
        try:
            result = await registry.execute(action_type, trigger.user_id, params, db)
            results.append(result)
        except ValueError as exc:
            logger.warning("Trigger %s: action '%s' failed: %s", trigger.id, action_type, exc)
            results.append({"status": "error", "action": action_type, "detail": str(exc)})
        except Exception as exc:
            logger.exception("Trigger %s: unexpected error in action '%s'", trigger.id, action_type)
            results.append({"status": "error", "action": action_type, "detail": str(exc)})

    return results
