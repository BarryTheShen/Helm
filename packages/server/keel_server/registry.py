"""Action registry for SDUI server_action events.

Maps named action handlers callable from SDUI server_action events.
This base class is intentionally free of built-in handlers — consuming apps
register their own functions via register().
"""

from __future__ import annotations

import logging
from typing import Any, Callable, Awaitable

logger = logging.getLogger(__name__)

# Generic handler type: accepts keyword arguments, returns any awaitable result
ActionHandler = Callable[..., Awaitable[Any]]


class ActionRegistry:
    """Registry for named action handlers callable from SDUI server_action events.

    SDUI components use server_action with a function name instead of raw API URLs.
    This registry is the whitelist of allowed functions. Register handlers via
    register() and dispatch them via execute().
    """

    def __init__(self) -> None:
        self._handlers: dict[str, ActionHandler] = {}

    def register(self, name: str, handler: ActionHandler) -> None:
        """Register a named action handler.

        Args:
            name: The action name referenced in SDUI server_action payloads.
            handler: Async callable invoked when the action is executed.
        """
        self._handlers[name] = handler

    async def execute(self, name: str, **kwargs: Any) -> Any:
        """Execute a registered action by name.

        Args:
            name: The action name to dispatch.
            **kwargs: Keyword arguments forwarded to the handler.

        Raises:
            ValueError: If no handler is registered for the given name.
        """
        handler = self._handlers.get(name)
        if handler is None:
            raise ValueError(f"Unknown action: {name}")
        return await handler(**kwargs)

    def list_actions(self) -> list[str]:
        """Return the names of all registered action handlers."""
        return list(self._handlers.keys())

    def is_registered(self, name: str) -> bool:
        """Return True if a handler is registered for the given action name."""
        return name in self._handlers
