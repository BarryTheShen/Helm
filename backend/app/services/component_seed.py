from loguru import logger
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.component_registry import ComponentRegistry

INITIAL_COMPONENTS = [
    {
        "type": "text",
        "tier": "atomic",
        "name": "Text",
        "icon": "📝",
        "description": "Rich text and markdown content",
        "props_schema": {
            "content": {"type": "string", "required": True, "default": "# Heading"},
            "fontSize": {"type": "number", "default": 16},
            "fontWeight": {"type": "enum", "options": ["normal", "bold", "semibold"], "default": "normal"},
            "color": {"type": "string", "default": "#000000"},
            "textAlign": {"type": "enum", "options": ["left", "center", "right"], "default": "left"},
        },
        "default_props": {"content": "# Heading\n\nParagraph text", "fontSize": 16, "fontWeight": "normal", "color": "#000000", "textAlign": "left"},
    },
    {
        "type": "RichTextRenderer",
        "tier": "composite",
        "name": "Rich Text Renderer",
        "icon": "📄",
        "description": "Renders markdown/rich text content",
        "props_schema": {
            "content": {"type": "string", "default": "# Hello\n\nThis is **markdown**."},
            "theme": {"type": "enum", "options": ["light", "dark"], "default": "light"},
        },
        "default_props": {"content": "# Hello\n\nThis is **markdown**.", "theme": "light"},
    },
    {
        "type": "button",
        "tier": "atomic",
        "name": "Button",
        "icon": "🔘",
        "description": "Tappable button with 5 variants and 3 sizes",
        "props_schema": {
            "label": {"type": "string", "required": True, "default": "Button"},
            "variant": {"type": "enum", "options": ["primary", "secondary", "outline", "ghost", "danger"], "default": "primary"},
            "size": {"type": "enum", "options": ["small", "medium", "large"], "default": "medium"},
            "fullWidth": {"type": "boolean", "default": True},
            "action": {"type": "action", "default": None},
        },
        "default_props": {"label": "Button", "variant": "primary", "size": "medium", "fullWidth": True, "action": None},
    },
    {
        "type": "image",
        "tier": "atomic",
        "name": "Image",
        "icon": "🖼️",
        "description": "Display an image from URL with fit mode",
        "props_schema": {
            "uri": {"type": "string", "required": True, "default": "https://via.placeholder.com/300"},
            "fitMode": {"type": "enum", "options": ["fitWidth", "fitHeight"], "default": "fitWidth"},
        },
        "default_props": {"uri": "https://via.placeholder.com/300", "fitMode": "fitWidth"},
    },
    {
        "type": "icon",
        "tier": "atomic",
        "name": "Icon",
        "icon": "⭐",
        "description": "Display an icon from the icon library",
        "props_schema": {
            "name": {"type": "string", "required": True, "default": "star"},
            "size": {"type": "number", "default": 24},
            "color": {"type": "string", "default": "#000000"},
        },
        "default_props": {"name": "star", "size": 24, "color": "#000000"},
    },
    {
        "type": "CalendarModule",
        "tier": "hardcoded",
        "name": "Calendar Module",
        "icon": "📅",
        "description": "Month grid + 3-day time-block view. Self-contained — fetches its own data.",
        "props_schema": {
            "showTimeBlock": {"type": "boolean", "default": True},
            "variant": {"type": "enum", "options": ["month", "week", "day", "agenda", "compact"], "default": "month"},
        },
        "default_props": {"showTimeBlock": True, "variant": "month"},
    },
    {
        "type": "calendar",
        "tier": "hardcoded",
        "name": "Calendar Module",
        "icon": "📅",
        "description": "Month grid + 3-day time-block view. Self-contained — fetches its own data.",
        "props_schema": {
            "showTimeBlock": {"type": "boolean", "default": True},
            "variant": {"type": "enum", "options": ["month", "week", "day", "agenda", "compact"], "default": "month"},
        },
        "default_props": {"showTimeBlock": True, "variant": "month"},
    },
    {
        "type": "ChatModule",
        "tier": "hardcoded",
        "name": "Chat Module",
        "icon": "💬",
        "description": "Real-time chat interface with AI assistant. Self-contained.",
        "props_schema": {
            "showHistory": {"type": "boolean", "default": True},
        },
        "default_props": {"showHistory": True},
    },
    {
        "type": "chat",
        "tier": "hardcoded",
        "name": "Chat Module",
        "icon": "💬",
        "description": "Real-time chat interface with AI assistant. Self-contained.",
        "props_schema": {
            "showHistory": {"type": "boolean", "default": True},
        },
        "default_props": {"showHistory": True},
    },
    {
        "type": "NotesModule",
        "tier": "hardcoded",
        "name": "Notes Module",
        "icon": "📓",
        "description": "Rich text note editor. Self-contained.",
        "props_schema": {
            "dataBinding": {"type": "object", "default": None},
            "onAdd": {"type": "object", "default": None},
            "onEdit": {"type": "object", "default": None},
            "onDelete": {"type": "object", "default": None},
            "onToggle": {"type": "object", "default": None},
        },
        "default_props": {},
    },
    {
        "type": "notes",
        "tier": "hardcoded",
        "name": "Notes Module",
        "icon": "📓",
        "description": "Rich text note editor. Self-contained.",
        "props_schema": {
            "dataBinding": {"type": "object", "default": None},
            "onAdd": {"type": "object", "default": None},
            "onEdit": {"type": "object", "default": None},
            "onDelete": {"type": "object", "default": None},
            "onToggle": {"type": "object", "default": None},
        },
        "default_props": {},
    },
    {
        "type": "InputBar",
        "tier": "hardcoded",
        "name": "Input Bar",
        "icon": "⌨️",
        "description": "Bottom input bar for message/command entry. Self-contained.",
        "props_schema": {
            "placeholder": {"type": "string", "default": "Type a message..."},
        },
        "default_props": {"placeholder": "Type a message..."},
    },
    {
        "type": "inputbar",
        "tier": "hardcoded",
        "name": "Input Bar",
        "icon": "⌨️",
        "description": "Bottom input bar for message/command entry. Self-contained.",
        "props_schema": {
            "placeholder": {"type": "string", "default": "Type a message..."},
        },
        "default_props": {"placeholder": "Type a message..."},
    },
    {
        "type": "Todo",
        "tier": "composite",
        "name": "Todo List",
        "icon": "✓",
        "description": "Interactive todo list with add, toggle, and delete",
        "props_schema": {
            "items": {"type": "array", "default": []},
            "placeholder": {"type": "string", "default": "Add a task..."},
            "onToggle": {"type": "object", "default": None},
            "onAdd": {"type": "object", "default": None},
            "onDelete": {"type": "object", "default": None},
        },
        "default_props": {"items": [], "placeholder": "Add a task..."},
    },
    {
        "type": "ArticleCard",
        "tier": "composite",
        "name": "Article Card",
        "icon": "📰",
        "description": "Card displaying article preview with image, title, description, source",
        "props_schema": {
            "title": {"type": "string", "default": "Article Title"},
            "description": {"type": "string", "default": "Article description..."},
            "imageUrl": {"type": "string", "default": ""},
            "publishedAt": {"type": "string", "default": "2026-04-17T00:00:00Z"},
            "source": {"type": "string", "default": "Source"},
            "onPress": {"type": "object", "default": None},
        },
        "default_props": {
            "title": "Article Title",
            "description": "Article description...",
            "source": "Source",
            "publishedAt": "2026-04-17T00:00:00Z",
            "imageUrl": "",
        },
    },
    {
        "type": "Empty",
        "tier": "atomic",
        "name": "Empty",
        "icon": "⬜",
        "description": "Simple vertical container for stacking child components",
        "props_schema": {},
        "default_props": {},
    },
]


# Component types removed in Phase 3 (TextInput removed outright, Markdown merged into Text).
# These entries may still exist in the DB from older seed versions and must be cleaned up
# to keep the component registry in sync with the frontend and validation whitelist.
_STALE_TYPES: set[str] = {"textinput", "markdown"}


async def seed_components(db: AsyncSession) -> None:
    """Insert default components if the table is empty."""
    count = (await db.execute(
        select(func.count()).select_from(ComponentRegistry)
    )).scalar_one()

    if count > 0:
        logger.info(f"Component registry already has {count} entries — skipping seed")
    else:
        for data in INITIAL_COMPONENTS:
            db.add(ComponentRegistry(**data))
        await db.commit()
        logger.info(f"Seeded {len(INITIAL_COMPONENTS)} components into registry")

    # Always clean up stale types that were removed in Phase 3.
    for stale_type in sorted(_STALE_TYPES):
        result = await db.execute(
            delete(ComponentRegistry).where(ComponentRegistry.type == stale_type)
        )
        if result.rowcount > 0:
            logger.info(f"Removed stale component type '{stale_type}' ({result.rowcount} entry)")
    await db.commit()
