"""Serve the PydanticAI built-in web chat UI for the Helm agent.

Usage:
    cd backend
    python -m agent.web

Then open http://localhost:8001 in your browser.
"""

from __future__ import annotations

import os

import uvicorn

from agent.agent import build_agent


def main() -> None:
    model = os.getenv("HELM_AGENT_MODEL", "anthropic/claude-sonnet-4-5")
    agent = build_agent(model)

    # agent.to_web() returns a Starlette ASGI application.
    # Extra models listed here will be selectable in the UI dropdown.
    app = agent.to_web(
        models=[
            "anthropic/claude-sonnet-4-5",
            "anthropic/claude-opus-4-5",
            "openai/gpt-4o",
            "openai/gpt-4o-mini",
        ]
    )

    port = int(os.getenv("HELM_AGENT_PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)


if __name__ == "__main__":
    main()
