---
description: Work on web admin or mobile UI with conditional testing
agent: helm-frontend
---

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
- **UI not visibly changed** (e.g., internal refactor, type-only change)? Run `cd web && npm run lint` — no browser needed.

### Visual Review

For visual/screenshot review, delegate to `helm-ui-reviewer`. It is a multimodal agent that reviews screenshots, layout, and visual regressions.

## Rules

- Web admin lives in `web/`. Mobile lives in `mobile/`.
- Functional components only. Named exports, no default exports.
- Use existing stores (Zustand) — don't create new global state unless necessary.
- If the UI change requires a new API endpoint or schema change, note it for `/helm-api` follow-up.
