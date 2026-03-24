"""Tests for notification endpoints."""

import pytest

from app.models.notification import Notification


pytestmark = pytest.mark.anyio


async def test_list_notifications_empty(auth_client):
    resp = await auth_client.get("/api/notifications")
    assert resp.status_code == 200
    data = resp.json()
    assert data["notifications"] == []
    assert data["unread_count"] == 0


async def test_notifications_requires_auth(client):
    resp = await client.get("/api/notifications")
    assert resp.status_code == 401


async def test_list_notifications_with_data(auth_client, db_session):
    from app.models.user import User
    from sqlalchemy import select

    # Get the user created by auth_client fixture
    result = await db_session.execute(select(User).limit(1))
    user = result.scalar_one()

    notif = Notification(
        user_id=str(user.id),
        title="Test Alert",
        message="Something happened",
        severity="info",
    )
    db_session.add(notif)
    await db_session.commit()

    resp = await auth_client.get("/api/notifications")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["notifications"]) == 1
    assert data["notifications"][0]["title"] == "Test Alert"
    assert data["unread_count"] == 1


async def test_mark_notification_read(auth_client, db_session):
    from app.models.user import User
    from sqlalchemy import select

    result = await db_session.execute(select(User).limit(1))
    user = result.scalar_one()

    notif = Notification(
        user_id=str(user.id),
        title="Unread",
        message="Mark me read",
        severity="warning",
    )
    db_session.add(notif)
    await db_session.commit()
    await db_session.refresh(notif)

    resp = await auth_client.post(f"/api/notifications/{notif.id}/read")
    assert resp.status_code == 200

    list_resp = await auth_client.get("/api/notifications")
    assert list_resp.json()["unread_count"] == 0


async def test_mark_all_read(auth_client, db_session):
    from app.models.user import User
    from sqlalchemy import select

    result = await db_session.execute(select(User).limit(1))
    user = result.scalar_one()

    for i in range(3):
        db_session.add(
            Notification(
                user_id=str(user.id),
                title=f"Notif {i}",
                message="msg",
                severity="info",
            )
        )
    await db_session.commit()

    resp = await auth_client.post("/api/notifications/read-all")
    assert resp.status_code == 200

    list_resp = await auth_client.get("/api/notifications")
    assert list_resp.json()["unread_count"] == 0


async def test_unread_only_filter(auth_client, db_session):
    from app.models.user import User
    from sqlalchemy import select

    result = await db_session.execute(select(User).limit(1))
    user = result.scalar_one()

    notif_read = Notification(
        user_id=str(user.id),
        title="Read",
        message="already read",
        severity="info",
        is_read=True,
    )
    notif_unread = Notification(
        user_id=str(user.id),
        title="Unread",
        message="not read",
        severity="error",
    )
    db_session.add_all([notif_read, notif_unread])
    await db_session.commit()

    resp = await auth_client.get("/api/notifications?unread_only=true")
    assert resp.status_code == 200
    notifications = resp.json()["notifications"]
    assert len(notifications) == 1
    assert notifications[0]["title"] == "Unread"
