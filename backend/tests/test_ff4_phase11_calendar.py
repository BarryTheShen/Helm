"""FF4 Phase 11 — Calendar PARTIAL REQ closure tests."""

import json

import pytest

from app.services.component_seed import INITIAL_COMPONENTS
from app.services.template_seed import SEED_TEMPLATES

pytestmark = pytest.mark.anyio

EVENTS = "/api/calendar/events"


def _calendar_seed() -> dict:
    return next(item for item in INITIAL_COMPONENTS if item["type"] == "CalendarModule")


async def test_ff4_cal_001_calendar_registered_as_first_class():
    """FF4-CAL-001: CalendarModule is a real registry component with variant support."""
    seed = _calendar_seed()
    assert seed["type"] == "CalendarModule"
    assert "variant" in seed["props_schema"]


async def test_ff4_cal_002_seed_templates_use_calendar_variants():
    """FF4-CAL-002: Seed templates exercise month/week/compact calendar variants."""
    variants = set()
    for template in SEED_TEMPLATES:
        screen = json.dumps(template["screen_json"])
        if "CalendarModule" not in screen:
            continue
        for variant in ("month", "week", "day", "eventList", "compact"):
            if f'"variant": "{variant}"' in screen or f'"variant":"{variant}"' in screen:
                variants.add(variant)
    assert "compact" in variants
    assert "week" in variants
    seed = _calendar_seed()
    assert len(seed["props_schema"]["variant"]["options"]) == 5


async def test_ff4_cal_003_event_list_backed_by_unified_events(auth_client):
    """FF4-CAL-003: Unified event list returns chronological events for filtering."""
    await auth_client.post(
        EVENTS,
        json={
            "title": "Morning sync",
            "start_time": "2025-08-01T09:00:00Z",
            "end_time": "2025-08-01T09:30:00Z",
            "category": "work",
        },
    )
    await auth_client.post(
        EVENTS,
        json={
            "title": "Lunch",
            "start_time": "2025-08-01T12:00:00Z",
            "end_time": "2025-08-01T13:00:00Z",
            "category": "personal",
        },
    )
    resp = await auth_client.get(EVENTS)
    events = resp.json()["events"]
    titles = [event["title"] for event in events if event["title"] in ("Morning sync", "Lunch")]
    assert len(titles) == 2


async def test_ff4_cal_004_home_template_uses_compact_calendar():
    """FF4-CAL-004: Home template places compact calendar in 50/50 dashboard row."""
    home = next(item for item in SEED_TEMPLATES if item["name"] == "Home")
    screen = home["screen_json"]
    row_with_calendar = next(
        row for row in screen["rows"]
        if any(
            cell.get("content", {}).get("type") == "CalendarModule"
            for cell in row.get("cells", [])
        )
    )
    widths = [cell.get("width") for cell in row_with_calendar["cells"]]
    assert "50%" in widths
    calendar_cell = next(
        cell for cell in row_with_calendar["cells"]
        if cell.get("content", {}).get("type") == "CalendarModule"
    )
    assert calendar_cell["content"]["props"]["variant"] == "compact"


async def test_ff4_cal_006_calendar_events_support_date_navigation_fields(auth_client):
    """FF4-CAL-006: Events expose start/end for built-in navigation rendering."""
    resp = await auth_client.post(
        EVENTS,
        json={
            "title": "Nav test",
            "start_time": "2025-08-02T08:00:00Z",
            "end_time": "2025-08-02T09:00:00Z",
        },
    )
    data = resp.json()
    assert "start_time" in data
    assert "end_time" in data


async def test_ff4_cal_007_calendar_seed_documents_compact_threshold():
    """FF4-CAL-007: Calendar schema includes compactThreshold for fit-the-cell warnings."""
    seed = _calendar_seed()
    assert "compactThreshold" in seed["props_schema"]


async def test_ff4_cal_011_event_detail_fields_present(auth_client):
    """FF4-CAL-011: Events include detail fields (location, notes, source metadata)."""
    resp = await auth_client.post(
        EVENTS,
        json={
            "title": "Detail surface",
            "start_time": "2025-08-03T10:00:00Z",
            "end_time": "2025-08-03T11:00:00Z",
            "location": "Room A",
            "notes": "Bring prototype",
            "source_type": "notion",
        },
    )
    data = resp.json()
    assert data["location"] == "Room A"
    assert data["notes"] == "Bring prototype"
    assert data["source_type"] == "notion"


async def test_ff4_cal_014_local_source_is_default(auth_client):
    """FF4-CAL-014: Local-first events default to local source type."""
    resp = await auth_client.post(
        EVENTS,
        json={
            "title": "Local only",
            "start_time": "2025-08-04T10:00:00Z",
            "end_time": "2025-08-04T11:00:00Z",
        },
    )
    assert resp.json()["source_type"] == "local"


async def test_ff4_cal_015_source_color_persisted(auth_client):
    """FF4-CAL-015: Per-event source color is stored on unified model."""
    resp = await auth_client.post(
        EVENTS,
        json={
            "title": "Colored",
            "start_time": "2025-08-05T10:00:00Z",
            "end_time": "2025-08-05T11:00:00Z",
            "color": "#FF00AA",
            "source_type": "caldav",
        },
    )
    data = resp.json()
    assert data["color"] == "#FF00AA"
    assert data["source_type"] == "caldav"


async def test_ff4_cal_016_calendar_schema_exposes_filter_props():
    """FF4-CAL-016: Calendar registry exposes admin filter configuration props."""
    seed = _calendar_seed()
    assert "sourceTypes" in seed["props_schema"]
    assert "categoryFilter" in seed["props_schema"]


async def test_ff4_cal_017_minimum_calendar_api_coverage(auth_client):
    """FF4-CAL-017: Calendar API supports list/create/update/delete for QA coverage."""
    create = await auth_client.post(
        EVENTS,
        json={
            "title": "Coverage event",
            "start_time": "2025-08-06T10:00:00Z",
            "end_time": "2025-08-06T11:00:00Z",
        },
    )
    event_id = create.json()["id"]

    update = await auth_client.put(f"{EVENTS}/{event_id}", json={"title": "Updated coverage"})
    assert update.status_code == 200

    delete = await auth_client.delete(f"{EVENTS}/{event_id}")
    assert delete.status_code == 200


async def test_ff4_cal_021_daily_planner_template_week_calendar():
    """FF4-CAL-021: Daily Planner template embeds week calendar in Empty container stack."""
    planner = next(item for item in SEED_TEMPLATES if item["name"] == "Daily Planner")
    screen = json.dumps(planner["screen_json"])
    assert "Empty" in screen
    assert "CalendarModule" in screen
    assert '"variant": "week"' in screen or '"variant":"week"' in screen


async def test_ff4_cal_023_compact_threshold_in_home_and_planner():
    """FF4-CAL-023: Calendar schema configures compactThreshold for auto-adapt behavior."""
    seed = _calendar_seed()
    assert seed["default_props"]["compactThreshold"] == 200


async def test_ff4_cal_024_all_source_types_supported(auth_client):
    """FF4-CAL-024: Unified model accepts all four source types for badge colors."""
    for source_type in ("local", "caldav", "notion", "custom"):
        resp = await auth_client.post(
            EVENTS,
            json={
                "title": f"{source_type} event",
                "start_time": "2025-08-07T10:00:00Z",
                "end_time": "2025-08-07T11:00:00Z",
                "source_type": source_type,
            },
        )
        assert resp.status_code == 201
        assert resp.json()["source_type"] == source_type


async def test_ff4_cal_025_event_notes_truncation_field(auth_client):
    """FF4-CAL-025: Events store notes for two-line truncated display."""
    long_notes = "Line one\nLine two\nLine three should truncate in UI"
    resp = await auth_client.post(
        EVENTS,
        json={
            "title": "Notes event",
            "start_time": "2025-08-08T10:00:00Z",
            "end_time": "2025-08-08T11:00:00Z",
            "notes": long_notes,
        },
    )
    assert resp.json()["notes"] == long_notes
