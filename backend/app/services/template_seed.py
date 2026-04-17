import uuid

from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.template import SDUITemplate

_SYSTEM_USER_ID = "00000000-0000-0000-0000-000000000000"


def _row(cells: list[dict], height: str = "auto") -> dict:
    return {"id": str(uuid.uuid4()), "height": height, "cells": cells}


def _cell(comp_type: str, props: dict) -> dict:
    return {"id": str(uuid.uuid4()), "content": {"type": comp_type, "props": props}}


SEED_TEMPLATES = [
    {
        "name": "Home",
        "description": "Weather widget with quick action buttons",
        "category": "dashboard",
        "screen_json": {
            "rows": [
                _row([_cell("text", {"content": "Good morning, {{user.name}}", "fontSize": 24, "fontWeight": "bold"})]),
                _row([_cell("divider", {})]),
                _row([_cell("text", {"content": "Weather", "fontSize": 18, "fontWeight": "semibold"})]),
                _row([_cell("text", {"content": "San Francisco", "fontSize": 16, "color": "#666666"})]),
                _row([_cell("button", {
                    "label": "Refresh Weather",
                    "variant": "outline",
                    "size": "small",
                    "action": {
                        "type": "server_action",
                        "function": "fetch_weather",
                        "params": {
                            "location": "San Francisco",
                            "connection_id": "{{connection.weather_api.id}}"
                        }
                    }
                })]),
                _row([_cell("divider", {})]),
                _row([_cell("text", {"content": "Quick Actions", "fontSize": 18, "fontWeight": "semibold"})]),
                _row([
                    _cell("button", {
                        "label": "Calendar",
                        "variant": "primary",
                        "size": "medium",
                        "action": {"type": "navigate", "screen": "calendar"}
                    }),
                    _cell("button", {
                        "label": "Chat",
                        "variant": "secondary",
                        "size": "medium",
                        "action": {"type": "navigate", "screen": "chat"}
                    }),
                ]),
                _row([
                    _cell("button", {
                        "label": "Feed",
                        "variant": "outline",
                        "size": "medium",
                        "action": {"type": "navigate", "screen": "feed"}
                    }),
                    _cell("button", {
                        "label": "Settings",
                        "variant": "ghost",
                        "size": "medium",
                        "action": {"type": "navigate", "screen": "settings"}
                    }),
                ]),
            ]
        },
    },
    {
        "name": "Chat",
        "description": "AI assistant interface with message list and input",
        "category": "custom",
        "screen_json": {
            "rows": [
                _row([_cell("text", {"content": "AI Assistant", "fontSize": 24, "fontWeight": "bold"})]),
                _row([_cell("divider", {})]),
                _row([_cell("chat", {"showHistory": True})], height="flex"),
                _row([_cell("inputbar", {
                    "placeholder": "Ask me anything...",
                    "action": {
                        "type": "server_action",
                        "function": "send_to_agent",
                        "params": {"message": "{{self.value}}"}
                    }
                })]),
            ]
        },
    },
    {
        "name": "Daily Planner",
        "description": "Calendar component with todo list",
        "category": "planner",
        "screen_json": {
            "rows": [
                _row([_cell("text", {"content": "Daily Planner", "fontSize": 24, "fontWeight": "bold"})]),
                _row([_cell("divider", {})]),
                _row([_cell("calendar", {"variant": "day", "showTimeBlock": True})]),
                _row([_cell("divider", {})]),
                _row([_cell("text", {"content": "Today's Tasks", "fontSize": 18, "fontWeight": "semibold"})]),
                _row([_cell("todo", {
                    "items": [
                        {"id": "1", "text": "Review morning emails", "completed": False},
                        {"id": "2", "text": "Team standup at 10am", "completed": False},
                        {"id": "3", "text": "Finish project proposal", "completed": False},
                    ]
                })]),
                _row([_cell("button", {
                    "label": "Add Task",
                    "variant": "primary",
                    "size": "medium",
                    "action": {"type": "show_alert", "title": "Add Task", "message": "Task creation coming soon"}
                })]),
            ]
        },
    },
    {
        "name": "Feed",
        "description": "RSS reader with article cards",
        "category": "custom",
        "screen_json": {
            "rows": [
                _row([_cell("text", {"content": "News Feed", "fontSize": 24, "fontWeight": "bold"})]),
                _row([_cell("divider", {})]),
                _row([_cell("button", {
                    "label": "Refresh Feed",
                    "variant": "outline",
                    "size": "small",
                    "action": {
                        "type": "server_action",
                        "function": "fetch_rss",
                        "params": {"feed_url": "https://hnrss.org/frontpage"}
                    }
                })]),
                _row([_cell("article_card", {
                    "title": "Welcome to Your Feed",
                    "description": "Tap 'Refresh Feed' to load the latest articles from Hacker News.",
                    "source": "Helm",
                    "publishedAt": "2026-04-17T00:00:00Z",
                })]),
                _row([_cell("rich_text_renderer", {
                    "content": "## How to use\n\nThis feed pulls articles from Hacker News RSS. You can customize the feed URL in the template editor to follow any RSS source.\n\n**Supported sources:**\n- News sites (BBC, CNN, etc.)\n- Blogs with RSS feeds\n- Reddit subreddits\n- YouTube channels",
                    "theme": "light"
                })]),
            ]
        },
    },
    {
        "name": "Settings",
        "description": "App settings with theme toggle, notifications, account info, and logout",
        "category": "custom",
        "screen_json": {
            "rows": [
                _row([_cell("text", {"content": "Settings", "fontSize": 24, "fontWeight": "bold"})]),
                _row([_cell("divider", {})]),
                _row([_cell("text", {"content": "Appearance", "fontSize": 18, "fontWeight": "semibold"})]),
                _row([_cell("button", {
                    "label": "Toggle Dark Mode",
                    "variant": "outline",
                    "size": "medium",
                    "action": {
                        "type": "server_action",
                        "function": "set_variable",
                        "params": {"name": "theme", "value": "dark"}
                    }
                })]),
                _row([_cell("divider", {})]),
                _row([_cell("text", {"content": "Notifications", "fontSize": 18, "fontWeight": "semibold"})]),
                _row([_cell("button", {
                    "label": "Toggle Push Notifications",
                    "variant": "outline",
                    "size": "medium",
                    "action": {
                        "type": "server_action",
                        "function": "set_variable",
                        "params": {"name": "notifications_enabled", "value": "true"}
                    }
                })]),
                _row([_cell("divider", {})]),
                _row([_cell("text", {"content": "Account", "fontSize": 18, "fontWeight": "semibold"})]),
                _row([_cell("text", {"content": "Username: {{user.username}}", "fontSize": 14, "color": "#666666"})]),
                _row([_cell("text", {"content": "User ID: {{user.id}}", "fontSize": 12, "color": "#999999"})]),
                _row([_cell("divider", {})]),
                _row([_cell("button", {
                    "label": "Logout",
                    "variant": "danger",
                    "size": "medium",
                    "action": {"type": "navigate", "screen": "logout"}
                })]),
            ]
        },
    },
]


async def seed_templates(db: AsyncSession, replace: bool = False) -> None:
    """Insert default SDUI templates. If replace=True, delete existing templates first."""
    count = (await db.execute(
        select(func.count()).select_from(SDUITemplate)
    )).scalar_one()

    if count > 0:
        if not replace:
            logger.info(f"Template table already has {count} entries — skipping seed")
            return

        # Delete all existing templates
        logger.info(f"Replacing {count} existing templates with new seed data")
        result = await db.execute(select(SDUITemplate))
        for template in result.scalars().all():
            await db.delete(template)
        await db.commit()

    for data in SEED_TEMPLATES:
        db.add(SDUITemplate(
            created_by=_SYSTEM_USER_ID,
            is_public=True,
            **data,
        ))

    await db.commit()
    logger.info(f"Seeded {len(SEED_TEMPLATES)} templates")
