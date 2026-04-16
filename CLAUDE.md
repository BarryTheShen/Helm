# Agentic AI Super App

An independent, open-source React Native (Expo) mobile app — a universal agentic AI frontend that dynamically renders rich native UI components connected to any service via APIs. WeChat/Alipay super app model but AI-native.

## Tech Stack

- **Frontend:** React Native (Expo), iOS-first, Android comes free
- **Backend:** Python FastAPI server, self-hosted
- **Protocol:** AG-UI over WebSocket (agent↔frontend communication)
- **AI Agent:** PydanticAI / raw LLM API calls
- **Dev Environment:** Linux (primary), Mac only for final App Store build
- **IDE:** Cursor

## Architecture (Three Layers)

1. **Backend** — Python FastAPI. API gateway, AI agent runtime, plugin/connector system for services (Google Calendar OAuth, weather, email, etc.)
2. **Protocol** — AG-UI protocol. Open-source, framework-agnostic message format. WebSocket transport. Backend sends AG-UI events → app parses and renders.
3. **React Native App** — SDUI renderer. Pre-built component library (calendar, chat, news feed, charts, forms, maps, notifications, lists). JSON payloads → native components.

**Build order:** Backend → Protocol → Frontend.

## Codebase Map

> **AI agents: always read `docs/codebase-explanation/` at the start of every session.**
> These docs describe what actually exists in the code today — not aspirational specs.
>
> | File | Read when... |
> |------|-------------|
> | [docs/codebase-explanation/AI-TECHNICAL-REFERENCE.md](docs/codebase-explanation/AI-TECHNICAL-REFERENCE.md) | **Read this first, every session.** File map, data flow, known bugs, patterns. |
> | [docs/codebase-explanation/OPERATIONS.md](docs/codebase-explanation/OPERATIONS.md) | Running backend/frontend/agent, API keys, `.env` reference. |
> | [docs/codebase-explanation/backend.md](docs/codebase-explanation/backend.md) | Backend architecture, all endpoints, DB schema detail. |
> | [docs/codebase-explanation/frontend.md](docs/codebase-explanation/frontend.md) | Frontend screens, navigation, state management, SDUI. |
> | [docs/codebase-explanation/protocol.md](docs/codebase-explanation/protocol.md) | REST API contracts, WebSocket message types, MCP tools. |
> | [docs/codebase-explanation/agents-and-systems.md](docs/codebase-explanation/agents-and-systems.md) | AI Agent Proxy, MCP Server, Workflow Engine, standalone agent. |

For high-level architecture diagrams see [docs/CODEBASE_MAP.md](docs/CODEBASE_MAP.md).

## Blueprint Spec Documents

Detailed production specifications live in `docs/Agentic AI Super App — Project Hub/Blueprint — Production Spec Documents/`:

- `Frontend Spec — iOS App (React Native : Expo).md` — SDUI renderer, navigation, component catalog, design system
- `Backend Spec — Python FastAPI Server.md` — API endpoints, database schema, MCP server, agent proxy, workflow engine
- `Protocol Spec — Communication Layer.md` — WebSocket, REST, OpenAI-compatible API, MCP, SDUI JSON schema, sequence diagrams

**Read all three specs before starting implementation. When making architectural decisions, consult these docs first.**

## Project Structure

```
Helm/
├── CLAUDE.md
├── agent/
│   ├── helm_agent.py           # Standalone PydanticAI agent (MCP + frontend editor)
│   └── README.md               # How to run + architecture
├── backend/
│   ├── pyproject.toml          # Dependencies + pytest config
│   ├── alembic.ini
│   ├── alembic/
│   │   └── versions/           # DB migrations
│   ├── app/
│   │   ├── main.py             # FastAPI app, lifespan, middleware
│   │   ├── config.py           # Settings (pydantic-settings)
│   │   ├── database.py         # SQLAlchemy async engine + session
│   │   ├── dependencies.py     # get_current_user, get_db, require_admin, PaginationParams
│   │   ├── models/             # SQLAlchemy ORM models (18 models)
│   │   ├── schemas/            # Pydantic request/response schemas (16 files)
│   │   ├── routers/            # FastAPI routers (18 route files)
│   │   ├── services/           # Business logic (auth, agent_proxy, ws_manager, workflow_engine, audit, component_seed, variable_resolver, trigger_engine)
│   │   ├── mcp/                # MCP server (FastMCP) + tool implementations
│   │   ├── middleware/         # ASGI middleware (sandbox.py)
│   │   └── utils/              # security.py (JWT, bcrypt)
│   └── tests/
│       ├── conftest.py         # Shared fixtures (in-memory DB, auth_client)
│       ├── test_auth.py
│       ├── test_calendar.py
│       ├── test_notifications.py
│       ├── test_workflows.py
│       ├── test_actions.py
│       ├── test_drafts.py
│       ├── test_users.py
│       ├── test_sessions.py
│       ├── test_templates.py
│       ├── test_sandbox.py
│       ├── test_admin.py
│       ├── test_triggers.py
│       └── test_variable_resolver.py
├── web/                          # Web Admin Panel (Vite + React + TypeScript + Tailwind)
│   ├── src/
│   │   ├── App.tsx               # React Router, auth guard, AdminLayout
│   │   ├── pages/                # Login, Dashboard, Users, Sessions, Audit, Workflows, Templates, Components, Editor, Variables, ActionsTriggersPage
│   │   ├── lib/
│   │   │   ├── api.ts            # Typed fetch wrapper for admin endpoints
│   │   │   ├── sduiAdapter.ts    # Legacy format normalization (Puck conversion removed)
│   │   │   └── utils.ts          # Shared helpers
│   │   ├── editor/               # Custom 3-panel SDUI editor (replaced Puck)
│   │   │   ├── types.ts          # EditorRow/Cell/Screen types, DevicePresets, ComponentRegistry, ActionRule/ActionStep
│   │   │   ├── componentSchemas.ts # Per-component prop schemas for property inspector
│   │   │   ├── useEditorStore.ts # Zustand store — rows, selection, clipboard, undo/redo, updateCellRules
│   │   │   ├── StructureTree.tsx # Left panel — screen structure tree with CRUD
│   │   │   ├── EditorCanvas.tsx  # Center panel — interactive canvas with previews
│   │   │   ├── PropertyInspector.tsx # Right panel — tabbed (Properties/Rules) contextual editor
│   │   │   ├── RuleBuilder.tsx   # Notion-style visual rule builder for action chains
│   │   │   └── ComponentPicker.tsx # Component type selection popover
│   │   ├── stores/authStore.ts   # Zustand auth state
│   │   └── components/           # AdminLayout sidebar + top bar
│   └── vite.config.ts
└── docs/
    ├── codebase-explanation/   # ← AI agents: read this folder first every session
    │   ├── AI-TECHNICAL-REFERENCE.md
    │   ├── OPERATIONS.md
    │   ├── backend.md
    │   ├── frontend.md
    │   ├── protocol.md
    │   └── agents-and-systems.md
    └── Agentic AI Super App — Project Hub/
        └── Blueprint — Production Spec Documents/
            ├── Backend Spec — Python FastAPI Server.md
            ├── Frontend Spec — iOS App (React Native Expo).md
            └── Protocol Spec — Communication Layer.md
```

## Commands

### Frontend
npx expo start              # Dev server with hot reload (QR code for Expo Go on real device)
npx expo start --ios        # iOS simulator (requires Mac + Xcode)
npx expo start --android    # Android emulator (requires Android Studio)
npx expo start --web        # Browser (limited native API support)
npx expo start --tunnel     # Tunnel mode (works across networks, uses ngrok)

### Backend
cd backend && uvicorn app.main:app --reload   # FastAPI dev server
cd backend && pytest                           # Run backend tests (200 tests)

### Web Admin Panel
cd web && npm run dev                          # Vite dev server (usually http://localhost:5174, auto-increments if 5173 is busy)
cd web && npm run build                        # Production build to web/dist/
# Vite dev proxy: /api/* and /auth/* → http://localhost:8000, /ws → ws://localhost:8000 (no CORS in dev)
# Auth: POST /auth/login → {session_token,...} stored as admin_token in localStorage
# ApiClient (web/src/lib/api.ts) injects Authorization: Bearer <token> on every request
# authStore (web/src/stores/authStore.ts, Zustand) holds user state; ProtectedRoute redirects /login if no token
# First-time setup — NO hardcoded defaults. Create admin via:
#   python manage.py create_user --username admin --password yourpassword
#   python manage.py reset_password --username admin

### Standalone Agent
source backend/.venv/bin/activate
cd agent && python helm_agent.py --web            # Web UI at http://localhost:7860
cd agent && python helm_agent.py                  # Interactive REPL
cd agent && python helm_agent.py "Your task"      # One-shot mode

### Build
eas build --platform ios    # Production iOS build (Mac required)

## Coding Conventions

- TypeScript strict mode for all frontend code
- Python type hints everywhere on backend (PydanticAI style)
- Functional components only — no class components in React Native
- Named exports, no default exports
- Small, focused files — one component per file, one route per file
- Meaningful variable and function names — code should read like prose
- Keep functions short. If a function needs a comment explaining what it does, it should be split into smaller functions with descriptive names.

## Code Quality Rules — NON-NEGOTIABLE

### Elegant Code, Not Patches

- **Root cause fixes only.** When something breaks, find WHY it broke. Never apply surface-level patches that mask the real issue. If a fix doesn't address the root cause, it's not a fix — it's technical debt.
- **No garbage patches.** Do not add workarounds, hacks, or "temporary" fixes that pile up. Every change should make the codebase cleaner, not messier. If a fix makes you write `// TODO: fix this properly later`, stop and fix it properly now.
- **Understand before changing.** Before modifying any code, understand the full context — what it does, why it exists, what depends on it. Never change code you don't understand.
- **One fix, one concern.** Each fix should address exactly one issue. Do not bundle unrelated changes together.

### Bug Handling — Reproduce → Fix → Verify Loop

When encountering ANY bug or unexpected behavior, follow this exact loop:

1. **REPRODUCE** — Write a failing test or create a minimal reproduction that demonstrates the bug. If you cannot reproduce it, try harder — check edge cases, race conditions, input variations, environment differences. Do NOT skip to fixing. A bug you can't reproduce is a bug you can't verify you fixed.

2. **DIAGNOSE** — Gather evidence. Read error messages, check logs, trace the execution path. Compare against working cases ("why does X work but Y doesn't?"). Identify the actual root cause, not just the symptom. Use diagnostic commands, not guesses.

3. **FIX** — Address the root cause. The fix should be elegant and minimal — change only what needs to change. If the fix requires restructuring, restructure. Do not patch around the problem.

4. **VERIFY** — Run the reproduction from Step 1. The bug must be gone. Run the full test suite. No regressions. **If the fix doesn't work or introduces new issues, REVERT IT COMPLETELY.** Do not keep a failed fix and pile another fix on top of it. Revert to the clean state, re-diagnose with the new information you learned, and try a different approach. Never stack failed attempts hoping the combination works.

5. **DOCUMENT** — When the fix is confirmed working, document: (a) what the root cause was, (b) why this specific fix resolves it, and (c) why it works (the reasoning, not just "it fixed it"). Add this to the commit message and/or code comments. Future developers (and future Claude) need to understand the WHY.

6. **PREVENT** — If applicable, add a test that would catch this class of bug in the future. Update documentation if the bug reveals a non-obvious behavior.

This loop is mandatory. Never skip steps. Never declare a bug fixed without verification. Never keep failed fixes in the codebase.

### Testing

- Write tests FIRST when fixing bugs (the failing test IS the reproduction)
- Every new feature needs tests — unit tests at minimum, integration tests for API boundaries
- Tests must be meaningful — assert the RIGHT value, not just that something returned
- Run the full test suite before committing. No broken tests in main.

### Code Review Checklist (Self-Check Before Committing)

- [ ] Does this change address the root cause, not a symptom?
- [ ] Could this break anything else? Check downstream dependencies.
- [ ] Are there tests covering the change?
- [ ] Is the code readable without comments? If not, refactor.
- [ ] Is there any duplicated logic that should be extracted?
- [ ] Are error cases handled gracefully?
- [ ] Does the change follow existing patterns in the codebase?

## Documentation Rules

- Every new module/component gets a brief docstring or header comment explaining PURPOSE (why it exists), not just what it does
- Update this CLAUDE.md when project structure changes, new commands are added, or new conventions are established
- Keep a CHANGELOG.md updated with every significant change
- When making architectural decisions, document the WHY in a comment or doc — future you needs to know the reasoning

## Important Rules

- NEVER commit directly to main — always branch and PR
- Keep commits atomic — one logical change per commit
- Commit messages: imperative mood, descriptive ("Add calendar component" not "added stuff")
- No console.log in committed code — use proper logging
- No hardcoded secrets, API keys, or URLs — use environment variables
- When in doubt, check the Blueprint specs in the project docs before making architectural decisions

## Git Commit Standards

After completing a feature, bug fix, or meaningful change, **commit immediately**. Don't batch unrelated work.

### When to Commit
- After a feature is implemented and verified
- After a bug is fixed and tests pass
- After a refactor that leaves the codebase in a clean state
- After documentation updates
- **Never** with failing tests, broken builds, or half-done work

### Commit Message Format
```
<type>: <short imperative description>

<optional body — explain WHY, not WHAT>
```

**Types:** `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `style`

**Examples:**
```
feat: Add calendar event CRUD endpoints
fix: Resolve WebSocket stale-closure in chat handler
refactor: Extract action registry from router to service
docs: Update AI-TECHNICAL-REFERENCE with new MCP tools
test: Add reproduction test for draft publish race condition
chore: Upgrade Expo SDK to 55
```

### Rules
- Run tests before committing — `cd backend && pytest -x -q`
- One logical change per commit
- Reference the issue/task if applicable
- The orchestrator commits after each completed workflow step, not just at the end

## Memory System (Mem0)

Mem0 provides persistent memory across sessions via plugin. Use it to avoid redundant codebase exploration.

### When to Save Memories
- After discovering a non-obvious pattern or gotcha
- After fixing a bug (save the root cause + fix)
- After learning how a module works (save the compressed understanding)
- After making an architectural decision (save the reasoning)

### When to Search Memories
- **Before exploring the codebase** — check if you already know how the relevant code works
- Before starting any task — search for prior context on the same area
- When encountering an error — search for past fixes to similar issues

### Memory Discipline
- Keep memories concise and factual — not raw file dumps
- Tag memories with the area: `[backend]`, `[frontend]`, `[mcp]`, `[editor]`, etc.
- Update memories when code changes invalidate them
- Don't duplicate what's already in `docs/codebase-explanation/`

## Library Documentation (Context7)

Context7 provides up-to-date library documentation. Use it instead of guessing API syntax.

### When to Use
- When writing code that uses an external library (React Native, Expo, FastAPI, SQLAlchemy, Pydantic, etc.)
- When unsure about current API syntax — Context7 has the latest docs
- When the training data might be outdated for a library version

### How to Use
- Add `use context7` to prompts when you need library docs
- Use library IDs for precision: `use context7 with /vercel/next.js`
- Available for 87,000+ libraries

## Development Workflow — Sub-Agent Orchestration

You are the orchestrator. For complex, multi-step tasks (features, bug fixes, audits), delegate to specialist sub-agents rather than doing everything yourself. For simple questions or small edits, handle directly.

### Agent Hierarchy (Flat)

Sub-agents CANNOT spawn other sub-agents in Claude Code. All 16 agents are depth-1 — invoked directly by you.

| Agent | Model | Expertise | Works In |
|-------|-------|-----------|----------|
| `session-init` | haiku | Session folder creation/archiving | `.helm-sessions/` |
| `requirements` | sonnet | Maps tasks to affected files via docs | `docs/` only |
| `due-diligence` | sonnet | Reads source, outputs compressed context | Affected files |
| `planner` | sonnet | Generates implementation plans | Context packages |
| `plan-critic` | sonnet | Challenges plan assumptions via codebase | Affected files (read-only) |
| `protocol-dev` | sonnet | Defines API/WS/MCP contracts | `backend/` + `mobile/` protocol |
| `backend-dev` | sonnet | Python FastAPI implementation | `backend/` only |
| `frontend-dev` | sonnet | React Native / TypeScript + Web admin | `mobile/` + `web/` |
| `agent-dev` | sonnet | PydanticAI + MCP implementation | `agent/` + `backend/app/mcp/` |
| `tester` | sonnet | pytest-asyncio test writing and execution | `backend/tests/` |
| `live-tester` | sonnet | Playwright functional verification | Running app |
| `ui-reviewer` | sonnet | Visual quality review | Running app |
| `reviewer` | sonnet | Code quality gate + feature completeness | Changed files |
| `feature-validator` | sonnet | Blueprint spec feature extraction | `docs/` Blueprint specs |
| `feature-critic` | sonnet | Product completeness GATEKEEPER | Running app + specs |
| `docs-updater` | sonnet | Living documentation maintenance | `docs/` + `CLAUDE.md` |

### Session Management

Sessions use persistent context in `.helm-sessions/current/`.

**New session** (no `.helm-sessions/current/session.md`):
1. Invoke `session-init` to create the session folder
2. Invoke `due-diligence`: "Read docs/codebase-explanation/AI-TECHNICAL-REFERENCE.md and write compressed context to .helm-sessions/current/global-context.md"
3. Accept the user's task

**Resuming session** (session.md exists):
1. Read `.helm-sessions/current/session.md` for in-progress state
2. Check `current-plan.md` — if it exists, a plan is in progress
3. Ask if user wants to resume or start fresh

### Orchestration Principles

- **Delegate, don't do.** For complex tasks, every code reading, investigation, and implementation goes through sub-agents. Your context window is finite — protect it by delegating.
- **Series, not parallel.** Invoke sub-agents ONE AT A TIME. Wait for output before invoking the next.
- **Autonomy over micro-management.** Give agents tasks ("fix the publish endpoint"), not file-level instructions. They explore the codebase themselves.
- **When invoking a sub-agent, always include:**
  - "You CANNOT spawn sub-agents. Do the work yourself."
  - "Check `.helm-sessions/current/global-context.md` for codebase context."
  - The task description + relevant context from previous agents (summaries, not raw files)

### The Workflow

```
User Task → Requirements → Due Diligence
  → [Cross-layer? Protocol-Dev first]
  → Planner → Plan-Critic loop (max 3 rounds)
  → [Bug? Tester writes repro first]
  → Implementer(s) → Tester (verify)
  → Feature-Validator → Reviewer
  → Live-Tester → UI-Reviewer (if UI change)
  → Feature-Critic (GATEKEEPER)
  → Docs-Updater (ALWAYS last)
```

**Adapt per task type:**

| Task Type | Workflow |
|-----------|----------|
| Backend bug fix | requirements → due-diligence → planner → plan-critic → tester (repro) → backend-dev → tester (verify) → feature-validator → reviewer → live-tester → docs-updater |
| Frontend bug fix | requirements → due-diligence → planner → plan-critic → frontend-dev → feature-validator → reviewer → live-tester → ui-reviewer → docs-updater |
| New API endpoint | requirements → due-diligence → protocol-dev → planner → plan-critic → backend-dev → frontend-dev (ApiClient) → tester → feature-validator → reviewer → live-tester → docs-updater |
| New MCP tool | requirements → due-diligence → protocol-dev → planner → plan-critic → backend-dev + agent-dev → tester → feature-validator → reviewer → docs-updater |
| New SDUI component | requirements → due-diligence → protocol-dev (schema) → planner → plan-critic → frontend-dev → feature-validator → reviewer → live-tester → ui-reviewer → docs-updater |
| Agent change | requirements → due-diligence → planner → agent-dev → reviewer → docs-updater |
| Docs-only change | docs-updater |
| Full system audit | due-diligence (feature list) → live-tester (audit all) → fix loop → docs-updater |

### Planning Phase (Critic Loop)

1. Invoke `planner` with task + requirements + due-diligence output → writes to `.helm-sessions/current/current-plan.md`
2. Invoke `plan-critic`: "Challenge this plan against the actual codebase."
3. If objections → invoke `planner` again with critic feedback
4. Repeat until approved or max 3 rounds

### Reviewer Phase (Feature Validation)

1. Invoke `feature-validator`: "Return the complete feature list from Blueprint specs for this area."
2. Invoke `reviewer` with BOTH the implementation summary AND the feature list

### Full-System Audit

1. **Discover:** Invoke `due-diligence` — "List all implemented features and expected behaviors."
2. **Test:** Invoke `live-tester` in audit mode — "Test EVERY feature end-to-end."
3. **Fix loop:** For each issue → invoke appropriate implementer → `live-tester` regression test → repeat until zero issues
4. **Final verification:** One last `live-tester` pass to confirm clean state

### The Completion Loop

After implementation passes `reviewer`:

```
tester (full suite) → PASS
  → feature-validator → reviewer → APPROVE
  → live-tester → PASS
  → ui-reviewer (UI changes only) → APPROVE
  → feature-critic (GATEKEEPER)
      ├── APPROVE → docs-updater → DONE
      └── REJECT  → back to implementers → repeat
```

Max 5 iterations. After 5, escalate to user.

### Context Management

1. **Memory first, files second.** Search Mem0 for prior context before reading source files. Save useful findings to Mem0 after tasks.
2. **Summaries, not files.** Pass sub-agent output, not raw file contents.
3. **Context budget.** Each sub-agent reads ≤5 files. Break large tasks into sub-tasks.
4. **Docs first.** Always start with `requirements` reading `docs/codebase-explanation/`.
5. **Cross-layer protocol.** Invoke `protocol-dev` FIRST for backend+frontend tasks, pass contract to both implementers, `reviewer` validates both sides match.
6. **MCP sync.** When MCP tools change, invoke BOTH `backend-dev` and `agent-dev`. Three files must stay in sync: `tools.py`, `agent_proxy.py` → `_get_tool_definitions()`, `server.py`.
7. **PARTIAL RESULTs.** When a sub-agent returns PARTIAL RESULT with Completed/Remaining lists, re-invoke with the Continuation Prompt. Never skip remaining items.
8. **Question relay.** When a sub-agent returns questions, present them to the user, then re-invoke the sub-agent with answers. Never answer sub-agent questions yourself.
9. **Context7 for library docs.** When sub-agents need current library API syntax, they should use Context7 instead of guessing.

---

## Known Patterns & Gotchas

- **Flat agent hierarchy**: All 16 sub-agents are depth-1. Sub-agents cannot spawn other sub-agents. You (the main conversation) coordinate all loops — plan-critic loop, feature-validator→reviewer handoff, completion loop.
- **Session context**: `.helm-sessions/current/` holds runtime context (global-context.md, current-plan.md, etc.). These are git-ignored. due-diligence writes to them; all agents read from them before exploring source.
- **Feature completeness**: Before `reviewer`, always invoke `feature-validator` first to get the complete feature list from Blueprint specs. Never approve a feature that only has UI but no backing data/actions/dependencies.
- **Plan persistence**: Planner writes to `.helm-sessions/current/current-plan.md`. If the session is interrupted, the plan survives for resumption.
- **Completion loop**: Nothing is done until feature-critic approves. Rejection resets to implementers. Max 5 cycles before escalation to user.
- **Context budget / PARTIAL RESULT**: All sub-agents report PARTIAL RESULT when context runs low, listing completed items and remaining items. Re-invoke with the Continuation Prompt — never skip remaining items.
- **Agent autonomy**: Sub-agents read session files to self-direct. Pass HIGH-LEVEL task + session file pointers — not detailed per-file instructions.
- **Audit results (2026-04-16)**: Backend is production-ready with 200/200 tests passing. Web admin fully functional. Standalone agent has improved error handling but uses `claude-opus-4-20250514` which hits rate limits — should use `claude-sonnet-4-20250514` instead.

## Common Mistakes to Avoid

<!-- Claude: when you make a mistake and get corrected, add it here so you don't repeat it -->
- **Sub-agent spawning sub-agents**: Sub-agents do NOT have the Agent tool. Only the main conversation (you) can invoke agents. If a task requires coordination, you handle it.
- **Parallel sub-agent invocations**: Invoke ONE agent, wait, then invoke the next.
- **Over-specifying sub-agent work**: Don't tell live-tester which screens to click or ui-reviewer which URLs to visit. They read session files and self-direct.
- **Skipping PARTIAL RESULT continuation**: When a sub-agent returns PARTIAL RESULT, re-invoke with the Continuation Prompt. Never skip remaining items and declare the task done.
- **Answering sub-agent questions yourself**: When a sub-agent returns questions, relay them to the user. Never fabricate answers.