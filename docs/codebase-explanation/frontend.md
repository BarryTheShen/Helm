# Frontend — React Native (Expo) Mobile App

## Tier 1: TLDR

The frontend is a **React Native (Expo)** mobile app that serves as the universal UI for the Helm super app. It:

- **Authenticates** users against a self-hosted backend (connect → setup → login)
- **Renders 7 tab screens**: Home, Chat, Modules, Calendar, Forms, Alerts, Settings
- **Streams AI chat** via WebSocket with real-time token-by-token rendering
- **Has a fully integrated SDUI renderer** — the AI can push any screen to any tab via MCP tools; 19 component types supported
- **AI controls tab visibility** — the AI can hide/show tabs live via MCP tools (`helm_hide_tab`, `helm_show_tab`)
- **Uses Zustand** for state management (auth, UI, settings, tab visibility)
- **Single shared WebSocket** connection via `WebSocketContext` to prevent duplicate connections
- **Works on iOS, Android, and Web** (Expo universal platform)

**To run it:** `cd mobile && npx expo start`
**To run on web:** `cd mobile && npx expo start --web`

---

## Tier 2: Deeper Explanation

### Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   Expo Router (File-Based)                    │
│                                                              │
│  ┌─────────────┐  ┌──────────────────────────────────────┐   │
│  │  (auth)/    │  │             (tabs)/                  │   │
│  │  connect    │  │  home  chat  modules  calendar       │   │
│  │  login      │  │  forms       alerts   settings       │   │
│  └─────────────┘  └──────────────────────────────────────┘   │
│         │                       │                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ WebSocketContext (Singleton — one WS for all tabs)       │   │
│  └─────────────────────────────────────────────────────┘   │
│         │                       │                            │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Services: ApiClient | AuthService | WebSocketService     │   │
│  └─────────────────────────────────────────────────────┘   │
│         │                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Zustand: authStore | uiStore | settingsStore | tabsStore│   │
│  └─────────────────────────────────────────────────────┘   │
│         │                                                    │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ SDUI Renderer: SDUIScreenRenderer → 19 component types  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### Navigation Structure

Uses **Expo Router** (file-based routing):

- **Root Layout** (`app/_layout.tsx`) — Auth guard. Redirects to auth flow if no token, to tabs if authenticated.
- **Index** (`app/index.tsx`) — `ActivityIndicator` while auth state hydrates from SecureStore. Redirect fallback.
- **(auth)/** — Unauthenticated stack:
  - `connect.tsx` — Server URL entry + account setup (creates first user)
  - `login.tsx` — Username/password login
- **(tabs)/** — Authenticated bottom tab navigator:
  - `home.tsx` — Fully AI-driven home screen (SDUI only, no fallback UI)
  - `chat.tsx` — Main AI chat interface with WebSocket streaming
  - `modules.tsx` — Module/tab browser
  - `calendar.tsx` — Month-grid calendar with event dots and selected-day detail
  - `forms.tsx` — SDUI-driven forms screen (empty state until AI builds it)
  - `alerts.tsx` — Notifications list
  - `settings.tsx` — Server info, account details, logout

### State Management (Zustand)

| Store | Purpose | Key State | Persisted? |
|-------|---------|-----------|----------|
| `authStore` | Auth state | token, user, serverUrl, isLoading | SecureStore (token, serverUrl, username) |
| `uiStore` | UI state | isConnected, errorBanner | No |
| `settingsStore` | User preferences | navigationMode, theme | AsyncStorage |
| `tabsStore` | AI-controlled tab visibility | hiddenTabs: string[] | No (reloaded from server) |

**Critical notes:**
- `authStore.logout()` clears the client-side token but **does not call the backend logout endpoint**
- `settingsStore.navigationMode` and `settingsStore.theme` are stored but **neither has any effect** on the UI
- `settingsStore` uses `AsyncStorage` directly instead of the `storage` utility (inconsistency)
- `tabsStore.hiddenTabs` is repopulated from `GET /api/modules` on every app launch (not persisted locally)

### Services Layer

| Service | File | Purpose |
|---------|------|---------|
| `ApiClient` | `services/api.ts` | HTTP client for all REST API calls. Auto-redirects on 401. |
| `AuthService` | `services/auth.ts` | Standalone auth service for setup/login/logout (used before ApiClient exists) |
| `WebSocketService` | `services/websocket.ts` | ReconnectingWebSocket wrapper with heartbeat, Zod validation, multi-handler subscriptions |

### Contexts

**`WebSocketContext`** (`src/contexts/WebSocketContext.tsx`) — Singleton WebSocket:
- Creates one `WebSocketService` instance on `[token, serverUrl]` changes
- Prevents N duplicate connections (old issue: each tab was creating its own WS)
- WS URL: `serverUrl.replace(/^http/, 'ws') + '/ws'`
- `useWebSocket()` returns the service or `null` before auth is ready

### Hooks

**`useSDUIScreen(moduleId)`** (`src/hooks/useSDUIScreen.ts`):
- Fetches `GET /api/sdui/{moduleId}` on mount and auth changes
- Subscribes to WS `sdui_screen_update` messages for live updates
- Returns `{ screen, loading, error, refresh }` — used by all 7 tab screens

### SDUI Component System

The app has a **Server-Driven UI renderer** (`SDUIRenderer.tsx`) that accepts a JSON component tree and renders native components:

| SDUI Type | Component | Status |
|-----------|-----------|--------|
| `calendar` | Vertical event list (left-border colors) | Implemented |
| `form` | Stateful form with submit | Implemented |
| `alert` | Severity-colored alert block | Implemented |
| `list` | Rows with icon/title/subtitle/chevron | Implemented |
| `card` | Card with optional children | Implemented |
| `text` | Styled text block | Implemented |
| `heading` | Level-based heading (h1–h3) | Implemented |
| `button` | primary/secondary/destructive/ghost variants | Implemented |
| `icon_button` | Emoji icon button | Implemented |
| `container` | Flex row/column layout | Implemented |
| `badge` | Colored pill | Implemented |
| `stat` | Value + label + change | Implemented |
| `stats_row` | Row of stat items | Implemented |
| `image` | `<Image>` with tap action | Implemented |
| `progress` | Labeled progress bar | Implemented |
| `divider` | 1px separator | Implemented |
| `spacer` | Empty height spacer | Implemented |
| *(unknown)* | Error card | Graceful fallback |

**⚠️ SDUI Actions never execute** — `onAction` handlers log to console only. Navigate, api_call, open_url, dismiss, etc. are all non-functional.

**⚠️ Dead SDUI component files** — `AlertComponent.tsx`, `CalendarComponent.tsx`, `FormComponent.tsx`, `ListComponent.tsx` are NOT used by `SDUIRenderer.tsx` (it renders all types inline). These files are dead code.

### Common Components

| Component | Purpose |
|-----------|---------|
| `Button` | Three variants: primary, secondary, outline |
| `Card` | Elevated card container with shadow |
| `ErrorBanner` | Red banner with retry/dismiss actions |
| `Input` | Styled TextInput wrapper |

---

## Tier 3: Extensive Detail

### File-by-File Breakdown

#### Config Files

**`package.json`** — Key dependencies:
- `expo` ~55.0.8 (SDK 55)
- `react` 19.2.0, `react-native` 0.83.2
- `expo-router` ^55.0.7 (file-based routing)
- `zustand` ^5.0.12 (state management)
- `reconnecting-websocket` ^4.4.0 (WebSocket with auto-reconnect)
- `date-fns` ^4.1.0 (date formatting)
- `zod` ^4.3.6 (runtime validation)
- `expo-secure-store` ^55.0.9 (encrypted storage on native)
- `react-native-reanimated` ^4.2.3 (animations)

**`app.json`** — Expo config:
- App name: "Helm"
- Slug: "helm"
- Scheme: "helm" (deep linking)
- iOS bundle: `com.helm.app`, minimum iOS 16
- Light mode only (`userInterfaceStyle: "light"`)
- Portrait only

**`babel.config.js`** — Module resolver with `@/` alias → `./src/`

**`tsconfig.json`** — Strict mode, paths alias `@/*` → `src/*`

#### Root Layout (`app/_layout.tsx`)

The auth guard logic:
1. On mount: calls `initialize()` on auth store and settings store
2. Watches `token`, `segments`, `isLoading`
3. If not loading and no token and not in auth group → redirect to `/(auth)/connect`
4. If not loading and has token and in auth group → redirect to `/(tabs)/chat`
5. Renders `<Slot />` (current route)

#### Auth Flow

**Connect Screen** (`(auth)/connect.tsx`):
- Three inputs: Server URL, Username, Password
- Defaults: `http://localhost:8000`, `testuser`, `testpass123`
- On setup: calls `POST /auth/setup` → saves server URL → navigates to login
- Uses `AuthService` (not `ApiClient`) since we don't have a token yet

**Login Screen** (`(auth)/login.tsx`):
- Two inputs: Username, Password
- On login: calls `POST /auth/login` with device_id="web", device_name="Web Browser"
- Saves token → navigates to `/(tabs)/chat`
- Shows "Connected to: {serverUrl}" with "Change Server" link

#### Tab Screens

**Chat** (`(tabs)/chat.tsx`) — The primary screen:
- Uses shared `WebSocketContext` (gets `WebSocketService` via `useWebSocket()`)
- Loads chat history via REST on mount
- `wsHandlerRef` pattern avoids stale closures (handler updated via ref)
- WebSocket message handling:
  - `chat_start` → Sets isTyping=true, initializes new assistant message
  - `chat_token` → Appends token to current assistant message
  - `chat_message_replace` → Replaces current message content (used after XML tool call stripping)
  - `chat_complete` → Sets isTyping=false, finalises message
  - `chat_error` → Shows error banner
  - `tool_result` / `tool_error` → Logged to console (no UI yet)
- Send: appends user message to local state + sends via WebSocket `{type: "chat_message", content: "...", conversation_id: "default"}`
- Shows typing indicator (`●●●`) while waiting for response
- SDUI override: `useSDUIScreen('chat')` — if AI sets a chat SDUI screen, it overrides the default chat view

**Home** (`(tabs)/home.tsx`) — Fully AI-driven screen:
- Only content: `useSDUIScreen('home')` render
- No functional fallback — empty state shown when no SDUI screen is set
- `handleAction` is `console.log` only — SDUI actions never execute

**Calendar** (`(tabs)/calendar.tsx`):
- Loads events for current month via `GET /api/calendar/events?start_date=...&end_date=...`
- Renders as a simple scrollable list of `Card` components
- **Read-only** — no create/edit/delete calendar UI
- Has `view` state (month/day) but toggle not yet implemented

**Alerts** (`(tabs)/alerts.tsx`):
- Loads notifications via `GET /api/notifications`
- Renders as cards with title, body, timestamp
- **Bug**: `markNotificationRead` method exists in `api.ts` but is never called — notifications cannot be marked read

**Modules** (`(tabs)/modules.tsx`):
- Loads module list via `GET /api/modules`
- Renders as cards with icon, name, description, enabled/disabled badge
- `handleModulePress` is a stub (console.log) — tapping a module does nothing

**Forms** (`(tabs)/forms.tsx`):
- Static placeholder screen
- Text: "Forms will be dynamically rendered here via SDUI"

**Settings** (`(tabs)/settings.tsx`):
- Displays: Server URL, Agent model, Navigation mode, Theme, Version, Username
- Logout button with confirmation dialog

#### Services

**`ApiClient`** (`src/services/api.ts`):
- Generic `request<T>()` method that handles auth headers, 401 redirect, error parsing
- Methods for all backend endpoints: auth, calendar, notifications, agent config, workflows, modules, chat, SDUI screens, tab visibility
- New endpoints added: `getSDUIScreen`, `setSDUIScreen`, `deleteSDUIScreen`, `hideTab`, `showTab`
- On 401: calls `onUnauthorized` callback (which triggers logout)

**`AuthService`** (`src/services/auth.ts`):
- Standalone service for setup, login, logout
- **Bug**: `logout()` only clears local state; does NOT call `DELETE /auth/logout` — server sessions remain active indefinitely

**`WebSocketService`** (`src/services/websocket.ts`):
- Wraps `ReconnectingWebSocket` with:
  - Max 10 retries, 1-10s reconnection delay, 5s timeout
  - 30s heartbeat (ping/pong)
  - Message validation via Zod schema (`wsMessageSchema` uses `.passthrough()` so extra fields like `token`, `message_id` are preserved after validation)
  - Handler registration with cleanup functions
  - Connection/disconnection event handlers

#### Stores

**`authStore`** — Persists `auth_token` and `server_url` to secure storage. `initialize()` loads both on app start.

**`uiStore`** — In-memory only. Tracks WebSocket connection status and error banner state.

**`settingsStore`** — Persists to AsyncStorage (not SecureStore). Stores navigation mode and theme. Both settings are stubs — they have no UI effect.

**`tabsStore`** — In-memory only (not persisted). `hiddenTabs: string[]` + `setHiddenTabs()`. Updated by `TabsConfigSync` when a `tabs_updated` WS event arrives. Controls `href: null` on tab entries in the bottom navigator. Reloads from server on each start.

#### SDUI Components

**`SDUIRenderer`** (`src/components/sdui/SDUIRenderer.tsx`) — Inline switch-based renderer:
- 19 component types all rendered inline (no sub-component imports)
- `SDUIScreenRenderer` wraps a `sections[]` array from the screen payload
- `FormRenderer` is a local stateful component inside the same file
- `onAction` prop is forwarded but handlers only `console.log` — no actions execute
- Unknown component types render an error card with the type name

**⚠️ Dead code files** (not imported anywhere):
- `AlertComponent.tsx` — dead
- `CalendarComponent.tsx` — dead
- `FormComponent.tsx` — dead
- `ListComponent.tsx` — dead

All 4 files should be deleted to reduce confusion.

#### Types

**`api.ts`** — TypeScript interfaces matching (roughly) the backend schemas.

**`sdui.ts`** — SDUI component type definitions:
- Old flat `SDUIComponent {type, id, props, children}` type
- Does NOT reflect the real screen payload shape: `SDUIScreen {schema_version, module_id, title, sections[]}`. Use the backend schema source of truth.

**`navigation.ts`** — Route type definitions. **Dead code** — Expo Router handles routing types automatically.

#### Utils

**`storage.ts`** — Platform-aware storage abstraction:
- Native: Uses `expo-secure-store` (encrypted)
- Web: Uses `localStorage`

**`validation.ts`** — Zod schemas for:
- SDUI component validation (recursive)
- Calendar/Form/Alert props validation
- WebSocket message validation

#### Theme

**`colors.ts`** — iOS-inspired design system:
- Colors: iOS system colors (primary=#007AFF, etc.)
- Spacing: 4/8/16/24/32/48
- Border radius: 4/8/12/16/9999
- Typography: iOS Dynamic Type scale (largeTitle through caption2)
- Dark mode colors defined but not used yet

### How to Use

```bash
# Install dependencies
cd mobile
npm install

# Start Expo dev server
npx expo start

# Run on specific platforms
npx expo start --ios        # iOS simulator (Mac only)
npx expo start --android    # Android emulator
npx expo start --web        # Web browser

# The app expects a backend running at http://localhost:8000
# On first launch:
# 1. Enter server URL on Connect screen
# 2. Create admin account
# 3. Login with created credentials
# 4. Start chatting (requires AI API key configured in backend)
```

### Project Structure

```
mobile/
├── app.json                      # Expo configuration
├── babel.config.js               # Babel + module resolver
├── index.ts                      # Entry point (expo-router/entry)
├── package.json                  # Dependencies
├── tsconfig.json                 # TypeScript config
├── app/
│   ├── _layout.tsx               # Root layout (auth guard)
│   ├── index.tsx                 # Loading screen (redirects)
│   ├── (auth)/
│   │   ├── _layout.tsx           # Auth stack layout
│   │   ├── connect.tsx           # Server setup screen
│   │   └── login.tsx             # Login screen
│   └── (tabs)/
│       ├── _layout.tsx           # Tab navigator (TabsLayout + TabsConfigSync)
│       ├── home.tsx              # AI home (SDUI only)
│       ├── chat.tsx              # AI chat with streaming WebSocket
│       ├── modules.tsx           # Module browser
│       ├── calendar.tsx          # Calendar events (read-only)
│       ├── alerts.tsx            # Notifications
│       └── settings.tsx          # App settings + logout
├── assets/                       # Icons, splash screen
└── src/
    ├── components/
    │   ├── common/
    │   │   ├── Button.tsx        # Reusable button (3 variants)
    │   │   ├── Card.tsx          # Elevated card container
    │   │   ├── ErrorBanner.tsx   # Error banner with retry/dismiss
    │   │   └── Input.tsx         # Styled text input
    │   └── sdui/
    │       ├── SDUIRenderer.tsx  # SDUI engine (19 inline component types)
    │       ├── AlertComponent.tsx    # DEAD CODE
    │       ├── CalendarComponent.tsx # DEAD CODE
    │       ├── FormComponent.tsx     # DEAD CODE
    │       └── ListComponent.tsx     # DEAD CODE
    ├── contexts/
    │   └── WebSocketContext.tsx  # Singleton WS, useWebSocket() hook
    ├── hooks/
    │   └── useSDUIScreen.ts      # Fetch + live-update SDUI per module
    ├── services/
    │   ├── api.ts                # REST API client (all endpoints)
    │   ├── auth.ts               # Auth service (setup/login/logout)
    │   └── websocket.ts          # ReconnectingWebSocket wrapper
    ├── stores/
    │   ├── authStore.ts          # Auth state (Zustand + SecureStore)
    │   ├── uiStore.ts            # UI state (WS status, errors)
    │   ├── settingsStore.ts      # Settings (Zustand + AsyncStorage)
    │   └── tabsStore.ts          # AI-controlled tab visibility
    ├── theme/
    │   └── colors.ts             # Design system tokens (iOS-inspired)
    ├── types/
    │   ├── api.ts                # Backend API types
    │   ├── navigation.ts         # Route types (DEAD CODE)
    │   └── sdui.ts               # SDUI component types (partially stale)
    └── utils/
        ├── storage.ts            # Platform-aware storage abstraction
        └── validation.ts         # Zod schemas (mostly unused)
```

### Known Issues / TODOs

1. **SDUI actions never execute** — All `onAction` callbacks only `console.log`. `navigate`, `api_call`, `open_url`, `dismiss`, `refresh` are dead. This is the #1 missing feature.
2. **Dead SDUI component files** — `AlertComponent.tsx`, `CalendarComponent.tsx`, `FormComponent.tsx`, `ListComponent.tsx` not imported anywhere. Should be deleted.
3. **`logout()` no server call** — `AuthService.logout()` only clears local state. Backend session remains active. `DELETE /auth/logout` is never called.
4. **`markNotificationRead` never called** — The method exists in `api.ts` but `alerts.tsx` never calls it.
5. **`handleModulePress` stub** — Module tap handler is `console.log`. No module detail screen exists.
6. **`conversation_id: 'default'` hardcoded** — No multi-conversation support.
7. **Calendar read-only** — No create/edit/delete calendar event UI.
8. **Dark mode** — Color tokens defined but `userInterfaceStyle: "light"` forced in `app.json`.
9. **Navigation mode setting is a stub** — Settings stores drawer preference but only tabs is implemented.
10. **`navigation.ts` dead code** — Route type file not imported anywhere; Expo Router handles types.
11. **`validation.ts` mostly unused** — Only `wsMessageSchema` is actually used.
12. **`@react-navigation/bottom-tabs` dependency** — Listed in `package.json` but never imported (Expo Router handles tabs).
13. **Hardcoded dev credentials** — `connect.tsx` defaults to `testuser`/`testpass123`.
