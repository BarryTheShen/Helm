# Protocol — Communication Layer

## Tier 1: TLDR

The Helm app communicates between frontend and backend using **three channels**:

1. **REST API** (HTTP) — Standard CRUD operations for all data (calendar, notifications, modules, etc.)
2. **WebSocket** (`/ws`) — Real-time bidirectional communication for AI chat streaming and live UI updates
3. **MCP Server** (`/mcp`) — Machine-readable tool interface for external AI agents to interact with Helm

The chat flow: User types message → WebSocket sends to backend → Backend calls LLM → LLM streams tokens back → Backend forwards to frontend via WebSocket token-by-token.

---

## Tier 2: Deeper Explanation

### Channel 1: REST API (HTTP)

Standard HTTP REST endpoints for CRUD operations. All authenticated endpoints require a Bearer token in the `Authorization` header.

**Auth flow:**
```
App                          Backend
 |                              |
 |-- GET /auth/status --------->|  Is server set up?
 |<- {setup_complete: false} ---|
 |                              |
 |-- POST /auth/setup --------->|  Create admin user
 |<- {user_id, message} --------|
 |                              |
 |-- POST /auth/login --------->|  Get session token
 |<- {session_token, ...} ------|
 |                              |
 |-- GET /api/... ------------->|  Authenticated requests
 |   (Authorization: Bearer token)
```

**Response format:**
- Success: JSON body matching the Pydantic response model
- Error: `{"detail": "error message"}` with appropriate HTTP status code
- 401: Token invalid or expired → app triggers logout

### Channel 2: WebSocket (Real-Time)

Connection: `ws://server:8000/ws?token=SESSION_TOKEN`

**Message flow (chat):**
```
App                     Backend                    LLM
 |                         |                         |
 |-- {type: "chat_message",|                         |
 |    content: "..."}----->|                         |
 |                         |-- POST /chat/completions|
 |                         |   (stream: true)------->|
 |<- {type: "chat_start"}--|                         |
 |                         |<- data: {token}---------|
 |<- {type: "chat_token",  |                         |
 |    token: "Hel"}--------|                         |
 |<- {type: "chat_token",  |<- data: {token}---------|
 |    token: "lo"}---------|                         |
 |                         |<- data: [DONE]----------|
 |<- {type: "chat_complete",|                        |
 |    content: "Hello..."}--|                        |
```

**WebSocket message types (Backend → Frontend):**

| Type | Direction | Purpose |
|------|-----------|---------|
| `connected` | B→F | Initial connection confirmation with user_id |
| `pong` | B→F | Heartbeat response |
| `chat_start` | B→F | LLM processing started |
| `chat_token` | B→F | Single streamed token from LLM |
| `chat_complete` | B→F | Full response with complete content |
| `chat_error` | B→F | Error during LLM processing |
| `tool_result` | B→F | MCP tool call result |
| `tool_error` | B→F | MCP tool call failed |
| `notification` | B→F | Push notification |
| `module_state_update` | B→F | SDUI state change for a module |
| `ack` | B→F | Action acknowledged |
| `error` | B→F | Generic error |

**WebSocket message types (Frontend → Backend):**

| Type | Direction | Purpose |
|------|-----------|---------|
| `ping` | F→B | Heartbeat (every 30s) |
| `chat_message` | F→B | Send chat message to AI |
| `module_action` | F→B | Trigger module action |

### Channel 3: MCP Server

Mounted at `/mcp` on the FastAPI app. Uses the MCP (Model Context Protocol) standard for AI agent tool calling.

**Available MCP tools:**

| Tool | Purpose |
|------|---------|
| `helm_read_calendar` | Get events in a date range |
| `helm_create_event` | Create calendar event |
| `helm_update_event` | Update calendar event |
| `helm_delete_event` | Delete calendar event |
| `helm_send_notification` | Send push notification |
| `helm_get_chat_history` | Get recent messages |
| `helm_send_chat_message` | Send message as assistant |
| `helm_update_module_state` | Update SDUI module state |
| `helm_get_form_data` | Get form submission data |

The same tool implementations are shared between:
- The **Agent Proxy** (called directly when the LLM makes tool calls during chat)
- The **MCP Server** (exposed for external AI agents via Streamable HTTP)

### SDUI Protocol

Server-Driven UI payloads are JSON objects following this schema:

```json
{
  "type": "calendar|form|alert|list|card|text|button|image|chart|map",
  "id": "unique-component-id",
  "props": { /* component-specific props */ },
  "children": [ /* nested SDUIComponent objects */ ]
}
```

SDUI state is stored per-user per-module in the `module_states` table and pushed to the frontend via WebSocket `module_state_update` events.

---

## Tier 3: Extensive Detail

### REST API Contract Details

#### Authentication Headers

```
Authorization: Bearer <session_token>
Content-Type: application/json
```

Sessions are stored server-side (not stateless JWT). The token IS a JWT, but validity is checked against the `sessions` table (is_active + expires_at), so tokens can be invalidated server-side.

#### Request/Response Schemas

**Auth Setup:**
```
POST /auth/setup
Request:  {"username": "admin", "password": "strongpassword"}
Response: {"user_id": "uuid", "message": "Setup complete"}
Status:   201 Created (or 409 if already set up)
```

**Auth Login:**
```
POST /auth/login
Request:  {"username": "admin", "password": "pass", "device_id": "uuid", "device_name": "iPhone 15"}
Response: {"session_token": "jwt...", "expires_at": "2026-03-26T...", "user_id": "uuid"}
```

**Calendar Events:**
```
GET /api/calendar/events?start_date=2026-03-01&end_date=2026-03-31
Response: {
  "events": [
    {
      "id": "uuid",
      "title": "Meeting",
      "start_time": "2026-03-25T10:00:00Z",
      "end_time": "2026-03-25T11:00:00Z",
      "description": "...",
      "color": "#007AFF",
      "location": "Room 101",
      "all_day": false,
      "created_at": "2026-03-24T..."
    }
  ]
}

POST /api/calendar/events
Request:  {"title": "Meeting", "start_time": "...", "end_time": "...", "description": "..."}
Response: Same as event object above (201 Created)

PUT /api/calendar/events/{id}
Request:  {"title": "Updated Meeting"} (partial update)
Response: Updated event object

DELETE /api/calendar/events/{id}
Response: {"message": "Event deleted"}
```

**Chat:**
```
GET /api/chat/history?limit=20&offset=0
Response: {
  "messages": [
    {"id": "uuid", "role": "user", "content": "Hello", "created_at": "...", "metadata": null}
  ],
  "has_more": false
}

DELETE /api/chat/history
Response: {"message": "Chat history cleared"}
```

**Notifications:**
```
GET /api/notifications?unread_only=false&limit=50
Response: {
  "notifications": [
    {"id": "uuid", "title": "...", "message": "...", "severity": "info", "is_read": false, "actions": null, "created_at": "..."}
  ],
  "unread_count": 3
}

POST /api/notifications/{id}/read → {"message": "Marked as read"}
POST /api/notifications/read-all  → {"message": "All notifications marked as read"}
```

**Workflows:**
```
GET /api/workflows → [WorkflowResponse, ...]
POST /api/workflows → WorkflowResponse (201)
PUT /api/workflows/{id} → WorkflowResponse
DELETE /api/workflows/{id} → 204 No Content

WorkflowResponse: {
  "id": "uuid",
  "name": "Daily Briefing",
  "trigger_type": "schedule",
  "trigger_config": {"cron": "0 9 * * *"},
  "action_config": {"tool": "send_notification", "args": {"title": "...", "message": "..."}},
  "is_active": true,
  "run_count": 42,
  "last_run_at": "2026-03-25T09:00:00Z"
}
```

**Modules:**
```
GET /api/modules → {"modules": [{"id": "chat", "name": "Chat", "icon": "💬", "enabled": true}, ...]}
GET /api/modules/{id}/state → {"type": "chat", "props": {...}, "version": 0, "updated_at": "..."}
POST /api/modules/{id}/action → {"status": "ok", "module": "...", "action": "..."}
```

**Agent Config:**
```
GET /api/agent/config → {
  "id": "uuid", "provider": "openai", "model": "gpt-4o",
  "api_key_set": true, "base_url": null, "system_prompt": null,
  "temperature": 0.7, "max_tokens": 4096, "is_active": true
}

PUT /api/agent/config
Request: {"model": "gpt-4o-mini", "api_key": "sk-...", "temperature": 0.5}
Response: Updated config (api_key returned as api_key_set boolean)
```

### WebSocket Protocol Details

#### Connection Handshake

1. Frontend opens: `ws://server/ws?token=JWT_TOKEN`
2. Backend validates token against sessions table
3. If invalid: close with code 4001, reason "Unauthorized"
4. If valid: accept connection, send `{"type": "connected", "user_id": "uuid"}`

#### Chat Message Protocol

**Frontend sends:**
```json
{
  "type": "chat_message",
  "content": "What's on my calendar today?"
}
```

**Backend emits sequence:**
```json
{"type": "chat_start", "message_id": "uuid"}
{"type": "chat_token", "message_id": "uuid", "token": "Let"}
{"type": "chat_token", "message_id": "uuid", "token": " me"}
{"type": "chat_token", "message_id": "uuid", "token": " check"}
...
{"type": "chat_complete", "message_id": "uuid", "content": "Let me check your calendar..."}
```

**Tool call during chat:**
```json
{"type": "tool_result", "tool": "read_calendar", "result": [{"title": "Meeting", ...}]}
```

**Error cases:**
```json
{"type": "chat_error", "code": "no_api_key", "message": "No API key configured..."}
{"type": "chat_error", "message": "AI provider returned error 429."}
{"type": "chat_error", "message": "Network error reaching AI provider..."}
```

#### Heartbeat Protocol

- Frontend sends `{"type": "ping"}` every 30 seconds
- Backend responds with `{"type": "pong"}`
- Frontend uses `ReconnectingWebSocket` with max 10 retries, 1-10s backoff

#### Module State Push

When a tool call updates module state:
```json
{
  "type": "module_state_update",
  "module": "calendar",
  "state": {
    "type": "calendar",
    "props": {"events": [...], "view": "month"}
  },
  "version": 5
}
```

### MCP Protocol Details

The MCP server uses **Streamable HTTP** transport (mounted as ASGI sub-app).

Tool calling follows the MCP specification:
1. Agent discovers tools via MCP tool listing
2. Agent calls tool with parameters
3. Backend executes tool function
4. Result returned to agent

**Internal tool dispatch** (Agent Proxy):
```python
# LLM returns tool_calls in streaming response
# Agent proxy parses tool name + args
# Calls execute_tool(name, args, user_id)
# execute_tool dispatches to the correct handler
# Result sent back to user via WebSocket as tool_result
```

### SDUI JSON Schema

```typescript
interface SDUIComponent {
  type: 'calendar' | 'form' | 'alert' | 'list' | 'card' | 'chart' | 'map' | 'text' | 'image' | 'button';
  id: string;
  props: Record<string, any>;
  children?: SDUIComponent[];  // Recursive nesting
}
```

**Calendar props:**
```json
{
  "events": [{"id": "...", "title": "Meeting", "start": "ISO", "end": "ISO", "allDay": false, "color": "#007AFF"}],
  "view": "month"
}
```

**Form props:**
```json
{
  "fields": [{"id": "name", "type": "text", "label": "Name", "placeholder": "...", "required": true}],
  "submitLabel": "Submit"
}
```

**Alert props:**
```json
{
  "severity": "info|warning|error|success",
  "title": "Title",
  "message": "Body text",
  "dismissible": true
}
```

### Known Protocol Issues

1. **No conversation_id support** — Backend agent proxy ignores `conversation_id` when loading history. All messages for a user are in one flat list.

2. **No tool call display** — When the LLM makes tool calls, the frontend logs them to console but doesn’t display anything to the user. The tool calling protocol works backend→LLM but the UI feedback loop is incomplete.

3. **Calendar API query params** — Frontend sends `?start=`/`?end=` but backend expects `?start_date=`/`?end_date=`.
