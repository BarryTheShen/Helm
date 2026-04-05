---
applyTo: "backend/**/*.py"
---

# Helm Backend — Python/FastAPI Conventions

## Architecture

- FastAPI app in `backend/app/main.py` with 9 routers, 5 services, MCP server at `/mcp`
- SQLAlchemy async with aiosqlite, SQLite database at `backend/helm.db`
- Auth: session-based JWT tokens validated in `dependencies.py` against `sessions` table
- Config: pydantic-settings in `config.py`, reads `.env` from **repo root** (not `backend/`)

## File Organization

- One router per domain: `routers/{domain}.py`
- One model per table: `models/{model}.py` (all imported in `models/__init__.py`)
- Schemas in `schemas/{domain}.py` (exception: workflow schemas inline in `routers/workflows.py`)
- Business logic in `services/` — routers are thin dispatchers

## Patterns to Follow

- **UUID string PKs**: All models use `str(uuid4())` as default PK
- **Async everywhere**: All DB operations use `async with AsyncSession`
- **Pydantic V2 schemas**: Use `model_config = ConfigDict(from_attributes=True)` for ORM compat
- **Auth dependency**: Use `current_user_id: str = Depends(get_current_user_id)` in router params
- **Background tasks**: CPU-bound or long ops go in `asyncio.create_task()` (see agent_proxy pattern)

## MCP Tools — Critical Sync Rule

MCP tool logic lives in `mcp/tools.py`. Both the agent proxy (`services/agent_proxy.py`) and the MCP server (`mcp/server.py`) call these same functions.

**When editing MCP tools:**
1. Update the tool function in `mcp/tools.py`
2. Update `_get_tool_definitions()` in `services/agent_proxy.py` to match
3. Update the MCP server registration in `mcp/server.py` if the tool signature changed
4. All three must stay in sync

## Database Migrations

After changing any model:
```bash
cd backend && alembic revision --autogenerate -m "describe change"
cd backend && alembic upgrade head
```

## Testing

- Tests in `backend/tests/` use pytest-asyncio with in-memory SQLite
- `conftest.py` provides: `db_engine`, `db_session`, `client` (authenticated AsyncClient), `auth_client`
- Run: `cd backend && pytest`
