# Protocol — Communication Layer

> Last updated: 2026-06-18
> This doc explains how Helm clients, the backend, and AI agents talk to each other.
> Read it in this order: mental model → REST (request/response HTTP) → WebSocket → MCP (Model Context Protocol) → SDUI (server-driven UI) schema → legacy notes.

## Read this first

### Source map

| If you are changing... | Read first | Why |
|---|---|---|
| Login, sessions, create/read/update/delete calls, or validation | `backend/app/routers/auth.py`, `backend/app/dependencies.py`, `backend/app/services/auth.py`, `backend/app/routers/modules.py` | These routes own the normal request/response path. |
| Live chat, live screen pushes, or notifications | `backend/app/routers/websocket.py`, `backend/app/services/websocket_manager.py`, `backend/app/services/agent_proxy.py`, `mobile/src/services/websocket.ts`, `mobile/src/utils/validation.ts` | This is the live push channel. |
| What the AI is allowed to do | `backend/app/mcp/server.py`, `backend/app/mcp/tools.py` | This is the MCP tool surface. |
| Screen JSON or renderer mismatches | `backend/app/services/sdui_state.py`, `backend/app/routers/modules.py`, `mobile/src/types/sdui.ts`, `mobile/src/components/sdui/SDUIRenderer.tsx`, `mobile/src/renderer/componentRegistry.ts` | These files define and render SDUI. |
| Button behavior and client actions | `mobile/src/hooks/useActionDispatcher.ts`, `mobile/src/components/composite/InputBar.tsx`, `backend/app/routers/actions.py`, `backend/app/services/action_registry.py` | These files decide what happens after a tap. |
| Version history or publish flows | `backend/app/routers/module_versions.py`, `backend/app/routers/app_versions.py`, `backend/app/routers/modules.py` | These are the preferred current versioning paths. |
| App/device lifecycle or preview broadcasts | `backend/app/routers/apps.py`, `backend/app/routers/devices.py`, `backend/app/routers/app_versions.py`, `backend/app/routers/module_instances.py`, `backend/app/services/websocket_manager.py` | These routes own `app_config_update`, `device_app_assigned`, `preview_session_started`, `preview_session_ended`, and related push events. |

For broader architecture context, start with [backend.md](backend.md) and [frontend.md](frontend.md), then use this file for the wire-level contracts and message shapes.

### Where the files live

| Folder | What lives there | Why you read it |
|---|---|---|
| `backend/app/routers/` | HTTP endpoints, WebSocket entry points, version routes, editor routes | This is the transport layer for REST and WS. |
| `backend/app/services/` | Business rules, SDUI normalization, websocket broadcasting, agent proxy, action registry | This is where the actual backend behavior lives. |
| `backend/app/mcp/` | MCP server entry point and tool implementations | This is the AI tool surface. |
| `mobile/src/services/` | API client and shared WebSocket client | This shows how the app talks to the backend. |
| `mobile/src/types/` | Shared TypeScript contracts | This is the app-side definition of SDUI and action shapes. |
| `mobile/src/components/sdui/` and `mobile/src/renderer/` | SDUI renderer and component registry | This is how SDUI JSON becomes native UI. |
| `mobile/src/hooks/` | Action dispatcher, screen hooks, and related helpers | This is where taps and live updates become behavior. |

### Current surface size

- WebSocket: **27** named message types emitted in current backend code paths
- MCP: **39** tools
- SDUI action schema: **21** action variants
- Server action registry: **34** registered backend functions
- SDUI shapes: **2** accepted screen shapes — legacy V1 sections and preferred V2 rows

## Tier 1: Mental model

Helm uses four communication patterns:

| Channel | Who talks to whom | Why it exists |
|---|---|---|
| REST (request/response HTTP) | Mobile app and web admin → FastAPI | One-shot requests: login, lists, create/read/update/delete, validation, versioning. |
| WebSocket | Mobile app and web admin ↔ FastAPI | Live updates: chat tokens, pushed notifications, screen refreshes, publish events. |
| MCP (Model Context Protocol) | External AI clients → Helm tool layer | Safe tool calls for the model instead of raw DB or raw URLs. |
| SDUI (server-driven UI) | Backend → mobile renderer | Screen layout as JSON so the app can draw native UI. |

Plain-English version:

- The **app** talks to the **backend** over REST when it needs a single answer now.
- The **app** keeps **one shared WebSocket** open so the backend can push things later.
- The **AI agent** uses **MCP (Model Context Protocol)** to call named tools.
- The **backend** sends **SDUI (server-driven UI)** JSON when it wants the app to render a screen.
- The **mobile app never talks to MCP directly**.

The backend normalizes SDUI before it stores or serves it, so the app sees a stable contract even when the model output was messy.

## Tier 2: Channel-by-channel contracts

### 1) REST: request/response HTTP

REST is for ordinary backend work: login, saving data, validating a screen, publishing a version, or fetching a list.

**Auth rule:** every authenticated request uses `Authorization: Bearer <session_token>`.

**Error shape:** HTTP errors return `{"detail": "..."}` with the right status code. A `401` means the token is bad or expired and the client should log out.

#### Identity and session routes

| Route | Who uses it | What it does |
|---|---|---|
| `GET /auth/status` | App setup flow | Checks whether the server is already bootstrapped. |
| `POST /auth/setup` | First-run admin bootstrap | Creates the first admin user. |
| `POST /auth/login` | Login screen | Returns the session token and user info. |
| `POST /auth/refresh` | App session refresh | Reissues the current session token. |
| `POST /auth/logout` | Sign-out flow | Invalidates the current session. |

#### Action bridge routes

| Route | Who uses it | What it does |
|---|---|---|
| `POST /api/actions/execute` | SDUI `server_action` and form submits | Runs a whitelisted backend function by name. |
| `GET /api/actions/functions` | Admin/debug and tooling | Lists the allowed backend function names. |

The action bridge is the preferred way to make the backend do work from SDUI. The old direct-URL escape hatch still exists, but new content should prefer named functions.

#### SDUI editing and readback routes

| Route | Who uses it | What it does |
|---|---|---|
| `GET /api/sdui/{module_id}` | App and editor | Reads the current live SDUI screen. |
| `GET /api/sdui/{module_id}/draft` | App and editor | Reads the pending draft, if one exists. |
| `POST /api/sdui/{module_id}` | Editor and legacy screen-save path | Saves a screen as a draft by default. |
| `DELETE /api/sdui/{module_id}` | Editor and legacy screen-clear path | Clears the live screen and its draft. |
| `POST /api/sdui/validate` | Editor | Checks a screen before saving it. |
| `GET /api/sdui/modules` | Web admin editor | Lists modules and whether each one has an SDUI screen. |
| `POST /api/sdui/modules` | Web admin editor | Creates a custom module. |
| `DELETE /api/sdui/modules/{module_id}` | Web admin editor | Deletes a custom module. |

#### SDUI config and legacy draft routes

| Route | Who uses it | What it does |
|---|---|---|
| `GET /api/sdui/{module_id}/config` | Editor | Reads module config, including `auto_approve_drafts`. |
| `POST /api/sdui/{module_id}/config` | Editor | Updates module config, including `auto_approve_drafts`. |
| `POST /api/sdui/{module_id}/draft/approve` | Legacy editor flow | Promotes a saved draft to live. |
| `POST /api/sdui/{module_id}/draft/reject` | Legacy editor flow | Discards a saved draft. |

#### Versioning and preview routes

| Route | Who uses it | What it does |
|---|---|---|
| `POST /api/modules/{module_id}/checkpoints` | Versioned module flow | Saves a version checkpoint from the draft or live screen. |
| `GET /api/modules/{module_id}/versions` | Versioned module flow | Lists version history. |
| `POST /api/modules/{module_id}/versions/{version_id}/restore-to-draft` | Versioned module flow | Restores an old version into the working draft. |
| `POST /api/modules/{module_id}/versions/{version_id}/publish` | Versioned module flow | Publishes a version as the live screen. |
| `POST /api/apps/{app_id}/checkpoints` | App versioning flow | Saves a checkpoint for the app config. |
| `GET /api/apps/{app_id}/versions` | App versioning flow | Lists app version history. |
| `POST /api/apps/{app_id}/versions/{version_id}/publish` | App release flow | Publishes a version to assigned devices. |
| `POST /api/apps/{app_id}/preview/web` | Web preview | Starts a browser preview session. |
| `POST /api/apps/{app_id}/preview/device` | Mobile preview | Starts a device preview session. |

#### User-content routes that pair with WebSocket updates

| Route | Who uses it | What it does |
|---|---|---|
| `GET /api/notifications` | Notification tab | Reads persisted notifications. |
| `POST /api/notifications/{notification_id}/read` | Notification tab | Marks a notification read. |

#### REST mental model

Use REST when you want:

- a simple request with a single response,
- a stable URL for create/read/update/delete work,
- validation before storage,
- or a publish/version action that should complete once and return.

### 2) WebSocket: live push channel

WebSocket is the live line between the backend and connected clients. The mobile app keeps one shared connection for the whole session, and the backend fans messages out to all of a user’s connected devices.

**Connection URL:** `ws://host/ws?token=<session_token>&device_id=<optional>`

- `token` is required.
- `device_id` is optional; if it is missing, the backend falls back to the session’s device.

The mobile client validates incoming messages but keeps unknown fields, so adding a new field is usually a backward-compatible change.

#### Client → server messages

| Message | Why the client sends it |
|---|---|
| `ping` | Heartbeat. The server answers with `pong`. |
| `chat_message` | Starts an AI chat turn. |
| `module_action` | Legacy action bridge for older clients that still send actions over WebSocket. |

`module_action` is still supported, but new code should prefer REST `POST /api/actions/execute` for server-side actions.

#### Server → client message groups

| Category | Message names | What they are for |
|---|---|---|
| Connection and heartbeat | `connected`, `pong`, `error` | Connection success, heartbeat reply, and malformed-message feedback. |
| Chat stream | `chat_start`, `chat_token`, `chat_message_replace`, `chat_complete`, `chat_error` | Live assistant output, including token streaming and final completion. |
| Tool and action feedback | `tool_result`, `tool_error`, `action_result`, `action_error` | Tool execution and named action execution results. |
| SDUI and navigation | `sdui_screen_update`, `sdui_draft_update`, `sdui_draft_rejected`, `tabs_updated`, `module_state_update` | Screen refreshes and nav/state changes. `module_state_update` is legacy. |
| Notifications and app/device state | `notification`, `app_config_update`, `app_version_published`, `preview_session_started`, `preview_session_ended`, `device_app_assigned`, `module.installed`, `module.uninstalled`, `data_update` | Push notifications, app config changes, app release events, previews, and module/device lifecycle events. |

#### Chat flow in plain English

1. The user sends `chat_message`.
2. The backend saves the user message.
3. The agent proxy streams `chat_start` and `chat_token` messages back.
4. If the model uses tools, the backend emits `tool_result` or `tool_error`.
5. The backend ends the turn with `chat_complete`.

`chat_message_replace` is a cleanup message used when the backend rewrites the streamed text after tool-call stripping.

#### WebSocket mental model

Use WebSocket when the backend must push something later:

- chat tokens while the model is still thinking,
- notifications as soon as they are created,
- SDUI changes without polling,
- publish or preview events,
- or tab/module updates that should appear instantly.

### 3) MCP (Model Context Protocol): AI tool interface

MCP is how external AI clients call Helm safely. They do not send raw SQL or raw REST calls; they call named tools on the `/mcp` endpoint.

**Endpoint:** `/mcp` using Streamable HTTP

**Auth:** `Authorization: Bearer <token>`

**Extra request scope:** the MCP middleware also reads `X-Module-Instance-Id` when a call should be scoped to a specific installed module.

The same backend tool implementations are reused by the in-app agent stack and by external MCP clients.

#### Current tool groups

- **Calendar tools**
  - `helm_read_calendar`
  - `helm_read_all_calendar`
  - `helm_create_event`
  - `helm_update_event`
  - `helm_delete_event`
  - `helm_delete_all_events`

- **Notifications and chat tools**
  - `helm_send_notification`
  - `helm_get_chat_history`
  - `helm_send_chat_message`
  - `helm_update_module_state`
  - `helm_get_form_data`

- **SDUI screen tools**
  - `helm_set_screen`
  - `helm_delete_screen`
  - `helm_list_screens`
  - `helm_get_screen`
  - `helm_get_draft`
  - `helm_approve_draft`
  - `helm_reject_draft`

- **Versioning tools**
  - `helm_create_checkpoint`
  - `helm_list_module_versions`
  - `helm_restore_version`
  - `helm_publish_version`
  - `helm_list_app_versions`
  - `helm_restore_app_version`
  - `helm_publish_app`
  - `helm_list_template_versions`
  - `helm_create_template_checkpoint`

- **Tab and app management tools**
  - `helm_hide_tab`
  - `helm_show_tab`
  - `helm_rename_tab`
  - `helm_list_tabs`
  - `helm_list_apps`
  - `helm_create_app`
  - `helm_get_app`

- **Preview and device tools**
  - `helm_start_app_preview`
  - `helm_exit_preview`
  - `helm_start_device_preview`
  - `helm_exit_device_preview`
  - `helm_get_device_status`

#### Preferred MCP flows

- For calendar reads, prefer `helm_read_calendar` when you know the date range.
- Use `helm_read_all_calendar` only when you really need everything.
- Use `helm_delete_all_events` instead of looping `helm_delete_event`.
- `helm_send_notification` is for pushed notifications that should also persist.
- `helm_send_chat_message` is for proactive assistant messages.
- `helm_set_screen` saves a draft by default.
- For versioned modules, prefer `helm_set_screen` → `helm_create_checkpoint` → `helm_publish_version`.
- For tab-based compatibility flows, `helm_approve_draft` and `helm_reject_draft` still exist.

#### MCP mental model

Use MCP when the model needs to *act* on Helm data, not just chat about it. If a human user is driving the UI, REST and WebSocket are the main channels. If an AI agent is driving a backend action, MCP is the safe path.

### 4) SDUI (server-driven UI): screen JSON contract

SDUI is the JSON that tells the app what to draw. The backend does not send HTML; it sends structured screen data, and the app renders native components.

#### Two accepted screen shapes

| Shape | Status | Required top-level shape | Notes |
|---|---|---|---|
| `SDUIScreen` | Legacy, still supported | `sections[]` with `component` or `components` | The older section-based shape. Keep it for compatibility only. |
| `SDUIPage` | Preferred | `rows[]` | The current row-first shape. New authored content should use this. |

A stored V2 payload may omit some metadata such as `schema_version`, `module_id`, `title`, or `generated_at`. The backend/editor/runtime can add those later.

#### Row-first V2 rules

- `rows` is the shape discriminator.
- Each row owns one layout strip.
- Each cell owns one component.
- `compact` applies to phone layouts.
- `regular` applies to tablet layouts.
- `scrollable: true` creates a horizontal rail.
- Prefer `width: 'auto'` or percentage strings like `'50%'`.
- Numeric flex weights still round-trip for older content, but they are legacy.

#### Canonical V2 component families

| Family | Canonical types | Legacy notes |
|---|---|---|
| Atomic | `Text`, `Button`, `Image`, `Icon` | Canonical names are PascalCase. |
| Structural | `Container`, `Empty` | `Container` may nest children; `Empty` is a layout shell. |
| Composite | `CalendarModule`, `ChatModule`, `NotesModule`, `InputBar` | These are black-box widgets. |
| Shared widgets | `Badge`, `Stat`, `List`, `Alert`, `Todo`, `TodoModule`, `RichText`, `RichTextRenderer`, `ArticleCard`, `ArticleCardModule` | Lower-case aliases still round-trip. New content should use the PascalCase names. |

Legacy aliases that still normalize include names like `markdown` → `Text`, `input_bar` → `InputBar`, `rich_text_renderer` → `RichText`, `article_card` → `ArticleCard`, and older lower-case component names such as `text`, `button`, `image`, `calendar`, `chat`, and `notes`.

`divider`/`Divider` is compatibility-only in old content. New V2 screens should use row-level divider behavior instead of authoring a separate divider component.

#### SDUI action contract

| Action family | Current action types | Preferred notes |
|---|---|---|
| Client-only | `navigate`, `go_back`, `dismiss`, `open_url`, `copy_text`, `show_notification`, `show_alert`, `haptic`, `share`, `toggle`, `set_component_state`, `refresh_data` | These stay on the device unless they need a server fetch. |
| Server-backed | `server_action`, `submit_form`, `set_variable` | Preferred path for work that must hit the backend. |
| Legacy server bridge | `api_call`, `send_to_agent` | Supported for compatibility, but new content should avoid them. |
| Flow control | `chain`, `conditional`, `delay` | Used to compose or delay other actions. |
| Reserved / shell only | `open_sheet` | Currently a dispatcher placeholder. Do not rely on it for new flows. |

The current `server_action` bridge uses the backend action registry whitelist at `backend/app/services/action_registry.py`. The client posts the named function to `/api/actions/execute`, and the backend only runs registered names.

`InputBar` and other input-driven components replace `{{input}}` before dispatching `send_to_agent` or `server_action`. If there is no placeholder, the runtime falls back to the raw input value.

#### SDUI storage and normalization

- `backend/app/services/sdui_state.py` normalizes screens before storage and before readback.
- Legacy `sections[]` payloads can be converted into `rows[]`.
- Flat model output is rewritten into `props` bags so the frontend renderer sees one consistent shape.
- The backend keeps draft and live screen rows separate so previews do not overwrite published content.

## Tier 3: Legacy vs preferred at a glance

| Prefer now | Keep only for compatibility |
|---|---|
| `rows[]` V2 screens | `sections[]` V1 screens |
| PascalCase component names | Lower-case aliases and older component names |
| `server_action` through `/api/actions/execute` | `api_call` and `send_to_agent` |
| `helm_create_checkpoint` → `helm_publish_version` | `helm_approve_draft` / `helm_reject_draft` for tab-based legacy drafts |
| `sdui_screen_update` / `sdui_draft_update` | `module_state_update` |
| Versioned module/app routes | Direct draft-only screen flows when version history matters |

## Common flows

| Scenario | Who talks to whom | Expected path |
|---|---|---|
| User logs in | Mobile app → REST → backend | `POST /auth/login` returns a session token. |
| User chats with the AI | Mobile app → WebSocket → backend agent proxy → model → WebSocket | `chat_message` starts the turn; tokens stream back live. |
| AI changes a screen | AI client → MCP → backend → WebSocket → app | `helm_set_screen` stores the draft and pushes an update. |
| User taps a server-backed button | Component → client dispatcher → REST → backend | `server_action` runs a whitelisted backend function. |
| User previews or publishes a version | Editor or AI client → REST/MCP → backend → WebSocket | Version routes publish the result and notify devices. |

## Quick reminders

- REST is for one request and one answer.
- WebSocket is for live updates.
- MCP is for AI tool calls.
- SDUI is for screen JSON.
- New work should prefer row-first V2 screens, named backend actions, and versioned publish flows.
- Legacy paths remain only so old content can still run.
