# Codebase Explanation

This folder explains the live Helm repo. If you're new, start with the reading order below, then jump into the layer you need.

## Read first

1. [OPERATIONS.md](OPERATIONS.md) — run the stack, env vars, and common commands.
2. [backend.md](backend.md) — backend architecture, folder map, and data flow.
3. [frontend.md](frontend.md) — frontend architecture for the mobile app and web admin.
4. [protocol.md](protocol.md) — REST, WebSocket, MCP, and schema contracts.
5. [qa.md](qa.md) — Playwright coverage, fixtures, and test layout.
6. [AI-TECHNICAL-REFERENCE.md](AI-TECHNICAL-REFERENCE.md) — fast lookup for AI agents.
7. [../CODEBASE_MAP.md](../CODEBASE_MAP.md) — broader repo map with current paths.
8. [agents-and-systems.md](agents-and-systems.md) — agent proxy, MCP server, and workflow engine.
9. [FEATURES.md](FEATURES.md) and [FUTURE_PLANS.md](FUTURE_PLANS.md) — what exists now and what is still planned.

## Doc map

| When you need to... | Start here | Why |
| --- | --- | --- |
| Run or configure the stack | [OPERATIONS.md](OPERATIONS.md) | Backend, mobile, web admin, environment variables, troubleshooting |
| Change backend code | [backend.md](backend.md) | Tiered backend guide with the folder map up front |
| Change frontend code | [frontend.md](frontend.md) | Tiered frontend guide for the mobile app and web admin |
| Check API / WS / MCP contracts | [protocol.md](protocol.md) | Transport contracts and payload shapes |
| Work on tests | [qa.md](qa.md) | Playwright setup, fixtures, and coverage |
| Need a fast file map | [AI-TECHNICAL-REFERENCE.md](AI-TECHNICAL-REFERENCE.md) | Current paths, gotchas, and the main code landmarks |
| Need a broader repo map | [../CODEBASE_MAP.md](../CODEBASE_MAP.md) | Top-level folders plus file-by-file navigation |
| Understand agents and automation | [agents-and-systems.md](agents-and-systems.md) | Agent proxy, MCP server, workflows, and test tooling |
| See what ships today | [FEATURES.md](FEATURES.md) | Current product surface |
| See what is still planned | [FUTURE_PLANS.md](FUTURE_PLANS.md) | Gaps, roadmap, and open work |

## How the guides are organized

- `backend.md` and `frontend.md` start with a TL;DR, then a folder map, then deeper detail.
- `README.md` is the index; `CODEBASE_MAP.md` is the broader repo map; `AI-TECHNICAL-REFERENCE.md` is the quick lookup sheet for AI agents.
- Use the layer docs first when you are editing code. Use the map docs when you need the current file path.
