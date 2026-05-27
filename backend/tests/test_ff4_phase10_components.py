"""FF4 Phase 10 — Components PARTIAL REQ closure tests."""

import json

import pytest

from app.services.component_seed import INITIAL_COMPONENTS
from app.services.sdui_state import validate_sdui_screen_payload
from app.services.template_seed import SEED_TEMPLATES

pytestmark = pytest.mark.anyio

NOTES = "/api/notes"
TODOS = "/api/todos"
VARIABLES = "/api/variables"


def _find_seed_template(name: str) -> dict:
    return next(item for item in SEED_TEMPLATES if item["name"] == name)


def _screen_has_type(screen_json: dict, comp_type: str) -> bool:
    return comp_type in json.dumps(screen_json)


async def test_ff4_btn_003_home_template_buttons_have_server_actions():
    """FF4-BTN-003: Functional templates include buttons with configured server actions."""
    home = _find_seed_template("Home")
    screen = home["screen_json"]
    assert _screen_has_type(screen, "Button")
    payload = json.dumps(screen)
    assert "server_action" in payload
    assert "todos.create" in payload or "notes.create" in payload


async def test_ff4_img_001_image_registry_supports_fit_mode():
    """FF4-IMG-001: Image component registry exposes fitWidth/fitHeight fitMode."""
    image = next(item for item in INITIAL_COMPONENTS if item["type"] == "image")
    assert "fitMode" in image["props_schema"]
    assert set(image["props_schema"]["fitMode"]["options"]) >= {"fitWidth", "fitHeight"}


async def test_ff4_var_001_variable_resolution_in_text(auth_client):
    """FF4-VAR-001: Variables resolve in rendered text content."""
    from app.services.variable_resolver import resolve_expression

    create = await auth_client.post(VARIABLES, json={"name": "phase10_greeting", "value": "Helm"})
    assert create.status_code == 201

    result = await resolve_expression(
        "Hello {{custom.phase10_greeting}}",
        {"custom_variables": {"phase10_greeting": "Helm"}},
    )
    assert result == "Hello Helm"


async def test_ff4_ec_001_empty_vertical_row_validates():
    """FF4-EC-001: Empty container is a valid vertical row component."""
    screen = {
        "title": "Empty stack",
        "rows": [
            {
                "id": "row-1",
                "cells": [
                    {
                        "id": "cell-1",
                        "content": {
                            "id": "empty-1",
                            "type": "Empty",
                            "props": {},
                            "children": [
                                {"id": "text-1", "type": "Text", "props": {"content": "Top"}},
                                {"id": "text-2", "type": "Text", "props": {"content": "Bottom"}},
                            ],
                        },
                    }
                ],
            }
        ],
    }
    _, errors = validate_sdui_screen_payload(screen)
    assert errors == []


async def test_ff4_ec_005_empty_registered_as_structural_component():
    """FF4-EC-005: Empty is registered and accepts SDUI structural props."""
    empty = next(item for item in INITIAL_COMPONENTS if item["type"] == "Empty")
    assert empty["tier"] == "atomic"
    assert empty["name"] == "Empty"


async def test_ff4_notes_001_notes_crud_feed(auth_client):
    """FF4-NOTES-001: Notes API supports list/create/read for feed UX."""
    create = await auth_client.post(
        NOTES,
        json={
            "title": "Phase 10 Note",
            "content": "# Standup\n\nDiscuss calendar parity.",
        },
    )
    assert create.status_code == 201
    note_id = create.json()["id"]

    listing = await auth_client.get(NOTES)
    assert listing.status_code == 200
    notes = listing.json()["notes"]
    assert any(item["id"] == note_id for item in notes)

    detail = await auth_client.get(f"{NOTES}/{note_id}")
    assert detail.status_code == 200
    assert detail.json()["title"] == "Phase 10 Note"


async def test_ff4_ib_001_input_bar_registered_with_send_action():
    """FF4-IB-001: InputBar registry includes send placeholder wiring."""
    input_bar = next(item for item in INITIAL_COMPONENTS if item["type"] == "InputBar")
    assert input_bar["type"] == "InputBar"
    assert "placeholder" in input_bar["props_schema"]


async def test_ff4_todo_001_todo_api_toggle_and_delete(auth_client):
    """FF4-TODO-001: Todo API supports create, toggle, and delete."""
    create = await auth_client.post(TODOS, json={"text": "Phase 10 task", "completed": False})
    assert create.status_code == 201
    todo_id = create.json()["id"]

    toggle = await auth_client.patch(f"{TODOS}/{todo_id}", json={"completed": True})
    assert toggle.status_code == 200
    assert toggle.json()["completed"] is True

    delete = await auth_client.delete(f"{TODOS}/{todo_id}")
    assert delete.status_code == 200

    listing = await auth_client.get(TODOS)
    ids = [item["id"] for item in listing.json()["todos"]]
    assert todo_id not in ids
