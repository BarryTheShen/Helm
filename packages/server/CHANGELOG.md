# Changelog

## 0.1.0 (2026-04-14)

Initial release.

- `ConnectionManager` for WebSocket connection lifecycle
- `create_mcp_server()` factory for MCP server creation
- `MCPAuthMiddleware` and `get_current_user_id()` for auth
- `normalize_sdui_screen()` to convert flat AI-generated JSON to props-based schema
- `update_component_in_screen()` for partial component prop updates by ID
- `validate_form_submission()` for server-side form field validation
- `ActionRegistry` base class for action dispatch
- Pre-built MCP tools via `register_sdui_tools()`:
  - `render_screen` — AI generates and stores a full SDUI screen
  - `get_screen` — retrieve the current screen for a module
  - `update_component` — patch a single component's props by ID
  - `list_screens` — list all active screens for a user
  - `validate_form` — validate form submission data
- `ScreenStore` protocol and `InMemoryScreenStore` for pluggable screen persistence
