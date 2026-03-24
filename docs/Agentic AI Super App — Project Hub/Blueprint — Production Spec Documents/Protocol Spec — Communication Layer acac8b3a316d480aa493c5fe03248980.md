# Protocol Spec — Communication Layer

<aside>
📋

**Instructional Header**

This is the Protocol Specification for the Agentic AI Super App. It defines how the three layers communicate: iOS app ↔ Backend Server ↔ External AI Agent. There are three communication channels, each with a different protocol.

**For the vibe coding agent:** This spec defines message formats and contracts between layers. Implement these after the Backend and before the Frontend.

</aside>

---

## 1. Communication Overview

Three channels, three protocols:

```
┌───────────┐    WebSocket     ┌──────────────┐    OpenAI API    ┌──────────────┐
│  iOS App  │ ◄════════════► │   Backend    │ ═══════════════► │  AI Agent    │
│           │   Channel 1     │   Server     │   Channel 2      │  (external)  │
│           │                 │              │                  │              │
│           │    REST API     │   MCP Server │ ◄═══════════════ │              │
│           │ ───────────── ► │   (built-in) │   Channel 3      │  Calls tools │
│           │   (pull refresh)│              │   (MCP)          │              │
└───────────┘                 └──────────────┘                  └──────────────┘
```

| Channel | Direction | Protocol | Purpose |
| --- | --- | --- | --- |
| 1 | iOS ↔ Backend | WebSocket + REST | Chat streaming, UI state, user actions |
| 2 | Backend → Agent | OpenAI-compatible HTTP API | Forward user messages, receive responses |
| 3 | Agent → Backend | MCP (Streamable HTTP) | Agent calls tools to modify data/UI |

---

## 2. Channel 1 — iOS App ↔ Backend Server

Two sub-protocols:

- **WebSocket** for real-time chat
- **REST API** for everything else (pull-to-refresh, form submissions, settings)

### 2.1 WebSocket Protocol

**Connection URL:** `wss://{server}/ws?token={sessionToken}&device={deviceId}`

**Auth:** Token validated on connection. Invalid token → close with code 4001 + reason "Invalid token".

**Heartbeat:** Client sends `ping` every 30 seconds. Server responds with `pong` within 10 seconds. If no pong, client considers connection dead and reconnects.

**Reconnection:** Exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s (max). Reset backoff on successful connection.

### WebSocket Message Schema

All messages are JSON with a required `type` field.

#### Client → Server Messages

**`chat_message`** — User sends a chat message

```json
{
  "type": "chat_message",
  "id": "client_msg_uuid",
  "content": "What's on my calendar today?",
  "timestamp": "2026-03-23T10:00:00+08:00"
}
```

**`ping`** — Heartbeat

```json
{ "type": "ping" }
```

**`typing_start`** — User started typing (optional, for UX)

```json
{ "type": "typing_start" }
```

**`typing_stop`** — User stopped typing

```json
{ "type": "typing_stop" }
```

#### Server → Client Messages

**`connected`** — Connection established successfully

```json
{
  "type": "connected",
  "userId": "uuid",
  "deviceId": "uuid",
  "serverVersion": "1.0.0"
}
```

**`chat_token`** — Streaming response token (sent repeatedly during generation)

```json
{
  "type": "chat_token",
  "messageId": "msg_uuid",
  "token": "Here's",
  "index": 0
}
```

The client appends each token to build the complete message. `index` is the sequential position for ordering.

**`chat_complete`** — Streaming finished, here's the final message

```json
{
  "type": "chat_complete",
  "messageId": "msg_uuid",
  "role": "assistant",
  "content": "Here's your schedule for today:",
  "timestamp": "2026-03-23T10:00:05+08:00",
  "embeddedComponents": [
    {
      "type": "calendar",
      "props": {
        "view": "day",
        "date": "2026-03-23",
        "events": [
          {
            "id": "evt_001",
            "title": "Team standup",
            "start": "2026-03-23T09:00:00+08:00",
            "end": "2026-03-23T09:30:00+08:00",
            "color": "blue"
          }
        ]
      }
    }
  ]
}
```

`embeddedComponents` is optional. When present, the chat UI renders these SDUI components inline within the message.

**`chat_error`** — Error during chat

```json
{
  "type": "chat_error",
  "code": "AGENT_UNREACHABLE",
  "message": "Could not reach AI agent. Check your agent settings.",
  "retryable": true
}
```

Error codes:

- `AGENT_UNREACHABLE` — Cannot connect to the agent API
- `AGENT_TIMEOUT` — Agent took too long to respond
- `AGENT_AUTH_FAILED` — Agent API key is invalid
- `INTERNAL_ERROR` — Server-side error
- `RATE_LIMITED` — Too many requests (future)

**`tool_call_start`** — Agent is calling a tool (for UX: show "Checking calendar...")

```json
{
  "type": "tool_call_start",
  "messageId": "msg_uuid",
  "toolName": "read_calendar",
  "toolCallId": "tc_uuid"
}
```

**`tool_call_complete`** — Tool call finished

```json
{
  "type": "tool_call_complete",
  "toolCallId": "tc_uuid",
  "success": true
}
```

**`pong`** — Heartbeat response

```json
{ "type": "pong" }
```

**`notification`** — Server pushes an alert (even over WebSocket for urgent ones)

```json
{
  "type": "notification",
  "notification": {
    "id": "notif_uuid",
    "severity": "warning",
    "title": "Meeting in 10 minutes",
    "message": "Team standup starts at 09:00",
    "timestamp": "2026-03-23T08:50:00+08:00"
  }
}
```

### 2.2 REST API Protocol

Used for non-real-time operations: module state refresh, form submissions, settings, calendar CRUD.

**Base URL:** `https://{server}/api`

**Auth:** All REST endpoints require `Authorization: Bearer {sessionToken}` header.

**Request format:** JSON body with `Content-Type: application/json`

**Response format:**

```json
{
  "success": true,
  "data": { ... },
  "error": null
}
```

Or on error:

```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Title is required",
    "details": { "field": "title" }
  }
}
```

**Standard HTTP status codes:**

- 200 — Success
- 201 — Created
- 400 — Bad request / validation error
- 401 — Unauthorized (token expired or invalid)
- 404 — Resource not found
- 409 — Conflict (e.g., setup already complete)
- 500 — Internal server error

See **Backend Spec** for full endpoint list.

---

## 3. Channel 2 — Backend → External AI Agent

### Protocol: OpenAI-Compatible Chat Completions API

The backend forwards user messages to the external AI agent using the OpenAI chat completions format. This is the **de facto standard** — almost all AI services support it:

- OpenAI (GPT)
- Anthropic (Claude) via compatible endpoints
- Ollama (local models)
- vLLM, LM Studio, text-generation-webui
- OpenClaw
- LangChain/PydanticAI/CrewAI deployed agents

### Request Format

**Endpoint:** `POST {agent_api_url}/chat/completions`

**Headers:**

```
Authorization: Bearer {agent_api_key}
Content-Type: application/json
```

**Body:**

```json
{
  "model": "{configured_model_name}",
  "messages": [
    {
      "role": "system",
      "content": "You are an AI assistant connected to a mobile app. You have access to the following tools to interact with the app: read_calendar, create_event, send_notification, etc. When the user asks about their calendar, use the read_calendar tool. When they want to create events, use create_event. You can also send notifications to alert the user."
    },
    { "role": "user", "content": "What's on my calendar today?" },
    { "role": "assistant", "content": "Let me check your calendar." },
    { "role": "user", "content": "Thanks" }
  ],
  "stream": true,
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "read_calendar",
        "description": "Get calendar events for a date range",
        "parameters": {
          "type": "object",
          "properties": {
            "start_date": { "type": "string", "format": "date" },
            "end_date": { "type": "string", "format": "date" }
          },
          "required": ["start_date", "end_date"]
        }
      }
    }
  ]
}
```

### System Prompt Construction

The backend constructs the system prompt dynamically:

```
You are an AI assistant connected to a mobile app via the Agentic AI Super App platform.

You have access to the following tools to interact with the user's app:
{list of available MCP tools with descriptions}

Current date/time: {server_datetime}
User timezone: {user_timezone}

Instructions:
- Use tools when the user asks about their data (calendar, notifications, etc.)
- When creating events or notifications, confirm with the user first unless they explicitly say to create it
- Format responses clearly. You can embed UI components in your responses.
- If a tool call fails, explain the error to the user in simple terms.
```

### Streaming Response Handling

The agent's response streams back as **Server-Sent Events (SSE)**:

```
data: {"choices": [{"delta": {"content": "Here's"}}]}
data: {"choices": [{"delta": {"content": " your"}}]}
data: {"choices": [{"delta": {"content": " schedule"}}]}
...
data: [DONE]
```

The backend:

1. Parses each SSE chunk
2. Extracts the content delta
3. Forwards it to the iOS app as a `chat_token` WebSocket message
4. On `[DONE]`, sends `chat_complete` with the full message

### Tool Call Flow

When the agent decides to use a tool:

```
1. Agent response includes tool_call in SSE stream:
   data: {"choices": [{"delta": {"tool_calls": [{"id": "tc_1", "function": {"name": "read_calendar", "arguments": "{\"start_date\": ...}"}}]}}]}

2. Backend receives tool call → sends tool_call_start to iOS (for UX)

3. Backend executes the tool internally (reads from database)

4. Backend sends tool result back to agent:
   POST /chat/completions with:
   messages: [...previous, {"role": "tool", "tool_call_id": "tc_1", "content": "{events: [...]}"}]

5. Agent receives tool result → generates response with the data

6. Backend streams the response to iOS

7. Backend sends tool_call_complete to iOS (for UX)
```

### Conversation Context Window

The backend manages conversation history:

- Store all messages in `chat_messages` table
- When building the `messages` array for the agent API call, include the last N messages (configurable, default 50)
- If context exceeds token limits, truncate oldest messages (keep system prompt and last 10 messages minimum)
- Tool call results are included in the history so the agent can reference them

---

## 4. Channel 3 — External AI Agent → Backend (MCP)

### Protocol: MCP (Model Context Protocol)

MCP allows external AI agents to call tools on the backend. This is the **reverse direction** from Channel 2.

### Transport: Streamable HTTP

**Endpoint:** `https://{server}/mcp` (or `https://{server}:{MCP_PORT}/`)

**Auth:** Bearer token in HTTP header. The token is configured in the agent's MCP client settings.

### How It Works

1. External AI agent (e.g., Claude Desktop) is configured with the MCP server URL
2. Agent discovers available tools by calling MCP `tools/list`
3. When the agent decides to act, it calls a tool via MCP `tools/call`
4. Backend executes the tool (database operations, state updates)
5. Backend returns the result to the agent
6. If the tool modifies data (e.g., creates an event), the module state is updated
7. The iOS app picks up the change on next pull-to-refresh (or via WebSocket for chat)

### MCP Tool List

See **Backend Spec section 6** for full tool definitions. Summary:

| Tool | Description | Returns |
| --- | --- | --- |
| `read_calendar` | Get events for a date range | List of events |
| `create_event` | Create a calendar event | Created event |
| `update_event` | Update an existing event | Updated event |
| `delete_event` | Delete an event | Success/failure |
| `send_notification` | Push a notification to the user | Notification ID |
| `get_chat_history` | Read recent chat messages | List of messages |
| `send_chat_message` | Send a message to the user | Message ID |
| `get_form_data` | Get submitted form data | Form submissions |
| `create_form` | Create a dynamic form | Form ID |
| `update_module_state` | Update any module's SDUI JSON | Success/failure |

### MCP ↔ Internal Tool Bridge

IMPORTANT: The same tool implementations serve both:

- **Internal calls** (during chat, when agent proxy executes tool calls from the streaming response)
- **External calls** (when an external MCP client calls tools directly)

Implement tools ONCE, expose them through both interfaces.

```python
# Single tool implementation
async def read_calendar(start_date: str, end_date: str, user_id: str) -> dict:
    events = await db.query(CalendarEvent).filter(...).all()
    return {"events": [e.to_dict() for e in events]}

# Exposed via MCP server
@mcp_server.tool()
async def read_calendar_tool(start_date: str, end_date: str):
    user_id = get_current_user_from_mcp_context()
    return await read_calendar(start_date, end_date, user_id)

# Called internally by agent proxy
async def execute_tool_call(tool_name: str, args: dict, user_id: str):
    if tool_name == "read_calendar":
        return await read_calendar(**args, user_id=user_id)
```

---

## 5. SDUI JSON Schema

The SDUI (Server-Driven UI) JSON is the **contract** between the backend and frontend. Every module's UI state is described by this JSON.

### Root Schema

```json
{
  "type": "string",          // Component type: "chat", "calendar", "form", "alert", "screen"
  "props": { },              // Component-specific properties
  "version": 1,              // Increments on each update (for cache invalidation)
  "updatedAt": "ISO-8601"    // Last update timestamp
}
```

### Screen Container (for multi-component layouts)

```json
{
  "type": "screen",
  "props": {
    "title": "Dashboard",
    "children": [
      { "type": "alert", "props": { ... } },
      { "type": "calendar", "props": { ... } }
    ]
  }
}
```

### Component JSON Schemas

See **Frontend Spec section 5** for detailed JSON examples for each component:

- `chat` — messages array, streaming state
- `calendar` — view mode, events array
- `form` — title, fields array with types and validation
- `alert` — severity, title, message, actions

### Customizability

The JSON schema should be **maximally customizable.** Every visual and behavioral property that the frontend supports should be controllable via JSON props. This allows:

- The AI agent to customize the UI dynamically
- Different users to have different layouts
- The backend to A/B test UI variations
- Future module developers to create rich experiences

The vibe coding agent should design component props to be as flexible as possible while maintaining type safety.

---

## 6. Error Handling Across Channels

### Channel 1 Errors (iOS ↔ Backend)

| Scenario | Behavior |
| --- | --- |
| WebSocket connection fails | Show "Connection lost" banner, auto-reconnect |
| REST request fails (network) | Show error in module, retry button |
| 401 Unauthorized | Clear token, redirect to login |
| Invalid JSON from server | Show previous good state, log error |
| Unknown message type | Ignore silently, log warning |

### Channel 2 Errors (Backend → Agent)

| Scenario | Behavior |
| --- | --- |
| Agent API unreachable | Return `chat_error` with `AGENT_UNREACHABLE` |
| Agent API timeout (60s) | Return `chat_error` with `AGENT_TIMEOUT` |
| Agent API 401 | Return `chat_error` with `AGENT_AUTH_FAILED` |
| Agent returns malformed response | Return `chat_error` with `INTERNAL_ERROR` |
| Tool call in response fails | Return tool error to agent, let agent handle |

### Channel 3 Errors (Agent → Backend MCP)

| Scenario | Behavior |
| --- | --- |
| MCP auth fails | Return MCP error response |
| Tool call with invalid params | Return validation error |
| Tool call fails (DB error) | Return error with description |
| Unknown tool name | Return "tool not found" error |

---

## 7. Future Protocol Upgrades

### A2A (Agent-to-Agent Protocol)

Post-MVP upgrade path for richer agent communication:

- Task management (long-running tasks with status updates)
- Agent discovery (find what tools/capabilities an agent has)
- Multi-agent coordination
- Streaming with structured data

When implementing A2A, it would replace or supplement Channel 2. The backend would become an A2A-aware agent that can communicate with other A2A agents.

### WebSocket Push for All Modules

Post-MVP: extend WebSocket to push UI updates for non-chat modules (calendar, alerts, forms). Requires the "safe render guard" (JSON validation before rendering) described in the Frontend Spec.

### Push Notifications

Post-MVP: Apple Push Notification service integration for when the app is in background. Backend sends push notification → app wakes up → fetches latest data.

---

## 8. Sequence Diagrams

### User Sends Chat Message

```
iOS App          Backend Server          External AI Agent
  │                    │                        │
  │ ──WS: chat_message──►                       │
  │                    │                        │
  │                    │ ──POST /chat/completions──►
  │                    │    (with tools array)   │
  │                    │                        │
  │                    │ ◄──SSE: delta tokens────│
  │ ◄──WS: chat_token──│                        │
  │ ◄──WS: chat_token──│                        │
  │ ◄──WS: chat_token──│                        │
  │                    │                        │
  │                    │ ◄──SSE: tool_call──────│
  │ ◄──WS: tool_call_start──                    │
  │                    │                        │
  │                    │ (executes tool locally) │
  │                    │                        │
  │                    │ ──POST /chat/completions──►
  │                    │    (with tool result)   │
  │                    │                        │
  │                    │ ◄──SSE: delta tokens────│
  │ ◄──WS: chat_token──│                        │
  │                    │                        │
  │                    │ ◄──SSE: [DONE]──────────│
  │ ◄──WS: chat_complete──                      │
  │ ◄──WS: tool_call_complete──                 │
  │                    │                        │
```

### External Agent Modifies Calendar via MCP

```
External AI Agent     Backend (MCP Server)     iOS App
  │                        │                      │
  │ ──MCP: tools/list──────►                      │
  │ ◄──tool definitions────│                      │
  │                        │                      │
  │ ──MCP: tools/call──────►                      │
  │   (create_event)       │                      │
  │                        │ (creates in DB)      │
  │                        │ (updates module_state)│
  │ ◄──result──────────────│                      │
  │                        │                      │
  │                        │     (later...)        │
  │                        │                      │
  │                        │ ◄──pull-to-refresh───│
  │                        │ ──module state JSON──►│
  │                        │   (includes new event)│
  │                        │                      │
```

### First-Launch Connection

```
iOS App              Backend Server
  │                      │
  │ ──GET /auth/status───►│
  │ ◄──{setup_complete}───│
  │                      │
  │  (if not setup:)     │
  │ ──POST /auth/setup───►│
  │ ◄──{user created}─────│
  │                      │
  │ ──POST /auth/login───►│
  │   (username, pass,   │
  │    device_id, name)  │
  │ ◄──{session_token}────│
  │                      │
  │ ──WS connect──────────►│
  │   (?token=...&device=...)│
  │ ◄──WS: connected──────│
  │                      │
  │ ──GET /api/modules───►│
  │ ◄──{available modules}│
  │                      │
  │ ──GET /api/devices/config──►│
  │ ◄──{tab config, defaults}───│
  │                      │
  │  (App is ready)      │
```