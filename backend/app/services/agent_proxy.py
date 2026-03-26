"""Agent proxy — streams LLM responses to the iOS app via WebSocket.

Flow:
  1. Receive user message from WebSocket handler
  2. Load agent config + chat history from DB; persist user message immediately
  3. Agentic loop:
       a. Stream one LLM turn, accumulating tool-call deltas correctly
       b. If finish_reason == "tool_calls": execute tools, append results, loop
       c. Else: done — persist assistant message and send chat_complete
  4. Up to _MAX_TOOL_TURNS to prevent infinite loops

Root-cause notes:
  - User messages were lost: db.flush() without db.commit() inside async-with block.
    Fixed: db.commit() is called immediately after adding the user message.
  - "Unknown tool" errors: tool-call arguments arrive as delta chunks across many SSE
    lines. The old code called execute_tool() per-chunk (with partial / empty name).
    Fixed: accumulate all tool-call deltas by index, execute only after stream ends.
  - No multi-turn: tool results were never fed back to the LLM.
    Fixed: proper agentic loop appends tool messages and issues a follow-up stream.
"""

import json
from uuid import uuid4

import httpx
from loguru import logger
from sqlalchemy import select

from app.config import settings
from app.database import AsyncSessionLocal
from app.models.agent_config import AgentConfig
from app.models.chat_message import ChatMessage
from app.services.websocket_manager import manager

DEFAULT_SYSTEM_PROMPT = (
    "You are Helm, a helpful AI assistant integrated into a personal super app. "
    "You have access to tools for calendar management, notifications, and forms. "
    "Be concise, helpful, and proactive."
)

_MAX_TOOL_TURNS = 5  # safety cap on agentic loop iterations


async def handle_chat_message(
    user_id: str,
    content: str,
    conversation_id: str | None = None,
) -> None:
    """Entry point called from WebSocket handler (runs as background task)."""
    try:
        await _process_chat(user_id, content, conversation_id)
    except Exception as exc:
        logger.exception(f"Agent proxy error for user={user_id}: {exc}")
        await manager.send(user_id, {
            "type": "chat_error",
            "message": "An error occurred processing your message.",
        })


async def _process_chat(
    user_id: str,
    content: str,
    conversation_id: str | None,
) -> None:
    # ── Load config + history; save user message with commit ──────────────────
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(AgentConfig).where(
                AgentConfig.user_id == user_id,
                AgentConfig.is_active == True,  # noqa: E712
            )
        )
        agent_config = result.scalar_one_or_none()

        api_key = _resolve_api_key(agent_config)
        model = (agent_config.model if agent_config else None) or settings.openrouter_model or settings.openai_model
        base_url = (agent_config.base_url if agent_config else None) or settings.openrouter_base_url or settings.openai_base_url
        system_prompt = (agent_config.system_prompt if agent_config else None) or DEFAULT_SYSTEM_PROMPT
        temperature = agent_config.temperature if agent_config else 0.7
        max_tokens = agent_config.max_tokens if agent_config else 4096

        history_result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.user_id == user_id)
            .order_by(ChatMessage.created_at.desc())
            .limit(20)
        )
        history = list(reversed(history_result.scalars().all()))

        # Persist user message immediately so it's stored even if LLM fails.
        # Bug fix: previous code used db.flush() with no commit — message was lost.
        user_msg = ChatMessage(
            id=str(uuid4()),
            user_id=user_id,
            role="user",
            content=content,
        )
        db.add(user_msg)
        await db.commit()

    await manager.send(user_id, {"type": "chat_start", "message_id": str(uuid4())})

    if not api_key:
        await manager.send(user_id, {
            "type": "chat_error",
            "code": "no_api_key",
            "message": "No API key configured. Please set your AI provider key in Settings.",
        })
        return

    # Build initial message list from history
    messages: list[dict] = [{"role": "system", "content": system_prompt}]
    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": content})

    assistant_msg_id = str(uuid4())
    full_response = ""

    try:
        # ── Agentic loop ──────────────────────────────────────────────────────
        for _turn in range(_MAX_TOOL_TURNS):
            response_text, tool_calls, finish_reason = await _stream_one_turn(
                user_id=user_id,
                messages=messages,
                api_key=api_key,
                base_url=base_url,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                assistant_msg_id=assistant_msg_id,
            )
            full_response += response_text

            # If no tool calls requested, we're done
            if finish_reason != "tool_calls" or not tool_calls:
                break

            # Append assistant turn (with tool_calls) to message history so the
            # LLM can see what it asked for before we append the results.
            messages.append({
                "role": "assistant",
                "content": response_text or None,
                "tool_calls": [
                    {
                        "id": tc["id"],
                        "type": "function",
                        "function": {"name": tc["name"], "arguments": tc["arguments"]},
                    }
                    for tc in tool_calls
                ],
            })

            # Execute each tool and append its result as a "tool" message
            for tc in tool_calls:
                result = await _execute_tool_safe(user_id, tc["name"], tc["arguments"])
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": json.dumps(result),
                })
            # Loop: next iteration streams the follow-up response

    except httpx.RequestError as exc:
        logger.error(f"Network error calling LLM: {exc}")
        await manager.send(user_id, {
            "type": "chat_error",
            "message": "Network error reaching AI provider. Please check your connection.",
        })
        return

    # ── Persist assistant message ─────────────────────────────────────────────
    async with AsyncSessionLocal() as db:
        assistant_msg = ChatMessage(
            id=assistant_msg_id,
            user_id=user_id,
            role="assistant",
            content=full_response,
        )
        db.add(assistant_msg)
        await db.commit()

    await manager.send(user_id, {
        "type": "chat_complete",
        "message_id": assistant_msg_id,
        "content": full_response,
    })


async def _stream_one_turn(
    user_id: str,
    messages: list[dict],
    api_key: str,
    base_url: str,
    model: str,
    temperature: float,
    max_tokens: int,
    assistant_msg_id: str,
) -> tuple[str, list[dict], str]:
    """Stream a single LLM turn.

    Returns (content_text, accumulated_tool_calls, finish_reason).

    Tool-call fix: the OpenAI streaming protocol sends tool-call data across
    multiple SSE chunks — first chunk has the call ID + name, subsequent chunks
    have partial argument strings. We accumulate by delta index and only return
    complete calls after the stream ends.
    """
    content = ""
    # index → {id, name, arguments_so_far}
    pending_tool_calls: dict[int, dict] = {}
    finish_reason = "stop"

    async with httpx.AsyncClient(timeout=120.0) as client:
        async with client.stream(
            "POST",
            f"{base_url.rstrip('/')}/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": "https://github.com/BarryTheShen/Helm",
                "X-Title": "Helm",
            },
            json={
                "model": model,
                "messages": messages,
                "stream": True,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "tools": _get_tool_definitions(),
                "tool_choice": "auto",
            },
        ) as response:
            if response.status_code != 200:
                body = await response.aread()
                logger.error(f"LLM API error {response.status_code}: {body}")
                await manager.send(user_id, {
                    "type": "chat_error",
                    "message": f"AI provider returned error {response.status_code}.",
                })
                return content, [], finish_reason

            async for line in response.aiter_lines():
                if not line or not line.startswith("data: "):
                    continue
                chunk = line[6:].strip()
                if chunk == "[DONE]":
                    break
                try:
                    data = json.loads(chunk)
                except json.JSONDecodeError:
                    continue

                choice = data.get("choices", [{}])[0]
                delta = choice.get("delta", {})
                fr = choice.get("finish_reason")
                if fr:
                    finish_reason = fr

                # Regular content tokens — stream immediately to client
                token = delta.get("content") or ""
                if token:
                    content += token
                    await manager.send(user_id, {
                        "type": "chat_token",
                        "message_id": assistant_msg_id,
                        "token": token,
                    })

                # Accumulate tool-call deltas by index.
                # Do NOT execute here — arguments arrive across many chunks.
                for tc_chunk in (delta.get("tool_calls") or []):
                    idx = tc_chunk.get("index", 0)
                    if idx not in pending_tool_calls:
                        pending_tool_calls[idx] = {"id": "", "name": "", "arguments": ""}
                    if tc_chunk.get("id"):
                        pending_tool_calls[idx]["id"] = tc_chunk["id"]
                    fn = tc_chunk.get("function", {})
                    if fn.get("name"):
                        pending_tool_calls[idx]["name"] = fn["name"]
                    pending_tool_calls[idx]["arguments"] += fn.get("arguments", "")

    tool_calls_list = [v for _, v in sorted(pending_tool_calls.items())]
    return content, tool_calls_list, finish_reason


async def _execute_tool_safe(user_id: str, name: str, arguments_str: str) -> dict:
    """Execute a named tool, returning its result or an error dict."""
    from app.mcp.tools import execute_tool

    try:
        args = json.loads(arguments_str) if arguments_str.strip() else {}
    except json.JSONDecodeError:
        args = {}

    logger.info(f"Executing tool: {name}({args}) for user={user_id}")
    try:
        result = await execute_tool(name, args, user_id)
        await manager.send(user_id, {"type": "tool_result", "tool": name, "result": result})
        return result if isinstance(result, dict) else {"result": result}
    except Exception as exc:
        logger.error(f"Tool {name} failed: {exc}")
        await manager.send(user_id, {"type": "tool_error", "tool": name, "message": str(exc)})
        return {"error": str(exc)}


def _resolve_api_key(agent_config: AgentConfig | None) -> str | None:
    """Resolve the API key: per-user DB config → OpenRouter env → OpenAI env."""
    raw = agent_config.api_key_encrypted if agent_config else None
    if raw:
        try:
            from app.routers.agent_config import _decrypt_api_key
            decrypted = _decrypt_api_key(raw)
            if decrypted and decrypted not in ("test_key", "placeholder", ""):
                return decrypted
        except Exception:
            pass
    if settings.openrouter_api_key:
        return settings.openrouter_api_key
    if settings.openai_api_key:
        return settings.openai_api_key
    return None


def _get_tool_definitions() -> list[dict]:
    """Return OpenAI-compatible tool definitions for the agent."""
    return [
        {
            "type": "function",
            "function": {
                "name": "read_calendar",
                "description": "Get calendar events for a date range",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "start_date": {"type": "string", "format": "date", "description": "Start date (YYYY-MM-DD)"},
                        "end_date": {"type": "string", "format": "date", "description": "End date (YYYY-MM-DD)"},
                    },
                    "required": ["start_date", "end_date"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "create_event",
                "description": "Create a new calendar event",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "start_time": {"type": "string", "format": "date-time"},
                        "end_time": {"type": "string", "format": "date-time"},
                        "description": {"type": "string"},
                        "color": {"type": "string"},
                        "location": {"type": "string"},
                    },
                    "required": ["title", "start_time", "end_time"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "send_notification",
                "description": "Send a notification to the user's app",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "title": {"type": "string"},
                        "message": {"type": "string"},
                        "severity": {"type": "string", "enum": ["info", "warning", "error", "success"]},
                    },
                    "required": ["title", "message", "severity"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "update_module_state",
                "description": "Update the UI state of a module",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "module_type": {"type": "string", "enum": ["calendar", "alerts", "form"]},
                        "state": {"type": "object", "description": "Full SDUI JSON payload"},
                    },
                    "required": ["module_type", "state"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "get_chat_history",
                "description": "Get recent chat messages",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "limit": {"type": "integer", "default": 20},
                    },
                },
            },
        },
    ]
