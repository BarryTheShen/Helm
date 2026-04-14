"""Pre-built MCP tools for SDUI screen management.

Registers MCP tools onto a FastMCP server instance so any connected AI agent
can render screens, update components, and validate forms without the developer
writing tool handlers from scratch.

The tools operate against a ScreenStore — a simple interface for persisting
and retrieving screens. Consumers provide their own implementation (in-memory,
database-backed, etc.). A default InMemoryScreenStore is included for quick
prototyping and demos.
"""

from __future__ import annotations

from typing import Any, Protocol, runtime_checkable
from mcp.server.fastmcp import FastMCP

from keel_server.tools import (
    normalize_sdui_screen,
    update_component_in_screen,
    validate_form_submission,
)
from keel_server.mcp import get_current_user_id


@runtime_checkable
class ScreenStore(Protocol):
    """Interface for persisting and retrieving SDUI screens.

    Consumers implement this against their storage layer (database, Redis, etc.).
    All methods are async to support I/O-bound backends.
    """

    async def save_screen(self, user_id: str, module_id: str, screen: dict[str, Any]) -> None:
        """Save a screen for a user under the given module_id."""
        ...

    async def get_screen(self, user_id: str, module_id: str) -> dict[str, Any] | None:
        """Retrieve the current screen for a user and module_id. Returns None if not found."""
        ...

    async def list_screens(self, user_id: str) -> list[str]:
        """Return all module_ids that have stored screens for the user."""
        ...


class InMemoryScreenStore:
    """Simple in-memory screen store for demos and testing.

    Screens are stored in a dict keyed by (user_id, module_id). Not persistent
    across restarts — use a database-backed implementation for production.
    """

    def __init__(self) -> None:
        self._screens: dict[tuple[str, str], dict[str, Any]] = {}

    async def save_screen(self, user_id: str, module_id: str, screen: dict[str, Any]) -> None:
        self._screens[(user_id, module_id)] = screen

    async def get_screen(self, user_id: str, module_id: str) -> dict[str, Any] | None:
        return self._screens.get((user_id, module_id))

    async def list_screens(self, user_id: str) -> list[str]:
        return [mid for (uid, mid) in self._screens if uid == user_id]


def register_sdui_tools(mcp: FastMCP, store: ScreenStore) -> None:
    """Register pre-built SDUI management tools onto an MCP server.

    After calling this, any AI agent connected to the MCP server can:
    - ``render_screen``: Generate and store a full SDUI screen
    - ``get_screen``: Retrieve the current screen for a module
    - ``update_component``: Patch a single component's props by ID
    - ``list_screens``: List all active screens for the current user
    - ``validate_form``: Validate form submission data against field definitions

    Args:
        mcp: The FastMCP server instance to register tools on.
        store: A ScreenStore implementation for persisting screens.

    Example::

        from keel_server import create_mcp_server
        from keel_server.sdui_tools import register_sdui_tools, InMemoryScreenStore

        mcp, middleware = await create_mcp_server("MyApp", validate_token=my_validator)
        register_sdui_tools(mcp, InMemoryScreenStore())
        # AI agents can now call render_screen, update_component, etc.
    """

    @mcp.tool()
    async def render_screen(
        module_id: str,
        title: str,
        rows: list[dict[str, Any]],
        schema_version: str = "1.0.0",
    ) -> dict[str, Any]:
        """Render a full SDUI screen. The screen is normalized and stored.

        Args:
            module_id: Identifier for the screen/module (e.g. "home", "settings").
            title: Display title for the screen.
            rows: List of row objects, each containing cells with component content.
            schema_version: Protocol version string (default "1.0.0").

        Returns:
            The normalized screen object as stored.
        """
        user_id = get_current_user_id()
        screen: dict[str, Any] = {
            "schema_version": schema_version,
            "module_id": module_id,
            "title": title,
            "rows": rows,
        }
        normalized = normalize_sdui_screen(screen)
        await store.save_screen(user_id, module_id, normalized)
        return normalized

    @mcp.tool()
    async def get_screen(module_id: str) -> dict[str, Any] | None:
        """Retrieve the current SDUI screen for a module.

        Args:
            module_id: The module identifier to look up.

        Returns:
            The screen object, or None if no screen exists for this module.
        """
        user_id = get_current_user_id()
        return await store.get_screen(user_id, module_id)

    @mcp.tool()
    async def update_component(
        module_id: str,
        component_id: str,
        props: dict[str, Any],
    ) -> dict[str, Any]:
        """Update a single component's props within a stored screen.

        Finds the component by ID and merges the given props into its existing
        props. The updated screen is saved back to the store.

        Args:
            module_id: The module whose screen contains the component.
            component_id: The ID of the component to update.
            props: A dict of props to merge into the component's existing props.

        Returns:
            The updated screen object.
        """
        user_id = get_current_user_id()
        screen = await store.get_screen(user_id, module_id)
        if screen is None:
            raise ValueError(f"No screen found for module: {module_id}")
        updated = update_component_in_screen(screen, component_id, props)
        await store.save_screen(user_id, module_id, updated)
        return updated

    @mcp.tool()
    async def list_screens() -> list[str]:
        """List all module IDs that have stored screens for the current user.

        Returns:
            List of module_id strings.
        """
        user_id = get_current_user_id()
        return await store.list_screens(user_id)

    @mcp.tool()
    async def validate_form(
        fields: list[dict[str, Any]],
        data: dict[str, Any],
    ) -> dict[str, Any]:
        """Validate form submission data against field definitions.

        Args:
            fields: List of field definition dicts (id, type, label, required, options).
            data: The submitted form data mapping field IDs to values.

        Returns:
            Dict with "valid" (bool) and "errors" (list of error strings).
        """
        errors = validate_form_submission(fields, data)
        return {"valid": len(errors) == 0, "errors": errors}
