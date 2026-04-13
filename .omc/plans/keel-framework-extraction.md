# Keel Framework Extraction Plan

> Decouple Helm into an open-source AI-UI framework ("Keel") + example app.

## Requirements Summary

**Goal:** Extract the reusable SDUI renderer, component registry, WebSocket protocol, and MCP integration from Helm into three independent packages that other developers can install to build AI-powered mobile apps. The current Helm app becomes an example app built on Keel.

**Constraints:**
- Framework name: **Keel**
- Package structure: **Monorepo, multi-package**
- SDUI: **V2 only** (drop V1 from framework; V1 stays in example app if needed)
- Bug strategy: **Fix 6 critical bugs first**, then restructure
- Framework packages must have **zero app-specific dependencies** (no authStore, no router, no Helm-specific config)

## Package Architecture

```
keel/                           # Root monorepo
├── packages/
│   ├── protocol/               # @keel/protocol (npm)
│   │   └── src/
│   │       ├── types/          # SDUIAction, SDUIPage, SDUICell, SDUIRow
│   │       ├── schemas/        # Zod validation schemas
│   │       └── index.ts        # Public API
│   ├── renderer/               # @keel/renderer (npm)
│   │   └── src/
│   │       ├── components/
│   │       │   ├── atomic/     # SDUIText, SDUIButton, SDUIIcon, SDUIImage, SDUITextInput, SDUIDivider, SDUIMarkdown
│   │       │   ├── structural/ # SDUIContainer
│   │       │   └── composite/  # CalendarModule, ChatModule, NotesModule, InputBar
│   │       ├── registry/       # componentRegistry.ts
│   │       ├── renderer/       # SDUIPageRenderer, RowRenderer, CellRenderer
│   │       ├── hooks/          # useBreakpoint
│   │       ├── theme/          # tokens.ts, colors.ts
│   │       └── index.ts        # Public API
│   └── server/                 # keel-server (PyPI)
│       └── keel_server/
│           ├── websocket.py    # ConnectionManager
│           ├── mcp.py          # FastMCP setup, auth middleware, context vars
│           ├── tools.py        # Base tool dispatcher + SDUI normalization
│           ├── registry.py     # ActionRegistry base class
│           └── __init__.py     # Public API
├── examples/
│   └── helm-app/               # The current Helm app (mobile/ + backend/ + agent/)
├── docs/
│   ├── quickstart.md
│   ├── sdui-spec.md            # V2 JSON schema spec (standalone)
│   ├── api-reference.md
│   └── custom-components.md
├── package.json                # Workspace root
├── turbo.json                  # Build orchestration (or nx)
└── README.md
```

## Acceptance Criteria

1. `npm install @keel/protocol` gives you SDUI types + Zod schemas with zero other deps
2. `npm install @keel/renderer` gives you a working SDUI V2 renderer that accepts a JSON payload and renders native React Native components
3. `pip install keel-server` gives you FastAPI WebSocket manager + MCP server helpers + SDUI normalization
4. The Helm example app in `examples/helm-app/` imports from `@keel/*` and `keel-server` and works identically to today
5. A new developer can render an SDUI screen in <10 lines of code:
   ```tsx
   import { SDUIPageRenderer } from '@keel/renderer';
   import type { SDUIPage } from '@keel/protocol';

   const screen: SDUIPage = { /* JSON from server */ };
   <SDUIPageRenderer page={screen} onAction={(action) => console.log(action)} />
   ```
6. Custom components are registerable:
   ```tsx
   import { registerComponent } from '@keel/renderer';
   registerComponent('MyWidget', MyWidgetComponent);
   ```
7. All 6 critical bugs are fixed before restructuring begins
8. No circular dependencies between packages (@keel/renderer depends on @keel/protocol, not vice versa)
9. Framework packages have zero imports from Helm stores, router, or app-specific config

---

## Implementation Steps

### Phase 0: Fix Critical Bugs (1-2 days)

**0.1** Fix `_run_time_alerts()` calling nonexistent `manager.connected_users()`
- File: `backend/app/main.py:75`
- Change: `manager.connected_users()` → `manager.connected_user_ids`
- Add try/except around the while loop body so the task doesn't die permanently

**0.2** Fix `helm_hide_tab` MCP tool dead code
- File: `backend/app/mcp/server.py:366-384`
- Change: Extract the unreachable code after `helm_approve_draft`'s return into a proper `@mcp.tool()` decorated function `helm_hide_tab(tab_id: str)`

**0.3** Fix `update_event()` missing `@router.put` decorator
- File: `backend/app/routers/calendar.py:263`
- Change: Add `@router.put("/events/{event_id}")` decorator

**0.4** Fix `deleteConversation()` ignoring `conversationId` param
- File: `mobile/src/services/api.ts:188-189`
- Change: Include conversationId in the DELETE request (match backend endpoint)

**0.5** Fix `chat_complete` handler not reconciling message content
- File: `mobile/app/(tabs)/chat.tsx:123-126`
- Change: Update the assistant message's `content` from `message.content` and `id` from `message.message_id` in the `chat_complete` handler

**0.6** Fix `chat_message_replace` ID mismatch with `Date.now()` fallback
- File: `mobile/app/(tabs)/chat.tsx:98-122`
- Change: Ensure streaming messages use `message.message_id` consistently; fallback lookup by role (last assistant message) if ID lookup fails

**0.7** Fix CORS wildcard + credentials
- File: `backend/app/main.py:111-117`
- Change: Load `ALLOWED_ORIGINS` from env var, default to `["http://localhost:8081", "http://localhost:19006"]` for dev

**0.8** Fix default secret key
- File: `backend/app/config.py:22`
- Change: Add startup validation that rejects the default `"dev-secret-key-change-in-production"` value with a clear error message

**Verification:** Run `cd backend && pytest` — all tests pass. Manually verify chat streaming works.

---

### Phase 1: Monorepo Scaffolding (half day)

**1.1** Initialize monorepo root
- Create root `package.json` with npm workspaces pointing to `packages/*`
- Add `turbo.json` for build orchestration
- Add root `tsconfig.base.json` with shared TypeScript config
- Add `.gitignore` updates

**1.2** Scaffold `packages/protocol/`
- `package.json` with name `@keel/protocol`, peer dep on `zod`
- `tsconfig.json` extending root
- `src/index.ts` (empty, will be populated in Phase 2)

**1.3** Scaffold `packages/renderer/`
- `package.json` with name `@keel/renderer`, peer deps on `react`, `react-native`, dep on `@keel/protocol`
- `tsconfig.json` extending root
- `src/index.ts` (empty)

**1.4** Scaffold `packages/server/`
- `pyproject.toml` with name `keel-server`, deps on `fastapi`, `sqlalchemy`, `mcp`, `loguru`
- `keel_server/__init__.py`

**1.5** Create `examples/helm-app/` directory
- This will eventually hold the moved Helm app code

**Verification:** `npm install` from root resolves workspaces. `turbo build` runs (even if empty).

---

### Phase 2: Extract @keel/protocol (half day)

**2.1** Extract SDUI types (V2 only)
- Source: `mobile/src/types/sdui.ts`
- Target: `packages/protocol/src/types/sdui.ts`
- Changes: Keep only V2 types (SDUIPage, SDUIRow, SDUICell, SDUIAction). Move V1 types (SDUIScreen, SDUISection) to the example app.
- Export `isSDUIPage()` type guard

**2.2** Extract API types
- Source: `mobile/src/types/api.ts`
- Target: `packages/protocol/src/types/api.ts`
- No changes needed — pure type definitions

**2.3** Extract Zod schemas
- Source: `mobile/src/utils/validation.ts`
- Target: `packages/protocol/src/schemas/validation.ts`
- Keep `wsMessageSchema`, `sduiComponentSchema`; move app-specific schemas to example app if any

**2.4** Create public API
- `packages/protocol/src/index.ts`: Re-export all types and schemas
- Ensure tree-shakeable exports

**Verification:** `cd packages/protocol && npm run build` succeeds. Types are importable.

---

### Phase 3: Extract @keel/renderer (1-2 days)

**3.1** Extract theme/design system
- Source: `mobile/src/theme/tokens.ts`, `mobile/src/theme/colors.ts`
- Target: `packages/renderer/src/theme/`
- No changes — pure data

**3.2** Extract atomic components (V2 only)
- Source: `mobile/src/components/atomic/` (7 files: SDUIText, SDUIButton, SDUIIcon, SDUIImage, SDUITextInput, SDUIDivider, SDUIMarkdown)
- Target: `packages/renderer/src/components/atomic/`
- Change imports: `@/theme/tokens` → relative imports within package; `@/types/sdui` → `@keel/protocol`

**3.3** Extract structural components
- Source: `mobile/src/components/structural/SDUIContainer.tsx`
- Target: `packages/renderer/src/components/structural/`
- Update imports same as 3.2

**3.4** Extract composite components
- Source: `mobile/src/components/composite/` (CalendarModule, ChatModule, NotesModule, InputBar)
- Target: `packages/renderer/src/components/composite/`
- Update imports same as 3.2

**3.5** Extract component registry
- Source: `mobile/src/renderer/componentRegistry.ts`
- Target: `packages/renderer/src/registry/componentRegistry.ts`
- Remove V1 component registrations; keep only V2 PascalCase types
- Export `registerComponent()`, `resolveComponent()`, `getRegisteredTypes()`

**3.6** Extract renderer core (V2 only)
- Source: `mobile/src/components/sdui/SDUIRenderer.tsx`
- Target: `packages/renderer/src/renderer/SDUIPageRenderer.tsx`
- Extract ONLY: `SDUIPageRenderer`, `RowRenderer`, `CellRenderer`, `V2ComponentRenderer`
- Drop: `SDUIScreenRenderer` (V1), `SDUIUniversalRenderer` (auto-dispatch) — these stay in example app
- Key change: `ActionDispatcher` type becomes a prop callback, not an internal hook
  ```tsx
  // Framework API:
  <SDUIPageRenderer
    page={sduiPayload}
    onAction={(action: SDUIAction) => void}
  />
  ```

**3.7** Extract useBreakpoint hook
- Source: `mobile/src/hooks/useBreakpoint.ts`
- Target: `packages/renderer/src/hooks/useBreakpoint.ts`
- No changes — pure React Native hook

**3.8** Create public API
- `packages/renderer/src/index.ts`:
  ```tsx
  // Core
  export { SDUIPageRenderer } from './renderer/SDUIPageRenderer';
  export { registerComponent, resolveComponent, getRegisteredTypes } from './registry/componentRegistry';
  export { useBreakpoint } from './hooks/useBreakpoint';

  // Components (for direct use or custom composition)
  export { SDUIText } from './components/atomic/SDUIText';
  export { SDUIButton } from './components/atomic/SDUIButton';
  // ... all components

  // Theme
  export { themeColors, resolveColor, themeShadows } from './theme/tokens';
  export { colors, spacing, borderRadius, typography } from './theme/colors';
  ```

**Verification:** Build succeeds. Import `SDUIPageRenderer` in a test file, render a simple SDUIPage JSON — components appear correctly.

---

### Phase 4: Extract keel-server (1 day)

**4.1** Extract WebSocket manager
- Source: `backend/app/services/websocket_manager.py`
- Target: `packages/server/keel_server/websocket.py`
- Make it a proper class that doesn't rely on singleton pattern (keep singleton as optional convenience)
- Fix the `connected_user_ids` property (already fixed in Phase 0)

**4.2** Extract MCP server helpers
- Source: `backend/app/mcp/server.py`
- Target: `packages/server/keel_server/mcp.py`
- Extract: `_MCPAuthMiddleware`, `get_current_user_id()` context var pattern, FastMCP factory
- Make auth validation pluggable (accept a `validate_token` callback instead of hardcoding `get_session_by_token`)
  ```python
  def create_mcp_server(
      name: str,
      validate_token: Callable[[str], Awaitable[str | None]],  # token → user_id or None
      path: str = "/mcp",
  ) -> tuple[FastMCP, ASGIMiddleware]:
      ...
  ```

**4.3** Extract SDUI tools + normalization
- Source: `backend/app/mcp/tools.py`
- Target: `packages/server/keel_server/tools.py`
- Extract: `normalize_sdui_screen()`, `normalize_sdui_component()`, base `execute_tool()` dispatcher pattern
- Make DB session injection explicit (accept `AsyncSession` param, don't import global)
- Helm-specific tools (calendar, chat, notifications) stay in example app; framework provides the tool registration pattern

**4.4** Extract ActionRegistry base class
- Source: `backend/app/services/action_registry.py`
- Target: `packages/server/keel_server/registry.py`
- Extract: `ActionRegistry` class with `register()` and `execute()` methods
- Remove built-in handlers (_refresh_data, _submit_form, etc.) — these stay in example app

**4.5** Create public API
- `packages/server/keel_server/__init__.py`:
  ```python
  from keel_server.websocket import ConnectionManager
  from keel_server.mcp import create_mcp_server, get_current_user_id
  from keel_server.tools import normalize_sdui_screen
  from keel_server.registry import ActionRegistry
  ```

**Verification:** `pip install -e packages/server` succeeds. Import all exports in a test script.

---

### Phase 5: Rewire Helm as Example App (1-2 days)

**5.1** Move Helm app code to `examples/helm-app/`
- Move `mobile/` → `examples/helm-app/mobile/`
- Move `backend/` → `examples/helm-app/backend/`
- Move `agent/` → `examples/helm-app/agent/`
- Update all relative paths, tsconfig, package.json

**5.2** Rewire frontend imports
- Replace `@/components/sdui/SDUIRenderer` → `@keel/renderer`
- Replace `@/renderer/componentRegistry` → `@keel/renderer`
- Replace `@/types/sdui` → `@keel/protocol`
- Replace `@/theme/tokens` → `@keel/renderer` (for direct component use in app)
- Keep app-specific files in place: `useSDUIScreen`, `useActionDispatcher`, `WebSocketContext`, stores, screens

**5.3** Rewire backend imports
- Replace `app.services.websocket_manager` → `keel_server.websocket`
- Replace MCP server setup → `keel_server.mcp.create_mcp_server()`
- Replace SDUI normalization → `keel_server.tools.normalize_sdui_screen()`
- Keep Helm-specific: agent_proxy, workflow_engine, routers, models

**5.4** Add V1 compatibility layer in example app
- Move V1 types back into `examples/helm-app/mobile/src/types/sdui-v1.ts`
- Move `SDUIScreenRenderer` + `SDUIUniversalRenderer` into example app's local components
- V1 support lives in the app, not the framework

**5.5** Verify everything works
- `cd examples/helm-app/backend && pytest` — all tests pass
- `cd examples/helm-app/mobile && npx expo start` — app launches
- Chat streaming works, SDUI rendering works, MCP tools work

---

### Phase 6: Documentation + Developer Experience (1 day)

**6.1** Write `docs/quickstart.md`
- "Render your first AI-driven screen in 5 minutes"
- Install packages, create minimal app, render SDUIPage JSON

**6.2** Write `docs/sdui-spec.md`
- Standalone V2 JSON schema specification
- All component types, props, action types
- Row/cell responsive layout system
- Examples for every component

**6.3** Write `docs/custom-components.md`
- How to create and register custom SDUI components
- `registerComponent()` API
- Props typing with TypeScript

**6.4** Write root `README.md`
- What Keel is (one paragraph)
- Package overview (@keel/protocol, @keel/renderer, keel-server)
- Quick install + usage
- Link to docs
- "Built with Keel" section (Helm as first example)

**6.5** Add `docs/api-reference.md`
- All exports from each package
- TypeScript types
- Python API

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking the Helm app during extraction | High — app stops working | Phase 5 is dedicated to rewiring; run full test suite after each step |
| Component dependencies on React Native internals | Medium — limits web usage | Keep `react-native` as peer dep; components already use standard RN primitives |
| npm namespace `@keel` taken | Medium — blocks publishing | Check availability early; fallback: `@keel-ui` or `@keelframework` |
| Backend extraction breaks DB migrations | Medium — Alembic references app paths | Keep migrations in example app, not framework |
| Theme tokens too Helm-specific | Low — limits customization | Make theme overridable via `ThemeProvider` context in Phase 3 |
| Circular dependency between packages | High — breaks builds | Enforced by monorepo tooling; @keel/renderer → @keel/protocol only, never reverse |

## Verification Steps

1. **After Phase 0:** `cd backend && pytest` passes; chat streaming works manually
2. **After Phase 1:** `npm install` from root resolves all workspaces
3. **After Phase 2:** `@keel/protocol` builds; types importable in a test file
4. **After Phase 3:** `@keel/renderer` builds; `SDUIPageRenderer` renders a sample JSON payload
5. **After Phase 4:** `pip install -e packages/server` succeeds; imports work
6. **After Phase 5:** Full Helm app works identically — `pytest` passes, Expo starts, chat + SDUI work
7. **After Phase 6:** A new developer can follow quickstart.md and render a screen in <10 minutes

## Timeline Estimate

| Phase | Duration | Dependency |
|-------|----------|------------|
| Phase 0: Fix critical bugs | 1-2 days | None |
| Phase 1: Monorepo scaffolding | 0.5 day | Phase 0 |
| Phase 2: @keel/protocol | 0.5 day | Phase 1 |
| Phase 3: @keel/renderer | 1-2 days | Phase 2 |
| Phase 4: keel-server | 1 day | Phase 1 |
| Phase 5: Rewire Helm app | 1-2 days | Phase 3 + 4 |
| Phase 6: Documentation | 1 day | Phase 5 |
| **Total** | **~6-8 days** | |

Note: Phases 2-3 (frontend) and Phase 4 (backend) can run in parallel.
