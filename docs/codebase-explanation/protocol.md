# Protocol — Communication Layer

> Last updated: 2026-04-14

## Tier 1: TLDR

Helm communicates between frontend and backend using **three channels**:

1. **REST API** (HTTP) — Standard CRUD operations for all data
2. **WebSocket** (`/ws`) — Real-time bidirectional communication for AI chat streaming and live UI updates
3. **MCP Server** (`/mcp`) — Machine-readable tool interface for external AI agents

The chat flow: User types → WebSocket → backend → LLM streams tokens → WS tokens to frontend.
The SDUI flow: Agent calls `helm_set_screen` → WS draft notification → user approves → live screen.

---

## Tier 2: Deeper Explanation

### Channel 1: REST API (HTTP)

All authenticated endpoints require `Authorization: Bearer <session_token>`.

**Auth flow:**
```
App                          Backend
 |-- GET /auth/status ------> Is server set up?
 |<- {setup_complete: false}
 |
 |-- POST /auth/setup ------> Create admin user (first time only)
 |<- {user_id, message}
 |
 |-- POST /auth/login ------> Get session token
 |<- {session_token, expires_at, user_id, username}
 |
 |-- GET /api/... ----------> Authenticated requests
 |   Authorization: Bearer <token>
```

**Response format:**
- Success: JSON body matching the Pydantic schema
- Error: `{"detail": "error message"}` with HTTP status code
- 401: Token invalid/expired → app triggers logout

### Channel 2: WebSocket (Real-Time)

**Connection:** `ws://server:8000/ws?token=SESSION_TOKEN&device_id=OPTIONAL`

**Chat flow:**
```
App                     Backend                    LLM
 |-- {type:"chat_message", content:"..."} -------->
 |                        |-- POST /chat/completions (stream:true) -->
 |<-- {type:"chat_start"} |
 |<-- {type:"chat_token", token:"Hel"} <-- data:{delta} --
 |<-- {type:"chat_token", token:"lo"}  <-- data:{delta} --
 |                        |<-- data:[DONE] --------------------
 |<-- {type:"chat_complete", content:"Hello..."} --
```

**Tool call flow:**
```
 |<-- {type:"chat_start"}
 |<-- {type:"chat_token", token:"Let me check..."}
 | [LLM emits tool_call delta in stream]
 | [backend executes tool()...]
 |<-- {type:"tool_result", tool:"read_calendar", result:{...}}
 | [backend calls LLM again with tool result...]
 |<-- {type:"chat_token", token:"You have 2 events..."}
 |<-- {type:"chat_complete"}
```

**SDUI draft flow:**
```
 [Agent calls helm_set_screen (draft=True)]
 |<-- {type:"sdui_draft_update", module_id:"home", screen:{...}, version:N}
 | [User sees DraftPreview in app]
 | [User taps Approve]
 |-- POST /api/actions/execute {function:"approve_draft"} -->
 |<-- {type:"sdui_draft_update", module_id:"home", screen:null, version:0}
 |<-- {type:"sdui_draft_rejected", module_id:"home"}   // legacy companion clear event
 |<-- {type:"sdui_screen_update", module_id:"home", screen:{...}, version:N}
```

### WebSocket Message Reference (Server → Client)

| `type` | Payload | When |
|--------|---------|------|
| `connected` | `{user_id, device_id}` | On connection accepted |
| `pong` | — | After `ping` |
| `chat_start` | `{message_id}` | AI begins responding |
| `chat_token` | `{message_id, token}` | Each streamed text delta |
| `chat_message_replace` | `{message_id, content}` | After XML tool call stripping |
| `chat_complete` | `{message_id, content}` | Full response done, persisted to DB |
| `chat_error` | `{message?, code?}` | Error; `code: "no_api_key"` if unconfigured |
| `notification` | `{id?, title, message, severity, actions?, timestamp?}` | Push notification |
| `sdui_screen_update` | `{module_id, screen, version}` | Live SDUI screen set (or null to clear) |
| `sdui_draft_update` | `{module_id, screen, version}` | Draft ready for approval, or draft cleared when `screen=null` and `version=0` |
| `sdui_draft_rejected` | `{module_id}` | Legacy companion event when a draft is rejected or cleared |
| `tabs_updated` | `{modules: [...]}` | Tab visibility changed |
| `module_state_update` | `{module, state, version}` | Module state changed (legacy) |
| `tool_result` | `{tool, result}` | Tool call succeeded |
| `tool_error` | `{tool, message}` | Tool call failed |
| `action_result` | `{ref?, result}` | `module_action` action completed |
| `action_error` | `{ref?, message}` | `module_action` action failed |

### WebSocket Message Reference (Client → Server)

| `type` | Payload | Action |
|--------|---------|--------|
| `ping` | — | Server replies `{type: "pong"}` |
| `chat_message` | `{content, conversation_id}` | Starts AI response (async background task) |
| `module_action` | `{function, params, ref?}` | Executes named action from registry |

### Channel 3: MCP Server (`/mcp`)

Mounted at `/mcp` on the FastAPI app. Uses FastMCP (Streamable HTTP). All requests must include `Authorization: Bearer <token>`.

#### Complete MCP Tool Reference

| Tool | Parameters | Purpose |
|------|-----------|---------|
| `helm_read_calendar` | `start_date: str`, `end_date: str` (YYYY-MM-DD) | Get events in date range |
| `helm_create_event` | `title, start_time, end_time, description?, color?, location?` | Create event |
| `helm_update_event` | `event_id, title?, start_time?, end_time?, description?, color?, location?` | Partial update event |
| `helm_delete_event` | `event_id: str` | Delete one event |
| `helm_delete_all_events` | — | Bulk delete all events for user |
| `helm_read_all_calendar` | — | Get all events (no date filter) |
| `helm_send_notification` | `title: str`, `message: str`, `severity: str = "info"` | Save notification + push to app |
| `helm_get_chat_history` | `limit: int = 20` | Get recent chat messages |
| `helm_send_chat_message` | `content: str` | Send message as assistant + push `chat_complete` event |
| `helm_update_module_state` | `module_type: str`, `state: dict` | Update module state key |
| `helm_get_form_data` | `form_id: str = ""` | Get form submission data |
| `helm_set_screen` | `module_id: str`, `screen: dict\|str` | Set SDUI screen; draft=True by default; canonical row-first authoring uses PascalCase V2 types, while preserved lowercase legacy runtime component types can round-trip when already present in a payload |
| `helm_delete_screen` | `module_id: str` | Clear SDUI screen → empty state |
| `helm_list_screens` | — | List all AI-set SDUI screens |
| `helm_get_screen` | `module_id: str` | Get current SDUI JSON for a module |
| `helm_get_draft` | `module_id: str` | Get pending draft screen for a module; returns `{screen, version, has_draft}` |
| `helm_approve_draft` | `module_id: str` | Promote draft to live via the shared live persistence helper |
| `helm_reject_draft` | `module_id: str`, `feedback?: str` | Discard pending draft with optional feedback |
| `helm_hide_tab` | `tab_id: str` | Hide a nav-bar tab |
| `helm_show_tab` | `tab_id: str` | Restore hidden tab |
| `helm_rename_tab` | `tab_id: str`, `name?: str`, `icon?: str` | Rename a tab and/or change its emoji icon |
| `helm_list_tabs` | — | List all tabs + visibility status |

**Valid `module_id` values (built-in):** `home`, `chat`, `calendar`, `forms`, `alerts`, `modules`, `settings` — plus any user-created custom module IDs (slug-based, e.g. `my-module`)

**Module CRUD endpoints:**
| Tool | Parameters | Purpose |
|------|-----------|--------|
| `POST /api/sdui/modules` | `{name: str, icon: str}` | Create a custom module; returns the new module with generated slug ID and `is_custom: true` |
| `DELETE /api/sdui/modules/{module_id}` | — | Delete a custom module (built-in modules cannot be deleted); cleans up associated SDUI data |

**`GET /api/sdui/modules` response** now includes `is_custom: boolean` for each module entry.

**Valid `tab_id` values:** same as module IDs above

**Note:** The same tools are used internally by the Agent Proxy when the LLM makes tool calls during chat, and externally by any MCP-compatible client. Logic lives in `backend/app/mcp/tools.py`.

---

## Tier 3: SDUI Schema Reference

### V1 Schema (legacy, still supported)

```json
{
  "schema_version": 1,
  "sections": [
    {
      "id": "section-id",
      "title": "Optional Section Title",
      "component": {
        "type": "text",
        "id": "component-id",
        "props": {
          "content": "Hello world",
          "style": "body"
        }
      }
    }
  ]
}
```

**V1 component types:** `text`, `heading`, `button`, `icon_button`, `divider`, `spacer`, `card`, `container`, `list`, `form`, `alert`, `badge`, `stat`, `stats_row`, `calendar`, `image`, `progress`

**V1 action types:** `navigate`, `go_back`, `open_url`, `copy_text`, `server_action`, `send_to_agent`, `dismiss`, `toggle`

### V2 Schema (preferred — row+cell layout)

```json
{
  "rows": [
    {
      "id": "row-1",
      "cells": [
        {
          "id": "cell-1",
          "width": 1,
          "content": {
            "type": "Text",
            "props": {
              "content": "Good morning!",
              "variant": "heading"
            }
          }
        }
      ],
      "compact": { "direction": "column", "gap": 8 },
      "regular": { "direction": "row", "gap": 16 },
      "scrollable": false,
      "backgroundColor": "#FFFFFF",
      "padding": 16
    }
  ]
}
```

Persisted V2 payloads are row-first. `rows` is the required shape discriminator; `schema_version`, `module_id`, and `title` may be omitted on stored payloads and added later by editor/runtime layers. New authored content should still use PascalCase V2 types, but server validation also permits preserved lowercase legacy runtime component types so existing live screens can round-trip.

**V2 component types (PascalCase):** `Text`, `Markdown`, `Button`, `Image`, `TextInput`, `Icon`, `Divider`, `Container`, `CalendarModule`, `ChatModule`, `NotesModule`, `InputBar`

**V2 cell `width`:** numeric weight for flex proportion in standard rows, or fixed card-rail width scaling in scrollable rows; `"auto"` behaves like natural/fill width in non-scrollable rows

**V2 row responsive behavior:**
- `compact` props → applied on screens < 768px wide
- `regular` props → applied on screens ≥ 768px wide
- If `scrollable: true` → horizontal card rail with fixed-width cells sized from each cell's numeric `width`, matching the editor preview instead of flex paging

**V2 spacing notes:**
- Rows may use `paddingTop`, `paddingBottom`, `paddingLeft`, and `paddingRight`; runtimes fall back to `padding` when a side-specific value is omitted
- `Divider` may include both `indent` and `margin`

**V2 action types:** `navigate`, `api_call`, `server_action`, `dismiss`, `copy_text`, `open_url`

### SDUI Action Reference

| Action type | Required fields | Effect |
|-------------|----------------|--------|
| `navigate` | `screen: string` | Navigate to a tab or route |
| `go_back` | — | Navigate back |
| `open_url` | `url: string` | Open URL in browser (http/https/mailto/tel only) |
| `copy_text` | `text: string` | Copy string to clipboard |
| `server_action` | `function: string`, `params?: object` | `POST /api/actions/execute` |
| `send_to_agent` | `message: string` | Send message via WS + navigate to chat |
| `dismiss` | — | Navigate back |
| `api_call` | `method, path, body?` | Direct API call (legacy) |

When `TextInput.onSubmit` or `InputBar.onSend` triggers `send_to_agent` or `server_action`, `{{input}}` placeholders inside the message or params template are replaced with the submitted text. If no placeholder is present, the runtime falls back to the raw input for `send_to_agent` and to `params.text = input` for `server_action`.

### SDUI `server_action` Function Reference

These are the registered functions callable via `server_action`:

| Function | Params | Effect |
|----------|--------|--------|
| `refresh_data` | `{module_id}` | Re-broadcasts SDUI screen for module |
| `submit_form` | `{form_id, data}` | Saves form submission, sends notification |
| `send_to_agent` | `{message}` | Fires chat message to AI |
| `mark_notification_read` | `{notification_id}` | Marks notification read |
| `create_calendar_event` | `{title, start_time, end_time, ...}` | Creates calendar event |
| `delete_calendar_event` | `{event_id}` | Deletes calendar event |
| `approve_draft` | `{module_id}` | Promotes SDUI draft to live |
| `reject_draft` | `{module_id, feedback?}` | Discards SDUI draft |
| `set_variable` | `{name, value, type?}` | Upserts a CustomVariable by user + name |

**Client-only action stubs (16):** `navigate`, `go_back`, `open_url`, `open_sheet`, `dismiss`, `server_action`, `set_component_state`, `toggle`, `show_notification`, `show_alert`, `haptic`, `share`, `copy_text`, `delay`, `chain`, `conditional` — acknowledged by backend but executed on client.

### Trigger Definitions (`/api/triggers`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/triggers` | ✅ | List user’s trigger definitions; paginated |
| POST | `/api/triggers` | ✅ | Create trigger `{name, trigger_type, config_json, action_chain_json, enabled}` |
| PUT | `/api/triggers/{id}` | ✅ | Update trigger (partial) |
| DELETE | `/api/triggers/{id}` | ✅ 204 | Delete trigger |
| POST | `/api/triggers/{id}/test` | ✅ | Manually fire — runs action chain via `fire_trigger()` |

**Trigger types:** `schedule`, `data_change`, `server_event`

**`action_chain_json` format:** JSON array of action steps: `[{"type": "<action_name>", "params": {...}}, ...]`

### Variable Expression Format

Template strings use `{{expression}}` mustache syntax. Resolved both server-side (`variable_resolver.py`) and client-side (`variableResolver.ts`).

| Scope | Pattern | Source |
|-------|---------|--------|
| `user` | `{{user.name}}`, `{{user.id}}` | Current user |
| `component` | `{{component.<id>.value}}` | Component state |
| `self` | `{{self.value}}` | Current component shorthand |
| `custom` | `{{custom.<name>}}` | CustomVariable record |
| `env` | `{{env.<key>}}` | Environment variables |
| `data` | `{{data.<source>.<field>}}` | Data source cache |

Unresolved expressions are left as-is `{{original}}`. `{{input}}` is a backward-compat alias for `{{self.value}}`.

---

## REST API Contract Details

### Authentication headers

```http
Authorization: Bearer <session_token>
Content-Type: application/json
```

### Pydantic schema quick reference

**`POST /auth/login` body:**
```json
{
  "username": "alice",
  "password": "secret",
  "device_id": "web",
  "device_name": "Web Browser"
}
```

**`POST /auth/login` response:**
```json
{
  "session_token": "eyJ...",
  "expires_at": "2026-04-30T12:00:00Z",
  "user_id": "uuid",
  "username": "alice"
}
```

**`POST /api/calendar/events` body:**
```json
{
  "title": "Team Standup",
  "start_time": "2026-03-30T09:00:00Z",
  "end_time": "2026-03-30T09:30:00Z",
  "description": null,
  "color": "#007AFF",
  "location": null,
  "all_day": false
}
```

**`GET /api/notifications` response:**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "title": "Hello",
      "message": "World",
      "severity": "info",
      "is_read": false,
      "actions": null,
      "created_at": "2026-03-30T12:00:00Z"
    }
  ],
  "unread_count": 1
}
```

**`POST /api/actions/execute` body:**
```json
{
  "function": "approve_draft",
  "params": { "module_id": "home" }
}
```

**`GET /api/sdui/{module_id}` response:**
```json
{
  "screen": { "schema_version": "1.0.0", "module_id": "home", "rows": [...] },
  "version": 3
}
```
Returns `{"screen": null, "version": 0}` if no screen set.

**`GET /api/sdui/{module_id}/draft` response:**
```json
{
  "screen": { "rows": [...] },
  "version": 4,
  "has_draft": true
}
```
This response is normalized to the same client-facing shape used by live screens; it does not return raw stored JSON.

Returns `{"screen": null, "version": 0, "has_draft": false}` if no draft.
