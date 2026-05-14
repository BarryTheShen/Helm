import uuid

from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.template import SDUITemplate
from app.services.sdui_state import validate_sdui_screen_payload

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
                _row([_cell("Text", {"content": "# Good morning, {{user.name}} 👋", "variant": "heading", "fontSize": 24})]),
                # Row 2: Weather (50%) + Calendar Compact (50%)
                _row([
                    {
                        "id": str(uuid.uuid4()),
                        "width": "50%",
                        "content": {
                            "type": "Text",
                            "props": {"content": "☀️ 24°C  •  Shanghai", "fontSize": 18, "fontWeight": "semibold"}
                        }
                    },
                    {
                        "id": str(uuid.uuid4()),
                        "width": "50%",
                        "content": {
                            "type": "CalendarModule",
                            "props": {
                                "variant": "compact",
                                "maxEvents": 3,
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
                        "onPress": {
                            "type": "server_action",
                            "function": "todos.create",
                            "params": {"title": "New task"}
                        }
                    }),
                    _cell("Button", {
                        "label": "+ New Note",
                        "variant": "secondary",
                        "size": "medium",
                        "onPress": {
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
                    _cell("Text", {"content": "# 💬 Chat", "variant": "heading", "fontSize": 24}),
                    _cell("Button", {
                        "label": "⚙️",
                        "variant": "ghost",
                        "size": "small",
                        "onPress": {"type": "navigate", "screen": "settings"}
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
                                "onPress": {
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
        "description": "Calendar week view with todo list and notes stacked in a vertical layout.",
        "category": "planner",
        "screen_json": {
            "rows": [
                # Row 1: Header with dynamic date
                _row([_cell("Text", {
                    "content": "# 📋 {{date.today}}",
                    "variant": "heading",
                    "align": "center"
                })]),
                # Row 2: Empty container (vertical row) with Calendar Week | Todo | Notes
                _row([{
                    "id": str(uuid.uuid4()),
                    "width": 1,
                    "content": {
                        "type": "Empty",
                        "id": str(uuid.uuid4()),
                        "props": {},
                        "children": [
                            # Sub-component 1: Calendar Week variant
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
                            # Sub-component 2: Todo Component
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
                            # Sub-component 3: Notes Component filtered to today
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
                    }
                }]),
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
                        "onPress": {
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
]


async def seed_templates(db: AsyncSession, replace: bool = False) -> None:
    """Insert default SDUI templates. If replace=True, delete existing templates first."""
    count = (await db.execute(
        select(func.count()).select_from(SDUITemplate)
    )).scalar_one()

    # ── Startup validation of seed data ────────────────────────────────────
    # Validate component types in every seed template's screen_json at startup
    # so that seed data bugs are caught early rather than at runtime.
    for data in SEED_TEMPLATES:
        screen_json = data.get("screen_json", {})
        if not isinstance(screen_json, dict):
            logger.warning(
                f"Seed template '{data.get('name', 'unknown')}' has non-dict "
                f"screen_json (type={type(screen_json).__name__})"
            )
            continue
        _, errors = validate_sdui_screen_payload(screen_json)
        if errors:
            logger.warning(
                f"Seed template '{data.get('name', 'unknown')}' has screen_json "
                f"validation errors (may cause runtime issues):\n"
                + "\n".join(f"  - {e}" for e in errors)
            )

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
