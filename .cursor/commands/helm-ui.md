# /helm-ui

> This command is an optional shortcut. The default path is to ask `helm-orchestrator` normally — it will route to the right subagents. Use this command when you already know the scope is UI-focused.

Work on the following UI change: $ARGUMENTS

## What It Does

1. Consult `docs/codebase-explanation/frontend.md` for navigation, state management, and SDUI patterns.
2. Implement the UI change following existing component patterns and design system.
3. Web admin: `cd web && npm run dev` to verify. TypeScript strict mode.
4. Mobile: `npx expo start` to verify.

### Conditional Verification

- **UI visibly changed?** Start the dev server and test in a real browser/simulator. Check the golden path and edge cases. Visual correctness matters — don't just check that TypeScript compiles. When web UI behavior changed, also run `cd qa && npm run test:e2e` (note: e2e has known stale selectors — triage failures).
- **React components changed?** Run `npx -y react-doctor@latest . --diff origin/modernize/import-libraries --offline --json` to check for hook rule violations, stale closures, and render issues.
- **UI not visibly changed** (e.g., internal refactor, type-only change)? Run `cd web && npm run lint` — no browser needed.

### Visual Review

For visual/screenshot review, delegate to `helm-ui-reviewer`. It is a visual/UI review specialist that reviews screenshots, layout, visual regressions, and performs exhaustive page sweeps for substantial UI pages.

UI review runs automatically for all UI-visible changes — it is no longer rare. The standard flow is:
1. Implementation → tester live/e2e check → UI reviewer visual/exhaustive sweep → fix issues → re-test.

### Feature Feedback / Product-Spec Mode

When `$ARGUMENTS` involves UI work driven by a Feature Feedback document or product spec:

- **Requirement ID references required** — UI implementation must reference REQ-IDs from `.helm-sessions/current/requirements-ledger.md`. Each UI change should map to specific requirement IDs.
- **QA mode determines test depth** — If a REQ-ID has QA mode `automated-test`, write automated Playwright/pytest tests. If `manual-flow-test`, produce a manual test script. If `review-only`, code inspection is sufficient.
- **Acceptance criteria as checklist** — `helm-ui-reviewer` uses the ledger's acceptance criteria as the visual/UX review checklist.
- **Workflow-aware QA** — Test realistic multi-step user journeys (not just static page inspection): login → navigate → perform action → verify result. Test round trips (create → edit → delete), save/reload persistence, and preview/publish propagation.
- **Original complaint reproduction** — If fixing a bug from Feature Feedback, reproduce the original complaint (with `helm-tester`) before implementing. Verify the fix resolves the original issue AND passes acceptance criteria.

### Exhaustive Page Sweep

For significant UI pages (dashboard, editor, preview, templates, etc.), `helm-ui-reviewer` performs an exhaustive page sweep covering:
- Console errors, network failures, 4xx/5xx responses
- Loading, empty, and error states
- All interactions (buttons, modals, drawers, dropdowns, tabs, menus, forms)
- Navigation, back/forward/refresh behavior
- Responsive layout at multiple widths
- Keyboard basics, auth boundaries, data persistence

See `docs/ai/workflows.md` for the full exhaustive page sweep policy.

## Rules

- Web admin lives in `web/`. Mobile lives in `mobile/`.
- Functional components only. Named exports, no default exports.
- Use existing stores (Zustand) — don't create new global state unless necessary.
- If the UI change requires a new API endpoint or schema change, note it for `/helm-api` follow-up.

## Agent roles in this workflow
- **helm-frontend**: Owns implementation. Edits mobile/web files.
- **helm-protocol** (optional): Advises if API contracts are affected. Read-only unless explicitly asked.
- **helm-ui-reviewer** (automatic for UI changes): Visual review, exhaustive page sweep, layout consistency. Read-only.
- **helm-tester** (optional): Runs automated e2e/live checks after implementation. Returns results — does NOT fix.
- **helm-reviewer** (optional): Reviews code quality. Read-only.
- For features with blueprint specs, ensure `.helm-sessions/current/requirements-checklist.md` is populated and reviewed.

Implementation agent owns edits. Specialist agents advise and verify.
