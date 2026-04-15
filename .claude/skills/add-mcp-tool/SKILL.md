---
name: add-mcp-tool
description: Step-by-step checklist for adding a new MCP tool to Helm. Covers the 3-file sync requirement (tools.py, agent_proxy.py, server.py), testing, and documentation. Use when implementing new MCP tools.
---

# Add MCP Tool to Helm

Adding a new MCP tool requires synchronized changes across 3 files. Follow this checklist.

## Pre-Flight Check

Read these files to understand existing patterns:
1. `backend/app/mcp/tools.py` — Existing tool implementations
2. `backend/app/services/agent_proxy.py` — `_get_tool_definitions()` function
3. `backend/app/mcp/server.py` — FastMCP tool registrations
4. `docs/codebase-explanation/protocol.md` — MCP tool reference table

## Step 1: Implement Tool Logic (`mcp/tools.py`)

Add the tool function:
- Follow existing tool patterns (receive `user_id`, `db` session, tool-specific params)
- Return a dict with `status` and relevant data
- Type hints and brief docstring
- Handle errors with try/except

## Step 2: Add Agent Proxy Definition (`agent_proxy.py`)

Add OpenAI function-calling schema in `_get_tool_definitions()`:
```python
{
    "type": "function",
    "function": {
        "name": "tool_name",
        "description": "What this tool does",
        "parameters": {
            "type": "object",
            "properties": { ... },
            "required": [...]
        }
    }
}
```

Add dispatch case in `execute_tool()` or `_execute_tool_safe()`.

## Step 3: Register in MCP Server (`mcp/server.py`)

```python
@mcp.tool()
async def helm_tool_name(param: str, ctx: Context) -> str:
    ...
```

## Step 4: Verify Sync

- [ ] `tools.py` function name + params match `agent_proxy` schema
- [ ] `tools.py` function name + params match `mcp/server.py` registration
- [ ] Agent proxy `execute_tool` dispatches to correct `tools.py` function

## Step 5: Write Tests

Add test in `backend/tests/` exercising the tool.

## Step 6: Update Documentation

- `docs/codebase-explanation/protocol.md` — MCP tool reference table
- `docs/codebase-explanation/AI-TECHNICAL-REFERENCE.md` — file map if new file
- `docs/codebase-explanation/agents-and-systems.md` — tool definitions table
