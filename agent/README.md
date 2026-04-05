# Helm Agent — Standalone PydanticAI Agent

An independent external AI agent that connects to the Helm MCP server and can also read/write the React Native frontend source code.

## What it does

- **Connects to Helm's MCP server** (`/mcp`) — gets access to all 9 Helm tools: read/write calendar events, send notifications, read/write chat messages, update module states.
- **Edits the frontend** — has local filesystem tools restricted to `mobile/` so it can read and modify the Expo/React Native TypeScript source.
- **Runs completely independently** — no imports from `backend/app/`. Just uses the MCP HTTP protocol and the filesystem.

## Choosing a model

The agent uses **OpenRouter** as its LLM provider, giving access to every major model (GPT-4o, Claude, Gemini, Llama, etc.) through one API key.

The active model is read from `OPENROUTER_MODEL` in `Helm/.env`.
If not set, it falls back to the hardcoded default: `stepfun/step-3.5-flash:free` — a free-tier reasoning model on OpenRouter.

**To use a better model**, add to `Helm/.env`:

```bash
# Recommended for real work:
OPENROUTER_MODEL=anthropic/claude-3.5-sonnet

# Other good options:
# OPENROUTER_MODEL=openai/gpt-4o
# OPENROUTER_MODEL=google/gemini-pro-1.5
# OPENROUTER_MODEL=meta-llama/llama-3.1-70b-instruct
```

Browse all available models at https://openrouter.ai/models — filter by "Free" to find zero-cost options.

Reasoning/thinking models (e.g. `stepfun/step-3.5-flash:free`, `qwen3:thinking`, `liquid/lfm-thinking`) are fully supported — pydantic-ai handles `delta.reasoning` transparently.

## Setup

This agent reuses the backend venv (which already has `pydantic-ai`, `mcp`, `python-dotenv`, and `openai`):

```bash
# From the repo root
source backend/.venv/bin/activate
```

### Environment variables

Add these to `Helm/.env` (the repo root `.env` file):

```bash
# Required: your Helm session token (login first to get one)
HELM_SESSION_TOKEN=your-session-token-here

# Required: OpenRouter API key (https://openrouter.ai/keys — free tier available)
OPENROUTER_API_KEY=sk-or-...

# Optional: override defaults
HELM_MCP_URL=http://localhost:8000/mcp/          # default
OPENROUTER_MODEL=stepfun/step-3.5-flash:free     # default; reasoning/thinking models supported
```

**How to get a session token:**

```bash
curl -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your-password"}'
# → copy "session_token" from the response and add to .env
```

## Running

```bash
# from the repo root (Helm/), with venv activated
cd agent

# Web UI — pydantic-ai's built-in browser chat (streams at http://localhost:7860)
python helm_agent.py --web
python helm_agent.py --web --port 8080  # custom port

# Interactive REPL (chat-style — remembers conversation history)
python helm_agent.py

# One-shot mode — pass a task as a command-line argument
python helm_agent.py "Send a notification: title='Test', message='Hi from agent', severity=info"
python helm_agent.py "What calendar events do I have this week?"
python helm_agent.py "List all files in mobile/app/(tabs)/"
python helm_agent.py "Read mobile/app/(tabs)/settings.tsx and summarise it"
python helm_agent.py "Add a comment at the top of mobile/app/(tabs)/chat.tsx explaining what it does"
```

The web UI is pydantic-ai's official `@pydantic/ai-chat-ui` — fetched from CDN on first run and cached in `~/.cache/pydantic-ai/`. No npm build, no custom HTML.

## Architecture

```
agent/helm_agent.py (standalone — no backend imports)
  │
  ├── Modes:
  │     --web   → pydantic-ai built-in web UI (create_web_app)
  │     (none)  → interactive terminal REPL
  │     task    → one-shot CLI execution
  │
  ├── pydantic_ai.Agent
  │     ├── MCPServerStreamableHTTP → Helm /mcp (9 Helm tools)
  │     │     • helm_read_calendar, helm_create_event, helm_update_event
  │     │     • helm_delete_event, helm_send_notification
  │     │     • helm_get_chat_history, helm_send_chat_message
  │     │     • helm_update_module_state, helm_get_form_data
  │     │
  │     └── Local filesystem tools (restricted to mobile/)
  │           • read_frontend_file(relative_path)
  │           • write_frontend_file(relative_path, content)
  │           • list_frontend_files(subdirectory)
  │
  └── OpenRouter (LLM provider — OpenAI-compatible API)
```

### Web UI

Uses `pydantic_ai.ui._web.create_web_app(agent)` — pydantic-ai's official built-in Starlette app:
- Serves the **official** `@pydantic/ai-chat-ui` React frontend from CDN
- Cached locally in `~/.cache/pydantic-ai/web-ui/` after first download
- MCP and tool connections are managed per-request by pydantic-ai's `Agent.iter()`
- API mounted at `/api`, UI served at `/`

## Security notes

- **Session token** — treat like a password. It grants full access to the Helm API.  Store it in `.env` (which is in `.gitignore`), never hardcode it.
- **Filesystem isolation** — `write_frontend_file()` uses path validation to block writes outside `mobile/`.  Absolute paths and `../` traversal attempts raise a `ValueError` before any I/O.
- **Read-only by default** — if you want a read-only agent, remove `write_frontend_file` from the `tools=` list in `helm_agent.py`.

## Adding more tools

To give the agent new capabilities, add async functions decorated with type hints to `helm_agent.py` and include them in the `tools=[...]` list when creating the `Agent`.  PydanticAI auto-generates the JSON schema from the function signature and docstring.

Example:

```python
async def restart_backend_dev_server() -> str:
    """Restart the FastAPI dev server (runs uvicorn)."""
    import subprocess
    # ... implementation
```
