---
description: Work on MCP tools and agent runtime
agent: helm-agent-runtime
---

# /helm-mcp

Work on the following MCP/agent change: $ARGUMENTS

## What It Does

1. Consult `docs/codebase-explanation/agents-and-systems.md` for MCP architecture.
2. Implement changes across the three files that must stay in sync:
   - `backend/app/mcp/tools.py` — tool implementations
   - `backend/app/services/agent_proxy.py` — `_get_tool_definitions()`
   - `backend/app/mcp/server.py` — MCP server registration
3. Update the standalone agent in `agent/` if the tool affects it.
4. Verify: `cd backend && pytest -q`

## Rules

- **Three-file sync:** Changes to MCP tools must be reflected in all three files. Missing sync = broken agent.
- Tool definitions must match exactly: name, parameters, description.
- If adding a new tool, add it to the action registry (`action_registry.py`) if it needs server-side handling.
- Keep tool descriptions concise — they're sent to the LLM on every turn.
