#!/usr/bin/env python3
"""
Convert dedicated divider rows to showDivider on preceding content rows
in module_states and sdui_screen_history.

What it does:
  - Finds dedicated divider rows (type='divider' with empty cells, or rows
    with a single cell containing a Divider component)
  - Sets showDivider: true on the preceding content row
  - Copies divider props (dividerColor, dividerThickness, dividerMargin)
    to the preceding row
  - Removes the dedicated divider row from the rows array
  - Handles edge cases:
    - Divider is the first row → just remove it (no preceding row)
    - Consecutive dividers → all merge into the same preceding row
    - Divider row with content → keep content, add showDivider to itself

Usage: cd backend && python fix_module_state_dividers.py
Idempotent: safe to run multiple times.
"""
import copy
import json
import os
import sys
from datetime import datetime

os.environ["HELM_ALLOW_INSECURE_DEV"] = "1"

import sqlite3


def _is_divider_component_cell(cell: dict) -> bool:
    """Check if a cell contains a Divider component."""
    content = cell.get("content", {})
    return content.get("type", "") in ("Divider", "divider")


def _extract_divider_props(row: dict, cell: dict | None = None) -> dict:
    """
    Extract divider style props from a divider row or cell.
    Returns a dict with optional keys: dividerColor, dividerThickness, dividerMargin.
    """
    props = {}

    # First check row-level props (from previous migration: type='divider' rows)
    if row.get("dividerThickness") is not None:
        props["dividerThickness"] = row["dividerThickness"]
    if row.get("dividerColor") is not None:
        props["dividerColor"] = row["dividerColor"]
    if row.get("dividerMargin") is not None:
        props["dividerMargin"] = row["dividerMargin"]

    # If we have a Divider component cell, extract from its props (overrides row-level)
    if cell is not None:
        content = cell.get("content", {})
        comp_props = content.get("props", {})
        if "thickness" in comp_props:
            props["dividerThickness"] = comp_props["thickness"]
        if "color" in comp_props:
            props["dividerColor"] = comp_props["color"]
        if "indent" in comp_props:
            props["dividerMargin"] = comp_props["indent"]
        elif "margin" in comp_props:
            props["dividerMargin"] = comp_props["margin"]

    return props


def _is_dedicated_divider_row(row: dict) -> bool:
    """
    Determine if a row is a dedicated divider (should be removed and converted
    to showDivider on preceding row).
    """
    cells = row.get("cells", [])
    row_type = row.get("type", "")

    # Case 1: type='divider' with empty cells — pure divider row
    if row_type == "divider" and not cells:
        return True

    # Case 2: single cell whose content is a Divider component
    if len(cells) == 1 and _is_divider_component_cell(cells[0]):
        return True

    return False


def _has_non_divider_content(row: dict) -> bool:
    """
    Check if a row has real content beyond just a Divider component.
    Used for the edge case where a divider row also has meaningful content.
    """
    cells = row.get("cells", [])
    # If there are no cells, there's no extra content
    if not cells:
        return False
    # If there's more than 1 cell, there must be some non-divider content
    if len(cells) > 1:
        return True
    # If there's exactly 1 cell that's NOT a divider component, it has content
    if len(cells) == 1 and not _is_divider_component_cell(cells[0]):
        return True
    return False


def fix_screen_rows(rows: list) -> tuple[list, bool]:
    """
    Convert dedicated divider rows to showDivider on preceding rows.
    Returns (fixed_rows, was_modified).
    """
    modified = False
    new_rows = []

    for row in rows:
        cells = row.get("cells", [])
        row_type = row.get("type", "")

        if _is_dedicated_divider_row(row):
            modified = True

            # Extract divider props before we potentially discard the row
            divider_props = {}
            if row_type == "divider":
                divider_props = _extract_divider_props(row)
            elif len(cells) == 1:
                divider_props = _extract_divider_props(row, cells[0])
                # Default thickness for component-based dividers
                if "dividerThickness" not in divider_props:
                    divider_props["dividerThickness"] = 1

            # Edge case: divider row has non-divider content — keep it, add showDivider
            if _has_non_divider_content(row):
                row["type"] = row_type if row_type != "divider" else None
                row["showDivider"] = True
                # Clean up leftover divider keys
                for k in ("dividerThickness", "dividerColor", "dividerMargin"):
                    row.pop(k, None)
                # Merge extracted props onto the row as divider styling
                if divider_props.get("dividerColor") is not None:
                    row["dividerColor_deprecated"] = divider_props["dividerColor"]
                new_rows.append(row)
                continue

            # Normal case: transfer to preceding content row
            if new_rows:
                prev_row = new_rows[-1]
                prev_row["showDivider"] = True
                if divider_props.get("dividerColor") is not None:
                    prev_row["dividerColor"] = divider_props["dividerColor"]
                if divider_props.get("dividerThickness") is not None:
                    prev_row["dividerThickness"] = divider_props["dividerThickness"]
                if divider_props.get("dividerMargin") is not None:
                    prev_row["dividerMargin"] = divider_props["dividerMargin"]
                # Skip this divider row — don't add to new_rows
            # else: divider is first row with no preceding content → just skip it
        else:
            new_rows.append(row)

    return new_rows, modified


def fix_module_states(db: sqlite3.Connection) -> list[dict]:
    """Fix dedicated dividers in module_states.state_json."""
    cursor = db.cursor()
    cursor.execute("SELECT id, module_type, state_json FROM module_states")
    fixes = []

    for row_id, module_type, state_json_str in cursor.fetchall():
        if not state_json_str:
            continue

        try:
            state = json.loads(state_json_str)
        except json.JSONDecodeError:
            print(f"  [skip] {module_type} (id: {row_id}) — invalid JSON")
            continue

        if not isinstance(state, dict):
            continue

        # state_json can have 'rows' directly or nested under 'screen'
        target = None
        target_is_screen = False

        if "rows" in state:
            target = state
        elif "screen" in state and isinstance(state["screen"], dict) and "rows" in state["screen"]:
            target = state["screen"]
            target_is_screen = True

        if target is None:
            continue

        rows = target.get("rows", [])
        if not isinstance(rows, list) or not rows:
            continue

        fixed_rows, modified = fix_screen_rows(rows)
        if modified:
            target["rows"] = fixed_rows
            old_json = state_json_str
            new_json = json.dumps(state, ensure_ascii=False, indent=None)
            fixes.append({
                "table": "module_states",
                "id": row_id,
                "module_type": module_type,
                "old_json": old_json,
                "new_json": new_json,
                "column": "state_json",
                "old_rows": copy.deepcopy(rows),
                "new_rows": copy.deepcopy(fixed_rows),
            })

    return fixes


def fix_sdui_screen_history(db: sqlite3.Connection) -> list[dict]:
    """Fix dedicated dividers in sdui_screen_history.screen_json."""
    cursor = db.cursor()
    cursor.execute("SELECT id, module_id, screen_json FROM sdui_screen_history")
    fixes = []

    for row_id, module_id, screen_json_str in cursor.fetchall():
        if not screen_json_str:
            continue

        try:
            screen = json.loads(screen_json_str)
        except json.JSONDecodeError:
            print(f"  [skip] {module_id} (history id: {row_id}) — invalid JSON")
            continue

        if not isinstance(screen, dict):
            continue

        rows = screen.get("rows", [])
        if not isinstance(rows, list) or not rows:
            continue

        fixed_rows, modified = fix_screen_rows(rows)
        if modified:
            screen["rows"] = fixed_rows
            old_json = screen_json_str
            new_json = json.dumps(screen, ensure_ascii=False, indent=None)
            fixes.append({
                "table": "sdui_screen_history",
                "id": row_id,
                "module_type": module_id,
                "old_json": old_json,
                "new_json": new_json,
                "column": "screen_json",
                "old_rows": copy.deepcopy(rows),
                "new_rows": copy.deepcopy(fixed_rows),
            })

    return fixes


def apply_fixes(db: sqlite3.Connection, fixes: list[dict]) -> int:
    """Write fixes to the database. Returns count of applied fixes."""
    cursor = db.cursor()
    applied = 0
    for fix in fixes:
        table = fix["table"]
        id_col = "id"
        col = fix["column"]
        new_json = fix["new_json"]
        row_id = fix["id"]

        # Verify it's still needed (idempotency check)
        cursor.execute(f"SELECT {col} FROM {table} WHERE {id_col} = ?", (row_id,))
        result = cursor.fetchone()
        if result is None:
            print(f"  [skip] {fix['module_type']} (id: {row_id}) — row not found")
            continue

        current = result[0]
        if current == new_json:
            print(f"  [ok]   {fix['module_type']} (id: {row_id}) — already updated")
            continue

        if table == "module_states":
            cursor.execute(
                f"UPDATE {table} SET {col} = ?, updated_at = ? WHERE {id_col} = ?",
                (new_json, datetime.utcnow().isoformat(), row_id),
            )
        else:
            cursor.execute(
                f"UPDATE {table} SET {col} = ? WHERE {id_col} = ?",
                (new_json, row_id),
            )
        applied += 1

        n_divider = len(fix["old_rows"]) - len(fix["new_rows"])
        label = fix["module_type"]
        print(f"  [fix]  {label} (id: {row_id}) — removed {n_divider} divider row(s), added showDivider")
        _show_diff(fix["old_rows"], fix["new_rows"], label)

    return applied


def _show_diff(old_rows: list, new_rows: list, label: str):
    """Show a concise before/after diff describing what changed."""
    # Build a map of removed divider rows: index -> props
    removed = []
    for i, r in enumerate(old_rows):
        if _is_dedicated_divider_row(r):
            cells = r.get("cells", [])
            props = {}
            if r.get("type") == "divider":
                if r.get("dividerColor"): props["color"] = r["dividerColor"]
                if r.get("dividerThickness"): props["thickness"] = r["dividerThickness"]
                if r.get("dividerMargin"): props["margin"] = r["dividerMargin"]
            elif len(cells) == 1:
                content = cells[0].get("content", {})
                comp_props = content.get("props", {})
                if comp_props.get("color"): props["color"] = comp_props["color"]
                if comp_props.get("thickness"): props["thickness"] = comp_props["thickness"]
                if comp_props.get("indent"): props["indent"] = comp_props["indent"]
                if comp_props.get("margin"): props["margin"] = comp_props["margin"]
            removed.append({"index": i, "id": r.get("id"), "props": props})

    # Find which new rows got showDivider
    showdivider_rows = []
    for r in new_rows:
        if r.get("showDivider"):
            showdivider_rows.append({
                "id": r.get("id"),
                "dividerColor": r.get("dividerColor"),
                "dividerThickness": r.get("dividerThickness"),
                "dividerMargin": r.get("dividerMargin"),
            })

    if removed:
        for rd in removed:
            id_str = f" id={rd['id']}" if rd['id'] else ""
            props_str = f" props={rd['props']}" if rd['props'] else ""
            print(f"    removed divider row at index {rd['index']}{id_str}{props_str}")
    if showdivider_rows:
        for sd in showdivider_rows:
            parts = [f"showDivider=true"]
            if sd["dividerColor"]: parts.append(f"color={sd['dividerColor']}")
            if sd["dividerThickness"]: parts.append(f"thickness={sd['dividerThickness']}")
            if sd["dividerMargin"]: parts.append(f"margin={sd['dividerMargin']}")
            print(f"    row id={sd['id']}: {', '.join(parts)}")


def main():
    db_path = os.path.join(os.path.dirname(__file__), "helm.db")
    if not os.path.exists(db_path):
        print(f"Database not found: {db_path}")
        sys.exit(1)

    print(f"Connecting to {db_path}")
    db = sqlite3.connect(db_path)

    print("\n=== Checking module_states ===")
    module_fixes = fix_module_states(db)
    print(f"  Found {len(module_fixes)} module(s) with dedicated divider rows")

    print("\n=== Checking sdui_screen_history ===")
    history_fixes = fix_sdui_screen_history(db)
    print(f"  Found {len(history_fixes)} history record(s) with dedicated divider rows")

    all_fixes = module_fixes + history_fixes
    if not all_fixes:
        print("\nNo fixes needed. Database is already clean.")
        db.close()
        return

    print(f"\n=== Applying {len(all_fixes)} fix(es) ===")
    applied = apply_fixes(db, all_fixes)
    db.commit()
    print(f"\nDone: {applied}/{len(all_fixes)} fix(es) applied.")

    # Summary
    print("\n=== Summary ===")
    tables: dict[str, set[str]] = {}
    total_removed = 0
    for fix in all_fixes:
        table = fix["table"]
        if table not in tables:
            tables[table] = set()
        tables[table].add(fix["module_type"])
        total_removed += len(fix["old_rows"]) - len(fix["new_rows"])
    for table, modules in tables.items():
        print(f"  {table}: {len(modules)} module(s) affected: {', '.join(sorted(modules))}")
    print(f"  Total divider rows removed: {total_removed}")

    db.close()


if __name__ == "__main__":
    main()
