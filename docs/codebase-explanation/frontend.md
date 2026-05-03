# Frontend — React Native (Expo) Mobile App + Web Admin

> Last updated: 2026-05-03

## Tier 1: TLDR

The frontend is a **React Native (Expo)** mobile app that serves as the universal UI for the Helm super app. It:

- **Authenticates** users against a self-hosted backend (connect → setup → login)
- **Renders 7 tab screens**: Home, Chat, Modules, Calendar, Forms, Alerts, Settings
- **Streams AI chat** via WebSocket with real-time token-by-token rendering
- **Integrated SDUI renderer** — AI can push any screen to any tab via MCP tools; V1 (19 component types) and V2 (compositional row+cell format) both supported
- **V2 component registry** — extensible type-string→component map; PascalCase types; atomic, structural, composite component layers
- **AI controls tab visibility** — hide/show tabs live via MCP tools
- **Uses Zustand** for state management (auth, UI, settings, tab visibility)
- **Single shared WebSocket** connection via `WebSocketContext`
- **Works on iOS, Android, and Web** (Expo universal platform)

**To run it:** `cd mobile && npx expo start`

---

## Tier 2: Deeper Explanation

### Navigation Structure (Expo Router)

```
app/
├── _layout.tsx           → RootLayout: auth guard + root providers + WebSocketProvider
├── index.tsx             → Splash/redirect while auth hydrates
├── (auth)/
│   ├── _layout.tsx       → Stack (headerShown: false)
│   ├── connect.tsx       → Server URL entry + first account setup
│   └── login.tsx         → Username/password sign-in
├── (tabs)/
│   ├── _layout.tsx       → Tabs + TabsConfigSync
│   ├── home.tsx          → SDUI-driven home (DraftPreview when draft exists)
│   ├── chat.tsx          → AI chat (WebSocket streaming)
│   ├── modules.tsx       → Module list (enable/disable tabs)
│   ├── calendar.tsx      → Month grid calendar with event dots
│   ├── forms.tsx         → SDUI-driven forms (no fallback native UI)
│   ├── alerts.tsx        → Notifications list
│   └── settings.tsx      → Server info, account, logout
└── module/
  └── [moduleId].tsx    → Dedicated custom-module SDUI route (DraftPreview when draft exists)
```

**Auth guard** (`_layout.tsx`): Calls `initialize()` + `initializeSettings()` on mount. No token → redirect to `/(auth)/connect`. Has token + in auth group → redirect to `/(tabs)/chat`.

**Tab visibility**: `TabsConfigSync` (inside `(tabs)/_layout.tsx`) fetches `GET /api/modules` on mount, maps disabled modules to `tabsStore.hiddenTabs`. Live updates via `tabs_updated` WebSocket event. Tabs use `href: null` to hide from nav bar while keeping route accessible.

---

## Screens (Full Detail)

### `app/index.tsx` — Loading Splash
Shows `ActivityIndicator` while auth loads, then redirects. No API calls.

### `app/(auth)/connect.tsx` — Server Setup
- **Shows:** Server URL field, username, password, Setup button, "Already have an account?" link
- **Default values:** URL = `http://localhost:8000`; username and password are blank by default
- **API:** `POST /auth/setup` via `AuthService.setup()`. On 409 → saves server URL, navigates to login
- **State written:** `authStore.serverUrl` (persisted to SecureStore)

### `app/(auth)/login.tsx` — Sign In
- **Shows:** Username + password fields only (no signup), "Connected to: {serverUrl}" + "Change Server" link
- **Rewritten in Session 9:** Simplified to 3 fields (username, password, server display), removed signup flow
- **API:** `POST /auth/login` with `device_id: 'web'`, `device_name: 'Web Browser'`
- **State written:** `authStore.token` + `authStore.user` (persisted)

### `app/(tabs)/home.tsx` — SDUI Home
- **Shows:** AI-generated SDUI screen, or `DraftPreview` if draft exists, or empty-state prompt
- **API:** `GET /api/sdui/home` + `GET /api/sdui/home/draft` via `useSDUIScreen('home')`
- **Approve draft:** `POST /api/actions/execute {function: "approve_draft", params: {module_id: "home"}}`
- **Reject draft:** `POST /api/actions/execute {function: "reject_draft", ...}`

### `app/(tabs)/chat.tsx` — AI Chat
- **Shows:** Chat message list (FlashList v2), typing indicator (`●●●`), text input + Send button. If AI set SDUI for chat tab, renders that instead.
- **API:** `GET /api/chat/history` on mount (reversed for display)
- **WS sent:** `{type: 'chat_message', content, conversation_id: 'default'}`
- **WS handled:** `chat_start`, `chat_token` (streaming), `chat_message_replace` (strips XML tool calls), `chat_complete`, `chat_error`, `tool_result`, `tool_error`
- **Pattern:** stale-closure-safe `wsHandlerRef` — subscription set up once on `[ws]` change, always calls latest ref

### `app/(tabs)/calendar.tsx` — Calendar
- **Shows:** Month navigation header, 7-column day grid with event dots, selected day agenda. SDUI fallback if AI sets it.
- **API:** `GET /api/calendar/events?start_date=...&end_date=...` via `useFocusEffect` (re-runs on focus + currentMonth change)
- **Performance:** `useMemo` for `calendarDays`, `eventsByDate` (O(1) lookup by date string), `selectedDayEvents`

### `app/(tabs)/alerts.tsx` — Notifications
- **Shows:** List of notification cards with title, message, formatted timestamp. SDUI fallback if set.
- **API:** `GET /api/notifications` on mount and when `[token, serverUrl]` change. Re-fetches on WS `notification` message.

### `app/(tabs)/modules.tsx` — Module Store
- **Shows:** Two-mode view: "My Modules" (installed modules with enable/disable toggles) and "Module Store" (all available templates from backend)
- **Session 9 changes:** Added Module Store view showing all templates (system + custom), tab bar customization via enable/disable toggles
- **API:** `GET /api/modules` (module list), `GET /api/templates` (template list for store view)
- **State:** `tabsStore.enabledTabIds` (user's enabled tabs, persisted to AsyncStorage)
- **Navigation:** Built-in modules route to `/(tabs)/{name}`, custom modules route to `/module/{id}`

### `app/module/[moduleId].tsx` — Custom Module Route
- **Shows:** AI-generated SDUI screen for the selected custom module, or `DraftPreview` if draft exists, or empty-state prompt
- **API:** `GET /api/sdui/{moduleId}` + `GET /api/sdui/{moduleId}/draft` via `useSDUIScreen(moduleId)`
- **Approve draft:** `POST /api/actions/execute {function: "approve_draft", params: {module_id}}`
- **Reject draft:** `POST /api/actions/execute {function: "reject_draft", params: {module_id, feedback?}}`

### `app/(tabs)/forms.tsx` — Forms
- **Shows:** SDUI-driven form screen via `useSDUIScreen('forms')`, or empty-state loading/error. **No native fallback UI** — purely SDUI.

### `app/(tabs)/settings.tsx` — Settings
- **Shows:** Server URL, Navigation Mode, Theme, Version (1.0.0), Username, Logout. SDUI fallback if set.
- **Session 9:** Settings page has 4 items only (Theme, Notifications, Data Sync, About)
- **No API calls** — display only. Logout → `authStore.logout()` → navigate to connect.

### `app/(tabs)/article.tsx` — Article Reader (NEW in Session 9)
- **Shows:** Full article content with header image, title, source, published date, and markdown content rendered via `RichTextRendererComponent`
- **Route params:** title, content, imageUrl, source, publishedAt (passed from ArticleCard navigation)
- **No API calls** — displays data passed via route params from RSS feed

---

## State Management (Zustand)

| Store | File | Key State | Persisted? |
|-------|------|-----------|----------|
| `useAuthStore` | `src/stores/authStore.ts` | `token`, `user`, `serverUrl`, `isLoading` | SecureStore: `auth_token`, `server_url`, `username` |
| `useUIStore` | `src/stores/uiStore.ts` | `isConnected`, `errorBanner: {message, retry?}` | No |
| `useSettingsStore` | `src/stores/settingsStore.ts` | `navigationMode`, `theme` | AsyncStorage: `navigation_mode`, `theme` |
| `useTabsStore` | `src/stores/tabsStore.ts` | `hiddenTabs: string[]`, `moduleConfigs: Record<string, {name, icon}>`, `enabledTabIds: string[]` | `enabledTabIds` persisted to AsyncStorage |
| `componentStateStore` | `src/stores/componentStateStore.ts` | `states: Record<componentId, Record<key, any>>` | No (in-session only) |

**Critical notes:**
- `authStore.logout()` calls `POST /auth/logout` to invalidate the server session, then clears client-side token
- `settingsStore.navigationMode` and `settingsStore.theme` are stored but **neither has any effect** on the UI
- `settingsStore` uses `AsyncStorage` directly instead of the `storage` utility (inconsistency)
- `tabsStore.hiddenTabs` is repopulated from `GET /api/modules` on every app launch
- **Session 9:** `tabsStore.enabledTabIds` controls user's customizable tab bar (persisted to AsyncStorage). Tabs are shown if: (1) in `enabledTabIds` AND (2) not in `hiddenTabs` (server-side)

---

## Services Layer

| Service | File | Purpose |
|---------|------|---------|
| `ApiClient` | `services/api.ts` | HTTP client for all REST API calls. Auto-redirects on 401. |
| `AuthService` | `services/auth.ts` | Standalone auth service for setup/login/logout (used before token exists) |
| `WebSocketService` | `services/websocket.ts` | ReconnectingWebSocket wrapper with heartbeat (30s ping), Zod validation, multi-handler subscriptions |

### ApiClient — All Methods

| Method | HTTP | Path | Notes |
|--------|------|------|-------|
| `login(data)` | POST | `/auth/login` | |
| `logout()` | POST | `/auth/logout` | |
| `healthCheck()` | GET | `/health` | |
| `getCalendarEvents(start?, end?)` | GET | `/api/calendar/events` | |
| `createCalendarEvent(event)` | POST | `/api/calendar/events` | |
| `updateCalendarEvent(id, event)` | PUT | `/api/calendar/events/{id}` | Backend bug: 404 |
| `deleteCalendarEvent(id)` | DELETE | `/api/calendar/events/{id}` | |
| `getNotifications()` | GET | `/api/notifications` | Returns `.notifications` array |
| `markNotificationRead(id)` | POST | `/api/notifications/{id}/read` | |
| `getAgentConfig()` | GET | `/api/agent/config` | |
| `updateAgentConfig(config)` | PUT | `/api/agent/config` | |
| `getWorkflows()` | GET | `/api/workflows` | |
| `createWorkflow(w)` | POST | `/api/workflows` | |
| `updateWorkflow(id, w)` | PUT | `/api/workflows/{id}` | |
| `deleteWorkflow(id)` | DELETE | `/api/workflows/{id}` | |
| `getModules()` | GET | `/api/modules` | |
| `getTemplates()` | GET | `/api/templates` | Session 9: used by Module Store view |
| `hideTab(tabId)` | DELETE | `/api/modules/{tabId}` | |
| `showTab(tabId)` | POST | `/api/modules/{tabId}/show` | |
| `configureModule(tabId, config)` | PATCH | `/api/modules/{tabId}/config` | `{name?, icon?}` body |
| `getSDUIScreen(moduleId)` | GET | `/api/sdui/{moduleId}` | `{screen, version?}` |
| `getSDUIDraft(moduleId)` | GET | `/api/sdui/{moduleId}/draft` | `{screen, has_draft}` |
| `deleteSDUIScreen(moduleId)` | DELETE | `/api/sdui/{moduleId}` | |
| `getChatHistory(conversationId?)` | GET | `/api/chat/history` | Returns `.messages` array |
| `deleteConversation(id)` | DELETE | `/api/chat/history` | |
| `executeAction(functionName, params)` | POST | `/api/actions/execute` | `{function, params}` body |

### WebSocketService

- **URL:** `${serverUrl}?token=${token}` (WS URL derived from serverUrl + `/ws` in context)
- **ReconnectingWebSocket config:** maxRetries=10, connectionTimeout=5000ms, maxReconnectionDelay=10000ms, minReconnectionDelay=1000ms
- **Heartbeat:** sends `{type: 'ping'}` every 30 seconds
- **Validation:** all incoming messages validated with `wsMessageSchema` (Zod `.passthrough()` — preserves all extra fields)

---

## Hooks

### `useSDUIScreen(moduleId)` → `SDUIScreenState`
```ts
{ screen: SDUIPayload | null, draft: SDUIPayload | null, loading: boolean,
  error: string | null, refresh: () => void }
```
- Fetches `GET /api/sdui/{moduleId}` + `GET /api/sdui/{moduleId}/draft` in parallel on mount
- Re-fetches on `[moduleId, token, serverUrl]` change
- Shared by built-in tabs and the dedicated custom-module route
- Subscribes to WS: `sdui_screen_update` (sets live screen and clears draft), `sdui_draft_update` (sets or clears draft based on `screen`), `sdui_draft_rejected` (clears draft)
- Supports both V1 (`SDUIScreen`) and V2 (`SDUIPage`) payloads via `isSDUIPage()` type guard

### `useActionDispatcher()` → `(action: SDUIAction) => void`
Memoized stable callback. Handles all SDUI action types:

| Action type | Behavior |
|-------------|----------|
| `navigate` | Maps built-in module IDs to tab routes and custom module IDs to `/module/[moduleId]`, then calls `router.push()` |
| `go_back` | `router.back()` if `canGoBack()` |
| `open_url` | Only allows `http/https/mailto/tel` schemes; calls `Linking.openURL()` |
| `copy_text` | `Clipboard.setStringAsync()` + Alert confirmation |
| `dismiss` | `router.back()` |
| `open_sheet` | Not yet implemented (stub) |
| `server_action` | `ApiClient.executeAction(function, params)` |
| `send_to_agent` | `ws.send({type:'chat_message', content})` then navigates to chat |

### `useBreakpoint()` → `'compact' | 'regular'`
Returns `'compact'` (width < 768px) or `'regular'` (width ≥ 768px). Listens to `Dimensions` change events. Used by V2 row renderer for responsive layout.

### `useVariableContext(selfId?)` → `VariableContext`
Assembles the full variable context for SDUI expression resolution. Combines:
- **User info** from auth store (`username`, `id`, `email`)
- **Component state** from `componentStateStore`
- **Custom variables** fetched from `GET /api/variables?limit=200` on first mount (module-level cache shared across instances)
- **Self state** from `componentStates[selfId]` if `selfId` provided

Returns `{ user, component, self, data, env, custom }` — consumed by `variableResolver.resolveExpression()`.

### `useDataSource(name?)` → data
Fetches from `GET /api/data-sources`, caches results. Used by V2 components for data binding via `dataBinding` field on `SDUIComponentV2`.

---

## Contexts

### `WebSocketContext` — `WebSocketProvider` / `useWebSocket()`
- Creates a single `WebSocketService` instance per `[token, serverUrl]`
- WS URL: `serverUrl.replace(/^http/, 'ws') + '/ws'`
- On connect: `uiStore.setConnected(true)`, `hideError()`
- On disconnect: `uiStore.setConnected(false)`, `showError('Connection lost', reconnect)`
- `useWebSocket()` returns `WebSocketService | null`

---

## SDUI Component System

### V1 — `SDUIScreen` (legacy, still supported)

```json
{
  "schema_version": 1,
  "sections": [
    { "id": "s1", "title": "optional", "component": { "type": "text", ... } }
  ]
}
```

Component types (lowercase): `text`, `heading`, `button`, `icon_button`, `divider`, `spacer`, `card`, `container`, `list`, `form`, `alert`, `badge`, `stat`, `stats_row`, `calendar`, `image`, `progress`

Rendered by `SDUIScreenRenderer` → `SDUIRenderer` (single component) in `src/components/sdui/SDUIRenderer.tsx`.

### V2 — `SDUIPage` (preferred)

```json
{
  "rows": [
    {
      "id": "r1",
      "cells": [
        { "id": "c1", "width": 1, "content": { "type": "Text", ... } }
      ],
      "compact": { "direction": "column" },
      "regular": { "direction": "row" },
      "scrollable": false,
      "gap": 12
    }
  ]
}
```

Persisted V2 screens are row-first. The mobile type guard only requires `rows`; `schema_version`, `module_id`, and `title` are optional on stored payloads.

Component types (PascalCase — registered in `src/renderer/componentRegistry.ts`):
`Text`, `Markdown`, `Button`, `Image`, `TextInput`, `Icon`, `Divider`, `Container`, `CalendarModule`, `ChatModule`, `NotesModule`, `InputBar`, `Badge`, `Stat`, `List`, `Alert`

Rendered by `SDUIPageRenderer` → `RowRenderer` → `CellRenderer` → `V2ComponentRenderer`.

When `scrollable: true`, rows render as horizontal card rails with fixed-width cells derived from each numeric cell width, so the mobile runtime matches the editor preview instead of flexing cells like paging rows.

Rows with a fixed height apply `overflow: 'hidden'` so that tall child content (e.g. `CalendarModule`) does not bleed into adjacent rows.

### Auto-dispatch — `SDUIUniversalRenderer`
Detects format via `isSDUIPage()` type guard and dispatches to `SDUIPageRenderer` (V2) or `SDUIScreenRenderer` (V1).

---

## Component Library

### Common (`src/components/common/`)

| Component | Props | Notes |
|-----------|-------|-------|
| `Button` | `title, onPress, variant?('primary'\|'secondary'\|'outline'), disabled?, style?` | |
| `Card` | `children, style?` | White bg, 12px radius, shadow |
| `ErrorBanner` | `message, onRetry?, onDismiss?` | Red banner |
| `Input` | `...TextInputProps` | Styled TextInput |

### V1 SDUI (`src/components/sdui/`)

| Component | Notes |
|-----------|-------|
| `AlertComponent` | Severity-colored card; `dismissible`, `onAction` |
| `DraftPreview` | Banner + preview + Approve/Reject/Add Feedback buttons |
| `ListComponent` | FlatList with icon/title/subtitle/chevron |
| `SDUIRenderer` / `SDUIScreenRenderer` / `SDUIPageRenderer` / `SDUIUniversalRenderer` | Main renderer |

**Note:** `CalendarComponent.tsx` and `FormComponent.tsx` were deleted in Session 10 (Phase A) — they were not in the component registry and had zero callers. `AlertComponent` and `ListComponent` still exist but are not imported by `SDUIRenderer.tsx` (it renders all V1 types inline).

### V2 Atomic (`src/components/atomic/`)

| Component | Key Props |
|-----------|-----------|
| `SDUIText` | `content, variant?('heading'\|'body'\|'caption'), color?, bold?, italic?, underline?, strikethrough?, align?, numberOfLines?, selectable?` |
| `SDUIMarkdown` | `content` — uses `react-native-markdown-display` library |
| `SDUIButton` | `label?, icon?, variant?('primary'\|'secondary'\|'ghost'\|'icon'\|'destructive'), size?('sm'\|'md'\|'lg'), loading?, fullWidth?, dispatch?` |
| `SDUIImage` | `src, alt?, width?, height?, aspectRatio?, borderRadius?, onPress?, placeholder?('blur'\|'skeleton'\|'none')` |
| `SDUITextInput` | `value?, onChangeText?, placeholder?, multiline?, maxLines?, secureTextEntry?, keyboardType?, editable?` |
| `SDUIIcon` | `name` (Feather name → emoji/unicode map, ~40 icons), `size?, color?, onPress?` |
| `SDUIDivider` | `direction?('horizontal'\|'vertical'), thickness?, color?, indent?, margin?` |

### V2 Structural (`src/components/structural/`)

| Component | Key Props |
|-----------|-----------|
| `SDUIContainer` | `direction?, gap?, padding?, backgroundColor?, borderRadius?, shadow?('sm'\|'md'\|'lg'), flex?, align?, justify?, children?` |

Uses `resolveColor()` and `themeShadows` from `src/theme/tokens.ts`.

### V2 Composite (`src/components/composite/`)

| Component | Status | Notes |
|-----------|--------|-------|
| `CalendarModule` | Full MVP | Uses `react-native-calendars`; month/week/day/agenda variants; event dots; day agenda; pull-to-refresh |
| `ChatModule` | Placeholder | Shows "navigate to Chat tab"; pull-to-refresh via RefreshControl |
| `NotesModule` | Implemented | TextInput + SDUIMarkdown preview; pull-to-refresh via RefreshControl |
| `InputBar` | Full MVP | Text input + send strip; send stays disabled unless both `onSend` and `dispatch` are available, and typed text is only cleared after a send action actually dispatches |
| `TodoModule` | Implemented | FF3: Todo list with toggle, add, delete actions |
| `ArticleCardModule` | Implemented | FF3: Article preview card with image, metadata, tap navigation |

### V2 SDUI Components (NEW in Session 9)

| Component | File | Key Props | Notes |
|-----------|------|-----------|-------|
| `CalendarComponent` | `src/components/sdui/CalendarComponent.tsx` | `events, variant?('month'\|'week'\|'day'\|'agenda'), onEventPress?, onAction?` | Rewritten with variant support and date navigation controls |
| `TodoComponent` | `src/components/sdui/TodoComponent.tsx` | `items: {id, text, completed}[], placeholder?, onToggle?, onAdd?, onDelete?, dispatch?` | Checkbox list with add/delete actions |
| `RichTextRendererComponent` | `src/components/sdui/RichTextRendererComponent.tsx` | `content (markdown), theme?('light'\|'dark'), dispatch?` | Custom regex-based markdown parser (headings, bold, italic, lists, links, code blocks, blockquotes) |
| `ArticleCardComponent` | `src/components/sdui/ArticleCardComponent.tsx` | `title, description, imageUrl?, publishedAt, source, onPress?, dispatch?` | News article card with image, metadata, and tap action |

### Component Registry (`src/renderer/componentRegistry.ts`)

```ts
resolveComponent(type: string) // → React component or undefined
registerComponent(type, component) // extend registry at runtime
getRegisteredTypes() // → string[]
```

---

## Theme & Design Tokens

### `src/theme/colors.ts`
iOS-style color palette + spacing + border radius + typography:

```ts
// Colors
primary: '#007AFF'     secondary: '#5856D6'   success: '#34C759'
warning: '#FF9500'     error: '#FF3B30'        info: '#5AC8FA'
background: '#FFFFFF'  surface: '#F2F2F7'      card: '#FFFFFF'
text: '#000000'        textSecondary: '#8E8E93' border: '#C6C6C8'
// Dark mode tokens also defined (not yet applied to UI)

// Spacing: xs:4, sm:8, md:16, lg:24, xl:32, xxl:48
// Border radius: sm:4, md:8, lg:12, xl:16, full:9999
// Typography: largeTitle(34/700), title1(28/700), title2(22/700),
//   title3(20/600), headline(17/600), body(17/400), callout(16/400),
//   subheadline(15/400), footnote(13/400), caption1(12/400), caption2(11/400)
```

### `src/theme/tokens.ts`
V2 renderer tokens:

```ts
themeColors    // extended palette + primaryLight, surfaceElevated
themeShadows   // { sm, md, lg } shadow objects for SDUIContainer
resolveColor(tokenOrHex, fallback?)  // resolves token name or passes through hex
```

---

## Types

### `src/types/sdui.ts` — SDUI Type System

**`SDUIAction`** (discriminated union): `navigate`, `go_back`, `api_call`, `server_action`, `send_to_agent`, `dismiss`, `open_sheet`, `copy_text`, `open_url`, `toggle`

**V1:** `SDUISection`, `SDUIScreen` (schema_version: 1)

**V2:** `SDUICell { id, width, content }`, `SDUIRow { id, cells, compact?, regular?, scrollable?, gap?, padding?, paddingTop?, paddingBottom?, paddingLeft?, paddingRight?, backgroundColor? }`, `SDUIPage { schema_version?: '1.0.0', module_id?: string, title?: string, rows }`

The mobile runtime uses the per-side row padding values when present and falls back to `padding` for uniform spacing.

Persisted rows-first payloads may omit page wrapper metadata; `isSDUIPage(payload)` now treats `rows` as the accepted V2 discriminator.

**`SDUIPayload`** = `SDUIScreen | SDUIPage`

**`isSDUIPage(payload)`** — type guard

### `src/types/api.ts`
```ts
User, SetupRequest, SetupResponse, LoginRequest, LoginResponse,
ChatMessage, CalendarEvent, Notification, AgentConfig, Workflow, Module, Device
```

---

## Package Dependencies

| Package | Version |
|---------|---------|
| `expo` | ~55.0.8 |
| `expo-router` | ^55.0.7 |
| `react` | 19.2.0 |
| `react-native` | 0.83.2 |
| `zustand` | ^5.0.12 |
| `zod` | ^4.3.6 |
| `date-fns` | ^4.1.0 |
| `reconnecting-websocket` | ^4.4.0 |
| `@react-native-async-storage/async-storage` | ^3.0.1 |
| `expo-secure-store` | ^55.0.9 |
| `expo-clipboard` | ~55.0.9 |
| `@react-navigation/bottom-tabs` | ^7.15.6 |
| `react-native-gesture-handler` | ^2.30.0 |
| `react-native-reanimated` | ^4.2.3 |
| `@shopify/flash-list` | ^2.x | Session 10: replaces FlatList in chat |
| `react-native-markdown-display` | ^7.x | Session 10: replaces custom regex parser in SDUIMarkdown |
| `react-native-calendars` | ^1.x | Session 10: used in CalendarModule |
| `react-native-toast-message` | ^2.x | Session 10: wired to uiStore.showError() |
| `mustache` | ^4.x | Session 10: used in variableResolver.ts |
| `nativewind` | ^4.x | Session 10: Tailwind className styling for RN |
| `typescript` | ~5.9.2 |

---

## Web Admin Panel (`web/`)

A separate React + TypeScript web application for backend administration. **Not part of the mobile app** — this is a standalone Vite SPA that communicates with the same backend API.

### Tech Stack

| Tech | Purpose |
|------|---------|
| Vite | Build tool + dev server |
| React 19 + TypeScript | UI framework |
| Tailwind CSS | Styling |
| Zustand | App + auth + preview state management |
| React Router | Client-side routing |
| React Flow | Workflow visual editor |
| @dnd-kit/sortable | Row drag-and-drop in EditorCanvas (Session 10) |
| React Hook Form + Zod | Form state + validation in ConnectionsPage and VariablesPage (Session 10) |
| sonner | Toast notifications (Session 10) |
| openapi-ts | Typed SDK generation from OpenAPI spec (`npm run generate:api`) |
| Custom editor components | Visual SDUI editor built from React + Zustand editor primitives |

### Architecture

```
web/src/
├── main.tsx              → React entry point
├── App.tsx               → React Router + auth guard + AdminLayout + sonner Toaster
├── index.css             → Tailwind globals
├── components/
│   ├── AdminLayout.tsx   → Sidebar nav + top bar; Session 9: restructured sidebar; Session 11: App Editor link
│   ├── SDUIPreview.tsx   → Template preview with simplified component renderers
│   ├── AppPreview.tsx    → Whole app preview with tab navigation
│   ├── PreviewPicker.tsx → Preview mode picker (browser vs device)
│   ├── BrowserPreview.tsx → Browser-based full app preview modal
│   └── AppEditor/
│       └── BottomBarConfig.tsx → Draggable bottom bar slot configuration (Session 11)
├── pages/
│   ├── LoginPage.tsx     → Auth against /auth/login
│   ├── AppEditorPage.tsx → NEW Session 11: Multi-app management; 3-column layout with sidebar + iPhone mockup center + right panel
│   ├── EditorPage.tsx    → Custom SDUI editor; ModulesTree sidebar using SDUIModule interface; draft save/push-live; session logs for debugging
│   ├── TemplatesPage.tsx → SDUI template CRUD + import/export + preview (Session 9)
│   ├── WorkflowsPage.tsx → React Flow visual workflow builder with node inspector (Session 9)
│   ├── VariablesPage.tsx → Custom variable management with React Hook Form + Zod (Session 10)
│   ├── ConnectionsPage.tsx → OAuth/API key management with Fernet encryption (Session 9)
│   ├── SettingsPage.tsx  → General settings (Session 9: replaced Users page)
│   ├── LogsPage.tsx      → Merged Sessions + Audit Logs (Session 9)
│   └── PillEditorTestPage.tsx → Test harness for PillEditor variable inline editing
├── editor/
│   ├── types.ts          → Editor types, row visual props, device presets, component registry; preserves lowercase legacy types as read-only; requires valid server_action.function+params before persistence
│   ├── templateLibrary.ts→ Local starter screens + reusable row templates; starter InputBar no longer seeds dead send_to_agent.message defaults
│   ├── componentSchemas.ts → Dynamic property schemas for inspector; only supported authorable actions offered for new edits; Session 9: Todo, RichTextRenderer, ArticleCard, Calendar variants; FF3 gap fix: Divider (color, thickness, margin)
│   ├── useEditorStore.ts → Rows-first Zustand contract, 50-state undo/redo, selection, device preview; exports MIN_ROW_HEIGHT=48 constant; updateRowHeight() clamps to MIN_ROW_HEIGHT; serializeCellForRuntime() preserves rules array
│   ├── StructureTree.tsx → Left panel tree + JSON copy actions
│   ├── EditorCanvas.tsx  → Center canvas with cell resize, row-height resize, @dnd-kit/sortable multi-step row drag, external drag handles, percentage width rendering; PREVIEW_RENDERERS includes EmptyPreview and RichTextRendererPreview
│   ├── PropertyInspector.tsx → Right panel editor with auto width controls, uniform + per-side padding, InputBar action narrowing, read-only summaries for legacy payloads; Session 9: width toggle, VariableInput integration
│   ├── VariablePicker.tsx → @ trigger variable picker with namespace support; includes Date category (date.today, date.now) in STATIC_NAMESPACES
│   ├── VariableInput.tsx → Text input with variable picker integration
│   ├── useVariablePicker.tsx → Hook for variable picker state management
│   ├── ComponentPicker.tsx → Component type chooser for empty cells
│   ├── ModulesTree.tsx   → Module instance tree sidebar; SDUIModule interface (module_id, name, icon, has_screen, is_custom); direct /api/sdui/modules fetch; RenameModuleModal and DeleteModuleModal
│   ├── RenameModuleModal.tsx → Inline rename dialog for modules
│   ├── DeleteModuleModal.tsx → Inline delete dialog for modules with redirect on success
│   ├── PillEditor.tsx    → Variable pill inline editor with @ trigger; value-comparison guard in onUpdate prevents cursor snap during typing
│   ├── VariablePillExtension.ts → TipTap/ProseMirror extension for variable pills
│   ├── VariablePillNodeView.tsx → Node view for pill rendering in editor
│   ├── variableResolver.ts → Variable resolution for editor
│   ├── ActionParamsEditor.tsx → Parameter editor for action steps
│   ├── RuleBuilder.tsx   → Notion-style visual rule builder for action chains
│   ├── IconPicker.tsx    → Emoji/icon picker for module/app icons
│   ├── PILL_EDITOR_QUICK_REFERENCE.ts → Documentation for pill editor behavior
│   ├── VARIABLE_PICKER.md → Variable picker documentation
│   └── pill-editor.css   → Pill editor styles
├── stores/
│   ├── authStore.ts      → Zustand auth store (token, user, serverUrl); failed /auth/login requests do not clear auth state
│   ├── useAppEditorStore.ts → NEW Session 11: App management state (App, ModuleInstance, BottomBarSlot types; CRUD operations)
│   └── usePreviewStore.ts → NEW Session 11: Preview mode state (startPreview, exitPreview, previewAppConfig, previewType)
└── lib/
    ├── api.ts            → Typed fetch wrapper; login suppresses global 401 handler; Session 9: connections, workflows, template preview; Session 10: openapi-ts SDK; Session 11: app endpoints, module instance endpoints, data source CRUD, trigger CRUD + test
    └── utils.ts          → Shared helpers
```

### Custom SDUI Editor

The editor page (`/editor`) is a custom React + Zustand SDUI editor built from `EditorPage.tsx` and the `web/src/editor/` folder. It loads live and draft module screens in parallel, prefers the draft when both exist, surfaces module/screen load failures instead of fabricating fallback module state, normalizes legacy payloads in `normalizeScreenData()`, preserves V1 section titles by turning them into heading rows, imports each legacy section component into its own row so V1 section stacks stay vertical instead of being flattened horizontally, preserves lowercase legacy runtime components including legacy form payloads as type-stable read-only inspectable entries rather than rewriting them or surfacing them as Unknown, and no longer depends on a Puck translation layer.

**Module selection:** Uses `SDUIModule` interface (`module_id`, `name`, `icon`, `has_screen`, `is_custom`) loaded from `GET /api/sdui/modules`. URL param `module_instance_id` maps to `module_id`. Session logs (`[Editor]` prefix) added for debugging module loads and screen fetches.

**Core layout:**
- The left panel combines `StructureTree` with a collapsible Template Library
- `StructureTree` includes a screen root item plus row/cell hierarchy, row reorder, duplication/delete, and copy-screen/copy-row JSON actions
- The Template Library surfaces saved full-screen templates from `/api/templates` and local starter/row templates from `templateLibrary.ts`

**Editing flow:**
- Device preview supports presets, rotation, and custom width/height values with an explicit Apply action; the toolbar and status bar read actual `deviceWidth`/`deviceHeight` from the Zustand store
- The canvas provides component previews, add-row buttons, row drag handles, cell width resize handles, and direct row-height drag handles
- Multi-step row dragging uses a 50px movement threshold and 300ms debounce to prevent overshoot
- `ComponentPicker` only offers components marked authorable in `types.ts`
- `PropertyInspector` edits row height, cell count, cell widths, background, uniform and per-side padding, horizontal scrollability, and component props/actions
- New actions limited to supported authorable set (`navigate`, `server_action`, `open_url`, `go_back`, `send_to_agent`, `dismiss`, `copy_text`)
- Save stores a draft; Push Live saves then auto-approves it
- Delete Screen only enabled when module has a persisted live screen or pending draft

### App Editor (`/app-editor`)

**NEW in Session 11:** Multi-app management page with 3-column layout.

- **Left sidebar:** Bottom bar configuration with drag-and-drop slot management (5-slot cap)
- **Center:** iPhone mockup preview showing bottom bar layout
- **Right panel:** Launchpad section (modules not in bottom bar) + app properties (name, icon, dark mode)
- **State:** `useAppEditorStore` — `App` type with id, user_id, name, icon, splash, theme, design_tokens, dark_mode, default_launch_module_instance_id, bottom_bar_config, launchpad_config
- **Preview:** `usePreviewStore` with `startPreview()` launching browser-based iframe preview of app configuration
- **API calls:** `getApps()`, `createApp()`, `updateApp()`, `deleteApp()`, `updateAppBottomBar()` via `/api/apps` endpoints

---

## Session 9 Web Admin Changes Summary

**Sidebar restructure:**
- New order: Visual Editor, Templates, Workflows, Variables, Connections, Advanced (collapsible), Settings
- Removed pages: Dashboard (hidden, not deleted), Components, Actions & Triggers
- New pages: ConnectionsPage, LogsPage (merged Sessions + Audit), WorkflowsPage (React Flow)

**WorkflowsPage:**
- React Flow visual workflow builder with node inspector
- Graph-based workflow execution (branching, loops)
- n8n workflow importer endpoint

**ConnectionsPage:**
- OAuth and API key management
- Fernet encryption for sensitive credentials
- Provider-based connection storage

**TemplatesPage:**
- Added SDUIPreview component for template preview
- Added AppPreview component for whole app preview with tab navigation

**Editor improvements:**
- Percentage widths for cells (flex vs percentage toggle)
- VariablePicker with @ trigger for variable insertion
- External drag handles for rows
- New component schemas: Todo, RichTextRenderer, ArticleCard, Calendar variant
