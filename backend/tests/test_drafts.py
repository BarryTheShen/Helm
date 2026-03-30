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

    # Simplest approach: store draft via set_sdui for draft key using raw module state
    from app.database import get_db
    from app.main import app as fastapi_app

    # Instead, let's use the action registry approach since we already tested that
    # The approve_draft handler in action_registry calls mcp/tools.approve_draft
    # which needs context. Let's test the REST endpoints with direct DB setup.

    # Alternative: Just POST to a known endpoint to create the draft state.
    # The draft key is: sdui__home__draft
    # Let's use the generic set_sdui endpoint with "home__draft" as module_id
    # This is a hack but lets us test the approve endpoint correctly.

    # Actually we should just POST raw module state. Let's use a simpler approach:
    # /api/sdui/home__draft endpoint (since module_id accepts any string)
    resp = await auth_client.post(
        "/api/sdui/home__draft",
        json={"screen": draft_screen},
    )
    assert resp.status_code == 200

    # 2. Get draft — it should exist now
    # The draft endpoint looks for sdui__home__draft which = sdui__ + "home" + __draft
    # But we wrote to sdui__home__draft (which is sdui__ + "home__draft")
    # Those are different keys! Let me reconsider.
    # GET /api/sdui/home/draft -> looks for module_type = "sdui__home__draft"
    # POST /api/sdui/home__draft -> stores at module_type = "sdui__home__draft"
    # These ARE the same! ✓

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

    # Create draft via module_id hack
    await auth_client.post(
        "/api/sdui/calendar__draft",
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

    # Set initial live screen
    await auth_client.post(
        "/api/sdui/forms",
        json={"screen": {"title": "Old Screen", "sections": []}},
    )
    resp = await auth_client.get("/api/sdui/forms")
    assert resp.json()["screen"]["title"] == "Old Screen"

    # Create draft
    await auth_client.post(
        "/api/sdui/forms__draft",
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

    # Create drafts for two modules
    await auth_client.post(
        "/api/sdui/home__draft",
        json={"screen": {"title": "Home Draft", "sections": []}},
    )
    await auth_client.post(
        "/api/sdui/alerts__draft",
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
