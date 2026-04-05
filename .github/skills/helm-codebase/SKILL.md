---
name: helm-codebase
description: Orientation reference for the Helm codebase. Points agents to living documentation in docs/codebase-explanation/ for file maps, data flows, known bugs, architecture, and operational guides. Use at the start of every task to understand what exists before making changes.
---

# Helm Codebase Orientation

Before making any change to the Helm codebase, orient yourself using the living documentation. These docs describe what **actually exists in the code today** — not aspirational specs.

## Primary Reference: `docs/codebase-explanation/`

Read these files in priority order:

| File | Read when... | What it contains |
|------|-------------|-----------------|
| [AI-TECHNICAL-REFERENCE.md](../../../docs/codebase-explanation/AI-TECHNICAL-REFERENCE.md) | **Every session, first.** | Complete file map, data flow diagrams, known bugs, critical patterns, port map, env vars |
| [OPERATIONS.md](../../../docs/codebase-explanation/OPERATIONS.md) | Running any service | How to start backend/frontend/agent, ports, env setup, DB migrations, test commands |
| [backend.md](../../../docs/codebase-explanation/backend.md) | Touching `backend/` | Architecture, all endpoints, DB schema, services, middleware, routers |
| [frontend.md](../../../docs/codebase-explanation/frontend.md) | Touching `mobile/` | Screens, navigation, state management (Zustand), SDUI rendering pipeline, services |
| [protocol.md](../../../docs/codebase-explanation/protocol.md) | Touching API contracts | REST endpoints, WebSocket message types, MCP tool signatures, SDUI schema |
| [agents-and-systems.md](../../../docs/codebase-explanation/agents-and-systems.md) | Touching `agent/` or `backend/app/mcp/` | Agent Proxy, MCP Server, Workflow Engine, standalone agent architecture |

## Secondary Reference: Blueprint Specs

For original design intent (useful when the living docs don't cover something):

- `docs/Agentic AI Super App — Project Hub/Blueprint — Production Spec Documents/Backend Spec — Python FastAPI Server.md`
- `docs/Agentic AI Super App — Project Hub/Blueprint — Production Spec Documents/Frontend Spec — iOS App (React Native Expo).md`
- `docs/Agentic AI Super App — Project Hub/Blueprint — Production Spec Documents/Protocol Spec — Communication Layer.md`

## Codebase Rules: `CLAUDE.md`

[CLAUDE.md](../../../CLAUDE.md) at repo root contains:
- Code quality rules (root cause fixes, no patches, understand before changing)
- Bug handling workflow (Reproduce → Fix → Verify loop)
- Coding conventions (TypeScript strict, Python type hints, functional components)
- Commit conventions and review checklist

## Orientation Workflow

1. Read `AI-TECHNICAL-REFERENCE.md` — get the file map and known bugs
2. Check the "Known Bugs" table — your task may interact with an existing issue
3. Use `search` / `usages` to find the specific files you need
4. Read only those files (max 5 at a time)
5. Proceed with your task
