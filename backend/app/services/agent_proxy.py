"""Agent proxy — streams LLM responses to the iOS app via WebSocket.

Flow:
  1. Receive user message from WebSocket handler
  2. Load agent config + chat history from DB
  3. Call LLM with streaming (OpenAI-compatible API)
  4. Stream tokens back via WebSocket as AG-UI-style events
  5. Handle tool calls inline (MCP tools)
  6. Persist full exchange to chat_messages table
"""

import json
from datetime import datetime, timezone
from uuid import uuid4

import httpx
from loguru import logger
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models.agent_config import AgentConfig
from app.models.chat_message import ChatMessage
from app.services.websocket_manager import manager

DEFAULT_SYSTEM_PROMPT = (
    "You are Helm, a helpful AI assistant integrated into a personal super app. "
    "You have access to tools for calendar management, notifications, and forms. "
    "Be concise, helpful, and proactive."
)


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
    async with AsyncSessionLocal() as db:
        # Load agent config
        result = await db.execute(
            select(AgentConfig).where(
                AgentConfig.user_id == user_id,
                AgentConfig.is_active == True,  # noqa: E712
            )
        )
        agent_config = result.scalar_one_or_none()

        api_key = agent_config.api_key_encrypted if agent_config else None
        model = agent_config.model if agent_config else "gpt-4o"
        base_url = (agent_config.base_url if agent_config else None) or "https://api.openai.com/v1"
        system_prompt = (agent_config.system_prompt if agent_config else None) or DEFAULT_SYSTEM_PROMPT
        temperature = agent_config.temperature if agent_config else 0.7
        max_tokens = agent_config.max_tokens if agent_config else 4096

        # Load recent chat history
        history_result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.user_id == user_id)
            .order_by(ChatMessage.created_at.desc())
            .limit(20)
        )
        history = list(reversed(history_result.scalars().all()))

        # Persist user message
        user_msg = ChatMessage(
            id=str(uuid4()),
            user_id=user_id,
            role="user",
            content=content,
        )
        db.add(user_msg)
        await db.flush()

    # Notify client that processing has started
    await manager.send(user_id, {"type": "chat_start", "message_id": str(uuid4())})

    if not api_key:
        await manager.send(user_id, {
            "type": "chat_error",
            "code": "no_api_key",
            "message": "No API key configured. Please set your AI provider key in Settings.",
        })
        return

    messages = [{"role": "system", "content": system_prompt}]
    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": content})

    full_response = ""
    assistant_msg_id = str(uuid4())

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                f"{base_url.rstrip('/')}/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": messages,
                    "stream": True,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                    "tools": _get_tool_definitions(),
                },
            ) as response:
                if response.status_code != 200:
                    body = await response.aread()
                    logger.error(f"LLM API error {response.status_code}: {body}")
                    await manager.send(user_id, {
                        "type": "chat_error",
                        "message": f"AI provider returned error {response.status_code}.",
                    })
                    return

                async for line in response.aiter_lines():
                    if not line or not line.startswith("data: "):
                        continue
                    chunk = line[6:]
                    if chunk == "[DONE]":
                        break
                    try:
                        data = json.loads(chunk)
                    except json.JSONDecodeError:
                        continue

                    choice = data.get("choices", [{}])[0]
                    delta = choice.get("delta", {})
                    token = delta.get("content", "")
                    tool_calls = delta.get("tool_calls")

                    if token:
                        full_response += token
                        await manager.send(user_id, {
                            "type": "chat_token",
                            "message_id": assistant_msg_id,
                            "token": token,
                        })

                    if tool_calls:
                        for tc in tool_calls:
                            await _handle_tool_call(user_id, tc)

    except httpx.RequestError as exc:
        logger.error(f"Network error calling LLM: {exc}")
        await manager.send(user_id, {
            "type": "chat_error",
            "message": "Network error reaching AI provider. Please check your connection.",
        })
        return

    # Persist assistant response
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


async def _handle_tool_call(user_id: str, tool_call: dict) -> None:
    """Execute an MCP tool call and send result back via WebSocket."""
    from app.mcp.tools import execute_tool

    name = tool_call.get("function", {}).get("name", "")
    try:
        args_str = tool_call.get("function", {}).get("arguments", "{}")
        args = json.loads(args_str)
    except json.JSONDecodeError:
        args = {}

    logger.info(f"Tool call: {name}({args}) for user={user_id}")
    try:
        result = await execute_tool(name, args, user_id)
        await manager.send(user_id, {
            "type": "tool_result",
            "tool": name,
            "result": result,
        })
    except Exception as exc:
        logger.error(f"Tool call {name} failed: {exc}")
        await manager.send(user_id, {
            "type": "tool_error",
            "tool": name,
            "message": str(exc),
        })


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
