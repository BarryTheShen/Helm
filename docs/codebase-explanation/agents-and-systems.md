# Agents, MCP, Workflows & Additional Systems

## Tier 1: TLDR

Helm has four "intelligence" systems beyond basic CRUD:

1. **AI Agent Proxy** — Connects to any OpenAI-compatible LLM (GPT-4o, Claude, local models). Streams responses in real-time and can call tools (calendar, notifications, etc.) mid-conversation.
2. **MCP Server** — Exposes Helm's tools to external AI agents via the MCP standard protocol. Any MCP-compatible agent can read/write calendar, send notifications, etc.
3. **Workflow Engine** — Simple automation: "When X happens → do Y". Supports cron schedules and event triggers. Runs automatically via APScheduler.
4. **Standalone PydanticAI Agent** (`agent/`) — An independent **developer/admin** agent. Runs outside the backend. Connects to Helm's MCP server over HTTP and can read/write the React Native frontend source code. Three modes: `--web` (local `chat_ui.html`-based browser chat), REPL, one-shot. Not the same agent as the Agent Proxy — these are completely separate systems.

---

## Tier 2: Deeper Explanation

### AI Agent Proxy

The Agent Proxy (`backend/app/services/agent_proxy.py`) is the bridge between the user and the LLM:

```
User → WebSocket → Agent Proxy → OpenAI API (streaming) → We$bSocket → User
                        ↓ (tool calls)
                   MCP Tools → DB/WebSocket
```

**How it works:**
1. User sends a message via WebSocket
2. Agent Proxy loads the user's AI config from DB (provider, model, API key, system prompt)
3. Loads last 20 chat messages for context
4. Saves user message to DB
5. Makes a streaming POST to the LLM's `/chat/completions` endpoint
6. As tokens arrive, forwards them to the user via WebSocket (`chat_token` events)
7. If the LLM calls a tool, the Agent Proxy: parses the tool call (JSON from `tool_calls[]` in the stream, or XML fallback via `_parse_xml_tool_calls()`), executes it via `_execute_tool_safe()`, sends the result to the user via `tool_result` WebSocket event
8. **Multi-turn loop**: After tool execution, the result is injected back into the message history and the LLM is called again (up to `_MAX_TOOL_TURNS=5` iterations)
9. Reasoning tokens (`delta.reasoning`) are stripped from the streamed output and not forwarded to the user
10. If the response contains XML tool call markup, it is stripped and the cleaned message is sent via `chat_message_replace` WebSocket event
11. When done, saves the full assistant response to DB

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

**Available tools (17):**

| Tool | What it does |
|------|--------------|
| `helm_read_calendar` | Query events by date range |
| `helm_create_event` | Create a new calendar event |
| `helm_update_event` | Modify an existing event |
| `helm_delete_event` | Remove an event |
| `helm_delete_all_events` | Delete all events for the user |
| `helm_read_all_calendar` | Read all events (no date filter) |
| `helm_send_notification` | Push a notification to the user's app |
| `helm_get_chat_history` | Read recent chat messages |
| `helm_send_chat_message` | Send a message as the assistant |
| `helm_update_module_state` | Push SDUI state to a module (legacy key) |
| `helm_get_form_data` | Get form submissions |
| `helm_set_screen` | Set SDUI screen JSON for a module |
| `helm_delete_screen` | Delete the SDUI screen for a module |
| `helm_list_screens` | List all active SDUI screens |
| `helm_hide_tab` | Hide a tab from the bottom navigator |
| `helm_show_tab` | Show a previously hidden tab |
| `helm_list_tabs` | List tabs and their visibility |

**Architecture note:** The actual tool logic lives in `backend/app/mcp/tools.py` and is shared between the Agent Proxy (internal calls) and the MCP Server (external calls). This means the same code handles both internal LLM tool calls and external agent tool calls.

**Authentication:** The MCP ASGI app is wrapped in `_MCPAuthMiddleware` (in `backend/app/mcp/server.py`). Every request must include `Authorization: Bearer <token>`. The middleware validates the token, looks up the session, and sets `_current_user_id` for the request context. Unauthenticated requests return 401.

### Standalone PydanticAI Agent (`agent/`)

The `agent/` directory at the repo root contains a **completely independent** external agent that connects to Helm's MCP server and can also edit the React Native frontend source code.

**Location:** `agent/helm_agent.py`
**README:** `agent/README.md`

#### Three run modes

| Mode | Command | Description |
|------|---------|-------------|
| **Web UI** | `python helm_agent.py --web` | Browser chat at `http://localhost:7860` with token streaming |
| **REPL** | `python helm_agent.py` | Interactive terminal, remembers conversation history |
| **One-shot** | `python helm_agent.py "task"` | Single task, prints result, exits |

```bash
source backend/.venv/bin/activate   # reuses backend venv — no extra installs
cd agent

python helm_agent.py --web              # → http://localhost:7860
python helm_agent.py --web --port 8080  # custom port
python helm_agent.py                    # interactive REPL
python helm_agent.py "What's on my calendar this week?"
```

#### Required `.env` variables

| Variable | How to get it |
|----------|---------------|
| `HELM_SESSION_TOKEN` | `POST /auth/login` → copy `session_token` |
| `OPENROUTER_API_KEY` | https://openrouter.ai/keys (free tier works) |

#### Changing the model

The agent uses OpenRouter as its LLM provider. The model is set by `OPENROUTER_MODEL` in `Helm/.env`:

```bash
# In Helm/.env — add or edit this line:
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet    # recommended
# OPENROUTER_MODEL=openai/gpt-4o
# OPENROUTER_MODEL=stepfun/step-3.5-flash:free    # current default (free)
# OPENROUTER_MODEL=meta-llama/llama-3.1-70b-instruct
```

If `OPENROUTER_MODEL` is not set, the default in `helm_agent.py` is `stepfun/step-3.5-flash:free`. Override in `Helm/.env` for a smarter or different model.

Both standard chat models and reasoning/thinking models (e.g. `stepfun`, `qwen3`, `liquid/lfm-thinking`) are supported — pydantic-ai handles `delta.reasoning` transparently.

Browse available models and their free tier status at: https://openrouter.ai/models

#### What the agent can do

- Connect to the Helm MCP server (all 17 tools) via HTTP + Bearer token
- Read any file inside `mobile/` (the React Native frontend)
- Write / overwrite any file inside `mobile/` to programmatically edit the frontend
- List files in any `mobile/` subdirectory
- Hold a multi-turn conversation with history (REPL + web modes)

#### Architecture

```
agent/helm_agent.py (no backend imports)
  ├── Three modes: --web (local chat_ui.html), REPL, one-shot
  ├── _build_agent()  — shared agent factory used by all modes
  ├── _SYSTEM_PROMPT  — shared system prompt string
  ├── MCPServerStreamableHTTP → Helm /mcp (17 Helm MCP tools)
  └── Local filesystem tools (path-validated to mobile/ only)
        read_frontend_file(relative_path)
        write_frontend_file(relative_path, content)
        list_frontend_files(subdirectory)
```

#### Web UI details

The `--web` mode serves `agent/chat_ui.html` — a local, standalone HTML file containing a minimal chat interface. It does NOT use pydantic-ai's CDN-hosted web app. The backend is a simple FastAPI + SSE server (`/chat` POST endpoint + `/stream` SSE stream) implemented inline in `helm_agent.py`. This means:
- Works offline once the Python deps are installed
- No CDN dependency
- Streams tokens via SSE to the browser
- History is kept in-memory per server process

#### Security

`write_frontend_file()` resolves the path against `_MOBILE_ROOT` before any I/O. Absolute paths and `../` traversal attempts (e.g. `../../backend/app/config.py`) raise `ValueError` and are never written.

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

### Standalone Agent — Complete Detail

#### File layout

```
agent/
├── helm_agent.py   — entire agent: config, tools, web UI, REPL, one-shot entrypoint
└── README.md       — setup guide, run commands, architecture diagram
```

No `requirements.txt` needed — the agent reuses `backend/.venv` which already has `pydantic-ai`, `uvicorn`, `starlette`, `mcp`, and `python-dotenv`.

#### Key functions / sections

| Symbol | Purpose |
|--------|---------|
| `_safe_mobile_path(rel)` | Path validation — resolves + checks against `_MOBILE_ROOT`. Called by all filesystem tools. |
| `read_frontend_file(rel)` | Tool: reads a file in `mobile/` |
| `write_frontend_file(rel, content)` | Tool: writes/overwrites a file in `mobile/` |
| `list_frontend_files(subdir)` | Tool: recursive file listing in `mobile/` |
| `_build_agent()` | Factory: creates a configured `pydantic_ai.Agent` with MCP + filesystem tools. Shared by all three run modes. |
| `_SYSTEM_PROMPT` | Constant: the agent's system prompt |
| `_run_web(host, port)` | Calls `create_web_app(agent)` and runs with `uvicorn.run()`. Synchronous — uvicorn owns the event loop. |
| `run_agent(task)` | One-shot: `async with agent:` then `agent.run(task)`, prints result |
| `interactive_repl()` | REPL: `async with agent:` multi-turn loop with history |
| Entry point | `if __name__ == "__main__":` — `--web` calls `_run_web()`, else `asyncio.run()` |

#### Web UI (pydantic-ai built-in)

Uses `pydantic_ai.ui._web.create_web_app(agent)` which returns a Starlette ASGI app:
- Serves pydantic-ai's official `@pydantic/ai-chat-ui` React frontend
- Fetched from CDN on first launch, cached at `~/.cache/pydantic-ai/web-ui/{version}.html`
- API endpoints under `/api` (standard pydantic-ai web API)
- MCP and tool connections established per-request inside `Agent.iter()` — no separate lifecycle needed
- Served by uvicorn — uvicorn creates and owns the asyncio event loop (`uvicorn.run()` called directly)

#### Model configuration (every detail)

The model is resolved in this order:
1. `OPENROUTER_MODEL` env var if set (in `Helm/.env`)
2. Hardcoded default in `helm_agent.py`: `stepfun/step-3.5-flash:free`

To change it permanently, set in `Helm/.env`:
```bash
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
```

The agent always uses **OpenRouter** as the provider (base URL: `https://openrouter.ai/api/v1`). It uses `OpenAIChatModel` from pydantic-ai with an `OpenAIProvider` pointing at OpenRouter — so any model available on OpenRouter works. The model string format is `provider/model-name` as shown at https://openrouter.ai/models.
