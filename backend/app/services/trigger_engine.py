"""
Trigger Engine — executes action chains defined in TriggerDefinition records.

V1 keeps it simple:
  - fire_trigger() parses action_chain_json and runs each action via action_registry
  - register_scheduled_triggers() hooks into APScheduler for cron-based triggers
  - data_change triggers are fired manually when data updates occur
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


def register_scheduled_triggers(scheduler: Any) -> None:
    """Register APScheduler jobs for all schedule-type triggers.

    V1: placeholder that logs a message. Full cron scheduling to be wired
    in a future session when the scheduler integration is solidified.
    """
    logger.info("register_scheduled_triggers called — V1 placeholder")
