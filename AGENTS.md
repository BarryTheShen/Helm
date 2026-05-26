# Helm — AI Agent Instructions

**Primary source of truth for all AI coding agents working on this project.**

**Cursor** is the primary AI environment. See `docs/ai/cursor-setup.md` and `.cursor/` for rules, subagents, commands, and MCP. OpenCode (`.opencode/`, `opencode.jsonc`) remains during transition.

---

## Project Summary

Helm is a self-hosted AI super app — a React Native (Expo) mobile frontend that dynamically renders native UI components controlled by an AI agent, backed by a Python FastAPI server. Think WeChat/Alipay super app model, but AI-native. The AI sends JSON payloads; the app renders native components. Zero app updates needed to change any screen.

**Architecture:** Backend (FastAPI) → Protocol (WebSocket/REST/MCP) → Frontend (React Native SDUI renderer) + Web Admin (Vite/React).

---

## Source-of-Truth Docs

| What to Know | Read First |
|---|---|
| File map, data flow, patterns | `docs/codebase-explanation/AI-TECHNICAL-REFERENCE.md` |
| Running services, ports, env vars | `docs/codebase-explanation/OPERATIONS.md` |
| Backend endpoints, DB schema | `docs/codebase-explanation/backend.md` |
| Frontend screens, SDUI | `docs/codebase-explanation/frontend.md` |
| API contracts, WebSocket, MCP | `docs/codebase-explanation/protocol.md` |
| Agent runtime, MCP server | `docs/codebase-explanation/agents-and-systems.md` |
| QA test suite | `docs/codebase-explanation/qa.md` |
| Blueprint specs | `docs/Agentic AI Super App — Project Hub/Blueprint — Production Spec Documents/` |
| AI workflow details | `docs/ai/` |
| Cursor setup | `docs/ai/cursor-setup.md` |
| OpenCode model policy (legacy) | `docs/ai/opencode-models.md` |
| Feature Feedback workflow | `docs/ai/workflows.md` (Feature Feedback section) |

---

## Commands & Ports

| Service | Command | Port |
|---|---|---|
| Backend | `cd backend && uvicorn app.main:app --reload` | 8000 |
| Web Admin | `cd web && npm run dev` | 5174 |
| Mobile | `cd mobile && npx expo start` | Auto (QR for Expo Go) |
| Standalone Agent | `cd agent && python helm_agent.py --web` | 7860 |
| QA Tests | `cd qa && npx playwright test` | — |
| Backend Tests | `cd backend && pytest -q` | — |

**Vite proxy:** `/api/*`, `/auth/*`, `/ws*` → `http://localhost:8000`

---

## Non-Negotiable Engineering Rules

- **Root cause fixes only.** No patches that mask the real issue. If a fix requires `// TODO: fix properly later`, fix it properly now.
- **One change, one concern.** Each commit addresses exactly one issue.
- **Understand before changing.** Trace the execution path. Never change code you don't understand.
- **Elegant code, not patches.** No workarounds, hacks, or technical debt accumulation.
- **No commits to `main`.** Always branch and PR.
- **No hardcoded secrets.** Use environment variables.
- **TypeScript strict mode** for frontend. **Python type hints** on backend.
- **Functional components only** — no class components. **Named exports** — no default exports.
- **One component per file, one route per file.**

---

## Default Cursor Orchestration

The canonical development loop is:

```
session init → context artifact → plan ↔ plan critic until approved → implementation → QA + review → live test → docs → helm-git
```

See `docs/ai/workflows.md` for full detail. Project rules in `.cursor/rules/helm-core.mdc` apply to every Agent session.

For features with blueprint specs, a `requirements-checklist.md` artifact tracks completeness. The reviewer compares implementation against it.

**Subagents** live in `.cursor/agents/helm-*.md`. The main Agent (with `helm-core` rules) **is the orchestrator** — classify, delegate, verify, complete. Optional: `/helm-orchestrate <task>`. Do not ask Barry “should I continue?” between steps; run independent subagents **in parallel** when safe (tester + reviewer, separate layers after protocol, etc.). See `.cursor/agents/helm-orchestrator.md`.

**Slash commands** in `.cursor/commands/` are optional shortcuts when scope is already known.

**MCP:** Playwright and Context7 — see `.cursor/mcp.json`.

### Session Init / Reset

Before every new task, the session is initialized via `helm-session-init`:
- Stale `.helm-sessions/current/` is archived to `.helm-sessions/archive/YYYY-MM-DD-HHMMSS-task-slug/`
- Fresh `task.md`, `context-index.md`, and workspace artifacts are created
- On continuation, existing context is summarized and reused

### Final Git Stage: helm-git

`helm-git` is the canonical final stage for branch safety, diff review, commit, and push.
`/helm-ship` may remain as an optional shortcut command, but the canonical workflow calls `helm-git` directly.

### Plan Critic / Explorer

There is no separate broad-explorer agent. `helm-plan-critic` is a combined targeted explorer + critic:
- Reads the draft plan, then explores only the exact files/symbols needed to verify assumptions
- Challenges file existence, imports, dependencies, ordering, cross-layer sync, and edge cases
- Returns APPROVED or specific objections with evidence
- Read limit: max 8 source files per invocation
- Leaf node: cannot spawn subagents

## Task Routing

| Task | Docs to Read | Where to Work |
|---|---|---|
| Backend endpoint / service | `docs/codebase-explanation/backend.md` | `backend/app/` |
| SDUI component (mobile) | `docs/codebase-explanation/frontend.md` | `mobile/src/` |
| SDUI editor (web) | `docs/codebase-explanation/frontend.md` | `web/src/editor/` |
| Web admin page | `docs/codebase-explanation/frontend.md` | `web/src/pages/` |
| MCP tool | `docs/codebase-explanation/agents-and-systems.md` | `backend/app/mcp/` |
| Protocol / API contract | `docs/codebase-explanation/protocol.md` | `backend/app/schemas/` + frontend API |
| AI agent / proxy | `docs/codebase-explanation/agents-and-systems.md` | `agent/` + `backend/app/services/` |
| Workflow / trigger | `docs/codebase-explanation/backend.md` | `backend/app/services/workflow_engine.py` |
| Auth / security | `docs/codebase-explanation/backend.md` | `backend/app/utils/security.py` |
| Test | `docs/codebase-explanation/qa.md` | `backend/tests/` or `qa/src/` |
| Docs-only | Relevant `docs/codebase-explanation/` file | `docs/` |

---

## Verification Policy

Run verification proportional to the layers you touched:

| Layer | Required Check |
|-------|---------------|
| Backend code | `cd backend && pytest -q` |
| Web admin | `cd web && npm run lint` (build if types changed); conditional: `cd qa && npx playwright test --project e2e` if UI behavior changed |
| Mobile | `cd mobile && npx expo start` smoke check |
| React components/hooks | `npx -y react-doctor@latest . --diff origin/modernize/import-libraries --offline --json` — Conditional, if React/RN components changed |
| Docs/config only | Path/link sanity, no hardcoded secrets |
| Multi-layer | Relevant checks for each layer changed |

**Revert discipline:** If the approach is wrong, revert. If it's a small localized mistake, fix it once. Do not stack blind patches.

---

## Safety & Git Rules

- Commit after each completed, verified step
- One logical change per commit
- Commit message: imperative mood (`"Add calendar endpoint"`)
- Run `pytest -q` before committing backend changes
- Run `npm run lint` before committing web changes
- Never commit failing tests or broken builds
- Never commit directly to `main`
