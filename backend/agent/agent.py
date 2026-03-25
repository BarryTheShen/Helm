"""Helm PydanticAI agent — connects to the local MCP server via Streamable HTTP.

Usage (CLI):
    cd backend
    python -m agent.agent

Usage (web UI):
    cd backend
    python -m agent.web

Environment variables (set in .env at project root):
    OPENROUTER_API_KEY  — required
    HELM_SESSION_TOKEN  — Bearer token for the Helm MCP server
    HELM_MCP_URL        — default: http://localhost:8000/mcp
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic_ai import Agent
from pydantic_ai.mcp import MCPServerStreamableHTTP
from pydantic_ai.models.openrouter import OpenRouterModel
from pydantic_ai.providers.openrouter import OpenRouterProvider

# Load .env from project root (two levels up from this file)
_env_path = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(_env_path)


def build_agent(
    model_name: str = "anthropic/claude-sonnet-4-5",
) -> Agent:
    """Build and return the Helm agent.

    Args:
        model_name: Any OpenRouter model string, e.g.
            ``"anthropic/claude-sonnet-4-5"`` or ``"openai/gpt-4o"``.
    """
    api_key = os.environ["OPENROUTER_API_KEY"]
    session_token = os.getenv("HELM_SESSION_TOKEN", "")
    mcp_url = os.getenv("HELM_MCP_URL", "http://localhost:8000/mcp")

    headers: dict[str, str] = {}
    if session_token:
        headers["Authorization"] = f"Bearer {session_token}"

    mcp_server = MCPServerStreamableHTTP(mcp_url, headers=headers)

    model = OpenRouterModel(
        model_name,
        provider=OpenRouterProvider(api_key=api_key),
    )

    return Agent(
        model,
        toolsets=[mcp_server],
        system_prompt=(
            "You are Helm, an agentic AI assistant. "
            "Use the available tools to help the user manage their tasks, "
            "calendar, notifications, workflows, and more."
        ),
    )


# Module-level default agent (lazy initialisation — only created on first import
# in an environment where OPENROUTER_API_KEY is set).
agent: Agent | None = None


def get_agent() -> Agent:
    """Return the module-level agent, creating it on first call."""
    global agent  # noqa: PLW0603
    if agent is None:
        agent = build_agent()
    return agent


if __name__ == "__main__":
    import asyncio

    async def _main() -> None:
        a = get_agent()
        result = await a.run("List my upcoming calendar events.")
        print(result.output)

    asyncio.run(_main())
