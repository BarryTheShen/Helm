# Architecture Decisions — Session 9 (2026-04-16)

<aside>
📋

**Session 9 — Web Admin Feedback & UX Overhaul**

Date: 2026-04-16 → 2026-04-17

Source transcript: [Session 9 — 2026-04-16 — Web Admin Feedback & UX Overhaul](https://www.notion.so/Session-9-2026-04-16-Web-Admin-Feedback-UX-Overhaul-43f7b380c4c541ea83ee5341f38b9640?pvs=21)

Scope: Complete critique of the existing web admin, followed by a full UX overhaul spec. Covers sidebar restructure, workflow engine, 5 fully functional templates (with visual mockups + wiring), visual editor rework, component system, variable pill system, new Connections page, Article Reader, and mobile login rewrite. **Backend changes lead; web admin and mobile follow in lockstep — each issue spans all three surfaces.**

</aside>

---

## Executive Summary

- **Dashboard** — deferred (Barry changed his mind mid-session; initially proposed redesign with live logs / workflow runs / OAuth status, then told Jarvis to drop it entirely). Revisit later.
- **Users → Settings** — renamed, moved to very bottom of sidebar. Multi-user auth scope dropped. Multi-device only.
- **Sessions + Audit Logs → Logs** — merged under a new collapsible **Advanced** sidebar group.
- **Components page — DELETED.** Random wiki content not belonging in admin.
- **Actions & Triggers — MERGED into Workflows.** No separate section. Automated triggers become workflow triggers. Buttons can trigger workflows.
- **Workflows** — embed **React Flow** with custom Helm nodes; native FastAPI + PydanticAI runtime; n8n JSON importer kept (Barry reversed course in Round 4 and chose to keep it).
- **Templates** — 5 polished, fully functional, API-wired references. Real compiled Preview button, plus a new "Preview whole app" button.
- **Visual Editor** — naming corrections, unlimited cells per row, percentage cell widths, cursor-follows drag, outside-row drag handle, cell swap UI, overflow containment, Rules tab fixed, variable pill UI with `@` picker.
- **Connections — NEW page.** API Key provider for V1; OAuth and presets deferred.
- **New components:** Todo, Rich Text Renderer, Article Card. **Calendar Component** gains variants.
- **Modals / bottom sheets REMOVED** (`open_sheet` and `dismiss` dropped). Everything becomes full-screen navigation.
- **Mobile login rewritten** — 3 fields only, endpoint always editable, no in-app signup.

### Mid-session reversals worth calling out

- **Dashboard redesign:** first proposed (Q1/Q2 in Round 1), then cancelled in Barry's Round 1 answer. Final state = no work, vanity metrics dropped.
- **n8n importer:** Round 3 proposal was to **skip for V1**; in Round 4 Barry reversed and said keep it. Final state = importer in V1.
- **User-side Calendar view switching:** Round 1 answer said user-toggleable. Round 4 locked it to admin-only variant, **but** Round 5 restored user-side date navigation (prev/next/today) while keeping variant locked. Final state = admin picks variant, user can pan dates.
- **Push notifications, Password change, Language** in Template 5: all started in scope, progressively trimmed. Final V1 = 4 settings only.
- **News API for Template 4:** Jarvis recommended [NewsData.io](http://NewsData.io) in Round 2, Barry chose **RSS-only** in Round 3.
- **OAuth/provider presets in Connections:** proposed in Round 6 Q47, Barry narrowed to API-Key-only for V1.

---

## Sidebar & Navigation Restructure

### Final sidebar order (top → bottom)

1. **Visual Editor**
2. **Templates**
3. **Workflows** (absorbs old Actions & Triggers)
4. **Variables**
5. **Connections** *(NEW)*
6. **Advanced** (collapsible group)
    - **Logs** (Sessions + Audit Logs merged)
7. **Settings** (renamed from Users, at very bottom)

### Per-section notes

- **Dashboard** — hidden/deferred; no landing-page work. The original vanity metrics (user count, event count, own name) are gone. Future redesign will focus on *changing* data: live log tail, recent workflow runs, OAuth online status.
- **Settings** — owns general prefs, password change (deferred for V1), endpoint URL field (mobile-only). CLI Python script remains the only way to create accounts for V1.
- **Advanced / Logs** — merged Sessions + Audit Logs into a single Logs screen. For advanced users only; not part of normal flows.
- **Components (wiki page)** — deleted. Any wiki content lives in future docs, not in admin.
- **Connections** — new entry between Variables and Advanced. See Connections section below.

---

## Workflows (absorbs Actions & Triggers)

### Editor stack — LOCKED

- **React Flow (xyflow)** (MIT, 35.9K★) for the visual canvas, with **custom Helm node types** bound to the action registry.
- Node inspector reuses the **same schema-driven form** the component inspector uses.
- **Runtime = native.** FastAPI + PydanticAI on the backend. **n8n never runs** anywhere in Helm.
- **n8n JSON importer KEPT.** Translator maps n8n JSON → Helm workflow JSON and warns on unsupported nodes. Convenience for users migrating existing flows.

### Capabilities (V1 scope)

- Trigger → single action (simplest path).
- Trigger → chain of actions (linear pipeline).
- **Branching**: if/else and switch/case.
- **Parallel execution**: run N branches at once, wait for all.
- **Loops / iterators**: for-each over arrays.
- **Time delays**: wait N minutes between steps.
- **Error-handling branches**: on failure → fallback path.
- Every node output emits a variable `step_<N>.output`, consumable downstream via the same mustache syntax the rest of Helm uses.

### Triggers folded in

- **Automated triggers = workflow triggers**: `onSchedule`, `onDataChange`, `onServerEvent` all become workflow trigger nodes.
- **Button → workflow**: a Button action of type `run_workflow` replaces bespoke trigger handlers.
- The "Custom Server Functions" wiki that used to live here is removed — server functions are just registered in the action registry and surface in the Button/Node inspector dropdowns.

### Rejected alternatives (and why)

- **Sequential Workflow Designer (MIT)** — too weak on branching.
- **JointJS** — generic diagramming, too low-level.
- **Workflow Builder (Synergy Codes)** — commercial/closed-source.
- **n8n editor** — not embeddable, it's a whole platform.

---

## Templates — 5 Fully Functional References

Every template must be **API-linked and functional**, not static mocks. Each template:

- Uses the new component hierarchy (Module → Row → Cell → Component → Atomic).
- Exercises the variable pill system, data binding, and the action registry end-to-end.
- Has a real compiled **Preview** button.
- Is one of the first 5 modules available in the new **Preview Whole App** button (which renders the mobile tab bar with Home / Chat / Modules / Calendar / Forms / Alerts and lets the user navigate).

### Template 1 — Personal Dashboard *(Home tab, pinned)*

```
╔══════════════════════════════════╗
║  Good morning, [User Name] 👋    ║  Row 1: Text atomic with @user.name variable pill
╠══════════════════════════════════╣
║ ☀️ 24°C  │  📅 3 events today   ║  Row 2: 2 cells at 50 / 50
║  Shanghai│  Next: 2pm meeting   ║    Cell 1 → Weather (Text + Image atomics, backend-bound)
║          │                      ║    Cell 2 → Calendar Component, variant = Compact
╠══════════════════════════════════╣
║  ✓ To-do                   [+]   ║  Row 3: Todo Component (backend-persisted)
║  ☐ Finish Physics 2 Ch 4         ║
║  ☐ Reply to Duke email           ║
╠══════════════════════════════════╣
║  📝 Quick Note                   ║  Row 4: Notes Component (most recent entry)
╠══════════════════════════════════╣
║ [+ New Task]    [+ New Note]     ║  Row 5: 2 Buttons (auto-split cells)
╚══════════════════════════════════╝
```

**Wiring:**

- Greeting pulls `@user.name` via variable pill.
- Weather cell = backend endpoint `GET /weather` hits **Open-Meteo** (no API key required) using user's timezone (Shanghai) → returns `{temp, condition, city}`. Rendered via Text + Image atomics bound to the returned fields. **No dedicated Weather Component.** This cell is the reference implementation for the whole variable + Connections + data binding stack.
- Calendar (Compact variant) shows count + next event, binds to existing calendar backend.
- Todo Component reads/writes the new `todos` table.
- Notes Component reads latest row from notes backend.
- `+ New Task` → `server_action todos.create`; `+ New Note` → `server_action notes.create`. Both use auto-loading spinners.

### Template 2 — Chat Interface *(Chat tab)*

```
╔══════════════════════════════════╗
║  💬 Chat                  [⚙️]  ║  Row 1: 2 cells
║                                  ║    Cell 1 (auto) → Text "Chat"
║                                  ║    Cell 2 (auto, right) → Button variant=Icon,
║                                  ║                           navigates to Settings
╠══════════════════════════════════╣
║   ┌─ You ──────────────┐         ║  Row 2: existing Chat Component
║   │ What's on my        │        ║
║   │ calendar today?     │        ║
║   └─────────────────────┘        ║
║               ┌─ Jarvis ────────┐║
║               │ You have 3      │║
║               │ events ...      │║
║               └─────────────────┘║
╠══════════════════════════════════╣
║ [Type a message...]      [Send]  ║  Row 3: InputBar + Send button
╚══════════════════════════════════╝
```

**Wiring:**

- Settings icon → Button, variant = Icon, `navigate.screen` dropdown = Settings module.
- Chat Component reads/writes `messages` backend.
- InputBar auto-registers variable `Chat input bar 1`. Send button grabs that variable and fires `server_action chat.send`.
- Rework goal: replace any hardcoded strings/sections with atomic Text/Markdown so the template uses Helm's own architecture end-to-end (no one-off hardcoded pieces).

### Template 3 — Daily Planner *(Modules tab, pinned)*

**Restructured per Barry's Round 2 feedback:** One row, one Empty Component with 3 vertical sub-cells. No fake checkboxes.

```
╔══════════════════════════════════╗
║  📋 Today — Thu Apr 17           ║  Row 1: Markdown header (center-aligned)
╠══════════════════════════════════╣
║  Row 2 (single cell, 100%):      ║  Row 2: Empty Component with 3 vertical sub-cells
║                                  ║
║   ┌─ sub-cell 1 ────────────┐    ║    sub-cell 1: Calendar Component, variant = Week
║   │ 🗓️ Week view            │    ║                (admin-locked, user cannot switch)
║   └─────────────────────────┘    ║
║   ┌─ sub-cell 2 ────────────┐    ║    sub-cell 2: Todo Component
║   │ ✓ To-do              [+]│    ║                (full CRUD, backend-persisted)
║   │ ☐ Finish Physics Ch 4   │    ║
║   │ ☐ Push Helm commit      │    ║
║   └─────────────────────────┘    ║
║   ┌─ sub-cell 3 ────────────┐    ║    sub-cell 3: Notes Component
║   │ 📝 Today's notes        │    ║                (filtered to today)
║   └─────────────────────────┘    ║
╚══════════════════════════════════╝
```

**Wiring:**

- Calendar sub-cell: Week variant, user-side variant switching disabled (admin-locked per final spec). Prev/next-week date nav remains available to the user.
- Todo Component: full CRUD, backend-persisted. Replaces the old fake checkbox rows entirely — the Toggle+Text rows proposed in V1 didn't have persistence and were cut.
- Notes sub-cell: filters to today's notes only.
- Structure is the canonical example of: Module → Row → Cell → (Empty) Component → sub-cells (strictly vertical).

### Template 4 — Media Feed *(Modules tab)*

Fully functional, RSS-backed, uses the new Rich Text Renderer + Article Card components.

```
╔══════════════════════════════════╗
║  📰 Feed                 [🔄]    ║  Row 1: 2 cells — Text + Button (Icon, refresh)
╠══════════════════════════════════╣
║  ┌────────────────────────────┐  ║  Row 2+: repeating Article Card Component per RSS item
║  │ [hero image 16:9]          │  ║
║  │ **Headline (rich text)**   │  ║    Image atomic (hero)
║  │ Source · 2h ago            │  ║    Rich Text Renderer (headline)
║  │                            │  ║    Text atomic (source · timestamp)
║  │ Lede paragraph with        │  ║    Rich Text Renderer (body markdown)
║  │ **bold**, *italic*,        │  ║    Button (Read more → opens Article Reader)
║  │ links, lists.              │  ║
║  │ [Read more →]              │  ║
║  └────────────────────────────┘  ║
╚══════════════════════════════════╝
```

**Wiring:**

- Backend: RSS poller pulls configured feeds on a schedule → pipes HTML through **Mozilla Readability.js** (same engine as Firefox Reader View) → converts to Markdown (`turndown` or similar) → stores `{title, source, published_at, image_url, summary_markdown, content_markdown, url}` in `articles` table.
- Article Card inspector: `source_feed_url` (or list), `max_items`, `show_image` toggle.
- Refresh button → `server_action feed.refresh`.
- Tap a card → **full-screen push navigation** to the Article Reader (see below). **No** modal / bottom sheet.
- **News API choice:** **RSS-only for V1.** [NewsData.io](http://NewsData.io) was evaluated (production-legal free tier, 96k+ sources) but Barry chose RSS for simplicity and aesthetic control. Add RSS as a back-end pipeline, not a third-party API.

### Template 5 — Settings / Profile

```
╔══════════════════════════════════╗
║  ⚙️ Settings                     ║  Row 1: Markdown header
╠══════════════════════════════════╣
║  👤 Profile                      ║  Row 2: section header (Markdown)
║  Display name      [Barry Shen]  ║  Row 3: Text + TextInput (→ settings.display_name)
║  Email        [x@example.com]    ║  Row 4: Text + TextInput (→ settings.email)
╠══════════════════════════════════╣
║  🌐 Connection                   ║  Row 5: section header
║  Endpoint URL  [https://…]       ║  Row 6: Text + TextInput (→ settings.endpoint_url)
║                                  ║         mobile-only; web admin runs on the endpoint
╠══════════════════════════════════╣
║  🎨 Appearance                   ║  Row 7: section header
║  Dark mode                  [━●] ║  Row 8: Text + Toggle (→ settings.dark_mode)
╠══════════════════════════════════╣
║        [Save changes]            ║  Row 9: Button → server_action settings.save
╚══════════════════════════════════╝
```

**V1 scope — 4 settings only:**

- Display name
- Email
- Endpoint URL (mobile-only field)
- Dark mode

**Deferred post-V1:**

- Password change (Python CLI script remains the only way).
- Language / i18n (English hardcoded).
- Push notifications (requires APNs/FCM backend).

**Backend:**

- `settings` table: `display_name`, `email`, `password_hash` (exists for auth, not user-editable in V1), `endpoint_url`, `dark_mode`.
- Endpoints: `GET /settings`, `PATCH /settings`.
- Save button fires `server_action settings.save` with automatic loading spinner.

### Preview capability

- **Per-template Preview button** renders the actual compiled module (not the old `[module name]: [info]` placeholder).
- **"Preview Whole App" button** in the editor opens a lite browser-based preview of the full compiled app. Shows the mobile tab bar with Home / Chat / Modules / Calendar / Forms / Alerts and lets the user navigate between modules.
- Preview is lightweight, browser-only; full device-frame rendering deferred.

---

## Visual Editor Overhaul

### Naming corrections (LOCKED hierarchy)

**Module → Row → Cell → Component → Atomic Components.**

- **Modules** = pages. (Not "modules" in the code sense.)
- **Components** = Calendar, Chat, Notes, InputBar, Todo, Article Card, Rich Text Renderer.
- **Atomic Components** = Text, Markdown, Button, Image, TextInput, Icon.
- Components can be **pre-built** (CalendarModule etc.) **OR empty containers** with atomic components stacked **strictly vertically** inside.
- **Every level has both preset/template versions AND empty versions** — empty rows, empty cells, empty components.
- Rename everything in the editor UI to match. Current labels are inconsistent.

### Rows

- **Unlimited cells per row.** Hard-block only when adding a cell would violate a cell's minimum width. Otherwise allow with warnings. No arbitrary "max 4" or "max 6" caps.
- **Cell width unit = percentage of row width (0–100).** `auto` = equal split of remaining space. Example: one cell at 50 + 2 auto cells → 50 / 25 / 25.
- Cells scale **vertically** with row height when the row is dragged taller.
- **Dynamic upper/lower limits** on padding, widths, etc. — computed from context, not hardcoded constants.
- **Fix padding-direction bug** — increasing "all padding" currently moves content downward only. Fix to push toward center uniformly.
- **Upper limit on padding** — cap at whatever leaves content visible. No infinite padding.
- **Fix drag lag.** Cursor-follows-row drag. Row must be picked up (not just a shadow while the row stays put).
- **Row drag handle moved OUTSIDE the row** (to the left, visible on hover). Eliminates the overlap that currently makes edge cells hard to click.
- **Per-row `show_bottom_divider` toggle** replaces the standalone Divider atomic (which is deleted).

### Cells

- **Cell swap UI needed** — drag-to-reorder cells within a row.
- **Prevent cells from extending outside row boundaries** when content grows (e.g. large Markdown). Current behavior blocks the bottom of the row and prevents further resizing.
- Same drag-lag fixes as rows: cursor-follows-cell when resizing cell widths.

### Rules tab

- Currently broken everywhere (empty tab, non-functional "Add Rule" button).
- Must be **functional on all components/atomics that support it**: Button, TextInput, InputBar.
- Per-component **visual Rule Builder** (Notion-style): trigger line → action steps → conditionals. Generates the underlying JSON action objects.

### Variable pill UI — LOCKED

Replaces raw `user.name` text insertion with **inline chip/pill tokens**. Applies to Text, Button label, InputBar default value, and any future bindable string field.

- Saved value under the hood stays as `Hello! user.name`. The editor displays `Hello! [👤 User Name]` where the bracketed piece is a blue pill.
- Pills are **non-editable atoms** — you can delete the whole pill or drag it, but not edit character-by-character.
- Everything between pills is normal editable text.
- **Implementation:** real rich-text library — **TipTap or Slate.js** (both have first-class inline atom node support, both already solve the hard parts).
- **Insertion trigger:** `@`-mention style picker. Type `@` → dropdown of variables grouped by scope → pick one → inserts pill. Matches Notion's behavior exactly.

### Variable type checks

- Enforce types at write-time: numbers are numbers, booleans are booleans, strings are strings. Editor validates before save.

---

## Component & Atomic Spec Changes

### InputBar

- Rename `value` → **`default value`**.
- **Remove action field** (the Send button handles the action).
- **Auto-registers a client-side variable** on mount.
- **Naming convention:** `"<ModuleName> input bar <N>"` (e.g. `"Home input bar 1"`, `"Chat input bar 1"`). That variable is what the Send button grabs and posts to the server.
- Rules tab must work.

### Button

- **Icon field** → searchable dropdown (dropdown + textbox combo — textbox for search, pick from list, falls back to raw value). LLM-facing MCP path keeps raw textbox input.
- **Icon field only shown when variant = Icon.** Label field hidden in that case.
- **Remove** `small/medium/large` size. Button fits its cell.
- **Remove** `full_width` toggle.
- **Remove** `disabled` toggle.
- **Loading is automatic.** Rename toggle to `loading_enabled` (or similar). When a Button fires a `server_action`, the renderer auto-shows a spinner and disables clicks until the server returns.
- **Actions — dropdowns, not free text:**
    - `navigate.screen` → dropdown of existing modules.
    - `server_action.function` → dropdown of registered server functions.
    - **Parameters** → add-parameter UI (pick param name, fill value in textbox). **No raw JSON** in the primary path.
- **No standalone tappable Icon atomic.** Use Button with Icon variant instead.

### Icon (atomic)

- Redesign: **dropdown icon picker + size + background color only**.
- No text label, no star, no Action section. (The current implementation showed the icon as plain text with a star next to it; this is removed.)

### Divider (atomic)

- **REMOVED entirely as a standalone atomic.**
- Replaced by the per-row `show_bottom_divider` toggle. Dividers are structural, not content.

### Text (atomic)

- Gains variable pill support via TipTap/Slate.js editor.
- Otherwise unchanged.

### Markdown (atomic)

- Add **center alignment** option.
- Add other lightweight formatting niceties where they fit.

### Calendar Component — Expanded

**Single Component with a `variant` dropdown in the inspector.** Variants:

- **Month** (current grid)
- **Week** (time slots)
- **Day** (time slots)
- **Event List** (no grid — upcoming events top-to-bottom)
- **Compact** (next-N events widget that fits in small cells)

**Configuration:**

- Filtered-view mode (show only certain event types) — admin-configured.
- Size fits its cell (no more massive-only month grid).

**User interaction (LOCKED after multiple reversals):**

- **User-side variant switching DISABLED.** Admin's `variant` pick is the only way to change view type. No Month/Week/Day toggle buttons on mobile.
- **Date navigation REMAINS** for the user. Header row inside the component: `◀ [Month Year] ▶  [Today]`. User can pan through time, just can't change the variant.
- Verify data binding works end-to-end against the canonical Calendar schema.

### Chat Component

- No changes in V1. Not a priority.

### Notes Component

- No changes in V1. Template 1 and Template 3 bind to it.

### Todo Component — NEW

First-class component, same tier as Calendar / Chat / Notes / InputBar.

**Visual spec:**

```
┌─────────────────────────────────┐
│  ✓ To-do                   [+]  │  header: title + add button
├─────────────────────────────────┤
│  ☐  Finish Physics 2 Ch 4       │  unchecked row
│  ☐  Push Helm commit            │
│  ☑  Reply to Duke email         │  checked row (strikethrough, dimmed)
└─────────────────────────────────┘
```

**Behavior:**

- Tap checkbox → toggles done/undone. **Persists to backend immediately** (optimistic update + spinner on failure).
- Tap `[+]` → inline new-row input appears, type + enter to save.
- Long-press row (mobile) / hover menu (web) → delete.
- Tap row text → edit inline.

**Inspector fields:**

- `title` (default "To-do")
- `show_completed` toggle (hide checked items)
- `max_items` (0 = unlimited)
- `empty_state_text`

**Backend:**

- New `todos` table: `id`, `user_id`, `text`, `done`, `created_at`, `updated_at`, `sort_order`.
- REST: `GET /todos`, `POST /todos`, `PATCH /todos/:id`, `DELETE /todos/:id`.

### Rich Text Renderer Component — NEW

**Read-only renderer** for rich content. Not an editor.

**Source:** Markdown or structured rich text (e.g. from the RSS/Readability.js pipeline).

**Supported elements:**

- Headings h1–h3
- Bold, italic, links
- Bulleted / numbered lists
- Inline images
- Blockquotes
- Inline code
- **Tables**
- **Code blocks**
- **Video embeds** — YouTube + Vimeo + generic URL. Web uses `<iframe>`; mobile uses `react-native-webview`. URL-pattern detection picks the right player.

**Out of scope for V1:**

- Editable rich text.

### Article Card Component — NEW

Used by Template 4.

**Composition:**

- Image atomic (hero, 16:9).
- Rich Text Renderer (headline).
- Text atomic (source · timestamp).
- Rich Text Renderer (body summary markdown).
- Button (Read more).

**Inspector:**

- `source_feed_url` (or list of feeds)
- `max_items`
- `show_image` toggle

**Interaction:**

- Tap card → navigates to **Article Reader** full-screen (push navigation, not a modal).

### Article Reader screen — NEW

Full-screen push navigation (no modal/sheet — consistent with the modals-removed rule).

**Contents:**

- Hero image
- Title
- Source + timestamp
- Full body rendered via the Rich Text Renderer (max width + larger type for comfortable reading)
- Close / back button

**Dropped for V1:**

- Open in browser
- Share
- Bookmark
- Font-size toggle

**Content pipeline:**

- Backend runs **Mozilla Readability.js** on the source article URL to extract a clean long-form `content_markdown`. Mobile reader just renders it through the Rich Text Renderer.
- No on-device reader library needed. Reference implementations to consult: `react-native-reader`, `react-native-readium` (for comparison, not wrapped in V1).

---

## Variable System (expanded)

- Variable pill editor (TipTap/Slate.js + `@` picker) is the canonical write surface across Text, Button label, InputBar default value, and any future bindable string field.
- **Type checks at write-time** (number / boolean / string).
- Variables come from the 6 Session-8 scopes — `user.*`, `component.<id>.value`, `self.value`, `data.<key>.<field>`, `env.*`, `custom.*` — **plus** a new namespace per Connection (see below): `connection.<name>.*`.
- **InputBar auto-registration:** every InputBar registers a variable under `"<Module> input bar <N>"` on mount. That's the one the Send button reads.

---

## Connections — NEW Page

Central place for external integrations. Replaces scattered per-component API-key fields.

**Per-connection fields:**

- `name`
- `provider`
- `status` (connected / disconnected)
- Exposes variable namespace `connection.<name>.*`

**V1 providers (scoped down):**

- **API Key** — stores a named secret, exposes it as `connection.<name>.api_key`.

**Deferred post-V1:**

- Generic OAuth2 provider
- Bearer token provider
- Provider presets (Google, GitHub, Notion, etc.)

**Flow:**

- Click **Add Connection** → pick provider → fill credentials → connection appears in the `@` variable picker as a namespaced group.

**Reference implementation:** the weather API in Template 1 is the first Connection. Exercises the full variable + Connection + data binding stack end-to-end.

---

## Actions Catalog — Deltas from Session 8

- **`open_sheet` and `dismiss` — REMOVED entirely.** Every modal-triggering UX becomes full-screen navigation with a built-in back button. No floating bottom sheets anywhere.
- **Button loading is automatic** when a `server_action` is fired — handled by the renderer, toggled only via `loading_enabled`.
- **Action parameters** are filled via the add-parameter UI in the Button inspector — no raw JSON in the primary path.
- Session 8's other 17 actions are unchanged (`navigate`, `go_back`, `open_url`, `server_action`, `submit_form`, `refresh_data`, `set_component_state`, `toggle`, `set_variable`, `show_notification`, `show_alert`, `copy_text`, `haptic`, `share`, `chain`, `conditional`, `delay`).
- New action type for Workflows integration: `run_workflow` (fires a named workflow, used by Button actions and other components).

---

## Mobile Login Rewrite

**Final spec:**

- **3 fields only:** Endpoint URL, Username, Password.
- **Account creation flow REMOVED from the app.** Python terminal script (`python manage.py create_user`) is the only way to provision a user.
- When the user taps "Already have an account" (or equivalent return path), they **MUST still be able to change the endpoint URL** — current bug blocks this. **Endpoint must always be editable on the login screen.**
- Mobile only. Web admin runs on the endpoint, so it doesn't need this.

---

## Module Pinning & Tab Bar

- **Bottom tab bar on mobile is customizable.**
- **Pinned modules** appear in the bottom tab bar.
- **Unpinned modules** live in a **Module Store** reachable from the Modules tab.
- Admin configures which modules are pinned and the order. Users see what admin set.
- Default tab bar shown in Preview Whole App: Home / Chat / Modules / Calendar / Forms / Alerts.

---

## Cross-Cutting Rules

- **Every change lands across backend + web admin + mobile** in the same issue. Nothing ships to only one surface.
- **Backend changes lead.** Web admin and mobile follow in lockstep.
- Each unit of work = one issue = one sub-agent, responsible end-to-end across all three surfaces.
- Rationale: backend stability (especially MCP) is the bottleneck for mobile UI polish, so land backend shape first.

---

## Deferred / Post-V1

- **Dashboard redesign** — no useful widget set identified yet.
- **Full multi-user auth system** — multi-device only for V1.
- **Connections**: OAuth2 / Bearer provider presets (Google, GitHub, Notion, etc.).
- **Push notifications** (requires APNs/FCM stack).
- **Password change UI** (Python script only).
- **Language switching / i18n scaffolding** (English hardcoded).
- **Article Reader extras**: font-size toggle, share, bookmark, open-in-browser.
- **Editable rich text** (Rich Text Renderer is read-only for V1).
- [**NewsData.io**](http://NewsData.io) as a default Template 4 source (RSS-only for now).
- **True responsive breakpoints** in admin preview (multi-resolution preview shipped, breakpoints later).
- **Chat & InputBar redesign** — not a priority.
- **Images atomic deep pass** — skipped for V1.

---

## Bug Inventory (tracked into issue list)

- Row drag lag; row pickup animation broken (shadow only, row doesn't follow cursor).
- Cell drag lag.
- Padding direction bug on rows (only pushes down).
- Cells overflow row boundaries when large content is added; blocks further row resize.
- Rules tab empty / Add Rule button non-functional on Button, TextInput, InputBar.
- Variable picker in Text / Button inserts raw `user.name` text instead of a pill; value ships to frontend literally.
- Mobile login: endpoint field inaccessible on return path ("Already have an account").
- Overlapping 6-dot row handle blocks clicking edge cells within the row.
- Preview button on templates shows only `[module name]: [information]` — needs real compiled render.
- Max cells per row arbitrarily capped at 4 (add-button) or 6 (inspector); inconsistent and too low.
- Cell width textbox accepts any number with no upper or lower bound — no minimum width enforcement, no sanity cap.
- Cells don't scale height when row is resized.
- Icons atomic displays icon as text with a star next to it; color applies to text instead of background.
- Button actions require filling `screen` / `function` / parameters as raw text/JSON — need dropdowns + add-parameter UI.
- Calendar Component too large; only month variant; can't fit in a 2-cell row.

---

## Implementation Kickoff Order

**1. Backend groundwork**

- Variables type system (number / boolean / string).
- InputBar auto-registered variables (naming convention: `<Module> input bar <N>`).
- Connections table + API-key provider.
- `settings` table (4 V1 fields).
- `todos` table + REST CRUD.
- `articles` table + RSS poller + Readability.js pipeline + HTML → Markdown conversion.
- Open-Meteo weather endpoint.
- Workflow runtime (FastAPI + PydanticAI) with branching, loops, delays, parallel, error branches.
- `run_workflow` action handler.

**2. Component work**

- Todo Component (both tiers: UI + backend).
- Rich Text Renderer (headings, bold, italic, links, lists, images, blockquotes, inline code, tables, code blocks, video embeds).
- Article Card Component.
- Article Reader screen.
- Calendar variant system (Month / Week / Day / Event List / Compact) + filtered-view mode + date-nav header + admin-locked variant.
- Empty Component with vertical sub-cells.
- Markdown atomic: center alignment + formatting niceties.
- Icon atomic redesign (dropdown + size + background color).
- Button inspector cleanup (variant logic, dropdowns, add-parameter UI, loading_enabled, remove size/full_width/disabled).
- InputBar rename + action field removal + auto-registration.
- Divider atomic removal + per-row `show_bottom_divider` toggle.

**3. Admin editor fixes**

- Variable pill editor (TipTap + `@` picker) across Text / Button / InputBar.
- Drag-lag fixes (rows + cells).
- Padding direction fix + dynamic padding limits.
- Cell overflow containment.
- Rules tab + Rule Builder (Notion-style visual builder).
- Row drag handle moved outside row, hover-only.
- Cell swap UI (drag-to-reorder).
- Per-template Preview button → real compiled render.
- "Preview Whole App" button (lite mobile-frame preview with tab bar).

**4. Admin structural**

- Sidebar reorg: Dashboard hidden, Settings to bottom, Advanced/Logs collapsible group, Connections page added, Components page deleted, Actions & Triggers merged into Workflows.

**5. Workflows**

- React Flow canvas with custom Helm node types.
- Node inspector (schema-driven form).
- n8n JSON importer (translator + unsupported-node warnings).
- Trigger types: onSchedule, onDataChange, onServerEvent, plus Button → `run_workflow`.

**6. Connections**

- Page scaffold.
- API Key provider.
- `@` picker integration (namespaced group).

**7. Mobile**

- Login rewrite (3 fields, always-editable endpoint, no signup).
- Customizable tab bar + Module Store.
- Disable user-side Calendar variant switching; keep date nav.
- Article Reader screen.

**8. Templates V3**

- Rebuild all 5 against the new component set, API-wired end-to-end.
- Seed the Preview Whole App with these 5 modules (Home, Chat, Daily Planner, Feed, Settings).

---

## Cross-References

- Full transcript + Q&A rounds (1–6): [Session 9 — 2026-04-16 — Web Admin Feedback & UX Overhaul](https://www.notion.so/Session-9-2026-04-16-Web-Admin-Feedback-UX-Overhaul-43f7b380c4c541ea83ee5341f38b9640?pvs=21)
- Project hub: [Agentic AI Super App — Project Hub](https://www.notion.so/Agentic-AI-Super-App-Project-Hub-4c3f4212e908429980b70f82034f68b2?pvs=21)
- Immediate predecessor: [Architecture Decisions — Session 8 (2026-04-13)](https://www.notion.so/Architecture-Decisions-Session-8-2026-04-13-c6ad7aff755a4dd182c6175c82b46727?pvs=21)
- Editor lineage: [Architecture Decisions — Session 6 (2026-04-05)](https://www.notion.so/Architecture-Decisions-Session-6-2026-04-05-53d165232a0b4414ad7f76a83c4d2e3b?pvs=21), [Architecture Decisions — Session 7 (2026-04-07)](https://www.notion.so/Architecture-Decisions-Session-7-2026-04-07-f950e72eb01349528819cff1de9e3c5b?pvs=21)