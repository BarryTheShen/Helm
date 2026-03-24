# Frontend Spec — iOS App (React Native / Expo)

<aside>
📋

**Instructional Header**

This is the Frontend Specification for the Agentic AI Super App. It defines everything needed to build the iOS client — a pure SDUI renderer that displays whatever JSON the backend server sends. The app ships with all component types pre-built; the server controls what appears on screen via JSON payloads.

**For the vibe coding agent:** Read this entire document before writing any code. Read the Backend Spec and Protocol Spec as well. Start implementation with the Backend, then Protocol, then this Frontend.

</aside>

---

## 1. Project Setup

### Framework & Tooling

- **Framework:** React Native with Expo (managed workflow)
- **Language:** TypeScript (strict mode)
- **Package manager:** npm or yarn (agent decides)
- **Minimum iOS version:** iOS 16+
- **Target devices:** iPhone only for MVP (iPad later)

### Scaffolding

```bash
npx create-expo-app@latest agentic-super-app --template blank-typescript
```

### Key Dependencies (agent researches latest versions)

- `expo-router` — file-based routing
- `expo-secure-store` — secure token storage (auth tokens, API keys)
- `react-native-reanimated` — animations
- `react-native-gesture-handler` — gesture support
- `react-native-safe-area-context` — safe area handling
- `@react-navigation/bottom-tabs` — bottom tab navigator
- WebSocket client (built-in React Native WebSocket or a library like `reconnecting-websocket`)
- State management library (agent decides — Zustand recommended)
- Date library (agent decides — `date-fns` or `dayjs` recommended)

### Folder Structure (suggested — agent may adapt)

```
src/
├── app/                    # Expo Router screens
│   ├── (auth)/             # Auth flow screens
│   │   ├── connect.tsx     # Enter server URL
│   │   └── login.tsx       # Enter credentials
│   ├── (main)/             # Main app screens
│   │   ├── _layout.tsx     # Tab bar layout
│   │   ├── chat.tsx        # Chat module
│   │   ├── calendar.tsx    # Calendar module
│   │   ├── forms.tsx       # Form/Input module
│   │   ├── alerts.tsx      # Notifications module
│   │   └── module-center.tsx # App center grid
│   ├── settings.tsx        # Settings screen
│   └── _layout.tsx         # Root layout
├── components/
│   ├── sdui/               # SDUI renderer components
│   │   ├── SDUIRenderer.tsx # Main renderer engine
│   │   ├── ChatView.tsx
│   │   ├── CalendarView.tsx
│   │   ├── FormView.tsx
│   │   ├── AlertCard.tsx
│   │   └── FallbackView.tsx # Error/unknown component fallback
│   ├── navigation/
│   │   ├── TabBar.tsx
│   │   ├── ModuleCenter.tsx
│   │   └── SidebarDrawer.tsx
│   └── common/             # Shared UI components
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Card.tsx
│       └── ErrorBanner.tsx
├── services/
│   ├── websocket.ts        # WebSocket connection manager
│   ├── api.ts              # REST API client
│   └── auth.ts             # Auth token management
├── stores/                 # State management
│   ├── authStore.ts
│   ├── uiStore.ts          # Current UI state from server
│   └── settingsStore.ts
├── types/                  # TypeScript type definitions
│   ├── sdui.ts             # SDUI JSON payload types
│   ├── api.ts              # API request/response types
│   └── navigation.ts
├── theme/                  # Design system tokens
│   ├── colors.ts
│   ├── typography.ts
│   └── spacing.ts
└── utils/
    ├── validation.ts       # JSON schema validation
    └── formatters.ts       # Date, time formatters
```

---

## 2. Architecture — SDUI Renderer Engine

This is the **core** of the app. The entire frontend is a Server-Driven UI renderer.

### How It Works

1. Backend sends a JSON payload describing what to render
2. The `SDUIRenderer` component receives this JSON
3. It looks up the component type in a **Component Registry**
4. It renders the matching React Native component with the provided props
5. If the component type is unknown or JSON is malformed → render `FallbackView`

### Component Registry Pattern

```tsx
// Component Registry — maps JSON type strings to React Native components
const COMPONENT_REGISTRY: Record<string, React.ComponentType<any>> = {
  'chat': ChatView,
  'calendar': CalendarView,
  'form': FormView,
  'alert': AlertCard,
  'notification_list': NotificationListView,
  // Future components added here
};

// SDUIRenderer — the core engine
function SDUIRenderer({ payload }: { payload: SDUIPayload }) {
  const Component = COMPONENT_REGISTRY[payload.type];
  
  if (!Component) {
    return <FallbackView type={payload.type} />;
  }
  
  // Validate props against expected schema before rendering
  const validProps = validateProps(payload.type, payload.props);
  if (!validProps.success) {
    return <FallbackView error={validProps.error} />;
  }
  
  return <Component {...payload.props} />;
}
```

### JSON Validation (Safe Render Guard)

Before rendering ANY JSON from the server, validate it:

1. Check that `type` field exists and is a known component type
2. Check that required props for that component type are present
3. Check that prop values are the correct types (string, number, array, etc.)
4. If validation fails → show the **previous good state** + a small error indicator
5. Log the validation error for debugging

This prevents broken UI from ever appearing on screen. A malformed calendar JSON cannot crash the app or affect other modules.

### Nested Components

Components CAN contain other components. The JSON supports nesting:

```json
{
  "type": "screen",
  "props": {
    "title": "Home",
    "children": [
      { "type": "alert", "props": { "message": "Meeting in 10 min", "severity": "warning" } },
      { "type": "calendar", "props": { "view": "day", "events": [...] } }
    ]
  }
}
```

The `SDUIRenderer` recursively renders children.

---

## 3. Navigation System

### Dual Navigation Mode

The app supports TWO navigation modes. User chooses in Settings. Default: **Mode A (Tabs)**.

### Mode A — Bottom Tab Bar + Module Center (DEFAULT)

```
┌──────────────────────────────────────────┐
│                                          │
│         Active Module (full screen)      │
│                                    [⚙️]  │ ← Settings button (top-right)
│                                          │
├─────────┬─────────┬─────────┬────────────┤
│  💬     │  📅     │  📝     │  ⊞         │
│  Chat   │  Cal    │  Forms  │  More      │ ← Bottom tab bar
└─────────┴─────────┴─────────┴────────────┘
```

- **Bottom tab bar:** 3-4 user-pinned modules + a "More" tab (last position)
- **"More" tab → Module Center:** Full-screen grid of ALL available module icons
- **Module Center layout:** 3-4 columns of icons with labels (like iOS App Library)
- User can **customize** which modules appear in the bottom tab bar (long-press to rearrange, or via Settings)
- Tapping any icon in Module Center opens that module full-screen
- The tab bar is always visible at the bottom (except when in Module Center)

### Mode B — Sidebar Drawer

- Swipe from left edge or tap hamburger menu → sidebar slides in
- Sidebar contains all module icons in a vertical list
- Main screen shows the active module full-screen
- Same Module Center concept, just accessed differently

### Module Center Grid

```
┌──────────────────────────────────────────┐
│              Module Center               │
│                                          │
│   💬 Chat      📅 Calendar    📝 Forms  │
│                                          │
│   🔔 Alerts    ⚙️ Settings    ...       │
│                                          │
│   (Future modules appear here as icons)  │
│                                          │
└──────────────────────────────────────────┘
```

For MVP, the Module Center shows only the built-in modules. No downloading or store features.

### Settings Screen

- Accessed via a **small gear icon** in the top-right corner of any module screen
- NOT a tab — it's a button that opens a settings sheet/page
- Settings contain:
    - Server connection (URL, status indicator)
    - AI Agent configuration (API URL, API key, model name)
    - Navigation mode toggle (tabs vs sidebar)
    - Tab bar customization (which modules are pinned)
    - Default screen selection
    - Device name
    - About / version info

---

## 4. Screen Flows

### First-Launch Flow

```
1. App opens → "Connect to Server" screen
   - Text field: Server URL (e.g., https://my-server.com)
   - "Connect" button
   
2. Server responds → "Authenticate" screen
   - Text field: Token / API key
   - "Sign In" button
   - Server validates token, returns session token
   
3. Auth success → "Setup" screen (first time only)
   - Choose a template (Productivity, Personal, Blank)
   - OR skip and start blank
   - Templates pre-configure which modules are in the tab bar
   
4. Setup complete → Main app
   - Default screen: Chat (user-configurable)
   - Bottom tab bar visible
   - Settings gear visible top-right
```

### App State Machine

```
[Launch] → check stored session token
  ├── No token → [Connect to Server]
  ├── Token exists → [Validate with backend]
  │     ├── Valid → [Main App]
  │     └── Invalid/Expired → [Connect to Server]
  └── No stored server URL → [Connect to Server]
```

Store server URL and session token in `expo-secure-store` (encrypted on-device storage).

### Connection State Banner

At all times, show connection state:

- **Connected:** No banner (clean UI)
- **Reconnecting:** Yellow banner at top: "Reconnecting to server..."
- **Disconnected:** Red banner at top: "Connection lost. Tap to retry."
- **Agent unreachable:** Orange banner in chat only: "Could not reach AI agent. Check settings."

---

## 5. MVP Component Catalog

These are the SDUI components the app ships with. Each component has a fixed React Native implementation. The backend controls which component appears and with what data via JSON.

### 5.1 Chat View (`type: "chat"`)

The primary interface. A conversational UI for interacting with the external AI agent.

**Features:**

- Message list (scrollable, newest at bottom)
- Text input bar at bottom with send button
- User messages (right-aligned, colored bubble)
- Agent messages (left-aligned, neutral bubble)
- Streaming support — agent response appears token-by-token in real-time
- Rich content in agent messages: bold, italic, code blocks, links
- Inline SDUI cards — agent can embed a calendar card or alert card within a chat message
- Typing indicator while agent is processing
- Timestamp on each message (subtle, gray)
- Error state: "Could not reach AI agent" message with retry button

**Data flow:**

- User types message → sent to backend via WebSocket
- Backend forwards to AI agent via OpenAI-compatible API
- Agent response streams back via WebSocket → rendered token-by-token
- Agent may also call MCP tools → backend pushes UI updates via WebSocket (for chat) or stores for pull-to-refresh (other modules)

**JSON example from server:**

```json
{
  "type": "chat",
  "props": {
    "messages": [
      {
        "id": "msg_001",
        "role": "user",
        "content": "What's on my calendar today?",
        "timestamp": "2026-03-23T10:00:00+08:00"
      },
      {
        "id": "msg_002",
        "role": "assistant",
        "content": "Here's your schedule for today:",
        "timestamp": "2026-03-23T10:00:05+08:00",
        "embeddedComponents": [
          {
            "type": "calendar",
            "props": {
              "view": "day",
              "date": "2026-03-23",
              "events": [
                { "title": "Team standup", "start": "09:00", "end": "09:30", "color": "blue" },
                { "title": "Lunch with Alex", "start": "12:00", "end": "13:00", "color": "green" }
              ]
            }
          }
        ]
      }
    ],
    "isStreaming": false
  }
}
```

### 5.2 Calendar View (`type: "calendar"`)

Displays events in a calendar format.

**Features:**

- Month view (default): grid of days with event dots
- Week view: horizontal day columns with time slots
- Day view: vertical timeline with event blocks
- Tap event → detail sheet (title, time, description, location)
- Tap "+" → create event form (uses Form component internally)
- Color-coded events by category
- Today highlighted
- Navigate between months/weeks/days with swipe or arrows
- Alert badge on days with notification/alert events

**JSON example from server:**

```json
{
  "type": "calendar",
  "props": {
    "view": "month",
    "currentDate": "2026-03-23",
    "events": [
      {
        "id": "evt_001",
        "title": "Team standup",
        "start": "2026-03-23T09:00:00+08:00",
        "end": "2026-03-23T09:30:00+08:00",
        "color": "blue",
        "description": "Daily sync with the team",
        "location": "Zoom",
        "isAlert": false
      },
      {
        "id": "evt_002",
        "title": "Dentist appointment",
        "start": "2026-03-24T14:00:00+08:00",
        "end": "2026-03-24T15:00:00+08:00",
        "color": "red",
        "isAlert": true,
        "alertMessage": "Don't forget your insurance card"
      }
    ]
  }
}
```

### 5.3 Form / Input View (`type: "form"`)

A generic form renderer. The backend defines what fields appear, the app renders them and sends user input back.

**Supported field types:**

- `text` — single-line text input
- `textarea` — multi-line text input
- `number` — numeric input
- `date` — date picker
- `datetime` — date + time picker
- `select` — dropdown / picker with options
- `multi_select` — multi-choice selector
- `toggle` — on/off switch
- `slider` — numeric range slider
- `submit` — submit button

**Features:**

- Validation rules defined by the server (required, min/max, regex, etc.)
- Error messages per field
- Loading state on submit
- Success/error feedback after submission
- Form data sent back to backend via REST API POST

**JSON example from server:**

```json
{
  "type": "form",
  "props": {
    "title": "Create Event",
    "submitUrl": "/api/events",
    "fields": [
      {
        "name": "title",
        "type": "text",
        "label": "Event Title",
        "placeholder": "Enter event name",
        "required": true
      },
      {
        "name": "date",
        "type": "datetime",
        "label": "Date & Time",
        "required": true
      },
      {
        "name": "category",
        "type": "select",
        "label": "Category",
        "options": ["Work", "Personal", "Health", "Social"],
        "default": "Personal"
      },
      {
        "name": "description",
        "type": "textarea",
        "label": "Description",
        "placeholder": "Optional details",
        "required": false
      }
    ]
  }
}
```

### 5.4 Notification / Alert Card (`type: "alert"`)

Displays important notifications and alerts.

**Features:**

- Card with icon, title, message, timestamp
- Severity levels: `info` (blue), `warning` (yellow), `error` (red), `success` (green)
- Dismissable (swipe or tap X)
- Optional action button ("View", "Snooze", "Dismiss")
- Can appear:
    - Inline in chat (embedded in agent message)
    - As a standalone notification feed (list of alert cards)
    - As a banner at the top of any screen (for urgent alerts)

**Notification Feed:** A dedicated module screen showing all alerts as a chronological list of cards. Pull-to-refresh to load latest.

**JSON example from server:**

```json
{
  "type": "alert",
  "props": {
    "id": "alert_001",
    "severity": "warning",
    "title": "Meeting in 10 minutes",
    "message": "Team standup starts at 09:00 in Zoom",
    "timestamp": "2026-03-23T08:50:00+08:00",
    "actions": [
      { "label": "Open Zoom", "url": "https://zoom.us/j/123" },
      { "label": "Dismiss", "action": "dismiss" }
    ],
    "dismissable": true
  }
}
```

### 5.5 Fallback View (`type: unknown`)

Shown when the server sends an unknown component type or malformed JSON.

**Behavior:**

- Display: "This component isn't supported in this version of the app."
- Show the raw `type` string for debugging
- Do NOT crash. Do NOT affect other components on the screen.
- Log the error locally for debugging

---

## 6. Design System

### Direction: Notion-like, Minimal

The visual style should closely follow Notion's design language:

- **Clean and minimal** — lots of white space
- **Subtle borders** — thin, light gray borders (not heavy boxes)
- **Rounded corners** — 8px border radius on cards, 12px on modals
- **System font** — SF Pro on iOS (the default; no custom fonts needed)
- **Light mode only** for MVP (dark mode is a post-MVP feature)

### Color Tokens

```tsx
const colors = {
  // Backgrounds
  background: '#FFFFFF',
  backgroundSecondary: '#F7F7F5',    // Notion's light gray
  backgroundHover: '#F1F1EF',
  
  // Text
  textPrimary: '#37352F',            // Notion's primary text
  textSecondary: '#787774',          // Notion's secondary text
  textTertiary: '#B4B4B0',           // Placeholder text
  
  // Borders
  border: '#E9E9E7',                 // Notion's border color
  borderStrong: '#D3D3D0',
  
  // Accents
  accentBlue: '#2383E2',             // Notion's blue
  accentRed: '#EB5757',
  accentGreen: '#4DAB9A',
  accentYellow: '#CB912F',
  accentOrange: '#D9730D',
  accentPurple: '#9065B0',
  accentPink: '#C14C8A',
  
  // UI States
  error: '#EB5757',
  warning: '#CB912F',
  success: '#4DAB9A',
  info: '#2383E2',
  
  // Chat bubbles
  userBubble: '#2383E2',
  userBubbleText: '#FFFFFF',
  agentBubble: '#F7F7F5',
  agentBubbleText: '#37352F',
};
```

### Typography Scale

```tsx
const typography = {
  // Use system font (SF Pro on iOS)
  h1: { fontSize: 28, fontWeight: '700', lineHeight: 34 },
  h2: { fontSize: 22, fontWeight: '600', lineHeight: 28 },
  h3: { fontSize: 18, fontWeight: '600', lineHeight: 24 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 22 },
  bodySmall: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
  label: { fontSize: 14, fontWeight: '500', lineHeight: 18 },
};
```

### Spacing Scale

```tsx
const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};
```

### Component Styling Guidelines

- **Cards:** White background, 1px `border` color border, 8px radius, `lg` padding
- **Buttons:** Primary = `accentBlue` background, white text, 8px radius, 44px min height. Secondary = transparent background, `accentBlue` text.
- **Inputs:** 1px `border` border, 8px radius, `md` padding, 44px min height. Focus = `accentBlue` border.
- **Tab bar:** White background, top 1px border, 50px height. Active tab = `accentBlue` icon. Inactive = `textSecondary`.
- **Module Center icons:** 60x60px icon area, 12px rounded square background (light tint of icon color), label below
- **Chat messages:** Max width 80% of screen. User = right-aligned, blue bubble. Agent = left-aligned, gray bubble.

### Loading, Error, and Empty States

Every module MUST have these three states:

**Loading state:**

- Skeleton screens (gray pulsing placeholder blocks) — NOT a spinner
- Match the layout of the actual content

**Error state:**

- Icon (⚠️) + message ("Something went wrong") + "Retry" button
- Never show raw error codes or JSON to the user

**Empty state:**

- Friendly illustration or icon + message ("No events yet" / "No messages yet")
- Optional action button ("Create an event" / "Start chatting")

---

## 7. Data Flow & State Management

### State Architecture

Use a state management library (Zustand recommended). Three main stores:

**`authStore`** — persistent (stored in `expo-secure-store`)

- `serverUrl: string | null`
- `sessionToken: string | null`
- `deviceId: string` (generated on first launch, persisted)
- `isAuthenticated: boolean`

**`uiStore`** — in-memory, refreshed from server

- `modules: Module[]` — list of available modules with their icons and names
- `tabBarModules: string[]` — IDs of modules pinned to tab bar
- `activeModule: string` — currently visible module
- `defaultModule: string` — module to show on launch
- `navMode: 'tabs' | 'sidebar'`
- `moduleData: Record<string, SDUIPayload>` — cached SDUI JSON per module

**`chatStore`** — in-memory

- `messages: ChatMessage[]`
- `isStreaming: boolean`
- `connectionState: 'connected' | 'reconnecting' | 'disconnected'`

### Data Refresh Strategy

- **Chat module:** Real-time via WebSocket. Messages stream in as they're generated.
- **All other modules (Calendar, Forms, Alerts):** Pull-to-refresh. User swipes down → app fetches latest JSON from `GET /api/modules/{moduleId}/state`.
- **On module switch:** Fetch latest data when user switches to a different tab.
- **On app foreground:** Fetch latest data for active module when app returns from background.

---

## 8. WebSocket Connection

### Connection Lifecycle

1. After auth, establish WebSocket to `wss://{serverUrl}/ws?token={sessionToken}&device={deviceId}`
2. Maintain connection while app is in foreground
3. On disconnect → auto-reconnect with exponential backoff (1s, 2s, 4s, 8s, max 30s)
4. On app background → close WebSocket (save battery)
5. On app foreground → re-establish WebSocket
6. Heartbeat: send `ping` every 30s, expect `pong` within 10s

### Message Types (client sends)

- `{ "type": "chat_message", "content": "user's message text" }`
- `{ "type": "ping" }`

### Message Types (server sends)

- `{ "type": "chat_token", "content": "partial text" }` — streaming response token
- `{ "type": "chat_complete", "messageId": "...", "content": "full message" }` — complete message
- `{ "type": "chat_error", "error": "Agent unreachable" }` — error
- `{ "type": "pong" }` — heartbeat response

See **Protocol Spec** for full message format definitions.

---

## 9. Error Handling

- **Server unreachable:** Banner: "Connection lost. Retrying..." Auto-reconnect.
- **Agent unreachable:** In chat: "Could not reach AI agent. Check your agent settings." With retry button.
- **Malformed JSON from server:** Show previous good state. Log error. Show subtle error indicator.
- **Network timeout:** Retry with exponential backoff. After 3 retries, show error state with manual retry button.
- **Auth token expired:** Redirect to login screen. Clear stored token.
- **Unknown component type:** Render FallbackView. Don't crash.

---

## 10. Agent Decisions (Implementation Details Left to Vibe Coding Agent)

The following are implementation details the vibe coding agent should research and decide:

- Specific state management library (Zustand recommended but not required)
- Exact animation patterns and transitions
- Keyboard handling and avoidance
- Image caching strategy
- Local data persistence beyond auth tokens (AsyncStorage vs MMKV)
- Accessibility features (VoiceOver support)
- Deep linking configuration
- App icon and splash screen design
- Performance optimization (FlatList virtualization, memo patterns)
- Testing framework (Jest + React Native Testing Library)
- CI/CD pipeline configuration
- Exact expo-router file structure (adapt the suggested one as needed)

---

## 11. What NOT to Build

These features are explicitly **out of scope** for MVP:

- ❌ Dark mode
- ❌ iPad support
- ❌ Android support (React Native makes this easy to add later, but MVP = iOS only)
- ❌ Push notifications (requires Apple Push Notification service setup)
- ❌ Offline mode / local caching of module data
- ❌ Module store / community modules / downloading new modules
- ❌ External service connections UI (Google Calendar OAuth, etc.)
- ❌ Multiple agent connections
- ❌ Multiple workspaces
- ❌ List view component
- ❌ Chart component
- ❌ Map component
- ❌ File upload/download
- ❌ Voice input
- ❌ Biometric auth (Face ID / Touch ID)