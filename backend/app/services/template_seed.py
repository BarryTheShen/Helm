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
        "name": "Dashboard Landing Page",
        "description": "A welcome dashboard with stat cards and quick action buttons.",
        "category": "dashboard",
        "screen_json": {
            "rows": [
                _row([_cell("text", {"content": "Welcome to Helm", "fontSize": 24, "fontWeight": "bold"})]),
                _row([
                    _cell("text", {"content": "12 Events", "fontSize": 18, "fontWeight": "semibold"}),
                    _cell("text", {"content": "5 Notes", "fontSize": 18, "fontWeight": "semibold"}),
                ]),
                _row([_cell("divider", {})]),
                _row([_cell("text", {"content": "Quick Actions", "fontSize": 16, "fontWeight": "semibold"})]),
                _row([
                    _cell("button", {"label": "Open Calendar", "variant": "primary", "size": "medium"}),
                    _cell("button", {"label": "New Note", "variant": "secondary", "size": "medium"}),
                ]),
            ]
        },
    },
    {
        "name": "Calendar Page",
        "description": "A calendar module page with quick event creation.",
        "category": "planner",
        "screen_json": {
            "rows": [
                _row([_cell("text", {"content": "My Calendar", "fontSize": 24, "fontWeight": "bold"})]),
                _row([_cell("calendar", {"showTimeBlock": True, "defaultView": "month"})]),
                _row([_cell("inputbar", {"placeholder": "Add a quick event..."})]),
            ]
        },
    },
    {
        "name": "Chat Interface",
        "description": "AI chat assistant with input bar.",
        "category": "custom",
        "screen_json": {
            "rows": [
                _row([_cell("text", {"content": "AI Assistant", "fontSize": 24, "fontWeight": "bold"})]),
                _row([_cell("chat", {"showHistory": True})]),
                _row([_cell("inputbar", {"placeholder": "Type a message..."})]),
            ]
        },
    },
    {
        "name": "Notes Page",
        "description": "Note editor with create button.",
        "category": "custom",
        "screen_json": {
            "rows": [
                _row([_cell("text", {"content": "My Notes", "fontSize": 24, "fontWeight": "bold"})]),
                _row([_cell("notes", {})]),
                _row([_cell("divider", {})]),
                _row([_cell("button", {"label": "Create New Note", "variant": "primary", "size": "medium"})]),
            ]
        },
    },
    {
        "name": "Simple Form",
        "description": "A basic contact form with text inputs and submit button.",
        "category": "form",
        "screen_json": {
            "rows": [
                _row([_cell("text", {"content": "Contact Form", "fontSize": 24, "fontWeight": "bold"})]),
                _row([_cell("textinput", {"label": "Name", "placeholder": "Enter your name..."})]),
                _row([_cell("textinput", {"label": "Email", "placeholder": "Enter your email..."})]),
                _row([_cell("textinput", {"label": "Message", "placeholder": "Enter your message...", "multiline": True})]),
                _row([_cell("button", {"label": "Submit", "variant": "primary", "size": "medium"})]),
            ]
        },
    },
    {
        "name": "Stats Tracker",
        "description": "Activity tracker displaying fitness statistics.",
        "category": "tracker",
        "screen_json": {
            "rows": [
                _row([_cell("text", {"content": "Activity Tracker", "fontSize": 24, "fontWeight": "bold"})]),
                _row([
                    _cell("text", {"content": "Steps: 8,432", "fontSize": 18}),
                    _cell("text", {"content": "Calories: 2,100", "fontSize": 18}),
                ]),
                _row([_cell("divider", {})]),
                _row([
                    _cell("text", {"content": "Distance: 5.2 km", "fontSize": 18}),
                    _cell("text", {"content": "Active: 45 min", "fontSize": 18}),
                ]),
                _row([_cell("button", {"label": "View Details", "variant": "primary", "size": "medium"})]),
            ]
        },
    },
]


async def seed_templates(db: AsyncSession) -> None:
    """Insert default SDUI templates if the table is empty."""
    count = (await db.execute(
        select(func.count()).select_from(SDUITemplate)
    )).scalar_one()

    if count > 0:
        logger.info(f"Template table already has {count} entries — skipping seed")
        return

    for data in SEED_TEMPLATES:
        db.add(SDUITemplate(
            created_by=_SYSTEM_USER_ID,
            is_public=True,
            **data,
        ))

    await db.commit()
    logger.info(f"Seeded {len(SEED_TEMPLATES)} templates")
