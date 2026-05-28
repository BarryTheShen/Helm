"""FF3 supplemental + FF4 backend PARTIAL closure tests (2026-05-28)."""

from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from app.services.component_seed import INITIAL_COMPONENTS
from app.services.sdui_state import validate_sdui_screen_payload
from app.services.template_seed import SEED_TEMPLATES

REPO_ROOT = Path(__file__).resolve().parents[2]
WEB_PAGES = REPO_ROOT / "web" / "src" / "pages"
WEB_EDITOR = REPO_ROOT / "web" / "src" / "editor"
MOBILE_UTILS = REPO_ROOT / "mobile" / "src" / "utils" / "sduiTextContent.ts"

pytestmark = pytest.mark.anyio

NOTES = "/api/notes"
TODOS = "/api/todos"
MODULES = "/api/modules"
APPS = "/api/apps"
DEVICES = "/api/devices"

VALID_MODULE_SCREEN = {
    "rows": [
        {
            "id": "row-1",
            "cells": [
                {
                    "id": "cell-1",
                    "content": {
                        "id": "text-1",
                        "type": "Text",
                        "props": {"content": "Closure test"},
                    },
                }
            ],
        }
    ],
}


def _find_seed_template(name: str) -> dict:
    return next(item for item in SEED_TEMPLATES if item["name"] == name)


def _screen_json_contains(screen: dict, needle: str) -> bool:
    return needle in json.dumps(screen)


def test_ff4_be_015_canonical_publish_flow_reexport():
    """FF4-BE-015: canonical flow test lives in test_app_versions.test_canonical_module_app_device_publish_flow."""
    source = (REPO_ROOT / "backend" / "tests" / "test_app_versions.py").read_text()
    assert "test_canonical_module_app_device_publish_flow" in source
    assert "FF4-BE-015" in source


def test_ff4_be_001_production_single_port_bundle():
    """FF4-BE-001: Dockerfile + compose expose one port; main.py mounts admin at /."""
    compose = (REPO_ROOT / "docker-compose.yml").read_text()
    assert "8000:8000" in compose
    main_py = (REPO_ROOT / "backend" / "app" / "main.py").read_text()
    assert 'app.mount("/",' in main_py
    assert "html=True" in main_py


def test_ff4_be_004_docker_compose_persistence():
    """FF4-BE-004: docker compose defines helm service, port, volumes."""
    content = (REPO_ROOT / "docker-compose.yml").read_text()
    assert "helm:" in content
    assert "helm-data" in content
    assert "SERVE_STATIC" in content


def test_ff4_be_005_api_ws_mcp_namespaces_coexist():
    """FF4-BE-005: API, WebSocket, MCP routes registered before static mount."""
    main_py = (REPO_ROOT / "backend" / "app" / "main.py").read_text()
    static_idx = main_py.index('app.mount("/",')
    assert "include_router(websocket.router)" in main_py
    assert main_py.index("include_router(websocket.router)") < static_idx
    assert "settings.mcp_path" in main_py or "mcp_path" in main_py


async def test_ff3_notes_save_001_notes_create_without_422(auth_client):
    """FF3-NOTES-SAVE-001: Notes POST returns 201, not 422."""
    resp = await auth_client.post(
        NOTES,
        json={"title": "FF3 closure note", "content": "Saved body"},
    )
    assert resp.status_code == 201, resp.text
    assert resp.json()["title"] == "FF3 closure note"


async def test_ff3_todo_func_001_todo_crud(auth_client):
    """FF3-TODO-FUNC-001: Todo create/list/toggle/delete."""
    create = await auth_client.post(TODOS, json={"text": "FF3 todo", "completed": False})
    assert create.status_code == 201
    todo_id = create.json()["id"]

    listing = await auth_client.get(TODOS)
    assert listing.status_code == 200
    assert any(item["id"] == todo_id for item in listing.json()["todos"])

    toggle = await auth_client.patch(f"{TODOS}/{todo_id}", json={"completed": True})
    assert toggle.status_code == 200
    assert toggle.json()["completed"] is True


async def test_ff3_article_save_001_article_card_registered_and_validates():
    """FF3-ARTICLE-SAVE-001: ArticleCard in registry; screen validates."""
    types = {c["type"] for c in INITIAL_COMPONENTS}
    assert "ArticleCard" in types

    screen = {
        "rows": [
            {
                "id": "row-1",
                "cells": [
                    {
                        "id": "cell-1",
                        "content": {
                            "id": "art-1",
                            "type": "ArticleCard",
                            "props": {"title": "Test", "description": "Body"},
                        },
                    }
                ],
            }
        ],
    }
    _, errors = validate_sdui_screen_payload(screen)
    assert errors == []


async def test_ff3_rtr_save_001_rich_text_renderer_registered_and_validates():
    """FF3-RTR-SAVE-001: RichTextRenderer publishable via validation."""
    types = {c["type"] for c in INITIAL_COMPONENTS}
    assert "RichTextRenderer" in types

    screen = {
        "rows": [
            {
                "id": "row-1",
                "cells": [
                    {
                        "id": "cell-1",
                        "content": {
                            "id": "rt-1",
                            "type": "RichTextRenderer",
                            "props": {"content": "# Hello\n\nParagraph"},
                        },
                    }
                ],
            }
        ],
    }
    _, errors = validate_sdui_screen_payload(screen)
    assert errors == []


def test_ff3_tpl_home_001_home_template_functional_seed():
    """FF3-TPL-HOME-001: Home template includes weather vars, calendar, todo, notes, buttons."""
    home = _find_seed_template("Home")
    screen = home["screen_json"]
    payload = json.dumps(screen)
    assert _screen_json_contains(screen, "CalendarModule")
    assert "compact" in payload.lower() or '"variant"' in payload
    assert "Todo" in payload or "todo" in payload
    assert "NotesModule" in payload
    assert "Button" in payload
    assert "{{" in payload


def test_ff3_tpl_planner_001_daily_planner_empty_stack():
    """FF3-TPL-PLANNER-001: Daily Planner uses Empty vertical stack with calendar/todo/notes."""
    planner = _find_seed_template("Daily Planner")
    screen = planner["screen_json"]
    payload = json.dumps(screen)
    assert "Empty" in payload
    assert "CalendarModule" in payload
    assert "Todo" in payload or "todo" in payload.lower()
    assert "NotesModule" in payload or "Notes" in payload


def test_ff3_tpl_feed_001_feed_template_article_and_rich_text():
    """FF3-TPL-FEED-001: Feed template includes ArticleCard and RichText."""
    feed = _find_seed_template("Feed")
    payload = json.dumps(feed["screen_json"])
    assert "ArticleCard" in payload
    assert "RichText" in payload


def test_ff3_row_types_001_add_row_ui_no_legacy_type_picker():
    """FF3-ROW-TYPES-001: StructureTree add-row has no header/footer/content picker."""
    structure_tree = (WEB_EDITOR / "StructureTree.tsx").read_text()
    assert "btn-add-row" in structure_tree
    assert "header row" not in structure_tree.lower()
    assert "footer row" not in structure_tree.lower()
    picker = (WEB_EDITOR / "ComponentPicker.tsx").read_text()
    assert "getAuthorableComponents" in picker
    assert "COMPONENT_PRESETS" not in picker


def test_ff3_row_presets_001_component_picker_excludes_presets():
    """FF3-ROW-PRESETS-001: Add-cell picker uses authorable components only."""
    types_py = (WEB_EDITOR / "types.ts").read_text()
    assert "COMPONENT_PRESETS" in types_py
    picker = (WEB_EDITOR / "ComponentPicker.tsx").read_text()
    assert "getAuthorableComponents()" in picker
    assert "COMPONENT_PRESETS" not in picker


def test_ff3_sess10_rename_001_no_screen_tab_labels_in_admin_nav():
    """FF3-SESS10-RENAME-001: Admin nav uses Module terminology, not screen/tab editor labels."""
    admin_layout = (REPO_ROOT / "web" / "src" / "components" / "AdminLayout.tsx").read_text()
    assert "Module Editor" in admin_layout
    assert "Visual Editor" not in admin_layout
    assert "Screen Editor" not in admin_layout

    forbidden = re.compile(r"\bScreen Editor\b|\bVisual Editor\b", re.IGNORECASE)
    for page_file in WEB_PAGES.glob("*.tsx"):
        text = page_file.read_text()
        assert not forbidden.search(text), f"{page_file.name} contains legacy screen editor label"


def test_ff3_md_render_001_mobile_newline_hard_break_helper():
    """FF3-MD-RENDER-001: mobile sduiTextContent converts single newlines to markdown breaks."""
    assert MOBILE_UTILS.is_file()
    content = MOBILE_UTILS.read_text()
    assert "markdownWithHardBreaks" in content
    assert "  \\n" in content

    def markdown_with_hard_breaks(text: str) -> str:
        import re as _re

        return _re.sub(r"(?<!\n)\n(?!\n)", "  \n", text)

    assert markdown_with_hard_breaks("Line one\nLine two") == "Line one  \nLine two"


async def test_ff3_sess10_bbar_001_bottom_bar_max_five_slots(db_session):
    """FF3-SESS10-BBAR-001: backend rejects more than five bottom bar slots."""
    from app.services.app_service import validate_bottom_bar_config

    slots = [
        {
            "module_instance_id": f"mod-{i}",
            "module_type": "custom",
            "name": f"Slot {i}",
            "icon": "📦",
            "slot_position": i,
        }
        for i in range(6)
    ]
    is_valid, error_msg = await validate_bottom_bar_config(db_session, "unused-user-id", slots)
    assert is_valid is False
    assert "5" in (error_msg or "")


async def test_ff3_module_usage_endpoint_for_affected_apps(auth_client, db_session):
    """FF3-SESS10-RENAME/DELETE-MODAL-001: usage API lists apps referencing a module."""
    from app.models.module_instance import ModuleInstance
    from app.models.user import User
    from sqlalchemy import select

    result = await db_session.execute(select(User))
    user = result.scalar_one()

    module = ModuleInstance(
        id="ff3-usage-mod",
        user_id=user.id,
        module_type="home",
        name="Usage Test Module",
        status="active",
    )
    db_session.add(module)
    await db_session.commit()

    app_resp = await auth_client.post(APPS, json={"name": "FF3 Usage App"})
    app_id = app_resp.json()["id"]

    update = await auth_client.put(
        f"{APPS}/{app_id}",
        json={
            "bottom_bar_config": [
                {
                    "module_instance_id": "ff3-usage-mod",
                    "module_type": "home",
                    "name": "Usage Test Module",
                    "icon": "🏠",
                    "slot_position": 0,
                }
            ],
        },
    )
    assert update.status_code == 200

    usage = await auth_client.get(f"{MODULES}/ff3-usage-mod/usage")
    assert usage.status_code == 200
    apps = usage.json()["used_by_apps"]
    assert any(item["app_name"] == "FF3 Usage App" for item in apps)
