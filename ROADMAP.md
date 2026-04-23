# Helm Roadmap

Current status: **pre-1.0, self-hostable, production-ready backend.** Mobile app and marketplace are the final pieces.

## Shipped

- FastAPI backend, 227 tests green, SQLite + async SQLAlchemy
- 22 MCP tools, PydanticAI agent proxy with tool calling
- WebSocket + REST, OpenAI-compatible streaming
- Web admin: 3-panel SDUI editor, React Flow workflows, variables, connections, logs, sessions
- Encrypted API-key storage (Fernet)
- Session idle TTL enforcement
- Module install/uninstall API with WebSocket broadcast
- APScheduler cron workflows
- Alembic migrations, including `module_instances` with FK scoping on 7 tables

## Q2 2026 (Next)

- **Module manifests** — declarative mini-program descriptors (screens, workflows, variables, connections required)
- **Marketplace v1** — browse / install public modules from the admin panel
- **Mobile install flow** — Module Store tab working end-to-end, install = new tab appears live
- **Connector ABC** — pluggable connector interface (Google Calendar, Gmail, Notion, custom)
- **OAuth flows** — generic OAuth2 connector with token refresh
- **Module-scoped MCP tools** — agents run in module context, can only touch that module's data

## Q3 2026

- **Mobile polish** — full Expo Router v5 migration, offline cache for SDUI payloads
- **Draft → Publish** — staged SDUI edits with preview and rollback
- **Collaboration** — share a module with another user, role-based permissions
- **Hosted option** — one-click deploy to Fly / Render / Railway, optional hosted SaaS

## Q4 2026

- **AI-authored modules** — describe what you want in Chinese or English, the agent scaffolds the module
- **Module analytics** — usage, error rates, cost per module
- **Multi-tenant SaaS** — if there's demand, a hosted plan for non-self-hosters

## Open Questions

- Should the mobile app bundle its own backend for solo users? (ship as a single binary)
- Plugin marketplace monetization: free / paid / open-source only?
- Should modules support their own push notifications, or only the shell?

## How to Influence the Roadmap

- Open a GitHub Discussion with the "Roadmap" tag
- Upvote issues you care about — we prioritize by reaction count when it's close
- Submit a PR — shipping trumps arguing
