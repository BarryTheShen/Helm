# Helm — AI Agent Instructions

**Primary source of truth for all AI coding agents working on this project.**

For Claude Code: this file replaces the monolithic CLAUDE.md. For other tools: see `docs/ai/` for full context.

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
| OpenCode model policy | `docs/ai/opencode-models.md` |

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

## Default OpenCode Orchestration

`helm-orchestrator` is the default primary agent (set in `opencode.jsonc`). Barry does not manually route every step — the orchestrator classifies the task, delegates subagents conditionally, verifies, reviews, documents when needed, and reports completion. Slash commands are optional shortcuts for when Barry already knows the scope.

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

## Task-Size Workflow

Match the workflow to the task size. See `docs/ai/workflows.md` for detail.

| Size | Workflow |
|------|----------|
| Small edit (docs, config, single-file fix) | Edit → relevant check → self-review |
| Bug fix | Reproduce → diagnose → fix → verify → regression test if useful |
| Medium feature | Plan → implement → test → review |
| Large feature | Research → plan → plan critic → implement → test → review → docs |

---

## Verification Policy

Run verification proportional to the layers you touched:

| Layer | Required Check |
|-------|---------------|
| Backend code | `cd backend && pytest -q` |
| Web admin | `cd web && npm run lint` (build if types changed); conditional: `cd qa && npx playwright test --project e2e` if UI behavior changed |
| Mobile | `cd mobile && npx expo start` smoke check |
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
