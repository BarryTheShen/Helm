# Architecture Decisions — Session 8 (2026-04-13)

<aside>
📋

**Session 8 — Data-Driven Components, Actions & Editor Layout Controls**

This page is the complete architecture spec from Session 8. It covers: variable system, data source binding, action catalog (19 actions), trigger system, per-component rule builder, admin panel design, and editor layout improvements. **All 22 decisions are locked.** The vibe code agent should use this page + the GitHub codebase to implement.

---

**Scope:** 4 parallel implementation phases — (1) Variable System + Component State, (2) Data Source Binding, (3) Enhanced Actions + Rule Builder, (4) Editor Layout Improvements.

**Depends on:** Existing codebase (28 commits, 113 tests, 15 routers, 14 SQLAlchemy models, 22 MCP tools, V2 SDUI renderer, 4-tier component library, custom 3-panel editor).

**Related sessions:** [Architecture Decisions — Session 2 (2026-03-29)](https://www.notion.so/Architecture-Decisions-Session-2-2026-03-29-8c271ee63ff84db797d10a11214bfd47?pvs=21), [Architecture Decisions — Sessions 3 & 4 (2026-03-30)](https://www.notion.so/Architecture-Decisions-Sessions-3-4-2026-03-30-b7b02fb706ff451593c8c1e2bf390f27?pvs=21), [Architecture Decisions — Session 5 (2026-04-02)](https://www.notion.so/Architecture-Decisions-Session-5-2026-04-02-eddc9982c6e14390a64c19b73f2f79e6?pvs=21), [Architecture Decisions — Session 6 (2026-04-05)](https://www.notion.so/Architecture-Decisions-Session-6-2026-04-05-53d165232a0b4414ad7f76a83c4d2e3b?pvs=21), [Architecture Decisions — Session 7 (2026-04-07)](https://www.notion.so/Architecture-Decisions-Session-7-2026-04-07-f950e72eb01349528819cff1de9e3c5b?pvs=21)

**Source brainstorm:** [Session 8 — 2026-04-13 — Data-Driven Components, Actions & Editor Layout Controls](https://www.notion.so/Session-8-2026-04-13-Data-Driven-Components-Actions-Editor-Layout-Controls-b6099860cc144f57855afd8171c4c993?pvs=21)

</aside>

---

## Locked Decisions (22)

| # | Decision | Status |
| --- | --- | --- |
| 1 | Variable syntax: **mustache `expression`** with simple/advanced toggle in editor | ✅ Locked |
| 2 | Data model: **Universal Internal Schema** — internal system is the canonical layer (already coded). External connectors just need adapters to translate into internal format. | ✅ Locked |
| 3 | Action system: **Visual rule builder UI** (Notion-style rules) over raw JSON. Engine supports `chain`, `conditional`, etc. underneath. **Per-component** scope (click component → configure its rules). | ✅ Locked |
| 4 | Editor layout controls: **Approach A (automatic context switching)** — already semi-implemented. Work is improving existing controls (row boundaries, cell divider handles, resize, etc.), not building a new mode system. | ✅ Locked |
| 5 | Priority order: **(a) Variable system first** → unblocks data binding and actions. | ✅ Locked |
| 6 | **Custom variables:** Users can define their own variables in admin panel. Namespace prefixes (`custom.*`, `user.*`, etc.) are internal categories shown as dropdown groups in the editor — users never type or see the raw syntax. | ✅ Locked |
| 7 | **Admin panel sections:** Variables, Data Sources, and Actions & Triggers (combined). Central hub for all config, future OAuth, custom server functions, and automated triggers. | ✅ Locked |
| 8 | **Rule builder scope:** Only interactive components get a Rules tab (Button, TextInput, InputBar). Display-only components don't. | ✅ Locked |
| 9 | **Data source schema priority:** Calendar (exists) → Notes → Chat. | ✅ Locked |
| 10 | **All phases in parallel:** Work on all phases simultaneously, no strict sequencing. | ✅ Locked |
| 11 | **Notes canonical schema:** Rich text (markdown) content, not plain text. | ✅ Locked |
| 12 | **Custom variable types:** Simple types only for now (text, number, boolean). Lists/objects later. | ✅ Locked |
| 13 | **Action catalog:** 19 actions across 6 categories (Navigation, Data, State, Feedback, Utility, Flow Control). Complete list confirmed. | ✅ Locked |
| 14 | **`show_notification` and `show_alert` ARE actions.** What triggers them (button, server, timer) is a separate trigger concern, not an action concern. | ✅ Locked |
| 15 | **Admin panel: "Actions & Triggers" combined section.** Custom server functions + automated triggers in one place. Simpler than separate tabs. | ✅ Locked |
| 16 | **Modules handle own CRUD internally.** No separate create/update/delete_record actions. NotesModule has built-in create/edit/delete, CalendarModule has built-in event management. `server_action` is the escape hatch. | ✅ Locked |
| 17 | **`send_to_agent` removed.** Redundant with `submit_form` / `server_action`. | ✅ Locked |
| 18 | **Component triggers V1:** Only `onPress`/`onSubmit`  • `onPullToRefresh`. onChange deferred (performance concerns). onSwipe and onLongPress deferred. | ✅ Locked |
| 19 | **onPullToRefresh: automatic** for all data-bound modules. No configuration needed — any module with a data binding gets pull-to-refresh for free. | ✅ Locked |
| 20 | **Data fetch default: immediate on appear.** Data-bound modules fetch data as soon as they show up on screen, not waiting for the 30s SDUI polling cycle. 30s is background refresh only. | ✅ Locked |
| 21 | **Automated trigger conditions:** Yes, with filters. Simple for V1 (no filter = trigger on all changes). More granular filters later. | ✅ Locked |
| 22 | **onScreenLoad = built-in cache-first behavior.** Not a configurable trigger. Data-bound modules show cached data instantly on screen open, then fetch fresh data in background. Same philosophy as onPullToRefresh — automatic, no admin config. | ✅ Locked |

---

## Current Codebase State (as of Apr 12, 2026)

| Area | What exists | Key files / details |
| --- | --- | --- |
| Backend | 15 routers, 14 SQLAlchemy models, 22 MCP tools | `action_registry.py` has 7 action handlers: navigate, server_action, open_url, go_back, dismiss, copy_text, toggle. SDUI polling refreshes every 30s. |
| Mobile | V2 SDUI renderer, 4-tier component library | `useActionDispatcher.ts` dispatches actions client-side. Components: Atomic (7), Composite (4), Structural (5). |
| Web Admin | Custom 3-panel editor | Structure tree (left), Canvas preview (center), Property inspector (right). Context-sensitive — click component → shows its properties. |
| Tests | 113 tests across 15 test files | 28 total commits |

---

## Component Reference

| Tier | Components | Interactive? | Data-bound? | Registers state? |
| --- | --- | --- | --- | --- |
| **Atomic (7)** | Text, Button, Image, Toggle, TextInput, Spacer, Divider | Button, TextInput, Toggle | No | TextInput (V1) |
| **Composite (4)** | CalendarModule, ChatModule, NotesModule, InputBar | InputBar | CalendarModule, ChatModule, NotesModule | InputBar (V1) |
| **Structural (5)** | Row, Column, Card, ScrollView, SafeAreaView | No | No | No |

**Key distinctions:**

- **Interactive components** (Button, TextInput, InputBar, Toggle) → get a **Rules tab** in the editor for configuring actions
- **Data-bound components** (CalendarModule, ChatModule, NotesModule) → get **automatic pull-to-refresh**, **cache-first loading**, and **30s background polling** for free
- **State-registering components** (TextInput, InputBar for V1) → their current value is available to other components via `component.<id>.value`
- Modules handle their own **CRUD internally** (NotesModule has built-in create/edit/delete, CalendarModule manages events). No separate CRUD actions needed. `server_action` is the escape hatch.

---

## 1. Variable System

### Syntax

**Mustache `expression`** — industry standard (same as Retool, Appsmith, Handlebars).

### Variable Scopes

| Scope | Example | What it provides |
| --- | --- | --- |
| `user.*` | `user.name`, `user.id` | Current logged-in user info |
| `component.<id>.value` | `component.search-box.value` | Another component's current state (from Zustand store) |
| `self.value` | `self.value` | Shorthand for this component's own value |
| `data.<key>.<field>` | `data.calendar.title` | Value from a bound data source |
| `env.*` | `env.serverUrl` | Environment / system settings |
| `custom.*` | `custom.appName` | User-defined variables from admin panel |

### Resolution

- Simple dot-path lookup for V1 (no math, no string manipulation)
- Client-side only — resolved in the Zustand store, no server round-trip
- Future-proof: same `{{}}` syntax works when upgrading to full expression evaluation later. Agent just upgrades the resolver function, nothing else changes.

### Error Handling

Missing variable → empty string (no crash). Editor shows yellow warning: "This variable references a component that doesn't exist."

### Component State Registry

- Zustand store on mobile client
- Components register their state on mount: `{ "search-box": { value: "hello" }, "toggle-1": { value: true } }`
- Action dispatcher resolves `component.<id>.value` at dispatch time
- V1: only TextInput and InputBar register state (they're the only components whose value other components need to read)

### Editor UX

- **Simple mode (default):** Click "insert variable" → dropdown grouped by category (👤 User, 🔧 Custom, 📦 Components, 📊 Data, ⚙️ Environment) → click to insert. User never sees `{{}}` syntax. Like Notion's @ mention.
- **Advanced mode:** Raw expression text field for power users and vibe code agent. Toggle switch to flip between modes.

### Custom Variables

- Defined in admin panel "Variables" section
- Backend: `custom_variables` table — columns: id, user_id, name, value, type (text/number/boolean), description, created_at
- CRUD endpoints for management
- Available to every screen via `custom.*` namespace
- Types: text, number, boolean only for V1. Lists/objects later.

### SDUI JSON Examples

```json
// Dynamic greeting using user variable
{
  "type": "Text",
  "id": "greeting",
  "props": {
    "content": "Welcome, user.name!",
    "variant": "heading"
  }
}

// Button that sends TextInput's value to the server
{
  "type": "Button",
  "id": "submit-btn",
  "props": {
    "label": "Send",
    "onPress": {
      "type": "server_action",
      "function": "submit_feedback",
      "params": {
        "message": "component.feedback-input.value",
        "user_id": "user.id"
      }
    }
  }
}

// TextInput with self-reference on submit
{
  "type": "TextInput",
  "id": "search-box",
  "props": {
    "placeholder": "Search events...",
    "onSubmit": {
      "type": "server_action",
      "function": "search_events",
      "params": { "query": "self.value" }
    }
  }
}
```

---

## 2. Data Source Binding

### Core Pattern

**Universal Internal Schema.** The internal system is the canonical data layer (already coded). External connectors (Google Calendar, Outlook, etc.) just need adapters that translate their format into the internal format. Components only ever bind to the internal schema.

```
External Source → Adapter → Internal Unified Schema → Component Binding
```

### Canonical Schemas

| Data Type | Module | Schema Fields | Priority |
| --- | --- | --- | --- |
| Calendar Events | CalendarModule | title, start (datetime), end (datetime), location, description | 1st (exists) |
| Notes | NotesModule | title, content (**rich text / markdown**), created_date, updated_date, tags (list of strings) | 2nd |
| Chat Messages | ChatModule | sender, text, timestamp, conversation_id | 3rd |

### Backend: `data_sources` Table

```sql
id          UUID PK
user_id     UUID FK → users.id
name        string NOT NULL
type        enum ("calendar", "notes", "chat", "custom")
connector   string NOT NULL ("internal", "google_calendar", "caldav", etc.)
config_json JSON (connection params, adapter config)
schema_json JSON (available fields + types)
created_at  datetime
```

### Endpoints

- `GET /api/data-sources` — list connected sources
- `POST /api/data-sources` — connect new source
- `GET /api/data-sources/{id}/schema` — get field schema
- `GET /api/data-sources/{id}/query` — query with filter/sort/limit

### SDUI JSON `dataBinding` Field

```json
{
  "type": "CalendarModule",
  "id": "cal-1",
  "props": { "defaultView": "month" },
  "dataBinding": {
    "dataSourceId": "user_config.primary_calendar",
    "fieldMapping": {
      "title": "event_name",
      "start": "start_datetime",
      "end": "end_datetime",
      "location": "venue"
    },
    "query": {
      "filter": { "start": { "gte": "today" } },
      "sort": { "field": "start", "direction": "asc" },
      "limit": 50
    }
  }
}
```

### Data Flow — Cache-First Pattern (built-in, not configurable)

Step 1. Screen opens → **show cached data instantly** (from local storage, last fetch). No blank screen, no spinner on repeat visits.

Step 2. In background → **fetch fresh data** from data source.

Step 3. Fresh data arrives → **update UI seamlessly**.

Step 4. Every 30s → **background refresh** (existing SDUI polling behavior).

Step 5. User pulls down → **immediate re-fetch** (pull-to-refresh).

First-time visit (no cache): show loading state, then render when data arrives.

### Editor UI for Data Binding

- Data Source dropdown (filtered to compatible types — CalendarModule only shows calendar sources)
- Field Mapping: side-by-side view with dropdowns (left = what component needs, right = what data source has)
- Query: optional filters and sort options

---

## 3. Action Catalog (19 actions, 6 categories)

### 📍 Navigation (5)

| # | Action | What it does | Key params | Status |
| --- | --- | --- | --- | --- |
| 1 | `navigate` | Go to another screen | screen, transition (push / replace / modal) | ✅ Exists |
| 2 | `go_back` | Go to previous screen | none | ✅ Exists |
| 3 | `open_url` | Open link in browser | url (supports variables) | ✅ Exists |
| 4 | `open_sheet` | Open bottom sheet / modal with a screen inside | screen, height (half / full / auto) | ⚠️ Designed, may not be implemented |
| 5 | `dismiss` | Close current sheet / modal | none | ✅ Exists |

### 📊 Data (3)

| # | Action | What it does | Key params | Status |
| --- | --- | --- | --- | --- |
| 6 | `server_action` | Call a custom backend function | function name, params (supports variables) | ✅ Exists |
| 7 | `submit_form` | Collect values from multiple components, send together | function name, fields (map of param names → component IDs) | 🆕 New |
| 8 | `refresh_data` | Re-fetch data from a bound data source | target component ID or "all" | 🆕 New |

### 🔧 State (3)

| # | Action | What it does | Key params | Status |
| --- | --- | --- | --- | --- |
| 9 | `set_component_state` | Change another component's value | target component ID, new value (supports variables) | 🆕 New |
| 10 | `toggle` | Toggle a boolean state | target component ID | ✅ Exists |
| 11 | `set_variable` | Change a custom variable at runtime | variable name, new value (supports variables) | 🆕 New |

### 💬 Feedback (4)

| # | Action | What it does | Key params | Status |
| --- | --- | --- | --- | --- |
| 12 | `show_notification` | Show a toast / banner message | message (supports variables), type (success / error / info / warning) | 🆕 New |
| 13 | `show_alert` | Show a dialog popup with buttons | title, message, buttons (array of label + action pairs) | 🆕 New |
| 14 | `copy_text` | Copy text to clipboard | text (supports variables) | ✅ Exists |
| 15 | `haptic` | Vibration feedback | type (light / medium / heavy) | 🆕 New |

### 📋 Utility (1)

| # | Action | What it does | Key params | Status |
| --- | --- | --- | --- | --- |
| 16 | `share` | Open native share sheet | text, url (supports variables) | 🆕 New |

### ⚙️ Flow Control (3)

| # | Action | What it does | Key params | Status |
| --- | --- | --- | --- | --- |
| 17 | `chain` | Execute multiple actions in sequence | actions (array of action objects) | 🆕 New |
| 18 | `conditional` | Only execute action if condition is true | condition (expression), then (action), else (action, optional) | 🆕 New |
| 19 | `delay` | Wait before next action in a chain | milliseconds | 🆕 New |

### What's NOT in this catalog (by design)

- `~~send_to_agent~~` → removed, redundant with `submit_form` / `server_action`
- `~~create_record` / `update_record` / `delete_record`~~ → modules handle own CRUD internally
- `~~scroll_to~~` → deferred, nice-to-have for V2

### Chained Action Example (SDUI JSON)

```json
{
  "type": "chain",
  "actions": [
    {
      "type": "submit_form",
      "function": "submit_feedback",
      "fields": {
        "message": "feedback-input",
        "email": "email-input"
      }
    },
    {
      "type": "set_component_state",
      "targetId": "feedback-input",
      "state": { "value": "" }
    },
    {
      "type": "show_notification",
      "message": "Thanks for your feedback!",
      "notificationType": "success"
    },
    {
      "type": "navigate",
      "screen": "home",
      "transition": "push"
    }
  ]
}
```

---

## 4. Trigger System

### Built-in Behaviors (automatic, no admin config, not editable)

These are NOT triggers — they're just how data-bound modules work by default.

| Behavior | What happens | Applies to |
| --- | --- | --- |
| **Cache-first on screen load** | Show cached data instantly on screen open, fetch fresh data in background, update UI when fresh data arrives | All data-bound modules (CalendarModule, NotesModule, ChatModule) |
| **Pull-to-refresh** | User pulls down → immediate re-fetch from data source | All data-bound modules |
| **Background polling** | Re-fetch data every 30s while screen is open | All data-bound modules (existing SDUI behavior) |
| **Immediate fetch on appear** | Data-bound module fetches data immediately when it first appears — does NOT wait for the 30s polling cycle | All data-bound modules |

### Configurable Component Triggers (per-component rule builder in editor)

These fire actions when the user interacts with a component. Configured in the component's Rules tab.

| Trigger | What fires it | Which components | V1? |
| --- | --- | --- | --- |
| `onPress` | User taps the component | Button, (Image in future) | ✅ Yes |
| `onSubmit` | User hits Enter / Send | TextInput, InputBar | ✅ Yes |
| `~~onChange~~` | Value changes on every keystroke | TextInput | ❌ Deferred (performance/lag concern) |
| `~~onSwipe~~` | Swipe left/right on list item | List items | ❌ Deferred (needs UX design) |
| `~~onLongPress~~` | Hold down on component | Any | ❌ Deferred (nice-to-have) |

### Configurable Automated Triggers (admin panel)

These fire actions in the background without user interaction. Configured in the admin panel "Actions & Triggers" section.

| Trigger | What fires it | Example use case |
| --- | --- | --- |
| `onSchedule` | Time-based (hourly, daily at 9am, custom interval) | Sync data from external source, send daily summary |
| `onDataChange` | A record in a data source is created, updated, or deleted | New calendar event → push notification to user |
| `onServerEvent` | Backend pushes an event (webhook, server-side logic) | New chat message → show notification |

**Automated trigger conditions:** All support optional filters/conditions. Simple for V1 (no filter = trigger fires on all changes). More granular filtering later.

**Automated trigger → action flow:**

Step 1. Trigger fires (e.g., `onSchedule` at 9am)

Step 2. Check conditions/filters (if any)

Step 3. Execute configured action(s) from the 19-action catalog

---

## 5. Rule Builder (Per-Component, Visual)

### Where it lives

In the editor's property inspector (right panel). When you click an interactive component (Button, TextInput, InputBar), a **Rules tab** appears alongside the existing Properties tab.

### UI Design (Notion-style visual builder)

- **Trigger line:** "When [button is pressed]" (dropdown, auto-set based on component type)
- **Action steps:** Visual cards stacked vertically, drag to reorder
    - Step 1: ➡️ [Action type dropdown] → [Config fields]
    - Step 2: ➡️ [Action type dropdown] → [Config fields]
    - [+ Add Step] button at bottom
- **Conditional cards:** Insertable above any action step — "If [expression] is [condition]" → then run this step
- **Under the hood:** Generates the JSON action objects (`chain`, `conditional`, etc.). User never sees or edits JSON.

### Which Components Get a Rules Tab

- ✅ Button → `onPress` trigger
- ✅ TextInput → `onSubmit` trigger
- ✅ InputBar → `onSubmit` trigger
- ❌ Text, Image, Spacer, Divider, Toggle → no Rules tab (display-only or simple toggle)
- ❌ CalendarModule, NotesModule, ChatModule → no Rules tab (handle their own behavior internally)

---

## 6. Admin Panel (Web — 3 Sections)

### Section 1 — Variables

- Table listing all custom variables: **name**, **value**, **type** (text / number / boolean), **description**
- [+ Add Variable] button, inline edit and delete
- Read-only reference section showing built-in variable categories (user, component, data, env, self) so admins understand what's available without needing to define them

### Section 2 — Data Sources

- List of connected data sources with status (connected / disconnected)
- Each shows: **name**, **type** (calendar / notes / chat), **connector** (internal / Google / CalDAV), **last sync** timestamp
- [+ Connect Data Source] button
- Future: OAuth flows live here ("Connect Google Calendar" starts OAuth, creates data source with adapter auto-configured)

### Section 3 — Actions & Triggers (Combined)

**Custom Actions area:**

- Register server functions that show up in the `server_action` and `submit_form` dropdowns in the rule builder
- Each entry: **name**, **endpoint**, **parameter schema** (list of param name + type), **description**
- [+ Register Function] button

**Automated Triggers area:**

- List of configured automated triggers with **enable/disable toggle**
- Each entry: **trigger type** (onSchedule / onDataChange / onServerEvent) → **conditions/filters** (optional) → **action(s)** to execute
- [+ Add Trigger] button
- Config flow: Pick trigger type → Set schedule or conditions → Pick action(s) from the 19-action catalog → Set action params

---

## 7. Editor Layout Improvements

### Current State

3-panel editor with automatic context switching (Approach A — already semi-implemented). Click a component → right panel shows component properties. The missing piece is **layout-level controls** when clicking outside a component.

### What Needs to Be Added

- **Row boundaries:** Dotted lines or light shaded bands between rows so users can see the grid structure
- **Cell divider drag handles:** Hover between two cells in a row → drag handle appears → resize cell widths
- **Row height drag handles:** Hover below a row → drag handle → resize row height
- **Row header strip (left edge):** Grip handle for drag-to-reorder rows + gear icon for row settings
- **Empty cell [+] indicators:** Click to add a component into an empty cell
- **Row/cell property panel:** When clicking a row area (not a component), the right panel shows layout settings — cell count, width ratios, height, padding, horizontal scroll toggle

### Context Switching Behavior

- Click a **component** → right panel = component Properties tab + Rules tab (if interactive)
- Click **empty space / row area** → right panel = layout settings (cell widths, row height, padding)
- Click a **row header** → right panel = row-level settings (cell count, reorder, delete)

---

## 8. What's Explicitly NOT in V1 (Deferred)

- `onChange` trigger (performance concerns with firing on every keystroke)
- `onSwipe` and `onLongPress` triggers (need UX design work)
- Complex custom variable types (lists, objects) — text/number/boolean only
- Image as interactive component (no onPress for images)
- `scroll_to` action
- Expression evaluation beyond simple dot-path lookup (math, string manipulation)
- Server-side variable resolution (client-only for V1)
- OAuth connector flows (admin panel Data Sources section is ready for it, but OAuth itself is future)

---

## Implementation Plan — 4 Phases (All Parallel)

### Phase 1 — Variable System + Component State (Priority A)

Step 1. Define mustache expression resolver (parse `expression` in any string prop, resolve against scopes: `user.*`, `component.<id>.value`, `data.*`, `self.value`, `env.*`, `custom.*`)

Step 2. Implement Component State Registry (Zustand store on mobile client, components register state on mount)

Step 3. Add `self.value` shorthand for component's own state

Step 4. Wire expression resolver into action dispatcher (resolve variables at dispatch time)

Step 5. Add `onSubmit` action to TextInput component

Step 6. Editor: Simple mode variable picker UI + Advanced mode raw expression toggle

Step 7. Backend: Variable validation endpoint (check expressions reference valid component IDs)

Step 8. Add `custom.*` variable scope for user-defined variables

Step 9. Backend: `custom_variables` table + CRUD endpoints

Step 10. Admin panel: "Variables & Data Sources" page — Variables tab

### Phase 2 — Data Source Binding

Step 1. Define canonical internal schemas: Calendar events → Notes → Chat

Step 2. Build adapter interface for external connectors (Google Calendar → internal format)

Step 3. Add `dataBinding` field to SDUI JSON schema

Step 4. Implement `data_sources` table + 4 API endpoints

Step 5. Editor: Data source picker + field mapping UI in component properties panel

Step 6. Admin panel: "Variables & Data Sources" page — Data Sources tab

Step 7. Wire NotesModule to data binding (after CalendarModule)

Step 8. Wire ChatModule to data binding (after NotesModule)

### Phase 3 — Enhanced Actions + Rule Builder

Step 1. Implement all 19 action types across 6 categories (see Action Catalog section above)

Step 2. Build per-component visual rule builder UI in editor (Notion-style)

Step 3. Action validation (check referenced component IDs, data sources exist)

Step 4. Admin panel: "Actions & Triggers" section — register custom server functions + define automated triggers

### Phase 4 — Editor Layout Improvements

Step 1. Improve row boundary visibility (dotted borders, background bands)

Step 2. Add cell divider drag handles + row height drag handles

Step 3. Add row header with grip handle (reorder) and gear icon (settings)

Step 4. Empty cell [+] indicators

Step 5. Row/cell property panel improvements (width ratios, padding, cell count)

### Dependency Map

| Phase | What | Depends on | Complexity |
| --- | --- | --- | --- |
| 1 | Variables + Component State | Nothing | Medium |
| 2 | Data Source Binding | Phase 1 | High |
| 3 | Actions + Rule Builder | Phase 1 | High |
| 4 | Editor Layout | Nothing (independent) | Low-Medium |

**Note:** Phase 4 can run in parallel with Phase 1 since they're independent. Phase 2 and Phase 3 both depend on Phase 1 (variable system) but can run in parallel with each other once Phase 1 is done.