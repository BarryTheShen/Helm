"""Regression tests for SDUI REST and MCP parity around draft and delete flows."""

import json
from typing import Any
from uuid import uuid4

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

import app.services.agent_proxy as agent_proxy
from app.mcp.tools import approve_draft, delete_screen, list_screens, set_screen
from app.models.chat_message import ChatMessage
from app.models.module_state import ModuleState
from app.models.user import User
from app.services.agent_proxy import _get_tool_definitions
from app.services.sdui_state import module_state_keys_to_clear, sdui_module_config_key
from app.services.websocket_manager import manager

pytestmark = pytest.mark.anyio


@pytest.fixture
def captured_ws_messages(monkeypatch: pytest.MonkeyPatch) -> list[dict[str, Any]]:
    messages: list[dict[str, Any]] = []

    async def fake_send(user_id: str, message: dict[str, Any]) -> None:
        messages.append({"user_id": user_id, **message})

    monkeypatch.setattr(manager, "send", fake_send)
    return messages


async def _get_test_user_id(db_session) -> str:
    result = await db_session.execute(select(User).where(User.username == "testadmin"))
    user = result.scalar_one()
    return str(user.id)


def _make_session_factory(db_engine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(
        db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )


def _assert_normalized_text_screen(screen: dict[str, Any], expected_content: str) -> None:
    assert "sections" not in screen
    assert len(screen["rows"]) == 1
    assert len(screen["rows"][0]["cells"]) == 1
    assert screen["rows"][0]["cells"][0]["content"]["props"]["content"] == expected_content


def test_agent_proxy_exposes_mcp_sdui_draft_tools() -> None:
    """Built-in agent proxy tool definitions should include the MCP SDUI draft surface."""

    tool_definitions = {
        tool_definition["function"]["name"]: tool_definition["function"]
        for tool_definition in _get_tool_definitions()
    }

    expected_required_fields = {
        "set_screen": {"module_id", "screen"},
        "get_screen": {"module_id"},
        "delete_screen": {"module_id"},
        "list_screens": set(),
        "get_draft": {"module_id"},
        "approve_draft": {"module_id"},
        "reject_draft": {"module_id"},
    }

    for tool_name, required_fields in expected_required_fields.items():
        assert tool_name in tool_definitions
        assert set(tool_definitions[tool_name]["parameters"].get("required", [])) == required_fields

    assert set(tool_definitions["reject_draft"]["parameters"]["properties"]) == {"module_id", "feedback"}

    set_screen_definition = tool_definitions["set_screen"]
    assert "row-first" in set_screen_definition["description"].lower()
    assert "legacy sections" in set_screen_definition["description"].lower()

    screen_schema = set_screen_definition["parameters"]["properties"]["screen"]
    assert "oneOf" in screen_schema
    assert any(set(branch.get("required", [])) == {"rows"} for branch in screen_schema["oneOf"])
    assert any(set(branch.get("required", [])) == {"sections"} for branch in screen_schema["oneOf"])


async def test_rest_post_rejects_invalid_row_first_payload_with_client_error(auth_client):
    """REST saves should reject malformed row-first payloads with a client error."""

    invalid_screen = {
        "title": "Broken REST Screen",
        "rows": [
            {
                "cells": [
                    {
                        "id": "cell-1",
                        "content": {
                            "type": "Text",
                            "props": {"content": "Missing row id"},
                        },
                    }
                ],
            }
        ],
    }

    response = await auth_client.post("/api/sdui/home", json={"screen": invalid_screen})

    assert response.status_code == 422
    assert "missing 'id'" in response.json()["detail"]

    draft_response = await auth_client.get("/api/sdui/home/draft")
    assert draft_response.status_code == 200
    assert draft_response.json() == {"screen": None, "has_draft": False, "version": 0}


async def test_mcp_set_screen_rejects_invalid_row_first_payload_without_schema_version(
    auth_client,
    db_session,
):
    """MCP saves should validate row-first screens even when schema_version is omitted."""

    user_id = await _get_test_user_id(db_session)
    invalid_screen = {
        "title": "Broken MCP Screen",
        "rows": [
            {
                "id": "row-1",
                "cells": [
                    {
                        "id": "cell-1",
                        "content": {
                            "type": "UnsupportedWidget",
                            "props": {"content": "Unknown component type"},
                        },
                    }
                ],
            }
        ],
    }

    with pytest.raises(ValueError, match="Unknown component type"):
        await set_screen(module_id="home", screen=invalid_screen, user_id=user_id)


async def test_rest_config_read_falls_back_to_sdui_scoped_legacy_key(
    auth_client,
    db_session,
):
    """REST config reads should honor the older SDUI-scoped config key when present."""

    module_id = "compat-config-module"
    user_id = await _get_test_user_id(db_session)

    db_session.add(
        ModuleState(
            id=str(uuid4()),
            user_id=user_id,
            module_type=sdui_module_config_key(module_id),
            state_json={"auto_approve_drafts": True},
            version=1,
        )
    )
    await db_session.commit()

    config_response = await auth_client.get(f"/api/sdui/{module_id}/config")
    assert config_response.status_code == 200
    assert config_response.json() == {"auto_approve_drafts": True}

    live_screen = {
        "title": "Compat Config Screen",
        "rows": [
            {
                "id": "row-1",
                "cells": [
                    {
                        "id": "cell-1",
                        "content": {
                            "type": "Text",
                            "props": {"content": "Published live"},
                        },
                    }
                ],
            }
        ],
    }

    set_response = await auth_client.post(f"/api/sdui/{module_id}", json={"screen": live_screen})
    assert set_response.status_code == 200
    assert set_response.json()["updated"] is True
    assert set_response.json().get("draft") is not True

    draft_response = await auth_client.get(f"/api/sdui/{module_id}/draft")
    assert draft_response.status_code == 200
    assert draft_response.json() == {"screen": None, "has_draft": False, "version": 0}

    live_response = await auth_client.get(f"/api/sdui/{module_id}")
    assert live_response.status_code == 200
    _assert_normalized_text_screen(live_response.json()["screen"], "Published live")


async def test_rest_post_emits_normalized_sdui_draft_update(
    auth_client,
    db_session,
    captured_ws_messages: list[dict[str, Any]],
):
    """REST draft saves should broadcast the same normalized draft event shape as MCP."""

    user_id = await _get_test_user_id(db_session)
    legacy_screen = {
        "title": "REST Draft",
        "sections": [
            {
                "id": "legacy-section",
                "components": [
                    {"type": "text", "content": "Draft over REST"},
                ],
            }
        ],
    }

    response = await auth_client.post("/api/sdui/home", json={"screen": legacy_screen})

    assert response.status_code == 200
    assert response.json()["draft"] is True
    assert [message["type"] for message in captured_ws_messages] == ["sdui_draft_update"]

    message = captured_ws_messages[0]
    assert message["user_id"] == user_id
    assert message["module_id"] == "home"
    assert message["version"] == response.json()["version"]
    _assert_normalized_text_screen(message["screen"], "Draft over REST")


async def test_rest_get_draft_matches_normalized_client_contract(
    auth_client,
    captured_ws_messages: list[dict[str, Any]],
):
    """Draft GET should reuse the normalized client-facing draft payload contract."""

    module_id = "draft-get-contract"
    legacy_screen = {
        "title": "Draft GET Contract",
        "sections": [
            {
                "id": "legacy-section",
                "components": [
                    {"type": "text", "content": "Draft GET should normalize"},
                ],
            }
        ],
    }

    create_response = await auth_client.post(f"/api/sdui/{module_id}", json={"screen": legacy_screen})

    assert create_response.status_code == 200
    assert create_response.json()["draft"] is True
    assert [message["type"] for message in captured_ws_messages] == ["sdui_draft_update"]

    draft_response = await auth_client.get(f"/api/sdui/{module_id}/draft")

    assert draft_response.status_code == 200
    assert draft_response.json()["has_draft"] is True
    assert draft_response.json()["version"] == create_response.json()["version"]
    assert draft_response.json()["screen"] == captured_ws_messages[0]["screen"]
    _assert_normalized_text_screen(draft_response.json()["screen"], "Draft GET should normalize")


async def test_history_restore_emits_normalized_sdui_draft_update(
    auth_client,
    db_session,
    captured_ws_messages: list[dict[str, Any]],
):
    """History restore should reuse the shared draft-update websocket contract."""

    user_id = await _get_test_user_id(db_session)
    legacy_screen = {
        "title": "History Draft",
        "sections": [
            {
                "id": "legacy-section",
                "components": [
                    {"type": "text", "content": "Restored from history"},
                ],
            }
        ],
    }

    create_response = await auth_client.post("/api/sdui/home", json={"screen": legacy_screen})
    assert create_response.status_code == 200
    captured_ws_messages.clear()

    response = await auth_client.post("/api/sdui/home/history/1/restore")

    assert response.status_code == 200
    assert response.json()["restored_version"] == 1
    assert [message["type"] for message in captured_ws_messages] == ["sdui_draft_update"]

    message = captured_ws_messages[0]
    assert message["user_id"] == user_id
    assert message["module_id"] == "home"
    assert message["version"] == response.json()["draft_version"]
    _assert_normalized_text_screen(message["screen"], "Restored from history")


async def test_duplicate_screen_emits_normalized_sdui_draft_update(
    auth_client,
    db_session,
    captured_ws_messages: list[dict[str, Any]],
):
    """Duplicate-to-module should reuse the shared draft-update websocket contract."""

    user_id = await _get_test_user_id(db_session)
    legacy_screen = {
        "title": "Duplicate Draft",
        "sections": [
            {
                "id": "legacy-section",
                "components": [
                    {"type": "text", "content": "Duplicated draft"},
                ],
            }
        ],
    }

    config_response = await auth_client.put(
        "/api/sdui/source-module/config",
        json={"auto_approve_drafts": True},
    )
    assert config_response.status_code == 200

    create_response = await auth_client.post(
        "/api/sdui/source-module",
        json={"screen": legacy_screen},
    )
    assert create_response.status_code == 200
    captured_ws_messages.clear()

    response = await auth_client.post(
        "/api/sdui/source-module/duplicate",
        json={"target_module_id": "target-module"},
    )

    assert response.status_code == 200
    assert response.json()["target_module_id"] == "target-module"
    assert [message["type"] for message in captured_ws_messages] == ["sdui_draft_update"]

    message = captured_ws_messages[0]
    assert message["user_id"] == user_id
    assert message["module_id"] == "target-module"
    assert message["version"] == response.json()["draft_version"]
    _assert_normalized_text_screen(message["screen"], "Duplicated draft")


async def test_mcp_approve_draft_clears_draft_state_before_live_update(
    auth_client,
    db_session,
    captured_ws_messages: list[dict[str, Any]],
):
    """Approving an MCP draft should clear draft UI state and then push the live screen."""

    user_id = await _get_test_user_id(db_session)
    legacy_screen = {
        "title": "MCP Draft",
        "sections": [
            {
                "id": "legacy-section",
                "components": [
                    {"type": "text", "content": "Draft over MCP"},
                ],
            }
        ],
    }

    result = await set_screen(module_id="forms", screen=legacy_screen, user_id=user_id)

    assert result["draft"] is True
    assert [message["type"] for message in captured_ws_messages] == ["sdui_draft_update"]
    _assert_normalized_text_screen(captured_ws_messages[0]["screen"], "Draft over MCP")

    captured_ws_messages.clear()

    approval_result = await approve_draft(module_id="forms", user_id=user_id)

    assert approval_result["approved"] is True
    assert [message["type"] for message in captured_ws_messages] == [
        "sdui_draft_rejected",
        "sdui_screen_update",
    ]
    assert captured_ws_messages[0]["module_id"] == "forms"
    _assert_normalized_text_screen(captured_ws_messages[1]["screen"], "Draft over MCP")


async def test_rest_approve_draft_keeps_live_contract_and_cleared_draft_version(
    auth_client,
    captured_ws_messages: list[dict[str, Any]],
):
    """REST approve should clear draft state with version 0 while keeping live payload/version symmetric."""

    module_id = "rest-approve-contract"
    live_screen = {
        "title": "Existing Live Screen",
        "rows": [
            {
                "id": "live-row",
                "cells": [
                    {
                        "id": "live-cell",
                        "content": {
                            "type": "Text",
                            "props": {"content": "Existing live content"},
                        },
                    }
                ],
            }
        ],
    }
    draft_screen = {
        "title": "Draft To Approve",
        "sections": [
            {
                "id": "legacy-section",
                "components": [
                    {"type": "text", "content": "Approved draft content"},
                ],
            }
        ],
    }

    config_response = await auth_client.put(
        f"/api/sdui/{module_id}/config",
        json={"auto_approve_drafts": True},
    )
    assert config_response.status_code == 200

    live_create_response = await auth_client.post(
        f"/api/sdui/{module_id}",
        json={"screen": live_screen},
    )
    assert live_create_response.status_code == 200
    assert live_create_response.json()["version"] == 1

    config_response = await auth_client.put(
        f"/api/sdui/{module_id}/config",
        json={"auto_approve_drafts": False},
    )
    assert config_response.status_code == 200

    draft_create_response = await auth_client.post(
        f"/api/sdui/{module_id}",
        json={"screen": draft_screen},
    )
    assert draft_create_response.status_code == 200
    assert draft_create_response.json()["draft"] is True
    assert draft_create_response.json()["version"] == 1

    captured_ws_messages.clear()

    approve_response = await auth_client.post(f"/api/sdui/{module_id}/draft/approve")
    live_response = await auth_client.get(f"/api/sdui/{module_id}")
    draft_state_response = await auth_client.get(f"/api/sdui/{module_id}/draft")

    assert approve_response.status_code == 200
    assert live_response.status_code == 200
    assert draft_state_response.status_code == 200
    assert [message["type"] for message in captured_ws_messages] == [
        "sdui_draft_rejected",
        "sdui_screen_update",
    ]
    assert approve_response.json()["version"] == 2
    assert live_response.json()["version"] == approve_response.json()["version"]
    assert captured_ws_messages[1]["version"] == approve_response.json()["version"]
    assert live_response.json()["screen"] == captured_ws_messages[1]["screen"]
    _assert_normalized_text_screen(live_response.json()["screen"], "Approved draft content")
    assert draft_state_response.json() == {"screen": None, "has_draft": False, "version": 0}


async def test_process_chat_reuses_one_assistant_message_id(
    auth_client,
    db_engine,
    db_session,
    monkeypatch: pytest.MonkeyPatch,
    captured_ws_messages: list[dict[str, Any]],
):
    """Built-in chat streaming should keep one assistant id across start/token/complete."""

    user_id = await _get_test_user_id(db_session)
    monkeypatch.setattr(agent_proxy, "AsyncSessionLocal", _make_session_factory(db_engine))
    monkeypatch.setattr(
        agent_proxy,
        "_resolve_provider",
        lambda _agent_config: ("test-key", "https://example.test/v1", "test-model"),
    )

    async def fake_stream_one_turn(*, user_id: str, assistant_msg_id: str, **_: Any) -> tuple[str, list[dict[str, Any]], str]:
        await manager.send(user_id, {
            "type": "chat_token",
            "message_id": assistant_msg_id,
            "token": "Hello",
        })
        return "Hello", [], "stop"

    monkeypatch.setattr(agent_proxy, "_stream_one_turn", fake_stream_one_turn)

    await agent_proxy._process_chat(user_id=user_id, content="Hi", conversation_id=None)

    start_message = next(message for message in captured_ws_messages if message["type"] == "chat_start")
    token_message = next(message for message in captured_ws_messages if message["type"] == "chat_token")
    complete_message = next(message for message in captured_ws_messages if message["type"] == "chat_complete")

    result = await db_session.execute(
        select(ChatMessage).where(
            ChatMessage.user_id == user_id,
            ChatMessage.role == "assistant",
        )
    )
    assistant_message = result.scalar_one()

    assert start_message["message_id"] == token_message["message_id"]
    assert token_message["message_id"] == complete_message["message_id"]
    assert complete_message["message_id"] == str(assistant_message.id)


async def test_external_agent_stream_reuses_one_assistant_message_id(
    auth_client,
    db_engine,
    db_session,
    monkeypatch: pytest.MonkeyPatch,
    captured_ws_messages: list[dict[str, Any]],
):
    """External agent relays should tag streamed tokens with the same assistant id."""

    class _FakeExternalResponse:
        status_code = 200

        async def aiter_lines(self):
            for line in [
                'data: {"type":"token","text":"Hel"}',
                'data: {"type":"token","text":"lo"}',
                'data: {"type":"done","text":"Hello"}',
                'data: [DONE]',
            ]:
                yield line

    class _FakeStreamContext:
        def __init__(self, response: _FakeExternalResponse) -> None:
            self._response = response

        async def __aenter__(self) -> _FakeExternalResponse:
            return self._response

        async def __aexit__(self, exc_type, exc, tb) -> None:
            return None

    class _FakeAsyncClient:
        async def __aenter__(self) -> "_FakeAsyncClient":
            return self

        async def __aexit__(self, exc_type, exc, tb) -> None:
            return None

        def stream(self, *args: Any, **kwargs: Any) -> _FakeStreamContext:
            return _FakeStreamContext(_FakeExternalResponse())

    user_id = await _get_test_user_id(db_session)
    monkeypatch.setattr(agent_proxy, "AsyncSessionLocal", _make_session_factory(db_engine))
    monkeypatch.setattr(agent_proxy.httpx, "AsyncClient", lambda *args, **kwargs: _FakeAsyncClient())
    monkeypatch.setattr(agent_proxy.settings, "external_agent_url", "http://external-agent.test")

    await agent_proxy._process_via_external_agent(user_id=user_id, content="Hi")

    start_message = next(message for message in captured_ws_messages if message["type"] == "chat_start")
    token_messages = [message for message in captured_ws_messages if message["type"] == "chat_token"]
    complete_message = next(message for message in captured_ws_messages if message["type"] == "chat_complete")

    result = await db_session.execute(
        select(ChatMessage).where(
            ChatMessage.user_id == user_id,
            ChatMessage.role == "assistant",
        )
    )
    assistant_message = result.scalar_one()

    assert token_messages
    assert all(message["message_id"] == start_message["message_id"] for message in token_messages)
    assert complete_message["message_id"] == start_message["message_id"]
    assert complete_message["message_id"] == str(assistant_message.id)


@pytest.mark.parametrize("publish_via", ["rest", "mcp"])
async def test_live_publish_clears_stale_draft_and_emits_draft_cleared_contract(
    auth_client,
    db_session,
    captured_ws_messages: list[dict[str, Any]],
    publish_via: str,
):
    """Live publish should remove any stale draft and clear draft UI state first."""

    user_id = await _get_test_user_id(db_session)
    module_id = f"stale-draft-live-publish-{publish_via}"
    draft_screen = {
        "title": "Stale Draft",
        "rows": [
            {
                "id": "draft-row",
                "cells": [
                    {
                        "id": "draft-cell",
                        "content": {
                            "type": "Text",
                            "props": {"content": "Draft content"},
                        },
                    }
                ],
            }
        ],
    }
    live_screen = {
        "title": "Fresh Live Screen",
        "rows": [
            {
                "id": "live-row",
                "cells": [
                    {
                        "id": "live-cell",
                        "content": {
                            "type": "Text",
                            "props": {"content": "Fresh live content"},
                        },
                    }
                ],
            }
        ],
    }

    draft_response = await auth_client.post(f"/api/sdui/{module_id}", json={"screen": draft_screen})
    assert draft_response.status_code == 200
    assert draft_response.json()["draft"] is True

    config_response = await auth_client.put(
        f"/api/sdui/{module_id}/config",
        json={"auto_approve_drafts": True},
    )
    assert config_response.status_code == 200
    assert config_response.json() == {"auto_approve_drafts": True}

    captured_ws_messages.clear()

    if publish_via == "rest":
        publish_response = await auth_client.post(f"/api/sdui/{module_id}", json={"screen": live_screen})
        assert publish_response.status_code == 200
        publish_result = publish_response.json()
    else:
        publish_result = await set_screen(
            module_id=module_id,
            screen=live_screen,
            user_id=user_id,
            draft=False,
        )

    assert publish_result["updated"] is True
    assert [message["type"] for message in captured_ws_messages] == [
        "sdui_draft_rejected",
        "sdui_screen_update",
    ]
    assert captured_ws_messages[0]["module_id"] == module_id
    assert captured_ws_messages[1]["module_id"] == module_id
    assert captured_ws_messages[1]["version"] == publish_result["version"]
    _assert_normalized_text_screen(captured_ws_messages[1]["screen"], "Fresh live content")

    draft_state_response = await auth_client.get(f"/api/sdui/{module_id}/draft")
    assert draft_state_response.status_code == 200
    assert draft_state_response.json() == {"screen": None, "has_draft": False, "version": 0}

    live_state_response = await auth_client.get(f"/api/sdui/{module_id}")
    assert live_state_response.status_code == 200
    _assert_normalized_text_screen(live_state_response.json()["screen"], "Fresh live content")


async def test_mcp_delete_screen_clears_live_draft_and_config_states(
    auth_client,
    db_session,
    captured_ws_messages: list[dict[str, Any]],
):
    """Deleting via MCP should clear every SDUI state key the REST path removes."""

    module_id = "mcp-delete-parity"
    user_id = await _get_test_user_id(db_session)

    live_screen = {
        "title": "Live Screen",
        "rows": [
            {
                "id": "row-live",
                "cells": [
                    {
                        "id": "cell-live",
                        "content": {
                            "type": "Text",
                            "props": {"content": "Live content"},
                        },
                    }
                ],
            }
        ],
    }
    draft_screen = {
        "title": "Draft Screen",
        "rows": [
            {
                "id": "row-draft",
                "cells": [
                    {
                        "id": "cell-draft",
                        "content": {
                            "type": "Text",
                            "props": {"content": "Draft content"},
                        },
                    }
                ],
            }
        ],
    }

    await auth_client.put(f"/api/sdui/{module_id}/config", json={"auto_approve_drafts": True})
    live_response = await auth_client.post(f"/api/sdui/{module_id}", json={"screen": live_screen})
    assert live_response.status_code == 200

    await auth_client.put(f"/api/sdui/{module_id}/config", json={"auto_approve_drafts": False})
    draft_response = await auth_client.post(f"/api/sdui/{module_id}", json={"screen": draft_screen})
    assert draft_response.status_code == 200

    db_session.add(
        ModuleState(
            id=str(uuid4()),
            user_id=user_id,
            module_type=sdui_module_config_key(module_id),
            state_json={"stale": True},
            version=1,
        )
    )
    await db_session.commit()

    captured_ws_messages.clear()

    result = await delete_screen(module_id=module_id, user_id=user_id)

    assert result == {"module_id": module_id, "deleted": True}
    assert [message["type"] for message in captured_ws_messages] == [
        "sdui_draft_rejected",
        "sdui_screen_update",
    ]
    assert captured_ws_messages[1]["screen"] is None
    assert captured_ws_messages[1]["version"] == 0

    remaining_result = await db_session.execute(
        select(ModuleState.module_type).where(
            ModuleState.user_id == user_id,
            ModuleState.module_type.in_(list(module_state_keys_to_clear(module_id))),
        )
    )
    assert remaining_result.all() == []

    live_screen_response = await auth_client.get(f"/api/sdui/{module_id}")
    assert live_screen_response.status_code == 200
    assert live_screen_response.json() == {"screen": None}

    draft_screen_response = await auth_client.get(f"/api/sdui/{module_id}/draft")
    assert draft_screen_response.status_code == 200
    assert draft_screen_response.json() == {"screen": None, "has_draft": False, "version": 0}

    config_response = await auth_client.get(f"/api/sdui/{module_id}/config")
    assert config_response.status_code == 200
    assert config_response.json() == {"auto_approve_drafts": False}


async def test_refresh_data_broadcasts_normalized_live_screen(
    auth_client,
    db_session,
    captured_ws_messages: list[dict[str, Any]],
):
    """refresh_data should reuse the normalized live-screen broadcaster contract."""

    user_id = await _get_test_user_id(db_session)
    legacy_screen = {
        "title": "Refresh Me",
        "sections": [
            {
                "id": "legacy-section",
                "components": [
                    {"type": "text", "content": "Refresh payload"},
                ],
            }
        ],
    }

    await auth_client.put("/api/sdui/home/config", json={"auto_approve_drafts": True})
    create_response = await auth_client.post("/api/sdui/home", json={"screen": legacy_screen})

    assert create_response.status_code == 200
    captured_ws_messages.clear()

    refresh_response = await auth_client.post(
        "/api/actions/execute",
        json={"function": "refresh_data", "params": {"module_id": "home"}},
    )

    assert refresh_response.status_code == 200
    assert refresh_response.json()["result"]["refreshed"] is True
    assert [message["type"] for message in captured_ws_messages] == ["sdui_screen_update"]

    message = captured_ws_messages[0]
    assert message["user_id"] == user_id
    assert message["module_id"] == "home"
    _assert_normalized_text_screen(message["screen"], "Refresh payload")


async def test_sdui_list_endpoints_only_return_live_screen_rows(
    auth_client,
    db_session,
):
    """Draft and stale config rows should be excluded from both SDUI list endpoints."""

    user_id = await _get_test_user_id(db_session)
    live_screen = {
        "title": "Live Screen",
        "rows": [
            {
                "id": "live-row",
                "cells": [
                    {
                        "id": "live-cell",
                        "content": {
                            "type": "Text",
                            "props": {"content": "Live content"},
                        },
                    }
                ],
            },
            {
                "id": "live-row-2",
                "cells": [
                    {
                        "id": "live-cell-2",
                        "content": {
                            "type": "Text",
                            "props": {"content": "Live content 2"},
                        },
                    }
                ],
            }
        ],
    }
    draft_screen = {
        "title": "Draft Screen",
        "rows": [
            {
                "id": "draft-row",
                "cells": [
                    {
                        "id": "draft-cell",
                        "content": {
                            "type": "Text",
                            "props": {"content": "Draft content"},
                        },
                    }
                ],
            }
        ],
    }

    await auth_client.put("/api/sdui/home/config", json={"auto_approve_drafts": True})
    live_response = await auth_client.post("/api/sdui/home", json={"screen": live_screen})
    assert live_response.status_code == 200

    draft_response = await auth_client.post("/api/sdui/forms", json={"screen": draft_screen})
    assert draft_response.status_code == 200
    assert draft_response.json()["draft"] is True

    db_session.add(
        ModuleState(
            id=str(uuid4()),
            user_id=user_id,
            module_type=sdui_module_config_key("alerts"),
            state_json={"stale": True},
            version=1,
        )
    )
    await db_session.commit()

    rest_response = await auth_client.get("/api/sdui")
    assert rest_response.status_code == 200

    mcp_response = await list_screens(user_id)

    rest_screens = rest_response.json()["screens"]
    mcp_screens = mcp_response["screens"]

    assert {screen["module_id"] for screen in rest_screens} == {"home"}
    assert {screen["module_id"] for screen in mcp_screens} == {"home"}
    assert rest_screens[0]["sections_count"] == 2
    assert mcp_screens[0]["sections_count"] == 2


async def test_mcp_set_screen_rejects_unsupported_nested_container_grandchild(
    auth_client,
    db_session,
):
    """Nested container descendants should be validated recursively."""

    user_id = await _get_test_user_id(db_session)
    invalid_screen = {
        "title": "Nested Container Validation",
        "rows": [
            {
                "id": "row-1",
                "cells": [
                    {
                        "id": "cell-1",
                        "content": {
                            "type": "Container",
                            "id": "outer-container",
                            "props": {"direction": "column"},
                            "children": [
                                {
                                    "type": "Container",
                                    "id": "inner-container",
                                    "props": {"direction": "column"},
                                    "children": [
                                        {
                                            "type": "UnsupportedWidget",
                                            "props": {"content": "bad grandchild"},
                                        }
                                    ],
                                }
                            ],
                        },
                    }
                ],
            }
        ],
    }

    with pytest.raises(
        ValueError,
        match="Unknown child component type 'UnsupportedWidget' inside Container 'inner-container'",
    ):
        await set_screen(module_id="home", screen=invalid_screen, user_id=user_id)


async def test_mcp_set_screen_rejects_cell_content_without_type(
    auth_client,
    db_session,
):
    """Cell content missing 'type' must be rejected, not silently stored.

    Without rejection, the mobile renderer receives a typeless component and
    shows a red 'Invalid component' box — the exact symptom we're guarding against.
    """
    user_id = await _get_test_user_id(db_session)
    invalid_screen = {
        "rows": [
            {
                "id": "row-1",
                "cells": [
                    {
                        "id": "cell-1",
                        # content object has props-like keys but no 'type' field
                        "content": {"label": "Settings", "color": "blue"},
                    }
                ],
            }
        ],
    }

    with pytest.raises(
        ValueError,
        match="Cell 'cell-1' content is missing required 'type' field",
    ):
        await set_screen(module_id="home", screen=invalid_screen, user_id=user_id)


async def test_mcp_set_screen_rejects_container_child_without_type(
    auth_client,
    db_session,
):
    """Container children missing 'type' must also be rejected.

    Previously the normalizer silently dropped typeless children, so the
    validator never saw them and the user lost content with no feedback.
    """
    user_id = await _get_test_user_id(db_session)
    invalid_screen = {
        "rows": [
            {
                "id": "row-1",
                "cells": [
                    {
                        "id": "cell-1",
                        "content": {
                            "type": "Container",
                            "id": "outer",
                            "props": {"direction": "column"},
                            "children": [
                                {"id": "typeless-child", "label": "oops"},
                            ],
                        },
                    }
                ],
            }
        ],
    }

    with pytest.raises(
        ValueError,
        match="Container 'outer' child 'typeless-child' is missing required 'type' field",
    ):
        await set_screen(module_id="home", screen=invalid_screen, user_id=user_id)


@pytest.mark.parametrize("component_type", ["Todo", "RichText", "ArticleCard"])
async def test_mcp_set_screen_accepts_widget_types_registered_in_mobile(
    auth_client,
    db_session,
    captured_ws_messages: list[dict[str, Any]],
    component_type: str,
):
    """Todo / RichText / ArticleCard are registered in the mobile componentRegistry,
    so the backend must treat them as valid V2 types — not reject them.
    """
    user_id = await _get_test_user_id(db_session)
    screen = {
        "rows": [
            {
                "id": "row-1",
                "cells": [
                    {
                        "id": "cell-1",
                        "content": {"type": component_type, "id": "w1", "props": {}},
                    }
                ],
            }
        ],
    }

    result = await set_screen(module_id="home", screen=screen, user_id=user_id)
    assert result["draft"] is True


def test_default_system_prompt_describes_sdui_schema() -> None:
    """The default chat system prompt must teach the LLM the SDUI schema.

    Without concrete schema guidance, the LLM emits typeless or malformed
    components when asked to build a screen — the root cause of the red
    'Invalid component' box on the phone.
    """
    prompt = agent_proxy.DEFAULT_SYSTEM_PROMPT
    assert "set_screen" in prompt
    assert "rows" in prompt
    assert "cells" in prompt
    # The critical lesson: every component needs a 'type'
    assert "type" in prompt
    # At least the core valid component types should be listed
    for required_type in ("Text", "Button", "Container"):
        assert required_type in prompt


async def test_rescue_sdui_json_from_prose_handles_deepseek_shapes(monkeypatch) -> None:
    """The prose-rescue fallback must catch the 3 JSON shapes weaker models emit.

    Without this, chats from models like DeepSeek-V3 produce a wall of JSON in the
    reply and the phone screen never updates.
    """
    from app.services import agent_proxy

    set_calls: list[tuple[str, dict]] = []
    delete_calls: list[str] = []

    async def fake_set(module_id: str, screen: dict, user_id: str):
        set_calls.append((module_id, screen))
        return {"ok": True}

    async def fake_delete(module_id: str, user_id: str):
        delete_calls.append(module_id)
        return {"ok": True}

    monkeypatch.setattr("app.mcp.tools.set_screen", fake_set)
    monkeypatch.setattr("app.mcp.tools.delete_screen", fake_delete)

    payload_inner = {
        "rows": [{"id": "r1", "cells": [{"id": "c1", "content": {
            "type": "Text", "id": "t1", "props": {"content": "Hi"}
        }}]}]
    }

    fake_fn_reply = (
        "Here's your home:\n"
        "<function>set_screen\n"
        "```json\n"
        + json.dumps({"module_id": "home", "screen": payload_inner})
        + "\n```"
    )
    wrapped_reply = (
        "```json\n"
        + json.dumps({"module_id": "home", "screen": payload_inner})
        + "\n```"
    )
    bare_reply = "```json\n" + json.dumps(payload_inner) + "\n```"
    delete_reply = (
        "<function>delete_screen\n"
        "```json\n"
        + json.dumps({"module_id": "home"})
        + "\n```"
    )
    empty_rows_reply = '```json\n{"rows": []}\n```'
    plain_reply = "I will help you with that."

    # Each call resets the captured lists so we can assert per-call behavior
    async def run(label: str, reply: str) -> str:
        set_calls.clear()
        delete_calls.clear()
        return await agent_proxy._rescue_sdui_json_from_prose("u1", "setup home", reply)

    # Shape 1: DeepSeek's fake <function>set_screen tag
    cleaned1 = await run("fake-fn", fake_fn_reply)
    assert len(set_calls) == 1 and set_calls[0][0] == "home"
    assert set_calls[0][1] == payload_inner
    assert "<function>" not in cleaned1
    assert "saved a draft" in cleaned1.lower()

    # Shape 2: plain code block containing {module_id, screen}
    cleaned2 = await run("wrapped-block", wrapped_reply)
    assert len(set_calls) == 1 and set_calls[0][1] == payload_inner

    # Shape 3: bare {"rows": [...]} code block
    cleaned3 = await run("bare-rows", bare_reply)
    assert len(set_calls) == 1 and set_calls[0][1] == payload_inner

    # Shape 4: delete_screen fake tool call
    cleaned4 = await run("delete", delete_reply)
    assert delete_calls == ["home"]
    assert "cleared" in cleaned4.lower()

    # Shape 5: empty rows — must NOT be rescued (placeholder illustrations)
    await run("empty", empty_rows_reply)
    assert set_calls == []

    # Shape 6: plain prose — untouched
    cleaned6 = await run("plain", plain_reply)
    assert set_calls == [] and cleaned6 == plain_reply


def test_set_screen_tool_schema_requires_component_type() -> None:
    """The set_screen tool JSON schema must require 'type' on cell.content.

    Function-calling models honor the JSON schema strictly, so declaring 'type'
    as required prevents the LLM from emitting typeless components.
    """
    tool_defs = {t["function"]["name"]: t["function"] for t in _get_tool_definitions()}
    set_screen_schema = tool_defs["set_screen"]["parameters"]["properties"]["screen"]

    # Find the row-first branch in the oneOf
    row_branch = next(
        branch for branch in set_screen_schema["oneOf"] if "rows" in branch.get("required", [])
    )
    cell_schema = row_branch["properties"]["rows"]["items"]["properties"]["cells"]["items"]
    content_schema = cell_schema["properties"]["content"]

    assert "type" in content_schema.get("required", []), (
        "set_screen tool schema must require 'type' on cell.content so function-calling "
        "models never emit typeless components."
    )
    type_enum = content_schema["properties"]["type"]["enum"]
    # Must at least include the core + widget types registered in mobile/src/renderer/componentRegistry.ts
    for required_type in ("Text", "Button", "Container", "Todo", "RichText", "ArticleCard"):
        assert required_type in type_enum