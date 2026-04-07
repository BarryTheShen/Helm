"""Tests for the draft/approval flow (SDUI drafts)."""

import pytest

pytestmark = pytest.mark.anyio


# ── Get Draft — No Draft Exists ────────────────────────────────────────────

async def test_get_draft_empty(auth_client):
    resp = await auth_client.get("/api/sdui/home/draft")
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_draft"] is False
    assert data["screen"] is None


async def test_get_draft_requires_auth(client):
    resp = await client.get("/api/sdui/home/draft")
    assert resp.status_code == 401


# ── Approve Draft — No Draft ──────────────────────────────────────────────

async def test_approve_draft_no_draft(auth_client):
    resp = await auth_client.post("/api/sdui/home/draft/approve")
    assert resp.status_code == 404
    assert "No draft found" in resp.json()["detail"]


# ── Reject Draft — No Draft ───────────────────────────────────────────────

async def test_reject_draft_no_draft(auth_client):
    resp = await auth_client.post("/api/sdui/home/draft/reject")
    assert resp.status_code == 404
    assert "No draft found" in resp.json()["detail"]


# ── Full Draft Lifecycle: Create → Get → Approve ──────────────────────────

async def test_draft_full_approve_lifecycle(auth_client):
    """Create a draft manually, read it, approve it — verify it becomes live."""

    # 1. Simulate draft creation by writing to the draft key directly via SDUI endpoint
    # We'll use the module_state mechanism: store a draft screen
    from app.models.module_state import ModuleState
    from uuid import uuid4

    draft_screen = {
        "title": "Draft Home Screen",
        "sections": [
            {
                "id": "s1",
                "components": [
                    {"type": "text", "props": {"content": "Draft content"}}
                ],
            }
        ],
    }

    # Write draft via direct DB access through the endpoint pattern
    # The REST endpoint stores drafts at key sdui__<module>__draft
    # Let's create it by calling set_sdui_screen with a draft key...
    # Actually, let's use the module state endpoint to simulate what MCP tools.set_screen(draft=True) does

    # First check no live screen exists
    resp = await auth_client.get("/api/sdui/home")
    assert resp.json()["screen"] is None

    # Create draft by storing directly in module_states via the modules endpoint
    # We need to use internal DB path — but tests use the HTTP API.
    # The draft is created by MCP set_screen(draft=True). For testing,
    # let's write directly to the draft key using the SDUI POST endpoint trick:
    # Store draft content at sdui__home__draft  via generic module state
    # Actually, let's just test the REST draft endpoints assuming a draft exists.
    # We'll set up the draft by storing via module action.

    # POST /api/sdui/home now creates a draft by default (auto_approve_drafts=False)
    resp = await auth_client.post(
        "/api/sdui/home",
        json={"screen": draft_screen},
    )
    assert resp.status_code == 200
    assert resp.json()["draft"] is True

    # 2. Get draft — it should exist now

    resp = await auth_client.get("/api/sdui/home/draft")
    assert resp.status_code == 200
    data = resp.json()
    assert data["has_draft"] is True
    assert data["screen"]["title"] == "Draft Home Screen"

    # 3. Approve the draft
    resp = await auth_client.post("/api/sdui/home/draft/approve")
    assert resp.status_code == 200
    data = resp.json()
    assert data["approved"] is True
    assert data["module_id"] == "home"

    # 4. Draft should be gone
    resp = await auth_client.get("/api/sdui/home/draft")
    assert resp.json()["has_draft"] is False

    # 5. Live screen should have the draft content
    resp = await auth_client.get("/api/sdui/home")
    data = resp.json()
    assert data["screen"]["title"] == "Draft Home Screen"
    assert len(data["screen"]["sections"]) == 1


# ── Full Draft Lifecycle: Create → Reject ─────────────────────────────────

async def test_draft_full_reject_lifecycle(auth_client):
    """Create a draft, reject it — verify it's deleted and no live screen is set."""

    draft_screen = {
        "title": "Bad Draft",
        "sections": [],
    }

    # POST /api/sdui/calendar now creates a draft by default
    await auth_client.post(
        "/api/sdui/calendar",
        json={"screen": draft_screen},
    )

    # Verify draft exists
    resp = await auth_client.get("/api/sdui/calendar/draft")
    assert resp.json()["has_draft"] is True

    # Reject draft
    resp = await auth_client.post("/api/sdui/calendar/draft/reject")
    assert resp.status_code == 200
    assert resp.json()["rejected"] is True

    # Draft should be gone
    resp = await auth_client.get("/api/sdui/calendar/draft")
    assert resp.json()["has_draft"] is False

    # No live screen should exist
    resp = await auth_client.get("/api/sdui/calendar")
    assert resp.json()["screen"] is None


# ── Approve overwrites existing live screen ───────────────────────────────

async def test_approve_draft_overwrites_live(auth_client):
    """If a live screen already exists, approving a draft replaces it."""

    # Set initial live screen (auto-approve so it goes live)
    await auth_client.put("/api/sdui/forms/config", json={"auto_approve_drafts": True})
    await auth_client.post(
        "/api/sdui/forms",
        json={"screen": {"title": "Old Screen", "sections": []}},
    )
    resp = await auth_client.get("/api/sdui/forms")
    assert resp.json()["screen"]["title"] == "Old Screen"

    # Disable auto-approve, then create a draft via POST
    await auth_client.put("/api/sdui/forms/config", json={"auto_approve_drafts": False})
    await auth_client.post(
        "/api/sdui/forms",
        json={"screen": {"title": "New Draft Screen", "sections": [{"id": "s1", "components": []}]}},
    )

    # Approve draft — should replace the live screen
    resp = await auth_client.post("/api/sdui/forms/draft/approve")
    assert resp.status_code == 200

    # Verify live screen is now the draft content
    resp = await auth_client.get("/api/sdui/forms")
    data = resp.json()
    assert data["screen"]["title"] == "New Draft Screen"
    assert len(data["screen"]["sections"]) == 1


# ── Multiple modules have independent drafts ──────────────────────────────

async def test_drafts_independent_per_module(auth_client):
    """Drafts for different modules don't interfere with each other."""

    # Create drafts for two modules (default behavior: POST creates a draft)
    await auth_client.post(
        "/api/sdui/home",
        json={"screen": {"title": "Home Draft", "sections": []}},
    )
    await auth_client.post(
        "/api/sdui/alerts",
        json={"screen": {"title": "Alerts Draft", "sections": []}},
    )

    # Approve home draft
    resp = await auth_client.post("/api/sdui/home/draft/approve")
    assert resp.status_code == 200

    # Alerts draft should still exist
    resp = await auth_client.get("/api/sdui/alerts/draft")
    assert resp.json()["has_draft"] is True
    assert resp.json()["screen"]["title"] == "Alerts Draft"

    # Home draft should be gone (it was approved)
    resp = await auth_client.get("/api/sdui/home/draft")
    assert resp.json()["has_draft"] is False
