# Synthesized Spec — Helm Mobile Frontend (React Native Expo)

## What We Are Building

A React Native / Expo iOS app that serves as the client for the Helm Agentic AI Super App backend. The app is a **Server-Driven UI (SDUI) renderer** — the backend controls what appears on screen by sending JSON payloads; the frontend ships with all component types pre-built and renders whatever the server sends.

MVP scope: iOS only, single-user, single agent.

---

## Core Architecture

- **Framework:** React Native with Expo (managed workflow)
- **Language:** TypeScript (strict mode)
- **Routing:** Expo Router v4 (file-based)
- **State:** Zustand (slice pattern)
- **Token storage:** expo-secure-store (keychain-backed)
- **Dates:** date-fns
- **Animations:** react-native-reanimated
- **Gestures:** react-native-gesture-handler
- **WebSocket:** Native RN WebSocket + custom reconnect state machine
- **Validation:** Zod (at API boundary)
- **Minimum iOS:** 16+

---

## Project Location

Scaffold at: `/home/barry/VisualCode Studio Projects/Helm/Helm/mobile/`

---

## Folder Structure

```
mobile/
├── app/
│   ├── _layout.tsx              # Root layout + auth guard
│   ├── (auth)/
│   │   ├── connect.tsx          # Enter server URL
│   │   └── login.tsx            # Enter credentials
│   └── (main)/
│       ├── _layout.tsx          # Tab bar layout
│       ├── chat.tsx
│       ├── calendar.tsx
│       ├── forms.tsx
│       ├── alerts.tsx
│       └── module-center.tsx
├── src/
│   ├── components/
│   │   ├── sdui/
│   │   │   ├── SDUIRenderer.tsx
│   │   │   ├── ChatView.tsx
│   │   │   ├── CalendarView.tsx
│   │   │   ├── FormView.tsx
│   │   │   ├── AlertCard.tsx
│   │   │   └── FallbackView.tsx
│   │   ├── navigation/
│   │   │   ├── TabBar.tsx
│   │   │   └── ModuleCenter.tsx
│   │   └── common/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       ├── Card.tsx
│   │       └── ErrorBanner.tsx
│   ├── services/
│   │   ├── websocket.ts
│   │   ├── api.ts
│   │   └── auth.ts
│   ├── stores/
│   │   ├── index.ts
│   │   ├── authStore.ts
│   │   ├── uiStore.ts
│   │   └── settingsStore.ts
│   ├── types/
│   │   ├── sdui.ts
│   │   ├── api.ts
│   │   └── navigation.ts
│   ├── theme/
│   │   ├── colors.ts
│   │   ├── typography.ts
│   │   └── spacing.ts
│   └── utils/
│       ├── validation.ts
│       └── formatters.ts
└── __tests__/
```

---

## Screen Flows

### First-Launch Auth Flow
1. App opens → root `_layout.tsx` checks for stored `session_token` in SecureStore
2. No token → redirect to `/(auth)/connect`
3. Connect screen: user enters server URL → stored in SecureStore → `GET /auth/status` (validates server)
4. Login screen: user enters username + password → `POST /auth/login` → stores `session_token`
5. Auth success → redirect to `/(main)/chat`

### Subsequent Launches
1. Token found in SecureStore → `GET /auth/me` to validate
2. Valid → `/(main)/chat`
3. Invalid/expired → `/(auth)/login` (server URL already stored)

### Auth Guard
- Root `_layout.tsx` manages redirect logic using `useSegments` + `useRouter`
- Protected routes under `(main)/` require valid token
- Invalid/expired session → logout + redirect to login

---

## Navigation

- **Default:** Bottom tab bar (iOS standard)
- Tabs: Chat, Calendar, Forms, Alerts, Module Center
- **Settings:** Gear icon in top-right corner of any module screen → navigate to `/settings`
- Settings is NOT a tab — it's a navigation push
- User can toggle to sidebar drawer mode in Settings (persist preference in settingsStore)

---

## WebSocket Protocol

**Connection:** `ws://HOST/ws?token=SESSION_TOKEN`

**State machine:** DISCONNECTED → CONNECTING → CONNECTED → RECONNECTING

**Reconnect policy:**
- Exponential backoff: `min(1000 * 2^attempt, 30000) + jitter(0-1000ms)`
- Do NOT reconnect on close codes: 1000, 1001, 1008, 4001 (auth failure)
- Reconnect on all other close codes and network errors
- Handle `AppState` changes: close gracefully on background, reconnect on foreground

**Heartbeat:** Client sends `{ type: "ping" }` every 30s. Expects `{ type: "pong" }` within 5s — if not received, force-close and reconnect.

**Token expiry:** WS close code 4001 → clear token → redirect to login.

**Incoming message handling (dispatch to Zustand stores):**
- `connected` → set `connectionState = CONNECTED`, store `serverVersion`
- `chat_token` → append token to active streaming message in `uiStore`
- `chat_complete` → finalize streaming message, attach `embeddedComponents`
- `chat_error` → display error in chat, set `isStreaming = false`
- `tool_call_start` → add tool call card in pending state to chat
- `tool_call_complete` → update tool call card with result
- `ui_update` → update module SDUI state in `uiStore`
- `notification` → append to notification list in `uiStore`
- `ping` → send `pong`

---

## SDUI Renderer

The renderer is a discriminated-union component registry:

```typescript
type SDUIComponent =
  | { type: 'chat'; props: ChatViewProps }
  | { type: 'calendar'; props: CalendarViewProps }
  | { type: 'form'; props: FormViewProps }
  | { type: 'alert'; props: AlertCardProps };
```

Rules:
- Zod validates all incoming SDUI JSON at the API/WS boundary before it reaches the registry
- Unknown types → `FallbackView` (shows type name in dev, renders `null` in prod)
- No business logic inside SDUI components — pure renderers
- Actions dispatched via React context, not prop-drilling
- Every component node has an `id` field (required for React key)

---

## Chat Module

- Message list: `FlatList` (inverted, newest at bottom)
- Streaming: incoming `chat_token` messages appended in real-time to the active message bubble
- Pre-token state: animated typing indicator (three bouncing dots) from message send until first token
- Input: text input + send button at bottom; disabled while streaming
- Tool calls: expandable detail card in chat, showing tool name; tappable to expand result summary
- `embeddedComponents` in `chat_complete`: rendered inline below the message text using SDUIRenderer
- Error state: red banner below input with retry option

---

## Calendar Module

- Views: **Month** and **Day** (MVP)
- Month view: grid of days, events shown as colored dots/bars
- Day view: vertical timeline with event blocks, triggered by tapping a day in month view
- Tap event → detail bottom sheet (title, time, description, location)
- Alert badge on days with `isAlert: true` events
- Today highlighted
- Navigate between months with swipe or left/right arrows
- Data fetched via `GET /api/calendar/events?start=ISO&end=ISO` on mount and view change

---

## Forms Module

Generic form renderer — field types: text, textarea, number, date, datetime, select, multi_select, toggle, slider, submit.

- Validation rules from server (required, min/max, regex)
- Per-field error messages shown below field
- Loading state on submit button
- Success/error toast after submission
- Form data POSTed to `submitUrl` from props

---

## Alerts Module

- Scrollable list of `AlertCard` components
- Severity badge: info (blue), warning (yellow), error (red), success (green)
- Unread indicator dot
- Tap to mark as read (`POST /api/notifications/{id}/read`)
- Swipe to dismiss (`DELETE /api/notifications/{id}`)
- Pull-to-refresh
-