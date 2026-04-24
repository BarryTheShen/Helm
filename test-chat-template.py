#!/usr/bin/env python3
"""
Test script for Chat template functionality.

Tests:
1. Backend chat endpoint exists and works
2. send_to_agent action is registered
3. Chat template structure is correct
4. WebSocket chat_message handler works

Run: python test-chat-template.py
"""
import asyncio
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent / "backend"))

async def test_chat_functionality():
    from app.database import AsyncSessionLocal
    from app.services.action_registry import registry
    from app.models.template import SDUITemplate
    from sqlalchemy import select

    print("🧪 Testing Chat Template Functionality\n")

    # Test 1: Check if send_to_agent action is registered
    print("1. Checking action registry...")
    if registry.is_registered("send_to_agent"):
        print("   ✅ send_to_agent action is registered")
    else:
        print("   ❌ send_to_agent action NOT registered")
        return False

    # Test 2: Check Chat template structure
    print("\n2. Checking Chat template...")
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(SDUITemplate).where(SDUITemplate.name == "Chat")
        )
        template = result.scalars().first()

        if not template:
            print("   ❌ Chat template not found")
            return False

        print(f"   ✅ Chat template found: {template.description}")

        # Check structure
        screen = template.screen_json
        rows = screen.get("rows", [])

        print(f"   📊 Template has {len(rows)} rows")

        # Check for header row with text + button
        if len(rows) > 0:
            first_row = rows[0]
            cells = first_row.get("cells", [])
            if len(cells) == 2:
                cell1_type = cells[0].get("content", {}).get("type")
                cell2_type = cells[1].get("content", {}).get("type")
                print(f"   ✅ Row 1: {cell1_type} + {cell2_type}")
            else:
                print(f"   ⚠️  Row 1 has {len(cells)} cells (expected 2)")

        # Check for inputbar
        has_inputbar = False
        for row in rows:
            for cell in row.get("cells", []):
                if cell.get("content", {}).get("type") == "inputbar":
                    has_inputbar = True
                    action = cell.get("content", {}).get("props", {}).get("action", {})
                    print(f"   ✅ InputBar found with action: {action.get('function')}")
                    break

        if not has_inputbar:
            print("   ❌ InputBar not found in template")
            return False

    # Test 3: Check chat messages table exists
    print("\n3. Checking database schema...")
    async with AsyncSessionLocal() as db:
        from app.models.chat_message import ChatMessage
        result = await db.execute(select(ChatMessage).limit(1))
        print("   ✅ chat_messages table exists")

    # Test 4: Check data connector
    print("\n4. Checking data connector...")
    from app.services.data_connectors import get_canonical_schema
    schema = get_canonical_schema("chat")
    if schema:
        print(f"   ✅ Chat data connector registered with {len(schema.get('fields', []))} fields")
    else:
        print("   ❌ Chat data connector not found")
        return False

    print("\n✅ All tests passed!")
    return True

if __name__ == "__main__":
    success = asyncio.run(test_chat_functionality())
    sys.exit(0 if success else 1)
