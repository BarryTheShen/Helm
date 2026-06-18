# Frontend — React Native Expo mobile app + web admin

> Last updated: 2026-06-18
> Scope: the current `mobile/` Expo app and the current `web/` admin SPA.

## Tier 1: TL;DR

Helm has two frontends.

- `mobile/` is the product app. It is a React Native app built with Expo Router. It handles sign-in, device assignment, app config, shared WebSocket updates, SDUI rendering, and the native fallback screens.
- `web/` is the admin app. It is a separate React + TypeScript single-page app built with Vite and React Router. It edits module screens, app layouts, templates, workflows, variables, connections, logs, and previews.
- Both frontends talk to the same backend. The backend owns the data; the frontends mostly render it and send user actions back.
- SDUI means server-driven UI. New work should use the V2 row/cell format (`SDUIPage`) and PascalCase component names. V1 lowercase payloads still work for old content.
- The main startup files are `mobile/app/_layout.tsx`, `mobile/app/(tabs)/_layout.tsx`, `web/src/App.tsx`, and `web/src/components/AdminLayout.tsx`.
- If you need exact API endpoints or SDUI payload shapes, pair this doc with `docs/codebase-explanation/backend.md` and `docs/codebase-explanation/protocol.md`.

If you are new here, read in this order:

1. `docs/codebase-explanation/README.md` — docs map and reading order.
2. `mobile/app/_layout.tsx` — mobile boot, providers, redirects.
3. `mobile/app/(tabs)/_layout.tsx` — tab shell, tab visibility, app config sync.
4. `mobile/src/stores/authStore.ts` — mobile auth state.
5. `mobile/src/hooks/useSDUIScreen.ts` — live SDUI loading and draft syncing.
6. `mobile/src/components/sdui/SDUIRenderer.tsx` — how JSON becomes native UI.
7. `web/src/App.tsx` — admin router boot.
8. `web/src/components/AdminLayout.tsx` — admin shell and sidebar.
9. `web/src/editor/types.ts` — editor data model and component registry.
10. `web/src/pages/EditorPage.tsx` — module editor flow.
11. `web/src/pages/AppEditorPage.tsx` — app editor flow.
12. `web/src/lib/previewResolver.ts` — preview bundle resolution.

If you only want the mobile app, stop after step 6. If you only want the web admin, start at step 7.

## Tier 2: How the frontend is organized

### Current folder map

#### Mobile app (`mobile/`)

| Path | Current count | What it owns |
|------|---------------|--------------|
| `mobile/app/` | 18 route files | Expo Router screens, route groups, launchpad, template detail, module detail, and the unassigned waiting screen |
| `mobile/src/components/` | 30 TSX files | native UI, SDUI renderers, preview banner, and draft preview UI |
| `mobile/src/hooks/` | 5 hooks | SDUI loading, action dispatch, variable context, data sources, breakpoints |
| `mobile/src/stores/` | 7 stores | auth, app config, preview, UI, tabs, settings, component state |
| `mobile/src/services/` | 4 files | REST, auth, WebSocket, and app config fetch helper |
| `mobile/src/types/` | 3 files | API and SDUI types |
| `mobile/src/renderer/` | 1 file | SDUI type-string → component registry |
| `mobile/src/constants/` | 1 file | module → route mapping |
| `mobile/src/contexts/` | 1 file | shared WebSocket provider |
| `mobile/src/theme/` | 4 files | colors, tokens, navigation theme, and app theme helpers |

The mobile route tree is easy to scan:

- Root routes: `mobile/app/_layout.tsx`, `mobile/app/index.tsx`, `mobile/app/launchpad.tsx`, `mobile/app/unassigned.tsx`
- Auth routes: `mobile/app/(auth)/connect.tsx`, `mobile/app/(auth)/login.tsx`, `mobile/app/(auth)/_layout.tsx`
- Tab routes: `mobile/app/(tabs)/home.tsx`, `mobile/app/(tabs)/chat.tsx`, `mobile/app/(tabs)/modules.tsx`, `mobile/app/(tabs)/calendar.tsx`, `mobile/app/(tabs)/forms.tsx`, `mobile/app/(tabs)/alerts.tsx`, `mobile/app/(tabs)/settings.tsx`, `mobile/app/(tabs)/article.tsx`
- Dynamic routes: `mobile/app/template/[id].tsx`, `mobile/app/module/[moduleId].tsx`

#### Web admin (`web/`)

| Path | Current count | What it owns |
|------|---------------|--------------|
| `web/src/App.tsx` | 1 file | router bootstrap and auth guard |
| `web/src/pages/` | 9 pages | login, module editor, app editor, templates, workflows, variables, connections, logs, settings |
| `web/src/components/` | 11 TSX files | admin shell, preview shells, and preview helpers |
| `web/src/editor/` | 24 files | editor data model, canvas, inspector, validation, and authoring helpers |
| `web/src/stores/` | 3 stores | auth, app editor, preview |
| `web/src/hooks/` | 1 hook | generic resource fetcher |
| `web/src/lib/` | 6 files | API client, preview resolver, text helpers, icon helpers, utilities |

The most important web files are:

- Shell and preview components: `web/src/components/AdminLayout.tsx`, `web/src/components/SDUIPreview.tsx`, `web/src/components/BrowserPreview.tsx`, `web/src/components/AppPhoneShell.tsx`, `web/src/components/AppPreviewFlow.tsx`, `web/src/components/PreviewPicker.tsx`
- Pages: `web/src/pages/LoginPage.tsx`, `web/src/pages/EditorPage.tsx`, `web/src/pages/AppEditorPage.tsx`, `web/src/pages/TemplatesPage.tsx`, `web/src/pages/WorkflowsPage.tsx`, `web/src/pages/VariablesPage.tsx`, `web/src/pages/ConnectionsPage.tsx`, `web/src/pages/LogsPage.tsx`, `web/src/pages/SettingsPage.tsx`
- Editor internals: `web/src/editor/types.ts`, `web/src/editor/useEditorStore.ts`, `web/src/editor/cellWidthEngine.ts`, `web/src/editor/componentSchemas.ts`, `web/src/editor/EditorCanvas.tsx`, `web/src/editor/PropertyInspector.tsx`, `web/src/editor/StructureTree.tsx`, `web/src/editor/ModulesTree.tsx`

### Shared concern map

| Concern | Mobile files | Web files |
|---------|--------------|-----------|
| Startup and auth | `mobile/app/_layout.tsx`, `mobile/app/(auth)/*`, `mobile/src/stores/authStore.ts` | `web/src/App.tsx`, `web/src/pages/LoginPage.tsx`, `web/src/stores/authStore.ts` |
| Navigation | `mobile/app/(tabs)/_layout.tsx`, `mobile/src/constants/moduleRoutes.ts`, `mobile/app/launchpad.tsx` | `web/src/components/AdminLayout.tsx` |
| SDUI render | `mobile/src/components/sdui/SDUIRenderer.tsx`, `mobile/src/renderer/componentRegistry.ts`, `mobile/src/types/sdui.ts` | `web/src/components/SDUIPreview.tsx`, `web/src/editor/types.ts`, `web/src/editor/typeGuards.ts` |
| Preview | `mobile/src/components/sdui/DraftPreview.tsx`, `mobile/src/components/PreviewBanner.tsx` | `web/src/components/AppPreviewFlow.tsx`, `web/src/components/BrowserPreview.tsx`, `web/src/components/AppPhoneShell.tsx`, `web/src/components/PreviewPicker.tsx` |
| Data fetch | `mobile/src/services/api.ts`, `mobile/src/hooks/useDataSource.ts`, `mobile/src/utils/variableResolver.ts` | `web/src/lib/api.ts`, `web/src/hooks/useResource.ts`, `web/src/lib/previewResolver.ts` |

### Legacy vs preferred

| Area | Legacy / compatibility | Preferred / current |
|------|------------------------|--------------------|
| SDUI screen format | V1 `SDUIScreen`, section-based payloads, lowercase component types | V2 `SDUIPage`, row/cell payloads, PascalCase component types |
| Tab visibility | `hiddenTabs` + `enabledTabIds` fallback | `appConfig.bottom_bar_config` when app config exists |
| Draft approval path | `DraftPreview` on mobile for AI-generated screen drafts | `AppEditorPage` checkpoint / version / publish flow |
| SDUI actions | `send_to_agent` | `server_action` or `api_call` |
| Web preview path | `web/src/components/AppPreview.tsx` older helper | `AppPreviewFlow` + `BrowserPreview` + `AppPhoneShell` + `SDUIPreview` |
| Mobile navigation mode | persisted `navigationMode` flag | current tab shell; no drawer route exists today |

## Tier 3: File-by-file guide

### Mobile app

#### Startup, navigation, and data flow

The mobile app starts in `mobile/app/index.tsx` and `mobile/app/_layout.tsx`.

- `index.tsx` is only a splash redirect. It waits for auth to hydrate and then sends the user to either the connect/login flow or the chat tab.
- `app/_layout.tsx` initializes auth, settings, and cached app config. It also wraps the app in the navigation theme, the shared WebSocket provider, status bar, and toast provider.
- `app/_layout.tsx` uses the current auth state to decide where to send the user:
  - no token → `/(auth)/connect` or `/(auth)/login`
- `app/(tabs)/_layout.tsx` is the tab shell. It loads enabled tab IDs from AsyncStorage, fetches module config from REST, and listens for WebSocket updates. The root layout hydrates app config.
- The current tab visibility rule is:
  - if `appConfig` exists, use `appConfig.bottom_bar_config`
  - otherwise fall back to the legacy `hiddenTabs` + `enabledTabIds` path
- The tab shell also renders the settings gear button in the header. The settings screen itself stays hidden from the tab bar.
- `mobile/src/contexts/WebSocketContext.tsx` creates one shared `WebSocketService` per auth session. It handles reconnects, connection banners, app config updates, preview events, and device assignment events.
- `mobile/src/components/PreviewBanner.tsx` appears when preview mode is active. It lets the user exit preview without restarting the app.
- Most tab screens use `useSDUIScreen(moduleId)` and then render `SDUIUniversalRenderer` if the backend has pushed a screen. When no SDUI payload exists, they show native fallback UI.
- `home`, `chat`, `calendar`, `alerts`, `settings`, and `module/[moduleId]` can all be overridden by SDUI.
- `forms` is SDUI-only. It shows an empty state until the backend creates a form.
- `launchpad.tsx` is a full-screen grid of app-configured modules.
- `template/[id].tsx` loads a template and applies it to a module.
- `module/[moduleId].tsx` shows the live screen when one exists. If the backend also sends a draft, it shows `DraftPreview` instead of the live screen so the user can approve or reject the draft.
- `unassigned.tsx` is the waiting screen for a device that has a session but no app assignment yet. It polls the backend and also listens for the `device_app_assigned` WebSocket event.
- `article.tsx` is the article detail screen. It receives article content through route params from an article card.

The auth screens are intentionally simple:

- `connect.tsx` is the first-time entry point. It asks for the server URL plus credentials, saves the server URL, signs in, registers the device, and then routes either to `unassigned` or to the tabs.
- `login.tsx` is the returning-user sign-in screen. It assumes the server URL is already known and gives the user a shortcut back to `connect` if they need to change servers.

#### Mobile state

| Store | File | What it tracks | Notes |
|-------|------|----------------|-------|
| `useAuthStore` | `mobile/src/stores/authStore.ts` | token, user, serverUrl, deviceId, loading state | persists through `mobile/src/utils/storage.ts`; logout clears the server session and client state |
| `useAppConfigStore` | `mobile/src/stores/appConfigStore.ts` | current app config, sync time, offline state | loads `/api/devices/{deviceId}/config`, caches the result in AsyncStorage, and keeps the last known good config if fetch fails |
| `useTabsStore` | `mobile/src/stores/tabsStore.ts` | hidden tabs, module configs, enabled tab IDs | `enabledTabIds` persists to AsyncStorage |
| `useSettingsStore` | `mobile/src/stores/settingsStore.ts` | `navigationMode`, `theme` | persisted settings; the current shell still uses tabs and `appConfig.dark_mode` for appearance |
| `usePreviewStore` | `mobile/src/stores/previewStore.ts` | preview session ID and preview mode | set from WebSocket preview events and cleared when preview ends |
| `useUIStore` | `mobile/src/stores/uiStore.ts` | connection state and error banner | also shows toast errors |
| `useComponentStateStore` | `mobile/src/stores/componentStateStore.ts` | per-component runtime state | feeds SDUI variable resolution and stateful component interactions |

The important thing to remember is this:

- auth state comes first
- app config comes second
- tab visibility follows app config when available
- preview mode is a separate flag, not part of auth
- per-component state is local runtime state, not persisted app data

#### Mobile services and hooks

| File | Role | Notes |
|------|------|-------|
| `mobile/src/services/api.ts` | main REST client | adds auth headers, handles 401 by calling the unauthorized callback, and wraps the app’s REST calls |
| `mobile/src/services/auth.ts` | pre-auth auth helper | used for login, refresh, logout, and the setup helper |
| `mobile/src/services/websocket.ts` | shared reconnecting WebSocket wrapper | uses `reconnecting-websocket`, sends a ping every 30 seconds, and validates inbound messages with Zod |
| `mobile/src/services/appConfigService.ts` | app config fetch helper | thin helper around the device config endpoint |
| `mobile/src/hooks/useSDUIScreen.ts` | live SDUI loader | fetches live screen and draft in parallel, then keeps both in sync with WebSocket updates |
| `mobile/src/hooks/useActionDispatcher.ts` | SDUI action bridge | central place for navigation, open URL, copy text, state updates, notifications, alerts, haptics, share, conditionals, delay, refresh, and backend actions |
| `mobile/src/hooks/useVariableContext.ts` | variable context builder | combines auth info, component state, custom variables, and date helpers for expression resolution |
| `mobile/src/hooks/useDataSource.ts` | data-binding fetcher | cache-first data source loading with 30-second polling |
| `mobile/src/hooks/useBreakpoint.ts` | responsive helper | returns `compact` or `regular` for the SDUI V2 renderer |

A few details matter for maintainers:

- `useActionDispatcher()` uses `mobile/src/utils/actionEngine.ts` for composite actions such as `chain`, `conditional`, and `delay`.
- `send_to_agent` still works, but it is deprecated. Use `server_action` or `api_call` for new work.
- `useVariableContext()` and `mobile/src/utils/variableResolver.ts` work together. The hook gathers the data, and the resolver renders `{{expression}}` strings with Mustache.
- `useDataSource()` caches by `dataSourceId + query`, and `refresh_data` actions clear that cache.
- The WebSocket provider listens for `device_app_assigned`, `app_config_update`, `preview_session_started`, `preview_session_ended`, `app_version_published`, and `tabs_updated`.
- `mobile/src/utils/validation.ts` contains the Zod schema used by the WebSocket service.

#### Mobile components

| Folder | What it contains |
|--------|------------------|
| `mobile/src/components/common/` | `Button`, `Card`, `ErrorBanner`, `Input` |
| `mobile/src/components/atomic/` | `SDUIText`, `SDUIButton`, `SDUIIcon`, `SDUIImage`, `SDUIRichTextRenderer` |
| `mobile/src/components/structural/` | `SDUIContainer`, `SDUIEmpty` |
| `mobile/src/components/composite/` | `CalendarModule`, `ChatModule`, `NotesModule`, `TodoModule`, `ArticleCardModule`, `InputBar` |
| `mobile/src/components/sdui/` | `SDUIRenderer`, `DraftPreview`, `RichTextRendererComponent`, `AlertComponent`, `ArticleCardComponent`, `ListComponent`, `SDUIBadge`, `SDUIStat`, `TodoComponent` |

The mobile component system has a clear split:

- `common` components are plain native UI.
- Tier 1 structural components manage layout.
- Tier 2 atomic components are the smallest SDUI building blocks.
- Tier 3 composite components are bigger feature widgets.
- `sdui/` contains the actual JSON renderers and draft preview UI.

The key renderer files are:

- `mobile/src/components/sdui/SDUIRenderer.tsx` — renders V1 `SDUIScreen` payloads and V2 `SDUIPage` payloads
- `mobile/src/components/sdui/DraftPreview.tsx` — wraps a draft screen with approve/reject/feedback controls
- `mobile/src/renderer/componentRegistry.ts` — maps SDUI type strings to React components
- `mobile/src/utils/typeGuards.ts` — warns about unknown component types without crashing the app

Current mobile SDUI counts:

- V1 `SDUIComponentType` has 19 lowercase types
- V2 `SDUIComponentTypeV2` has 16 preferred PascalCase types
- `mobile/src/renderer/componentRegistry.ts` currently registers 24 keys, including aliases such as `Markdown` and backend snake_case names

The rule for new work is simple:

- use the PascalCase V2 names for new screens
- keep the lowercase V1 names only for old payloads
- update the mobile registry, the web editor registry, and the backend SDUI whitelist together when you add a component

#### Mobile legacy vs preferred notes

- `DraftPreview` is still the mobile approval flow for AI-generated draft screens. It is not the same thing as the web editor’s version history.
- `settingsStore.navigationMode` is persisted, but the current app shell still uses tabs. There is no drawer route today.
- `settingsStore.theme` is also persisted, but the visible theme comes from `appConfig.dark_mode` in the root layout.
- The `connect` screen is not a setup wizard anymore. It is the first-time server URL + sign-in screen.
- `AuthService.setup()` still exists as a helper, but the current mobile flow uses `login()` plus device registration.

### Web admin

#### Startup, navigation, and data flow

The web admin is a separate SPA. It does not share routing with the mobile app.

- `web/src/App.tsx` initializes auth and guards the route tree.
- `web/src/App.tsx` redirects `/` and `/dashboard` to `/editor`.
- `web/src/pages/LoginPage.tsx` is the login screen.
- `web/src/components/AdminLayout.tsx` is the main shell. It renders the left sidebar, top-level outlet, and logout button.
- The Module Editor button expands `ModulesTree` in the sidebar.
- The sidebar entries are now: App Editor, Module Editor, Templates, Workflows, Variables, Connections, Logs, and Settings.
- `AdminLayout.tsx` clears stale `module_instance_id` query params when you leave the module editor. That stops one editor selection from leaking into other pages.
- `AdminLayout.tsx` also shows a width warning below 1024px for the Module Editor.
- Most pages fetch their own data through `web/src/lib/api.ts` or the generic `useResource()` hook.
- `EditorPage.tsx` and `AppEditorPage.tsx` are the two main editing surfaces.

The web editor flow is different from the mobile draft flow:

- the mobile app renders live screens and can show a draft preview for human approval
- the web admin edits the data model itself, then saves checkpoints, versions, and publish state

#### Web state, services, and hooks

| File | Role | Notes |
|------|------|-------|
| `web/src/stores/authStore.ts` | admin auth state | restores auth from localStorage, sets the API token, and clears auth on 401 |
| `web/src/stores/useAppEditorStore.ts` | app editor state | current app, app list, selected module, and drag state |
| `web/src/stores/usePreviewStore.ts` | preview state | browser/device preview config, preview type, and preview start time |
| `web/src/lib/api.ts` | current REST client | page-level API client used by the admin pages |
| `web/src/hooks/useResource.ts` | generic async fetch hook | small wrapper for CRUD pages |
| `web/src/lib/previewResolver.ts` | preview bundle resolver | resolves app preview data and per-module screens from version policies |
| `web/src/lib/sduiTextContent.ts` | shared text helpers | markdown detection and hard-break handling for preview renderers |

A few details matter here too:

- `web/src/stores/authStore.ts` stores the admin token and user in localStorage.
- `web/src/lib/api.ts` is the compatibility client that current pages use.
- `web/src/lib/previewResolver.ts` resolves module screens in this order: newest checkpoint/version, then working draft, then legacy live screen.
- `usePreviewStore()` is used by the preview components and the app editor.

#### Web preview components

| File | Role | Notes |
|------|------|-------|
| `web/src/components/SDUIPreview.tsx` | SDUI preview renderer | renders rows/cells in the browser with DOM and CSS |
| `web/src/components/AppPhoneShell.tsx` | shared phone shell | iPhone-style frame used by App Editor and browser preview |
| `web/src/components/BrowserPreview.tsx` | full app preview | resolves app data, then renders the current app inside the phone shell |
| `web/src/components/PreviewPicker.tsx` | preview chooser | picks browser or device preview and shows device/session metadata |
| `web/src/components/AppPreviewFlow.tsx` | preview orchestrator | the main preview flow used by `EditorPage` and `TemplatesPage` |
| `web/src/components/AppPreview.tsx` | older preview helper | still in the tree, but current pages use `AppPreviewFlow` instead |
| `web/src/components/calendar/CalendarPreview.tsx` | calendar preview helper | used by `SDUIPreview` |
| `web/src/components/workflow/NodeInspector.tsx` | workflow inspector panel | used by `WorkflowsPage` |
| `web/src/components/workflow/TriggerNode.tsx` | workflow trigger node | used by `WorkflowsPage` |
| `web/src/components/AppEditor/BottomBarConfig.tsx` | bottom-bar editor | used by `AppEditorPage` |

The preview path to remember is:

`AppPreviewFlow` → `PreviewPicker` → `BrowserPreview` → `AppPhoneShell` → `SDUIPreview`

That path is the current one. `AppPreview.tsx` is an older helper, so do not build new work around it.

#### Web editor internals

| File | Role | Notes |
|------|------|-------|
| `web/src/editor/types.ts` | editor model | owns the rows-first screen model, legacy normalization, and the component registry |
| `web/src/editor/useEditorStore.ts` | editor state | rows-first Zustand store with a 50-item history window |
| `web/src/editor/cellWidthEngine.ts` | row/cell validation | pre-flight width checks, minimum width rules, and layout validation |
| `web/src/editor/componentSchemas.ts` | inspector schemas | property schemas and supported authorable actions |
| `web/src/editor/EditorCanvas.tsx` | editor canvas | rows, cells, drag handles, and the row context menu |
| `web/src/editor/PropertyInspector.tsx` | right panel | property editing for rows and components |
| `web/src/editor/StructureTree.tsx` | outline view | screen, row, and cell hierarchy |
| `web/src/editor/ModulesTree.tsx` | module sidebar | module selection, rename, and delete |
| `web/src/editor/ComponentPalette.tsx`, `web/src/editor/ComponentPicker.tsx` | component selection | choose authorable component types |
| `web/src/editor/templateLibrary.ts` | starter templates | reusable screen and row templates |
| `web/src/editor/ModuleAffectedAppsPanel.tsx` | dependency panel | shows where a module is used |
| `web/src/editor/VariablePicker.tsx`, `VariableInput.tsx`, `useVariablePicker.tsx` | variable editing | `@` picker and inline variable input helpers |
| `web/src/editor/PillEditor.tsx`, `VariablePillExtension.ts`, `VariablePillNodeView.tsx` | pill editing | inline variable pill editor |
| `web/src/editor/RuleBuilder.tsx` | rule editor | visual builder for action chains and rules |
| `web/src/editor/IconPicker.tsx` | icon picker | emoji/icon selection |
| `web/src/editor/typeGuards.ts` | type checks | warns on unknown registry types without crashing the editor |

The module editor flow is now pretty straightforward:

1. `EditorPage.tsx` reads the selected `module_instance_id` from the URL.
2. `ModulesTree.tsx` updates that query param when the user picks another module.
3. `EditorPage.tsx` loads the live screen, draft screen, templates, and version history.
4. `normalizeScreenData()` converts old `sections` payloads into the current rows/cells shape.
5. `AppPreviewFlow` opens the preview flow when the user wants to inspect the result.

A few important editor rules:

- The current editor model is rows-first.
- The canvas and inspector enforce minimum width and layout checks before the user can commit an invalid change.
- `ComponentPalette` and `ComponentPicker` only offer component types that the editor considers authorable.
- The editor still understands old lowercase payloads, but the current authoring path is the V2 PascalCase registry.

#### Web pages

| Page | File | What it does |
|------|------|--------------|
| Login | `web/src/pages/LoginPage.tsx` | admin sign-in |
| Module editor | `web/src/pages/EditorPage.tsx` | edit a single module screen |
| App editor | `web/src/pages/AppEditorPage.tsx` | edit app-level config, module policies, bottom bar, and launchpad |
| Templates | `web/src/pages/TemplatesPage.tsx` | template CRUD, preview, and apply flow |
| Workflows | `web/src/pages/WorkflowsPage.tsx` | React Flow workflow editor |
| Variables | `web/src/pages/VariablesPage.tsx` | variables and data sources |
| Connections | `web/src/pages/ConnectionsPage.tsx` | provider and connection management |
| Logs | `web/src/pages/LogsPage.tsx` | sessions + audit logs in one page |
| Settings | `web/src/pages/SettingsPage.tsx` | device assignment, app assignment, and clean-state actions |

#### Web app editor flow

`AppEditorPage.tsx` is the app-level editor, not the module editor.

- It uses `useAppEditorStore()` for current app state.
- It tracks app version history, version diffs, publish flow, module version policies, and preview mode.
- It manages bottom bar config and launchpad config through the shared AppPhoneShell preview.
- It supports browser preview and device preview through the preview picker and preview flow.
- It shows archived version warnings when a module points at a version that no longer matches the current state.
- It is the place to look when app-wide preview behavior feels wrong.

#### Web legacy vs preferred notes

- `web/src/editor/types.ts` still knows how to normalize legacy screen payloads. That is for reading old data, not for creating new data.
- `web/src/editor/typeGuards.ts` warns on unknown component types instead of throwing.
- `SettingsPage.tsx` is no longer a generic settings screen. It is now a device/app admin page plus clean-state tooling.
- `LogsPage.tsx` merged sessions and audit logs into one page.
- `ConnectionsPage.tsx` still supports custom provider definitions stored in localStorage, but the backend connection records are the source of truth.

### Shared SDUI type system

This is the part that matters most if you are adding or changing rendered UI.

| Path | Current role |
|------|--------------|
| `mobile/src/types/sdui.ts` | shared V1 and V2 SDUI types, plus `isSDUIPage()` |
| `mobile/src/renderer/componentRegistry.ts` | runtime type-string → component map for the mobile renderer |
| `mobile/src/utils/typeGuards.ts` | warns about unknown mobile component types without crashing |
| `web/src/editor/types.ts` | editor-side component registry and legacy normalization |
| `web/src/editor/typeGuards.ts` | warns about unknown editor component types without crashing |

The current type picture is:

- V1 `SDUIScreen` is the legacy section-based format.
- V2 `SDUIPage` is the preferred row/cell format.
- `isSDUIPage(payload)` treats `rows` as the V2 discriminator.
- `mobile/src/renderer/componentRegistry.ts` currently registers 24 keys.
- `web/src/editor/types.ts` currently registers 27 component definitions: 16 editable runtime types plus 11 read-only legacy/runtime entries.

The practical rule is:

- use V2 rows/cells for new screens
- use PascalCase type names for new components
- keep lowercase V1 types only for old content and compatibility
- update the mobile registry, the web registry, and the backend SDUI whitelist together when you add a component

### A few quick “where do I start?” notes

- If the mobile app does not leave the splash screen, start with `mobile/app/_layout.tsx` and `mobile/src/stores/authStore.ts`.
- If a mobile tab is missing or hidden, check `mobile/app/(tabs)/_layout.tsx`, `mobile/src/stores/tabsStore.ts`, and `mobile/src/stores/appConfigStore.ts`.
- If a mobile SDUI screen does not refresh, check `mobile/src/hooks/useSDUIScreen.ts` and `mobile/src/contexts/WebSocketContext.tsx`.
- If the module editor refuses a resize or split, check `web/src/editor/cellWidthEngine.ts`.
- If the web preview does not match the current app state, check `web/src/lib/previewResolver.ts`, `web/src/components/AppPhoneShell.tsx`, and `web/src/components/BrowserPreview.tsx`.
- If a new SDUI type appears as unknown, update the mobile registry, the web registry, and the backend whitelist together.
