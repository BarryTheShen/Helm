# Development Workflow

`helm-orchestrator` executes the canonical loop by default. The same loop scales internally — each step does the minimum needed for the task.

## Canonical Loop

There is exactly one canonical loop:

```
session init → context artifact → plan ↔ plan critic until approved → implementation → QA + review → live test → docs → git commit
```

The sequence stays the same for all tasks. The depth of each step varies:

| Task size | session | context | plan/critic | implementation | QA/review | live test | docs | git |
|-----------|---------|---------|-------------|----------------|-----------|-----------|------|-----|
| Small edit | archive old, init new | minimal | skip | direct edit | skip | skip | skip | commit |
| Bug fix | archive old, init new | read relevant area | skip (tester diagnoses) | targeted fix | run failing test | conditional | if behavior changed | commit |
| Medium feature | archive old, init new | read docs + affected files | plan → critic (1-2 rounds) | domain specialist | test layer | if UI changed | if API/arch changed | commit |
| Large feature | archive old, init new | deep doc reading + code exploration | plan ↔ critic (up to 3 rounds) | multi-layer in order | full suite | browser verification | full docs update | commit |

The same loop. The same sequence. Never skip steps out of order — just make each step as shallow or deep as the task requires.

## Step Details

### 1. Session Init

Delegated to `helm-session-init`. On a new task, this archives the previous `.helm-sessions/current/` to `.helm-sessions/archive/<timestamp>-<slug>/` and creates a fresh workspace. On a continuation, it reports what exists.

Artifacts created:
- `.helm-sessions/current/task.md` — task description
- `.helm-sessions/current/context-index.md` — doc references, key files, decisions
- `.helm-sessions/current/current-plan.md` — only when planning begins
- `.helm-sessions/current/critic-report.md` — only when critique begins
- `.helm-sessions/current/verification-report.md` — only when verification begins

### 2. Context Artifact

The orchestrator or implementation agent reads relevant `docs/codebase-explanation/` files. The `context-index.md` is updated with file paths, doc references, and architectural decisions.

### 3. Plan ↔ Plan Critic Until Approved

Delegated to `helm-planner`, which may delegate to `helm-plan-critic`.

1. Planner reads documentation and produces a draft plan → writes to `current-plan.md`.
2. Planner invokes `helm-plan-critic` — a combined targeted explorer + critic that verifies each claim by reading only the exact files/symbols needed.
3. Critic writes findings to `critic-report.md` and returns APPROVED or specific objections.
4. Planner revises the plan for each objection and re-invokes the critic.
5. Max 3 rounds unless Barry explicitly asks for more.
6. If unresolved concerns remain after 3 rounds, the planner stops and reports them — it does not force a weak plan.

Small edits and simple bug fixes skip this step entirely.

### 4. Implementation

The appropriate domain specialist (or `helm-build` for cross-layer work) implements the plan. Changes are made in dependency order. Each commit is one logical change.

Protocol-first rule: if API/WebSocket/MCP/SDUI contracts change, delegate to `helm-protocol` BEFORE implementing the frontend side.

### 5. QA + Review

Conditional — run only what the task warrants:
- **Backend code changed**: `cd backend && pytest -q`
- **Web code changed**: `cd web && npm run lint` (build if types changed)
- **Mobile code changed**: `cd mobile && npx expo start` smoke check
- **New test coverage needed**: delegate to `helm-tester`
- **Code quality review**: delegate to `helm-reviewer` for medium/large/risky changes
- **Security review**: delegate to `helm-security` (requires user approval)
- **QA suite**: `cd qa && npm run test:backend` for API changes; `cd qa && npm run test:e2e` for visible UI changes (triage stale selectors)

### 6. Live Test

Only when UI is visibly changed. Start dev server and verify in a real browser or simulator. Do not skip for visual changes — check the golden path and edge cases.

### 7. Docs

Only when behavior, API contracts, architecture, or commands have changed. Delegate to `helm-docs`.

### 8. Git Commit

Delegate to `helm-git` (requires user approval via `ask`).

- Atomic commits — one logical change per commit
- Imperative mood: `"Add calendar endpoint"` not `"Added calendar endpoint"`
- Never commit failing tests or broken builds
- Never commit directly to `main`

## Failure Handling Inside the Loop

When QA, live-test, or review finds an issue within the loop:

1. **Reproduce** the error — write a failing test or minimal reproduction. If you can't reproduce it, try harder.
2. **Diagnose** — trace execution path, read error messages. Identify the root cause, not the symptom.
3. **Fix** — minimal change addressing root cause. No surface-level patches.
4. **Verify** — run reproduction + relevant test suite.

**Revert discipline:**
- If the approach is wrong, revert the fix completely.
- If verification reveals a small localized mistake, fix it once — do not stack blind patches.
- If a fix does not work, revert that fix and try another root-cause-based approach.

The failure handling is inside the loop. Reproduce → diagnose → fix → verify, then continue the loop from where it was interrupted.

## Agent Handoff Model

Specialist agents are advisory by default. They produce findings — the orchestrator decides what to act on.

### Standard Handoff Flow

1. **Specialist identifies issue** → reports finding (file path, line number, diagnosis, severity)
2. **Orchestrator reads finding** → decides if fix is needed
3. **Orchestrator delegates fix** → to appropriate implementation agent (build, backend, frontend, agent-runtime)
4. **Implementation agent applies fix** → verifies proportionally
5. **Tester verifies** (if behavior changed) → confirms fix or reports new failure
6. **Reviewer checks** (if change is risky) → final quality gate

### Who fixes what

| Agent | Fixes code? | Default behavior |
|-------|------------|-----------------|
| `helm-tester` | **No** | Runs tests, diagnoses failures, recommends fixes. Hands implementation back to build/backend/frontend. |
| `helm-reviewer` | **No** | Reviews code, reports findings grouped by severity. Suggests patches in prose only. |
| `helm-security` | **No** | Audits for secrets/auth/injection issues. Reports findings. |
| `helm-ui-reviewer` | **No** | Reviews screenshots/layout. Reports blocking vs polish issues. |
| `helm-git` | **No** | Handles branch/commit/push. Does not modify source files. |
| `helm-build` | **Yes** | General implementation worker. Applies fixes after reading specialist findings. |
| `helm-backend` | **Yes** (backend/) | Backend specialist. Edits backend files when invoked for implementation. |
| `helm-frontend` | **Yes** (mobile/, web/) | Frontend specialist. Edits frontend files when invoked for implementation. |
| `helm-agent-runtime` | **Yes** (agent/, mcp/) | Agent runtime specialist. Edits agent/MCP files when invoked. |

### Depth Policy

- Orchestrator delegates to depth-1 agents (session-init, planner, build, backend, frontend, tester, etc.)
- Planner may delegate only to plan-critic
- Plan-critic is a leaf node — cannot spawn any subagents
- All domain specialists (build, backend, frontend, agent-runtime) are leaf nodes for execution

### Anti-patterns

- **Tester fixing code:** The tester must NOT become a general implementation agent. If tests fail, it diagnoses and hands back.
- **Reviewer applying patches:** The reviewer must NOT edit files. It reports findings; the orchestrator delegates fixes.
- **Security adding credentials:** The security agent must NOT add secrets or provider defaults.
- **Orchestrator doing groundwork:** The orchestrator must NOT read source files, write code, or run tests. It delegates.
- **Planner broad-exploring:** The planner should not broadly explore the codebase itself. It delegates verification to plan-critic.

## QA Discovery System

The `qa/` directory contains an automatic bug discovery and test suite built on Playwright. It is **early-stage** — backend tests are functional, e2e selectors have known staleness. Triage failures rather than blindly treating them as regressions.

### What It Does

- **`qa/src/discover.cjs`** — Auto-discovers backend endpoints (from OpenAPI spec), web routes, action registry entries, component registry, and templates. Outputs `qa/src/discovered.json`. This is **discovery/sanity infrastructure**, not a replacement for tests.
- **`backend-only` project** — API-level tests (endpoint health, schema checks, auth flows).
- **`e2e` project** — Browser tests against the web admin. Some selectors are stale and need fixes.

### When to Use

- **Before/after medium or large changes** to backend or UI — run discovery to catch drift.
- **During final PR readiness** — run the appropriate project to verify.
- **Not for tiny docs-only edits** — skip QA for documentation or configuration changes.

### Commands

| Command | When |
|---------|------|
| `cd qa && npm run test:backend` | API-only checks; run after backend endpoint or schema changes |
| `cd qa && npm run test:e2e` | Browser e2e; run when visible web UI behavior changed |
| `cd qa && npm test` | Full Playwright suite; use for large features or PR readiness |
| `cd qa && bash run.sh` | Full QA pipeline (backend pytest + Playwright); use for final verification |

### Caveats

- E2e tests have **known stale selectors** — a failure may mean the selector needs updating, not that the app is broken.
- The discovery script requires a running backend (`localhost:8000`) to fetch the OpenAPI spec and component registry.
- Backend pytest must pass before running the full QA pipeline.

## Legacy: Full Claude Code Mega-Loop

The original 16-agent pipeline (Requirements → Due Diligence → Plan → Plan-Critic → Implement → Tester → Live-Test → Feature-Validator → Reviewer → Feature-Critic → Docs-Updater) is **legacy**. It was Claude Code-specific and ran all agents regardless of task size. The single canonical loop above replaces it.

The legacy agent definitions remain in `.claude/agents/` for Claude Code sessions. They are not portable to OpenCode.

## MCP Guidance

- **Context7** (MCP): Allowed for docs/library lookup by planner, docs, or critic if needed. NOT called by orchestrator.
- **Playwright** (MCP): Allowed for tester, ui-reviewer, and live verification. NOT called by orchestrator.
- Keep API keys and env values out of the repo. They are user-managed.
