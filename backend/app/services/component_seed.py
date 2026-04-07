from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.component_registry import ComponentRegistry

INITIAL_COMPONENTS = [
    {
        "type": "text",
        "tier": "atomic",
        "name": "Text",
        "icon": "📝",
        "description": "Display text with configurable style, size, and color",
        "props_schema": {
            "content": {"type": "string", "required": True, "default": "Text"},
            "fontSize": {"type": "number", "default": 16},
            "fontWeight": {"type": "enum", "options": ["normal", "bold", "semibold"], "default": "normal"},
            "color": {"type": "string", "default": "#000000"},
            "textAlign": {"type": "enum", "options": ["left", "center", "right"], "default": "left"},
        },
        "default_props": {"content": "Text", "fontSize": 16, "fontWeight": "normal", "color": "#000000", "textAlign": "left"},
    },
    {
        "type": "markdown",
        "tier": "atomic",
        "name": "Markdown",
        "icon": "📋",
        "description": "Render Markdown-formatted text",
        "props_schema": {
            "content": {"type": "string", "required": True, "default": "# Heading"},
        },
        "default_props": {"content": "# Heading\n\nParagraph text"},
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
            "action": {"type": "action", "default": None},
        },
        "default_props": {"label": "Button", "variant": "primary", "size": "medium", "action": None},
    },
    {
        "type": "image",
        "tier": "atomic",
        "name": "Image",
        "icon": "🖼️",
        "description": "Display an image from URL with configurable sizing",
        "props_schema": {
            "uri": {"type": "string", "required": True, "default": "https://via.placeholder.com/300"},
            "width": {"type": "number", "default": None},
            "height": {"type": "number", "default": 200},
            "resizeMode": {"type": "enum", "options": ["cover", "contain", "stretch", "center"], "default": "cover"},
            "borderRadius": {"type": "number", "default": 0},
        },
        "default_props": {"uri": "https://via.placeholder.com/300", "height": 200, "resizeMode": "cover", "borderRadius": 0},
    },
    {
        "type": "textinput",
        "tier": "atomic",
        "name": "Text Input",
        "icon": "⌨️",
        "description": "Input field for user text entry",
        "props_schema": {
            "placeholder": {"type": "string", "default": "Enter text..."},
            "label": {"type": "string", "default": ""},
            "multiline": {"type": "boolean", "default": False},
            "maxLength": {"type": "number", "default": None},
        },
        "default_props": {"placeholder": "Enter text...", "label": "", "multiline": False},
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
        "type": "divider",
        "tier": "atomic",
        "name": "Divider",
        "icon": "➖",
        "description": "Horizontal line separator",
        "props_schema": {
            "color": {"type": "string", "default": "#E0E0E0"},
            "thickness": {"type": "number", "default": 1},
            "margin": {"type": "number", "default": 8},
        },
        "default_props": {"color": "#E0E0E0", "thickness": 1, "margin": 8},
    },
    {
        "type": "calendar",
        "tier": "hardcoded",
        "name": "Calendar Module",
        "icon": "📅",
        "description": "Month grid + 3-day time-block view. Self-contained — fetches its own data.",
        "props_schema": {
            "showTimeBlock": {"type": "boolean", "default": True},
            "defaultView": {"type": "enum", "options": ["month", "week", "day"], "default": "month"},
        },
        "default_props": {"showTimeBlock": True, "defaultView": "month"},
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
        "type": "notes",
        "tier": "hardcoded",
        "name": "Notes Module",
        "icon": "📓",
        "description": "Rich text note editor. Self-contained.",
        "props_schema": {},
        "default_props": {},
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
]


async def seed_components(db: AsyncSession) -> None:
    """Insert default components if the table is empty."""
    count = (await db.execute(
        select(func.count()).select_from(ComponentRegistry)
    )).scalar_one()

    if count > 0:
        logger.info(f"Component registry already has {count} entries — skipping seed")
        return

    for data in INITIAL_COMPONENTS:
        db.add(ComponentRegistry(**data))

    await db.commit()
    logger.info(f"Seeded {len(INITIAL_COMPONENTS)} components into registry")
