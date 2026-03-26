# Frontend — React Native (Expo) Mobile App

## Tier 1: TLDR

The frontend is a **React Native (Expo)** mobile app that serves as the universal UI for the Helm super app. It:

- **Authenticates** users against the self-hosted backend (connect to server → setup → login)
- **Renders 6 tab screens**: Chat, Modules, Calendar, Forms, Alerts, Settings
- **Streams AI chat** via WebSocket with real-time token-by-token rendering
- **Has an SDUI renderer** that can dynamically render Calendar, Form, Alert, List, Card, Text, and Button components from JSON
- **Uses Zustand** for state management (auth, UI, settings)
- **Works on iOS, Android, and Web** (Expo universal platform)

**To run it:** `cd mobile && npx expo start`
**To run on web:** `cd mobile && npx expo start --web`

---

## Tier 2: Deeper Explanation

### Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                 Expo Router (File-Based)              │
│                                                      │
│  ┌─────────────┐  ┌───────────────┐                 │
│  │  (auth)/    │  │   (tabs)/     │                 │
│  │  connect    │  │  chat         │                 │
│  │  login      │  │  modules      │                 │
│  │             │  │  calendar     │                 │
│  │             │  │  forms        │                 │
│  │             │  │  alerts       │                 │
│  │             │  │  settings     │                 │
│  └─────────────┘  └───────────────┘                 │
│         │                  │                         │
│  ┌─────────────────────────────────────────┐        │
│  │          Services Layer                  │        │
│  │  ApiClient  │  AuthService  │  WebSocket │        │
│  └─────────────────────────────────────────┘        │
│         │                  │                         │
│  ┌─────────────────────────────────────────┐        │
│  │        Zustand Stores                    │        │
│  │  authStore  │  uiStore  │  settingsStore │        │
│  └─────────────────────────────────────────┘        │
│         │                                            │
│  ┌─────────────────────────────────────────┐        │
│  │        SDUI Renderer                     │        │
│  │  SDUIRenderer → Calendar, Form, Alert,   │        │
│  │  List, Card, Text, Button                │        │
│  └─────────────────────────────────────────┘        │
└──────────────────────────────────────────────────────┘
```

### Navigation Structure

The app uses **Expo Router** (file-based routing):

- **Root Layout** (`app/_layout.tsx`) — Auth guard. Redirects to auth flow if not logged in, to tabs if logged in.
- **Index** (`app/index.tsx`) — Loading spinner while checking auth state.
- **(auth)/** — Unauthenticated stack:
  - `connect.tsx` — Server URL entry + account setup (creates first user)
  - `login.tsx` — Username/password login
- **(tabs)/** — Authenticated bottom tab navigator:
  - `chat.tsx` — Main AI chat interface with WebSocket streaming
  - `modules.tsx` — Module browser (list of available modules)
  - `calendar.tsx` — Calendar events list
  - `forms.tsx` — Placeholder for SDUI forms
  - `alerts.tsx` — Notifications list
  - `settings.tsx` — Server info, agent config, theme, logout

### State Management (Zustand)

| Store | Purpose | Key State |
|-------|---------|-----------|
| `authStore` | Authentication state | token, user, serverUrl, isLoading |
| `uiStore` | UI state | isConnected, errorBanner |
| `settingsStore` | User preferences | navigationMode (tabs/drawer), theme (light/dark/auto) |

All stores persist key values to storage (SecureStore on native, localStorage on web).

### Services Layer

| Service | Purpose |
|---------|---------|
| `ApiClient` | HTTP client for all REST API calls. Auto-redirects on 401. |
| `AuthService` | Standalone auth service for setup/login/logout (used before ApiClient is initialized) |
| `WebSocketService` | ReconnectingWebSocket wrapper with heartbeat, message validation, and handler registration |

### SDUI Component System

The app has a **Server-Driven UI renderer** (`SDUIRenderer.tsx`) that accepts a JSON component tree and renders native components:

| SDUI Type | Component | Status |
|-----------|-----------|--------|
| `calendar` | CalendarComponent | Implemented |
| `form` | FormComponent | Implemented |
| `alert` | AlertComponent | Implemented |
| `list` | ListComponent | Implemented |
| `card` | Card wrapper | Implemented |
| `text` | Text component | Implemented |
| `button` | Button component | Implemented |
| `image` | — | Stub (returns null) |
| `chart` | — | Stub (returns null) |
| `map` | — | Stub (returns null) |

Unknown component types render an error card.

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
- Initializes `ApiClient` and `WebSocketService` on mount
- Loads chat history via REST API on mount
- WebSocket message handling:
  - `chat_token` → Streaming: appends `message.token` to current assistant message (preserved by `wsMessageSchema.passthrough()`)
  - `chat_start` → Sets isTyping=true, initializes new assistant message
  - `chat_complete` → Sets isTyping=false, finalises message
  - `chat_error` → Shows error banner
  - `tool_call_start` / `tool_call_complete` → Logged to console (no UI yet)
- Send: appends user message to local state + sends via WebSocket `{type: "chat_message", content: "...", conversation_id: "default"}`
- Uses `FlatList` with keyboard avoiding view
- Shows typing indicator (`●●●`) while waiting for response
- Shows `ErrorBanner` when WebSocket disconnects

**Calendar** (`(tabs)/calendar.tsx`):
- Loads events for current month via `GET /api/calendar/events`
- Renders as a simple scrollable list of `Card` components
- Uses `date-fns` for formatting
- Has `view` state (month/day) but toggle not yet implemented

**Alerts** (`(tabs)/alerts.tsx`):
- Loads notifications via `GET /api/notifications`
- Renders as cards with title, body, timestamp

**Modules** (`(tabs)/modules.tsx`):
- Loads module list via `GET /api/modules`
- Renders as cards with icon, name, description, enabled/disabled badge
- `onPress` handler is a stub (console.log)

**Forms** (`(tabs)/forms.tsx`):
- Static placeholder screen
- Text: "Forms will be dynamically rendered here via SDUI"

**Settings** (`(tabs)/settings.tsx`):
- Displays: Server URL, Agent model, Navigation mode, Theme, Version, Username
- Logout button with confirmation dialog

#### Services

**`ApiClient`** (`src/services/api.ts`):
- Generic `request<T>()` method that handles auth headers, 401 redirect, error parsing
- Methods for all backend endpoints: auth, calendar, notifications, agent config, workflows, modules, chat
- On 401: calls `onUnauthorized` callback (which triggers logout)
- NOTE: Some endpoint paths don't match the backend (e.g., `getCalendarEvents` uses `?start=` but backend expects `?start_date=`)

**`AuthService`** (`src/services/auth.ts`):
- Standalone service for setup, login, logout
- NOTE: `setup()` method uses `data.server_url` to build the URL, but the `SetupRequest` type doesn't have `server_url`. The constructor's `baseUrl` isn't used for setup. This is a bug.

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

**`settingsStore`** — Persists to AsyncStorage (not SecureStore). Stores navigation mode and theme.

#### SDUI Components

**`SDUIRenderer`** — Switch-based renderer:
- Receives `component: SDUIComponent` (recursive tree)
- Each SDUI component gets `onAction` callback for event bubbling
- `card` type renders children recursively
- Unknown types show error card with component type name

**`CalendarComponent`** — Renders events as cards with color bar, title, time, all-day badge

**`FormComponent`** — Dynamic form renderer:
- Generates TextInput for each field
- Client-side validation (required fields)
- Keyboard type based on field type (email, number, etc.)
- Submit handler with validation

**`AlertComponent`** — Severity-colored alert cards (info=blue, warning=orange, error=red, success=green)

**`ListComponent`** — FlatList of pressable card items with icon, title, subtitle, chevron

#### Types

**`api.ts`** — TypeScript interfaces matching (roughly) the backend schemas. Some mismatches:
- `ChatMessage.conversation_id` doesn't exist in backend
- `Notification.body` should be `message`
- `Workflow` types don't match backend trigger/action types

**`sdui.ts`** — SDUI component type definitions:
- `SDUIComponent` — Recursive type with `type`, `id`, `props`, `children`
- Props interfaces for Calendar, Form, Alert, List

**`navigation.ts`** — Route type definitions (largely unused since expo-router handles typing)

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
│   ├── index.tsx                 # Loading screen
│   ├── (auth)/
│   │   ├── _layout.tsx           # Auth stack layout
│   │   ├── connect.tsx           # Server setup screen
│   │   └── login.tsx             # Login screen
│   └── (tabs)/
│       ├── _layout.tsx           # Tab navigator layout
│       ├── chat.tsx              # AI chat with WebSocket
│       ├── modules.tsx           # Module browser
│       ├── calendar.tsx          # Calendar events
│       ├── forms.tsx             # Forms (placeholder)
│       ├── alerts.tsx            # Notifications
│       └── settings.tsx          # App settings
├── assets/                       # Icons, splash screen
└── src/
    ├── components/
    │   ├── common/
    │   │   ├── Button.tsx        # Reusable button
    │   │   ├── Card.tsx          # Elevated card
    │   │   ├── ErrorBanner.tsx   # Error banner
    │   │   └── Input.tsx         # Styled text input
    │   └── sdui/
    │       ├── SDUIRenderer.tsx  # SDUI component dispatcher
    │       ├── AlertComponent.tsx
    │       ├── CalendarComponent.tsx
    │       ├── FormComponent.tsx
    │       └── ListComponent.tsx
    ├── services/
    │   ├── api.ts                # REST API client
    │   ├── auth.ts               # Auth service
    │   └── websocket.ts          # WebSocket service
    ├── stores/
    │   ├── authStore.ts          # Auth state (Zustand)
    │   ├── uiStore.ts            # UI state (Zustand)
    │   └── settingsStore.ts      # Settings state (Zustand)
    ├── theme/
    │   └── colors.ts             # Design system tokens
    ├── types/
    │   ├── api.ts                # Backend API types
    │   ├── navigation.ts         # Route types
    │   └── sdui.ts               # SDUI component types
    └── utils/
        ├── storage.ts            # Platform-aware storage
        └── validation.ts         # Zod validation schemas
```

### Known Issues / TODOs

1. **AuthService.setup() bug** — Uses `data.server_url` which doesn't exist on the type. Should use `this.baseUrl`.
2. **API type mismatches** — Frontend `Notification.body` doesn't match backend `Notification.message`. Chat types have `conversation_id` which doesn't exist in backend.
3. **Calendar query params** — Frontend sends `?start=` / `?end=` but backend expects `?start_date=` / `?end_date=`.
4. **Forms screen** — Completely placeholder, not connected to SDUI renderer.
5. **No pull-to-refresh** on any screen.
6. **Dark mode** — Colors defined but not wired up.
7. **Navigation mode** — Settings stores tabs/drawer preference but only tabs is implemented.
8. **Module detail view** — Module press handler is a stub.
9. **SDUIRenderer** — Not used in any tab screen yet. The tab screens directly render their data.
