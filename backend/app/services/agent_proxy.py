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
import re
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

                # Regular content tokens — stream immediately to client.
                # Reasoning/thinking models (stepfun, DeepSeek-R1, QwQ, etc.) emit
                # tokens in delta.reasoning rather than delta.content.  pydantic-ai
                # handles this transparently; our raw SSE loop must do so explicitly.
                token = delta.get("content") or delta.get("reasoning") or ""
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

    # Fallback: some models (e.g. stepfun/step-3.5-flash) don't use the OpenAI
    # function-calling protocol and instead embed tool calls as <tool_call> XML
    # inside the text content.  Detect, parse, and remove them so the agentic
    # loop still fires tools and the user never sees raw XML in the chat.
    if not tool_calls_list and "<tool_call>" in content:
        cleaned_content, xml_tool_calls = _parse_xml_tool_calls(content)
        if xml_tool_calls:
            await manager.send(user_id, {
                "type": "chat_message_replace",
                "message_id": assistant_msg_id,
                "content": cleaned_content,
            })
            content = cleaned_content
            tool_calls_list = xml_tool_calls
            finish_reason = "tool_calls"

    return content, tool_calls_list, finish_reason


def _parse_xml_tool_calls(content: str) -> tuple[str, list[dict]]:
    """Extract <tool_call>...</tool_call> blocks from model-generated text.

    Some models (e.g. stepfun) embed tool invocations as XML in the response
    text instead of using the OpenAI function-calling delta format.  This
    helper strips those blocks and returns them as the same dict shape the
    agentic loop expects: [{id, name, arguments}].
    """
    tool_calls: list[dict] = []

    def _extract(match: re.Match) -> str:
        try:
            raw_json = match.group(1).strip()
            payload = json.loads(raw_json)
            name = payload.get("name", "")
            args = payload.get("arguments", {})
            tool_calls.append({
                "id": str(uuid4()),
                "name": name,
                "arguments": json.dumps(args) if isinstance(args, dict) else str(args),
            })
        except (json.JSONDecodeError, AttributeError) as e:
            logger.warning(f"Failed to parse XML tool call: {e!r} — raw={match.group(1)[:200]!r}")
        return ""

    cleaned = re.sub(r"<tool_call>(.*?)</tool_call>", _extract, content, flags=re.DOTALL)
    return cleaned.strip(), tool_calls


async def _execute_tool_safe(user_id: str, name: str, arguments_str: str) -> dict:
    """Execute a named tool, returning its result or an error dict."""
    from app.mcp.tools import execute_tool

    try:
        args = json.loads(arguments_str) if arguments_str.strip() else {}
    except json.JSONDecodeError as e:
        logger.warning(f"Tool {name} JSON decode error: {e} — arguments_str={repr(arguments_str[:200])}")
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
        {
            "type": "function",
            "function": {
                "name": "set_screen",
                "description": (
                    "Set the Server-Driven UI screen for any app tab. "
                    "The frontend re-renders instantly via WebSocket — no code changes or rebuild needed. "
                    "Call this to build any UI: dashboards, forms, calendars, lists, stats, or combinations. "
                    "You can call it multiple times on the same module_id to update the screen. "
                    "\n\nAvailable module_ids: home | chat | calendar | forms | alerts | modules | settings"
                    "\n\nscreen must follow SDUIScreen schema:\n"
                    "{ schema_version:1, module_id, title, sections:[{id, title?, component}] }\n\n"
                    "Component types (use 'type' field):\n"
                    "  heading     { content, level(1-3), align? }\n"
                    "  text        { content, size(xs/sm/md/lg), bold?, italic?, color?, align? }\n"
                    "  button      { label, variant(primary/secondary/destructive/ghost), action }\n"
                    "  stats_row   { stats:[{label,value,change?,change_direction(up/down/neutral)}] }\n"
                    "  stat        { label, value, change?, change_direction?, icon? }\n"
                    "  list        { title?, items:[{id,title,subtitle?,badge?,icon?,right_text?,action?}] }\n"
                    "  card        { title?, subtitle?, elevated? } + children[]\n"
                    "  container   { direction(row/column), gap?, wrap? } + children[]\n"
                    "  alert       { severity(info/warning/error/success), title, message, dismissible? }\n"
                    "  progress    { value(0-100), max?, label?, color? }\n"
                    "  calendar    { events:[{id,title,start(ISO),end(ISO),color?}] }\n"
                    "  divider     { spacing? }\n"
                    "  spacer      { size(xs/sm/md/lg/xl) }\n"
                    "  badge       { label, color(blue/green/red/yellow/gray) }\n"
                    "  image       { uri, aspect_ratio?, alt? }\n"
                    "  form        { title?, fields:[{id,type,label,...}], submit_label?, submit_action }\n\n"
                    "Action types: {type:navigate,screen} | {type:api_call,method,path,body?} | "
                    "{type:dismiss} | {type:copy_text,text} | {type:open_url,url}\n\n"
                    "Each component object must have: { type, id, props: {...} }\n"
                    "Containers/cards also have: children: [component, ...]"
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "module_id": {
                            "type": "string",
                            "description": "The tab to update: home|chat|calendar|forms|alerts|modules|settings",
                        },
                        "screen": {
                            "type": "object",
                            "description": "The complete SDUIScreen JSON object",
                            "properties": {
                                "schema_version": {"type": "integer", "enum": [1]},
                                "module_id": {"type": "string"},
                                "title": {"type": "string"},
                                "sections": {
                                    "type": "array",
                                    "items": {
                                        "type": "object",
                                        "properties": {
                                            "id": {"type": "string"},
                                            "title": {"type": "string"},
                                            "component": {"type": "object"},
                                        },
                                        "required": ["id", "component"],
                                    },
                                },
                            },
                            "required": ["schema_version", "module_id", "title", "sections"],
                        },
                    },
                    "required": ["module_id", "screen"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "delete_screen",
                "description": (
                    "Clear the AI-generated SDUI screen for a tab, returning it to its empty/default state. "
                    "Use this to blank out a tab completely or reset before setting new content. "
                    "Available module_ids: home|chat|calendar|forms|alerts|modules|settings"
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "module_id": {"type": "string", "description": "The tab to clear"},
                    },
                    "required": ["module_id"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "list_screens",
                "description": "List all SDUI screens currently set by the AI across all tabs",
                "parameters": {"type": "object", "properties": {}},
            },
        },
        {
            "type": "function",
            "function": {
                "name": "hide_tab",
                "description": (
                    "Hide a tab from the bottom navigation bar. "
                    "The tab disappears from the nav bar instantly but its content and data are preserved. "
                    "Valid tabs: home, chat, modules, calendar, forms, alerts, settings"
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "tab_id": {
                            "type": "string",
                            "enum": ["home", "chat", "modules", "calendar", "forms", "alerts", "settings"],
                            "description": "The tab to hide",
                        },
                    },
                    "required": ["tab_id"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "show_tab",
                "description": (
                    "Restore a previously hidden tab to the bottom navigation bar. "
                    "Valid tabs: home, chat, modules, calendar, forms, alerts, settings"
                ),
                "parameters": {
                    "type": "object",
                    "properties": {
                        "tab_id": {
                            "type": "string",
                            "enum": ["home", "chat", "modules", "calendar", "forms", "alerts", "settings"],
                            "description": "The tab to show",
                        },
                    },
                    "required": ["tab_id"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "list_tabs",
                "description": "List all app tabs and their current visibility status (visible or hidden in the nav bar)",
                "parameters": {"type": "object", "properties": {}},
            },
        },
    ]
