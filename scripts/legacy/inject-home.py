"""Re-inject the Wandr home SDUI screen with functional button actions."""
import json
import requests

# Auth
resp = requests.post("http://localhost:9000/auth/login", json={
    "username": "testuser",
    "password": "testpass123",
    "device_id": "inject",
    "device_name": "inject",
})
token = resp.json()["session_token"]
headers = {"Authorization": f"Bearer {token}"}

home_screen = {
    "schema_version": "1.0.0",
    "module_id": "home",
    "title": "Tokyo Adventure",
    "generated_at": "2025-08-09T10:00:00Z",
    "rows": [
        # Row 1: Hero header
        {
            "id": "row1",
            "cells": [{
                "id": "cell1",
                "width": "auto",
                "content": {
                    "type": "Container",
                    "id": "hero",
                    "props": {
                        "backgroundColor": "#1B2838",
                        "padding": 20,
                        "borderRadius": 16,
                        "direction": "column",
                        "gap": 8,
                        "children": [
                            {
                                "type": "Text",
                                "props": {"content": "🗾 Tokyo Adventure", "variant": "title", "color": "#FFFFFF"}
                            },
                            {
                                "type": "Text",
                                "props": {"content": "April 14-21, 2025 • 7 days", "variant": "caption", "color": "#B0BEC5"}
                            },
                            {
                                "type": "Badge",
                                "props": {"label": "Day 3 of 7", "color": "blue"}
                            },
                        ]
                    }
                }
            }],
            "scrollable": False, "gap": 12
        },
        # Row 2: Trip stats
        {
            "id": "row2",
            "cells": [{
                "id": "cell2",
                "width": "auto",
                "content": {
                    "type": "Container",
                    "id": "stats",
                    "props": {
                        "direction": "row",
                        "gap": 12,
                        "children": [
                            {"type": "Stat", "props": {"label": "Places Visited", "value": "8", "icon": "map-pin"}},
                            {"type": "Stat", "props": {"label": "Photos", "value": "47", "icon": "camera"}},
                            {"type": "Stat", "props": {"label": "Budget Left", "value": "¥42,500", "icon": "credit-card"}},
                        ]
                    }
                }
            }],
            "scrollable": False, "gap": 12
        },
        # Row 3: Quick actions - navigate to other tabs
        {
            "id": "row3",
            "cells": [{
                "id": "cell3",
                "width": "auto",
                "content": {
                    "type": "Container",
                    "id": "actions",
                    "props": {
                        "direction": "column",
                        "gap": 8,
                        "children": [
                            {"type": "Text", "props": {"content": "Quick Actions", "variant": "heading"}},
                            {
                                "type": "Container",
                                "props": {
                                    "direction": "row",
                                    "gap": 8,
                                    "children": [
                                        {
                                            "type": "Button",
                                            "props": {
                                                "label": "View Itinerary",
                                                "variant": "primary",
                                                "icon": "calendar",
                                                "onPress": {"type": "navigate", "screen": "calendar"}
                                            }
                                        },
                                        {
                                            "type": "Button",
                                            "props": {
                                                "label": "Explore Places",
                                                "variant": "secondary",
                                                "icon": "compass",
                                                "onPress": {"type": "navigate", "screen": "forms"}
                                            }
                                        }
                                    ]
                                }
                            },
                            {
                                "type": "Container",
                                "props": {
                                    "direction": "row",
                                    "gap": 8,
                                    "children": [
                                        {
                                            "type": "Button",
                                            "props": {
                                                "label": "Travel Journal",
                                                "variant": "secondary",
                                                "icon": "book-open",
                                                "onPress": {"type": "navigate", "screen": "modules"}
                                            }
                                        },
                                        {
                                            "type": "Button",
                                            "props": {
                                                "label": "View Map",
                                                "variant": "ghost",
                                                "icon": "map",
                                                "onPress": {"type": "open_url", "url": "https://www.google.com/maps/place/Tokyo,+Japan"}
                                            }
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                }
            }],
            "scrollable": False, "gap": 12
        },
        # Row 4: Today's schedule card
        {
            "id": "row4",
            "cells": [{
                "id": "cell4",
                "width": "auto",
                "content": {
                    "type": "Container",
                    "id": "today",
                    "props": {
                        "direction": "column",
                        "gap": 8,
                        "backgroundColor": "#F8F9FA",
                        "padding": 16,
                        "borderRadius": 12,
                        "children": [
                            {"type": "Text", "props": {"content": "Today's Highlights", "variant": "heading"}},
                            {
                                "type": "List",
                                "props": {
                                    "items": [
                                        {"id": "i1", "title": "Tsukiji Fish Market", "subtitle": "9:00 AM - Fresh sushi breakfast", "icon": "clock"},
                                        {"id": "i2", "title": "teamLab Borderless", "subtitle": "11:30 AM - Digital art museum", "icon": "clock"},
                                        {"id": "i3", "title": "Shibuya Crossing", "subtitle": "2:00 PM - Iconic intersection", "icon": "clock"},
                                        {"id": "i4", "title": "Ramen Street", "subtitle": "6:00 PM - Dinner at Tokyo Station", "icon": "clock"},
                                    ]
                                }
                            }
                        ]
                    }
                }
            }],
            "scrollable": False, "gap": 12
        },
        # Row 5: Add stop + Ask AI
        {
            "id": "row5",
            "cells": [{
                "id": "cell5",
                "width": "auto",
                "content": {
                    "type": "Container",
                    "id": "bottom-actions",
                    "props": {
                        "direction": "row",
                        "gap": 8,
                        "children": [
                            {
                                "type": "Button",
                                "props": {
                                    "label": "Add Stop",
                                    "variant": "primary",
                                    "icon": "plus-circle",
                                    "onPress": {"type": "navigate", "screen": "chat"}
                                }
                            },
                            {
                                "type": "Button",
                                "props": {
                                    "label": "Copy Itinerary",
                                    "variant": "ghost",
                                    "icon": "copy",
                                    "onPress": {"type": "copy_text", "text": "Tokyo Adventure - Day 3:\n9:00 AM Tsukiji Fish Market\n11:30 AM teamLab Borderless\n2:00 PM Shibuya Crossing\n6:00 PM Ramen Street"}
                                }
                            }
                        ]
                    }
                }
            }],
            "scrollable": False, "gap": 12
        },
        # Row 6: Travel tip
        {
            "id": "row6",
            "cells": [{
                "id": "cell6",
                "width": "auto",
                "content": {
                    "type": "Alert",
                    "id": "tip",
                    "props": {
                        "severity": "info",
                        "title": "Travel Tip",
                        "message": "Get a Suica card at any JR station for easy train travel. Tap to pay at convenience stores too!",
                        "dismissible": True
                    }
                }
            }],
            "scrollable": False, "gap": 12
        }
    ]
}

# Inject
r = requests.post(
    "http://localhost:9000/api/sdui/home",
    json={"screen": home_screen},
    headers=headers,
)
print(f"Home: {r.status_code} — {r.json()}")

# Verify
v = requests.get("http://localhost:9000/api/sdui/home", headers=headers)
d = v.json()["screen"]
print(f"Verified: title={d['title']}, rows={len(d['rows'])}")

# Count buttons
count = 0
def count_buttons(node):
    global count
    if isinstance(node, dict):
        if node.get("type") == "Button":
            count += 1
            label = node.get("label") or node.get("props", {}).get("label", "?")
            onPress = node.get("onPress") or node.get("props", {}).get("onPress")
            print(f"  ✓ {label} → {json.dumps(onPress)[:60]}")
        for v in node.values():
            if isinstance(v, (dict, list)):
                count_buttons(v)
    elif isinstance(node, list):
        for item in node:
            count_buttons(item)
count_buttons(d)
print(f"Total buttons: {count}")
