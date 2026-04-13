# Agents, MCP, Workflows & Additional Systems

> Last updated: 2026-03-30

## Tier 1: TLDR

Helm has four "intelligence" systems beyond basic CRUD:

1. **AI Agent Proxy** (`backend/app/services/agent_proxy.py`) — Connects to any OpenAI-compatible LLM. Streams responses in real-time and can call tools mid-conversation. Handles XML tool-call fallback for non-function-calling models.

2. **MCP Server** (`backend/app/mcp/`) — Exposes Helm's tools to external AI agents via the MCP standard protocol. Any MCP-compatible agent (Claude Desktop, custom agents, etc.) can read/write calendar, send notifications, set SDUI screens, etc.

3. **Workflow Engine** (`backend/app/services/workflow_engine.py`) — Simple automation: "When X happens → do Y". Supports cron schedules and event triggers. Runs automatically via APScheduler.

4. **Standalone PydanticAI Agent** (`agent/`) — An independent developer/admin agent. Runs outside the backend. Connects to Helm's MCP server over HTTP and can read/write React Native frontend source code. Has two entry points:
   - `helm_agent.py` — REPL / web UI / one-shot mode via pydantic-ai
   - `api_server.py` — Standalone HTTP service the backend can forward mobile chat to

---

## AI Agent Proxy

### Location
`backend/app/services/agent_proxy.py`

### Entry point
```python
async def handle_chat_message(user_id: str, content: str, conversation_id: str | None) -> None
```
Called from the WebSocket handler as a `asyncio.create_task()` background task.

### Routing
1. Saves user message to DB (always, before routing)
2. If `settings.external_agent_url` is set → `_process_via_external_agent()`
3. Else → `_process_chat()` (built-in OpenRouter proxy)

### External Agent Path (`_process_via_external_agent`)
Forwards to `EXTERNAL_AGENT_URL/api/run` via SSE stream:
```
POST {EXTERNAL_AGENT_URL}/api/run {"message": content}
  data: {"type":"token","text":"..."} → ws.send({type:"chat_token",...})
  data: {"type":"done","text":"..."}  → ws.send({type:"chat_complete",...})
  data: {"type":"error","text":"..."}  → ws.send({type:"chat_error",...})
```

### Built-in LLM Path (`_process_chat`)

**Config resolution order:**
1. Per-user `AgentConfig` from DB (Fernet-decrypted `api_key_encrypted`)
2. `settings.openrouter_api_key` / `openrouter_base_url` / `openrouter_model`
3. `settings.openai_api_key` / `openai_base_url` / `openai_model`

**History:** Last 21 messages (desc), reversed, last dropped if matches current msg.

**Agentic loop** (max `_MAX_TOOL_TURNS = 5` iterations):
```
for turn in range(5):
    text, tool_calls, finish_reason = await _stream_one_turn(...)
    if finish_reason != "tool_calls" or not tool_calls:
        break
    # Append assistant turn with tool_calls to message history
    # Execute each tool via _execute_tool_safe()
    # Append tool results as role="tool" messages
    # Continue → next LLM call
```

### `_stream_one_turn()` — streaming POST to LLM

OpenAI-compatible POST to `{base_url}/chat/completions` with `stream: True`, `tools: _get_tool_definitions()`, `tool_choice: "auto"`.

**Per SSE chunk:**
- `delta.content` → send `{type:"chat_token", token}` to WS; accumulate text
- `delta.reasoning` → accumulate but NOT forwarded to WS (reasoning tokens stripped)
- `delta.tool_calls[].index` → accumulate into `pending_tool_calls: dict[int, {id, name, arguments}]`; execute only AFTER stream ends

**HTTP headers set:** `Authorization: Bearer <api_key>`, `HTTP-Referer: https://github.com/BarryTheShen/Helm`, `X-Title: Helm`

### XML Tool-Call Fallback (`_parse_xml_tool_calls`)
For models that don't use OpenAI function-calling (e.g. stepfun): if `finish_reason != "tool_calls"` but `<tool_call>` appears in content:
1. Regex-strips `<tool_call>JSON</tool_call>` blocks from content
2. Parses `{name, arguments}` from JSON
3. Synthesizes `tool_calls` list and processes normally
4. Sends `{type:"chat_message_replace", message_id, content: cleaned_content}` to strip XML from frontend display

### Built-in Tool Definitions (`_get_tool_definitions()`)
10 tools exposed to the LLM (OpenAI function-calling format):

| Tool name | Required params | Description |
|-----------|----------------|-------------|
| `read_calendar` | `start_date`, `end_date` | Get events (YYYY-MM-DD) |
| `create_event` | `title`, `start_time`, `end_time` | Create event; optional: `description`, `color`, `location` |
| `send_notification` | `title`, `message`, `severity` | Push notification |
| `update_module_state` | `module_type`, `state` | Write SDUI JSON (legacy) |
| `get_chat_history` | — | Optional `limit` (default 20) |
| `set_screen` | `module_id`, `screen` | Set SDUI screen on any tab; draft=True default |
| `delete_screen` | `module_id` | Clear a tab's SDUI screen |
| `list_screens` | — | List all AI-generated screens |
| `hide_tab` | `tab_id` | Hide nav-bar tab |
| `show_tab` | `tab_id` | Restore hidden tab |
| `list_tabs` | — | All tabs + visibility |

Tools are dispatched via `_execute_tool_safe()` → `execute_tool(name, args, user_id)` from `app/mcp/tools.py`.

### WebSocket Events Emitted by Agent Proxy

| Event `type` | When |
|-------------|------|
| `chat_start {message_id}` | Start of any AI response |
| `chat_token {message_id, token}` | Each streamed text delta |
| `chat_message_replace {message_id, content}` | When XML tool calls stripped |
| `tool_result {tool, result}` | After each tool executes successfully |
| `tool_error {tool, message}` | After tool execution fails |
| `chat_complete {message_id, content}` | End of turn, full response persisted |
| `chat_error {message?, code?}` | On any error; `code:"no_api_key"` when unconfigured |

---

## MCP Server

### Location
`backend/app/mcp/server.py` (FastMCP wrapper)
`backend/app/mcp/tools.py` (all tool logic)

### Architecture
```
External Agent (e.g. Claude Desktop)
        │
        │  HTTP  Authorization: Bearer <token>
        ▼
/mcp  (_MCPAuthMiddleware validates token, sets _current_user_id context var)
        │
        ▼
FastMCP("Helm")  — tool registry
        │
        ▼
tools.py execute_tool(name, args, user_id)  — shared with Agent Proxy
        │
        ▼
SQLAlchemy DB + WebSocket broadcasts
```

### Auth
`_MCPAuthMiddleware` (ASGI middleware):
- Reads `Authorization: Bearer <token>` header
- Calls `get_session_by_token()` to validate
- Sets `_current_user_id` context var for tools to read
- Returns `401 {"error": "Unauthorized"}` for invalid tokens

### Tool Implementations (`mcp/tools.py`)

All functions are `async`. Main `execute_tool(name, args, user_id)` dispatcher.

| Function | Key behavior |
|----------|-------------|
| `set_screen(module_id, screen, user_id, draft=True)` | Normalizes screen JSON via `normalize_sdui_screen()`, stores as draft or live, pushes WS event |
| `approve_draft(module_id, user_id)` | Copies `sdui__X__draft` → `sdui__X`, deletes draft, pushes `sdui_screen_update` |
| `reject_draft(module_id, user_id, feedback?)` | Deletes draft, pushes `sdui_draft_rejected` |
| `get_draft(module_id, user_id)` | Returns `{screen, has_draft}` |
| `hide_tab(tab_id, user_id)` | Adds to hidden list in `_tabs_config`, pushes `tabs_updated` |
| `show_tab(tab_id, user_id)` | Removes from hidden list, pushes `tabs_updated` |
| `list_tabs(user_id)` | All 7 tabs with visibility (`home, chat, calendar, forms, alerts, modules, settings`) |

**SDUI Normalization:** `normalize_sdui_screen()` and `_normalize_sdui_component()` convert flat AI-generated dicts (e.g. `{type:"text", content:"Hi"}`) to props-based schema (`{type:"text", props:{content:"Hi"}}`). Applied before DB storage and before WS broadcast.

---

## Workflow Engine

### Location
`backend/app/services/workflow_engine.py`

### How it works
- Uses `APScheduler` with `AsyncIOScheduler(timezone="UTC")`
- Started in `main.py` lifespan (`start_scheduler()`)
- On startup: scans DB for all active SCHEDULE workflows → registers cron jobs

### Trigger Types

| TriggerType | Config | When it fires |
|------------|--------|---------------|
| `SCHEDULE` | `trigger_config.cron` (crontab string) | On cron schedule |
| `EVENT_CREATED` | — | `fire_trigger()` called from calendar router |
| `EVENT_UPDATED` | — | Same |
| `FORM_SUBMITTED` | — | `fire_trigger()` called from action registry |
| `MESSAGE_RECEIVED` | — | `fire_trigger()` called from agent_proxy (not yet wired) |

**⚠️ Outstanding:** `fire_trigger()` for non-SCHEDULE trigger types is not called from any router yet.

### Workflow Action
`action_config.tool` + `action_config.params` → `execute_tool(tool, merged_args, user_id)` in `mcp/tools.py`.

---

## Standalone PydanticAI Agent (`agent/`)

### Key distinction
This is a **separate, independent** external agent — not the same as the Agent Proxy.

| | Agent Proxy | Standalone Agent |
|---|---|---|
| Location | `backend/app/services/agent_proxy.py` | `agent/helm_agent.py` |
| Triggered by | Mobile app WebSocket messages | Human REPL / browser chat / backend forward |
| Backend imports | Shares DB + services directly | None — HTTP only |
| Connects to Helm via | Calls `execute_tool()` in-process | `MCPServerStreamableHTTP → /mcp` |
| Can edit frontend | No | Yes (`mobile/` filesystem) |

### `helm_agent.py` — Three modes

```bash
python helm_agent.py --web           # Browser chat UI at http://localhost:7860
python helm_agent.py --web --port X  # Custom port
python helm_agent.py                 # Interactive REPL (conversation history preserved)
python helm_agent.py "Do a task"     # One-shot
```

### Agent construction (`_build_agent()`)
```python
provider = OpenAIProvider(base_url=OPENROUTER_BASE_URL, api_key=OPENROUTER_API_KEY)
model = OpenAIChatModel(OPENROUTER_MODEL, provider=provider)  
helm_mcp = MCPServerStreamableHTTP(
    url=HELM_MCP_URL,   # default: http://localhost:9000/mcp/
    headers={"Authorization": f"Bearer {HELM_SESSION_TOKEN}"},
    timeout=30,
)
Agent(model=model, mcp_servers=[helm_mcp], tools=[filesystem_tools...], system_prompt=_SYSTEM_PROMPT)
```

### Local filesystem tools (restricted to `mobile/`)

| Function | Parameters | Returns |
|----------|-----------|---------|
| `read_frontend_file(relative_path)` | Path relative to `mobile/` | File text content |
| `write_frontend_file(relative_path, content)` | Path + full new content | Confirmation string |
| `list_frontend_files(subdirectory="")` | Optional subdir relative to `mobile/` | Newline-separated paths |

**Security:** `_safe_mobile_path()` rejects absolute paths and `../` traversal via `resolved.relative_to(_MOBILE_ROOT)`. Skips: `node_modules`, `.expo`, `.git`, `__pycache__`, `.cache`, `dist`, `build`, `.venv`.

### `api_server.py` — External Agent HTTP Service

Starlette app. Acts as the backend's "external agent" when `EXTERNAL_AGENT_URL=http://localhost:7860` in `.env`.

**Route table:**

| Method | Path | Handler |
|--------|------|---------|
| `GET` | `/` | Serves `chat_ui.html` |
| `GET` | `/health` | `{"status":"ok","model":"<model>"}` |
| `POST` | `/api/run` | SSE stream for backend → agent communication |
| `*` | `/api/*` | pydantic-ai built-in sub-app (`/api/chat`, `/api/configure`, `/api/health`) |

**`/api/run` SSE format:**
```
data: {"type": "token", "text": "<delta>"}
data: {"type": "done",  "text": "<full response>"}
data: {"type": "error", "text": "<error>"}
```

**Data flow with `EXTERNAL_AGENT_URL` set:**
```
Mobile App ─── WebSocket ──► Backend ──► POST /api/run ──► api_server ──► MCP ──► Backend
```

### `chat_ui.html` — Browser Chat Interface

Self-contained dark-themed HTML/CSS/JS chat UI. Served at `/` by both `helm_agent.py --web` and `api_server.py`.

**On load:** `fetch('/api/configure')` → reads model name → displays in model badge.

**SSE events handled from `/api/chat`:**

| Event `type` | Action |
|-------------|--------|
| `text-delta` | Appends `chunk.delta` to active text bubble; re-renders markdown on seal |
| `reasoning-start` | Creates `<details class="thinking-block">` — expandable "Thinking..." block |
| `reasoning-delta` | Appends to thinking text |
| `reasoning-end` | Collapses block to "Thought" |
| `tool-input-start` | Creates `<details class="tool-block">` — shows tool name + input |
| `tool-input-available` | Sets tool input to `JSON.stringify(chunk.input)` |
| `tool-output-available` | Sets status "✓ done", shows result, auto-collapses |
| `tool-input-error` / `tool-output-error` | Sets status "✗ error", keeps block open |
| `error` | Renders error bubble |

**Markdown rendering:** Escapes HTML first, then applies patterns for `***`, `**`, `*`, backtick, `###/##/#`, `---`, `- list items`.

**Security:** User input rendered with `textContent` (not innerHTML) — no XSS risk.

### `send_prompt.py` — One-Shot CLI

CLI tool to send a single message to a running `api_server.py` instance and print the streamed response:

```bash
source backend/.venv/bin/activate
cd agent
python send_prompt.py "Set the home screen to a weather dashboard"
```

POSTs to `http://localhost:7860/api/run` by default. Useful for scripting agent behavior from the command line without opening a browser.

---

### System Prompt (`_SYSTEM_PROMPT`)

Key contents:
- All 7 module IDs: `home | chat | calendar | forms | alerts | modules | settings`
- SDUI V2 schema with full row/cell/component format
- All V2 component types (PascalCase) and props
- All action types and `server_action` function names
- V1 schema and types (legacy reference)
- Instructions for draft vs live screen publishing
- Filesystem tool usage for editing `mobile/` source code directly
