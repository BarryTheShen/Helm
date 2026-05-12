#!/usr/bin/env python3
"""
Convert standalone cell-level Divider components to row-level dividers
in module_states and sdui_screen_history.

Standalone divider = a row with exactly 1 cell whose content.type is 'Divider'/'divider'.
These get converted to a row-level divider (type='divider', cells=[]).

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


def fix_screen_rows(rows: list) -> tuple[list, bool]:
    """
    Convert standalone Divider cells to row-level dividers.
    Returns (fixed_rows, was_modified).
    """
    modified = False
    new_rows = []
    for row in rows:
        cells = row.get("cells", [])
        # Standalone Divider: exactly 1 cell whose content.type is Divider/divider
        if len(cells) == 1:
            content = cells[0].get("content", {})
            ctype = content.get("type", "")
            if ctype in ("Divider", "divider"):
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
                # Remove leftover row-level keys that don't apply to dividers
                for k in ("height",):
                    row.pop(k, None)
                modified = True
        new_rows.append(row)
    return new_rows, modified


def fix_module_states(db: sqlite3.Connection) -> list[dict]:
    """Fix standalone Dividers in module_states.state_json."""
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
        # Most common: state = {"rows": [...]}
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
            })

    return fixes


def fix_sdui_screen_history(db: sqlite3.Connection) -> list[dict]:
    """Fix standalone Dividers in sdui_screen_history.screen_json."""
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
        print(f"  [fix]  {fix['module_type']} (id: {row_id}) — converted Divider to row-level")
        # Show diff
        old_screen = json.loads(fix["old_json"])
        new_screen = json.loads(new_json)
        _show_diff(old_screen, new_screen, fix["module_type"])

    return applied


def _show_diff(old_screen: dict, new_screen: dict, label: str):
    """Show a concise before/after diff of rows that changed."""
    old_rows = old_screen.get("rows", []) if isinstance(old_screen, dict) else []
    new_rows = new_screen.get("rows", []) if isinstance(new_screen, dict) else []

    for i, (old_r, new_r) in enumerate(zip(old_rows, new_rows)):
        old_type = old_r.get("type", "[none]")
        new_type = new_r.get("type", "[none]")
        if old_type != new_type or old_r.get("cells") != new_r.get("cells"):
            print(f"    row[{i}]: type={old_type} -> type={new_type}")
            old_cells = old_r.get("cells", [])
            if old_cells:
                old_content = old_cells[0].get("content", {})
                old_props = old_content.get("props", {})
                print(f"      before: cell content={old_content.get('type')}, props={json.dumps(old_props)}")
            print(f"      after:  dividerThickness={new_r.get('dividerThickness')}, "
                  f"dividerColor={new_r.get('dividerColor')}, "
                  f"dividerMargin={new_r.get('dividerMargin')}")


def main():
    db_path = os.path.join(os.path.dirname(__file__), "helm.db")
    if not os.path.exists(db_path):
        print(f"Database not found: {db_path}")
        sys.exit(1)

    print(f"Connecting to {db_path}")
    db = sqlite3.connect(db_path)

    print("\n=== Checking module_states ===")
    module_fixes = fix_module_states(db)
    print(f"  Found {len(module_fixes)} module(s) with standalone Dividers")

    print("\n=== Checking sdui_screen_history ===")
    history_fixes = fix_sdui_screen_history(db)
    print(f"  Found {len(history_fixes)} history record(s) with standalone Dividers")

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
    tables = {}
    for fix in all_fixes:
        table = fix["table"]
        if table not in tables:
            tables[table] = set()
        tables[table].add(fix["module_type"])
    for table, modules in tables.items():
        print(f"  {table}: {len(modules)} module(s) affected: {', '.join(sorted(modules))}")

    db.close()


if __name__ == "__main__":
    main()
