---
applyTo: "docs/**/*.md"
---

# Helm Documentation — Maintenance Rules

## Living Documentation

Documentation in `docs/codebase-explanation/` is the single source of truth for AI agents working on Helm. Stale docs = wrong assumptions = broken code in future sessions.

## When to Update

Update docs after ANY of these changes:
- **New file created** → Add to file map in `AI-TECHNICAL-REFERENCE.md`
- **File deleted/renamed** → Remove/update file map entry
- **New bug discovered** → Add to Known Bugs table in `AI-TECHNICAL-REFERENCE.md`
- **Bug fixed** → Remove from Known Bugs table
- **New pattern established** → Add to Critical Patterns table
- **API endpoint added/changed** → Update `backend.md` endpoint tables and `protocol.md`
- **New component added** → Update `frontend.md` component tables
- **WebSocket message type added** → Update `protocol.md` message reference
- **MCP tool added/changed** → Update `protocol.md` MCP tool reference and `agents-and-systems.md`
- **Environment variable added** → Update `AI-TECHNICAL-REFERENCE.md` env table and `OPERATIONS.md`
- **New service/command** → Update `OPERATIONS.md`

## File Responsibilities

| File | Audience | Content |
|------|----------|---------|
| `AI-TECHNICAL-REFERENCE.md` | AI agents (read first every session) | File map, data flows, known bugs, patterns, ports, env vars |
| `OPERATIONS.md` | Anyone running the stack | Setup, run commands, ports, DB migrations |
| `backend.md` | Backend developers | Architecture, endpoints, DB schema, services |
| `frontend.md` | Frontend developers | Screens, navigation, state, SDUI pipeline |
| `protocol.md` | Cross-layer work | REST/WS/MCP contracts, SDUI schema |
| `agents-and-systems.md` | Agent/MCP developers | Agent Proxy, MCP Server, Workflow Engine |

## Documentation Style

- **Tier system**: TLDR (5 lines) → Architecture (1 page) → Deep Dive (full reference)
- **Tables over prose**: Use tables for file maps, endpoints, schemas
- **Code examples**: Include actual code from the repo, not hypothetical examples
- **"Last updated" header**: Update the date at the top of each file you modify
- **No aspirational content**: Document what EXISTS, not what's planned

## CLAUDE.md Updates

Update `CLAUDE.md` at repo root when:
- Project structure changes (new top-level directories)
- New commands are added
- New conventions are established
- Known patterns/gotchas are discovered (add to respective sections)
