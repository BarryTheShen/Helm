# Agents, MCP, Workflows & Additional Systems

## Tier 1: TLDR

Helm has three "intelligence" systems beyond basic CRUD:

1. **AI Agent Proxy** — Connects to any OpenAI-compatible LLM (GPT-4o, Claude, local models). Streams responses in real-time and can call tools (calendar, notifications, etc.) mid-conversation.
2. **MCP Server** — Exposes Helm's tools to external AI agents via the MCP standard protocol. Any MCP-compatible agent can read/write calendar, send notifications, etc.
3. **Workflow Engine** — Simple automation: "When X happens → do Y". Supports cron schedules and event triggers. Runs automatically via APScheduler.

---

## Tier 2: Deeper Explanation

### AI Agent Proxy

The Agent Proxy (`backend/app/services/agent_proxy.py`) is the bridge between the user and the LLM:

```
User → WebSocket → Agent Proxy → OpenAI API (streaming) → WebSocket → User
                        ↓ (tool calls)
                   MCP Tools → DB/WebSocket
```

**How it works:**
1. User sends a message via WebSocket
2. Agent Proxy loads the user's AI config from DB (provider, model, API key, system prompt)
3. Loads last 20 chat messages for context
4. Saves user message to DB
5. Makes a streaming POST to the LLM's `/chat/completions` endpoint
6. As tokens arrive, forwards them to the user via WebSocket
7. If the LLM calls a tool (e.g., "read_calendar"), the Agent Proxy:
   - Parses the tool call from the stream
   - Executes it locally via `execute_tool()`
   - Sends the result back to the user via WebSocket
8. When done, saves the full assistant response to DB

**Configurable per-user:**
- Provider (OpenAI, compatible APIs)
- Model (gpt-4o, gpt-4o-mini, etc.)
- API key
- Base URL (for self-hosted models)
- System prompt
- Temperature
- Max tokens

### MCP Server

The MCP (Model Context Protocol) server is a separate sub-application mounted at `/mcp` on the FastAPI app. It uses `FastMCP` from the `mcp` library.

**Purpose:** Let external AI agents (like Claude Desktop, custom agents, etc.) call Helm's tools programmatically.

**Available tools (9):**

| Tool | What it does |
|------|-------------|
| `helm_read_calendar` | Query events by date range |
| `helm_create_event` | Create a new calendar event |
| `helm_update_event` | Modify an existing event |
| `helm_delete_event` | Remove an event |
| `helm_send_notification` | Push a notification to the user's app |
| `helm_get_chat_history` | Read recent chat messages |
| `helm_send_chat_message` | Send a message as the assistant |
| `helm_update_module_state` | Push SDUI state to a module |
| `helm_get_form_data` | Get form submissions |

**Architecture note:** The actual tool logic lives in `backend/app/mcp/tools.py` and is shared between the Agent Proxy (internal calls) and the MCP Server (external calls). This means the same code handles both internal LLM tool calls and external agent tool calls.

**Authentication:** The MCP ASGI app is wrapped in `_MCPAuthMiddleware` (in `backend/app/mcp/server.py`). Every request must include `Authorization: Bearer <token>`. The middleware validates the token, looks up the session, and sets `_current_user_id` for the request context. Unauthenticated requests return 401.

### Workflow Engine

The Workflow Engine (`backend/app/services/workflow_engine.py`) provides simple automation:

**Trigger types:**
| Trigger | When it fires |
|---------|--------------|
| `schedule` | Cron-based recurring schedule (e.g., "0 9 * * *" = daily at 9am) |
| `event_created` | When a calendar event is created |
| `event_updated` | When a calendar event is updated |
| `form_submitted` | When a form is submitted |
| `message_received` | When a chat message arrives |

**How workflows execute:**
1. A trigger fires (either by cron schedule or by `fire_trigger()` being called from a router/service)
2. The engine finds all active workflows matching that trigger type for the user
3. For each matching workflow, it executes the configured tool (from `action_config`)
4. Updates `run_count` and `last_run_at`

**Example workflow:**
```json
{
  "name": "Daily Briefing",
  "trigger_type": "schedule",
  "trigger_config": {"cron": "0 9 * * *"},
  "action_config": {
    "tool": "send_notification",
    "args": {"title": "Good Morning", "message": "Here's your daily briefing", "severity": "info"}
  }
}
```

### Testing & E2E Infrastructure

**Backend tests** (`backend/tests/`):
- `pytest` + `pytest-asyncio` with in-memory SQLite
- 4 test files: auth, calendar, notifications, workflows
- `conftest.py` provides `client` (unauthenticated) and `auth_client` (pre-authenticated) fixtures

**E2E tests** (root `tests/`):
- `e2e.spec.ts` — Playwright tests targeting the web version
- `test-frontend.js` — Puppeteer script to check if the frontend renders
- `test-full-flow.sh` — Shell script for manual full-flow testing

**Playwright config:**
- Runs against `http://localhost:8082` (web frontend)
- Auto-starts backend on port 8000

---

## Tier 3: Extensive Detail

### Agent Proxy — Complete Flow

```python
# Entry point (called from websocket router as background task)
handle_chat_message(user_id, content, conversation_id)
    └── _process_chat(user_id, content, conversation_id)
        ├── Load AgentConfig from DB for user
        ├── Load last 20 ChatMessages from DB
        ├── Save user's ChatMessage to DB
        ├── Send "chat_start" via WebSocket
        ├── If no API key → send "chat_error" (no_api_key)
        ├── Build messages array [system + history + user]
        ├── POST /chat/completions (streaming) via httpx
        │   ├── Parse SSE stream line by line
        │   ├── For each token → send "chat_token" via WebSocket
        │   ├── For tool_calls → _handle_tool_call(user_id, tc)
        │   │   └── execute_tool(name, args, user_id)
        │   │       └── Send "tool_result" via WebSocket
        │   └── On error → send "chat_error" via WebSocket
        ├── Save assistant ChatMessage to DB
        └── Send "chat_complete" via WebSocket
```

**Tool definitions sent to LLM (5 tools):**
1. `read_calendar(start_date, end_date)` — Get events
2. `create_event(title, start_time, end_time, description, color, location)` — Create event
3. `send_notification(title, message, severity)` — Push notification
4. `update_module_state(module_type, state)` — Update SDUI
5. `get_chat_history(limit)` — Get messages

**Error handling:**
- `httpx.RequestError` → "Network error reaching AI provider"
- Non-200 HTTP status → "AI provider returned error {status}"
- `json.JSONDecodeError` in stream → skip line, continue
- General exception → "An error occurred processing your message"

### MCP Tool Implementation Details

Each tool in `backend/app/mcp/tools.py` follows the same pattern:
1. Open a new database session (`AsyncSessionLocal`)
2. Query/modify data scoped to `user_id`
3. For tools that affect the UI (notifications, module state), also push a WebSocket message via `manager.send()`
4. Return a simple dict with results

**Tool → WebSocket side effects:**

| Tool | WebSocket Event |
|------|----------------|
| `send_notification` | `{"type": "notification", "id": "...", "title": "...", "message": "...", "severity": "..."}` |
| `send_chat_message` | `{"type": "chat_complete", "message_id": "...", "content": "..."}` |
| `update_module_state` | `{"type": "module_state_update", "module": "...", "state": {...}, "version": N}` |

The other tools (read_calendar, create_event, etc.) only modify the DB and return results — no WebSocket push.

### Workflow Engine — Scheduler Details

Uses `APScheduler 3.x` (AsyncIOScheduler):
- Timezone: UTC
- Job ID format: `workflow_{workflow_id}`
- Misfire grace time: 300 seconds (5 min)
- `replace_existing=True` for idempotent registration

**Lifecycle:**
1. On app startup (`lifespan`): `start_scheduler()` → `_load_scheduled_workflows()`
2. Loads all active scheduled workflows from DB
3. Registers each as a cron job with APScheduler
4. On app shutdown: `stop_scheduler()` → `scheduler.shutdown(wait=False)`

**Runtime registration:**
- `register_workflow(wf)` — Called after creating a new workflow. Only registers scheduled + active workflows.
- `unregister_workflow(id)` — Called when deleting or deactivating. Removes cron job.

**Event-triggered workflows:**
- `fire_trigger(trigger_type, user_id, event_data)` — Called manually from routers/services
- NOTE: Currently, NO router actually calls `fire_trigger()`. The plumbing exists but isn't wired up. If you create an `event_created` workflow and create a calendar event, the workflow won't fire.

### WebSocket Manager Details

`ConnectionManager` in `backend/app/services/websocket_manager.py`:
- `_connections: dict[str, list[WebSocket]]` — One user can have multiple connections (multiple devices)
- Thread-safe for async context
- `send()` iterates all connections for a user, removes dead ones
- `broadcast()` sends to all users

### Test Details

**`conftest.py` fixtures:**
```
db_engine (function-scoped) → In-memory SQLite with all tables created
db_session (function-scoped) → SQLAlchemy session from engine
client (function-scoped) → AsyncClient with DB override, no auth
auth_client (function-scoped) → client + setup user + login + Bearer header
```

**Test coverage:**
- `test_auth.py`: Setup (success + duplicate), login (success + bad credentials), status, logout
- `test_calendar.py`: Create, list, update, delete events
- `test_notifications.py`: Create (via DB), list, mark read, mark all read
- `test_workflows.py`: Create, list, update, delete, deactivate/reactivate

### Known Issues

1. **Agent Proxy tool calls are incomplete** — The LLM may make tool calls during streaming, but the current code tries to parse `tool_calls` from the stream delta without properly accumulating function arguments across chunks. Partial JSON will fail `json.loads()`.

2. **`fire_trigger()` never called** — Event-based workflows (event_created, form_submitted, etc.) exist in the schema but no router fires them.

3. **No workflow input validation** — `trigger_config.cron` could be any string, including invalid cron expressions that would crash APScheduler.

4. **Workflow actions limited to tools** — `action_config.tool` must match a tool name in `execute_tool()`. No validation of this at creation time.

5. **No workflow execution history/logs** — Only `run_count` and `last_run_at` are tracked. No record of what happened or if it failed.

6. **E2E tests minimal** — Playwright test exists but the test file content wasn't read. The test infrastructure is set up but may not have comprehensive coverage.
