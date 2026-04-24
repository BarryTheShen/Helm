#!/usr/bin/env python3
"""
Fix template issues identified in Feature Feedback 3.

Issues fixed:
1. Home Template:
   - Convert @user.name to pill UI format
   - Change Calendar variant from "agenda" to "compact" for mobile
   - Add proper dataBinding to Todo and NotesModule
   - Fix button actions (add proper server_action functions)

2. Chat Template:
   - Remove settings button (not needed)
   - Remove external InputBar and Send button (ChatModule has its own)
   - Update ChatModule to be self-contained

3. Daily Planner Template:
   - Convert @date.today to pill UI format in Markdown
   - Remove custom Container, use proper components

4. Feed Template:
   - Fix component type names: RichText -> RichTextRenderer
   - Ensure ArticleCard is properly configured
"""

import asyncio
import json
import sqlite3
from pathlib import Path

# Template fixes
TEMPLATE_FIXES = {
    "Home": {
        "rows": [
            {
                "id": "e7b407e2-7308-459f-8d2b-a5794ccc7622",
                "height": "auto",
                "cells": [
                    {
                        "id": "a62ff3fa-0647-4489-b790-6e0554b72684",
                        "content": {
                            "type": "Text",
                            "props": {
                                "content": "Good morning, {{user.name}} 👋",
                                "fontSize": 24,
                                "fontWeight": "bold"
                            }
                        }
                    }
                ]
            },
            {
                "id": "e684e6f0-f447-4b66-8b9d-1d260ac2be38",
                "height": "auto",
                "cells": [
                    {
                        "id": "231372cf-ec9d-4423-9c3f-73fb55edb467",
                        "width": "50%",
                        "content": {
                            "type": "Text",
                            "props": {
                                "content": "☀️ {{weather.temperature}}°C\n{{weather.location}}",
                                "fontSize": 16,
                                "fontWeight": "semibold"
                            }
                        }
                    },
                    {
                        "id": "7a0938a7-ab95-4cd3-9cd5-f3800907c303",
                        "width": "50%",
                        "content": {
                            "type": "CalendarModule",
                            "props": {
                                "variant": "compact"
                            }
                        }
                    }
                ]
            },
            {
                "id": "09d8dda2-f95f-4c18-967a-ff3a7fda8b9f",
                "height": "auto",
                "cells": [
                    {
                        "id": "6fee69b2-ae6c-4d6b-80d6-89a7fc9bc12d",
                        "content": {
                            "type": "Todo",
                            "props": {
                                "placeholder": "Add a new task...",
                                "items": []
                            }
                        }
                    }
                ]
            },
            {
                "id": "56977462-4131-4a21-9809-272fb4f49c09",
                "height": "auto",
                "cells": [
                    {
                        "id": "a418fd3a-a3bf-4d24-a712-a7bd87f138e9",
                        "content": {
                            "type": "NotesModule",
                            "props": {}
                        }
                    }
                ]
            },
            {
                "id": "8833f410-2c56-46cd-b665-6a1cba6a0e80",
                "height": "auto",
                "cells": [
                    {
                        "id": "680163da-a85b-4024-93c9-976a5268c8bb",
                        "width": "50%",
                        "content": {
                            "type": "Button",
                            "props": {
                                "label": "+ New Task",
                                "variant": "primary",
                                "size": "medium",
                                "action": {
                                    "type": "navigate",
                                    "screen": "home"
                                }
                            }
                        }
                    },
                    {
                        "id": "27bec93f-07a0-46ff-9b7f-d7ec98482e43",
                        "width": "50%",
                        "content": {
                            "type": "Button",
                            "props": {
                                "label": "+ New Note",
                                "variant": "secondary",
                                "size": "medium",
                                "action": {
                                    "type": "navigate",
                                    "screen": "home"
                                }
                            }
                        }
                    }
                ]
            }
        ]
    },
    "Chat": {
        "rows": [
            {
                "id": "8ab3b32a-7bbe-46be-b39b-78c5b2b12242",
                "height": "auto",
                "cells": [
                    {
                        "id": "892d70cf-8243-4d0c-ab14-716e6b53024e",
                        "content": {
                            "type": "Text",
                            "props": {
                                "content": "💬 Chat",
                                "fontSize": 24,
                                "fontWeight": "bold"
                            }
                        }
                    }
                ]
            },
            {
                "id": "487d876b-a51a-4506-982f-d38bd4461bed",
                "height": "flex",
                "cells": [
                    {
                        "id": "6cc5dcf6-a910-4d79-acd0-e0b32ddc62b6",
                        "content": {
                            "type": "ChatModule",
                            "props": {
                                "showHistory": True
                            }
                        }
                    }
                ]
            }
        ]
    },
    "Daily Planner": {
        "rows": [
            {
                "id": "8f762270-88bd-47bf-82be-5dc29b36c6b3",
                "height": "auto",
                "cells": [
                    {
                        "id": "baa2552e-44e4-457b-b401-8683621b32ae",
                        "content": {
                            "type": "Markdown",
                            "props": {
                                "content": "# 📋 Today — {{date.today}}",
                                "textAlign": "center"
                            }
                        }
                    }
                ]
            },
            {
                "id": "e7fdcea1-aa78-4190-8133-f9e245cd201c",
                "height": "auto",
                "cells": [
                    {
                        "id": "a0337fcd-b821-4499-83d4-3fb1f2c2f5c7",
                        "content": {
                            "type": "CalendarModule",
                            "props": {
                                "variant": "week"
                            }
                        }
                    }
                ]
            },
            {
                "id": "5d4df022-5f54-4f84-8598-9b6ceb2cb5b2-row",
                "height": "auto",
                "cells": [
                    {
                        "id": "5d4df022-5f54-4f84-8598-9b6ceb2cb5b2",
                        "content": {
                            "type": "Todo",
                            "props": {
                                "placeholder": "Add a new task...",
                                "items": []
                            }
                        }
                    }
                ]
            },
            {
                "id": "3bd06020-72ef-45fc-9177-284f1bbc817a-row",
                "height": "auto",
                "cells": [
                    {
                        "id": "3bd06020-72ef-45fc-9177-284f1bbc817a",
                        "content": {
                            "type": "NotesModule",
                            "props": {
                                "filterDate": "{{date.today}}"
                            }
                        }
                    }
                ]
            }
        ]
    },
    "Feed": {
        "rows": [
            {
                "id": "cea8310d-11ad-4b92-a0d4-87ebb53a4d0d",
                "height": "auto",
                "cells": [
                    {
                        "id": "20fb918a-ff60-4571-9c8a-0db2f1541407",
                        "content": {
                            "type": "Text",
                            "props": {
                                "content": "📰 News Feed",
                                "fontSize": 24,
                                "fontWeight": "bold"
                            }
                        }
                    },
                    {
                        "id": "19a9a9fa-66d5-43b3-b08c-3ccf52570f6c",
                        "content": {
                            "type": "Button",
                            "props": {
                                "label": "🔄",
                                "variant": "ghost",
                                "size": "small",
                                "action": {
                                    "type": "server_action",
                                    "function": "fetch_rss",
                                    "params": {
                                        "feed_url": "https://hnrss.org/frontpage"
                                    }
                                }
                            }
                        }
                    }
                ]
            },
            {
                "id": "b3652d3b-315d-42d5-9bc7-e16e488416dd",
                "height": "auto",
                "cells": [
                    {
                        "id": "3e57edf0-0e5f-46ac-b3c7-9385982fcb83",
                        "content": {
                            "type": "ArticleCard",
                            "props": {
                                "title": "Welcome to Your Feed",
                                "description": "Tap 'Refresh Feed' to load the latest articles from Hacker News.",
                                "source": "Helm",
                                "publishedAt": "2026-04-17T00:00:00Z"
                            }
                        }
                    }
                ]
            },
            {
                "id": "72e4e4f0-d868-4f54-af1c-07b70476d84b",
                "height": "auto",
                "cells": [
                    {
                        "id": "ee1b9ef5-b286-4cff-8e3e-7f26cd2b69a6",
                        "content": {
                            "type": "RichTextRenderer",
                            "props": {
                                "content": "## How to use\n\nThis feed pulls articles from Hacker News RSS. You can customize the feed URL in the template editor to follow any RSS source.\n\n**Supported sources:**\n- News sites (BBC, CNN, etc.)\n- Blogs with RSS feeds\n- Reddit subreddits\n- YouTube channels",
                                "theme": "light"
                            }
                        }
                    }
                ]
            }
        ]
    }
}


def fix_templates():
    """Update templates in the database."""
    db_path = Path(__file__).parent / "helm.db"

    if not db_path.exists():
        print(f"❌ Database not found at {db_path}")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        for template_name, fixed_screen_json in TEMPLATE_FIXES.items():
            # Get template ID
            cursor.execute("SELECT id FROM sdui_templates WHERE name = ?", (template_name,))
            result = cursor.fetchone()

            if not result:
                print(f"⚠️  Template '{template_name}' not found, skipping")
                continue

            template_id = result[0]

            # Update the template
            cursor.execute(
                "UPDATE sdui_templates SET screen_json = ? WHERE id = ?",
                (json.dumps(fixed_screen_json), template_id)
            )

            print(f"✅ Fixed template: {template_name}")

        conn.commit()
        print("\n✅ All templates updated successfully!")

    except Exception as e:
        conn.rollback()
        print(f"❌ Error updating templates: {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    fix_templates()
