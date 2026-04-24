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
        "description": "Personal dashboard with weather, calendar, todos, and notes",
        "category": "dashboard",
        "screen_json": {
            "rows": [
                # Row 1: Greeting with user name variable
                _row([_cell("Text", {"content": "Good morning, {{user.name}} 👋", "fontSize": 24, "fontWeight": "bold"})]),
                # Row 2: Weather (50%) + Calendar Compact (50%)
                _row([
                    {
                        "id": str(uuid.uuid4()),
                        "width": "50%",
                        "content": {
                            "type": "Container",
                            "props": {
                                "direction": "column",
                                "gap": 8,
                                "children": [
                                    {
                                        "type": "Text",
                                        "id": str(uuid.uuid4()),
                                        "props": {"content": "☀️ 24°C", "fontSize": 18, "fontWeight": "semibold"}
                                    },
                                    {
                                        "type": "Text",
                                        "id": str(uuid.uuid4()),
                                        "props": {"content": "Shanghai", "fontSize": 14, "color": "#666666"}
                                    }
                                ]
                            }
                        }
                    },
                    {
                        "id": str(uuid.uuid4()),
                        "width": "50%",
                        "content": {
                            "type": "CalendarModule",
                            "props": {
                                "variant": "agenda",
                                "dataBinding": {
                                    "dataSourceId": "calendar_events",
                                    "refreshInterval": 60000
                                }
                            }
                        }
                    }
                ]),
                # Row 3: Todo Component
                _row([_cell("Todo", {
                    "dataBinding": {
                        "dataSourceId": "todos",
                        "refreshInterval": 60000
                    }
                })]),
                # Row 4: Notes Component
                _row([_cell("NotesModule", {
                    "dataBinding": {
                        "dataSourceId": "notes",
                        "refreshInterval": 60000
                    }
                })]),
                # Row 5: Two action buttons
                _row([
                    _cell("Button", {
                        "label": "+ New Task",
                        "variant": "primary",
                        "size": "medium",
                        "action": {
                            "type": "server_action",
                            "function": "todos.create",
                            "params": {"title": "New task"}
                        }
                    }),
                    _cell("Button", {
                        "label": "+ New Note",
                        "variant": "secondary",
                        "size": "medium",
                        "action": {
                            "type": "server_action",
                            "function": "notes.create",
                            "params": {"content": ""}
                        }
                    })
                ])
            ]
        },
    },
    {
        "name": "Chat",
        "description": "Chat interface with AI assistant",
        "category": "custom",
        "screen_json": {
            "rows": [
                # Row 1: Header with title and settings button
                _row([
                    _cell("Text", {"content": "💬 Chat", "fontSize": 24, "fontWeight": "bold"}),
                    _cell("Button", {
                        "label": "⚙️",
                        "variant": "ghost",
                        "size": "small",
                        "action": {"type": "navigate", "screen": "settings"}
                    })
                ]),
                # Row 2: Chat component (full height)
                _row([_cell("ChatModule", {"showHistory": True})], height="flex"),
                # Row 3: Input bar with send button
                _row([
                    {
                        "id": str(uuid.uuid4()),
                        "width": "80%",
                        "content": {
                            "type": "InputBar",
                            "props": {
                                "id": "chat_input",
                                "placeholder": "Type a message..."
                            }
                        }
                    },
                    {
                        "id": str(uuid.uuid4()),
                        "width": "20%",
                        "content": {
                            "type": "Button",
                            "props": {
                                "label": "Send",
                                "variant": "primary",
                                "size": "medium",
                                "action": {
                                    "type": "server_action",
                                    "function": "chat.send",
                                    "params": {"message": "{{component.chat_input.value}}"}
                                }
                            }
                        }
                    }
                ])
            ]
        },
    },
    {
        "name": "Daily Planner",
        "description": "Calendar week view with todo list and notes",
        "category": "planner",
        "screen_json": {
            "rows": [
                # Row 1: Header with dynamic date
                _row([_cell("Markdown", {
                    "content": "# 📋 Today — {{date.today}}",
                    "textAlign": "center"
                })]),
                # Row 2: Container with 3 vertical sub-cells
                _row([_cell("Container", {
                    "direction": "column",
                    "gap": 16,
                    "children": [
                        # Sub-cell 1: Calendar Week variant
                        {
                            "type": "CalendarModule",
                            "id": str(uuid.uuid4()),
                            "props": {
                                "variant": "week",
                                "dataBinding": {
                                    "dataSourceId": "calendar_events",
                                    "refreshInterval": 60000
                                }
                            }
                        },
                        # Sub-cell 2: Todo Component
                        {
                            "type": "Todo",
                            "id": str(uuid.uuid4()),
                            "props": {
                                "dataBinding": {
                                    "dataSourceId": "todos",
                                    "refreshInterval": 60000
                                }
                            }
                        },
                        # Sub-cell 3: Notes Component filtered to today
                        {
                            "type": "NotesModule",
                            "id": str(uuid.uuid4()),
                            "props": {
                                "filterDate": "{{date.today}}",
                                "dataBinding": {
                                    "dataSourceId": "notes",
                                    "refreshInterval": 60000
                                }
                            }
                        }
                    ]
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
                # Row 1: Header with refresh button
                _row([
                    _cell("Text", {"content": "📰 News Feed", "fontSize": 24, "fontWeight": "bold"}),
                    _cell("Button", {
                        "label": "🔄",
                        "variant": "ghost",
                        "size": "small",
                        "action": {
                            "type": "server_action",
                            "function": "fetch_rss",
                            "params": {"feed_url": "https://hnrss.org/frontpage"}
                        }
                    })
                ]),
                # Row 2: Article card example
                # TODO: Wrap in List component with dataBinding when List supports itemTemplate
                # For now, this is a static example card
                _row([_cell("ArticleCard", {
                    "title": "Welcome to Your Feed",
                    "description": "Tap 'Refresh Feed' to load the latest articles from Hacker News.",
                    "source": "Helm",
                    "publishedAt": "2026-04-17T00:00:00Z",
                })]),
                # Row 3: Rich text instructions
                _row([_cell("RichText", {
                    "content": "## How to use\n\nThis feed pulls articles from Hacker News RSS. You can customize the feed URL in the template editor to follow any RSS source.\n\n**Supported sources:**\n- News sites (BBC, CNN, etc.)\n- Blogs with RSS feeds\n- Reddit subreddits\n- YouTube channels",
                    "theme": "light"
                })]),
            ]
        },
    },
    {
        "name": "Settings",
        "description": "App settings with profile, connection, appearance, and logout",
        "category": "custom",
        "screen_json": {
            "rows": [
                # Row 1: Header
                _row([_cell("Markdown", {"content": "# ⚙️ Settings"})]),
                # Row 2: Profile section header
                _row([_cell("Markdown", {"content": "## 👤 Profile"})]),
                # Row 3: Display name field
                _row([
                    _cell("Text", {"content": "Display name", "fontSize": 14, "fontWeight": "semibold"}),
                    _cell("TextInput", {"id": "display_name_input", "placeholder": "{{user.name}}", "label": ""})
                ]),
                # Row 4: Email field
                _row([
                    _cell("Text", {"content": "Email", "fontSize": 14, "fontWeight": "semibold"}),
                    _cell("TextInput", {"id": "email_input", "placeholder": "{{user.email}}", "label": ""})
                ]),
                # Row 5: Connection section header
                _row([_cell("Markdown", {"content": "## 🌐 Connection"})]),
                # Row 6: Endpoint URL field
                _row([
                    _cell("Text", {"content": "Endpoint URL", "fontSize": 14, "fontWeight": "semibold"}),
                    _cell("TextInput", {"id": "endpoint_url_input", "placeholder": "https://...", "label": ""})
                ]),
                # Row 7: Appearance section header
                _row([_cell("Markdown", {"content": "## 🎨 Appearance"})]),
                # Row 8: Dark mode toggle
                _row([
                    _cell("Text", {"content": "Dark mode", "fontSize": 14, "fontWeight": "semibold"}),
                    _cell("Button", {
                        "label": "Toggle",
                        "variant": "outline",
                        "size": "small",
                        "action": {
                            "type": "server_action",
                            "function": "settings.toggle_dark_mode",
                            "params": {}
                        }
                    })
                ]),
                # Row 9: Save button
                _row([_cell("Button", {
                    "label": "Save changes",
                    "variant": "primary",
                    "size": "medium",
                    "action": {
                        "type": "server_action",
                        "function": "settings.save",
                        "params": {
                            "display_name": "{{component.display_name_input.value}}",
                            "email": "{{component.email_input.value}}",
                            "endpoint_url": "{{component.endpoint_url_input.value}}"
                        }
                    }
                })]),
                # Row 10: Logout button
                _row([_cell("Button", {
                    "label": "Logout",
                    "variant": "danger",
                    "size": "medium",
                    "action": {
                        "type": "server_action",
                        "function": "auth.logout",
                        "params": {}
                    }
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
