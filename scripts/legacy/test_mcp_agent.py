"""Helm MCP Agent Test Script.

Demonstrates an external pydantic_ai agent connecting to Helm's MCP server
to manage calendar events, send notifications, and more — via natural language.

Usage:
    cd /path/to/Helm
    # Ensure HELM_SESSION_TOKEN and OPENROUTER_API_KEY are set in .env
    python test_mcp_agent.py

Requirements (all already in backend/.venv):
    pydantic-ai, mcp, openai, httpx, python-dotenv
"""

import asyncio
import os
import sys
from pathlib import Path

# Load .env from repo root so HELM_SESSION_TOKEN / OPENROUTER_API_KEY are available
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / ".env")

HELM_SESSION_TOKEN = os.environ.get("HELM_SESSION_TOKEN", "")
HELM_MCP_URL = os.environ.get("HELM_MCP_URL", "http://localhost:9000/mcp/")
OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
OPENROUTER_MODEL = "stepfun/step-3.5-flash:free"


# ── Validation ────────────────────────────────────────────────────────────────

def _check_env() -> None:
    missing = []
    if not HELM_SESSION_TOKEN:
        missing.append("HELM_SESSION_TOKEN  (run: POST /auth/login → copy session_token)")
    if not OPENROUTER_API_KEY:
        missing.append("OPENROUTER_API_KEY  (get one at https://openrouter.ai/keys)")
    if missing:
        print("❌  Missing required environment variables:")
        for m in missing:
            print(f"    {m}")
        sys.exit(1)


# ── Test 1: Raw MCP connectivity (no LLM) ────────────────────────────────────

async def test_mcp_connectivity() -> None:
    """Connect to the MCP server and list available tools — no LLM required.

    This verifies that:
      • The MCP server is reachable
      • The Bearer token is accepted (auth middleware working)
      • Tool metadata is returned
    """
    print("\n── Test 1: MCP connectivity ─────────────────────────────────────")
    from mcp.client.streamable_http import streamablehttp_client
    from mcp import ClientSession

    auth_headers = {"Authorization": f"Bearer {HELM_SESSION_TOKEN}"}

    try:
        async with streamablehttp_client(HELM_MCP_URL, headers=auth_headers) as (read, write, _):
            async with ClientSession(read, write) as session:
                await session.initialize()
                tools_result = await session.list_tools()
                tool_names = [t.name for t in tools_result.tools]
                print(f"✅  Connected.  {len(tool_names)} tools available:")
                for name in tool_names:
                    print(f"    • {name}")
    except Exception as exc:
        print(f"❌  MCP connectivity failed: {exc}")
        raise


# ── Test 2: pydantic_ai agent via MCP ────────────────────────────────────────

async def test_agent_mcp_interaction() -> None:
    """Run a pydantic_ai agent that uses Helm MCP tools to perform a real action.

    The agent will:
      1. Send a notification to the user's app
      2. Create a calendar event for tomorrow
      3. Read back tomorrow's calendar events

    All actions go through the MCP server, authenticated as testuser.
    """
    print("\n── Test 2: pydantic_ai agent via MCP ────────────────────────────")

    from pydantic_ai import Agent
    from pydantic_ai.mcp import MCPServerStreamableHTTP
    from pydantic_ai.models.openai import OpenAIChatModel
    from pydantic_ai.providers.openai import OpenAIProvider

    # Build an OpenRouter-backed OpenAI-compatible model
    provider = OpenAIProvider(
        base_url=OPENROUTER_BASE_URL,
        api_key=OPENROUTER_API_KEY,
    )
    model = OpenAIChatModel(OPENROUTER_MODEL, provider=provider)

    # Connect the agent to Helm's MCP server with the session token
    mcp_server = MCPServerStreamableHTTP(
        url=HELM_MCP_URL,
        headers={"Authorization": f"Bearer {HELM_SESSION_TOKEN}"},
        timeout=15,
    )

    agent = Agent(
        model=model,
        mcp_servers=[mcp_server],
        system_prompt=(
            "You are a test agent verifying Helm's MCP integration. "
            "Use the available Helm tools to complete the user's requests. "
            "Be concise and confirm each action you take."
        ),
    )

    task = (
        "Please do the following three things in order:\n"
        "1. Send a notification with title 'MCP Test' and message 'Agent connected successfully via MCP.' (severity: success)\n"
        "2. Create a calendar event titled 'MCP Integration Test' starting tomorrow at 10:00 AM and ending at 10:30 AM\n"
        "3. Read back tomorrow's calendar events (use tomorrow's date) and tell me what events exist\n"
    )

    print(f"Prompt: {task.strip()}\n")

    try:
        async with agent.run_mcp_servers():
            result = await agent.run(task)
        print("✅  Agent response:\n")
        print(result.response)
    except Exception as exc:
        print(f"❌  Agent run failed: {exc}")
        raise


# ── Test 3: Auth rejection check ─────────────────────────────────────────────

async def test_auth_rejection() -> None:
    """Verify the MCP server rejects requests with an invalid token."""
    print("\n── Test 3: Auth rejection check ─────────────────────────────────")
    import httpx

    async with httpx.AsyncClient() as client:
        response = await client.get(
            HELM_MCP_URL,
            headers={"Authorization": "Bearer invalid-token-xyz"},
        )

    if response.status_code == 401:
        print("✅  Invalid token correctly rejected with 401")
    else:
        print(f"⚠️   Expected 401, got {response.status_code} — check auth middleware")


# ── Entry point ───────────────────────────────────────────────────────────────

async def main() -> None:
    _check_env()
    print(f"MCP URL  : {HELM_MCP_URL}")
    print(f"Model    : {OPENROUTER_MODEL} via OpenRouter")
    print(f"Token    : {HELM_SESSION_TOKEN[:20]}...")

    await test_mcp_connectivity()
    await test_auth_rejection()
    await test_agent_mcp_interaction()

    print("\n✅  All tests complete.")


if __name__ == "__main__":
    asyncio.run(main())
