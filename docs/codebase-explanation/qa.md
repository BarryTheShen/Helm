# QA Test Suite (`qa/`)

Playwright-based checks for Helm's backend API and web admin UI.

> Last updated: 2026-06-18
> Related docs: `docs/codebase-explanation/OPERATIONS.md` for stack startup and ports, `docs/codebase-explanation/backend.md` for backend internals.

---

## Tier 1: TL;DR

- `qa/` is the Playwright suite for Helm's backend API and web admin panel.
- Preferred commands live in `qa/package.json`:
  - `cd qa && npm test`
  - `cd qa && npm run test:backend`
  - `cd qa && npm run test:e2e`
- Full pipeline, including backend `pytest`, is `cd qa && bash run.sh`.
- The suite expects the backend on `http://127.0.0.1:8000` and the web admin on `http://127.0.0.1:5174`.
- It auto-starts both servers if needed, logs in with QA credentials, cleans stale QA artifacts, and writes discovery data.

### Config at a glance

| Setting | Value |
|---------|-------|
| Test runner | Playwright Test (`@playwright/test`) |
| Language | TypeScript, ESM (ECMAScript modules) |
| Browser channel | Chrome |
| Projects | 2 (`backend-only`, `e2e`) |
| Retries | 1 |
| Reporters | `list` + `json` |
| JSON report | `qa/results/playwright-results.json` |
| Backend base URL | `http://127.0.0.1:8000` |
| Web base URL | `http://127.0.0.1:5174` |

---

## Tier 2: File map

| Path | What it owns |
|------|--------------|
| `qa/playwright.config.ts` | Playwright config: 2 projects, Chrome, one retry, JSON report |
| `qa/package.json` | Playwright scripts (`test`, `test:backend`, `test:e2e`) |
| `qa/run.sh` | Convenience wrapper that runs backend `pytest` and Playwright |
| `qa/src/globalSetup.cjs` | Starts backend/Vite, ensures `.qa-env.json`, logs in, runs cleanup, runs discovery |
| `qa/src/globalTeardown.cjs` | Repeats cleanup and stops auto-started servers |
| `qa/src/admin-cleanup.cjs` | Shared backend cleanup helper |
| `qa/src/fixtures.ts` | `login()` fixture and automatic editor-module cleanup |
| `qa/src/test-artifact-cleanup.ts` | Shared cleanup helpers used by specs |
| `qa/src/utils.ts` | ESM-safe path helper for spec files |
| `qa/src/discover.cjs` | Live discovery and drift report generation |
| `qa/src/canonical-types.json` | Canonical type list used by discovery drift checks |
| `qa/src/page-objects/` | Page objects for login, app editor, editor, templates, workflows, and connections |
| `qa/src/tests/` | Playwright specs |
| `qa/results/` (generated) | Playwright and pipeline output |

### Reading order

1. `qa/playwright.config.ts`
2. `qa/src/globalSetup.cjs`
3. `qa/src/fixtures.ts`
4. `qa/src/tests/*.spec.ts`
5. `qa/src/discover.cjs`

---

## How to run

### One-time setup

```bash
cd qa
npm install
npx playwright install chromium
```

### Playwright only

```bash
cd qa
npm test
npm run test:backend
npm run test:e2e
```

`npm test` is the preferred command when you only need Playwright.

### Full QA pipeline

```bash
cd qa
bash run.sh
```

This command runs backend `pytest -x -q` first, then the Playwright suite. Use it when you want one command to validate both layers.

### Results

- Playwright JSON report: `qa/results/playwright-results.json`
- Playwright console log: `qa/results/playwright.log` (written by `run.sh`)
- Backend pytest log: `qa/results/backend-results.txt` (written by `run.sh`)

---

## How the suite starts up

`globalSetup.cjs` follows the same sequence on every run:

1. Check `http://127.0.0.1:8000/health`. Start `uvicorn app.main:app --host 127.0.0.1 --port 8000` if the backend is not already running.
2. Check `http://127.0.0.1:5174`. Start `npx vite dev --host 127.0.0.1 --port 5174` if the web admin is not already running.
3. Create `qa/.qa-env.json` with `admin` / `admin` if the file is missing.
4. Call `/auth/status`; if setup is still open, bootstrap the first user from `.qa-env.json`.
5. Log in through `/auth/login` and write `qa/src/.qa-auth.json` for the fixtures.
6. Run admin cleanup before the suite starts.
7. Run discovery and write `qa/src/discovered.json`.

`globalTeardown.cjs` repeats cleanup after the suite and kills only the processes that QA started. If the backend or web admin was already running, it leaves them alone.

---

## Project map

### `backend-only` project

- Pattern: `**/api-*.spec.ts`
- Base URL: `http://127.0.0.1:8000`
- Purpose: HTTP-only API checks without a browser

Files:
- `api-auth.spec.ts` — login success/failure and auth header checks
- `api-crud.spec.ts` — CRUD coverage for core entities
- `api-endpoints.spec.ts` — discovered endpoints return non-500 responses
- `api-sdui-validation.spec.ts` — SDUI validation endpoint
- `api-template-crud.spec.ts` — template CRUD and component-type validation

### `e2e` project

- Pattern: all `*.spec.ts` except `api-*.spec.ts`
- Base URL: `http://127.0.0.1:5174`
- Purpose: browser-based checks against the web admin UI

Current e2e spec count: **28**

#### Editor, app editor, and SDUI behavior
- `app-editor-preview.spec.ts` — app editor preview behavior
- `app-editor.spec.ts` — app editor flows
- `component-picker.spec.ts` — authorable component list is valid and deduplicated
- `editor.spec.ts` — add components, update structure, render canvas
- `editor-sequence.spec.ts` — multi-step editor flows
- `editor-undo-redo.spec.ts` — undo/redo buttons and keyboard shortcut
- `editor-ux.spec.ts` — drag handles and divider row toggles
- `editor-variables.spec.ts` — variable pills and preview rendering
- `edge-case-data.spec.ts` — empty strings, long text, unicode, null props, negative numbers
- `normalization.spec.ts` — normalization and persistence guards
- `ff3-partial-closure.spec.ts` — partial closure regression coverage
- `ff4-app-editor.spec.ts` — FF4 app editor coverage
- `ff4-phase5-editors.spec.ts` — editor regression slice
- `ff4-phase6-cal-tpl.spec.ts` — calendar/template regression slice
- `ff4-phase8-modules.spec.ts` — module regression slice
- `ff4-phase9-app-editor.spec.ts` — app editor regression slice
- `ff4-phase10-components.spec.ts` — component regression slice
- `ff4-phase11-calendar.spec.ts` — calendar regression slice
- `ff4-phase12-tpl-wf-mcp.spec.ts` — template/workflow/MCP regression slice

#### Pages, content, and security
- `logs.spec.ts` — logs page rendering and filtering
- `pages.spec.ts` — main admin pages load and state stays on the app
- `security.spec.ts` — unauthenticated redirect, bad-password error, logout isolation
- `settings.spec.ts` — settings page load and update
- `templates.spec.ts` — templates page and template-specific checks
- `variables.spec.ts` — variables page CRUD
- `workflow.spec.ts` — workflow builder persistence and handles

#### Drift and quality checks
- `schema-reconciliation.spec.ts` — registry alignment checks
- `template-quality.spec.ts` — template type and action reference validation

---

## Support files

### Page objects

`qa/src/page-objects/` currently has 6 files:

- `app-editor.ts`
- `connections.ts`
- `editor.ts`
- `login.ts`
- `templates.ts`
- `workflows.ts`

### Runtime artifacts

Generated during test runs and not committed:

- `qa/.qa-env.json` — local QA credentials
- `qa/src/.qa-auth.json` — session token plus user info written by `globalSetup`
- `qa/src/discovered.json` — discovery output and drift report
- `qa/.backend-pid.txt` — backend PID when QA starts the server
- `qa/.vite-pid.txt` — Vite PID when QA starts the server

### Fixture and helper notes

- `fixtures.ts` exposes `login()`, which reads `qa/src/.qa-auth.json` and injects the token before page navigation.
- Use `qaPath()` from `qa/src/utils.ts` in ESM spec files instead of `__dirname`.
- Keep `globalSetup.cjs` and `globalTeardown.cjs` as CommonJS files; Playwright loads them with `require()`.
- Security specs use an isolated browser context so they do not contaminate shared auth state.

---

## Current counts

- Spec files: **33**
- Backend-only specs: **5**
- E2E specs: **28**
- Page objects: **6**
- Discovery scanners: **13**

The discovery scanner currently covers endpoints, components, templates, routes, actions, mobile components, the validation whitelist, the mobile registry, the web registry, web schemas, preview renderers, local template types, and module states.

---

## Working notes

- `qa/.qa-env.json` is the local credentials file. If you want different QA credentials, edit it before the first run.
- The generated auth and discovery files are runtime artifacts only; do not commit them.
- Prefer the Playwright `npm` scripts when you only need browser or API coverage.
- Use `bash run.sh` when you want the full backend pytest + Playwright pipeline in one command.
- For stack startup and port details, see `docs/codebase-explanation/OPERATIONS.md`.
