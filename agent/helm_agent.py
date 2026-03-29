"""Helm PydanticAI Agent — standalone developer/admin agent for Helm.

This agent runs independently of the Helm backend.  It connects to Helm's MCP
server over HTTP (authenticated with a session token) and also has local tools
that can read and write files in the mobile/frontend directory.

Usage
-----
    # From the repo root (Helm/) with the backend venv activated:
    source backend/.venv/bin/activate
    cd agent

    # Web UI (pydantic-ai's built-in browser chat interface):
    python helm_agent.py --web              # opens at http://localhost:7860
    python helm_agent.py --web --port 8080  # custom port

    # Interactive terminal REPL:
    python helm_agent.py

    # One-shot task:
    python helm_agent.py "Show me all calendar events for tomorrow"
    python helm_agent.py "Read mobile/app/(tabs)/chat.tsx and summarise it"

Required environment variables (in Helm/.env or exported):
    HELM_SESSION_TOKEN   — get one by calling POST /auth/login
    OPENROUTER_API_KEY   — get one at https://openrouter.ai/keys
    HELM_MCP_URL         — defaults to http://localhost:8000/mcp/
    OPENROUTER_MODEL     — defaults to stepfun/step-3.5-flash:free
    AGENT_WEB_PORT       — web server port (defaults to 7860)

Architecture
-----------
    ┌──────────────────────────────────────────────────┐
    │  helm_agent.py (standalone — no backend imports) │
    │                                                  │
    │  Three modes:                                    │
    │    --web  → pydantic-ai built-in web chat UI     │
    │    REPL   → interactive terminal session         │
    │    task   → one-shot command-line execution      │
    │                                                  │
    │  PydanticAI Agent                                │
    │    ├── MCPServerStreamableHTTP                   │
    │    │     → Helm backend /mcp  (9 Helm tools)    │
    │    └── Local filesystem tools                    │
    │          read_frontend_file()                    │
    │          write_frontend_file()                   │
    │          list_frontend_files()                   │
    └──────────────────────────────────────────────────┘

The filesystem tools are deliberately restricted to the mobile/ directory so
the agent cannot accidentally modify backend code or other sensitive files.
"""

from __future__ import annotations

import asyncio
import os
import sys
from pathlib import Path

# ── Load .env from repo root ──────────────────────────────────────────────────
# agent/ is one level below the repo root so ".." resolves to the root.
_REPO_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(_REPO_ROOT))  # allows `from backend.app...` if ever needed

from dotenv import load_dotenv
load_dotenv(_REPO_ROOT / ".env")

# ── Config from environment ───────────────────────────────────────────────────
HELM_SESSION_TOKEN: str = os.environ.get("HELM_SESSION_TOKEN", "")
HELM_MCP_URL: str = os.environ.get("HELM_MCP_URL", "http://localhost:8000/mcp/")
OPENROUTER_API_KEY: str = os.environ.get("OPENROUTER_API_KEY", "")
OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"
# Override with OPENROUTER_MODEL in Helm/.env to use a different model:
#   OPENROUTER_MODEL=anthropic/claude-3.5-sonnet
#   OPENROUTER_MODEL=openai/gpt-4o
# pydantic-ai handles reasoning/thinking models (delta.reasoning) transparently.
OPENROUTER_MODEL: str = os.environ.get("OPENROUTER_MODEL", "stepfun/step-3.5-flash:free")
AGENT_WEB_PORT: int = int(os.environ.get("AGENT_WEB_PORT", "7860"))

# The agent's filesystem tools are restricted to this directory:
_MOBILE_ROOT = _REPO_ROOT / "mobile"

# ── Shared system prompt ──────────────────────────────────────────────────────
_SYSTEM_PROMPT = (
    "You are Helm Agent — an autonomous AI assistant integrated with the Helm "
    "self-hosted AI super app.\n\n"
    "You have two sets of tools:\n"
    "1. Helm MCP tools (helm_*): interact with the live Helm backend — read/write "
    "calendar events, send notifications, read/write chat messages, update module "
    "states, and set SDUI screens.\n"
    "2. Frontend filesystem tools: read, list, and write files inside the mobile/ "
    "React Native (Expo) frontend directory.  Use these to inspect or edit "
    "TypeScript/TSX source code.\n\n"
    "## Server-Driven UI (SDUI) — Primary Way to Build Dynamic Screens\n\n"
    "Use helm_set_screen(module_id, screen) to generate a complete native UI "
    "screen instantly — no code changes, no app rebuild.  The frontend re-renders "
    "live via WebSocket the moment you call it.\n\n"
    "Available module_ids: home | chat | calendar | forms | alerts | modules | settings\n\n"
    "Every tab is a pure SDUI shell — you can set ANY screen to any content, "
    "replace it with new content, or blank it completely with helm_delete_screen.\n"
    "Use helm_list_screens() to see which tabs currently have AI-generated content.\n"
    "Use helm_delete_screen(module_id) to clear a screen (tab returns to empty state).\n\n"
    "The screen argument must be a dict following the SDUIScreen schema:\n"
    "  { schema_version: 1, module_id, title, sections: [SDUISection, ...] }\n\n"
    "Each section has { id, title?, component: SDUIComponent }.\n\n"
    "Component types and their key props:\n"
    "  heading     { content, level (1-3), align? }\n"
    "  text        { content, size (xs/sm/md/lg), bold?, italic?, color? }\n"
    "  button      { label, variant (primary/secondary/destructive/ghost), action }\n"
    "  stats_row   { stats: [{label, value, change?, change_direction (up/down/neutral)}] }\n"
    "  stat        { label, value, change?, change_direction?, icon? }\n"
    "  list        { title?, items: [{id, title, subtitle?, badge?, icon?, action?}] }\n"
    "  card        { title?, subtitle?, elevated? } + children[]\n"
    "  container   { direction (row/column), gap?, wrap? } + children[]\n"
    "  alert       { severity (info/warning/error/success), title, message }\n"
    "  progress    { value (0-100), max?, label?, color? }\n"
    "  calendar    { events: [{id, title, start (ISO), end (ISO), color?}] }\n"
    "  divider     { spacing? }\n"
    "  spacer      { size (xs/sm/md/lg/xl) }\n"
    "  badge       { label, color (blue/green/red/yellow/gray) }\n"
    "  image       { uri, aspect_ratio?, alt? }\n"
    "  form        { title?, fields: [...], submit_label?, submit_action }\n\n"
    "Action types: { type:'navigate', screen } | { type:'api_call', method, path, body? } "
    "| { type:'dismiss' } | { type:'copy_text', text } | { type:'open_url', url }\n\n"
    "When building screens, prefer stats_row for key metrics, list for data, "
    "heading + text for summaries, and card/container for grouping.  Always include "
    "a generated_at ISO timestamp.\n\n"
    "## Calendar & Data Tools\n"
    "- Use bulk operations: helm_delete_all_events over looping helm_delete_event.\n"
    "- Use helm_read_all_calendar when you need the full calendar instead of guessing a date range.\n"
    "- Never show internal UUIDs to users.\n"
    "- Format dates as 'Monday Apr 7, 9:00–10:00 AM'.\n\n"
    "## Frontend Code Editing\n"
    "- Always read a file before modifying it.\n"
    "- Preserve existing code style (TypeScript strict, functional components, named exports).\n"
    "- Explain what you changed and why.\n\n"
    "Be concise, accurate, and confirm every action you take."
)


# ── Validation ────────────────────────────────────────────────────────────────

def _check_env() -> None:
    missing: list[str] = []
    if not HELM_SESSION_TOKEN:
        missing.append(
            "HELM_SESSION_TOKEN  — get one: POST /auth/login → copy session_token"
        )
    if not OPENROUTER_API_KEY:
        missing.append(
            "OPENROUTER_API_KEY  — get one: https://openrouter.ai/keys"
        )
    if missing:
        print("❌  Missing required environment variables:")
        for m in missing:
            print(f"    • {m}")
        sys.exit(1)


# ── Local filesystem tools (restricted to mobile/) ───────────────────────────

def _safe_mobile_path(relative_path: str) -> Path:
    """Resolve a path inside mobile/ and raise if it escapes the directory.

    The path must be relative (e.g. 'app/(tabs)/chat.tsx').  Absolute paths
    are rejected.  Path traversal attempts (../../etc/passwd) are blocked by
    comparing the resolved path against _MOBILE_ROOT.
    """
    if Path(relative_path).is_absolute():
        raise ValueError(f"Path must be relative, got: {relative_path!r}")
    resolved = (_MOBILE_ROOT / relative_path).resolve()
    try:
        resolved.relative_to(_MOBILE_ROOT.resolve())
    except ValueError:
        raise ValueError(
            f"Path {relative_path!r} escapes the mobile/ directory — not allowed."
        )
    return resolved


async def read_frontend_file(relative_path: str) -> str:
    """Read a file from the mobile/ frontend directory.

    Args:
        relative_path: Path relative to mobile/, e.g. 'app/(tabs)/chat.tsx'

    Returns:
        The full text content of the file.
    """
    path = _safe_mobile_path(relative_path)
    if not path.exists():
        return f"ERROR: File not found: mobile/{relative_path}"
    if not path.is_file():
        return f"ERROR: {relative_path!r} is a directory, not a file."
    return path.read_text(encoding="utf-8")


async def write_frontend_file(relative_path: str, content: str) -> str:
    """Write (or overwrite) a file in the mobile/ frontend directory.

    This creates parent directories automatically.  Use this to edit existing
    files or create new ones in the React Native / Expo frontend.

    Args:
        relative_path: Path relative to mobile/, e.g. 'app/(tabs)/chat.tsx'
        content: The full new content of the file (replaces existing content).

    Returns:
        A confirmation message or error description.
    """
    path = _safe_mobile_path(relative_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return f"✅  Wrote {len(content):,} chars to mobile/{relative_path}"


_SKIP_DIRS = frozenset({
    "node_modules", ".expo", ".git", "__pycache__", ".cache",
    "dist", "build", ".venv", ".idea", ".vscode", "coverage",
})


async def list_frontend_files(subdirectory: str = "") -> str:
    """List files and directories inside mobile/ (or a subdirectory of it).

    Skips heavy/irrelevant directories (node_modules, .expo, .git, etc.) so
    the output stays focused on project source files.

    Args:
        subdirectory: Optional path relative to mobile/, e.g. 'app/(tabs)'
                      Leave empty to list the top-level mobile/ contents.

    Returns:
        A newline-separated list of paths relative to mobile/.
    """
    import os as _os

    base = _MOBILE_ROOT if not subdirectory else _safe_mobile_path(subdirectory)
    if not base.exists():
        return f"ERROR: directory not found: mobile/{subdirectory}"

    lines: list[str] = []
    for dirpath, dirnames, filenames in _os.walk(base):
        # Prune skipped dirs IN-PLACE — prevents os.walk from descending into them
        dirnames[:] = sorted(d for d in dirnames if d not in _SKIP_DIRS)
        dp = Path(dirpath)
        try:
            rel_dir = dp.relative_to(_MOBILE_ROOT)
        except ValueError:
            continue
        for d in dirnames:
            lines.append(f"{rel_dir / d}/")
        for f in sorted(filenames):
            lines.append(str(rel_dir / f))
    return "\n".join(lines) if lines else "(empty)"


# ── Agent factory (shared by all modes) ──────────────────────────────────────

def _build_agent():
    """Build and return a configured pydantic_ai Agent."""
    from pydantic_ai import Agent
    from pydantic_ai.mcp import MCPServerStreamableHTTP
    from pydantic_ai.models.openai import OpenAIChatModel
    from pydantic_ai.providers.openai import OpenAIProvider

    provider = OpenAIProvider(
        base_url=OPENROUTER_BASE_URL,
        api_key=OPENROUTER_API_KEY,
    )
    model = OpenAIChatModel(OPENROUTER_MODEL, provider=provider)

    helm_mcp = MCPServerStreamableHTTP(
        url=HELM_MCP_URL,
        headers={"Authorization": f"Bearer {HELM_SESSION_TOKEN}"},
        timeout=30,
    )

    return Agent(
        model=model,
        mcp_servers=[helm_mcp],
        tools=[read_frontend_file, write_frontend_file, list_frontend_files],
        system_prompt=_SYSTEM_PROMPT,
    )


# ── Web UI (pydantic-ai built-in) ─────────────────────────────────────────────

def _run_web(host: str, port: int) -> None:
    """Start pydantic-ai's built-in web chat UI.

    Uses pydantic_ai.ui._web.create_web_app() with a local HTML file so the UI
    works without internet access (the default CDN at cdn.jsdelivr.net may be
    unreachable in some environments).  The local chat_ui.html sits next to this
    file and sends requests to the /api endpoints that create_web_app() mounts.
    """
    import uvicorn
    from pydantic_ai.ui._web import create_web_app

    # Use the self-contained local UI instead of fetching from CDN.
    _local_ui = Path(__file__).parent / "chat_ui.html"

    agent = _build_agent()
    app = create_web_app(agent, html_source=_local_ui)

    print("⎈  Helm Agent Web UI")
    print(f"   Model   : {OPENROUTER_MODEL}")
    print(f"   MCP URL : {HELM_MCP_URL}")
    print(f"   Open    : http://localhost:{port}")
    print()

    # uvicorn.run() manages its own event loop — do NOT wrap in asyncio.run()
    uvicorn.run(app, host=host, port=port, log_level="warning")


# ── One-shot runner ───────────────────────────────────────────────────────────

async def run_agent(task: str) -> None:
    """Run a single agent turn with the given task string and print the response."""
    agent = _build_agent()

    print(f"Model   : {OPENROUTER_MODEL}")
    print(f"MCP URL : {HELM_MCP_URL}")
    print(f"Task    : {task}\n")
    print("─" * 60)

    async with agent:
        result = await agent.run(task)

    print("\n" + "─" * 60)
    print("Agent response:\n")
    print(result.output)


# ── Interactive REPL ──────────────────────────────────────────────────────────

async def interactive_repl() -> None:
    """Simple interactive loop — type tasks, the agent executes them."""
    agent = _build_agent()

    print("⎈  Helm Agent — interactive mode")
    print(f"   Model   : {OPENROUTER_MODEL}")
    print(f"   MCP URL : {HELM_MCP_URL}")
    print("   Type 'quit' or Ctrl-C to exit.\n")

    async with agent:
        conversation_history = None
        while True:
            try:
                task = input("You: ").strip()
            except (KeyboardInterrupt, EOFError):
                print("\nBye!")
                break

            if not task:
                continue
            if task.lower() in ("quit", "exit", "q"):
                print("Bye!")
                break

            try:
                result = await agent.run(task, message_history=conversation_history)
                # Carry conversation context forward so the agent remembers prior turns
                conversation_history = result.all_messages()
                print(f"\nAgent: {result.output}\n")
            except Exception as exc:
                print(f"\n❌  Error: {exc}\n")


# ── Entry point ───────────────────────────────────────────────────────────────

def _parse_args():
    import argparse
    parser = argparse.ArgumentParser(
        prog="helm_agent",
        description="Helm PydanticAI Agent — MCP + frontend editor",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=(
            "examples:\n"
            "  python helm_agent.py --web               # web UI at http://localhost:7860\n"
            "  python helm_agent.py --web --port 8080   # custom port\n"
            "  python helm_agent.py                     # interactive REPL\n"
            "  python helm_agent.py 'list my calendar'  # one-shot task\n"
        ),
    )
    parser.add_argument("--web", action="store_true", help="Start web chat UI")
    parser.add_argument(
        "--port",
        type=int,
        default=AGENT_WEB_PORT,
        help=f"Web server port (default: {AGENT_WEB_PORT})",
    )
    parser.add_argument("--host", default="0.0.0.0", help="Web server host (default: 0.0.0.0)")
    parser.add_argument("task", nargs="*", help="One-shot task text (non-web mode only)")
    return parser.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    _check_env()

    if args.web:
        # Web mode: uvicorn manages its own event loop
        _run_web(args.host, args.port)
    else:
        # REPL / one-shot: use asyncio.run()
        async def _async_main() -> None:
            if args.task:
                await run_agent(" ".join(args.task))
            else:
                await interactive_repl()

        asyncio.run(_async_main())
