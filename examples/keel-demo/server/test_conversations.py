"""Test harness: 10 natural conversation scenarios to verify AI generates appropriate SDUI.

Each scenario simulates a real user message (no explicit "show me a form" commands).
The test checks whether the AI used the render_sdui_screen tool and what components it used.

Usage:
    # Start the server first: uvicorn main:app --port 8765
    python test_conversations.py
"""

import asyncio
import json
import sys

import websockets

WS_URL = "ws://localhost:8765/ws"
TIMEOUT = 180  # seconds per scenario (two API calls + possible retry)


SCENARIOS = [
    {
        "id": 1,
        "name": "Student info collection",
        "message": "I need to collect information from 10 students - name, email, grade, and major. Can you help me set that up?",
        "expect_screen": True,
        "expect_components": ["Form"],
        "description": "Should generate an editable Form with fields for student data",
    },
    {
        "id": 2,
        "name": "Weekly schedule planning",
        "message": "I'm trying to plan my weekly schedule. I have classes Mon/Wed/Fri and work Tue/Thu. Can you help me organize this?",
        "expect_screen": True,
        "expect_components": ["Container", "Text"],
        "description": "Should generate a structured schedule/table layout",
    },
    {
        "id": 3,
        "name": "Simple greeting",
        "message": "Hey, how are you doing today?",
        "expect_screen": False,
        "expect_components": [],
        "description": "Simple greeting — should be text-only, no SDUI screen",
    },
    {
        "id": 4,
        "name": "Budget tracker setup",
        "message": "I want to track my monthly expenses. I spend about $1200 on rent, $400 on food, $150 on transport, and $200 on entertainment. Can you show me a breakdown?",
        "expect_screen": True,
        "expect_components": ["Container", "Text"],
        "description": "Should generate a visual budget dashboard with stats",
    },
    {
        "id": 5,
        "name": "Feedback survey",
        "message": "I'm running a workshop next week and need to gather feedback from attendees. What's the best way to do that?",
        "expect_screen": True,
        "expect_components": ["Form"],
        "description": "Should suggest and render a feedback form with rating fields",
    },
    {
        "id": 6,
        "name": "Comparison of options",
        "message": "I'm choosing between three laptops: MacBook Pro ($2499), ThinkPad X1 ($1899), and Dell XPS ($2199). Can you help me compare them?",
        "expect_screen": True,
        "expect_components": ["Container", "Text"],
        "description": "Should generate a structured comparison layout",
    },
    {
        "id": 7,
        "name": "Quick factual question",
        "message": "What's the capital of France?",
        "expect_screen": False,
        "expect_components": [],
        "description": "Simple factual Q&A — should be text-only",
    },
    {
        "id": 8,
        "name": "Todo list creation",
        "message": "I have a bunch of things to do this weekend: grocery shopping, clean the house, fix the leaky faucet, call mom, and finish the report. Help me organize these by priority.",
        "expect_screen": True,
        "expect_components": ["Container", "Text"],
        "description": "Should generate a structured todo/task list with priority indicators",
    },
    {
        "id": 9,
        "name": "Contact form for website",
        "message": "I'm building a small business website and need a way for customers to reach out. What info should I collect from them?",
        "expect_screen": True,
        "expect_components": ["Form"],
        "description": "Should generate a contact form with appropriate fields",
    },
    {
        "id": 10,
        "name": "Recipe with steps",
        "message": "Can you give me a recipe for chocolate chip cookies with all the steps?",
        "expect_screen": True,
        "expect_components": ["Container", "Text"],
        "description": "Should generate a structured recipe card with numbered steps",
    },
]


def extract_components(screen: dict) -> set[str]:
    """Recursively extract all component types from an SDUI screen."""
    types = set()
    for row in screen.get("rows", []):
        for cell in row.get("cells", []):
            content = cell.get("content", {})
            _collect_types(content, types)
    return types


def _collect_types(comp: dict, types: set) -> None:
    if not isinstance(comp, dict):
        return
    if "type" in comp:
        types.add(comp["type"])
    for child in comp.get("children", []):
        _collect_types(child, types)


async def run_scenario(scenario: dict) -> dict:
    """Run a single scenario and return results."""
    result = {
        "id": scenario["id"],
        "name": scenario["name"],
        "message": scenario["message"],
        "expect_screen": scenario["expect_screen"],
        "expect_components": scenario["expect_components"],
        "description": scenario["description"],
        "got_screen": False,
        "got_components": set(),
        "response_text": "",
        "screen_json": None,
        "pass": False,
        "issues": [],
    }

    try:
        async with websockets.connect(WS_URL) as ws:
            # Consume welcome message
            welcome = await asyncio.wait_for(ws.recv(), timeout=TIMEOUT)

            # Send test message
            await ws.send(json.dumps({
                "type": "send_to_agent",
                "message": scenario["message"],
            }))

            # Collect response (text_deltas + response_done)
            full_text = ""
            screen = None
            deadline = asyncio.get_event_loop().time() + TIMEOUT

            while asyncio.get_event_loop().time() < deadline:
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=TIMEOUT)
                    data = json.loads(raw)

                    if data.get("type") == "text_delta":
                        full_text += data.get("delta", "")
                    elif data.get("type") == "response_done":
                        full_text = data.get("text", full_text)
                        screen = data.get("screen")
                        break
                except asyncio.TimeoutError:
                    result["issues"].append("TIMEOUT waiting for response")
                    break

            result["response_text"] = full_text[:200]  # Truncate for report
            result["got_screen"] = screen is not None
            result["screen_json"] = screen

            if screen:
                result["got_components"] = extract_components(screen)

            # Evaluate pass/fail
            if scenario["expect_screen"] and not result["got_screen"]:
                result["issues"].append("EXPECTED screen but got text-only response")
            elif not scenario["expect_screen"] and result["got_screen"]:
                result["issues"].append("UNEXPECTED screen generated for simple message")

            if scenario["expect_screen"] and result["got_screen"]:
                for comp in scenario["expect_components"]:
                    if comp not in result["got_components"]:
                        result["issues"].append(f"MISSING expected component: {comp}")

                # Check if Form components have editable fields
                if "Form" in scenario["expect_components"]:
                    screen_str = json.dumps(screen)
                    if '"Form"' not in screen_str:
                        result["issues"].append("Expected Form component but none found in screen")

            result["pass"] = len(result["issues"]) == 0

    except Exception as e:
        result["issues"].append(f"ERROR: {e}")

    return result


async def main():
    print("=" * 70)
    print("KEEL DEMO — AI SDUI Generation Test Suite")
    print("=" * 70)
    print(f"\nRunning {len(SCENARIOS)} scenarios...\n")

    results = []
    for scenario in SCENARIOS:
        print(f"  [{scenario['id']:2d}/10] {scenario['name']}...", end=" ", flush=True)
        result = await run_scenario(scenario)
        status = "PASS" if result["pass"] else "FAIL"
        print(f"{'✓' if result['pass'] else '✗'} {status}")
        if result["issues"]:
            for issue in result["issues"]:
                print(f"         → {issue}")
        results.append(result)

    # Summary
    passed = sum(1 for r in results if r["pass"])
    failed = sum(1 for r in results if not r["pass"])

    print(f"\n{'=' * 70}")
    print(f"RESULTS: {passed} passed, {failed} failed out of {len(results)} scenarios")
    print(f"{'=' * 70}")

    # Bug report
    if failed > 0:
        print(f"\n{'=' * 70}")
        print("BUG REPORT")
        print(f"{'=' * 70}")
        for r in results:
            if not r["pass"]:
                print(f"\n--- Scenario {r['id']}: {r['name']} ---")
                print(f"  Message: {r['message'][:80]}...")
                print(f"  Expected screen: {r['expect_screen']}")
                print(f"  Got screen: {r['got_screen']}")
                if r["got_screen"]:
                    print(f"  Components found: {r['got_components']}")
                print(f"  Issues:")
                for issue in r["issues"]:
                    print(f"    - {issue}")
                print(f"  Response preview: {r['response_text'][:150]}...")

    # Write detailed JSON report
    report_path = "test_report.json"
    serializable = []
    for r in results:
        sr = dict(r)
        sr["got_components"] = list(sr["got_components"])
        if sr["screen_json"]:
            sr["screen_json"] = json.dumps(sr["screen_json"])[:500]
        serializable.append(sr)

    with open(report_path, "w") as f:
        json.dump(serializable, f, indent=2)
    print(f"\nDetailed report saved to: {report_path}")

    return 1 if failed > 0 else 0


if __name__ == "__main__":
    code = asyncio.run(main())
    sys.exit(code)
