# Development Workflow

`helm-orchestrator` executes the canonical loop by default. The same loop scales internally — each step does the minimum needed for the task.

## Canonical Loop

There is exactly one canonical loop:

```
session init → context artifact → plan ↔ plan critic until approved → implementation → QA + review → live test → docs → helm-git
```

The sequence stays the same for all tasks. The depth of each step varies — this is depth calibration, not separate workflow variants:

| Task size | session | context | plan/critic | implementation | QA/review | live test | docs | git |
|-----------|---------|---------|-------------|----------------|-----------|-----------|------|-----|
| Small edit | archive old, init new | minimal | skip | direct edit | skip | skip | skip | helm-git |
| Bug fix | archive old, init new | read relevant area | skip (tester diagnoses) | targeted fix | run failing test | conditional | if behavior changed | helm-git |
| Medium feature | archive old, init new | read docs + affected files | plan → critic (1-2 rounds) | domain specialist | test layer | if UI changed | if API/arch changed | helm-git |
| Large feature | archive old, init new | deep doc reading + code exploration | plan ↔ critic (up to 3 rounds) | multi-layer in order | full suite | browser verification | full docs update | helm-git |

The same loop. The same sequence. Never skip steps out of order — just make each step as shallow or deep as the task requires. There are no separate lite/heavy/super-heavy workflow variants; only one canonical loop.

## Step Details

### 1. Session Init

Delegated to `helm-session-init`. On a new task, this archives the previous `.helm-sessions/current/` to `.helm-sessions/archive/YYYY-MM-DD-HHMMSS-task-slug/` and creates a fresh workspace. On a continuation, it reports what exists.

Artifacts created:
- `.helm-sessions/current/task.md` — task description
- `.helm-sessions/current/context-index.md` — doc references, key files, decisions
- `.helm-sessions/current/current-plan.md` — only when planning begins
- `.helm-sessions/current/critic-report.md` — only when critique begins
- `.helm-sessions/current/verification-report.md` — only when verification begins

### 2. Context Artifact

The orchestrator or implementation agent reads relevant `docs/codebase-explanation/` files. The `context-index.md` is updated with file paths, doc references, and architectural decisions.

### 3. Plan ↔ Plan Critic Until Approved

Delegated to `helm-planner`, which MUST delegate to `helm-plan-critic` for medium/large/risky plans.

1. Planner reads documentation and produces a draft plan → writes to `current-plan.md`.
2. Planner invokes `helm-plan-critic` — a combined targeted explorer + critic that verifies each claim by reading only the exact files/symbols needed.
3. Critic writes findings to `critic-report.md` and returns APPROVED or specific objections.
4. Planner revises the plan for each objection and re-invokes the critic.
5. Max 2 rounds by default; 3rd round only if critic found concrete blocking issue.
6. If unresolved concerns remain after the limit, the planner stops and reports them — it does not force a weak plan. Mark UNRESOLVED.
7. Planner must include a "Scope control" section with in/out of scope, simplest path, and critic status.

Small edits and simple bug fixes skip this step entirely. Tiny docs/config/single-file changes may also skip, but the planner must state the reason explicitly: "Critic skipped: small/single-file change."

For risky bug fixes, cross-layer changes, protocol/API changes, security-sensitive changes, or any plan touching more than one layer, critic is MANDATORY.

For features with blueprint specs, the planner must derive a requirements checklist from the user request, relevant feature feedback docs, and blueprint specs. The plan-critic must verify the plan against this checklist.

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
- **UI/visual review**: delegate to `helm-ui-reviewer` for all UI-visible changes — this is no longer rare, it runs automatically for any UI change.
- **QA suite**: `cd qa && npm run test:backend` for API changes; `cd qa && npm run test:e2e` for visible UI changes (triage stale selectors)
- **React components/hooks changed** — run React Doctor diagnostics (see verification.md)
- **Feature-level change** — verify implementation against `requirements-checklist.md`

For UI-visible changes, the standard QA flow is:
1. `helm-tester` runs automated/live e2e checks.
2. `helm-ui-reviewer` performs visual/UX review and exhaustive page sweep for substantial UI pages.
3. Issues found are handed back to the implementation agent.
4. Re-test after fixes.

### 6. Live Test

Only when UI is visibly changed. Start dev server and verify in a real browser or simulator. Do not skip for visual changes — check the golden path and edge cases.

Live testing is handled by `helm-tester` (automated e2e/smoke checks) and complemented by `helm-ui-reviewer` (visual/UX review and exhaustive page sweep).

### 7. Docs

Only when behavior, API contracts, architecture, or commands have changed. Delegate to `helm-docs`.

### 8. helm-git

Delegate to `helm-git` (requires user approval via `ask`). `helm-git` is the canonical final stage — it handles branch safety, diff review, verification, commit, and push.

`/helm-ship` may remain as an optional shortcut command for when Barry already knows the work is ready, but the canonical pipeline documentation refers to `helm-git`.

- Atomic commits — one logical change per commit
- Imperative mood: `"Add calendar endpoint"` not `"Added calendar endpoint"`
- Never commit failing tests or broken builds
- Never commit directly to `main`

## Failure Handling Inside the Loop

When QA, live-test, or review finds an issue within the loop:

0. **Check requirements-checklist** — is the expected behavior actually specified?
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

### Orchestrator Autonomy

The orchestrator is autonomous by default. It does NOT stop to ask Barry routine questions:

- It decides which agent to delegate to next without asking.
- It continues after subagents return without asking "should I continue?"
- It runs verification automatically when needed.
- It delegates to docs agent automatically when behavior/API/commands changed.
- It delegates to git agent at the end automatically.

The orchestrator only asks Barry when:
- The requested behavior is genuinely ambiguous.
- The change requires product/design judgment.
- Subagents found destructive/risky actions (data loss, schema migration with data loss, auth changes).
- Repo/docs directly contradict each other.

When asking is unavoidable, the orchestrator asks ONE compact question with a recommended default.

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
| `helm-ui-reviewer` | **No** | Reviews screenshots/layout, UX consistency, exhaustive page sweep. Reports blocking vs polish issues. |
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

## Exhaustive Page Sweep

Exhaustive page sweep is a mode/workflow, not a separate agent. It is the fallback/complement to automated QA for significant UI testing.

### Trigger conditions:
- Barry asks for exhaustive testing.
- A UI-visible page changed significantly.
- The affected page is a central page (dashboard, editor, preview, templates, workflows, auth, settings, module builder).
- Automated QA is unavailable, stale, flaky, or too narrow.
- A bug report says "this page has problems" or "find all errors on this page."
- Before shipping a UI-heavy feature.

### What it covers:
- Load the affected page from a clean state.
- Check browser console errors and warnings, network failures, 4xx/5xx responses.
- Verify initial render does not crash.
- Check loading, empty, and error states.
- Click every visible primary and safe secondary action.
- Open and close modals, drawers, dropdowns, popovers, tabs, accordions, sidebars, and menus.
- Test form validation (required fields, invalid values, empty submission).
- Test navigation links and back/forward/refresh behavior.
- Test responsive layout at desktop, tablet, and mobile widths.
- Check for overflowing text, broken alignment, invisible buttons, duplicate scrollbars, clipped content.
- Check keyboard basics: tab order, Enter/Escape, focus visibility.
- Check auth/permission boundaries and data persistence after save/refresh.
- Check that preview/rendered output matches source state.
- Check that no destructive action is performed without confirmation.

### Who runs it:
- `helm-ui-reviewer` for visual/UX inspection.
- `helm-tester` for browser/test execution.
- Both are complementary — they are NOT merged roles.

### Output format:
Issues are classified by severity:
- **Blocking:** page crash, data loss, save broken, auth/security issue, primary user flow impossible.
- **Major:** important interaction broken, incorrect data shown, layout makes feature hard to use.
- **Minor:** visual polish, small alignment issue, non-blocking copy/spacing problem.
- **Stale QA:** automated test failure caused by outdated selector/test assumption rather than app regression.

## Legacy: Full Claude Code Mega-Loop

The original 16-agent pipeline (Requirements → Due Diligence → Plan → Plan-Critic → Implement → Tester → Live-Test → Feature-Validator → Reviewer → Feature-Critic → Docs-Updater) is **legacy**. It was Claude Code-specific and ran all agents regardless of task size. The single canonical loop above replaces it.

The legacy agent definitions remain in `.claude/agents/` for Claude Code sessions. They are not portable to OpenCode.

## MCP Guidance

- **Context7** (MCP): Allowed for docs/library lookup by planner, docs, or critic if needed. NOT called by orchestrator.
- **Playwright** (MCP): Allowed for tester, ui-reviewer, and live verification. NOT called by orchestrator.
- Keep API keys and env values out of the repo. They are user-managed.
