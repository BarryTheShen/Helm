# Implementation Plan — Helm Mobile Frontend (React Native Expo)

## Overview

This plan describes building the Helm iOS client — a Server-Driven UI (SDUI) React Native app that renders JSON payloads from the Helm FastAPI backend. The backend is fully implemented. This plan covers the mobile frontend only, scaffolded at `mobile/` alongside the existing `backend/` directory.

The app is TypeScript-strict, uses Expo Router v4 for file-based routing, Zustand for state, expo-secure-store for token persistence, and a custom WebSocket state machine for real-time communication.

---

## Section 1: Project Scaffold & Configuration

### What to Build

Initialize an Expo managed workflow project at `mobile/` using `create-expo-app` with the blank-typescript template. Configure TypeScript strict mode in `tsconfig.json`. Set up path aliases (`@/` → `src/`) in both tsconfig and babel config.

Install all dependencies:
- `expo-router` — file-based routing
- `expo-secure-store` — keychain-backed token storage
- `react-native-reanimated` — animations
- `react-native-gesture-handler` — gesture support
- `react-native-safe-area-context` — safe area insets
- `@react-navigation/bottom-tabs` — tab navigator
- `zustand` — state management
- `date-fns` — date formatting and arithmetic
- `zod` — runtime schema validation at API/WS boundary
- `expo-status-bar` — status bar control

Create the full directory skeleton described in the spec (all folders, empty `index.ts` barrel files where needed).

Configure `app.json` / `app.config.ts`:
- `scheme`: `helm`
- `ios.bundleIdentifier`: `com.helm.app`
- `ios.minimumOsVersion`: `"16.0"`
- `plugins`: reanimated plugin

Create `babel.config.js` with reanimated plugin (must be last).

### Tests
- Verify `npx expo export` completes without errors after scaffold
- Verify TypeScript compiles with `tsc --noEmit`

---

## Section 2: Theme System

### What to Build

Create the design token layer at `src/theme/`.

**`colors.ts`** — export a `Colors` const object:
- `primary`: `#007AFF` (iOS blue)
- `background`: `#000000`
- `surface`: `#1C1C1E`
- `surfaceElevated`: `#2C2C2E`
- `text`: `#FFFFFF`
- `textSecondary`: `#8E8E93`
- `textTertiary`: `#48484A`
- `border`: `#38383A`
- `success`: `#30D158`
- `warning`: `#FFD60A`
- `error`: `#FF453A`
- `info`: `#0A84FF`
- Severity map: `{ info: Colors.info, warning: Colors.warning, error: Colors.error, success: Colors.success }`

**`typography.ts`** — export `Typography` const:
- Font sizes: `xs: 12`, `sm: 14`, `base: 16`, `lg: 18`, `xl: 20`, `xxl: 24`, `xxxl: 32`
- Font weights: `regular: '400'`, `medium: '500'`, `semibold: '600'`, `bold: '700'`
- Line heights corresponding to each size

**`spacing.ts`** — export `Spacing` const:
- `xs: 4`, `sm: 8`, `md: 12`, `base: 16`, `lg: 20`, `xl: 24`, `xxl: 32`, `xxxl: 48`
- `borderRadius`: `sm: 8`, `md: 12`, `lg: 16`, `xl: 24`, `full: 9999`

### Tests
- Unit: verify all token values are defined and are the correct JS types

---

## Section 3: Types & Validation Schemas

### What to Build

**`src/types/api.ts`** — TypeScript interfaces for all REST API request/response shapes:
- `LoginRequest: { username: string; password: string }`
- `LoginResponse: { access_token: string; token_type: string }`
- `UserProfile: { id: number; username: string; device_name?: string }`
- `AgentConfig: { id: number; provider: string; model: string; base_url: string; system_prompt?: string }`
- `AgentConfigUpdate: Partial<Omit<AgentConfig, 'id'>>`
- `CalendarEvent: { id: number; title: string; start: string; end: string; color?: string; description?: string; location?: string; is_all_day: boolean; is_alert: boolean; alert_message?: string }`
- `Notification: { id: number; title: string; message: string; severity: 'info'|'warning'|'error'|'success'; is_read: boolean; created_at: string }`
- `ModuleState: { id: number; module_type: string; state_json: Record<string, unknown>; version: number }`
- `ChatMessage: { id: number; role: 'user'|'assistant'; content: string; timestamp: string; metadata_json?: Record<string, unknown> }`

**`src/types/sdui.ts`** — Discriminated union for SDUI component payloads:
```typescript
export type SDUICalendarProps = { view: 'month'|'day'; currentDate: string; events: CalendarEvent[] }
export type SDUIFormField = { name: string; type: FieldType; label: string; ... }
export type SDUIFormProps = { title: string; submitUrl: string; fields: SDUIFormField[] }
export type SDUIAlertProps = { severity: Severity; title: string; message: string; timestamp: string; isRead: boolean }
export type SDUIComponent =
  | { type: 'calendar'; props: SDUICalendarProps }
  | { type: 'form'; props: SDUIFormProps }
  | { type: 'alert'; props: SDUIAlertProps }
```

**`src/types/navigation.ts`** — Expo Router typed routes (use `expo-router`'s `Href` type).

**`src/utils/validation.ts`** — Zod schemas mirroring the types above. Export parse functions:
- `parseCalendarEvent(data: unknown): CalendarEvent`
- `parseNotification(data: unknown): Notification`
- `parseSDUIComponent(data: unknown): SDUIComponent`
- `parseChatMessage(data: unknown): ChatMessage`
- All throw `ZodError` on invalid data — callers catch and handle

**WebSocket message types** in `src/types/websocket.ts`:
```typescript
export type WsServerMessage =
  | { type: 'connected'; deviceId: string; userId: number; serverVersion: string }
  | { type: 'ping' }
  | { type: 'chat_token'; messageId: string; token: string; index: number }
  | { type: 'chat_complete'; messageId: string; role: string; content: string; timestamp: string; embeddedComponents?: SDUIComponent[] }
  | { type: 'chat_error'; code: string; message: string; retryable: boolean }
  | { type: 'tool_call_start'; messageId: string; toolName: string; toolCallId: string }
  | { type: 'tool_call_complete'; messageId: string; toolCallId: string; toolName: string; success: boolean; resultSummary?: string }
  | { type: 'ui_update'; module: string; component: SDUIComponent }
  | { type: 'notification'; payload: Notification }
  | { type: 'pong' }
export type WsClientMessage =
  | { type: 'chat_message'; content: string; messageId: string }
  | { type: 'ping' }
  | { type: 'pong' }
```

### Tests
- Unit: Zod schemas reject invalid data and pass valid data for each type
- Unit: discriminated union SDUIComponent correctly narrows on `type` field

---

## Section 4: Zustand Stores

### What to Build

Three stores, each a separate file under `src/stores/`. Export a combined `useStore` from `src/stores/index.ts`.

**`authStore.ts`**:
```typescript
interface AuthState {
  token: string | null
  user: UserProfile | null
  serverUrl: string | null
  isLoading: boolean
  error: string | null
  setToken(token: string): void
  setUser(user: UserProfile): void
  setServerUrl(url: string): void
  setLoading(v: boolean): void
  setError(msg: string | null): void
  logout(): void  // clears token + user, wipes SecureStore
}
```
Persist `token` and `serverUrl` to expo-secure-store on set. Rehydrate on app start.

**`uiStore.ts`**:
```typescript
interface ChatEntry {
  id: string
  role: 'user' | 'assistant' | 'tool_call'
  content: string
  isStreaming?: boolean
  toolName?: string
  toolCallId?: string
  toolStatus?: 'pending' | 'complete' | 'error'
  resultSummary?: string
  embeddedComponents?: SDUIComponent[]
  timestamp: string
}
interface UIState {
  connectionState: 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
  chatHistory: ChatEntry[]
  isStreaming: boolean
  activeMessageId: string | null
  calendarData: SDUICalendarProps | null
  formData: SDUIFormProps | null
  notifications: Notification[]
  unreadCount: number
  // actions
  setConnectionState(s: ConnectionState): void
  appendChatToken(messageId: string, token: string): void
  finalizeChatMessage(msg: WsChatComplete): void
  addUserMessage(content: string, messageId: string): void
  setChatError(code: string, message: string): void
  addToolCallStart(data: WsToolCallStart): void
  updateToolCallComplete(data: WsToolCallComplete): void
  updateCalendar(props: SDUICalendarProps): void
  updateForm(props: SDUIFormProps): void
  addNotification(n: Notification): void
  markNotificationRead(id: number): void
  removeNotification(id: number): void
}
```

**`settingsStore.ts`**:
```typescript
interface SettingsState {
  navMode: 'tabs' | 'sidebar'
  defaultScreen: string
  agentConfig: AgentConfig | null
  setNavMode(m: NavMode): void
  setDefaultScreen(s: string): void
  setAgentConfig(c: AgentConfig): void
}
```
Persist `navMode` and `defaultScreen` to AsyncStorage (not sensitive, no need for SecureStore).

### Tests
- Unit: `authStore.logout()` clears all auth state
- Unit: `appendChatToken` correctly builds streaming message content
- Unit: `addToolCallStart` creates entry with `toolStatus: 'pending'`; `updateToolCallComplete` sets status to 'complete'
- Unit: `unreadCount` increments on `addNotification` and decrements on `markNotificationRead`

---

## Section 5: Services — Auth & REST API Client

### What to Build

**`src/services/auth.ts`** — SecureStore wrappers:
- `storeToken(token: string): Promise<void>`
- `getToken(): Promise<string | null>`
- `clearToken(): Promise<void>`
- `storeServerUrl(url: string): Promise<void>`
- `getServerUrl(): Promise<string | null>`
- All use `expo-secure-store` with keys `helm_session_token` and `helm_server_url`

**`src/services/api.ts`** — REST API client built on native `fetch`:
- Constructor takes `baseUrl: string` and `getToken: () => string | null`
- Adds `Authorization: Bearer {token}` header to all authenticated requests
- Methods:
  - `login(username, password): Promise<LoginResponse>` — `POST /auth/login`
  - `getMe(): Promise<UserProfile>` — `GET /auth/me`
  - `logout(): Promise<void>` — `POST /auth/logout`
  - `getCalendarEvents(start: string, end: string): Promise<CalendarEvent[]>` — `GET /api/calendar/events`
  - `createCalendarEvent(data): Promise<CalendarEvent>` — `POST /api/calendar/events`
  - `updateCalendarEvent(id, data): Promise<CalendarEvent>` — `PATCH /api/calendar/events/{id}`
  - `deleteCalendarEvent(id): Promise<void>` — `DELETE /api/calendar/events/{id}`
  - `getNotifications(): Promise<Notification[]>` — `GET /api/notifications`
  - `markNotificationRead(id: number): Promise<void>` — `POST /api/notifications/{id}/read`
  - `deleteNotification(id: number): Promise<void>` — `DELETE /api/notifications/{id}`
  - `getModuleState(moduleType: string): Promise<ModuleState>` — `GET /api/modules/{type}`
  - `getChatHistory(): Promise<ChatMessage[]>` — `GET /api/chat/history`
  - `getAgentConfig(): Promise<AgentConfig>` — `GET /api/agent-config`
  - `updateAgentConfig(data: AgentConfigUpdate): Promise<AgentConfig>` — `PUT /api/agent-config`
- Error handling: non-2xx responses throw  - `submitForm(submitUrl: string, data: Record<string, unknown>): Promise<unknown>` — `POST {submitUrl}`
- All methods throw a typed `ApiError` (with `status` and `message`) on non-2xx responses
- Base URL comes from `authStore.serverUrl`

### Tests
- Unit: `getToken` returns null when SecureStore is empty
- Unit: `api.login` sends correct body and parses `sessionToken` from response
- Unit: `api.getCalendarEvents` appends `start`/`end` query params correctly
- Unit: `ApiError` is thrown on 401 response

---

## Section 6: WebSocket Service

### What to Build

**`src/services/websocket.ts`** — WebSocket state machine using `reconnecting-websocket`:

**Connection:**
- URL: `wss://{serverUrl}/ws?token={sessionToken}&device={deviceId}`
- `deviceId` from `settingsStore` (UUID generated on first launch, persisted to AsyncStorage)
- Connect on app foreground, disconnect on background (use `AppState`)
- Reconnect with exponential backoff (1s, 2s, 4s, max 30s)

**Heartbeat:**
- Client sends `{type:"ping"}` every 30 seconds
- If no `pong` within 5 seconds, treat as disconnect and reconnect
- Cancel heartbeat timer on disconnect

**Message dispatch — incoming server messages:**
- `connected` → update `uiStore.connectionState` to 'connected', store `serverVersion`
- `ping` → send `{type:"pong"}` immediately
- `chat_token` → call `uiStore.appendChatToken(messageId, token)`
- `chat_complete` → call `uiStore.finalizeChatMessage(msg)`, clear typing indicator
- `chat_error` → call `uiStore.setChatError(code, message)`
- `tool_call_start` → call `uiStore.addToolCallStart(data)`
- `tool_call_complete` → call `uiStore.updateToolCallComplete(data)`
- `ui_update` → call appropriate `uiStore.updateCalendar` / `uiStore.updateForm`
- `notification_push` → call `uiStore.addNotification(data)`
- `pong` → reset heartbeat watchdog timer
- Unknown type → log warning, do not crash

**Sending messages:**
- `sendChatMessage(content: string): string` — sends `{type:"chat_message", content, messageId: uuid()}`, returns messageId
  - Before sending: call `uiStore.addUserMessage(content, messageId)`, set typing indicator
  - If not connected: queue message and send after reconnect
- Export singleton `wsService` — instantiated once in app root

**Connection state transitions:**
```
disconnected → connecting → connected → reconnecting → connected
                                      ↘ disconnected (manual close)
```

### Tests
- Unit: incoming `chat_token` calls `uiStore.appendChatToken` with correct args
- Unit: incoming `pong` resets the heartbeat watchdog (verify timer is reset)
- Unit: `sendChatMessage` when disconnected queues the message
- Unit: unknown message type logs warning but doesn't throw
- Unit: `chat_complete` clears `isStreaming` in uiStore

---

## Section 7: Auth Screens

### What to Build

**`app/(auth)/connect.tsx`:**
- Text input for server URL (placeholder: `https://my-server.com`)
- "Connect" button — calls `GET {url}/health`, stores URL in SecureStore on success
- Shows spinner during request, error message on failure
- On success: navigate to `/(auth)/login`
- Pre-fills URL from SecureStore if previously stored

**`app/(auth)/login.tsx`:**
- Username + password text inputs (password secureTextEntry)
- "Sign In" button — calls `api.login(username, password)`
- On success: stores session token, navigates to `/(main)/chat`
- Shows field-level validation errors from API response
- "Back" link to connect screen

**`app/_layout.tsx`** — root layout with auth guard:
- On mount: read token from SecureStore
- If token present AND server URL present: redirect to `/(main)/chat`
- If not: redirect to `/(auth)/connect`
- Wrap with `GestureHandlerRootView` and `SafeAreaProvider`

### Tests
- Unit: connect screen shows error when health check returns non-200
- Unit: login screen shows error message from API error response
- Unit: root layout redirects to chat when token is present
- Unit: root layout redirects to connect when no token

---

## Section 8: Main Screens — Chat

### What to Build

**`app/(main)/chat.tsx`:**
- `FlatList` of chat entries from `uiStore.chatHistory`; inverted for bottom-up ordering
- Renders each entry based on `role`:
  - `user`: right-aligned bubble, white background
  - `assistant`: left-aligned bubble, system color background
  - `tool_call`: expandable detail card (collapsed by default)
    - Header: `🔧 {toolName}` + chevron
    - Expanded: shows `resultSummary` or "In progress..."
- Typing indicator: when `uiStore.isStreaming` is true and no tokens yet received, show animated 3-dot indicator in assistant bubble position
- Streaming: active message bubble updates in place as tokens arrive (no flicker)
- Message input bar fixed at bottom:
  - `TextInput` (multiline, grows up to 4 lines)
  - Send button — disabled when `isStreaming` or input is empty
  - On send: call `wsService.sendChatMessage(content)`, clear input
- Error banner if `connectionState !== 'connected'`: "Not connected — reconnecting..." with manual retry button
- Settings gear icon top-right → navigate to `/(settings)`
- On screen focus: scroll to bottom of chat history

**`app/(main)/_layout.tsx`** — tab bar:
- 5 tabs: Chat (💬), Calendar (📅), Forms (📝), Alerts (🔔), More (⋯ → Module Center)
- Alerts tab shows unread badge from `uiStore.unreadCount`
- Pull-to-refresh on each module screen calls `api.getModuleState(moduleType)` and updates store

### Tests
- Unit: user message renders right-aligned
- Unit: send button disabled when `isStreaming === true`
- Unit: typing indicator shown when `isStreaming` and no active tokens
- Unit: tool call card toggles expanded state on press

---

## Section 9: Main Screens — Calendar, Forms, Alerts

### What to Build

**`app/(main)/calendar.tsx`:**
- View switcher: Month / Day (two buttons in header)
- **Month view**: grid of day cells, current month
  - Highlight today with accent color
  - Show event dots on days with events (max 3 dots, then "+N more")
  - Alert badge (red dot) on days with `isAlert: true` events
  - Tap a day → switch to Day view for that day
- **Day view**: vertical timeline (hourly rows)
  - Event blocks positioned by start/end time
  - Color-coded by `event.color`
  - Tap event → bottom sheet with title, time, description, location
  - "+" button in header → navigate to form with `submitUrl: "/api/calendar/events"`
- Navigation: prev/next arrows in header; swipe gesture between days
- Pull-to-refresh: calls `api.getCalendarEvents(monthStart, monthEnd)`, updates store

**`app/(main)/forms.tsx`:**
- Renders `uiStore.formData` via `<FormView>` SDUI component
- If no form data: placeholder "No active form" message
- Pull-to-refresh: calls `api.getModuleState('form')`

**`app/(main)/alerts.tsx`:**
- `FlatList` of notifications from `uiStore.notifications`, newest first
- Each item: `<AlertCard>` with icon, title, message, timestamp, severity color
- Swipe-to-delete: calls `api.deleteNotification(id)` and removes from store
- Tap to read: calls `api.markNotificationRead(id)`, updates badge
- Empty state: "No alerts" with envelope icon
- Pull-to-refresh: calls `api.getNotifications()`

**`app/(main)/module-center.tsx`:**
- 3-column icon grid of available modules
- Each cell: icon + label
- Tap → navigate to that module's screen
- For MVP: 5 fixed modules (Chat, Calendar, Forms, Alerts, Settings)

### Tests
- Unit: month view renders correct number of day cells (28–31)
- Unit: event dot renders on correct day
- Unit: swipe-to-delete on alert calls `api.deleteNotification`
- Unit: unread count decrements on `markNotificationRead`

---

## Section 10: Settings Screen

### What to Build

**`app/settings.tsx`** — full-screen settings with scrollable sections:

**Section: Connection**
- Server URL display (read-only) + "Change" button (navigates back to connect screen and clears auth)
- Connection status indicator (green dot = connected, red = disconnected)

**Section: AI Agent**
- API URL input
- API key input (secureTextEntry, shows "••••" when saved)
- Model name input (e.g. `gpt-4o`)
- System prompt textarea
- "Save" button → calls `api.updateAgentConfig(data)`, shows success toast

**Section: Navigation**
- Toggle: Tabs / Sidebar (updates `settingsStore.navMode`)
- Default screen picker (Chat, Calendar, Forms, Alerts)

**Section: About**
- App version (from `expo-constants`)
- Server version (from `uiStore.serverVersion`)
- Device name input (editable, persisted to AsyncStorage)

**Section: Account**
- "Sign Out" button → calls `api.logout()`, clears SecureStore, navigates to `/(auth)/connect`

### Tests
- Unit: "Change" server URL clears auth state and navigates to connect
- Unit: agent config save calls `api.updateAgentConfig` with correct payload
- Unit: sign out clears token and redirects

---

## Section 11: SDUI Components & Theme

### What to Build

**`src/theme/`**:
- `colors.ts`: `primary`, `background`, `surface`, `text`, `textSecondary`, `error`, `success`, `warning`, `info`, event colors (`blue`, `red`, `green`, `orange`, `purple`), severity colors
- `typography.ts`: font sizes
- `typography.ts`: font sizes (xs=11, sm=13, md=15, lg=17, xl=20, xxl=24), font weights
- `spacing.ts`: scale (2, 4, 8, 12, 16, 24, 32, 48)

**`src/components/common/`**:
- `Button.tsx`: variants `primary`, `secondary`, `destructive`; loading state spinner
- `Input.tsx`: label + text input + error message; supports `secureTextEntry`
- `Card.tsx`: rounded surface with shadow; accepts children
- `ErrorBanner.tsx`: red banner with message and optional retry button

**`src/components/sdui/SDUIRenderer.tsx`**:
- Type-safe component registry: `{ calendar: CalendarView, form: FormView, alert: AlertCard }`
- Dispatch unknown types to `FallbackView` (dev: shows type name; prod: renders null)
- No business logic — pure renderer

**`src/components/sdui/CalendarView.tsx`**:
- Month grid + Day timeline as described in Section 9
- Receives `SDUICalendarProps`; all interaction state is local

**`src/components/sdui/FormView.tsx`**:
- Renders each field by `type` (text, textarea, number, date, datetime, select, multi_select, toggle, slider, submit)
- Local form state; validates on submit per server-defined rules
- On submit: calls `api.submitForm(submitUrl, formData)`

**`src/components/sdui/AlertCard.tsx`**:
- Card with severity icon + color, title, message, timestamp
- Tap to expand/collapse if `actions` present

**`src/components/sdui/FallbackView.tsx`**:
- Dev: yellow bordered box with "Unknown component: {type}"
- Prod: `null`

### Tests
- Unit: `SDUIRenderer` renders `CalendarView` for `type: 'calendar'`
- Unit: `SDUIRenderer` renders `FallbackView` for unknown type
- Unit: `FormView` shows validation error when required field is empty on submit
- Unit: `Button` shows spinner when `loading={true}`

---

## Section 1 Addendum: Tab Layout & Module Center

### `app/(main)/_layout.tsx`

Defines the bottom tab navigator with 5 tabs: Chat, Calendar, Forms, Alerts, More.

- Use Expo Router's `<Tabs>` component
- Alerts tab shows a badge with `uiStore.unreadCount` when > 0
- "More" tab opens `module-center.tsx` (full-screen grid)
- Tab icons from `@expo/vector-icons/Ionicons`
- Tab bar style: white background, system font labels
- Active tab color: `colors.primary`

### `app/(main)/module-center.tsx`

3-column icon grid of all available modules: Chat, Calendar, Forms, Alerts, Settings.

- Tapping an icon navigates to that module via `router.push`
- Settings tile navigates to `app/settings.tsx`
- For MVP: static list, no reordering

---

## Section 6 Addendum: AppState & Pull-to-Refresh

### AppState Integration (in `src/services/websocket.ts`)

- Subscribe to `AppState.addEventListener('change', handler)` in the WebSocket service initializer
- When app moves to `'background'`: pause heartbeat, close WS with code 1000
- When app returns to `'active'`: call `connect()` to re-establish
- Clean up listener on service teardown

### Pull-to-Refresh (in Calendar, Alerts, Forms screens)

Each of these three screens wraps its content in a `ScrollView` with `refreshControl`:

```
<ScrollView
  refreshControl={
    <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
  }
>
```

- `handleRefresh` calls the relevant REST endpoint (e.g. `api.getCalendarEvents()`) and updates the store
- `isRefreshing` is local `useState` — not in Zustand

---

## Section 6 Addendum: Token Expiry Handling

When any API call returns 401:
1. Call `auth.clearToken()` and `authStore.logout()`
2. Close the WebSocket with code 1000
3. Navigate to `/(auth)/connect`

The REST client (`api.ts`) should call an `onAuthError` callback (injected at construction) rather than importing the router directly — keeps the service layer testable.

No proactive token refresh for MVP (backend `/auth/refresh` exists but the session token lifetime is long enough that MVP doesn't need it).

---

## Section 8 Addendum: Typing Indicator & Error Boundary

### Typing Indicator Component (`src/components/chat/TypingIndicator.tsx`)

Three animated dots that pulse in sequence using `react-native-reanimated`:
- Show when `uiStore.isStreaming === true` AND `uiStore.activeMessageId` has no content yet
- Each dot scales 1.0 → 1.4 → 1.0 with 200ms stagger between dots
- Same left-aligned bubble style as assistant messages

### SDUI Error Boundary (`src/components/sdui/SDUIErrorBoundary.tsx`)

A React class component error boundary wrapping `SDUIRenderer`:
- On error: renders `FallbackView` with a generic "Something went wrong" message
- Logs error to console (dev) or no-op (prod)
- Does NOT crash the parent screen

Place the boundary in every module screen that renders SDUI content.

---

## Section 9 Addendum: Calendar Timezone & Form Date Picker

### Timezone Handling

All timestamps from the backend include timezone offsets (e.g. `2026-03-23T09:00:00+08:00`).

- Use `date-fns/parseISO` to parse all timestamps — it correctly handles timezone offsets
- Display times in the device's local timezone using `date-fns/format`
- Do NOT use `new Date(string)` directly — behavior is inconsistent across JS engines

### Form Date/Datetime Picker

For `type: 'date'` and `type: 'datetime'` form fields:
- Use `@react-native-community/datetimepicker` (install as Expo-compatible: `npx expo install @react-native-community/datetimepicker`)
- Show picker in modal on iOS (native wheel picker)
- Display selected value as formatted string in a tappable input row
