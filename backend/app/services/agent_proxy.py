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
from app.services.workflow_engine import fire_trigger

DEFAULT_SYSTEM_PROMPT = (
    "You are Helm, a personal AI assistant that lives inside a mobile super-app. "
    "The user sees a chat message from you AND a set of native UI screens on their phone. "
    "You change screens either by calling TOOLS or by emitting the tool args as a "
    "JSON code block that the system auto-routes for you.\n\n"
    "## Hard rules (non-negotiable)\n"
    "1. For ANY request to set, build, add, change, replace, update, or remove "
    "anything on a screen (home/chat/calendar/forms/alerts/modules/settings), you "
    "MUST do ONE of the following:\n"
    "   (a) Call the set_screen / delete_screen tool via the function-call API, OR\n"
    "   (b) Emit a fenced ```json``` code block with the full set_screen arguments in "
    "the shape {\"module_id\": \"<tab>\", \"screen\": {\"rows\": [...]}}. The server "
    "detects and applies it automatically.\n"
    "2. NEVER claim you 'saved a draft' or 'updated the screen' without doing (a) or "
    "(b). That is a lie — the user sees no change. If you don't emit a JSON block and "
    "don't call a tool, DON'T say you changed anything.\n"
    "3. After (a) or (b), finish with ONE short sentence of confirmation — no further "
    "JSON, no schema teaching.\n"
    "4. Available tools:\n"
    "   - set_screen(module_id, screen)   — set or modify a screen\n"
    "   - delete_screen(module_id)        — clear a tab entirely\n"
    "   - get_screen(module_id)           — read the current layout before modifying\n\n"
    "## Screen shape (for the set_screen tool argument)\n"
    "Row-first V2: { rows: [ { id, cells: [ { id, content: <Component> } ] } ] }\n"
    "Every Component has: type (required), id, props.\n\n"
    "Valid component types (PascalCase only):\n"
    "  Atomic:     Text, Markdown, Button, Image, TextInput, Icon, Divider\n"
    "  Structural: Container (only type that may nest via 'children')\n"
    "  Composite:  CalendarModule, ChatModule, NotesModule, InputBar\n"
    "  Widgets:    Badge, Stat, List, Alert, Todo, RichText, ArticleCard\n\n"
    "Actions (inside component props): use {type:'navigate', screen:'forms'} — the key "
    "must be 'screen', never 'target' or 'route'. Other action types: server_action, "
    "open_url, copy_text, dismiss.\n\n"
    "When the user asks for a todo list, use the Todo component directly on the screen — "
    "don't just put a button pointing at the Forms tab."
)

_MAX_TOOL_TURNS = 5  # safety cap on agentic loop iterations


async def handle_chat_message(
    user_id: str,
    content: str,
    conversation_id: str | None = None,
) -> None:
    """Entry point called from WebSocket handler (runs as background task)."""
    try:
        # Save the user message first regardless of routing
        async with AsyncSessionLocal() as db:
            user_msg = ChatMessage(
                id=str(uuid4()),
                user_id=user_id,
                role="user",
                content=content,
            )
            db.add(user_msg)
            await db.commit()

        await fire_trigger("message_received", user_id, {
            "content": content,
            "conversation_id": str(conversation_id) if conversation_id else None
        })

        # Route: external agent when configured, else built-in OpenRouter proxy
        if settings.external_agent_url:
            await _process_via_external_agent(user_id, content)
        else:
            await _process_chat(user_id, content, conversation_id)
    except Exception as exc:
        logger.exception(f"Agent proxy error for user={user_id}: {exc}")
        await manager.send(user_id, {
            "type": "chat_error",
            "message": "An error occurred processing your message.",
        })


async def _process_via_external_agent(user_id: str, content: str) -> None:
    """Forward the chat message to the external agent API (api_server.py) and stream back.

    This is used when EXTERNAL_AGENT_URL is configured. The external agent has full
    access to all Helm MCP tools and a more capable LLM than the built-in proxy.
    """
    url = f"{settings.external_agent_url.rstrip('/')}/api/run"
    assistant_msg_id = str(uuid4())

    await manager.send(user_id, {"type": "chat_start", "message_id": assistant_msg_id})

    full_response = ""
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            async with client.stream("POST", url, json={"message": content}) as resp:
                if resp.status_code != 200:
                    raise RuntimeError(f"External agent returned {resp.status_code}")
                async for line in resp.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    raw = line[5:].strip()
                    if not raw or raw == "[DONE]":
                        continue
                    try:
                        event = json.loads(raw)
                    except json.JSONDecodeError:
                        continue

                    event_type = event.get("type")
                    if event_type == "token":
                        token = event.get("text", "")
                        full_response += token
                        await manager.send(user_id, {
                            "type": "chat_token",
                            "message_id": assistant_msg_id,
                            "token": token,
                        })
                    elif event_type == "done":
                        # Use the final full text from the agent
                        final = event.get("text", "")
                        if final and not full_response:
                            full_response = final
                    elif event_type == "error":
                        raise RuntimeError(event.get("text", "Unknown agent error"))
    except Exception as exc:
        logger.error(f"External agent error for user={user_id}: {exc}")
        await manager.send(user_id, {
            "type": "chat_error",
            "message": f"External agent error: {exc}",
        })
        return

    # Persist the conversation
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


async def _process_chat(
    user_id: str,
    content: str,
    conversation_id: str | None,
) -> None:
    # ── Load config + history ─────────────────────────────────────────────────
    # Note: user message has already been saved by handle_chat_message before
    # this function is called. We load history BEFORE that save snapshot so we
    # don't duplicate it in the conversation sent to the LLM.
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(AgentConfig).where(
                AgentConfig.user_id == user_id,
                AgentConfig.is_active == True,  # noqa: E712
            )
        )
        agent_config = result.scalar_one_or_none()

        api_key, base_url, model = _resolve_provider(agent_config)
        system_prompt = (agent_config.system_prompt if agent_config else None) or DEFAULT_SYSTEM_PROMPT
        temperature = agent_config.temperature if agent_config else 0.7
        max_tokens = agent_config.max_tokens if agent_config else 4096

        # Load history excluding the current user message (last message already saved)
        history_result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.user_id == user_id)
            .order_by(ChatMessage.created_at.desc())
            .limit(21)  # extra 1 to skip the just-saved user msg
        )
        all_history = list(reversed(history_result.scalars().all()))
        # Drop the last message if it's the current user message
        if all_history and all_history[-1].role == "user" and all_history[-1].content == content:
            history = all_history[:-1]
        else:
            history = all_history

    assistant_msg_id = str(uuid4())
    await manager.send(user_id, {"type": "chat_start", "message_id": assistant_msg_id})

    if not api_key:
        await manager.send(user_id, {
            "type": "chat_error",
            "code": "no_api_key",
            "message": "No AI provider configured. Set one of OPENROUTER_API_KEY, SILICONFLOW_API_KEY, OPENAI_API_KEY, DEEPSEEK_API_KEY, GROQ_API_KEY, or TOGETHER_API_KEY in backend/.env.",
        })
        return

    # Build initial message list from history
    messages: list[dict] = [{"role": "system", "content": system_prompt}]
    for msg in history:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": content})

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

    # ── Safety net: if the model emitted SDUI JSON in prose, route it to set_screen.
    # Weaker tool-use models sometimes reproduce a worked example from the system
    # prompt instead of calling the tool. Without this fallback their chat reply
    # is a wall of JSON and the phone screen never updates.
    #
    # IMPORTANT: we persist the RAW output (with any JSON blocks intact) so that
    # conversation history fed back to the LLM shows its own tool-using pattern.
    # The user only sees the cleaned + decorated version in their chat UI.
    # If we stored the cleaned version the LLM would pattern-match on its own
    # post-rescue confirmations and stop emitting JSON after a few turns.
    raw_response = full_response
    displayed_response = await _rescue_sdui_json_from_prose(user_id, content, full_response)

    # ── Persist assistant message (RAW for LLM history fidelity) ──────────────
    async with AsyncSessionLocal() as db:
        assistant_msg = ChatMessage(
            id=assistant_msg_id,
            user_id=user_id,
            role="assistant",
            content=raw_response,
        )
        db.add(assistant_msg)
        await db.commit()

    await manager.send(user_id, {
        "type": "chat_complete",
        "message_id": assistant_msg_id,
        "content": displayed_response,
    })


# ── SDUI prose-rescue helpers ────────────────────────────────────────────────
# Module ids the agent can target. Duplicated from tool definitions on purpose —
# this helper runs before the tool layer, so we can't import a single source.
_KNOWN_MODULE_IDS = ("home", "chat", "calendar", "forms", "alerts", "modules", "settings")

_SDUI_JSON_BLOCK_RE = re.compile(
    r"```(?:json|JSON)?\s*(\{[\s\S]*?\})\s*```",
    re.MULTILINE,
)

# DeepSeek and a few other models emit a fake OpenAI-style tool call inline:
#   <function>set_screen
#   ```json { "module_id": "home", "screen": {...} } ```
# We also accept delete_screen in the same shape.
_FAKE_FUNCTION_TAG_RE = re.compile(
    r"<function>\s*(set_screen|delete_screen)\s*(?:```(?:json|JSON)?\s*(\{[\s\S]*?\})\s*```)?",
    re.MULTILINE,
)


def _infer_module_id(user_message: str, rescued_payload: dict) -> str:
    """Best-effort module_id from the payload or the user's request."""
    explicit = rescued_payload.get("module_id")
    if isinstance(explicit, str) and explicit in _KNOWN_MODULE_IDS:
        return explicit
    lowered = user_message.lower()
    for mid in _KNOWN_MODULE_IDS:
        if mid in lowered:
            return mid
    return "home"


def _unwrap_tool_args(obj: object) -> tuple[object, str | None]:
    """If the JSON looks like set_screen tool args ({module_id, screen}),
    return (inner_screen, module_id). Otherwise return (obj, None).
    """
    if not isinstance(obj, dict):
        return obj, None
    inner = obj.get("screen")
    module_id = obj.get("module_id")
    if isinstance(inner, dict) and isinstance(module_id, str):
        return inner, module_id
    return obj, None


def _looks_like_sdui_payload(obj: object) -> bool:
    if not isinstance(obj, dict):
        return False
    rows = obj.get("rows")
    if isinstance(rows, list) and len(rows) > 0:
        return True
    sections = obj.get("sections")
    if isinstance(sections, list) and len(sections) > 0:
        return True
    return False


async def _rescue_sdui_json_from_prose(user_id: str, user_message: str, reply: str) -> str:
    """If the assistant reply contains an SDUI JSON block (either raw or wrapped
    in DeepSeek's fake `<function>set_screen` tag), fire set_screen server-side
    and strip the block from the visible reply. Returns the cleaned reply.
    """
    if "```" not in reply and "<function>" not in reply and '"rows"' not in reply:
        return reply

    from app.mcp.tools import set_screen as set_screen_tool, delete_screen as delete_screen_tool

    cleaned = reply
    rescued: list[str] = []
    deleted: list[str] = []

    # 1) Handle DeepSeek's fake <function>tool_name\n```json {args}```
    for match in _FAKE_FUNCTION_TAG_RE.finditer(reply):
        func_name = match.group(1)
        raw = match.group(2)
        args: dict = {}
        if raw:
            try:
                args = json.loads(raw)
            except Exception:
                args = {}
        module_id = args.get("module_id") if isinstance(args, dict) else None
        if not (isinstance(module_id, str) and module_id in _KNOWN_MODULE_IDS):
            module_id = _infer_module_id(user_message, args if isinstance(args, dict) else {})
        try:
            if func_name == "delete_screen":
                await delete_screen_tool(module_id=module_id, user_id=user_id)
                deleted.append(module_id)
                cleaned = cleaned.replace(match.group(0), "").strip()
            else:
                screen = args.get("screen") if isinstance(args, dict) else None
                if isinstance(screen, dict) and _looks_like_sdui_payload(screen):
                    await set_screen_tool(module_id=module_id, screen=screen, user_id=user_id)
                    rescued.append(module_id)
                    cleaned = cleaned.replace(match.group(0), "").strip()
        except Exception as exc:
            logger.warning(f"SDUI fake-fn rescue failed for module={module_id}: {exc}")

    # 2) Handle raw code blocks (bare {"rows":…} or {"module_id":…,"screen":…})
    for match in _SDUI_JSON_BLOCK_RE.finditer(cleaned):
        raw = match.group(1)
        try:
            parsed = json.loads(raw)
        except Exception:
            continue
        payload, explicit_module = _unwrap_tool_args(parsed)
        if not _looks_like_sdui_payload(payload):
            continue
        module_id = explicit_module or _infer_module_id(user_message, parsed if isinstance(parsed, dict) else {})
        try:
            await set_screen_tool(module_id=module_id, screen=payload, user_id=user_id)
            rescued.append(module_id)
            cleaned = cleaned.replace(match.group(0), "").strip()
        except Exception as exc:
            logger.warning(f"SDUI prose rescue failed for module={module_id}: {exc}")

    if rescued or deleted:
        parts = []
        if rescued:
            parts.append(f"saved a draft for **{', '.join(sorted(set(rescued)))}**")
        if deleted:
            parts.append(f"cleared **{', '.join(sorted(set(deleted)))}**")
        summary = f"\n\n_{' and '.join(parts)} — review on your phone._"
        cleaned = (cleaned + summary).strip()
    return cleaned


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


_PROVIDER_PRIORITY = ["openrouter", "siliconflow", "openai", "deepseek", "groq", "together", "ollama"]


def _provider_env(name: str) -> tuple[str, str, str] | None:
    """Return (api_key, base_url, model) for a provider, or None if the key is missing.

    Ollama is special: no key required, always available when the URL is set.
    """
    name = (name or "").lower()
    if name == "openrouter":
        k = settings.openrouter_api_key
        return (k, settings.openrouter_base_url, settings.openrouter_model) if k else None
    if name == "openai":
        k = settings.openai_api_key
        return (k, settings.openai_base_url, settings.openai_model) if k else None
    if name == "siliconflow":
        k = settings.siliconflow_api_key
        return (k, settings.siliconflow_base_url, settings.siliconflow_model) if k else None
    if name == "deepseek":
        k = settings.deepseek_api_key
        return (k, settings.deepseek_base_url, settings.deepseek_model) if k else None
    if name == "groq":
        k = settings.groq_api_key
        return (k, settings.groq_base_url, settings.groq_model) if k else None
    if name == "together":
        k = settings.together_api_key
        return (k, settings.together_base_url, settings.together_model) if k else None
    if name == "ollama":
        return ("ollama", settings.ollama_base_url, settings.ollama_model)
    return None


def _auto_detect_provider() -> tuple[str, str, str] | None:
    """Pick the first provider in priority order whose key is set."""
    preferred = (settings.default_provider or "").strip().lower()
    if preferred:
        cfg = _provider_env(preferred)
        if cfg:
            return cfg
    for name in _PROVIDER_PRIORITY:
        cfg = _provider_env(name)
        if cfg:
            return cfg
    return None


def _resolve_provider(agent_config: AgentConfig | None) -> tuple[str | None, str, str]:
    """Resolve (api_key, base_url, model) with per-user overrides winning over env."""
    env_cfg = _auto_detect_provider()
    env_key, env_base, env_model = env_cfg if env_cfg else (None, settings.openai_base_url, settings.openai_model)

    api_key = env_key
    if agent_config and agent_config.api_key_encrypted:
        try:
            from app.routers.agent_config import _decrypt_api_key
            decrypted = _decrypt_api_key(agent_config.api_key_encrypted)
            if decrypted and decrypted not in ("test_key", "placeholder", ""):
                api_key = decrypted
        except Exception:
            pass

    base_url = (agent_config.base_url if agent_config else None) or env_base
    model = (agent_config.model if agent_config else None) or env_model
    return api_key, base_url, model


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
                    "The frontend re-renders instantly via WebSocket. "
                    "Use the row-first contract: screen.rows[] -> row.cells[] -> cell.content. "
                    "Every cell.content MUST include a 'type' field — typeless content renders as a red 'Invalid component' box on the phone. "
                    "Valid V2 component types (PascalCase): Text, Markdown, Button, Image, TextInput, Icon, Divider, Container, "
                    "CalendarModule, ChatModule, NotesModule, InputBar, Badge, Stat, List, Alert, Todo, RichText, ArticleCard. "
                    "Stored payloads may omit metadata like schema_version, module_id, and title. "
                    "Legacy sections payloads are still accepted for backward compatibility, but new tool calls should send row-first screens. "
                    "Available module_ids: home | chat | calendar | forms | alerts | modules | settings"
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
                            "description": "Preferred row-first screen payload. Legacy sections payloads are still accepted for backward compatibility.",
                            "oneOf": [
                                {
                                    "type": "object",
                                    "properties": {
                                        "rows": {
                                            "type": "array",
                                            "items": {
                                                "type": "object",
                                                "properties": {
                                                    "id": {"type": "string"},
                                                    "cells": {
                                                        "type": "array",
                                                        "items": {
                                                            "type": "object",
                                                            "properties": {
                                                                "id": {"type": "string"},
                                                                "content": {
                                                                    "type": "object",
                                                                    "description": "Component object. Must include 'type'.",
                                                                    "properties": {
                                                                        "type": {
                                                                            "type": "string",
                                                                            "enum": [
                                                                                "Text", "Markdown", "Button", "Image",
                                                                                "TextInput", "Icon", "Divider", "Container",
                                                                                "CalendarModule", "ChatModule", "NotesModule", "InputBar",
                                                                                "Badge", "Stat", "List", "Alert",
                                                                                "Todo", "RichText", "ArticleCard",
                                                                            ],
                                                                        },
                                                                        "id": {"type": "string"},
                                                                        "props": {"type": "object"},
                                                                    },
                                                                    "required": ["type"],
                                                                },
                                                            },
                                                            "required": ["id", "content"],
                                                        },
                                                    },
                                                },
                                                "required": ["id", "cells"],
                                            },
                                        },
                                    },
                                    "required": ["rows"],
                                },
                                {
                                    "type": "object",
                                    "properties": {
                                        "sections": {
                                            "type": "array",
                                            "items": {
                                                "type": "object",
                                                "properties": {
                                                    "id": {"type": "string"},
                                                    "title": {"type": "string"},
                                                    "component": {"type": "object"},
                                                    "components": {
                                                        "type": "array",
                                                        "items": {"type": "object"},
                                                    },
                                                },
                                                "required": ["id"],
                                            },
                                        },
                                    },
                                    "required": ["sections"],
                                },
                            ],
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
                "name": "get_screen",
                "description": "Get the current live SDUI screen JSON for a module.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "module_id": {
                            "type": "string",
                            "description": "The tab whose live screen should be returned",
                        },
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
                "name": "get_draft",
                "description": "Get the pending draft SDUI screen for a module, if one exists.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "module_id": {
                            "type": "string",
                            "description": "The tab whose draft screen should be returned",
                        },
                    },
                    "required": ["module_id"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "approve_draft",
                "description": "Approve and publish a pending SDUI draft so it becomes the live screen.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "module_id": {
                            "type": "string",
                            "description": "The tab whose draft should be approved",
                        },
                    },
                    "required": ["module_id"],
                },
            },
        },
        {
            "type": "function",
            "function": {
                "name": "reject_draft",
                "description": "Reject and discard a pending SDUI draft, optionally recording user feedback.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "module_id": {
                            "type": "string",
                            "description": "The tab whose draft should be rejected",
                        },
                        "feedback": {
                            "type": "string",
                            "description": "Optional user feedback explaining why the draft was rejected",
                        },
                    },
                    "required": ["module_id"],
                },
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
        {
            "type": "function",
            "function": {
                "name": "rename_tab",
                "description": "Rename a navigation tab and/or change its icon. Use this to give tabs meaningful custom names — e.g. rename 'forms' to 'Tokyo Trip Dashboard' or 'modules' to 'My Journal'.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "tab_id": {
                            "type": "string",
                            "enum": ["home", "chat", "modules", "calendar", "forms", "alerts", "settings"],
                            "description": "The tab to rename",
                        },
                        "name": {
                            "type": "string",
                            "description": "New display name for the tab, e.g. 'Tokyo Trip Dashboard'",
                        },
                        "icon": {
                            "type": "string",
                            "description": "New emoji icon for the tab, e.g. '🗾'",
                        },
                    },
                    "required": ["tab_id"],
                },
            },
        },
    ]
