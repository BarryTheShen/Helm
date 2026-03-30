# Architecture Decisions — Session 2 (2026-03-29)

**Source:** [Session 2 — 2026-03-29 — Frontend Infrastructure & Mutability Model](Brainstorming%20Sessions/Session%202%20%E2%80%94%202026-03-29%20%E2%80%94%20Frontend%20Infrastructure%20&%202e4fe87f0d0349abac6a08acced135b7.md)

**Scope:** Frontend infrastructure, mutability model, layout system, component catalog, action system, validation, authentication, multi-device strategy.

**Status:** Decided — ready to implement.

---

## 1. Project Framing

### Decision: Not "Agentic AI Super App"

Helm is a **self-hosted SDUI platform with AI-assisted editing.** The system works entirely without AI. AI serves exactly two roles:

1. **The editor** — builds and modifies modules (creates tabs, arranges components, connects data sources)
2. **A chat interface** — user can talk to an AI agent within the app

Everything else — navigation, buttons, data display, refresh, forms — works independently of AI. The app is not dependent on AI to function.

**Value over a webapp:** Push notifications, offline support (cached last known state), native Apple features (potentially ScreenTime control), MCP/OpenClaw bridge.

**Value over a native app:** No Swift or Kotlin required. SDUI renders natively from JSON. Deploy by pushing JSON configs, not App Store updates.

**Target users:** OpenClaw users who barely know programming. The platform should be easy to deploy and use without deep technical knowledge.

---

## 2. Terminology

These terms were explicitly defined during the session to eliminate ambiguity:

### Module

A **tab on the bottom bar**. Each module is a mini-application with its own layout, components, and data connections. Examples: Calendar module, Chat module, a composite module combining calendars + task schedules.

- Modules have **templates** — pre-built blueprints (e.g., "Calendar Template" comes with month grid, event list, event card layout, refresh strategy).
- The 7 hardcoded tabs in the current codebase (Home, Chat, Modules, Calendar, Forms, Alerts, Settings) should become templates, not hardcoded tabs.
- If the bottom tab bar can't fit all modules, overflow goes to a "more" menu or similar.
- The tab bar itself is **dynamic** (server-controlled), except Settings which should always be accessible (possibly via iOS Settings app for server endpoint configuration).

### Component

A **UI element inside a module**. Buttons, calendars, text blocks, input fields, cards, lists — these are all components.

- Components also have **templates** — pre-built variants the AI can use with small modifications.
- A module is a layout of multiple components, each potentially connected to different data sources.
- A module can be a composite — e.g., multiple calendars each connected to a different API, combined with a task list.

### Shallow Nesting

Components can have **child components**, but **no grandchildren**. Two levels maximum.

- Rationale: A calendar module with an event list where each event card has a button is already 3 levels (module → list → card → button). Truly flat won't work.
- The current codebase already supports this via `children` arrays in the SDUI types.
- Deeper nesting is not needed for MVP and adds complexity.

---

## 3. Layout System

### Decision: Flexbox + Semantic Grid

The SDUI JSON expresses layout using **Flexbox semantics** — row/column direction, flex-grow/shrink ratios, alignment, wrapping. On top of that, a **semantic grid** provides convenience shorthand.

**Core principles:**

- **No absolute pixel values anywhere in SDUI JSON.** All sizing is relative: percentages, flex ratios, grid column spans.
- **Semantic text sizing:** caption, body, title, headline. The client maps these to actual point sizes based on device and user accessibility settings.
- **Semantic spacing:** gap and padding use a scale (none, xs, sm, md, lg), not pixel values.

### Grid System

- **4-column grid** for compact screens (phone portrait).
- Grid shorthand: `gridColumns` (e.g., 4) and `columnSpan` (1–4). Client translates `columnSpan` into `flex-basis` percentage.
- Example: "this component spans 2 of 4 columns" = `flex-basis: 50%`.

### Structural Component Flexbox Properties

- `direction`: row | column
- `flex`: number (grow/shrink ratio)
- `align`: start | center | end | stretch
- `justify`: start | center | end | space-between | space-around
- `wrap`: boolean
- `gap`: none | xs | sm | md | lg (semantic)
- `padding`: semantic scale

### Breakpoints — Parked

Breakpoints were discussed extensively but **deferred** for now. The complexity of maintaining multiple layout variants (compact vs regular) creates unnecessary work that can't be easily solved.

- **Current approach:** Flexbox handles responsiveness automatically. Same JSON to all devices, client adapts.
- **Future consideration:** 2-breakpoint system (compact <600pt = 4 columns, regular ≥600pt = 8 columns) was designed but not implemented.
- **Marketplace compatibility:** Future marketplace could show compatibility guidelines ("works on phone", "works on tablet") instead of requiring all templates to support all sizes.

### Why Flexbox Solves Most Problems

- Text wraps automatically, containers resize based on available space.
- The server never says "this button is 200px wide" — it says "this button fills its container."
- Rotating the phone triggers a re-layout automatically. Components reflow. No new JSON needed.
- Edge cases: (1) fixed-aspect-ratio components (images, calendars) → set aspect ratio, not pixel size, (2) long text in small containers → line-clamp with ellipsis.

### The Actually Hard Problem: Adaptive Components

The hard problem is **component behavior at different sizes**, not layout. A calendar at full-screen width shows a month grid. At half-width, it can only show a week strip. This is called "adaptive components" and must be baked into the native component code, not the SDUI JSON.

**Solution:** Hardcoded component variants (see Component Catalog section).

---

## 4. Component Catalog — 4 Tiers

### Tier 1 — Structural (the grid skeleton)

- **Container / Row / Column** — Flexbox primitives. "Span 2 of 4 columns" = column with `flex: 2`.
- **ScrollView** — scrollable container. Almost every module needs this.
- **Spacer** — pushes things apart. Simple but critical.

### Tier 2 — Atomic (the bricks)

- **Text** — semantic sizing (caption, body, title, headline). No pixel font sizes. Markdown formatting.
- **Button** — variants (primary, secondary, outline, ghost). Has an `action` binding.
- **Image** — aspect-ratio-based sizing. URL source.
- **TextInput** — single line and multiline. "Send message" = TextInput + Button in a Row.
- **Icon** — fixed icon set (SF Symbols or Lucide).
- **Divider** — horizontal line.

### Tier 3 — Composite (pre-built smart blocks)

- **Calendar** — Compact variant = week strip. Full variant = month grid. Hardcoded rendering logic in app binary.
- **List** — scrollable list of items. Each item is a child component. Supports pull-to-refresh.
- **Card** — bordered/shadowed container for grouping. Can have child components.
- **Chat** — streaming chat interface. Needs WebSocket integration for real-time messages.

### Tier 4 — Data-bound (need data pipeline first)

- **Form** — input fields that write back to a data source.
- **Chart** — bar, line, pie.
- **Map** — needs location data. **Skipped for now.**

### Component Variants — Hardcoded in App Binary

Component variants (e.g., `calendar-compact`, `calendar-full`) are **hardcoded in the React Native binary**. The AI or template selects which variant to use, but the actual rendering logic is native code.

- Rationale: Apple ToS compliance — all component rendering code must ship in the reviewed binary.
- Custom components come later as an extension point.
- A component can take up multiple "cells" on the grid — no restriction on span.

---

## 5. Action System — #1 Priority

This is the **most critical gap** in the current codebase. All action handlers currently just `console.log`. Buttons render visually but tapping them does nothing.

### Current Code State (as of 2026-03-29)

- `sdui.ts` defines 6 action types: navigate, api_call, dismiss, open_sheet, copy_text, open_url.
- **None of them work.** Every `onAction` handler is `console.log`.
- `POST /api/modules/{module_id}/action` exists but is a complete stub — returns `{"status": "ok"}`, does nothing.
- `mcp/tools.py` has 16 tools but none are callable from SDUI actions — only from AI chat or MCP.
- Function registry does not exist. Entirely new work.

### Client-Side Actions (no server call, handled in React Native)

| Action | Behavior |
| --- | --- |
| `navigate` | Switch to another module/tab via React Navigation |
| `go_back` | Return to previous screen |
| `open_url` | Open link in system browser via Linking API |
| `dismiss` | Close modal/sheet |
| `open_sheet` | Open bottom sheet with SDUI content |
| `copy_text` | Copy string to clipboard |
| `toggle` | Show/hide a section locally (no network) |

Most of these are already typed in `sdui.ts`. The `onAction` handlers need to dispatch to the actual React Native APIs instead of `console.log`.

### Server-Side Actions (hit backend)

| Action | Behavior |
| --- | --- |
| `server_action` | Call a named function on the backend (replaces `api_call`) |
| `send_to_agent` | Send a message to the AI chat |

### Named Functions vs Raw Endpoints

**Decision: Named functions. Delete `api_call`.**

The current `sdui.ts` has `api_call` with raw `method`, `path`, `body` — the SDUI JSON literally contains the URL to hit. This is a security problem: nothing stops the AI (or a bad actor) from writing any URL into the JSON.

**Named functions fix this:**

- Instead of `{ type: 'api_call', path: '/api/calendar/events' }`, use `{ type: 'server_action', function: 'refresh_calendar' }`.
- Backend has a **registry** (whitelist) of allowed function names.
- Safer: whitelist model, per-module scoping.
- More portable: change backend URLs in one place; AI only knows function names.
- Nothing currently uses `api_call` (all handlers are `console.log`), so deleting it breaks nothing.

### New Type Definition for `server_action`

```tsx
{
  type: 'server_action',
  function: string,        // registered function name
  params?: Record<string, any>  // optional parameters
}
```

### Function Registry — New Backend Component

A new file: `backend/app/services/action_registry.py`.

Simplest version: a Python dict mapping function names → handlers + allowed modules + param schemas.

**Starter set for testing:**

- `refresh_data` — re-fetch data for a module
- `submit_form` — collect user inputs and send to backend (covers any TextInput + Send pattern, settings save, event creation — not just surveys)
- `send_to_agent` — route a message to the AI chat

**Templates bundle their own functions.** When a calendar template is installed, it registers `refresh_calendar`, `create_event`, `delete_event` into the function registry. The template package includes both SDUI layout JSON and its associated backend functions.

### Key Insight

The app doesn't need AI to function. Buttons call named functions. Functions are registered on the backend. AI's only role is (1) creating modules (choosing templates, arranging components) and (2) the chat interface. Everything else works independently.

---

## 6. Templates & AI Module Creation

### Decision: Template-First

AI **defaults to templates**. Freeform creation from scratch is a fallback only.

- The `create_module` tool has a required `template_id` field. "blank" is just one option.
- When AI uses a template and swaps data bindings, layout errors are nearly impossible.
- Templates are pre-built module blueprints that know how to render a certain kind of data.

### Module Templates vs Component Templates

- **Module templates:** Full mini-app blueprints (Calendar Module, Chat Module, Task List Module). Include layout, components, data bindings, refresh strategy, and bundled backend functions.
- **Component templates:** Pre-built variants of individual components (calendar-compact, calendar-full, button-primary, button-ghost). AI makes small modifications.

### AI-Only Module Creation Ships First

The backend visual editor (Level B, Retool-like drag-and-drop) comes later. For now, modules are created exclusively through AI.

**API-first UI pattern:** Both AI and future editor are just different clients calling the same module management API (`create_module`, `update_layout`, `connect_data_source`, etc.). The editor is a GUI on top of the same API the AI uses.

---

## 7. Validation — 3-Layer Defense

### Problem: AI-Generated Layout Can Break

AI doesn't respect safe areas, scroll boundaries, touch target sizes. Without constraints, it could produce a button as big as the entire screen, overlapping content, or invisible text.

Additionally, validation errors sent back to AI cause token burn — the AI retries again and again, costing the end user money.

### Layer 1 — Constrain the Input Space

The tool schema itself prevents bad output. Each component type has min/max column spans and row heights baked into its type definition.

- Example: `column_span: int (1-4)`, `row_span: int (1-4)`. AI literally cannot produce "button as big as entire screen."
- Grid system enforces boundaries: everything is in a 4-column grid with semantic sizing.
- **Eliminates ~80% of layout errors** before they happen.

### Layer 2 — Template-First Bias

System is heavily biased toward templates. When AI uses a template and just swaps data bindings, layout errors are nearly impossible.

- `create_module` tool has a required `template_id` field.
- "blank" template exists for freeform, but it's not the default.

### Layer 3 — Validation + Retry Budget

MCP server validates the produced layout. If invalid:

1. Error returned to AI.
2. AI retries — **capped at 2 retries maximum.**
3. After 2 failures, **fall back to the closest matching template** and tell user: "I couldn't create the exact layout, so I used the calendar template as a starting point. You can customize further."

**Key insight:** The more you constrain Layers 1 and 2, the less Layer 3 ever fires.

---

## 8. Human-in-the-Loop — Draft/Approval Flow

### Decision: All AI Layout Changes Go Through Approval

When the AI creates or significantly modifies a module layout, the module enters a **"draft" state**.

The user sees a preview (modal or "draft" badge on the tab). Three options:

1. **Approve** → layout goes live
2. **Reject with feedback** → user's text feedback sent back to AI as context for next attempt (counts against the 2-retry budget from Layer 3)
3. **Reject and revert** → falls back to previous state or template

### Why This Design

- **Transparency:** User sees exactly what the AI produced. They control whether it goes live.
- **Attribution:** If it's bad, the user knows it's the AI's output, not Helm's platform.
- **Better feedback:** "The calendar is too small, make it bigger" is actionable for the AI. `VALIDATION_ERROR: component exceeds bounds` is not.

### Skip/Auto-Approval

Available as options:

- **Skip approval** — for users who trust their AI and want speed.
- **Auto-approval** — when using templates without modification, approval can be skipped automatically.

---

## 9. Data Pipeline

### Decision: Industry-Standard Pattern

Follows the same pattern as Retool, Appsmith, and Superblocks — data source connection layer, query/transform layer, UI binding layer. Helm's differentiator: AI does the wiring.

### Pipeline Steps

1. **Connection.** User or AI triggers a connection ("Connect my Google Calendar"). Backend initiates OAuth, stores tokens.
2. **Sync.** Backend syncs data from external API via background job. Stores normalized local copy in backend DB (the "sync layer").
3. **SDUI generation.** When frontend requests a module's screen, backend reads from local DB cache and assembles SDUI JSON.
4. **Rendering.** Frontend receives SDUI JSON and renders it. The renderer maps each component type to its native implementation.
5. **Refresh cycle.** Client polls backend on interval OR backend pushes via WebSocket. Backend re-syncs from external API based on module's refresh strategy. Default: auto-refresh. Users can opt into pull-to-refresh for optimization.
6. **Write-back (mutations).** User via AI says "add meeting at 3pm" → agent writes to Google Calendar API → triggers re-sync → new SDUI JSON push to frontend.

### What's Hardcoded vs Dynamic

**Hardcoded (won't cause problems):**

- SDUI component renderers (Apple ToS requirement — all code in reviewed binary)
- Auth/OAuth flow (security-critical)
- Design system (colors, typography, spacing)

**Dynamic (server-controlled):**

- Tab bar and module list
- Module layouts and component arrangements
- Data bindings and connections
- Refresh strategies (per-module configurable)

---

## 10. Multi-Device Architecture

### Decision: Same JSON, Client Adapts

**Current state:** The `devices` table exists in the backend DB. WebSocket manager exists but sends to ALL connections for a `user_id` — no device distinction.

**Design:**

- One user, multiple devices.
- Backend sends the **same SDUI JSON** to all devices.
- Each device's Flexbox engine adapts the layout to its screen size.
- **Per-device server-side layouts deferred** — later optimization.

### Device Routing Infrastructure — Design In From Start

Even though per-device layouts are deferred, the **routing infrastructure** should be designed in from the start:

- Device IDs on WebSocket connect (the `devices` table already exists, just needs wiring into WS manager).
- Targeted WebSocket messages per `device_id` (not just broadcast to all connections for a user).
- This enables future per-device layouts without architectural changes.

### CORS

**Not applicable to mobile app.** CORS is a browser-only security feature. Has zero impact on React Native. Only matters when the web editor ships. Low priority — fix later.

---

## 11. Authentication

### Current Auth Flow

1. **Setup:** User opens app → enters server URL + username/password → `POST /auth/setup` creates user with bcrypt hash.
2. **Login:** `POST /auth/login` → backend verifies password → creates Session row with JWT token + expiration → returns token.
3. **Every request:** App sends `Authorization: Bearer {token}` header. Backend's `get_current_user()` checks Session table: token exists, `is_active=True`, not expired. If no → 401.
4. **WebSocket:** Token passed as query param `ws?token=...`.
5. **MCP:** Own auth middleware reads Bearer token, sets user context.

**Unauthenticated endpoints:** `/health`, `/auth/status`, `/auth/setup`, `/auth/login` only.

### Decision: CLI-Only User Creation

**Remove `POST /auth/setup` entirely.** First user created via CLI command on the server:

```bash
python manage.py create_user
```

No HTTP endpoint for user creation. This eliminates the biggest security hole (anyone who knows the server URL could create a user).

Additional users created through a future admin panel on the backend. The admin panel later becomes the visual editor too.

### Security Issues — Noted, Fix Later

All identified, all deferred. Priority is getting the system working first.

1. **No rate limiting on login** — brute force possible. Add rate limiting later.
2. **`POST /auth/setup` wide open** — needs removal (replaced with CLI). **This is the most urgent fix.**
3. **CORS `allow_origins=["*"]`** — browser-only, irrelevant for mobile app. Fix when web editor ships.
4. **Frontend logout doesn't invalidate backend session** — stolen token stays valid until expiry. Add session invalidation on logout.
5. **Token in WebSocket URL visible in server logs/proxy logs** — move to first message after connection or use a separate auth handshake.
6. **No HTTPS enforcement** — add when deploying to public internet.

### Auth + Action System Connection

`POST /api/modules/{module_id}/action` already includes the auth token. Backend validates token, identifies user, runs the function for that user's data only. Function registry is already scoped to authenticated users. Future: also check per-module ownership.

---

## 12. Hardcoded vs Dynamic — The Complete List

### Hardcoded in App Binary (cannot change without App Store update)

- SDUI component renderers — the 4 tiers of components (Apple ToS: all rendering code must be in the reviewed binary)
- Auth/OAuth flow — security-critical, must be native code
- Design system — colors, typography, spacing tokens
- Component variants — calendar-compact, calendar-full, etc.
- Chat streaming behavior — WebSocket integration for real-time chat

### Dynamic (server-controlled, changes without app update)

- Tab bar — which modules appear, their order, their icons
- Module list — what modules exist for this user
- Module layouts — arrangement of components within each module
- Data bindings — which component connects to which data source
- Refresh strategies — per-module polling interval or push preference
- Component content — text, images, list items, calendar events
- Action bindings — which button triggers which function
- Templates — new templates can be added server-side

### The Guiding Principle

> "It shouldn't be hardcoded if we are not going to have serious problems with it."
> 

---

## 13. Responsive Layout Research

Three industry approaches were researched:

### Approach 1 — Flexbox / Auto-Layout (chosen)

What React Native already uses. Server sends **layout intent** ("these 3 cards are in a row, each takes equal width"), not pixel coordinates. Client's Flexbox engine resolves actual pixel dimensions. Used by Airbnb, Lyft, and most mobile SDUI systems.

### Approach 2 — Breakpoint-Based Layouts

Server sends multiple layout variants for different screen size "buckets" (compact, medium, expanded). Android's Jetpack Compose calls these "window size classes." Heavier — server needs to generate 2-3 variants.

**Designed but parked for Helm:** 2-breakpoint system (compact <600pt = 4 columns, regular ≥600pt = 8 columns). AI only specifies compact layout; regular auto-expands. Deferred due to added complexity.

### Approach 3 — Constraint-Based Layout

Components express constraints (min-width, max-width, aspect ratio). Layout engine resolves at render time. Extremely powerful but very hard to express in JSON. AI models are bad at reasoning about constraint systems. **Not suitable for SDUI.**

---

## 14. Current Codebase State (as read 2026-03-29)

### Repository

- GitHub: [https://github.com/BarryTheShen/Helm](https://github.com/BarryTheShen/Helm)
- Active branch: `fix/chat-streaming-tool-calls`

### Tech Stack

- **Frontend:** React Native (Expo) + TypeScript
- **Backend:** Python FastAPI + SQLAlchemy + SQLite
- **AI:** PydanticAI + OpenRouter
- **Protocol:** MCP over StreamableHTTP, JWT auth, WebSocket

### Key Files Read

- `mobile/src/types/sdui.ts` — 6 action types (navigate, api_call, dismiss, open_sheet, copy_text, open_url), 18 component types, SDUIScreen/SDUISection structure
- `backend/app/mcp/tools.py` — 16 tools (calendar CRUD, notifications, chat, SDUI screen management, tab visibility)
- `backend/app/routers/modules.py` — 7 hardcoded tabs, `POST /api/modules/{module_id}/action` is a stub returning `{"status": "ok"}`, SDUI endpoints functional
- `AI-TECHNICAL-REFERENCE.md` — Full codebase reference, 24 known bugs/gotchas listed, "SDUI actions never execute" listed as known gap

### Architecture Diagram

```
React Native App (SDUI renderer)
    ↕ WebSocket (AG-UI events) + REST API
Python FastAPI Backend (Auth, Calendar, Notifications, Chat, Workflows, Agent Proxy, MCP Server)
    ↕ MCP over HTTP (StreamableHTTP)
Standalone Helm Agent (PydanticAI)
```

---

## 15. Action Items (Implementation Order)

1. **Wire up client-side action handlers** — Replace `console.log` in every tab's `onAction` with actual dispatch (navigate → React Navigation, open_url → Linking, copy_text → Clipboard, dismiss → modal close, etc.)
2. **Build function registry** — New `backend/app/services/action_registry.py`. Dict mapping function names → handlers + allowed modules + param schemas. Wire into `POST /api/modules/{module_id}/action`.
3. **Replace `api_call` with `server_action`** in `sdui.ts` type definitions. Add `server_action` type: `{ type: 'server_action', function: string, params?: Record<string, any> }`.
4. **Implement starter functions** — `refresh_data`, `submit_form`, `send_to_agent` to test the plumbing end-to-end.
5. **Remove or lock `POST /auth/setup`** — Replace with CLI user creation (`python manage.py create_user`).
6. **Wire device ID into WebSocket manager** — `devices` table exists but WS manager doesn't distinguish between devices. Add device identification on WS connect.
7. **Design template bundling spec** — Define how a template package includes both SDUI layout JSON and its associated backend functions.
8. **Build draft/approval flow** — When AI creates/modifies a module, it enters "draft" state. User sees preview, can approve/reject/revert.