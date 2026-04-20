"""Keel Demo Server — AI chat backend with inline SDUI rendering.

This server uses an OpenAI-compatible API (default: SiliconFlow) to power
a natural AI chat experience. The AI responds conversationally and uses a
`render_sdui_screen` tool to render interactive Keel SDUI screens inline
when rich UI would be helpful.

Run:
    cd examples/keel-demo/server
    pip install -r requirements.txt
    export SILICONFLOW_API_KEY="your-key"
    uvicorn main:app --reload --port 8765
"""

from __future__ import annotations

import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any
from uuid import uuid4

# Auto-load .env from backend/ if available
_env_path = Path(__file__).resolve().parents[3] / "backend" / ".env"
if _env_path.exists():
    for line in _env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())

from openai import AsyncOpenAI
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from keel_server import ConnectionManager, normalize_sdui_screen
from keel_server.sdui_tools import InMemoryScreenStore


# ── State ────────────────────────────────────────────────────────────────

manager = ConnectionManager()
store = InMemoryScreenStore()

DEMO_USER = "demo-user"

client = AsyncOpenAI(
    api_key=os.environ.get("SILICONFLOW_API_KEY", ""),
    base_url=os.environ.get("SILICONFLOW_BASE_URL", "https://api.siliconflow.cn/v1"),
)

MODEL = os.environ.get("SILICONFLOW_MODEL", "deepseek-ai/DeepSeek-V3")

# ── System Prompt ────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a helpful AI assistant in a mobile chat app.

You can have normal conversations about anything — answer questions, help with tasks, chat casually. Your text responses support markdown formatting (headings, bold, italic, code blocks, lists) — use it freely.

When the user asks about structured topics (forms, tables, schedules, comparisons, recipes, todos, dashboards, data collection), provide a clear, well-organized text response using markdown. The app will automatically convert structured responses into interactive UI.

Be helpful, concise, and use markdown formatting to structure your responses clearly."""


# ── Conversation Manager ─────────────────────────────────────────────────

class Conversation:
    """Manages message history for one WebSocket connection."""

    def __init__(self) -> None:
        self.messages: list[dict[str, Any]] = []

    def add_user(self, text: str) -> None:
        self.messages.append({"role": "user", "content": text})

    def add_assistant(self, text: str) -> None:
        self.messages.append({"role": "assistant", "content": text})

    def add_action_context(self, action_type: str, details: str) -> None:
        self.messages.append({
            "role": "user",
            "content": f"[User interacted with the UI: {action_type}] {details}",
        })

    def trimmed(self, max_turns: int = 40) -> list[dict[str, Any]]:
        if len(self.messages) <= max_turns:
            return self.messages
        trimmed = self.messages[-max_turns:]
        # Ensure we start with a user message
        while trimmed and trimmed[0]["role"] != "user":
            trimmed = trimmed[1:]
        return trimmed


# ── JSON Extraction Fallback ─────────────────────────────────────────────

import re

def _extract_screen_from_text(text: str) -> dict[str, Any] | None:
    """Try to extract an SDUI screen JSON from the AI's text response.

    Some models (e.g. DeepSeek) describe the tool call in text instead of
    actually invoking it. This finds JSON blocks containing "rows" and
    converts them to a normalized SDUI screen.
    """
    # Find JSON blocks in ```json ... ``` or ``` ... ``` fences
    json_blocks = re.findall(r'```(?:json)?\s*\n?([\s\S]*?)\n?```', text)

    for block in json_blocks:
        block = block.strip()
        if not block:
            continue
        try:
            parsed = json.loads(block)
            if isinstance(parsed, dict) and "rows" in parsed:
                raw_screen = {
                    "schema_version": "1.0.0",
                    "module_id": f"ai-{uuid4().hex[:8]}",
                    "title": parsed.get("title", ""),
                    "rows": parsed["rows"],
                }
                return normalize_sdui_screen(raw_screen)
        except (json.JSONDecodeError, Exception):
            continue

    # Try incomplete fenced blocks (model hit max_tokens before closing ```)
    open_fence = re.search(r'```(?:json)?\s*\n?', text)
    if open_fence:
        after_fence = text[open_fence.end():]
        json_start = after_fence.find('{')
        if json_start >= 0 and '"rows"' in after_fence:
            candidate = after_fence[json_start:]
            # Try to repair incomplete JSON by finding the last valid closing brace
            screen = _try_parse_partial_json(candidate)
            if screen:
                return screen

    # Also try to find bare JSON objects with "rows" (no fences)
    brace_depth = 0
    start = -1
    for i, ch in enumerate(text):
        if ch == '{' and brace_depth == 0:
            start = i
        if ch == '{':
            brace_depth += 1
        elif ch == '}':
            brace_depth -= 1
            if brace_depth == 0 and start >= 0:
                candidate = text[start:i + 1]
                if '"rows"' in candidate:
                    try:
                        parsed = json.loads(candidate)
                        if isinstance(parsed, dict) and "rows" in parsed:
                            raw_screen = {
                                "schema_version": "1.0.0",
                                "module_id": f"ai-{uuid4().hex[:8]}",
                                "title": parsed.get("title", ""),
                                "rows": parsed["rows"],
                            }
                            return normalize_sdui_screen(raw_screen)
                    except (json.JSONDecodeError, Exception):
                        pass
                start = -1

    return None


def _try_parse_partial_json(text: str) -> dict[str, Any] | None:
    """Try to parse potentially truncated JSON by progressively trimming from the end."""
    # First try the full text
    try:
        parsed = json.loads(text.strip())
        if isinstance(parsed, dict) and "rows" in parsed:
            return normalize_sdui_screen({
                "schema_version": "1.0.0",
                "module_id": f"ai-{uuid4().hex[:8]}",
                "title": parsed.get("title", ""),
                "rows": parsed["rows"],
            })
    except json.JSONDecodeError:
        pass

    # Try to find the last valid closing brace by scanning backwards
    for i in range(len(text) - 1, 0, -1):
        if text[i] == '}':
            try:
                parsed = json.loads(text[:i + 1])
                if isinstance(parsed, dict) and "rows" in parsed:
                    return normalize_sdui_screen({
                        "schema_version": "1.0.0",
                        "module_id": f"ai-{uuid4().hex[:8]}",
                        "title": parsed.get("title", ""),
                        "rows": parsed["rows"],
                    })
            except json.JSONDecodeError:
                continue

    return None


def _strip_json_blocks(text: str) -> str:
    """Remove JSON code blocks from text after extracting them for rendering."""
    # Remove ```json ... ``` blocks
    cleaned = re.sub(r'```(?:json)?\s*\n?[\s\S]*?\n?```', '', text)
    # Clean up extra whitespace left behind
    cleaned = re.sub(r'\n{3,}', '\n\n', cleaned)
    return cleaned.strip()


_STRUCTURED_PATTERNS = re.compile(
    r'(\|.*\|.*\|'              # markdown tables
    r'|\d+\.\s+\*\*'            # numbered bold items (steps)
    r'|#{1,3}\s+'                # any heading
    r'|- \*\*'                   # bold list items
    r'|Priority|Schedule|Comparison|Recipe|Ingredients'
    r'|Budget|Expense|Form|Survey|Contact'
    r'|Step \d|Todo|Task'
    r')',
    re.IGNORECASE,
)

SCREEN_GEN_PROMPT = """You are a JSON generator. Convert the text below into a mobile UI screen.

Output ONLY valid JSON, nothing else. No markdown, no explanation, just JSON.

The JSON must have this exact structure:
{"title":"TITLE","rows":[{"id":"r1","cells":[{"id":"c1","width":1,"content":COMPONENT}]}]}

Available components:
- {"type":"Text","id":"ID","props":{"content":"TEXT","variant":"heading","bold":true,"color":"#hex"}}
- {"type":"Container","id":"ID","props":{"direction":"row","gap":8,"padding":12,"backgroundColor":"#F5F5F5","borderRadius":8},"children":[...]}
- {"type":"Button","id":"ID","props":{"label":"TEXT","variant":"primary","action":{"type":"send_to_agent","message":"MSG"}}}
- {"type":"Divider","id":"ID","props":{"spacing":12}}
- {"type":"Form","id":"ID","props":{"title":"T","fields":[{"id":"f1","type":"text","label":"L","required":true}],"submit_label":"Submit","submit_action":{"type":"send_to_agent","message":"form submitted"}}}

Rules: max 6 rows, short IDs (r1,c1,t1), use colors for visual appeal.
IMPORTANT: When the user wants to COLLECT, ENTER, or EDIT data (student info, surveys, contact forms, feedback), ALWAYS use the Form component with editable fields — never read-only Text. Use Buttons for actions. Use Text only for display/labels.

Text:
"""


def _looks_structured(text: str) -> bool:
    """Heuristic: does the text contain structured content that should be a screen?"""
    if len(text) < 200:
        return False
    matches = _STRUCTURED_PATTERNS.findall(text)
    return len(matches) >= 3


def _find_rows_in_json(obj: dict) -> dict | None:
    """Find a dict containing 'rows' — at top level or one level deep."""
    if "rows" in obj and isinstance(obj["rows"], list):
        return obj
    for value in obj.values():
        if isinstance(value, dict) and "rows" in value and isinstance(value["rows"], list):
            return value
    return None


async def _generate_screen_from_text(text: str, retries: int = 2) -> dict[str, Any] | None:
    """Second-pass: ask the LLM to convert its text into an SDUI screen JSON.

    Retries up to `retries` times on failure for reliability.
    """
    import logging
    logger = logging.getLogger("keel-demo")

    for attempt in range(1, retries + 1):
        try:
            response = await client.chat.completions.create(
                model=MODEL,
                max_tokens=2048,
                messages=[{
                    "role": "user",
                    "content": SCREEN_GEN_PROMPT + text[:2000],
                }],
                temperature=0.1,
                response_format={"type": "json_object"},
            )
            content = response.choices[0].message.content or ""
            logger.info(f"[screen-gen] attempt {attempt}, raw length={len(content)}")

            # Try to parse JSON from the response
            extracted = _extract_screen_from_text(content)
            if extracted:
                return extracted
            # Try direct parse (model might return bare JSON)
            content = content.strip()
            if content.startswith('{'):
                parsed = json.loads(content)
                # Find "rows" at top level or nested one level deep
                rows_obj = _find_rows_in_json(parsed)
                if rows_obj:
                    raw_screen = {
                        "schema_version": "1.0.0",
                        "module_id": f"ai-{uuid4().hex[:8]}",
                        "title": rows_obj.get("title", parsed.get("title", "")),
                        "rows": rows_obj["rows"],
                    }
                    return normalize_sdui_screen(raw_screen)
            logger.warning(f"[screen-gen] attempt {attempt} failed to parse, content[:200]={content[:200]}")
        except Exception as e:
            logger.warning(f"[screen-gen] attempt {attempt} error: {e}")
    return None


# ── AI Response ──────────────────────────────────────────────────────────

async def get_ai_response(
    conversation: Conversation,
    websocket: WebSocket,
) -> tuple[str, dict[str, Any] | None]:
    """Two-pass approach: first generate text, then generate SDUI screen if needed."""

    # ── Pass 1: Stream conversational text ──
    import time as _time
    pass1_start = _time.monotonic()
    collected_text = ""
    messages = [{"role": "system", "content": SYSTEM_PROMPT}] + conversation.trimmed()

    try:
        stream = await client.chat.completions.create(
            model=MODEL,
            max_tokens=2048,
            messages=messages,
            stream=True,
        )
    except Exception as e:
        error_text = f"Sorry, I couldn't process your request: {e}"
        await websocket.send_json({"type": "text_delta", "delta": error_text})
        conversation.add_assistant(error_text)
        return error_text, None

    async for chunk in stream:
        delta = chunk.choices[0].delta if chunk.choices else None
        if not delta:
            continue
        if delta.content:
            collected_text += delta.content
            await websocket.send_json({
                "type": "text_delta",
                "delta": delta.content,
            })

    pass1_elapsed = _time.monotonic() - pass1_start

    # ── Check for inline JSON in text (model sometimes outputs it) ──
    screen = None
    extracted = _extract_screen_from_text(collected_text)
    if extracted:
        screen = extracted
        collected_text = _strip_json_blocks(collected_text)

    # ── Pass 2: Generate SDUI screen if text is structured ──
    # Use fewer retries if Pass 1 was slow (to avoid total timeout)
    if screen is None and _looks_structured(collected_text):
        retries = 1 if pass1_elapsed > 40 else 2
        screen = await _generate_screen_from_text(collected_text, retries=retries)

    # Save to conversation history
    conversation.add_assistant(collected_text)

    return collected_text, screen


# ── WebSocket Endpoint ───────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="Keel Demo Server", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "connected_users": len(manager.connected_user_ids)}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for AI chat with inline SDUI.

    Protocol:
    - Client sends: {"type": "send_to_agent", "message": "..."}
    - Client sends: {"type": "server_action", "function": "...", "params": {...}}
    - Client sends: {"type": "form_submit", "form_id": "...", "data": {...}}
    - Server streams: {"type": "text_delta", "delta": "..."}
    - Server sends:   {"type": "response_done", "text": "...", "screen": <SDUIPage> | null}
    """
    await manager.connect(websocket, user_id=DEMO_USER)
    conversation = Conversation()

    # Send welcome message
    await websocket.send_json({
        "type": "response_done",
        "text": "Hey! I'm your AI assistant. Ask me anything — I can chat, answer questions, and when it helps, I'll show you interactive UI like forms, dashboards, and more. What's on your mind?",
        "screen": None,
    })

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                await websocket.send_json({
                    "type": "response_done",
                    "text": "Sorry, I received a malformed message.",
                    "screen": None,
                })
                continue
            action_type = data.get("type", "")

            if action_type == "send_to_agent":
                message = data.get("message", "")
                conversation.add_user(message)

            elif action_type == "server_action":
                fn = data.get("function", "unknown")
                params = data.get("params")
                conversation.add_action_context(
                    "server_action",
                    f"Called function '{fn}' with params: {json.dumps(params or {})}",
                )

            elif action_type == "form_submit":
                form_id = data.get("form_id", "")
                form_data = data.get("data", {})
                conversation.add_action_context(
                    "form_submit",
                    f"Submitted form '{form_id}' with data: {json.dumps(form_data)}",
                )

            else:
                conversation.add_action_context(action_type, json.dumps(data))

            # Get AI response with streaming
            text, screen = await get_ai_response(conversation, websocket)

            # Save screen if present
            if screen:
                await store.save_screen(
                    DEMO_USER,
                    screen.get("module_id", "dynamic"),
                    screen,
                )

            # Send final response
            await websocket.send_json({
                "type": "response_done",
                "text": text,
                "screen": screen,
            })

    except WebSocketDisconnect:
        await manager.disconnect(websocket, user_id=DEMO_USER)
    except Exception:
        await manager.disconnect(websocket, user_id=DEMO_USER)
        raise
