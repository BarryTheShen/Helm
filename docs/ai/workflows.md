# Development Workflow

Choose the workflow that matches the task size. There is no mandatory mega-loop — the workflow scales with the task. The large feature pipeline is **exceptional**, reserved for cross-layer features that touch multiple modules.

## Task-Size Workflows

### Small Edit (docs, config, single-file fix)

1. Understand the change needed.
2. Make the edit.
3. Run the relevant check for the layer touched (see `docs/ai/verification.md`).
4. Self-review: does it address the issue? Any obvious regressions?

**Commands:** `/helm-docs` (if docs-only), or edit directly with self-review.

### Bug Fix

1. **Reproduce** — Write a failing test or minimal reproduction. If you can't reproduce it, try harder.
2. **Diagnose** — Trace execution path. Read error messages. Compare against working cases.
3. **Fix** — Minimal change addressing root cause. No surface-level patches.
4. **Verify** — Run reproduction + relevant test suite.
5. **Prevent** — Add a regression test if useful.

If the approach is wrong, revert. If verification reveals a small localized mistake, fix it once. Do not stack blind patches.

**Command:** `/helm-bug`

### Medium Feature (new endpoint, component, page)

1. **Plan** — Brief plan of affected files and changes via `/helm-plan`.
2. **Implement** — Use `/helm-api` (backend), `/helm-ui` (frontend), or `/helm-mcp` (agent tools).
3. **Test** — Relevant tests for the layer changed. Use `helm-tester` agent for coverage.
4. **Review** — Run `/helm-review` to check quality and completeness.
5. **Docs** — Update docs only if behavior, API, or architecture changes. Use `/helm-docs`.

**Commands:** `/helm-plan` → `/helm-api` or `/helm-ui` → `helm-tester` (agent) → `/helm-review`

### Large Feature (cross-layer, multiple modules) — EXCEPTIONAL

This pipeline is reserved for features that span multiple layers (backend + frontend + mobile), introduce new architecture, or have significant compliance/security requirements. Do not use this for routine work.

1. **Research** — Read relevant docs, understand existing patterns. Use `/helm-plan` for due diligence.
2. **Plan** — Detailed plan with affected files, dependency order.
3. **Plan Critic** — Challenge assumptions against the actual codebase. Re-read the plan with fresh eyes: wrong assumptions? Missing dependencies? Unconsidered edge cases?
4. **Implement** — Build in dependency order. Use `/helm-api`, `/helm-ui`, `/helm-mcp` as needed.
5. **Protocol Check** — If API/WebSocket/MCP contracts change, use `/helm-api` protocol-first guidance (or `helm-protocol` agent) BEFORE implementing the frontend side.
6. **Test** — Full test suite for all layers touched.
7. **Live-Test** — If UI is visibly changed, run Playwright/browser verification. This is **conditional** — not every feature needs a browser.
8. **QA Discovery** — Run the QA suite to check for drift (see QA Discovery System below).
9. **Review** — Run `/helm-review`. Additionally, check against the large-feature checklist below.
10. **Docs** — Update architecture docs, API contracts, living docs.

**Large-Feature Checklist** (replaces the legacy `feature-critic` and `feature-validator` agents):

- [ ] Does this match the blueprint spec requirements? Check `docs/Agentic AI Super App — Project Hub/Blueprint — Production Spec Documents/`.
- [ ] Is the feature complete from a user's perspective? All happy paths work?
- [ ] Are edge cases handled: auth failures, network errors, empty states?
- [ ] Does the UI match the intended design on both web and mobile?
- [ ] Are all API contracts consistent between backend and frontend?
- [ ] Has the feature been tested in a real browser/device, not just unit tests?

## Code Review Self-Check

Use this for medium and small tasks. The large-feature checklist above supersedes it for large features.

- [ ] Does this address the root cause, not a symptom?
- [ ] Could this break downstream dependencies?
- [ ] Are there tests covering the change?
- [ ] Is the code readable without comments?
- [ ] Any duplicated logic to extract?
- [ ] Are error cases handled?
- [ ] Does it follow existing patterns?

## Verification Modes

These are **conditional**, not always-on. Invoke only when the work warrants them:

| Mode | When |
|------|------|
| `helm-tester` (agent) | Any feature needing new test coverage |
| `/helm-review` | Medium and large features; or when second eyes are needed |
| `helm-protocol` (agent) | When API/WS/MCP/SDUI contracts change — run BEFORE frontend implementation |
| UI live-test | Only when the UI is visibly changed — start dev server, verify in browser |
| QA discovery | Before/after medium+ changes, PR readiness, drift detection — see below |

## QA Discovery System

The `qa/` directory contains an automatic bug discovery and test suite built on Playwright. It is **early-stage** — backend tests are functional, e2e selectors have known staleness. Triage failures rather than blindly treating them as regressions.

### What It Does

- **`qa/src/discover.cjs`** — Auto-discovers backend endpoints (from OpenAPI spec), web routes, action registry entries, component registry, and templates. Outputs `qa/src/discovered.json`. This is **discovery/sanity infrastructure**, not a replacement for tests.
- **`backend-only` project** — API-level tests (endpoint health, schema checks, auth flows).
- **`e2e` project** — Browser tests against the web admin. Some selectors are stale and need fixes.

### When to Use

- **Before/after medium or large changes** to backend or UI — run discovery to catch drift.
- **When checking for drift** in endpoints, routes, action registry, components, or templates.
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

The original 16-agent pipeline (Requirements → Due Diligence → Plan → Plan-Critic → Implement → Tester → Live-Test → Feature-Validator → Reviewer → Feature-Critic → Docs-Updater) is **no longer the default**. It was Claude Code-specific and ran all agents regardless of task size. The workflows above replace it with conditional, task-sized pipelines.

The legacy agent definitions remain in `.claude/agents/` for Claude Code sessions. They are not portable to OpenCode.

## Commit Discipline

- Atomic commits — one logical change per commit
- Imperative mood: `"Add calendar endpoint"` not `"Added calendar endpoint"`
- Run `cd backend && pytest -q` before committing backend changes
- Run `cd web && npm run lint` before committing web changes
- Never commit failing tests or broken builds
- Never commit to `main` directly
- Ship with `/helm-ship`
