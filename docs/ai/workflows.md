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

**Blind review rule:** When delegating to helm-reviewer or helm-ui-reviewer, the orchestrator and subagents MUST NOT include leading/status-biased framing. Forbidden phrases: "final review", "third pass" / "second pass" / "Nth pass", "confirm all issues resolved", "should be fixed now", "mostly done", "just verify", "previous reviewer approved", or any phrase implying expected outcome or pass count. Allowed contents only: task description, requirements ledger, changed files list, verification evidence, acceptance criteria. The orchestrator may track pass count internally but must NOT reveal it to reviewer agents.

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

**Completion contract:** A task is not complete until one of these is true:
1. Changes are committed and pushed to the correct branch.
2. No changes were needed and the no-op is explicitly reported.
3. A valid blocker prevents completion (documented).

The final response MUST include:
```
Branch: <branch-name>
Commit: <commit-hash or "none">
Pushed: yes/no
Remaining blockers: <list or "none">
```
If Pushed is no, explain why.

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

### Retry/Fix Loop Budget

For review/QA failures inside scope:
- Reproduce or inspect evidence → diagnose root cause → fix → verify → blind review again.
- Do not stack blind patches — each fix must address root cause.
- If an attempted fix fails, revert that fix and try a root-cause-based alternative.
- **After 3 failed attempts on the same issue**, stop with **BLOCKED** status.
- Produce a concise blocker report with:
  - The REQ-ID or issue reference
  - What was attempted (3 distinct approaches)
  - Why each attempt failed
  - What is needed to unblock
- Do not silently abandon the issue.

The failure handling is inside the loop. Reproduce → diagnose → fix → verify, then continue the loop from where it was interrupted.

## Agent Handoff Model

Specialist agents are advisory by default. They produce findings — the orchestrator decides what to act on.

### Orchestrator Autonomy

The orchestrator is autonomous by default and operates in **continue-until-complete** mode. It does NOT stop to ask Barry routine questions:

- It decides which agent to delegate to next without asking.
- It continues after subagents return without asking "should I continue?"
- It runs verification automatically when needed.
- If QA/review finds issues inside the requested scope, it keeps fixing automatically — it does not ask "should I continue fixing?"
- It delegates to docs agent automatically when behavior/API/commands changed.
- It delegates to git agent at the end automatically.

The orchestrator only asks Barry when:
1. Product ambiguity not resolved by source docs.
2. Scope expansion beyond the requested task.
3. Destructive or irreversible actions (data loss, schema migration with data loss, auth changes).
4. Secrets, credentials, or private data not already configured.
5. Paid/external service usage.
6. Non-trivial branch/merge conflict.
7. Repeated failure after documented retry budget (3 attempts).

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

The `qa/` directory contains the repo's deterministic test and discovery suite built on Playwright. "QA" in this project refers to these concrete scripts and tests — not an autonomous judge or magic verification layer. It is **early-stage** — backend tests are functional, e2e selectors have known staleness. Triage failures rather than blindly treating them as regressions.

**Important boundaries:**
- `helm-tester` runs and interprets QA evidence — it does NOT decide product completeness.
- `helm-reviewer` checks product completeness against requirements and QA evidence.
- Existing QA scripts are structural/discovery layers — they catch what they were designed to catch, not all product requirements.
- A task must not be considered complete just because existing QA scripts pass.
- QA is NOT an autonomous sub-agent or magic product verification gate. It is deterministic scripts and tests that produce evidence.

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

## Feature Feedback / Product-Spec Workflow

This section applies when working from Feature Feedback documents, product specs, blueprint documents, or any large unstructured requirement source. It extends the canonical loop with traceability guarantees.

### Core Principle

**Never let an AI summary become the canonical source of truth.** Summaries are lossy by nature — an AI reading a 50-page FF document and summarizing it into 3 paragraphs loses nuance, edge cases, conditionals, and context. When a planner then implements from that summary, requirements silently drop.

For FF/product-spec work, the canonical source of truth is:
1. The **original full document** (never a paraphrase or summary)
2. The **traceable requirements ledger** (atomic, ID'd, and directly sourced from the original)

Summaries are navigation aids only — never implementation specs.

### Additional Session Artifacts

For FF sessions, `helm-session-init` initializes these additional artifacts in `.helm-sessions/current/`:

| Artifact | Purpose |
|----------|---------|
| `source-index.md` | Maps each source document (page, section) to the requirement IDs it generates |
| `requirements-ledger.md` | Atomic table: every individual requirement as a row with full traceability |
| `requirements-audit.md` | Flags MISSING, AMBIGUOUS, DUPLICATE, NEEDS_CONTEXT, INSUFFICIENT_AC requirements |
| `implementation-slices.md` | Cohesive groups of REQ-IDs with dependency ordering |
| `qa-plan.md` | Per-requirement QA coverage classification (automated-test, manual-flow-test, review-only, not-covered, or deferred) with concrete checks per REQ-ID |
| `product-completeness-matrix.md` | REQ-ID → PASS/FAIL/PARTIAL/NOT_TESTED verdict (primary reviewer output) |
| `coverage-gate.md` | Summary gate: must-have requirements must all be PASS before shipping |

### Workflow Extension

For FF/product-spec work, the canonical loop extends to:

```
session init → requirements auditor (ledger + audit + slices) → plan (REQ-ID referenced)
→ plan critic (ledger-based) → implementation (slice-claimed) → requirement-derived QA
→ product completeness review → coverage gate → docs → git
```

Each step:

1. **Session init** — `helm-session-init` archives stale sessions and initializes all FF artifacts (including stubs for source-index, ledger, audit, slices, qa-plan, matrix, coverage-gate).

2. **Requirements auditor** — `helm-requirements-auditor` reads **full source documents** (never summaries), atomizes every requirement into the ledger, audits for gaps, and produces implementation slices. Must return APPROVED before planning begins.

3. **Plan (REQ-ID referenced)** — Planner references REQ-IDs, not paraphrases. Lists included and excluded REQ-IDs explicitly. Does not proceed without APPROVED ledger.

4. **Plan critic (ledger-based)** — Critic validates the plan against the ledger. Rejects plans that paraphrase requirements or omit REQ-IDs.

5. **Implementation (slice-claimed)** — Each implementation agent claims **one slice** from `implementation-slices.md` and implements only those REQ-IDs. Updates evidence per REQ-ID. No broad "all FF is fixed" claims.

6. **Requirement-derived QA** — Tester classifies every in-scope must-have REQ-ID by QA coverage mode (automated-test, manual-flow-test, review-only, not-covered, or deferred). Produces `qa-plan.md` with concrete checks per REQ-ID. Passing existing `qa/` scripts is not sufficient if must-have requirements are uncovered.

7. **Product completeness review** — Reviewer produces `product-completeness-matrix.md` (PASS/FAIL/PARTIAL/NOT_TESTED per REQ-ID) and `coverage-gate.md`. Product completeness is the **primary** review concern — code quality is secondary for FF work.

8. **Coverage gate** — Coverage gate must be OPEN before shipping. CLOSED gate = cannot ship. Coverage gate is CLOSED when must-have REQ-IDs are `not-covered` without explicit deferral reason.

9. **Docs + Git** — Standard docs update and git stage.

### Requirements Ledger Format

The ledger is a markdown table with the following columns:

| Column | Description |
|--------|-------------|
| REQ ID | Unique identifier (e.g., `FF4-DASH-001`) |
| Source doc/page | Which document and page number the requirement came from |
| Source section/path | Section heading, paragraph, or bullet point in the source |
| Context notes | Surrounding context needed to understand the requirement correctly |
| Expanded contextual requirement | The full requirement written as an atomic, testable statement |
| Type | `functional` / `UI` / `data` / `validation` / `workflow` / `QA` / `docs` / `architecture` |
| Priority | `must` / `should` / `could` / `deferred` |
| Acceptance criteria | Concrete pass/fail criteria in Given-When-Then or checklist form |
| QA mode | `automated-test` / `manual-flow-test` / `review-only` / `not-covered` / `deferred` |
| Slice ID | Which implementation slice this requirement belongs to |

The ledger is the authoritative requirements source for the entire FF session. All plans, tests, and reviews reference REQ-IDs from this table.

### Implementation Slices

The auditor groups requirements into **domain-cohesive slices** — groups of related REQ-IDs that share a feature area, data model, or user flow. Each slice:

- Has a unique Slice ID and description
- Lists the REQ-IDs it contains
- States dependencies on other slices (if any)
- Is ordered for implementation

Each implementation agent claims **one slice** and implements only those REQ-IDs. This prevents the "I fixed all FF" anti-pattern where an agent claims completion but only addressed a subset. After a slice is implemented, the agent updates evidence in the ledger (linking to files, commits, test names).

### Coverage Gate

Before shipping FF work, `coverage-gate.md` is produced by the reviewer. It:

- Lists every `must`-priority REQ-ID
- Shows the verdict from `product-completeness-matrix.md` (PASS / FAIL / PARTIAL / NOT TESTED)
- Marks the gate as **OPEN** (all must-haves PASS) or **CLOSED** (one or more must-haves not PASS)
- For non-must requirements (`should`, `could`, `deferred`), notes status but does not block the gate

**CLOSED gate = cannot ship.** The orchestrator must delegate fixes or defer missing requirements (with explicit approval) before reopening.

### Existing requirements-checklist.md Status

For FF/product-spec work, `requirements-checklist.md` is **downgraded** to a short checklist derived from the ledger. It is NOT the canonical source. The ledger IS the canonical source. The reviewer may generate `requirements-checklist.md` from the ledger as a convenience view, but all traceability decisions reference the ledger.

### Industry Basis

These practices are not new — they are established industry techniques applied to AI-assisted development:

- **Requirements Traceability Matrix (RTM):** Every requirement maps to implementation and test evidence. The ledger is Helm's RTM, ensuring no requirement is lost between source document and shipped code.

- **BDD / Given-When-Then:** Acceptance criteria in the ledger are written as scenario-oriented conditions, enabling direct translation into automated tests or manual check scripts.

- **E2E / user journey testing:** QA exercises realistic multi-step workflows, not isolated unit checks. Round-trip tests (create → read → update → delete) and save/reload persistence checks catch integration gaps.

- **Playwright best practices:** Tests use resilient user-facing locators (`getByRole`, `getByLabel`, `getByText`), codegen for fast authoring, and trace viewer for failure diagnosis. Avoid fragile CSS/XPath selectors.

- **Reality of "smart QA":** There is no magic one-button QA solution. "Smart QA" is a layered system: structural discovery (`discover.cjs`) + deterministic E2E tests + BDD scenario checks + manual test scripts + traceability review. Each layer catches different failure modes; no single layer is sufficient.
