# Backend — Python FastAPI Server
 
> Last updated: 2026-06-18 (architecture refresh: current app wiring, FF4 versioning, validation pipeline, MCP/tooling, and backend folder map)
> Last audit: 2026-06-18 — updated against the current backend file tree
 
## Tier 1: TL;DR
 
Helm's backend is the server-side control plane. It owns:
 
- Identity and access: first-user setup, login/logout, bearer sessions, device tracking, admin guards
- Product state: apps, modules, module instances, templates, working drafts, version history, preview sessions
- User content: chat, calendar, notifications, todos, notes, articles, settings
- Automation: workflows, triggers, actions, variables, data sources, connections
- Real-time delivery: WebSocket chat stream, SDUI updates, notifications, action results
- Agent interfaces: in-app agent proxy and external MCP server sharing the same tool layer
- Ops and safety: audit logs, sandbox request recording, cleanup tools, SQLAdmin
 
The backend is intentionally layered:
 
1. `main.py` wires the FastAPI app, middleware, router registration, lifespan, and mounted sub-apps.
2. Routers translate HTTP/WebSocket requests into validated service calls.
3. Services own the business rules, scheduling, validation, seeding, and cross-cutting orchestration.
4. ORM models are the authoritative persisted state.
5. Schemas define request/response contracts at the API boundary.
6. Alembic migrations evolve the schema independently of code.
7. Tests exercise the real app in-process against SQLite.
 
If you want to learn it in order, start here:
 
- `backend/app/main.py`
- `backend/app/config.py`
- `backend/app/database.py`
- `backend/app/dependencies.py`
- `backend/app/services/sdui_state.py`
- `backend/app/services/app_service.py`
- `backend/app/services/version_service.py`
- `backend/app/services/validation_service.py`
- `backend/app/services/workflow_engine.py`
- `backend/app/services/action_registry.py`
- `backend/app/mcp/tools.py`
- `backend/tests/conftest.py`
 
Run it: `cd backend && uvicorn app.main:app --reload`
Test it: `cd backend && pytest -q`
 
---
 
## Backend folder map
 
| Path | What it owns | Why it matters |
|------|--------------|----------------|
| `backend/app/main.py` | FastAPI app construction, middleware order, router registration, lifespan, mounts, startup seeders | This is the wiring file. If request flow or startup behavior feels mysterious, start here. |
| `backend/app/config.py` | Pydantic settings loaded from the repo-root `.env`, plus startup validation for required secrets and runtime flags | Single place where env-driven behavior is defined. |
| `backend/app/database.py` | Async SQLAlchemy engine, session factory, request-scoped DB lifecycle, sandbox commit interception | The session lifecycle is the hidden contract most routes depend on. |
| `backend/app/dependencies.py` | Bearer-token auth, current-user resolution, admin guard, pagination helpers | Most protected routes share these dependencies. |
| `backend/app/routers/` | Domain HTTP/WebSocket routers, one file per concern | Thin transport layer. Should translate and delegate, not contain domain logic. |
| `backend/app/services/` | Business logic, schedulers, validation, versioning, seeding, real-time delivery, agent proxy, action registry | This is where most backend behavior actually lives. |
| `backend/app/models/` | ORM tables and relationships | Authoritative persisted state. If a field exists in the DB, it starts here. |
| `backend/app/schemas/` | Pydantic request/response DTOs | Transport contracts. These define what routers accept and emit. |
| `backend/app/mcp/` | MCP server wrapper and shared tool implementations | External agents call the same tool implementations the app uses internally. |
### Key Components
 
| Component | Location | What it owns |
|-----------|----------|--------------|
| FastAPI app | `app/main.py` | App construction, middleware order, router registration, lifespan hooks, mounted sub-apps, startup seeding |
| Config | `app/config.py` | Repo-root `.env` loading, settings validation, feature flags, secret checks |
| Database | `app/database.py` | Async engine/session factory, request-scoped DB lifecycle, sandbox commit interception |
| Auth dependencies | `app/dependencies.py` | Bearer token parsing, current-user lookup, admin guard, pagination helpers |
| Models | `app/models/` | Table-backed ORM state (32 tables), relationships, and compatibility models |
| Schemas | `app/schemas/` | 31 Pydantic request/response modules |
| Routers | `app/routers/` | 28 domain routers; HTTP and WebSocket transport only |
| Services | `app/services/` | Business rules, schedulers, validation, versioning, seeders, real-time delivery, agent proxy, cleanup |
| MCP | `app/mcp/` | External agent server plus shared tool implementations |
| Middleware | `app/middleware/sandbox.py` | Sandbox ASGI middleware |
| Utils | `app/utils/security.py`, `app/utils/crypto.py` | JWT, bcrypt, Fernet helpers |
| Tests | `backend/tests/` | In-process integration suite using ASGITransport and in-memory SQLite |
 
### `main.py` — App Setup
 
**Middleware (in order of execution):**
1. `SandboxMiddleware` — `X-Helm-Sandbox: true` header triggers sandbox mode, intercepts DB commits, records to `sandbox_actions`
2. `SessionMiddleware` — required by SQLAdmin's auth backend
3. `CORSMiddleware` — allows configured origins with credentials enabled
 
**Lifespan events:**
- Startup: `start_scheduler()`, start the mounted MCP session manager manually, seed component registry, seed templates with `replace=True`, seed sample workflows/variables/data sources, migrate `sdui_screen_history` into the FF4 versioning layer, optionally start `_run_time_alerts()`
- Shutdown: cancel the alert task, stop the MCP session manager, stop the scheduler
 
**Background task `_run_time_alerts()`**: Every 2 minutes, inserts notifications for connected users and broadcasts the event over WebSocket. Controlled by `DEMO_TIME_ALERTS`; defaults to true.
 
**Routers registered:** `auth`, `modules`, `templates`, `chat`, `calendar`, `notifications`, `todos`, `agent_config`, `workflows`, `actions`, `users`, `sessions`, `audit`, `components`, `admin`, `variables`, `data_sources`, `triggers`, `connections`, `module_instances`, `settings`, `articles`, `apps`, `app_versions`, `devices`, `module_versions`, `websocket`, `notes`
 
**Mounted sub-apps:** MCP at `settings.mcp_path` (typically `/mcp`), SQLAdmin at `/admin/db` with BasicAuth from `ADMIN_USERNAME` / `ADMIN_PASSWORD`, and the compiled web admin at `/` when `settings.serve_static` and `web/dist` are present.
## Backend domain map
 
### Identity and access
`routers/auth.py`, `routers/users.py`, `routers/sessions.py`, `routers/settings.py`, `routers/devices.py`, `routers/agent_config.py`, `services/auth.py`, `dependencies.py`, `utils/security.py`
 
### Apps, modules, and versioning
`routers/apps.py`, `routers/app_versions.py`, `routers/modules.py`, `routers/module_instances.py`, `routers/module_versions.py`, `services/app_service.py`, `services/device_service.py`, `services/module_service.py`, `services/version_service.py`, `services/validation_service.py`, `services/sdui_state.py`
 
### SDUI templates and component registry
`routers/templates.py`, `routers/components.py`, `services/template_seed.py`, `services/component_seed.py`
 
### Automation and integrations
`routers/workflows.py`, `routers/triggers.py`, `routers/actions.py`, `routers/connections.py`, `routers/data_sources.py`, `services/workflow_engine.py`, `services/trigger_engine.py`, `services/action_registry.py`, `services/variable_resolver.py`, `services/data_connectors.py`
 
### User content and collaboration
`routers/chat.py`, `routers/calendar.py`, `routers/notifications.py`, `routers/todos.py`, `routers/notes.py`, `routers/articles.py`
 
### Ops, telemetry, and maintenance
`routers/admin.py`, `routers/audit.py`, `services/audit.py`, `services/cleanup_service.py`, `middleware/sandbox.py`, `services/websocket_manager.py`
 
### External agent surface
`mcp/server.py`, `mcp/tools.py`, `services/agent_proxy.py`
 
---

## Data model and schema evolution
 
The authoritative backend state lives in `backend/app/models/`. `backend/app/models/__init__.py` imports every model so metadata registration, SQLAdmin, migrations, tests, and seed code all share the same registry.
 
Current model count: **33 model files**.
 
### Model organization
 
#### Identity and access
- `user.py`
- `session.py`
- `device.py`
- `settings.py`
- `agent_config.py`
 
#### Apps, modules, and versioning
- `app.py`
- `app_module_ref.py`
- `app_version.py`
- `app_working_draft.py`
- `module_instance.py`
- `module_state.py`
- `module_version.py`
- `module_working_draft.py`
- `preview_session.py`
 
#### Templates and SDUI structure
- `template.py`
- `template_version.py`
- `component_registry.py`
- `screen_history.py`
 
#### Automation and integrations
- `workflow.py`
- `trigger.py`
- `connection.py`
- `data_source.py`
- `custom_variable.py`
 
#### Content and collaboration
- `chat_message.py`
- `calendar_event.py`
- `notification.py`
- `todo.py`
- `note.py`
- `article.py`
 
#### Operational and audit state
- `audit_log.py`
- `sandbox_action.py`
- `device_error.py`
 
### What the model registry means
 
- If a feature writes to the database, there is usually a model file for it.
- If a feature needs a join or relationship to survive across requests, that relationship belongs in the model layer first.
- Compatibility rows still exist for older flows, but the FF4 draft/version tables are the current source of truth for module and app edit state.
 
### Schema migration history
 
Current Alembic revision count: **22 migration files** in `backend/alembic/versions/`.
 
Current revisions:
 
- `de71aeb133e3_initial_schema.py`
- `1d07216a865d_add_sdui_templates_and_sdui_screen_.py`
- `31969323f95b_add_component_registry_table.py`
- `f8a9b0c1d2e3_add_todos_table.py`
- `c9bfbdb0973f_add_settings_table_with_foreign_key.py`
- `ee17096d9496_add_temperature_max_tokens_is_active_to_.py`
- `f3a1b2c4d5e6_add_module_instances_table.py`
- `ace0bc925c39_add_last_active_to_sessions.py`
- `644530918c51_add_audit_logs_table.py`
- `b5c7d9e2f4a6_add_trigger_definitions_table.py`
- `0b3ecd975f0b_add_connections_table_for_api_key_.py`
- `a3b8c9d0e1f2_add_custom_variables_and_data_sources.py`
- `d4aa5857b012_add_run_count_and_last_run_at_to_.py`
- `97967c8d628b_update_workflow_model_for_react_flow.py`
- `5f1877f37748_add_session10_models.py`
- `12d257e0ec5e_add_unique_constraint_user_id_module_.py`
- `d15c43b2c823_merge_heads.py`
- `59b20307e798_ff4_versioning_and_notes.py`
- `5468f59c7834_ff4_app_template_versioning.py`
- `0a1b2c3d4e5f_add_calendar_source_type_and_notes.py`
- `089ea87bcf18_add_sandbox_actions_table.py`
- `d8dc2a68d143_add_device_error_reports_table_and_.py`
 
### Persistence flow
 
The typical persistence path is:
 
1. Router parses a request schema from `backend/app/schemas/`.
2. `dependencies.py` resolves the user and opens the request DB session.
3. Router delegates to a service or does a small local check.
4. Service reads/writes ORM rows.
5. Session commits or rolls back.
6. Router returns a response schema or DTO.
 
### Current source-of-truth rows
 
- `ModuleWorkingDraft` / `ModuleVersion`
- `AppWorkingDraft` / `AppVersion`
- `PreviewSession`
- `Settings`, `AgentConfig`, `Session`, `Device`
- `Connection`, `DataSource`, `CustomVariable`
- `Workflow`, `TriggerDefinition`, `AuditLog`
 
Legacy compatibility still exists:
 
- `ModuleState`
- `ScreenHistory`
- `module_states` compatibility keys such as `sdui__{module_id}` and `sdui__{module_id}__draft`
 
---

## API surface
 
The backend API is intentionally grouped by domain, not by technical layer.
 
### Identity and access
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/auth/status` | ❌ | Setup state and server identity |
| POST | `/auth/setup` | ❌ | First-user bootstrap; locked after success |
| POST | `/auth/login` | ❌ | Authenticate, upsert device, create session token |
| POST | `/auth/refresh` | ✅ | Reissue the current session token |
| POST | `/auth/logout` | ✅ | Invalidate the current session |
| GET/PUT | `/api/settings` | ✅ | Read/update user profile settings |
| `/api/devices...` | ✅ | Device registration, assignment, config, status, preview exit |
| `/api/users...` | ✅ Admin | Admin user CRUD |
| `/api/sessions...` | ✅ | Session listing and revocation |
| `/api/agent/config` | ✅ | User AI provider config |
 
### Product state and SDUI
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `/api/apps...` | ✅ | App CRUD, module refs, bottom bar config, drafts, versions, previews, publish |
| `/api/modules...` | ✅ | Module tab visibility, custom modules, drafts, versions, duplication, usage |
| `/api/templates...` | ✅ | Template CRUD, apply/import, rows, versions |
| `/api/components...` | ✅ Admin | Component registry CRUD |
| `/api/sdui...` | ✅ | Live screen, draft, validate, history, duplicate, tab config |
| `/api/module_versions...` | ✅ | Module version history and checkpoint flows |
| `/api/app_versions...` | ✅ | App publish/version flows |
| `/api/preview-sessions...` | ✅ | Preview session retrieval, exit, extend |
 
### Collaboration and content
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `/api/chat...` | ✅ | Chat history retrieval and clearing |
| `/api/calendar...` | ✅ | Event CRUD; fires workflow triggers on changes |
| `/api/notifications...` | ✅ | Notification list and read state |
| `/api/todos...` | ✅ | Todo CRUD |
| `/api/notes...` | ✅ | Notes CRUD |
| `/api/articles...` | ✅ | Article list/get/delete |
 
### Automation and integration
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `/api/workflows...` | ✅ | Workflow CRUD and n8n import |
| `/api/triggers...` | ✅ | Trigger CRUD and manual execution |
| `/api/actions...` | ✅ | Action catalog and execution |
| `/api/connections...` | ✅ | Encrypted external credentials |
| `/api/data_sources...` | ✅ | Data source configs |
| `/api/variables...` | ✅ | Custom variables |
| `/api/audit...` | ✅ | Audit log retrieval |
| `/api/admin...` | ✅ Admin | Stats and cleanup |
 
### Mounted non-HTTP domain channels
| Path | Auth | What it serves |
|------|------|----------------|
| `WS /ws` | `?token=` | Chat streaming, notifications, SDUI updates, module actions |
| `/mcp` | Bearer token | External agent tools |
| `/admin/db` | BasicAuth | SQLAdmin database browser |
| `/health` | none | Liveness check |
 
### Router design rule
 
Routers should be readable as transport adapters:
 
- parse request data with schemas
- resolve auth and sessions via dependencies
- delegate policy to services
- emit websocket events and audit logs when side effects matter
 
Complex rules belong in services, not in route handlers.
 
---

## WebSocket protocol
 
The websocket channel is not a side feature. It carries the live chat stream, notifications, SDUI updates, tab changes, and module action results that make the mobile app feel reactive.
 
### Connection
- URL: `ws://<host>/ws?token=<session_token>&device_id=<optional>`
- Heartbeat: client sends `{type: "ping"}` every 30 seconds; server replies `{type: "pong"}`
- Auth: token comes from the session table, not a separate websocket secret
 
### Client → server messages
| `type` | Payload | Action |
|--------|---------|--------|
| `ping` | — | Replies `pong` |
| `chat_message` | `content, conversation_id` | Starts agent-proxy streaming in the background |
| `module_action` | `function, params, ref` | Executes through the action registry |
 
### Server → client messages
| `type` | Payload | When |
|--------|---------|------|
| `connected` | `user_id, device_id` | Connection accepted |
| `pong` | — | Heartbeat reply |
| `chat_start` | `message_id` | Assistant stream begins |
| `chat_token` | `message_id, token` | Streamed text delta |
| `chat_message_replace` | `message_id, content` | Tool-call stripping rewrite |
| `chat_complete` | `message_id, content` | Final assistant message |
| `chat_error` | `message, code?` | Chat streaming failed |
| `notification` | `id?, title, message, severity, actions?, timestamp?` | Push notification |
| `sdui_screen_update` | `module_id, screen, version` | Live SDUI screen changed |
| `sdui_draft_update` | `module_id, screen, version` | Draft ready, updated, or cleared |
| `sdui_draft_rejected` | `module_id` | Legacy draft rejection signal |
| `tabs_updated` | `modules: [...]` | Tab visibility or naming changed |
| `module_state_update` | `module, state, version` | Legacy module state change |
| `tool_result` | `tool, result` | Tool call succeeded |
| `tool_error` | `tool, message` | Tool call failed |
| `action_result` | `ref?, result` | Module action completed |
| `action_error` | `ref?, message` | Module action failed |
 
### What to notice
- The websocket protocol mirrors the REST/MCP contract instead of inventing its own domain vocabulary.
- Chat and screen state reuse the same `message_id` / module identifiers across events so the client can reconcile a stream with the UI state.
- Draft clearing is explicit. A cleared draft is not just “missing”; the protocol emits `screen: null, version: 0` before the live update.
 
---
 
## Services detail
 
The service layer is where the backend becomes understandable. Routers are mostly transport; services own rules.
 
### `services/auth.py`
| Function | Purpose |
|----------|---------|
| `is_setup_complete(db)` | True if any user exists |
| `create_first_user(db, username, password)` | Creates the initial admin user |
| `authenticate_user(db, username, password)` | Validates credentials |
| `upsert_device(db, user_id, device_id, device_name)` | Creates or updates `Device.last_seen` |
| `create_session(db, user_id, device_id)` | Invalidates prior device sessions and creates a new one |
| `get_session_by_token(db, token)` | Finds active, non-expired session |
| `invalidate_session(db, token)` | Marks a session inactive |
 
### `services/app_service.py`
App CRUD and configuration management.
| Function | Purpose |
|----------|---------|
| `create_app(...)` | Create a new app row |
| `get_app(...)` | Load app and enrich bottom bar metadata |
| `list_apps(...)` | Paginated app listing |
| `update_app(...)` | Update app fields |
| `delete_app(...)` | Delete an app and related module refs |
| `update_module_refs(...)` | Add/remove app-module relationships |
| `validate_bottom_bar_config(...)` | Enforce the 5-slot cap and valid module IDs |
| `enrich_bottom_bar_config(...)` | Join config with module metadata |
| `assign_app_to_device(...)` | Bind a device to an app |
 
### `services/device_service.py`
| Function | Purpose |
|----------|---------|
| `register_device(...)` | Create or update device registration |
| `list_devices(...)` | List the user’s devices |
| `assign_app_to_device(...)` | Assign an app to a device |
| `get_device_config(...)` | Build the full mobile config payload |
 
### `services/module_service.py`
| Function | Purpose |
|----------|---------|
| `get_module_usage(...)` | Find apps referencing a module |
| `enable_module(...)` | Enable a module for an app |
| `disable_module(...)` | Disable a module for an app |
| `resolve_legacy_instance_id(...)` | Return the synthetic legacy module instance for agent calls |
 
### `services/version_service.py`
Versioning is the FF4 backbone. It creates checkpoints, resolves publish-time module references, and moves draft state into immutable versions.
 
### `services/validation_service.py`
Validation runs at multiple severities:
- autosave: lightweight shape checks
- checkpoint/version: component/action/data-binding checks
- preview: bottom-bar and launchpad shape checks
- publish: device compatibility, runtime version, schema support
 
### `services/action_registry.py`
The action registry is the server-side whitelist for SDUI and workflow actions.
 
Server-side actions include refresh, form submission, notification updates, calendar CRUD, draft approval/rejection, custom variables, RSS, weather, and workflow execution. Client-only stubs exist so the web admin can display a complete action catalog without accidentally permitting unsafe server execution.
 
### `services/variable_resolver.py`
Supported scopes:
- `user.*`
- `component.*.value`
- `self.value`
- `custom.*`
- `env.*`
- `data.*.*`
- `connection.*.*`
- `date.today`
- `date.now`
 
The important rule: unresolved expressions are intentionally left unresolved so the caller can decide whether that is acceptable.
 
### `services/workflow_engine.py`
React Flow graphs are executed through an APScheduler-backed engine. The graph model supports action, condition, switch, and loop nodes. Execution uses topological ordering plus branch state stored in context.
 
### `services/trigger_engine.py`
Triggers convert stored JSON action chains into executed actions. This is the bridge between event-driven backend state and reusable action execution.
 
### `services/audit.py`
Audit logging is a shared side effect, not a separate subsystem. Many user-facing operations write an audit row in addition to their primary mutation.
 
### `services/component_seed.py`
The component seed keeps the authorable component registry populated at startup. It also encodes backward-compatibility behavior such as legacy `divider`.
 
### `services/template_seed.py`, `variable_seed.py`, `workflow_seed.py`, `calendar_seed.py`, `data_source_seed.py`
These seeders exist to make a fresh backend useful immediately. They are not examples; they are runtime bootstrap inputs and therefore validated at startup.
 
### `services/websocket_manager.py`
Tracks live connections and connection metadata so the admin stats endpoint can report websocket activity.
 
### `services/cleanup_service.py`
Owns admin cleanup preview/execute behavior for test data. It is intentionally separate from the router so cleanup policy can be tested in isolation.
 
---
 
## MCP and external agent integration
 
The external agent story is split into two layers:
 
1. `services/agent_proxy.py` — in-app LLM chat path. This is what the mobile app uses when a user sends a prompt to the embedded assistant.
2. `backend/app/mcp/` — external tool server mounted at `/mcp`. This is what standalone agents use.
 
Both paths share `mcp/tools.py`, which is the real implementation layer.
 
### Current MCP tool surface
- calendar read/write
- notifications
- chat history and assistant message sending
- module state read/write
- form data retrieval
- SDUI screen read/write/delete/list
- tab visibility management
- version checkpoint/list/restore/publish
 
### Why this matters
 
If you are trying to understand “what can the AI actually do?”, the answer is not in one file:
 
- the allowed tool names live in `mcp/server.py`
- the actual logic lives in `mcp/tools.py`
- the in-app agent path reuses the same tool logic through `services/agent_proxy.py`
- SDUI save/apply behavior is shared through `services/sdui_state.py`
 
That is the source of truth, not any single router.
 
---
 
## Test architecture
 
The test suite is intentionally in-process.
 
- `backend/tests/conftest.py` starts the FastAPI app with `httpx.ASGITransport`
- it swaps the database layer to an in-memory SQLite database per test function
- it patches `get_db()` and shared session factories so routers, services, and MCP code all hit the same test DB
- auth fixtures create a first admin user and then log in, so most tests exercise authenticated behavior
 
### What the test tree emphasizes
- SDUI/templates/modules/apps/devices/publishing
- workflows/actions/triggers/variables
- auth/admin/session behavior
- calendar, notifications, todos, data sources
- FF4 migration and regression bundles
 
### What is thinner
- live websocket session coverage
- live MCP integration
- chat and agent_config
- connections
- notes/articles
 
That does not mean those areas are unimportant. It means their confidence is more structural than deeply behavior-driven.
 
---
 
## Reading order for a newcomer
 
If you want the quickest path from “black box” to “I can trace things,” read in this order:
 
1. `backend/app/main.py`
2. `backend/app/config.py`
3. `backend/app/database.py`
4. `backend/app/dependencies.py`
5. `backend/app/models/__init__.py`
6. `backend/app/services/sdui_state.py`
7. `backend/app/services/app_service.py`
8. `backend/app/services/version_service.py`
9. `backend/app/services/validation_service.py`
10. `backend/app/services/workflow_engine.py`
11. `backend/app/mcp/tools.py`
12. `backend/tests/conftest.py`
13. `backend/tests/test_apps.py`
14. `backend/tests/test_templates.py`
15. `backend/tests/test_sdui_parity.py`
16. `backend/tests/test_workflows.py`
 
---
 
## Current counts
 
- Routers: 28
- Schemas: 30
- Services: 22
- Models: 33
- Alembic revisions: 22
 
---
