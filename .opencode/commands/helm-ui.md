---
description: Work on web admin or mobile UI with conditional testing
agent: helm-frontend
---

# /helm-ui

Work on the following UI change: $ARGUMENTS

## What It Does

1. Consult `docs/codebase-explanation/frontend.md` for navigation, state management, and SDUI patterns.
2. Implement the UI change following existing component patterns and design system.
3. Web admin: `cd web && npm run dev` to verify. TypeScript strict mode.
4. Mobile: `npx expo start` to verify.

### Conditional Verification

- **UI visibly changed?** Start the dev server and test in a real browser/simulator. Check the golden path and edge cases. Visual correctness matters — don't just check that TypeScript compiles.
- **UI not visibly changed** (e.g., internal refactor, type-only change)? Run `cd web && npm run lint` — no browser needed.

## Rules

- Web admin lives in `web/`. Mobile lives in `mobile/`.
- Functional components only. Named exports, no default exports.
- Use existing stores (Zustand) — don't create new global state unless necessary.
- If the UI change requires a new API endpoint or schema change, note it for `/helm-api` follow-up.
