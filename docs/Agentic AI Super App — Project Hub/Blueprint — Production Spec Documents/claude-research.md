# Claude Research — Helm Frontend (React Native Expo)

## 1. Backend Integration Reference

### Base URLs
- REST: `http://HOST:8000`
- WebSocket: `ws://HOST:8000/ws?token=TOKEN`
- MCP: `http://HOST:8000/mcp/`

### App Launch / Auth Flow
1. `GET /auth/status` — check `setup_complete`. If false → show onboarding.
2. If not set up: `POST /auth/setup` (username, password) → 201
3. `POST /auth/login` (username, password, device_id, device_name) → `session_token` + `expires_at`
4. Store `session_token` in `expo-secure-store`
5. Open WebSocket: `ws://HOST:8000/ws?token=SESSION_TOKEN`
6. `GET /api/agent/config` — if `api_key_set == false`, prompt in Settings

Tokens are opaque JWT strings to the client. Lifetime: 24h. Expired/invalid → HTTP 401 (REST) or close code 4001 (WebSocket).

### All REST Endpoints

**Auth (no auth required)**
- `GET /auth/status` → `{ setup_complete, server_name, version }`
- `POST /auth/setup` → `{ user_id, message }` (201; 409 if already set up)
- `POST /auth/login` body: `{ username, password, device_id, device_name }` → `{ session_token, expires_at, user_id }`
- `POST /auth/logout` (Bearer required)
- `POST /auth/refresh` (Bearer required) → new `session_token`
- `GET /auth/me` → `{ user_id, username, created_at }`

**Calendar** (`/api/calendar`, Bearer required)
- `GET /api/calendar/events?start=ISO&end=ISO` → `{ events: CalendarEvent[] }`
- `POST /api/calendar/events` body: `CalendarEventCreate` → `CalendarEvent`
- `GET /api/calendar/events/{id}` → `CalendarEvent`
- `PATCH /api/calendar/events/{id}` body: `CalendarEventUpdate` → `CalendarEvent`
- `DELETE /api/calendar/events/{id}` → 204

**Chat** (`/api/chat`, Bearer required)
- `GET /api/chat/history?limit=50&offset=0` → `{ messages: ChatMessage[], total }`
- `DELETE /api/chat/history` → 204 (clears all)
- `POST /api/chat/message` (REST fallback) body: `{ content }` → streaming response

**Notifications** (`/api/notifications`, Bearer required)
- `GET /api/notifications?unread_only=false&limit=50` → `{ notifications: Notification[], unread_count }`
- `POST /api/notifications/{id}/read` → 200
- `POST /api/notifications/read-all` → 200
- `DELETE /api/notifications/{id}` → 204

**Modules** (`/api/modules`, Bearer required)
- `GET /api/modules` → `{ modules: ModuleState[] }`
- `GET /api/modules/{module_type}` → `ModuleState`
- `PUT /api/modules/{module_type}` body: `{ state }` → `ModuleState`

**Agent Config** (`/api/agent`, Bearer required)
- `GET /api/agent/config` → `{ provider, model, base_url, system_prompt, api_key_set }`
- `PUT /api/agent/config` body: `{ provider, model, api_key?, base_url?, system_prompt? }` → updated config
- `POST /api/agent/test` → `{ success, message, latency_ms }`

**Workflows** (`/api/workflows`, Bearer required)
- `GET /api/workflows` → `{ workflows: Workflow[] }`
- `POST /api/workflows` → `Workflow`
- `GET /api/workflows/{id}` → `Workflow`
- `PUT /api/workflows/{id}` → `Workflow`
- `DELETE /api/workflows/{id}` → 204
- `POST /api/workflows/{id}/toggle` → `{ is_active }`
- `POST /api/workflows/{id}/run` → `{ success, message }`

### WebSocket Message Types

**Client → Server:**
```
chat_message: { type: "chat_message", content: string, messageId: string }
pong: { type: "pong" }
```

**Server → Client:**
```
connected: { type: "connected", deviceId, userId, serverVersion }
ping: { type: "ping" }
chat_token: { type: "chat_token", messageId, token, index }
chat_complete: { type: "chat_complete", messageId, role, content, timestamp, embeddedComponents? }
chat_error: { type: "chat_error", code, message, retryable }
tool_call_start: { type: "tool_call_start", messageId, toolName, toolCallId }
tool_call_complete: { type: "tool_call_complete", messageId, toolCallId, toolName, success, resultSummary? }
ui_update: { type: "ui_update", module, component }
notification: { type: "notification", notification: Notification }
server_event: { type: "server_event", eventType, payload }
```

### Key Data Shapes

**CalendarEvent:** `{ id, title, description?, location?, start, end, color?, is_all_day, is_alert, alert_message?, created_at, updated_at }`

**ChatMessage:** `{ id, role (user|assistant|system|tool), content, metadata_json?, created_at }`

**Notification:** `{ id, title, message, severity (info|warning|error|success), is_read, actions_json?, created_at }`

**AgentConfig (client view):** `{ provider, model, base_url?, system_prompt?, api_key_set: bool }`

**ModuleState:** `{ id, module_type, state_json, version, updated_at }`

### Known Backend Bugs to Code Around
1. `ChatMessage.message_metadata` → use `metadata_json` attribute — affects chat history display
2. `AgentConfig` missing `is_active`, `temperature`, `max_tokens` fields — don't depend on them
3. `/auth/refresh` creates session with `device_id=None` — handle 500 gracefully, show re-login
4. `CalendarEvent.all_day` vs `is_all_day` inconsistency — use `is_all_day` in reads

---

## 2. Expo Router v4 — Key Patterns

### Auth Guard (Root Layout)
```typescript
// app/_layout.tsx — guard before navigator mounts
const { token } = useAuthStore();
const segments = useSegments();
const router = useRouter();

useEffect(() => {
  const inAuthGroup = segments[0] === '(auth)';
  if (!token && !inAuthGroup) router.replace('/(auth)/connect');
  else if (token && inAuthGroup) router.replace('/(main)/chat');
}, [token, segments]);
```
- **Critical gotcha:** Never redirect before `navigationState?.key` is set — check `router.isReady` or use `<Redirect>` inside the layout body
- Use `<Stack>` at root, `<Tabs>` inside `(main)/_layout.tsx`
- Protected routes live under `(main)/`, auth routes under `(auth)/`

### Tab Navigation
```typescript
// app/(main)/_layout.tsx
<Tabs screenOptions={{ tabBarStyle: ... }}>
  <Tabs.Screen name="chat" options={{ title: 'Chat', tabBarIcon: ... }} />
  ...
</Tabs>
```

---

## 3. Zustand — Best Practices

### Slice Pattern
```typescript
type AuthSlice = { token: string | null; setToken: (t: string | null) => void; };
type AppStore = AuthSlice & UISlice & SettingsSlice;
const useAppStore = create<AppStore>()((...a) => ({ ...createAuthSlice(...a), ...createUISlice(...a), ...createSettingsSlice(...a) }));
```
- Use `useShallow` when selecting objects: `useAppStore(useShallow(s => ({ a: s.a, b: s.b })))`
- Tokens go in `expo-secure-store` manually (async) — do NOT use `persist` middleware for tokens (it uses AsyncStorage, not SecureStore)
- Use `devtools` middleware in dev builds

---

## 4. SDUI Renderer — Key Patterns

### Discriminated Union Registry
```typescript
type SDUIComponent = ChatComponent | CalendarComponent | FormComponent | AlertComponent;
const componentRegistry: Record<SDUIComponent['type'], React.ComponentType<any>> = {
  chat: ChatView,
  calendar: CalendarView,
  form: FormView,
  alert: AlertCard,
};
```
- Every SDUI node needs an `id` field (React key in lists)
- Validate incoming JSON at API boundary with Zod — never crash inside components
- Unknown types render `FallbackView` in dev (shows type name), `null` in prod
- Actions dispatched through context, not prop-drilled

---

## 5. WebSocket — Reconnection Patterns

### State Machine Approach
States: `CONNECTING → OPEN → CLOSING → CLOSED → RECONNECTING`

- Exponential backoff with jitter: `delay = min(base * 2^attempt, maxDelay) + rand(0, 1000)`
- Auth: send token as query param on connection URL (server validates on connect)
- Reconnect logic **only in `onclose`** — not in `onerror` (onerror fires first)
- Do NOT reconnect on close codes: `1000`, `1001`, `1008`, `4001` (auth failure)
- Heartbeat: send `ping` every 30s, expect `pong` within 5s, else force-close
- Handle `AppState` changes: close on background, reconnect on foreground
- Drive UI (connection badge) from Zustand `connectionState`, not from WS callbacks directly

---

## 6. Summary of Key Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Routing | Expo Router v4 | Spec requirement, file-based |
| State | Zustand (slice pattern) | Spec recommendation, lightweight |
| Token storage | expo-secure-store | Spec requirement, secure keychain |
| Dates | date-fns | Spec recommendation |
| WS library | Native RN WebSocket + custom reconnect | More control than reconnecting-websocket |
| Validation | Zod | Type-safe schema validation at API boundary |
| Animations | react-native-reanimated | Spec requirement |
