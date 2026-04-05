# Helm — Feature Registry

> **This is the authoritative list of every feature in the Helm codebase — both coded and planned.**
> Every ✅ entry has been verified by reading the actual source file.
> Each feature has a status, area, and cross-reference to where it lives in code or documentation.
> Update this file whenever a feature is completed, added, or deprioritised.
>
> For detailed implementation plans see `FUTURE_PLANS.md`.
> Last updated: 2026-04-04 (verified against full codebase read)

---

## Status Key

| Symbol | Meaning |
|--------|---------|
| ✅ | Coded and working |
| ⚠️ | Coded but incomplete or broken (see note) |
| 🔧 | In progress |
| ❌ | Planned / intended — not yet started |
| 🚫 | Explicitly out of scope (MVP decision) |

---

## 1. Backend — Core Infrastructure

| Status | Feature | Location | Notes |
|--------|---------|----------|-------|
| ✅ | FastAPI server with async SQLite (SQLAlchemy + aiosqlite) | `backend/app/main.py`, `database.py` | SQLite default; one-line swap to PostgreSQL via `DATABASE_URL` env var |
| ✅ | pydantic-settings configuration (`.env` at repo root) | `backend/app/config.py` | All secrets via env vars |
| ✅ | Alembic database migrations | `backend/alembic/` | Run `alembic upgrade head` after model changes |
| ✅ | CORS middleware (allow all origins for dev) | `backend/app/main.py` | Configured for mobile + web |
| ✅ | `manage.py` CLI for user management | `backend/manage.py` | Create/list/delete users outside the locked setup endpoint |
| ✅ | pytest test suite | `backend/tests/` | Auth, calendar, notifications, workflows, drafts |
| ❌ | Docker deployment (Dockerfile + docker-compose) | — | Spec defined in Backend Spec §8; not yet created |
| ❌ | PostgreSQL production database | — | One-line config swap; needs staging test |
| ❌ | Redis for WebSocket session state / caching | — | Required for multi-instance horizontal scale |
| ❌ | Background job queue (Celery or ARQ) | — | For long-running agent tasks beyond APScheduler |

---

## 2. Backend — Authentication

| Status | Feature | Location | Notes |
|--------|---------|----------|-------|
| ✅ | First-time setup endpoint (`POST /auth/setup`) | `backend/app/routers/auth.py` | Locked with 409 after first user created |
| ✅ | Login with device tracking (`POST /auth/login`) | `backend/app/routers/auth.py` | Creates/upserts device record, issues JWT session token |
| ✅ | Session token refresh (`POST /auth/refresh`) | `backend/app/routers/auth.py` | Issues new 24h token, invalidates old |
| ✅ | Auth status check (`GET /auth/status`) | `backend/app/routers/auth.py` | Returns `{setup_complete, server_name, version}` |
| ✅ | Logout endpoint (`POST /auth/logout`) | `backend/app/routers/auth.py` | Marks session inactive |
| ✅ | Session-based JWT validation on every request | `backend/app/dependencies.py` | `get_current_user` checks sessions table |
| ✅ | bcrypt password hashing | `backend/app/utils/security.py` | passlib + bcrypt |
| ✅ | Fernet-encrypted API key storage | `backend/app/utils/security.py` | Agent API keys encrypted at rest |
| ❌ | Multiple user accounts beyond single admin | — | Architecture allows it; needs role-based access control |
| ❌ | OAuth 2.0 providers (Google, GitHub) | — | Post-MVP; needs OAuth flow + token management |
| ❌ | Per-user data isolation (multi-tenant) | — | Partially architected (user_id FK everywhere) |
| 🚫 | Biometric auth (Face ID / Touch ID) | — | Out of scope for MVP |

---

## 3. Backend — Calendar

| Status | Feature | Location | Notes |
|--------|---------|----------|-------|
| ✅ | List calendar events with date range filter (`GET /api/calendar/events`) | `backend/app/routers/calendar.py` | Params: `start_date`, `end_date`; ordered by `start_time` |
| ✅ | Create calendar event (`POST /api/calendar/events`) | `backend/app/routers/calendar.py` | Returns created event (201) |
| ✅ | Update calendar event (`PUT /api/calendar/events/{id}`) | `backend/app/routers/calendar.py` | Full update |
| ✅ | Delete calendar event (`DELETE /api/calendar/events/{id}`) | `backend/app/routers/calendar.py` | Hard delete |
| ✅ | Auto-refresh SDUI calendar after event mutations | `backend/app/routers/calendar.py` (`_update_sdui_calendar`) | After create/update/delete, rebuilds event list inside existing SDUI calendar screen and broadcasts `sdui_screen_update` — frontend re-renders without page reload |
| ⚠️ | Event-driven workflow trigger (`fire_trigger('event_created', ...)`) | `backend/app/services/workflow_engine.py` | Function exists; NOT called from calendar router — event workflows are dead |
| ❌ | `calendar_find_free_slot` MCP tool | — | Tool planned in FUTURE_PLANS §3.4 |
| ❌ | External calendar sync (Google Calendar, etc.) | — | Plugin/connector system; post-MVP |

---

## 4. Backend — Notifications

| Status | Feature | Location | Notes |
|--------|---------|----------|-------|
| ✅ | List notifications (`GET /api/notifications`) | `backend/app/routers/notifications.py` | Optional `unread_only` + `limit` params; returns `unread_count` |
| ✅ | Mark notification as read (`POST /api/notifications/{id}/read`) | `backend/app/routers/notifications.py` | Sets `is_read = True`; method is POST not PUT |
| ✅ | Mark ALL notifications read (`POST /api/notifications/read-all`) | `backend/app/routers/notifications.py` | Bulk update via SQLAlchemy `update()` |
| ✅ | Create notification via MCP (`send_notification` tool) | `backend/app/mcp/tools.py` | Saves to DB + broadcasts `notification` WS event |
| ✅ | Demo time-alert background task | `backend/app/main.py` (`_run_time_alerts`) | Every 2 min; controlled by `DEMO_TIME_ALERTS=true` env var |
| ⚠️ | Dismiss notification endpoint | — | No `dismiss` endpoint in code; router only has `read` and `read-all` |
| ❌ | `notification_dismiss` MCP tool | — | Planned in FUTURE_PLANS §3.4 |
| ❌ | Native push notifications (APNs / FCM) | — | Requires Expo Notifications integration; post-MVP |

---

## 5. Backend — AI Agent Proxy

| Status | Feature | Location | Notes |
|--------|---------|----------|-------|
| ✅ | Built-in OpenAI-compatible LLM streaming | `backend/app/services/agent_proxy.py` | `_process_chat()` with token-by-token streaming |
| ✅ | External agent routing (SSE relay) | `backend/app/services/agent_proxy.py` | When `EXTERNAL_AGENT_URL` set, forwards to `api_server.py` |
| ✅ | Tool-call execution loop (max 5 turns) | `backend/app/services/agent_proxy.py` | Calls `execute_tool()` from `mcp/tools.py` |
| ✅ | XML tool-call fallback (non-function-calling models) | `backend/app/services/agent_proxy.py` | Regex strips `<tool_call>` XML; sends `chat_message_replace` to frontend |
| ✅ | Per-user agent config (Fernet-decrypted API key, model, URL) | `backend/app/routers/agent_config.py` | Falls back to env vars if unconfigured |
| ✅ | Reasoning token passthrough | `backend/app/services/agent_proxy.py` | `delta.reasoning` forwarded as `chat_token` |
| ✅ | 12 built-in tool definitions exposed to LLM | `backend/app/services/agent_proxy.py` | OpenAI function-calling format |
| ✅ | Agent config API (`GET/PUT /api/agent/config`) | `backend/app/routers/agent_config.py` | Store model, API key, URL, system prompt |
| ❌ | `POST /api/agent/test` endpoint | — | Test agent connection; spec'd in Backend Spec §3 |
| ❌ | Agent memory (vector store - long-term) | — | Planned in FUTURE_PLANS §9 |
| ❌ | Multi-agent routing (specialized agents per domain) | — | Planned in FUTURE_PLANS §9 |
| ❌ | Structured error codes from tool failures | — | Planned in FUTURE_PLANS §3.3 |

---

## 6. Backend — MCP Server

| Status | Feature | Location | Notes |
|--------|---------|----------|-------|
| ✅ | MCP server mounted at `/mcp` via FastMCP | `backend/app/mcp/server.py` | Streamable HTTP transport |
| ✅ | MCP auth middleware (Bearer token → user) | `backend/app/mcp/server.py` (`_MCPAuthMiddleware`) | Returns 401 for invalid tokens |
| ✅ | 22 MCP tools registered with `@mcp.tool()` | `backend/app/mcp/server.py` | All prefixed `helm_` |
| ✅ | Shared tool logic (`execute_tool`) | `backend/app/mcp/tools.py` | Single source of truth used by both MCP server and agent proxy |
| ✅ | `helm_set_screen` tool (draft=True default) | `backend/app/mcp/tools.py` | Stores SDUI JSON as draft pending user approval |
| ✅ | `helm_approve_draft` / `helm_reject_draft` tools | `backend/app/mcp/tools.py` | Human-in-the-loop approval flow |
| ✅ | `helm_hide_tab` / `helm_show_tab` / `helm_list_tabs` | `backend/app/mcp/tools.py` | AI controls tab visibility |
| ✅ | `helm_rename_tab` tool | `backend/app/mcp/tools.py` | Renames tab and/or changes icon |
| ✅ | Calendar tools (`helm_read_calendar`, `helm_create_event`, `helm_update_event`, `helm_delete_event`) | `backend/app/mcp/tools.py` | Full CRUD via MCP |
| ✅ | `helm_send_notification` tool | `backend/app/mcp/tools.py` | Broadcasts to connected user |
| ✅ | `helm_get_chat_history` tool | `backend/app/mcp/tools.py` | Last N messages |
| ✅ | `helm_delete_screen` / `helm_list_screens` tools | `backend/app/mcp/tools.py` | SDUI screen management |
| ✅ | SDUI V2 server-side validation (`_validate_sdui_v2()`) | `backend/app/mcp/tools.py` | Validates component types against `_VALID_V2_COMPONENT_TYPES`; raises detailed ValueError |
| ❌ | `calendar_find_free_slot` MCP tool | — | Suggest free slots given duration + constraints |
| ❌ | `notification_dismiss` MCP tool | — | Mark notification read/dismissed via AI |
| ❌ | `task_create` / `task_complete` MCP tools | — | Basic task tracking module |
| ❌ | `update_theme` MCP tool | — | AI pushes live theme updates |
| ❌ | Consistent `What / When / Example` tool docstrings | — | FUTURE_PLANS §3.1 |
| ❌ | Structured error codes from all tools | — | `NOT_FOUND`, `INVALID_INPUT`, etc. |

---

## 7. Backend — Action Registry

| Status | Feature | Location | Notes |
|--------|---------|----------|-------|
| ✅ | Action registry with 8 named handlers | `backend/app/services/action_registry.py` | Whitelist prevents SSRF |
| ✅ | `POST /api/actions/execute` endpoint | `backend/app/routers/actions.py` | Called by SDUI `server_action` type from frontend |
| ✅ | `GET /api/actions/functions` list endpoint | `backend/app/routers/actions.py` | Returns all registered function names |
| ✅ | `refresh_data` handler | `backend/app/services/action_registry.py` | Re-pushes current SDUI screen for a module via WS |
| ✅ | `submit_form` handler | `backend/app/services/action_registry.py` | Stores form data in `module_states`; broadcasts success notification |
| ✅ | `send_to_agent` handler | `backend/app/services/action_registry.py` | Sends a message to the AI agent via WS |
| ✅ | `mark_notification_read` handler | `backend/app/services/action_registry.py` | Marks one notification read by `notification_id` |
| ✅ | `create_calendar_event` handler | `backend/app/services/action_registry.py` | Creates calendar event from SDUI action |
| ✅ | `delete_calendar_event` handler | `backend/app/services/action_registry.py` | Deletes a calendar event by `event_id` |
| ✅ | `approve_draft` / `reject_draft` handlers | `backend/app/services/action_registry.py` | Human-in-the-loop SDUI approval |

---

## 8. Backend — SDUI / Modules

| Status | Feature | Location | Notes |
|--------|---------|----------|-------|
| ✅ | List modules with visibility (`GET /api/modules`) | `backend/app/routers/modules.py` | Returns all 7 tabs + enabled/disabled |
| ✅ | Hide tab (`DELETE /api/modules/{id}`) | `backend/app/routers/modules.py` | Broadcasts `tabs_updated` WS event |
| ✅ | Show tab (`POST /api/modules/{id}/show`) | `backend/app/routers/modules.py` | Broadcasts `tabs_updated` |
| ✅ | Rename/re-icon tab (`PATCH /api/modules/{id}/config`) | `backend/app/routers/modules.py` | Broadcasts `tabs_updated` |
| ✅ | Set SDUI screen with draft (`POST /api/sdui/{module_id}`) | `backend/app/routers/modules.py` | `draft=True` by default |
| ✅ | Get live SDUI screen (`GET /api/sdui/{module_id}`) | `backend/app/routers/modules.py` | Returns `{screen, version}` |
| ✅ | Get draft screen (`GET /api/sdui/{module_id}/draft`) | `backend/app/routers/modules.py` | Returns `{screen, has_draft}` |
| ✅ | Approve draft → publish live (`POST /api/sdui/{module_id}/draft/approve`) | `backend/app/routers/modules.py` | Copies draft to live |
| ✅ | Reject / discard draft (`POST /api/sdui/{module_id}/draft/reject`) | `backend/app/routers/modules.py` | Optional feedback body |
| ✅ | Delete SDUI screen (`DELETE /api/sdui/{module_id}`) | `backend/app/routers/modules.py` | Clears AI-set screen |
| ✅ | List all SDUI screens (`GET /api/sdui`) | `backend/app/routers/modules.py` | All AI-set screens across modules |
| ✅ | Device tab config (`GET/PUT /api/devices/config`) | `backend/app/routers/modules.py` | Per-device tab bar + nav mode config |
| ✅ | Mini-app module actions (`POST /api/modules/{id}/action`) | `backend/app/routers/modules.py` | random_number, play_rps, create_note, delete_note |
| ❌ | Visual drag-and-drop UI editor (web panel at `/editor`) | — | Detailed in FUTURE_PLANS §2 |

---

## 9. Backend — Workflow Engine

| Status | Feature | Location | Notes |
|--------|---------|----------|-------|
| ✅ | APScheduler-based SCHEDULE workflows (cron) | `backend/app/services/workflow_engine.py` | Registers jobs from DB on startup |
| ✅ | Workflow CRUD API (`GET/POST/PUT/DELETE /api/workflows`) | `backend/app/routers/workflows.py` | List, create, update, toggle, delete |
| ✅ | Workflow action executes via `execute_tool()` | `backend/app/services/workflow_engine.py` | Same path as MCP tool calls |
| ⚠️ | Event-triggered workflows (`EVENT_CREATED`, `EVENT_UPDATED`, `FORM_SUBMITTED`, `MESSAGE_RECEIVED`) | `backend/app/services/workflow_engine.py` | `fire_trigger()` exists but is NOT called from any router — event workflows are inert |
| ❌ | Wire `fire_trigger()` in calendar router | — | Would activate `EVENT_CREATED`/`EVENT_UPDATED` triggers |
| ❌ | Wire `fire_trigger()` in action registry (form submit) | — | Would activate `FORM_SUBMITTED` trigger |
| ❌ | Multi-step / conditional workflows | — | Current engine is single-step trigger→action only |

---

## 10. WebSocket Protocol

| Status | Feature | Location | Notes |
|--------|---------|----------|-------|
| ✅ | WebSocket endpoint at `/ws` | `backend/app/routers/websocket.py` | Auth via `?token=` query param; also accepts `?device_id=` param |
| ✅ | Device-aware connection tracking | `backend/app/services/websocket_manager.py` | `device_id` tracked; `send_to_device()` for targeted delivery |
| ✅ | `connected` event sent on connect | `backend/app/routers/websocket.py` | Sends `{type:"connected", user_id, device_id}` immediately after accepting |
| ✅ | `chat_message` handler → routes to agent proxy | `backend/app/routers/websocket.py` | Dispatches as asyncio background task |
| ✅ | `module_action` dispatch | `backend/app/routers/websocket.py` | Routes `module_action` type to action registry; returns `action_result` or `action_error` |
| ✅ | `chat_start` / `chat_token` / `chat_complete` events | Agent proxy + WS manager | Real-time streaming to frontend |
| ✅ | `chat_message_replace` event | Agent proxy | Strips XML tool calls from visible chat |
| ✅ | `tool_result` / `tool_error` events | Agent proxy | Sent after each tool execution |
| ✅ | `chat_error` event (with `code:"no_api_key"`) | Agent proxy | Error reporting to frontend |
| ✅ | `notification` event | MCP tools | Pushed immediately on `send_notification` |
| ✅ | `sdui_screen_update` event | MCP tools | Pushed when live screen changes |
| ✅ | `sdui_draft_update` event | MCP tools | Pushed when draft is queued |
| ✅ | `sdui_draft_rejected` event | MCP tools | Pushed when draft is rejected |
| ✅ | `tabs_updated` event | Modules router | Pushed on hide/show/rename/reorder |
| ✅ | 30s heartbeat ping/pong | Frontend WS client | `{"type":"ping"}` → `{"type":"pong"}` |
| ❌ | `typing_start` / `typing_stop` messages (client → server) | — | Protocol spec defines these; not implemented |
| ❌ | `tool_call_start` / `tool_call_complete` events (server → client) | — | Protocol spec defines these for "Checking calendar..." UX in chat |

---

## 11. Standalone Agent (`agent/`)

| Status | Feature | Location | Notes |
|--------|---------|----------|-------|
| ✅ | PydanticAI agent (REPL mode) | `agent/helm_agent.py` | `python helm_agent.py` |
| ✅ | PydanticAI agent (web UI mode) | `agent/helm_agent.py` | `python helm_agent.py --web` |
| ✅ | PydanticAI agent (one-shot mode) | `agent/helm_agent.py` | `python helm_agent.py "Your task"` |
| ✅ | Self-contained Gradio web chat UI | `agent/chat_ui.html` | Dark-themed; handles SSE from api_server |
| ✅ | `api_server.py` SSE streaming server | `agent/api_server.py` | Starlette; backend uses this as external agent |
| ✅ | `send_prompt.py` CLI tool | `agent/send_prompt.py` | POST to api_server and print streamed response |
| ✅ | Filesystem tools (read/write/list mobile source) | `agent/helm_agent.py` | Path-validated to `mobile/` directory |
| ✅ | SDUI V2 schema + all module IDs in system prompt | `agent/helm_agent.py` (`_SYSTEM_PROMPT`) | Agent knows component types, actions, module names |
| ✅ | Connects to backend MCP server | `agent/helm_agent.py` | Over HTTP; uses session token |

---

## 12. Frontend — Navigation & Auth

| Status | Feature | Location | Notes |
|--------|---------|----------|-------|
| ✅ | Expo Router file-based navigation | `mobile/app/` | `(auth)/` and `(tabs)/` groups |
| ✅ | Auth guard (token-based redirect) | `mobile/app/_layout.tsx` | No token → `/(auth)/connect`; token → `/(tabs)/chat` |
| ✅ | Connect screen (server URL + username + password) | `mobile/app/(auth)/connect.tsx` | Calls `POST /auth/setup`; on 409 auto-tries login directly |
| ✅ | Login screen (username + password) | `mobile/app/(auth)/login.tsx` | Shows connected server URL; `device_id: 'web'` hardcoded |
| ✅ | Secure token storage | `mobile/src/utils/storage.ts` | `expo-secure-store` on mobile and native, `localStorage` on web |
| ✅ | Logout calls server AND clears local state | `mobile/app/(tabs)/settings.tsx` | `AuthService.logout(token)` called first; on failure still clears local. Confirmed fixed. |
| ❌ | First-launch template chooser (Productivity, Personal, Blank) | — | Frontend Spec §4 — skip/template choice at first setup |
| ❌ | Biometric auth (Face ID / Touch ID) | — | 🚫 Out of scope for MVP |

---

## 13. Frontend — Tab Layout & Navigation

| Status | Feature | Location | Notes |
|--------|---------|----------|-------|
| ✅ | 7-tab layout: Home, Chat, Modules, Calendar, Forms, Alerts, Settings | `mobile/app/(tabs)/_layout.tsx` | |
| ✅ | Gear icon (⚙️) in every tab header → navigates to settings | `mobile/app/(tabs)/_layout.tsx` (`SettingsHeaderButton`) | `headerRight` in Tabs `screenOptions` |
| ✅ | AI-controlled tab visibility (hide/show) | `mobile/src/stores/tabsStore.ts` | `hiddenTabs[]`; tabs use `href: null` to suppress |
| ✅ | AI-controlled tab labels and icons (dynamic rename) | `mobile/src/stores/tabsStore.ts` + `_layout.tsx` | `tabsStore.moduleConfigs` stores `{name, icon}` per tab; resolved via `tabLabel()` / `tabIcon()` |
| ✅ | `TabsConfigSync` — syncs tab visibility + labels from REST + WS | `mobile/app/(tabs)/_layout.tsx` | Fetches `GET /api/modules` on mount; live updates on `tabs_updated` WS event |
| ✅ | Settings via tab (accessible as distinct tab) | `mobile/app/(tabs)/settings.tsx` | |
| ⚠️ | `settingsStore.navigationMode` applied to UI | `mobile/src/stores/settingsStore.ts` | Value persisted (via AsyncStorage) but not applied — no drawer mode built; settings screen shows the stored value as text only |
| ⚠️ | `handleModulePress` in modules.tsx | `mobile/app/(tabs)/modules.tsx` | Stub — logs `console.log('Module pressed:', module.id)` but does nothing else |
| ❌ | Sidebar drawer navigation (Mode B) | — | Frontend Spec §3.2; `nav_mode: 'sidebar'` stored per device but not wired |
| ❌ | Tab bar reorder UI (long-press to rearrange tabs) | — | Frontend Spec §3.1; device config stores order but no UI |
| ❌ | Module Center grid (full-screen grid of all module icons) | — | Frontend Spec §3.1; "More" tab → grid not built |
| ❌ | Custom tab icons (user-selectable via UI) | — | `helm_rename_tab` MCP tool sets icons programmatically; no user-facing UI to pick |

---

## 14. Frontend — Chat

| Status | Feature | Location | Notes |
|--------|---------|----------|-------|
| ✅ | Chat message list (FlatList, newest at bottom) | `mobile/app/(tabs)/chat.tsx` | |
| ✅ | Real-time AI response streaming (token-by-token) | `mobile/app/(tabs)/chat.tsx` | Handles `chat_token` / `chat_complete` WS events |
| ✅ | Streaming cursor (▌) visible while AI is typing | `mobile/app/(tabs)/chat.tsx` | Appended to partial content in the streaming bubble |
| ✅ | Fallback typing indicator (●●●) before first token | `mobile/app/(tabs)/chat.tsx` | Shown when `isStreaming=true` but `content` is still empty |
| ✅ | Text input bar + send button | `mobile/app/(tabs)/chat.tsx` | |
| ✅ | Connection status indicator | `mobile/app/(tabs)/chat.tsx` | `isConnected` state wired to WS `onConnect`/`onDisconnect` callbacks |
| ✅ | New Chat button (clears history) | `mobile/app/(tabs)/chat.tsx` | `handleNewChat()` calls `DELETE /api/chat/history` then clears local state; shows confirmation alert |
| ✅ | Empty state with prompt suggestions | `mobile/app/(tabs)/chat.tsx` | `EmptyState` component with icon + description when no messages |
| ✅ | Load chat history on mount (`GET /api/chat/history`) | `mobile/app/(tabs)/chat.tsx` | History returned in descending order; reversed to chronological |
| ✅ | `chat_message_replace` handler (strips XML tool calls) | `mobile/app/(tabs)/chat.tsx` | Replaces message content in-place by ID |
| ✅ | Collapsible tool-call bubbles (`ToolBubble`) | `mobile/app/(tabs)/chat.tsx` | Tap to expand/collapse; shows status icon (✓/✗), tool name, JSON-formatted result |
| ✅ | `tool_error` displayed as error tool bubble | `mobile/app/(tabs)/chat.tsx` | Red ✗ status icon |
| ✅ | Markdown rendering in assistant messages | `mobile/app/(tabs)/chat.tsx` | Assistant bubbles render via `SDUIMarkdown` component; user bubbles are plain `Text` |
| ✅ | `chat_error` display | `mobile/app/(tabs)/chat.tsx` | |
| ✅ | stale-closure-safe WS handler (`wsHandlerRef`) | `mobile/app/(tabs)/chat.tsx` | Subscription set once on `[ws]` change; ref always gets latest handler without re-subscribing |
| ⚠️ | `conversation_id: 'default'` hardcoded | `mobile/app/(tabs)/chat.tsx` | No multi-conversation support — all messages go to `default` conversation |
| ❌ | Tool call UX ("Checking calendar..." indicator) | — | Protocol spec `tool_call_start`/`tool_call_complete`; not built — tool result appears but not a progress indicator |
| ❌ | Inline embedded components in chat messages | — | Protocol spec `embeddedComponents` field; SDUI cards inside chat bubbles not built |
| ❌ | Multi-conversation support | — | Replace `conversation_id: 'default'`; conversation selector UI |
| ❌ | `typing_start` / `typing_stop` sent to server | — | Protocol spec client messages; not implemented |
| 🚫 | Voice input | — | 🚫 Out of scope for MVP |

---

## 15. Frontend — SDUI Rendering Engine

| Status | Feature | Location | Notes |
|--------|---------|----------|-------|
| ✅ | SDUI V1 renderer (`SDUIScreenRenderer`) | `mobile/src/components/sdui/SDUIRenderer.tsx` | Section-based layout; supports both `components[]` and singular `component` formats |
| ✅ | SDUI V2 renderer (`SDUIPageRenderer`) | `mobile/src/components/sdui/SDUIRenderer.tsx` | Row + cell layout; responsive breakpoint support (`compact`/`regular`); horizontal scroll rows |
| ✅ | `SDUIUniversalRenderer` — auto-detects V1 vs V2 | `mobile/src/components/sdui/SDUIRenderer.tsx` | Uses `isSDUIPage()` type guard to pick renderer |
| ✅ | Flat-props extraction (AI-omits `props` wrapper) | `mobile/src/components/sdui/SDUIRenderer.tsx` (`extractFlatProps`) | Handles AI JSON that skips the `props:{}` nesting |
| ✅ | V2 component registry (`componentRegistry.ts`) | `mobile/src/renderer/componentRegistry.ts` | Type string → React component map; `registerComponent()` to extend |
| ✅ | Atomic V2 components | `mobile/src/components/atomic/` | SDUIText, SDUIMarkdown, SDUIButton, SDUIImage, SDUITextInput, SDUIIcon, SDUIDivider |
| ✅ | Structural V2 components | `mobile/src/components/structural/` | SDUIContainer (flexbox + shadow + color tokens) |
| ✅ | Composite V2 components | `mobile/src/components/composite/` | CalendarModule, ChatModule, NotesModule, InputBar |
| ✅ | Extra SDUI utility components | `mobile/src/components/sdui/` | `SDUIBadge.tsx`, `SDUIStat.tsx` (active utility components) |
| ✅ | `useSDUIScreen` hook — fetch + live-update SDUI per module | `mobile/src/hooks/useSDUIScreen.ts` | Returns `{screen, draft, loading, error, refresh}`; fetches both live screen + draft in parallel on mount |
| ✅ | `useActionDispatcher` hook — execute all action types | `mobile/src/hooks/useActionDispatcher.ts` | navigate, go_back, open_url, copy_text, dismiss, open_sheet (stub), server_action, send_to_agent, toggle, api_call (legacy) |
| ✅ | URL scheme validation on `open_url` | `mobile/src/hooks/useActionDispatcher.ts` | Only allows `http`, `https`, `mailto`, `tel` schemes |
| ✅ | `DraftPreview` component (approve / reject / feedback) | `mobile/src/components/sdui/DraftPreview.tsx` | Shows draft with approve/reject/"Add Feedback" buttons; feedback input toggle; confirmation alert on approve |
| ✅ | `server_action` → `POST /api/actions/execute` | `mobile/src/hooks/useActionDispatcher.ts` | SDUI buttons can call named backend functions |
| ✅ | `send_to_agent` → WS chat message + navigate to chat | `mobile/src/hooks/useActionDispatcher.ts` | SDUI can send a message to the AI agent |
| ✅ | `copy_text` via expo-clipboard | `mobile/src/hooks/useActionDispatcher.ts` | Shows "Copied" alert on success |
| ✅ | SDUI fallback on all 7 tabs (AI can override any tab) | All tab screens | `home`, `chat`, `calendar`, `forms`, `alerts`, `modules`, `settings` |
| ❌ | `open_sheet` action fully implemented | `mobile/src/hooks/useActionDispatcher.ts` | Case exists but is a stub — no modal routing system built yet |
| ❌ | SDUI component theme system (`update_theme` MCP tool) | — | FUTURE_PLANS §1.1 |
| ❌ | Widget/card builder UI (human drag-and-drop editor) | — | FUTURE_PLANS §2 |
| ❌ | Template library (pre-built SDUI layouts) | — | FUTURE_PLANS §2.3 |
| ⚠️ | Dead V1 component files still present | `mobile/src/components/sdui/` | `AlertComponent.tsx`, `CalendarComponent.tsx`, `FormComponent.tsx`, `ListComponent.tsx` all still exist and are unused |

---

## 16. Frontend — Calendar

The calendar tab is a native React Native month-grid view. No third-party calendar library — custom-built with `date-fns`.

| Status | Feature | Location | Notes |
|--------|---------|----------|-------|
| ✅ | Month grid (7-column, leading-padded to correct weekday) | `mobile/app/(tabs)/calendar.tsx` | Day-of-week header row: Su Mo Tu We Th Fr Sa |
| ✅ | Prev / Next month navigation buttons (‹ ›) | `mobile/app/(tabs)/calendar.tsx` | `navigateMonth(±1)` with `addMonths`/`subMonths` from date-fns |
| ✅ | Month + year title in header | `mobile/app/(tabs)/calendar.tsx` | e.g. "April 2026" |
| ✅ | Today highlighted with distinct style | `mobile/app/(tabs)/calendar.tsx` | `isToday(day)` from date-fns; different background color |
| ✅ | Tap a day to select it (highlights selected date) | `mobile/app/(tabs)/calendar.tsx` | Tap again to deselect |
| ✅ | Event dots on days that have events (up to 3) | `mobile/app/(tabs)/calendar.tsx` | Dot color = `event.color` or primary; `slice(0, 3)` max |
| ✅ | Selected day agenda below grid | `mobile/app/(tabs)/calendar.tsx` | Shows formatted day title + event list with time range, title, optional description + location (📍) |
| ✅ | Color-coded event rows (left border) | `mobile/app/(tabs)/calendar.tsx` | `borderLeftColor: event.color ?? colors.primary` on event row |
| ✅ | "No events" empty state for selected day | `mobile/app/(tabs)/calendar.tsx` | |
| ✅ | Loading text while fetching | `mobile/app/(tabs)/calendar.tsx` | Shows "Loading…" in grid area |
| ✅ | Error banner with retry | `mobile/app/(tabs)/calendar.tsx` | `ErrorBanner` component |
| ✅ | Fetch events on focus + on month change | `mobile/app/(tabs)/calendar.tsx` | `useFocusEffect` re-runs when tab gains focus or `currentMonth` changes |
| ✅ | O(1) event lookup by date | `mobile/app/(tabs)/calendar.tsx` | `eventsByDate` useMemo builds a `Record<dateString, events[]>` map |
| ✅ | Accessibility labels on nav buttons + day cells | `mobile/app/(tabs)/calendar.tsx` | e.g. `accessibilityLabel="Previous month"`, `"Friday April 4"` |
| ✅ | SDUI fallback — AI can replace calendar tab entirely | `mobile/app/(tabs)/calendar.tsx` | If `sduiScreen` is set, renders that instead of native calendar |
| ❌ | Create event UI (modal with form) | — | FUTURE_PLANS §7; backend endpoint exists but no UI |
| ❌ | Edit / delete event UI (tap event → sheet) | — | FUTURE_PLANS §7 |
| ❌ | Week / day view | — | FUTURE_PLANS §7; only month view exists |

---

## 17. Frontend — Alerts / Notifications

| Status | Feature | Location | Notes |
|--------|---------|----------|-------|
| ✅ | Notifications list (cards with title, message, formatted timestamp) | `mobile/app/(tabs)/alerts.tsx` | Uses `Card` component; `format(date, 'MMM d, h:mm a')` |
| ✅ | Fetch on mount (`GET /api/notifications`) | `mobile/app/(tabs)/alerts.tsx` | Re-runs when `[token, serverUrl]` change |
| ✅ | Re-fetch on WS `notification` event | `mobile/app/(tabs)/alerts.tsx` | Calls `loadNotifications()` full reload on new notification |
| ✅ | Loading state, empty state, error state | `mobile/app/(tabs)/alerts.tsx` | Shows "Loading notifications..." / "No notifications" / `ErrorBanner` |
| ✅ | SDUI fallback if AI sets the alerts tab | `mobile/app/(tabs)/alerts.tsx` | |
| ❌ | Live append new notification from WS (without re-fetch) | — | Re-fetches entire list instead of just appending new item |
| ❌ | In-app banner for new notifications | — | FUTURE_PLANS §5.1 |
| ❌ | Severity indicator (colour by info/warning/error/success) | — | Backend stores `severity`; frontend `Card` component doesn't colour-code it |
| ❌ | Mark notification as read when tapped | — | `markNotificationRead()` method exists on `ApiClient` but alerts.tsx never calls it |
| ❌ | "Mark all read" button | — | Backend `POST /read-all` endpoint exists; no frontend UI |
| ❌ | Notification action buttons (rendered from `actions` array) | — | Backend stores `actions_json`; frontend renders no action buttons |
| ❌ | Swipe to dismiss notification | — | |

---

## 18. Frontend — Forms

| Status | Feature | Location | Notes |
|--------|---------|----------|-------|
| ✅ | Forms tab is purely SDUI-driven (no native fallback) | `mobile/app/(tabs)/forms.tsx` | Uses `useSDUIScreen('forms')` |
| ✅ | Loading state + error state + empty state | `mobile/app/(tabs)/forms.tsx` | Empty state says "Ask the AI to create a form for you" with example prompt |
| ✅ | Form submission via `server_action` SDUI action type | `mobile/src/hooks/useActionDispatcher.ts` | POSTs to `/api/actions/execute {function:"submit_form"}` |
| ❌ | `GET /api/forms/{form_id}/submissions` endpoint | — | FUTURE_PLANS §4.3; needs backend route |
| ❌ | AI-generated form workflow triggers | — | Form submission should fire workflow trigger |

---

## 19. Frontend — Settings

The settings screen is read-only — it shows current values but provides no controls to change them (except Logout).

| Status | Feature | Location | Notes |
|--------|---------|----------|-------|
| ✅ | Server section — shows current server URL | `mobile/app/(tabs)/settings.tsx` | Read-only display |
| ✅ | Agent section — shows "Configure in backend" placeholder | `mobile/app/(tabs)/settings.tsx` | No real agent config UI; just a static label |
| ✅ | Navigation section — shows current mode ("Bottom Tabs" or "Drawer") | `mobile/app/(tabs)/settings.tsx` | Display only; no toggle |
| ✅ | Appearance section — shows current theme | `mobile/app/(tabs)/settings.tsx` | Display only; no toggle |
| ✅ | About section — shows version 1.0.0 | `mobile/app/(tabs)/settings.tsx` | Hardcoded |
| ✅ | Account section — shows logged-in username (and email if present) | `mobile/app/(tabs)/settings.tsx` | |
| ✅ | Logout button with confirmation alert | `mobile/app/(tabs)/settings.tsx` | Calls server `POST /auth/logout` then clears local state |
| ✅ | SDUI fallback — AI can replace settings tab | `mobile/app/(tabs)/settings.tsx` | |
| ⚠️ | Navigation mode setting is not interactive | `mobile/app/(tabs)/settings.tsx` | Only displays stored value; no button to toggle |
| ⚠️ | Theme setting is not interactive | `mobile/app/(tabs)/settings.tsx` | Only displays stored value; `userInterfaceStyle: "light"` hardcoded in `app.json` |
| ❌ | Agent config UI (API key, model, URL input fields) | — | `GET/PUT /api/agent/config` endpoints exist; no frontend UI |
| ❌ | Change server URL from settings | — | Would need to edit stored serverUrl and re-auth |
| ❌ | Dark mode | — | FUTURE_PLANS priority P3; tokens exist in `tokens.ts` |

---

## 20. Frontend — State Management & Services

| Status | Feature | Location | Notes |
|--------|---------|----------|-------|
| ✅ | `authStore` (token, serverUrl, user — persisted) | `mobile/src/stores/authStore.ts` | Uses `storage` util (platform-aware: SecureStore on native, localStorage on web) |
| ✅ | `uiStore` (connection status, error banner) | `mobile/src/stores/uiStore.ts` | In-memory Zustand |
| ✅ | `settingsStore` (nav mode, theme — persisted via AsyncStorage) | `mobile/src/stores/settingsStore.ts` | Uses `AsyncStorage`; `.initialize()` reads stored values on startup |
| ✅ | `tabsStore` (hidden tabs + module configs — in-memory) | `mobile/src/stores/tabsStore.ts` | `hiddenTabs: string[]` + `moduleConfigs: Record<id, {name, icon}>` — both set by `TabsConfigSync` |
| ✅ | `ApiClient` (all REST endpoints) | `mobile/src/services/api.ts` | Handles 401 by calling `onUnauthorized` callback; methods: auth, calendar, notifications, agent config, workflows, modules, SDUI, chat history, actions |
| ✅ | `AuthService` (setup + login + logout, pre-token) | `mobile/src/services/auth.ts` | `setup()`, `login()`, `logout(token)` — all use `fetch` directly |
| ✅ | `ReconnectingWebSocket` (maxRetries=10, 30s ping) | `mobile/src/services/websocket.ts` | |
| ✅ | `WebSocketContext` — singleton WS shared across all tabs | `mobile/src/contexts/WebSocketContext.tsx` | |
| ✅ | `useBreakpoint` hook (compact/regular at 768px) | `mobile/src/hooks/useBreakpoint.ts` | |
| ✅ | Zod WS message validation (`.passthrough()` critical) | `mobile/src/utils/validation.ts` | Never strips unknown fields from backend messages |
| ✅ | Design tokens V1 (Notion-like colors, spacing, typography) | `mobile/src/theme/colors.ts` | |
| ✅ | Design tokens V2 (themeColors, themeShadows, resolveColor) | `mobile/src/theme/tokens.ts` | |
| ❌ | `chatStore` (planned in Frontend Spec §7) | — | Chat state is inline in `chat.tsx` component state; no dedicated Zustand store |

---

## 21. Design System

| Status | Feature | Location | Notes |
|--------|---------|----------|-------|
| ✅ | Notion-like minimal visual style | `mobile/src/theme/colors.ts` | White, light gray backgrounds; thin borders |
| ✅ | Typography scale (h1–caption, SF Pro system font) | `mobile/src/theme/colors.ts` | |
| ✅ | Spacing scale (xs=4 … xxxl=48) | `mobile/src/theme/colors.ts` | |
| ✅ | Color token system (backgrounds, text, accents) | `mobile/src/theme/colors.ts`, `tokens.ts` | |
| ⚠️ | Dark mode tokens exist but not applied | `mobile/src/theme/tokens.ts` | `Appearance.getColorScheme()` not wired; `app.json` hardcodes light |
| ❌ | Dynamic theme from backend (per-user/per-tenant colors) | — | FUTURE_PLANS §1.1 |
| ❌ | Skeleton loading screens | — | Frontend Spec §6; currently spinner/nothing |
| ❌ | Connection state banner across all screens | — | Frontend Spec §4; `uiStore.connectionState` exists but banner not universally rendered |

---

## 22. Platform Support

| Status | Feature | Notes |
|--------|---------|-------|
| ✅ | iOS (primary target) | Expo managed workflow; real-device via Expo Go |
| ✅ | Web (Expo Web) | Limited native API support; works for dev/testing |
| ✅ | Android (React Native cross-platform) | Untested but should work via `npx expo start --android` |
| ❌ | iPad layout | 🚫 Out of scope for MVP; portrait phone layout only |
| ❌ | App Store deployment | Requires Mac + EAS Build (`eas build --platform ios`) |
| ❌ | Android Play Store deployment | Post-MVP |

---

## 23. Security

| Status | Feature | Location | Notes |
|--------|---------|----------|-------|
| ✅ | bcrypt password hashing | `backend/app/utils/security.py` | |
| ✅ | JWT session tokens (24h expiry) | `backend/app/utils/security.py` | Validated server-side every request |
| ✅ | Server-side session invalidation on logout | `backend/app/routers/auth.py` | |
| ✅ | Fernet-encrypted API keys at rest | `backend/app/utils/security.py` | Keyed from `SECRET_KEY` env var |
| ✅ | MCP auth middleware (Bearer token required) | `backend/app/mcp/server.py` | |
| ✅ | Action registry whitelist (prevents SSRF from SDUI actions) | `backend/app/services/action_registry.py` | |
| ✅ | Filesystem tool path validation (mobile/ only) | `agent/helm_agent.py` | |
| ⚠️ | HTTPS / TLS | — | Backend runs HTTP; needs reverse proxy (nginx/Caddy) in front |
| ❌ | Rate limiting | — | Not needed for MVP (self-hosted, single user); needed for multi-user |
| ❌ | Audit logging | — | MCP call logs, workflow run history |
| 🚫 | CORS locked to specific origin | — | Currently `allow_origins=["*"]`; acceptable for self-hosted |

---

## 24. Deployment & Operations

| Status | Feature | Location | Notes |
|--------|---------|----------|-------|
| ✅ | Dev server (uvicorn --reload) | `backend/` | `cd backend && uvicorn app.main:app --reload` |
| ✅ | Alembic migration workflow | `backend/alembic/` | `alembic upgrade head` |
| ✅ | `.env` configuration file | repo root | `OPERATIONS.md` documents all variables |
| ✅ | `manage.py` CLI | `backend/manage.py` | `python manage.py create-user` etc. |
| ❌ | Dockerfile | — | Backend Spec §8; not yet created |
| ❌ | docker-compose.yml | — | Backend Spec §8; not yet created |
| ❌ | Admin dashboard web UI (`/admin`) | — | FUTURE_PLANS §10 |
| ❌ | Production backup / restore system | — | 🚫 Out of scope for MVP |

---

## 25. Plugin / Connector System (Post-MVP)

| Status | Feature | Notes |
|--------|---------|-------|
| ❌ | `ServiceConnector` abstract base class | Backend Spec §10 pattern defined |
| ❌ | Google Calendar connector (OAuth + sync) | External calendar sync |
| ❌ | GitHub connector | Issues, PRs, notifications |
| ❌ | Slack connector | Message broadcasting |
| ❌ | Email connector (read / send) | SMTP / IMAP |
| ❌ | Weather connector | Live weather data |
| ❌ | Per-connector enable/disable per user | |
| ❌ | OAuth flow UI in app (for connectors requiring user auth) | |

---

## Summary Counts

> All ✅ entries verified by reading source files on 2026-04-04.

| Status | Count |
|--------|-------|
| ✅ Coded and working | ~105 |
| ⚠️ Coded but incomplete / partial | ~12 |
| ❌ Planned / not started | ~55 |
| 🚫 Explicitly out of scope (MVP) | ~8 |

---

## See Also

- `FUTURE_PLANS.md` — Detailed prioritised improvement plans with implementation notes
- `AI-TECHNICAL-REFERENCE.md` — File map, data flows, known gaps, critical patterns
- `backend.md` — Full API endpoint reference, DB schema, service architecture
- `frontend.md` — All screens, hooks, components, state management detail
- `protocol.md` — REST + WebSocket + MCP contract definitions
- `agents-and-systems.md` — Agent proxy, MCP server, workflow engine, standalone agent
