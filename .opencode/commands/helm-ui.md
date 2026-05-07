---
description: Work on web admin or mobile UI
agent: helm-frontend
---

# /helm-ui

Work on the web admin panel (Vite + React + TypeScript) or mobile app (React Native + Expo).

## Usage

/helm-ui <web|mobile> <description of the UI change>

## What It Does

1. Consult `docs/codebase-explanation/frontend.md` for navigation, state management, and SDUI patterns.
2. Implement the UI change following existing component patterns and design system.
3. Web admin: `cd web && npm run dev` to verify. TypeScript strict mode.
4. Mobile: `npx expo start` to verify.
5. Test the golden path and edge cases in the browser / simulator.

## Rules

- Web admin lives in `web/`. Mobile lives in `mobile/`.
- Functional components only. Named exports, no default exports.
- Use existing stores (Zustand) — don't create new global state unless necessary.
- If the UI change requires a new API endpoint or schema change, note it for `/helm-api` follow-up.
- Verify in a browser. UI correctness matters — don't just check that TypeScript compiles.
