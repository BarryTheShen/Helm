# TDD Plan — Helm Mobile Frontend

Test stubs mirroring the implementation plan sections.

---

## Section 1: Project Scaffold & Foundation

```typescript
// src/__tests__/foundation.test.ts
describe('Foundation', () => {
  it('tsconfig has strict mode enabled')
  it('theme colors export all required keys')
  it('theme spacing exports numeric values')
})
```

---

## Section 2: Types & Validation

```typescript
// src/__tests__/types.test.ts
describe('SDUI Types', () => {
  it('parseCalendarComponent accepts valid calendar payload')
  it('parseCalendarComponent rejects missing required fields')
  it('parseFormComponent accepts valid form payload')
  it('parseAlertComponent accepts valid alert payload')
  it('unknown component type falls back to FallbackView')
})
```

---

## Section 3: Auth Store

```typescript
// src/__tests__/stores/authStore.test.ts
describe('authStore', () => {
  it('initial state has no token or serverUrl')
  it('setToken stores token in state')
  it('logout clears token, serverUrl, and userId')
  it('setServerUrl stores url')
})
```

---

## Section 4: UI Store & Settings Store

```typescript
// src/__tests__/stores/uiStore.test.ts
describe('uiStore', () => {
  it('appendChatToken creates new message entry on first token')
  it('appendChatToken appends to existing message')
  it('finalizeChatMessage sets isStreaming to false')
  it('addUserMessage adds entry with role=user')
  it('addToolCallStart creates tool_call entry with status=pending')
  it('updateToolCallComplete sets status to complete')
  it('addNotification increments unreadCount')
  it('markNotificationRead decrements unreadCount')
  it('removeNotification removes entry from array')
})

// src/__tests__/stores/settingsStore.test.ts
describe('settingsStore', () => {
  it('default navMode is tabs')
  it('setNavMode updates navMode')
})
```

---

## Section 5: Auth Service & API Client

```typescript
// src/__tests__/services/auth.test.ts
describe('auth service', () => {
  it('storeToken saves to SecureStore')
  it('getToken returns null when empty')
  it('clearToken removes key from SecureStore')
  it('storeServerUrl saves url')
})

// src/__tests__/services/api.test.ts
describe('API client', () => {
  it('login sends POST /auth/login with correct body')
  it('login returns sessionToken from response')
  it('getCalendarEvents appends start/end query params')
  it('throws ApiError with status on non-2xx response')
  it('throws ApiError with 401 on unauthorized')
  it('all requests include Authorization Bearer header')
})
```

---

## Section 6: WebSocket Service

```typescript
// src/__tests__/services/websocket.test.ts
describe('WebSocket service', () => {
  it('incoming chat_token calls uiStore.appendChatToken')
  it('incoming chat_complete calls uiStore.finalizeChatMessage')
  it('incoming pong resets heartbeat timer')
  it('incoming ui_update calls uiStore.updateCalendar for calendar module')
  it('sendChatMessage when disconnected queues the message')
  it('sendChatMessage calls uiStore.addUserMessage')
  it('unknown message type logs warning and does not throw')
  it('chat_complete sets isStreaming to false')
})
```

---

## Section 7: Auth Screens

```typescript
// src/__tests__/screens/connect.test.tsx
describe('Connect screen', () => {
  it('shows error when health check fails')
  it('navigates to login on successful health check')
  it('pre-fills URL from SecureStore')
})

// src/__tests__/screens/login.test.tsx
describe('Login screen', () => {
  it('shows error message from API error response')
  it('navigates to chat on successful login')
  it('disables sign in button while loading')
})

// src/__tests__/screens/rootLayout.test.tsx
describe('Root layout auth guard', () => {
  it('redirects to chat when token is present')
  it('redirects to connect when no token')
})
```

---

## Section 8: Chat Screen

```typescript
// src/__tests__/screens/chat.test.tsx
describe('Chat screen', () => {
  it('user message renders right-aligned')
  it('assistant message renders left-aligned')
  it('send button is disabled when isStreaming is true')
  it('send button is disabled when input is empty')
  it('typing indicator shown when isStreaming and no active tokens')
  it('tool call card toggles expanded on press')
  it('error banner shown when connectionState is not connected')
})
```

---

## Section 9: Calendar, Forms, Alerts Screens

```typescript
// src/__tests__/screens/calendar.test.tsx
describe('Calendar screen', () => {
  it('month view renders 28-31 day cells')
  it('event dot renders on correct day')
  it('tapping a day switches to day view')
  it('today is highlighted with accent color')
})

// src/__tests__/screens/alerts.test.tsx
describe('Alerts screen', () => {
  it('swipe to delete calls api.deleteNotification')
  it('tap to read calls api.markNotificationRead')
  it('unread badge count matches uiStore.unreadCount')
  it('empty state shown when no notifications')
})
```

---

## Section 10: Settings Screen

```typescript
// src/__tests__/screens/settings.test.tsx
describe('Settings screen', () => {
  it('change server URL clears auth state')
  it('agent config save calls api.updateAgentConfig')
  it('sign out clears token and navigates to connect')
})
```

---

## Section 11: SDUI Components & Theme

```typescript
// src/__tests__/components/sdui.test.tsx
describe('SDUI Renderer', () => {
  it('renders CalendarView for type=calendar')
  it('renders FormView for type=form')
  it('renders AlertCard for type=alert')
  it('renders FallbackView for unknown type')
  it('does not crash on unknown type in production')
})

// src/__tests__/components/FormView.test.tsx
describe('FormView', () => {
  it('shows validation error when required field is empty on submit')
  it('calls api.submitForm on valid submission')
  it('shows loading state during submission')
})

// src/__tests__/components/Button.test.tsx
describe('Button', () => {
  it('shows spinner when loading=true')
  it('is not pressable when loading=true')
})
```
