# Frontend — React Native (Expo) Mobile App

> Last updated: 2026-04-03

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
├── _layout.tsx           → RootLayout: auth guard + root providers
├── index.tsx             → Splash/redirect while auth hydrates
├── (auth)/
│   ├── _layout.tsx       → Stack (headerShown: false)
│   ├── connect.tsx       → Server URL entry + first account setup
│   └── login.tsx         → Username/password sign-in
└── (tabs)/
    ├── _layout.tsx       → Tabs + WebSocketProvider + TabsConfigSync
    ├── home.tsx          → SDUI-driven home (DraftPreview when draft exists)
    ├── chat.tsx          → AI chat (WebSocket streaming)
    ├── modules.tsx       → Module list (enable/disable tabs)
    ├── calendar.tsx      → Month grid calendar with event dots
    ├── forms.tsx         → SDUI-driven forms (no fallback native UI)
    ├── alerts.tsx        → Notifications list
    └── settings.tsx      → Server info, account, logout
```

**Auth guard** (`_layout.tsx`): Calls `initialize()` + `initializeSettings()` on mount. No token → redirect to `/(auth)/connect`. Has token + in auth group → redirect to `/(tabs)/chat`.

**Tab visibility**: `TabsConfigSync` (inside `(tabs)/_layout.tsx`) fetches `GET /api/modules` on mount, maps disabled modules to `tabsStore.hiddenTabs`. Live updates via `tabs_updated` WebSocket event. Tabs use `href: null` to hide from nav bar while keeping route accessible.

---

## Screens (Full Detail)

### `app/index.tsx` — Loading Splash
Shows `ActivityIndicator` while auth loads, then redirects. No API calls.

### `app/(auth)/connect.tsx` — Server Setup
- **Shows:** Server URL field, username, password, Setup button, "Already have an account?" link
- **Default values:** URL = `http://localhost:8000`, username = `testuser`, password = `testpass123`
- **API:** `POST /auth/setup` via `AuthService.setup()`. On 409 → saves server URL, navigates to login
- **State written:** `authStore.serverUrl` (persisted to SecureStore)

### `app/(auth)/login.tsx` — Sign In
- **Shows:** Username + password fields, "Connected to: {serverUrl}" + "Change Server" link
- **API:** `POST /auth/login` with `device_id: 'web'`, `device_name: 'Web Browser'`
- **State written:** `authStore.token` + `authStore.user` (persisted)

### `app/(tabs)/home.tsx` — SDUI Home
- **Shows:** AI-generated SDUI screen, or `DraftPreview` if draft exists, or empty-state prompt
- **API:** `GET /api/sdui/home` + `GET /api/sdui/home/draft` via `useSDUIScreen('home')`
- **Approve draft:** `POST /api/actions/execute {function: "approve_draft", params: {module_id: "home"}}`
- **Reject draft:** `POST /api/actions/execute {function: "reject_draft", ...}`

### `app/(tabs)/chat.tsx` — AI Chat
- **Shows:** Chat message list (FlatList), typing indicator (`●●●`), text input + Send button. If AI set SDUI for chat tab, renders that instead.
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

### `app/(tabs)/modules.tsx` — Module Manager
- **Shows:** FlatList of modules with icon, name, description, enabled/disabled badge. SDUI fallback if set.
- **API:** `GET /api/modules` on mount.

### `app/(tabs)/forms.tsx` — Forms
- **Shows:** SDUI-driven form screen via `useSDUIScreen('forms')`, or empty-state loading/error. **No native fallback UI** — purely SDUI.

### `app/(tabs)/settings.tsx` — Settings
- **Shows:** Server URL, Navigation Mode, Theme, Version (1.0.0), Username, Logout. SDUI fallback if set.
- **No API calls** — display only. Logout → `authStore.logout()` → navigate to connect.

---

## State Management (Zustand)

| Store | File | Key State | Persisted? |
|-------|------|-----------|----------|
| `useAuthStore` | `src/stores/authStore.ts` | `token`, `user`, `serverUrl`, `isLoading` | SecureStore: `auth_token`, `server_url`, `username` |
| `useUIStore` | `src/stores/uiStore.ts` | `isConnected`, `errorBanner: {message, retry?}` | No |
| `useSettingsStore` | `src/stores/settingsStore.ts` | `navigationMode`, `theme` | AsyncStorage: `navigation_mode`, `theme` |
| `useTabsStore` | `src/stores/tabsStore.ts` | `hiddenTabs: string[]`, `moduleConfigs: Record<string, {name, icon}>` | No (reloaded from server) |

**Critical notes:**
- `authStore.logout()` clears client-side token but **does NOT call `/auth/logout`**
- `settingsStore.navigationMode` and `settingsStore.theme` are stored but **neither has any effect** on the UI
- `settingsStore` uses `AsyncStorage` directly instead of the `storage` utility (inconsistency)
- `tabsStore.hiddenTabs` is repopulated from `GET /api/modules` on every app launch

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
- Subscribes to WS: `sdui_screen_update` (sets live screen), `sdui_draft_update` (sets draft), `sdui_draft_rejected` (clears draft)
- Supports both V1 (`SDUIScreen`) and V2 (`SDUIPage`) payloads via `isSDUIPage()` type guard

### `useActionDispatcher()` → `(action: SDUIAction) => void`
Memoized stable callback. Handles all SDUI action types:

| Action type | Behavior |
|-------------|----------|
| `navigate` | Maps module IDs to tab routes, calls `router.push()` |
| `go_back` | `router.back()` if `canGoBack()` |
| `open_url` | Only allows `http/https/mailto/tel` schemes; calls `Linking.openURL()` |
| `copy_text` | `Clipboard.setStringAsync()` + Alert confirmation |
| `dismiss` | `router.back()` |
| `open_sheet` | Not yet implemented (stub) |
| `server_action` | `ApiClient.executeAction(function, params)` |
| `send_to_agent` | `ws.send({type:'chat_message', content})` then navigates to chat |

### `useBreakpoint()` → `'compact' | 'regular'`
Returns `'compact'` (width < 768px) or `'regular'` (width ≥ 768px). Listens to `Dimensions` change events. Used by V2 row renderer for responsive layout.

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
  "schema_version": "1.0.0",
  "module_id": "home",
  "title": "optional",
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

Component types (PascalCase — registered in `src/renderer/componentRegistry.ts`):
`Text`, `Markdown`, `Button`, `Image`, `TextInput`, `Icon`, `Divider`, `Container`, `CalendarModule`, `ChatModule`, `NotesModule`, `InputBar`

Rendered by `SDUIPageRenderer` → `RowRenderer` → `CellRenderer` → `V2ComponentRenderer`.

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
| `CalendarComponent` | Event list with color bars |
| `DraftPreview` | Banner + preview + Approve/Reject/Add Feedback buttons |
| `FormComponent` | Controlled form; validates required fields |
| `ListComponent` | FlatList with icon/title/subtitle/chevron |
| `SDUIRenderer` / `SDUIScreenRenderer` / `SDUIPageRenderer` / `SDUIUniversalRenderer` | Main renderer |

**⚠️ Dead code:** `AlertComponent`, `CalendarComponent`, `FormComponent`, `ListComponent` are NOT used by `SDUIRenderer.tsx` (it renders all V1 types inline). These files exist but are not imported.

### V2 Atomic (`src/components/atomic/`)

| Component | Key Props |
|-----------|-----------|
| `SDUIText` | `content, variant?('heading'\|'body'\|'caption'), color?, bold?, italic?, underline?, strikethrough?, align?, numberOfLines?, selectable?` |
| `SDUIMarkdown` | `content` — regex-based inline + block-level markdown parsing |
| `SDUIButton` | `label?, icon?, variant?('primary'\|'secondary'\|'ghost'\|'icon'\|'destructive'), size?('sm'\|'md'\|'lg'), loading?, fullWidth?, dispatch?` |
| `SDUIImage` | `src, alt?, width?, height?, aspectRatio?, borderRadius?, onPress?, placeholder?('blur'\|'skeleton'\|'none')` |
| `SDUITextInput` | `value?, onChangeText?, placeholder?, multiline?, maxLines?, secureTextEntry?, keyboardType?, editable?` |
| `SDUIIcon` | `name` (Feather name → emoji/unicode map, ~40 icons), `size?, color?, onPress?` |
| `SDUIDivider` | `direction?('horizontal'\|'vertical'), thickness?, color?, indent?` |

### V2 Structural (`src/components/structural/`)

| Component | Key Props |
|-----------|-----------|
| `SDUIContainer` | `direction?, gap?, padding?, backgroundColor?, borderRadius?, shadow?('sm'\|'md'\|'lg'), flex?, align?, justify?, children?` |

Uses `resolveColor()` and `themeShadows` from `src/theme/tokens.ts`.

### V2 Composite (`src/components/composite/`)

| Component | Status | Notes |
|-----------|--------|-------|
| `CalendarModule` | Full MVP | Month grid + 3-day view stub; event dots; day agenda |
| `ChatModule` | Placeholder | Shows "navigate to Chat tab" |
| `NotesModule` | Placeholder | Shows "Notes will appear here" |
| `InputBar` | Full MVP | `[⚙️][TextInput][➤]` strip with optional settings items |

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

**V2:** `SDUICell { id, width, content }`, `SDUIRow { id, cells, compact?, regular?, scrollable?, gap?, padding?, backgroundColor? }`, `SDUIPage { schema_version: '1.0.0', module_id, title?, rows }`

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
| `typescript` | ~5.9.2 |
