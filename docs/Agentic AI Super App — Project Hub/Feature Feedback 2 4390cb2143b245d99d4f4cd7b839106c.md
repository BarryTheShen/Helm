# Feature Feedback 2

<aside>
📋

**Session 9 — Web Admin Feedback & UX Overhaul (Distilled)**

Date: 2026-04-16 → 2026-04-17

Source transcript: [Session 9 — 2026-04-16 — Web Admin Feedback & UX Overhaul](https://www.notion.so/Session-9-2026-04-16-Web-Admin-Feedback-UX-Overhaul-43f7b380c4c541ea83ee5341f38b9640?pvs=21)

Scope: Complete critique of the existing web admin, followed by a full UX overhaul spec across 6 rounds of Q&A (51 questions total). Every item below has all round changes applied — this is the **final state**, not a changelog.

**Structure:** Organized by the sections Barry investigated in the original feedback, not by implementation phase. Each section describes **what needs to change and why**, with enough detail for a vibe-code agent to implement without ambiguity.

**Cross-cutting rule:** Every change spans **backend + web admin + mobile** in the same issue. Backend changes lead; web admin and mobile follow in lockstep. Each unit of work = one issue = one sub-agent, responsible end-to-end.

</aside>

---

## 1. Dashboard

- [x]  **DEFERRED — Do not touch.**

The current dashboard is useless — it shows static information the user already knows (username, user count, calendar event count). A good dashboard should show **changing, actionable data** like live logs, workflow run status, or connection health. Since no useful widget set has been identified yet, defer all dashboard work until later. Hide or deprioritize in sidebar.

- [x]  **Admin default landing page:** Land on **Visual Editor** instead of Dashboard when navigating to `/admin`.

---

## 2. Users → Settings

- [x]  **Rename** "Users" to **"Settings"**
- [x]  **Move to the very bottom** of the sidebar, below everything else including the Advanced group
- [ ]  **Contents for V1:** General preferences, display name, email, endpoint URL (mobile-only), dark mode toggle
    - [ ]  The server end point URL is not changeable in the app, and there is only agent (model), about (version), and accoutn username. Nothing else.
    - [ ]  Log out button doesn’t work at all.
- [x]  **Account creation:** CLI-only via `python manage.py create_user` — no in-app signup
- [x]  **Backend:** `settings` table (display_name, email, password_hash, endpoint_url, dark_mode) + `GET /settings` + `PATCH /settings`
- [ ]  **Admin ↔ Mobile sync:** Admin Settings page and mobile Template 5 read/write the same `settings` table
    - [ ]  I don’t think settings should have its own page now thinking about it. This should be all preset not changeable, or at most it can be changed but by adding more stuff to it.
- **DEFERRED post-V1:** Password change UI, language/i18n switching, push notification preferences.

---

## 3. Sessions + Audit Logs → Logs (under Advanced)

- [x]  **Merge** Sessions + Audit Logs into a single **"Logs"** screen
- [x]  Place under a **collapsible "Advanced"** group in the sidebar (above Settings, below Connections), collapsed by default
- [x]  **Logs screen content:** Single filterable table with:
    - Session logs: login/logout timestamps, device type, IP, duration
    - Audit logs: admin actions (timestamp, action, target, JSON diff)
    - Filter bar: log type, date range, action type

---

## 4. Components Page

- [x]  **DELETE** the Components wiki page entirely
- [x]  **DELETE** the "Custom Server Functions" wiki page under Actions & Triggers — server functions surface as **dropdowns** in inspectors, not wiki pages

---

## 5. Workflows (absorbs Actions & Triggers)

- [x]  **Merge** Actions & Triggers into **Workflows**

### Visual Editor

- [x]  Integrate **React Flow (xyflow)** for the visual workflow canvas
- [ ]  Use **custom Helm node types** bound to the action registry
    - [ ]  It’s there but there is no way to connect them up. Right now nodes just sit there, actions condition, switch loop all can be added but don’t exist. There should also be trigger inside of here.
- [x]  **Node inspector** reuses the same schema-driven form as the component property inspector
- [x]  Node outputs emit `step_<N>.output` via mustache syntax

### Runtime

- [x]  **Native runtime:** FastAPI + PydanticAI — **n8n never runs** anywhere in Helm
- [x]  **Helm's own workflow JSON schema** — NOT n8n's format
- [x]  **n8n JSON importer** — one-way translator with unsupported-node warnings
    - [ ]  All these have to be tested thou. The fow currently still don’t work at all.

### V1 Capabilities

- [ ]  Trigger → single action, trigger → chain (linear pipeline)
- [ ]  Branching (if/else, switch/case), parallel execution, loops/iterators
- [ ]  Time delays, error-handling branches
    - [ ]  All the above for V1 capabilities don’t work and it’s not tested.

### Storage

- [x]  `workflows` table + REST CRUD + `POST /workflows/:id/run`
- [ ]  V1: No versioning or undo history

### Trigger Types

- [ ]  Automated triggers become workflow trigger nodes: `onSchedule`, `onDataChange`, `onServerEvent`
    - [ ]  not added and I don’t see it.
- [x]  Button → `run_workflow` action fires a named workflow
    - [ ]  There is an exisitng execute workflow, but nothing happens.

---

## 6. Templates — 5 Fully Functional References

Every template must be **actually functional** — connected to real backend endpoints, using real data binding, exercising the variable pill system and action registry end-to-end. No static mockups. No placeholder text that doesn't resolve.

### Preview Capability

- [x]  **Per-template Preview button** renders the actual compiled module
- [ ]  **"Preview Whole App" button** — lite browser preview with mobile tab bar (Home / Chat / Modules / Calendar / Forms / Alerts)
    - [ ]  Not implemented

### Template 1 — Personal Dashboard *(Home tab, pinned)*

```
╔════════════════════════════════╗
║  Good morning, [User Name] 👋    ║  Row 1: Text w/ @user.name variable pill
╠════════════════════════════════╣
║ ☀️ 24°C  │  📅 3 events today    ║  Row 2: 2 cells (50/50 %)
║  Shanghai│  Next: 2pm meeting    ║    • Cell 1: Weather via Open-Meteo (Text + Image atomics, variable pills, no API key)
║          │                       ║    • Cell 2: Calendar Component, variant = Compact
╠════════════════════════════════╣
║  ✓ To-do                   [+]  ║  Row 3: Todo Component (backend-persisted)
║  ☐  Finish Physics 2 Ch 4       ║
║  ☐  Reply to Duke email         ║
╠════════════════════════════════╣
║  📝 Quick Note                    ║  Row 4: Notes Component (most recent entry)
╠════════════════════════════════╣
║ [+ New Task]    [+ New Note]    ║  Row 5: 2 Button atomics (auto-split cells)
╚════════════════════════════════╝
```

- [ ]  **Row 1:** Text atomic with `@user.name` variable pill → greeting (e.g., "Good morning, [User Name] 👋")
- [ ]  **Row 2 (2 cells, 50/50%):** Cell 1 = Weather via Open-Meteo (Text + Image atomics, variable pills, no API key). Cell 2 = Calendar Component `variant = Compact`
- [ ]  **Row 3:** Todo Component — reads/writes `todos` backend table, full CRUD
- [ ]  **Row 4:** Notes Component — most recent note from pre-existing `notes` table
- [ ]  **Row 5 (2 cells):** `+ New Task` + `+ New Note` buttons → `server_action` with auto-loading
    - [ ]  The template Home doesn’t work at all. I can’t understand anything there. It’s done in a very very random way.

### Template 2 — Chat Interface *(Chat tab)*

```
╔════════════════════════════════╗
║  💬 Chat                  [⚙️]  ║  Row 1: 2 cells
║                                  ║    • Cell 1 (auto): Text "Chat"
║                                  ║    • Cell 2 (auto, right): Button variant=Icon, nav to Settings
╠════════════════════════════════╣
║                                  ║  Row 2: Chat Component (existing)
║   [bubble stream]                ║
╠════════════════════════════════╣
║ [Type a message...]      [Send] ║  Row 3: InputBar (auto-registers "Chat input bar 1")
╚════════════════════════════════╝
```

- [ ]  **Row 1 (2 cells):** Text "Chat" + Button (Icon, `navigate.screen` → Settings)
- [ ]  **Row 2:** Chat Component (existing, pre-existing `messages` table)
- [ ]  **Row 3 (2 cells):** InputBar (auto-registers variable) + Send Button (Icon, `server_action`)
- [ ]  Replace hardcoded header strings with atomic Text/Markdown components
    - [ ]  Chat template looks bad. The specified size for the chat message is really bad, it’s half a page. Chat messages don’t work at all. It’s not showing anything when I send my message. Please fix this. i want to be able to connect this to a specific agent.

### Template 3 — Daily Planner *(Modules tab, pinned)*

```
╔════════════════════════════════╗
║  📋 Today — Thu Apr 17          ║  Row 1: Markdown header (centered)
╠════════════════════════════════╣
║  Row 2 (single cell, 100%):      ║  Row 2: Empty Component with 3 vertical sub-cells
║                                  ║
║   ┌─ sub-cell 1 ────────────┐  ║    sub-cell 1: Calendar Component, variant = Week
║   │ 🗓️ Week view             │  ║
║   └─────────────────────────┘  ║
║   ┌─ sub-cell 2 ────────────┐  ║    sub-cell 2: Todo Component
║   │ ✓ To-do              [+] │  ║
║   │ ☐ Finish Physics Ch 4    │  ║
║   │ ☐ Push Helm commit       │  ║
║   └─────────────────────────┘  ║
║   ┌─ sub-cell 3 ────────────┐  ║    sub-cell 3: Notes Component (today's notes)
║   │ 📝 Today's notes         │  ║
║   └─────────────────────────┘  ║
╚════════════════════════════════╝
```

- [ ]  **Row 1:** Markdown header, center-aligned — "📋 Today — [date]" with dynamic date
- [ ]  **Row 2 (single cell, 100%):** Empty Component with 3 vertical sub-cells:
    - Sub-cell 1: Calendar `variant = Week`, admin-locked, date nav remains
    - Sub-cell 2: Todo Component — full CRUD, backend-persisted
    - Sub-cell 3: Notes Component — filtered to today's date
- **Important:** ONE row, ONE Empty Component, 3 vertical sub-cells — follows Module → Row → Cell → Component → sub-cells hierarchy.
    - Daily Planner doesn’t work at all. Component is not implemented correctly: SDUI validation failed for module 'custom-daily-planner-b5153d': Unknown component type 'todo' in cell 'abc993d0-d17b-4c56-baba-a21f3ea6e7c4'. Valid types: Alert, Badge, Button, CalendarModule, ChatModule, Container, Divider, Icon, Image, InputBar, List, Markdown, NotesModule, Stat, Text, TextInput. Provide a valid row-first screen or use legacy sections for backward compatibility.

### Template 4 — Media Feed *(Modules tab)*

```
╔════════════════════════════════╗
║  📰 Feed                 [🔄]  ║  Row 1: 2 cells — Text + Button(Icon, refresh)
╠════════════════════════════════╣
║  ┌─────────────────────────────┐  ║  Row 2+: repeating Article Card Component per RSS item
║  │ [hero image 16:9]        │  ║
║  │ **Headline (rich text)** │  ║    • Image atomic (hero)
║  │ Source · 2h ago          │  ║    • Rich Text Renderer (headline)
║  │                          │  ║    • Text atomic (source · timestamp)
║  │ Lede paragraph with     │  ║    • Rich Text Renderer (body markdown)
║  │ **bold**, *italic*,     │  ║    • Button (Read more → full-screen push nav)
║  │ links, lists.           │  ║
║  │ [Read more →]           │  ║
║  └─────────────────────────────┘  ║
╚════════════════════════════════╝
```

- [ ]  **Row 1 (2 cells):** Text "Feed" + refresh Button (Icon, `server_action`)
- [ ]  **Row 2+:** Repeating Article Card Component per RSS item
- [ ]  **Backend pipeline:** RSS poller → Readability.js extraction → HTML→Markdown conversion → `articles` table (`title, source, published_at, image_url, summary_markdown, content_markdown, url`)
- [ ]  **Data flow:** Article Card shows `summary_markdown` (lede); Article Reader shows `content_markdown` (full body) — two different fields
- [ ]  **Tap behavior:** Entire card surface tappable → full-screen push navigation to Article Reader (not a modal)
    - [ ]  Feed template also doesn’t work:SDUI validation failed for module 'custom-daily-planner-b5153d': Unknown component type 'article_card' in cell '8c988774-e1d9-4c2c-b3aa-fe81aacbda52'. Valid types: Alert, Badge, Button, CalendarModule, ChatModule, Container, Divider, Icon, Image, InputBar, List, Markdown, NotesModule, Stat, Text, TextInput; Unknown component type 'rich_text_renderer' in cell '073dc6ea-fd0c-4ed9-969d-742114831b51'. Valid types: Alert, Badge, Button, CalendarModule, ChatModule, Container, Divider, Icon, Image, InputBar, List, Markdown, NotesModule, Stat, Text, TextInput. Provide a valid row-first screen or use legacy sections for backward compatibility.

### Template 5 — Settings / Profile

```
╔════════════════════════════════╗
║  ⚙️ Settings                      ║  Row 1: Markdown header
╠════════════════════════════════╣
║  👤 Profile                       ║  Row 2: section header (Markdown)
║  Display name      [Barry Shen]  ║  Row 3: Text + TextInput (bound to settings.display_name)
║  Email        [x@example.com]    ║  Row 4: Text + TextInput (bound to settings.email)
╠════════════════════════════════╣
║  🌐 Connection                    ║  Row 6: section header
║  Endpoint URL  [https://…]       ║  Row 7: Text + TextInput (bound to settings.endpoint_url)
╠════════════════════════════════╣
║  🎨 Appearance                    ║  Row 8: section header
║  Dark mode                  [━●] ║  Row 9: Text + Toggle (bound to settings.dark_mode)
╠════════════════════════════════╣
║        [Save changes]            ║  Row 11: Button (server_action settings.save)
╚════════════════════════════════╝
```

- [ ]  **Row 1:** Markdown header "⚙️ Settings"
- [ ]  **Rows 2–4 — Profile:** Display name + Email (Text + TextInput, bound to settings fields)
- [ ]  **Rows 5–6 — Connection:** Endpoint URL (mobile-only, Text + TextInput)
- [ ]  **Rows 7–8 — Appearance:** Dark mode (Text label + Toggle atomic, bound to `settings.dark_mode`)
- [ ]  **Row 9:** Save button → `server_action settings.save` with auto-loading
- [ ]  **Backend:** `settings` table (display_name, email, password_hash, endpoint_url, dark_mode) + REST endpoints
    - [ ]  Settings template renders but no buttons works. Previously when i talk about these. All these should have a functional backend but it doesn’t.
- **DEFERRED post-V1:** Password change UI, language/i18n dropdown, push notification toggle.

---

## 7. Visual Editor

This is the most complex section. The visual editor needs fixes across structure, drag behavior, component inspectors, and the variable system.

- [ ]  **Preview Whole App button in editor toolbar** — lite browser preview, all modules navigable via mobile tab bar
    - [ ]  Don’t exist.
- [ ]  **Module reordering** — drag-to-reorder in a module list panel
    - [ ]  Don’t exist
- [ ]  **Module pinning controls** — set pinned/unpinned directly from the editor
    - [ ]  Don’t exist, still all the old config

### 7a. Naming Corrections (LOCKED hierarchy)

- [ ]  **Lock naming hierarchy** everywhere in the editor UI: Module → Row → Cell → Component → Atomic Component
    - Component = Calendar, Chat, Notes, InputBar *(existing)* + Todo, Article Card, Rich Text Renderer *(new)*
    - Atomic = Text, Markdown, Button, Image, TextInput, Icon, Toggle *(Divider removed)*
    - [ ]  This is not fixed at all.
- [ ]  **Rename everything** — every dropdown, label, tooltip, placeholder must use these terms consistently
    - [ ]  Not done.
- [x]  **No suffix rule:** UI shows `Calendar`, `Todo`, etc. — not `CalendarComponent` or `CalendarModule`

### 7b. Preset + Empty System

- [ ]  **Preset versions** at every level: preset modules, preset rows, preset components
    - [ ]  I don’t see the button for rows and components. Modules is already there.
- [ ]  **Empty versions** at every level: empty modules, empty rows, empty cells, empty components
    - [ ]  Don’t exist. There are no empty components to edit. All of the others is already a thing.
- [ ]  **Empty Component** = container for vertical stacking of atomics or full components (strictly vertical, no horizontal layout within components)
    - [ ]  Don’t exist.

### 7c. Rows

- [ ]  **Unlimited cells per row** — remove 4-cell and 6-cell limits, enforce minimum width only
    - [ ]  Still fixed to 4 when creating and 6 when trying to resize again in the config.
- [ ]  **"Add Row" creates 1 empty cell** — admin adds more via row inspector "+ Add Cell"
    - [ ]  I am confused by this. Check the previous brainstorm session.
- [ ]  **Scrollable mode exception** — `scrollable = true` relaxes min-width enforcement for horizontal scroll strips
    - [ ]  Min width is not implemented.
- [ ]  **Cell width = percentage** (0–100), `auto` = equal split of remaining space, dynamic limits
    - [ ]  Don’t exist
- [ ]  **Vertical scaling** — cells scale with row height when dragged taller
    - [ ]  Don’t work.
- [ ]  **Padding fix** — push content toward center from all 4 sides (not downward only), dynamic caps
    - [ ]  It’s better than before not completely fixed. There should be a limit base on min width or something.
- [x]  **Drag behavior fix** — cursor-follows-row, no lag for rows or cell resizing
- [ ]  **Drag handle outside row** — left side, hover-only, no overlap with edge cells
    - [ ]  it’s outside of the row right now, but it is messing up the layout. Like the drag handle should be outside of the screen, right now it’s taking up part of the screen. It needs to be outside of the row and outside of the screen or it will be messing up the layout.
- [ ]  **Per-row `show_bottom_divider` toggle** — replaces standalone Divider atomic
    - [ ]  Not implemented

### 7d. Cells

- [ ]  **Cell drag-to-reorder** — grip icon at top-center of each cell, hover-only, drag horizontally
    - [ ]  Dont’ work
- [ ]  **Overflow containment** — cells must stay within row boundaries (scroll or auto-expand row, never overflow)
    - [ ]  Don’t work.
- [ ]  **Cell drag lag fix** — resize handles follow cursor smoothly
    - [ ]  Still exist.

### 7e. Rules Tab

- [ ]  **Fix Rules tab** — currently broken (empty except non-functional "Add Rule" button)
    - [ ]  Don’t work
- [ ]  Make fully functional on **Button, TextInput, InputBar**
    - [ ]  Don’t work
- [ ]  **Visual Rule Builder** (Notion-style): trigger line → action steps → conditionals — generates JSON under the hood, user never sees raw JSON
    - [ ]  Don’t work

### 7f. Variable Pill UI

- [ ]  **Replace raw variable text** with inline pill/chip tokens (rounded boxes showing friendly name, e.g., `[👤 User Name]`)
    - [ ]  I can do @ to insert variables but when I click something nothing shows up. I also doubt if variables has pill UI.
- [ ]  **Pills are non-editable atoms** — delete whole pill on backspace, no character editing
    - [ ]  Pills don’t show up.
- [ ]  **Applies to:** Text, Markdown, Button label, InputBar default value
    - [ ]  Pills don’t show up. Not tested.
- [ ]  **Implementation:** TipTap or Slate.js for inline non-editable atom nodes
    - [ ]  Not there.
- [ ]  **`@`-mention picker** — type `@` → dropdown grouped by scope → pick → pill inserted
    - [ ]  Exist, but don’t work
- [ ]  **Type checks at write-time** — numbers/booleans/strings enforced, editor validates before save
    - [ ]  Variables don’t even show up, can’t test.

---

## 8. Component & Atomic Spec Changes

Changes to existing components and atomics, plus new components to build.

### 8a. Text (atomic)

- [ ]  Add variable pill support via TipTap/Slate.js editor (section 7f)
    - [ ]  Exist but don’t show up.

### 8a½. TextInput (atomic)

- [ ]  **Rules tab must work** on TextInput (section 7e) — same as Button and InputBar
- No changes to core behavior for V1. Distinct from InputBar (stateless atomic for forms vs. component with auto-variable-registration).

### 8b. Markdown (atomic)

- [ ]  Add **center alignment** option
- [ ]  Add **variable pill support** via TipTap/Slate.js (section 7f)

### 8c. Button (atomic) — Major Inspector Overhaul

- [ ]  **Variant behavior:** Default = Label + optional Icon; Icon = Icon only (hide Label)
- [ ]  **Icon field:** Searchable dropdown (type to search, select from list)
- [ ]  **Remove:** `size` (small/medium/large), `full_width`, `disabled` toggles
- [ ]  **Loading = automatic** on `server_action` / `run_workflow` — spinner + disable until response
- [ ]  **Action fields as dropdowns:** `navigate.screen` = module dropdown, `server_action.function` = server function dropdown, `run_workflow.workflow` = workflow dropdown
- [ ]  **Add-parameter UI** — pick param name from dropdown + value textbox, no raw JSON
- [ ]  **Conditional field visibility** — only show fields relevant to selected action type
- [ ]  **Tappable icons:** Use Button variant=Icon only, no standalone tappable Icon atomic

### 8d. Image (atomic)

- **Skipped for V1.** No changes.

### 8e. InputBar (component)

- [ ]  **Rename** `value` → `default value`
- [ ]  **Remove the action field** — Send button handles actions, not InputBar
- [ ]  **Auto-register client-side variable** on mount (`"<ModuleName> input bar <N>"`)
- [ ]  **Rules tab must work** on InputBar (section 7e)
- [ ]  **Send button pairing:** Separate Button atomic in same row reads InputBar's variable

### 8f. Icon (atomic) — Redesign

- [ ]  **Redesign:** Searchable dropdown picker + size selector + background color only
- [ ]  **Remove:** Text label, star, Action section — icons are display-only (use Button variant=Icon for interactive)

### 8g. Divider (atomic) — REMOVED

- [ ]  **Remove Divider** as standalone atomic entirely
- [ ]  **Replace with** per-row `show_bottom_divider` toggle (section 7c)

### 8h. Calendar Component — Expanded with Variants

- [ ]  **`variant` dropdown** in inspector: Month, Week, Day, Event List, Compact
- [ ]  **Admin-configured filtered-view mode** — configure which event types/categories to show
- [ ]  **Fits its cell** — Compact variant fixes the "too large for 2-cell row" problem
- [ ]  **User-side variant switching: DISABLED** — admin picks, user sees that variant only
- [ ]  **Date navigation REMAINS** — `◀ [Month Year] ▶ [Today]` header built INTO the component

### 8i. Chat Component

- **No changes in V1.**

### 8j. Notes Component

- **No changes in V1.**

### 8k. Todo Component — NEW

- [ ]  **Build as first-class component** (same tier as Calendar / Chat / Notes / InputBar)
- [ ]  **Visual:** Header with title + `[+]` button, list of checkbox + text rows
- [ ]  **Behavior:** Tap checkbox = toggle done/undone (optimistic update), `[+]` = inline new-row, long-press = delete, tap text = edit inline
- [ ]  **Inspector fields:** `title`, `show_completed`, `max_items`, `empty_state_text`

### 8l. Rich Text Renderer Component — NEW

- [ ]  **Build read-only Markdown renderer** (NOT an editor — editable rich text deferred)
- [ ]  **Supported elements:** Headings h1–h3, bold, italic, links, bulleted/numbered lists, inline images, blockquotes, inline code, tables, code blocks, video embeds (YouTube/Vimeo/generic iframe)

### 8m. Article Card Component — NEW

- [ ]  **Build composite component:** Image (hero 16:9) + Rich Text Renderer (headline) + Text (source·timestamp) + Rich Text Renderer (body summary) + Button ("Read more →")
- [ ]  **Inspector fields:** `source_feed_url`, `max_items`, `show_image` toggle
- [ ]  **Tap behavior:** Entire card → full-screen push navigation to Article Reader

### 8n. Article Reader Screen — NEW

- [ ]  **Full-screen push navigation** (not a modal — modals removed)
- [ ]  **Layout:** Hero image, title, source+timestamp, full body via Rich Text Renderer, close/back button
- [ ]  **Backend:** Readability.js (or `readability-lxml`) extracts `content_markdown` during RSS pipeline
- **DEFERRED post-V1:** Font-size toggle, share button, bookmark/save, open-in-browser.

---

## 9. Variable System

The variable system is still early-stage. These changes make it production-ready.

- [ ]  **Variable pill editor** (TipTap/Slate.js + `@` picker) as canonical write surface for variable-supported fields (section 7f)
    - [ ]  Don’t work
- [ ]  **Type checks at write-time** — numbers/booleans/strings enforced, editor validates before save
    - [ ]  Not tested because it’s not working
- [x]  **Support all 6 Session-8 scopes:**
    - `user.*` — current user properties
    - `component.<id>.value` — read value from another component
    - `self.value` — current component's own value
    - `data.<key>.<field>` — backend data sources
    - `env.*` — environment/device variables
    - `custom.*` — user-defined via `set_variable` action
- [ ]  **New scope:** `connection.<name>.*` — variables from configured connections (section 11)
    - [ ]  Not sure if it worked. Need testing.
- [ ]  **InputBar auto-registration** — each InputBar registers `"<Module> input bar <N>"` on mount
    - [ ]  I don’t know how to test, this needs to be tested out.

---

## 10. Actions Catalog — Changes from Session 8

- [ ]  **Remove `open_sheet`** — all modals/bottom sheets → full-screen push navigation
    - [ ]  Still exist need remove
- [ ]  **Remove `dismiss`** — counterpart to `open_sheet`, no longer needed
    - [ ]  Still exist need remove
- [ ]  **Button loading = automatic** on any `server_action` (spinner + disable until response)
    - [ ]  Needs implementation, the entire thing needs to be added and all tested.
- [ ]  **Add-parameter UI** in Button inspector — no raw JSON
    - [ ]  Don’t exsit
- [ ]  **New action: `run_workflow`** — fires a named workflow from Workflows system
    - [ ]  Don’t exist
- All other 17 actions from Session 8 remain as-is.

**Complete V1 action catalog (18 total):**

| Category | Actions | Notes |
| --- | --- | --- |
| **Navigation (3)** | `navigate`, `go_back`, `open_url` | `open_sheet` and `dismiss` removed — everything is full-screen nav |
| **Data (3)** | `server_action`, `submit_form`, `refresh_data` | `server_action.function` uses dropdown of registered functions |
| **State (3)** | `set_component_state`, `toggle`, `set_variable` | Unchanged from Session 8 |
| **Feedback (4)** | `show_notification`, `show_alert`, `copy_text`, `haptic` | Unchanged from Session 8 |
| **Utility (1)** | `share` | Native share sheet |
| **Flow Control (3)** | `chain`, `conditional`, `delay` | Unchanged from Session 8 |
| **Workflow (1)** *(NEW)* | `run_workflow` | Fires a named workflow from Workflows system |

---

## 11. Connections — NEW Admin Page

- [x]  **Add "Connections" page** to admin sidebar (position 5, between Variables and Advanced)
- [ ]  **Per-connection fields:** `name`, `provider` (API Key for V1), `status` (connected/disconnected)
- [ ]  **Variable namespace:** `connection.<name>.*` appears in `@` variable picker as separate group
- [ ]  **V1: API Key provider only** — store named secret, expose as `connection.<name>.api_key`
- [ ]  **Flow:** Add Connection → pick "API Key" → enter name + paste key → Save → appears in variable picker
- [ ]  **Backend:** `connections` table + REST CRUD (secrets masked in GET responses)
- **DEFERRED post-V1:** OAuth2 provider, Bearer token provider, per-service presets (Google, GitHub, Notion, etc.).

---

## 12. Mobile Login Rewrite

- [x]  **Rip out current login flow** and rebuild
- [x]  **3 fields only:** Endpoint URL, Username, Password
- [x]  **Endpoint URL must ALWAYS be editable** — first login, return path, every visit. Never lock it.
- [x]  **Remove account creation flow entirely** from mobile — accounts via CLI only (`python manage.py create_user`)

---

## 13. Module Pinning & Tab Bar

- [ ]  **Pinned modules** in bottom tab bar (visible at all times)
- [ ]  **Unpinned modules** in Module Store (accessible from Modules tab, flat list/grid)
- [ ]  **Admin configures** pinning + order in the tab bar
- [ ]  **Tab bar:** Home / Chat / Modules / Calendar / Forms / Alerts (customizable by admin)
- [ ]  **Module Store UI:** List/grid of unpinned modules, tap → full-screen push navigation
- Mobile user cannot change pinning — admin-controlled.

---

## 14. Sidebar & Navigation — Final Order

- [ ]  **Restructure sidebar** to this exact order:
    1. Visual Editor
    2. Templates
    3. Workflows (absorbs Actions & Triggers)
    4. Variables
    5. Connections *(NEW)*
    6. Advanced *(collapsible, collapsed by default)* → Logs
    7. Settings *(renamed from Users)* — very bottom
- [ ]  **Remove from sidebar:** Dashboard (hidden), Components page (deleted), Custom Server Functions wiki (deleted)
- [ ]  **Admin default landing:** `/admin` loads Visual Editor, NOT Dashboard

---

## Bug Inventory

All known bugs from the current admin, collected from the original feedback. Each must be fixed as part of the relevant section's implementation.

- [ ]  **Row drag lag:** Shadow appears but row doesn't follow cursor. Row must be picked up and follow cursor smoothly.
- [ ]  **Cell drag/resize lag:** Cell resize handles lag behind cursor significantly.
- [ ]  **Padding direction bug:** Increasing "all padding" on rows pushes content downward only instead of toward center from all sides.
- [ ]  **Cell overflow:** Cells extend outside row boundaries when large content (e.g., big Markdown) is added, blocking further row resize.
- [ ]  **Rules tab broken:** Empty except for non-functional "Add Rule" button on Button, TextInput, and InputBar.
- [ ]  **Variable picker broken:** Selecting a variable in Text/Button inserts raw `user.name` text instead of a pill. Frontend ships the raw text without substitution.
- [ ]  **Mobile login — endpoint inaccessible:** Endpoint URL field can't be changed on the "Already have an account" return path.
- [ ]  **Row handle overlaps cells:** The 6-dot drag handle is inside the row, blocking clicks on edge cells. Must be moved outside.
- [ ]  **Preview button broken:** Template preview shows only placeholder text (`[module name]: [info]`) instead of actual compiled render.
- [ ]  **Custom Server Functions wiki page still exists:** Should be deleted alongside Components page (section 4). Server functions surface as dropdowns in inspectors, not as wiki content.
- [ ]  **Max cells per row capped:** Arbitrarily capped at 4 (Add Row button) and 6 (row inspector). Should be unlimited with minimum-width enforcement only.
- [ ]  **Cell width input has no bounds:** Textbox accepts any number with no validation or limits. Should enforce 0–100 range for percentage, and respect dynamic min/max based on other cells in the row.
- [ ]  **Cells don't scale height:** Cells stay the same height when row is resized taller. Should scale vertically.
- [ ]  **Icon atomic broken:** Displays icon as text with a star. Color applies to text instead of background. Has unnecessary Action section.
- [ ]  **Button actions require raw text/JSON:** Screen name, function name, and parameters are all free-text/JSON fields instead of dropdowns.
- [ ]  **Calendar too large:** Only has month variant. Can't fit in a 2-cell row. No compact/list variants.
- [ ]  **Cannot reorder modules in editor:** No drag-to-reorder for modules in the Visual Editor. Also no way to set module pinning from the editor.

---

## Deferred / Post-V1

Items explicitly deferred during Session 9. Track here so they aren't forgotten.

- [ ]  Dashboard redesign — no useful widget set identified yet
- [ ]  Full multi-user auth system — multi-device only for V1
- [ ]  Connections: OAuth2 / Bearer provider presets (Google, GitHub, Notion, etc.)
- [ ]  Push notifications (requires APNs/FCM stack)
- [ ]  Password change UI in Settings (Python CLI script only for V1)
- [ ]  Language switching / i18n scaffolding (English hardcoded for V1)
- [ ]  Article Reader extras: font-size toggle, share button, bookmark/save, open-in-browser
- [ ]  Editable rich text (Rich Text Renderer is read-only for V1)
- [ ]  [NewsData.io](http://NewsData.io) as additional/default Template 4 source (RSS-only for V1)
- [ ]  True responsive breakpoints in admin preview
- [ ]  Chat & InputBar design overhaul — not priority
- [ ]  Images atomic deep pass — skipped for V1
- [ ]  Generic list/repeater SDUI primitive
- [ ]  Workflow versioning / undo history
- [ ]  Module Store search + categories
- [ ]  Multi-device support (same user across multiple devices sharing one endpoint)
- [ ]  Admin default landing page: session memory (remember last-used page instead of always landing on Visual Editor)

---

## Implementation Kickoff Order

Proposed sequencing. Backend groundwork first because everything else depends on it.

**1. Backend groundwork:**

- [ ]  Database migrations via Alembic
- [ ]  Variables type system (number / boolean / string enforcement)
- [ ]  InputBar auto-registered variables (`<Module> input bar <N>`)
- [ ]  Connections table + API-key provider + variable namespace
- [ ]  `settings` table + `GET /settings` + `PATCH /settings`
- [ ]  `todos` table + REST CRUD
- [ ]  `articles` table + RSS poller + Readability.js pipeline + HTML→Markdown
- [ ]  `workflows` table + REST CRUD + `POST /workflows/:id/run`
- [ ]  Open-Meteo weather endpoint (`GET /weather`)
- [ ]  Workflow runtime (FastAPI + PydanticAI) with branching, loops, delays, parallel, error branches
- [ ]  `run_workflow` action handler
- [ ]  Remove `open_sheet` and `dismiss` from action catalog

**2. Component work:**

- [ ]  Todo Component (UI + backend, web + mobile)
- [ ]  Rich Text Renderer (h1–h3, bold, italic, links, lists, images, blockquotes, code, tables, video embeds)
- [ ]  Article Card Component (composite)
- [ ]  Article Reader screen (full-screen push nav)
- [ ]  Calendar variant system (5 variants + filtered-view + date-nav + admin-locked)
- [ ]  Empty Component with vertical sub-cells
- [ ]  Markdown atomic: center alignment + formatting
- [ ]  Icon atomic redesign
- [ ]  Button inspector cleanup
- [ ]  InputBar: rename value → default value, remove action, auto-registration
- [ ]  Toggle atomic
- [ ]  Divider removal + per-row `show_bottom_divider`

**3. Admin editor fixes:**

- [ ]  Variable pill editor (TipTap/Slate.js + `@` picker)
- [ ]  Drag-lag fixes (rows + cells)
- [ ]  Padding direction fix + dynamic limits
- [ ]  Cell overflow containment
- [ ]  Rules tab + visual Rule Builder
- [ ]  Row drag handle moved outside row
- [ ]  Cell swap UI (drag-to-reorder)
- [ ]  Unlimited cells per row
- [ ]  Cell width as percentage with validation
- [ ]  Vertical cell scaling with row height

**4. Admin structural:**

- [ ]  Sidebar reorg (Dashboard hidden, Settings bottom, Advanced/Logs, Connections added, Components + Server Functions deleted, A&T → Workflows)
- [ ]  Default admin landing = Visual Editor
- [ ]  Module reordering + pinning controls in editor

**5. Workflows:**

- [ ]  React Flow canvas with custom Helm node types
- [ ]  Node inspector (schema-driven form)
- [ ]  Workflow runtime integration with visual canvas
- [ ]  n8n JSON importer
- [ ]  Trigger types as workflow nodes
- [ ]  Button → `run_workflow` action type

**6. Connections page:**

- [ ]  Page scaffold in admin sidebar
- [ ]  API Key provider
- [ ]  Integration with `@` variable picker

**7. Mobile:**

- [ ]  Login rewrite (3 fields, always-editable endpoint, no signup)
- [ ]  Customizable tab bar + Module Store
- [ ]  Disable user-side Calendar variant switching
- [ ]  Article Reader screen (full-screen push nav)

**8. Templates V3:**

- [ ]  Rebuild all 5 templates against new component set, API-wired end-to-end
- [ ]  Per-template real compiled Preview button
- [ ]  "Preview Whole App" button with mobile tab bar navigation
- [ ]  Seed with 5 modules: Home, Chat, Daily Planner, Feed, Settings

---

## Terminology Quick Reference

For vibe-code agents and contributors — canonical terms used throughout this document:

| Term | Means | Example |
| --- | --- | --- |
| **Module** | A screen/page in the mobile app | Home, Chat, Daily Planner, Feed, Settings |
| **Row** | A horizontal band within a module | A row containing 2 cells with weather + calendar |
| **Cell** | A slot within a row that holds one component or atomic | A 50%-width cell containing a Calendar Component |
| **Component** | Complex, self-contained unit with own state + data | Calendar, Chat, Notes, InputBar, Todo, Article Card, Rich Text Renderer |
| **Atomic Component** | Simple, stateless, configurable via props | Text, Markdown, Button, Image, TextInput, Icon, Toggle |
| **Empty Component** | A blank container that holds atomic components stacked vertically | An empty component with 2 Buttons stacked inside |
| **Variable pill** | An inline non-editable chip showing a variable's friendly name | [👤 User Name] rendered as a blue pill in a Text field |
| **Connection** | An external integration that exposes variables | An API key stored under `connection.myapi.api_key` |
| **Workflow** | A trigger + chain of actions with branching/looping | onSchedule → fetch RSS → store articles → show notification |
| **Action Registry** | Backend catalog of all available actions + server functions | `todos.create`, `chat.send`, `settings.save` — surfaced as dropdowns in Button/Workflow inspectors |
| **Toggle** | Boolean on/off switch atomic | Dark mode toggle in Settings (Template 5) |

---

## Cross-Cutting Implementation Rules

These rules apply to **every** issue/task created from this document:

- **Every change lands across backend + web admin + mobile** in the same issue — do not ship a half-change that only touches one surface.
- **Backend changes lead.** Web admin and mobile follow in lockstep. Never ship a frontend change without the backend being ready.
- Each unit of work = **one issue = one sub-agent**, responsible end-to-end across all three surfaces.

---

## Cross-References

- Full transcript + Q&A rounds (1–6): [Session 9 — 2026-04-16 — Web Admin Feedback & UX Overhaul](https://www.notion.so/Session-9-2026-04-16-Web-Admin-Feedback-UX-Overhaul-43f7b380c4c541ea83ee5341f38b9640?pvs=21)
- Architecture Decision 9 (AI-compiled, less detailed): [Architecture Decisions — Session 9 (2026-04-16)](https://www.notion.so/Architecture-Decisions-Session-9-2026-04-16-6eb969f1a5ac48f8aef14ce9557eea33?pvs=21)
- Project hub: [Agentic AI Super App — Project Hub](https://www.notion.so/Agentic-AI-Super-App-Project-Hub-4c3f4212e908429980b70f82034f68b2?pvs=21)
- Immediate predecessor: [Architecture Decisions — Session 8 (2026-04-13)](https://www.notion.so/Architecture-Decisions-Session-8-2026-04-13-c6ad7aff755a4dd182c6175c82b46727?pvs=21)
- Editor lineage: [Architecture Decisions — Session 6 (2026-04-05)](https://www.notion.so/Architecture-Decisions-Session-6-2026-04-05-53d165232a0b4414ad7f76a83c4d2e3b?pvs=21), [Architecture Decisions — Session 7 (2026-04-07)](https://www.notion.so/Architecture-Decisions-Session-7-2026-04-07-f950e72eb01349528819cff1de9e3c5b?pvs=21)