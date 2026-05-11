# QA Test Suite (`qa/`)

> Last updated: 2026-05-11

## Tier 1: TLDR

`qa/` is a **Playwright** test suite (TypeScript, ESM) for the Helm web admin panel and backend API. It auto-starts both servers, handles auth, and runs behavioral tests across API contracts, editor UX, templates, workflows, security, and schema reconciliation. Two Playwright projects: `backend-only` (API tests only) and `e2e` (browser-based tests).

---

## Tier 2: Architecture

### Setup

| Property | Value |
|----------|-------|
| Framework | Playwright Test (`@playwright/test`) |
| Language | TypeScript, ESM (`"type": "module"`) |
| Browser | Chromium, channel: `chrome` |
| Base URLs | Backend: `http://127.0.0.1:8000`, Web Admin: `http://127.0.0.1:5174` |
| Retries | 1 |
| Reporter | `list` + `json` (output: `results/playwright-results.json`) |

### Two Playwright Projects

| Project | Pattern | Purpose |
|---------|---------|---------|
| `backend-only` | Matches `**/api-*.spec.ts` only | API tests (HTTP-only, no browser) |
| `e2e` | Matches `**/*.spec.ts` EXCEPT `**/api-*.spec.ts` | Browser-based E2E tests against web admin |

### Server Auto-Start

`globalSetup.cjs` (runs before all tests) and `globalTeardown.cjs` (runs after) handle server lifecycle:

1. **Backend detection:** Checks `http://127.0.0.1:8000/health`. If not running, starts `uvicorn app.main:app` as a detached process. Writes PID to `qa/.backend-pid.txt`.
2. **Vite detection:** Checks `http://127.0.0.1:5174`. If not running, starts `npx vite dev` as a detached process. Writes PID to `qa/.vite-pid.txt`.
3. **Setup verification:** Checks `/auth/setup_complete`. If not set, creates first user via `/auth/setup`.
4. **Auth login:** Logs in via `/auth/login` using credentials from `qa/.qa-env.json`. Writes session token + user info to `qa/src/.qa-auth.json`.
5. **Discovery:** Runs `discover.cjs` to scan backend routes, actions, components, templates; writes `qa/src/discovered.json`.

`globalTeardown.cjs` kills auto-started servers by PID file (only if QA started them).

### Auth Injection

`fixtures.ts` extends Playwright's base test with a `login()` fixture:

```typescript
export const test = base.extend<{ login: () => Promise<void> }>({
  login: async ({ page }, use) => {
    const auth = JSON.parse(fs.readFileSync('qa/src/.qa-auth.json'));
    await page.addInitScript((a) => {
      window.localStorage.setItem('admin_token', a.token);
      window.localStorage.setItem('admin_user', JSON.stringify({
        id: a.user_id, username: a.username, role: a.role
      }));
    }, auth);
    await use(() => {});
  },
});
```

Tests call `await login()` at the start of each test. Auth is injected via `addInitScript` before page navigation, so the web admin sees the user as already authenticated.

Security tests use a separate fixture (`security.spec.ts`) with a clean browser context and a secondary token to avoid contaminating the shared auth state.

### Discovery (`discover.cjs`)

Scans the live backend + source files and writes `qa/src/discovered.json`:

| Source | Method |
|--------|--------|
| API endpoints | `GET /openapi.json` → extracts all paths+methods |
| Components | `GET /api/components/registry` |
| Templates | `GET /api/templates` |
| Web routes | Regex scan of `web/src/App.tsx` for `path="..."` |
| Actions | Regex scan of `backend/app/services/action_registry.py` for `registry.register("...")` |
| Mobile components | `fs.readdirSync()` of `mobile/src/components/{sdui,atomic,composite,structural,common}` |
| Validation whitelist | Regex scan of `backend/app/mcp/tools.py` for `_VALID_V2_COMPONENT_TYPES` and `_LEGACY_V2_TYPE_MAP` |
| Mobile component registry | Regex scan of `mobile/src/renderer/componentRegistry.ts` for registry keys |
| Web registry | Regex scan of `web/src/editor/types.ts` for `COMPONENT_REGISTRY` and `READ_ONLY_RUNTIME_COMPONENTS` |
| Web schemas | Regex scan of `web/src/editor/componentSchemas.ts` for `COMPONENT_SCHEMAS` keys |
| Web preview renderers | Regex scan of `web/src/editor/EditorCanvas.tsx` for `PREVIEW_RENDERERS` keys |
| Local template types | Regex scan of `web/src/editor/templateLibrary.ts` for `createCell()` type arguments |

Output includes a `summary` section with counts for all sources.

### Path Resolution (`utils.ts`)

ESM modules don't have `__dirname`. `qa/src/utils.ts` provides:

```typescript
export function getDirname(importMeta: ImportMeta) {
  return path.dirname(fileURLToPath(import.meta.url));
}

export function qaPath(...segments: string[]) {
  const root = path.resolve(getDirname(import.meta), '..');
  return path.join(root, ...segments);
}
```

Most test files use `qaPath()` instead of `__dirname` for file path resolution (though `fixtures.ts` reads auth via a relative path).

---

## Key Files

### Infrastructure

| File | Purpose |
|------|---------|
| `qa/playwright.config.ts` | Playwright config: 2 projects, Chrome, retries=1, reporters |
| `qa/package.json` | ESM package, scripts: `test`, `test:backend`, `test:e2e`; deps: `@playwright/test`, `execa` |
| `qa/src/globalSetup.cjs` | Auto-starts backend + Vite, handles auth setup, runs discovery |
| `qa/src/globalTeardown.cjs` | Kills auto-started servers |
| `qa/src/discover.cjs` | Scans backend routes, actions, components, templates, validation whitelist, mobile/web registry types, web schemas, preview renderers, local template types |
| `qa/src/fixtures.ts` | Extended test fixture with `login()` via `addInitScript` |
| `qa/src/utils.ts` | `qaPath()` for ESM-safe path resolution |
| `qa/run.sh` | Convenience script: installs deps, runs backend pytest, then Playwright |

### Configuration Files

| File | Purpose |
|------|---------|
| `qa/.qa-env.json` | QA credentials (username + password). Created at repo root level. |
| `qa/src/.qa-auth.json` | Generated at runtime by `globalSetup` — session_token + user info |
| `qa/src/discovered.json` | Generated by `discover.cjs` — endpoints, actions, components, templates, routes |

> **Note:** `.qa-auth.json` and `discovered.json` are generated at test runtime. They are NOT committed to git.

### Page Objects (`qa/src/page-objects/`)

| File | Page |
|------|------|
| `login.ts` | Login page — username/password inputs, submit button, error box |
| `editor.ts` | SDUI Editor — toolbar, save/push-live buttons, undo/redo, structure tree, canvas, property inspector |
| `templates.ts` | Templates page — cards, preview modal, apply modal, search/filter |
| `workflows.ts` | Workflows page — list, create modal, React Flow nodes, node inspector |
| `connections.ts` | Connections page — add/edit/delete modals, provider badges, key visibility toggle |

### Test Files (`qa/src/tests/`)

| File | Project | What it tests |
|------|---------|---------------|
| `api-auth.spec.ts` | backend-only | Login success/fail, auth header requirements |
| `api-crud.spec.ts` | backend-only | CRUD operations for core entities |
| `api-endpoints.spec.ts` | backend-only | All discovered endpoints return non-500 status |
| `api-sdui-validation.spec.ts` | backend-only | SDUI payload validation endpoint |
| `api-template-crud.spec.ts` | backend-only | Template CRUD with component type validation |
| `component-picker.spec.ts` | e2e | `getAuthorableComponents()` returns valid set, no duplicates, all in `COMPONENT_REGISTRY` |
| `editor.spec.ts` | e2e | Editor component addition, structure tree updates, canvas rendering |
| `editor-sequence.spec.ts` | e2e | Multi-action sequences: add row, add component, save, reload |
| `editor-undo-redo.spec.ts` | e2e | Undo/redo buttons + Ctrl+Z keyboard shortcut |
| `editor-ux.spec.ts` | e2e | Drag handle positioning (outside canvas), divider row property toggle |
| `editor-variables.spec.ts` | e2e | Variable pill cursor positioning, markdown rendering in preview |
| `edge-case-data.spec.ts` | e2e | Normalization with empty strings, long text, unicode, null props, negative numbers |
| `logs.spec.ts` | e2e | Logs page rendering and filtering |
| `normalization.spec.ts` | e2e | `normalizeComponentForEditor()` idempotency, `getEditorPersistenceValidationError()` catches incomplete actions, `serializeComponentForRuntime()` completeness |
| `pages.spec.ts` | e2e | All 8 admin pages load without crashing, save doesn't redirect to login, module switching updates canvas |
| `schema-reconciliation.spec.ts` | e2e | 7 cross-registry sync tests: web/backend registry alignment, `COMPONENT_REGISTRY`↔`COMPONENT_SCHEMAS` sync, `COMPONENT_REGISTRY`↔`PREVIEW_RENDERERS` sync, backend validation whitelist↔mobile registry sync, removed types check, action dedup check, 4-way registry consistency (validation/DB/mobile/web) |
| `security.spec.ts` | e2e | Unauthenticated redirect, wrong credentials error, logout isolation |
| `settings.spec.ts` | e2e | Settings page load and update |
| `template-quality.spec.ts` | e2e | All templates use valid component types and action references |
| `templates.spec.ts` | e2e | Templates page loads, no Unknown components, Home/Chat template specific checks |
| `variables.spec.ts` | e2e | Variables page CRUD operations |
| `workflow.spec.ts` | e2e | Workflow node dropdown persistence, condition typing, action node connection handles |

---

## Critical Gotchas

### globalSetup/globalTeardown must be `.cjs`

The `qa/package.json` sets `"type": "module"` (ESM). Playwright's `globalSetup` and `globalTeardown` hooks are loaded via `require()`, which doesn't support ESM. They MUST use the `.cjs` extension and CommonJS syntax (`require()`, `module.exports`).

### No `__dirname` in test files

Test files (`.spec.ts`, `fixtures.ts`) are ESM. `__dirname` is undefined. Always use `qaPath()` from `qa/src/utils.ts` for path resolution:

```typescript
// WRONG — __dirname doesn't exist in ESM
fs.readFileSync(path.join(__dirname, '../.qa-env.json'))

// CORRECT — use qaPath()
import { qaPath } from '../utils';
fs.readFileSync(qaPath('.qa-env.json'))
```

### Schema reconciliation — known drift

`schema-reconciliation.spec.ts` compares web `COMPONENT_REGISTRY` types against backend registry. Normalization: PascalCase to lowercase, strip `Module` suffix (e.g., `CalendarModule` → `calendar`).

Expected drift (known naming differences between layers):
- `richtextrenderer` — web uses "RichTextRenderer", backend uses "rich_text_renderer"
- `richtext` — legacy alias for RichTextRenderer
- `richtextrendererrenderer` — edge case from double-normalization
- `empty` — in component seed but not always in DB registry on fresh installs

### Backend-only vs e2e project routing

- `backend-only` project: `testMatch: '**/api-*.spec.ts'` — only API tests
- `e2e` project: `testIgnore: '**/api-*.spec.ts'` + `testMatch: '**/*.spec.ts'` — all browser tests
- Files prefixed with `api-` run ONLY in backend-only project

### Servers must be reachable

Tests run against fixed URLs: `http://127.0.0.1:8000` (backend) and `http://127.0.0.1:5174` (web admin). If either server is on a different port, tests will fail. `globalSetup` auto-starts them at these exact ports.

### `addInitScript` auth injection

The `login()` fixture injects auth BEFORE page navigation via `page.addInitScript()`. This means tests don't need to fill in the login form — they just call `await login()` then navigate. The `admin_token` is set in `localStorage` before the page loads.

---

## How to Run

### Prerequisites

```bash
cd qa
npm install
npx playwright install chromium
```

### Run All Tests

```bash
cd qa
npx playwright test
```

This auto-starts backend and Vite if not already running, then runs all tests.

### Run Specific Projects

```bash
# API tests only (no browser)
npx playwright test --project backend-only

# E2E tests only (browser)
npx playwright test --project e2e
```

### Run Specific Test File

```bash
npx playwright test schema-reconciliation   # runs schema-reconciliation.spec.ts
npx playwright test editor                   # runs all editor*.spec.ts
npx playwright test api-auth                 # runs api-auth.spec.ts
```

### Full QA Pipeline (Backend Tests + Playwright)

```bash
cd qa && bash run.sh
```

This runs `pytest` on the backend first, then the Playwright suite. Results go to `qa/results/`.

### Results

- JSON report: `qa/results/playwright-results.json`
- Console log: `qa/results/playwright.log` (from `run.sh`)

---

## Current State

- **22 test files** across 2 projects (5 backend-only, 17 e2e)
- Run `cd qa && npx playwright test` for current counts
- Schema reconciliation: **7 cross-registry sync tests** covering web↔backend alignment, COMPONENT_REGISTRY↔COMPONENT_SCHEMAS, COMPONENT_REGISTRY↔PREVIEW_RENDERERS, backend validation whitelist↔mobile registry, removed types, action dedup, and 4-way registry consistency (validation/DB/mobile/web)
- **12 discovery scanners** — scans endpoints, components, templates, routes, actions, mobile components, validation whitelist, mobile registry, web registry, web schemas, preview renderers, and local template types
- Schema reconciliation correctly detects planted bugs (verified with TodoList test)
- API auth tests fixed (ESM path resolution via `qaPath()`)
- Security tests use isolated browser context to avoid contaminating shared auth state
