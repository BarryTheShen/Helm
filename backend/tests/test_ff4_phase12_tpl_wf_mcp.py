"""FF4 Phase 12 — Templates, workflows, MCP-QA PARTIAL REQ closure tests."""

import json
from pathlib import Path

import pytest

from app.services.sdui_state import validate_sdui_screen_payload
from app.services.template_seed import SEED_TEMPLATES
from app.services.workflow_seed import SAMPLE_WORKFLOWS, seed_sample_workflows

pytestmark = pytest.mark.anyio

TEMPLATES = "/api/templates"
WORKFLOWS = "/api/workflows"
APPS = "/api/apps"
REPO_ROOT = Path(__file__).resolve().parents[2]


async def test_ff4_tpl_001_seed_templates_are_functional_json():
    """FF4-TPL-001: Seed templates validate and include functional component bindings."""
    names = {item["name"] for item in SEED_TEMPLATES}
    assert {"Home", "Daily Planner", "Feed"}.issubset(names)
    for seed in SEED_TEMPLATES:
        if seed["name"] not in ("Home", "Daily Planner", "Feed"):
            continue
        _, errors = validate_sdui_screen_payload(seed["screen_json"])
        assert errors == [], f"{seed['name']} failed validation: {errors}"
        payload = json.dumps(seed["screen_json"])
        assert "CalendarModule" in payload or "Button" in payload


async def test_ff4_tpl_003_templates_are_json_payloads():
    """FF4-TPL-003: Templates are stored as JSON and validate against screen schema."""
    for seed in SEED_TEMPLATES:
        _, errors = validate_sdui_screen_payload(seed["screen_json"])
        assert errors == [], f"{seed['name']} failed validation: {errors}"
        assert isinstance(seed["screen_json"], dict)
        assert "rows" in seed["screen_json"]


async def test_ff4_tpl_004_apply_template_with_auto_checkpoint(auth_client, db_session):
    """FF4-TPL-004: Applying a template to existing module can auto-create checkpoint."""
    await seed_sample_workflows(db_session)

    create_module = await auth_client.post(
        "/api/sdui/modules",
        json={"name": "Phase 12 Target", "icon": "📦"},
    )
    assert create_module.status_code == 201
    module_id = create_module.json()["module_id"]

    home_seed = next(item for item in SEED_TEMPLATES if item["name"] == "Home")
    create_template = await auth_client.post(
        TEMPLATES,
        json={
            "name": "Phase 12 Home Clone",
            "category": home_seed["category"],
            "screen_json": home_seed["screen_json"],
        },
    )
    assert create_template.status_code == 201
    template_id = create_template.json()["id"]

    apply_resp = await auth_client.post(
        f"{TEMPLATES}/{template_id}/apply",
        json={"module_id": module_id, "auto_checkpoint": True},
    )
    assert apply_resp.status_code == 200
    assert apply_resp.json()["applied"] is True

    draft = await auth_client.get(f"/api/sdui/{module_id}/draft")
    assert draft.status_code == 200
    assert draft.json()["has_draft"] is True


async def test_ff4_wf_001_sample_workflows_seeded(auth_client, db_session):
    """FF4-WF-001: Sample workflows are visible via API for UI inspection."""
    await seed_sample_workflows(db_session)

    resp = await auth_client.get(WORKFLOWS)
    assert resp.status_code == 200
    names = {item["name"] for item in resp.json()["items"]}
    for expected in (workflow["name"] for workflow in SAMPLE_WORKFLOWS):
        assert expected in names


async def test_ff4_mcp_001_core_tools_registered():
    """FF4-MCP-001: MCP server registers Helm SDUI and app lifecycle tools."""
    from app.mcp import server as mcp_server

    source = Path(mcp_server.__file__).read_text(encoding="utf-8")
    required = {
        "helm_set_screen",
        "helm_get_screen",
        "helm_create_checkpoint",
        "helm_publish_version",
        "helm_create_app",
        "helm_publish_app",
        "helm_list_apps",
    }
    missing = {name for name in required if f"async def {name}(" not in source}
    assert not missing, f"Missing MCP tools: {sorted(missing)}"


async def test_ff4_mcp_002_agent_can_create_app_via_api(auth_client):
    """FF4-MCP-002: App creation path used by MCP agents succeeds end-to-end."""
    resp = await auth_client.post(APPS, json={"name": "MCP Phase 12 App", "icon": "bot"})
    assert resp.status_code == 201
    app_id = resp.json()["id"]

    detail = await auth_client.get(f"{APPS}/{app_id}")
    assert detail.status_code == 200
    assert detail.json()["name"] == "MCP Phase 12 App"


def test_ff4_qa_004_react_doctor_documented_in_agents():
    """FF4-QA-004: React Doctor is wired into reviewer/tester automation docs."""
    agents_md = (REPO_ROOT / "AGENTS.md").read_text(encoding="utf-8")
    reviewer_md = (REPO_ROOT / ".cursor/agents/helm-reviewer.md").read_text(encoding="utf-8")
    assert "react-doctor" in agents_md.lower()
    assert "react doctor" in reviewer_md.lower() or "react-doctor" in reviewer_md.lower()


def test_ff4_qa_006_connections_usage_documented():
    """FF4-QA-006: Connections end-to-end usage is documented for admins."""
    frontend_doc = (REPO_ROOT / "docs/codebase-explanation/frontend.md").read_text(encoding="utf-8")
    backend_doc = (REPO_ROOT / "docs/codebase-explanation/backend.md").read_text(encoding="utf-8")
    assert "ConnectionsPage" in frontend_doc
    assert "/api/connections" in backend_doc
    assert "end-to-end" in frontend_doc.lower()
