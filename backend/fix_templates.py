#!/usr/bin/env python3
"""
Fix template issues identified in FF3 audit (issues 26-37).

Usage: cd backend && python fix_templates.py

Applies:
  Home:          Container -> Text (with weather dataBinding),
                 calendar variant=compact, remove Todo/Notes rows,
                 fix buttons to use registered action handlers.
  Chat:          Remove InputBar+Send row (ChatModule is self-contained),
                 wire ChatModule onSend to chat.send,
                 fix settings button target.
  Daily Planner: Extract Container children into individual cells,
                 ensure {{...}} variable format.
  Feed:          Fix "RichText" -> "RichTextRenderer".

Idempotent: safe to run multiple times.
"""
import asyncio
import copy
import os
import re
from uuid import uuid4

os.environ["HELM_ALLOW_INSECURE_DEV"] = "1"

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models import SDUITemplate


def fix_vars(obj):
    """Recursively convert [[...]] legacy format to {{...}}."""
    if isinstance(obj, str):
        return re.sub(r"\[\[([^\]]*)\]\]", r"{{\1}}", obj)
    if isinstance(obj, dict):
        return {k: fix_vars(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [fix_vars(v) for v in obj]
    return obj


def _cell(cid: str, ctype: str, props: dict, width: str | None = None) -> dict:
    c = {"id": cid, "content": {"type": ctype, "props": props}}
    if width:
        c["width"] = width
    return c


def fix_home(screen: dict) -> dict:
    """Issues 26, 27, 28, 29, 30."""
    s = fix_vars(copy.deepcopy(screen))
    rows = []
    for row in s.get("rows", []):
        new_cells = []
        for cell in row.get("cells", []):
            content = cell.get("content", {})
            ctype = content.get("type", "")
            cell_width = cell.get("width")

            # Issue 26: Container doesn't exist -> Text with weather dataBinding
            if ctype == "Container":
                new_cells.append(_cell(
                    str(uuid4()), "text",
                    {
                        "content": "{{weather.temperature}}C {{weather.description}}",
                        "fontSize": 16,
                        "fontWeight": "semibold",
                        "dataBinding": {
                            "type": "server_action",
                            "function": "fetch_weather",
                            "params": {"location": "Shanghai"},
                        },
                    },
                    width=cell_width,
                ))
                continue

            # Issue 28: Calendar variant -> compact for mobile
            if ctype == "CalendarModule":
                content["props"]["variant"] = "compact"

            # Issue 29: Todo/NotesModule are custom, non-functional -> remove
            if ctype in ("Todo", "NotesModule", "notes"):
                continue

            # Issue 30: Fix button actions to use registered handlers
            if ctype == "Button" and content["props"].get("action"):
                act = content["props"]["action"]
                fn = act.get("function", "")
                if fn == "notes.create":
                    act["function"] = "send_to_agent"
                    act["params"] = {"message": "Create a new note"}

            new_cells.append(cell)

        if new_cells:
            row["cells"] = new_cells
            rows.append(row)

    s["rows"] = rows
    return s


def fix_chat(screen: dict) -> dict:
    """Issues 31, 32, 33, 34."""
    s = fix_vars(copy.deepcopy(screen))
    rows = []
    for row in s.get("rows", []):
        cells = row.get("cells", [])

        # Issue 32: Convert standalone Divider rows to row-level divider type
        # (rows with a single cell containing a Divider)
        if len(cells) == 1 and cells[0].get("content", {}).get("type") in ("Divider", "divider"):
            content = cells[0].get("content", {})
            props = content.get("props", {})
            row["type"] = "divider"
            row["cells"] = []
            row["dividerThickness"] = props.get("thickness", 1)
            if "color" in props:
                row["dividerColor"] = props["color"]
            if "indent" in props:
                row["dividerMargin"] = props["indent"]
            elif "margin" in props:
                row["dividerMargin"] = props["margin"]
            rows.append(row)
            continue

        # Skip if any cell is a Divider (non-standalone — shouldn't happen, but safety)
        if any(c.get("content", {}).get("type") in ("Divider", "divider")
               for c in cells):
            rows.append(row)
            continue

        # Issue 34: Remove InputBar row (ChatModule is self-contained)
        if any(c.get("content", {}).get("type") in ("InputBar", "inputbar")
               for c in cells):
            continue

        for cell in cells:
            content = cell.get("content", {})

            # Issue 31: Fix settings button -> chat_settings
            if content.get("type") == "Button":
                act = content["props"].get("action", {})
                if act.get("type") == "navigate":
                    act["screen"] = "chat_settings"

            # Issue 33: Wire ChatModule onSend to chat.send (server_action)
            if content.get("type") in ("ChatModule", "chat"):
                content["props"]["onSend"] = {
                    "action": {"type": "server_action", "function": "chat.send"},
                }

        rows.append(row)

    s["rows"] = rows
    return s


def fix_daily_planner(screen: dict) -> dict:
    """Issues 35, 36 — extract Container children into cells."""
    s = fix_vars(copy.deepcopy(screen))
    rows = []
    for row in s.get("rows", []):
        new_cells = []
        for cell in row.get("cells", []):
            content = cell.get("content", {})

            # Issue 36: Container -> extract children as individual cells
            if content.get("type") == "Container":
                for child in content.get("props", {}).get("children", []):
                    new_cells.append(_cell(
                        child.get("id", str(uuid4())),
                        child["type"],
                        child.get("props", {}),
                    ))
                continue

            new_cells.append(cell)

        if new_cells:
            row["cells"] = new_cells
            rows.append(row)

    s["rows"] = rows
    return s


def fix_feed(screen: dict) -> dict:
    """Issue 37 — fix component type names."""
    s = fix_vars(copy.deepcopy(screen))
    for row in s.get("rows", []):
        for cell in row.get("cells", []):
            content = cell.get("content", {})
            if content.get("type") in ("RichText", "richtext"):
                content["type"] = "RichTextRenderer"
    return s


FIXERS = {
    "Home": fix_home,
    "Chat": fix_chat,
    "Daily Planner": fix_daily_planner,
    "Feed": fix_feed,
}


async def main() -> None:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(SDUITemplate))
        templates = result.scalars().all()

        if not templates:
            print("No templates found in database.")
            return

        fixed = 0
        for t in templates:
            fix_fn = FIXERS.get(t.name)
            if not fix_fn:
                print(f"  [skip] {t.name!r} — no fixer registered")
                continue

            old = copy.deepcopy(t.screen_json)
            t.screen_json = fix_fn(t.screen_json)

            if t.screen_json != old:
                fixed += 1
                old_rows = len(old.get("rows", []))
                new_rows = len(t.screen_json.get("rows", []))
                print(f"  [fix]  {t.name!r} — {old_rows} -> {new_rows} rows")
            else:
                print(f"  [ok]   {t.name!r} — already clean")

        await db.commit()
        print(f"\nDone: {fixed}/{len(templates)} templates fixed.")


if __name__ == "__main__":
    asyncio.run(main())
