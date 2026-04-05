---
mode: agent
description: Add a new MCP tool to Helm — coordinates backend tool implementation, agent proxy definitions, MCP server registration, and documentation updates
tools: ['search', 'editFiles', 'runInTerminal', 'terminalLastCommand', 'usages', 'agent']
---

# Add MCP Tool: ${input:toolName}

Add a new MCP tool `helm_${input:toolName}` to the Helm platform. This requires synchronized changes across 3 files.

## Pre-Flight Check

Read these files to understand existing patterns:
1. `backend/app/mcp/tools.py` — Existing tool implementations
2. `backend/app/services/agent_proxy.py` — `_get_tool_definitions()` function
3. `backend/app/mcp/server.py` — FastMCP tool registrations
4. [docs/codebase-explanation/protocol.md](../docs/codebase-explanation/protocol.md) — MCP tool reference table

## Step 1: Implement Tool Logic (`mcp/tools.py`)

Add the tool function in `backend/app/mcp/tools.py`:
- Follow the pattern of existing tools (receive `user_id`, `db` session, tool-specific params)
- Return a dict with `status` and relevant data
- Add proper type hints and a brief docstring
- Handle errors gracefully with try/except

## Step 2: Add Agent Proxy Definition (`agent_proxy.py`)

Add the OpenAI function-calling schema in `_get_tool_definitions()`:
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

Add the dispatch case in `execute_tool()` or `_execute_tool_safe()`.

## Step 3: Register in MCP Server (`mcp/server.py`)

Register the tool in `backend/app/mcp/server.py` using the FastMCP decorator pattern:
```python
@mcp.tool()
async def helm_tool_name(param: str, ctx: Context) -> str:
    ...
```

## Step 4: Verify Sync

All three files must be in sync:
- [ ] `tools.py` function name + params match `agent_proxy` schema
- [ ] `tools.py` function name + params match `mcp/server.py` registration
- [ ] Agent proxy `execute_tool` dispatches to the correct `tools.py` function

## Step 5: Write Tests

Add a test in `backend/tests/` that exercises the new tool via the REST API or directly.

## Step 6: Update Documentation

Update these docs:
- `docs/codebase-explanation/protocol.md` — Add to MCP tool reference table
- `docs/codebase-explanation/AI-TECHNICAL-REFERENCE.md` — Add to file map if new file; update agent proxy tool count
- `docs/codebase-explanation/agents-and-systems.md` — Add to tool definitions table

## Tool Details

**Tool name:** helm_${input:toolName}
**Description:** ${input:toolDescription}
**Parameters:** ${input:toolParams}
