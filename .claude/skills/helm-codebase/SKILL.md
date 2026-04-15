---
name: helm-codebase
description: Orientation reference for the Helm codebase. Points agents to living documentation in docs/codebase-explanation/ for file maps, data flows, known bugs, architecture, and operational guides. Use at the start of every task.
---

# Helm Codebase Orientation

Before making any change, orient yourself using the living documentation in `docs/codebase-explanation/`.

## Primary Reference

| File | Read when... | Contains |
|------|-------------|---------|
| `AI-TECHNICAL-REFERENCE.md` | **Every session, first** | File map, data flows, known bugs, patterns, ports, env vars |
| `OPERATIONS.md` | Running any service | Start commands, ports, env setup, DB migrations |
| `backend.md` | Touching `backend/` | Architecture, endpoints, DB schema, services |
| `frontend.md` | Touching `mobile/` or `web/` | Screens, navigation, state, SDUI pipeline |
| `protocol.md` | Touching API contracts | REST, WebSocket, MCP tools, SDUI schema |
| `agents-and-systems.md` | Touching `agent/` or MCP | Agent Proxy, MCP Server, Workflow Engine |

## Secondary: Blueprint Specs

For original design intent:
- `docs/Agentic AI Super App — Project Hub/Blueprint — Production Spec Documents/Backend Spec — Python FastAPI Server.md`
- `docs/Agentic AI Super App — Project Hub/Blueprint — Production Spec Documents/Frontend Spec — iOS App (React Native Expo).md`
- `docs/Agentic AI Super App — Project Hub/Blueprint — Production Spec Documents/Protocol Spec — Communication Layer.md`

## Codebase Rules

CLAUDE.md at repo root contains code quality rules, bug handling workflow, coding conventions.

## Orientation Workflow

1. Read `AI-TECHNICAL-REFERENCE.md` — file map + known bugs
2. Check Known Bugs table — your task may interact with existing issues
3. Use search to find specific files
4. Read only those files (max 5)
5. Proceed with task
