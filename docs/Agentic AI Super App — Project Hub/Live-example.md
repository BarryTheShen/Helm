
## 🧪 Copilot Test Example: "Build me a personal productivity app"

**User prompt to AI:** *"I want a personal productivity app with three screens: a home dashboard, a planner, and a workspace. Dashboard shows my day overview with calendar, quick actions, and stats. Planner is for full calendar and event management. Workspace is notes and AI chat side by side."*

**Navigation:** Bottom tab bar with 3 tabs — 🏠 Home, 📅 Planner, ✏️ Workspace. Switching tabs loads different SDUI page JSON.

---

## Module 1: Home Dashboard

### Row 1 — Header Bar (3 cells, non-scrollable)

| Cell | Width | Component | Props |
| --- | --- | --- | --- |
| Cell 1 | 12% | **Image** (avatar) | `src`: user profile URL, `width`: 40, `height`: 40, `borderRadius`: 999, `resizeMode`: "cover", `placeholder`: "skeleton" |
| Cell 2 | 73% | Two **Text** components stacked in a **Container** (Column direction) | Top: `Text` — `variant`: "heading", `content`: "Good evening, Barry", `numberOfLines`: 1. Bottom: `Text` — `variant`: "caption", `content`: "Mon, Mar 30 · 3 upcoming events", `color`: "textSecondary" |
| Cell 3 | 15% | **Button** (icon variant) | `variant`: "icon", `icon`: "settings", `size`: "sm", `onPress`: `{ type: "navigate", target: "settings" }` |

**Tests:** Image avatar pattern (borderRadius 999 + fixed dimensions), Text heading + caption variants, Button icon variant, navigate action, Container as layout wrapper, multi-cell row with percentage widths summing to 100%.

---

### Row 2 — Calendar Snapshot (1 cell, full-width)

| Cell | Width | Component | Props |
| --- | --- | --- | --- |
| Cell 1 | 100% | **CalendarModule** | `defaultView`: "month" (phone shows month grid top + day agenda on tap; tablet shows inline event pills) |

**Tests:** Composite module (CalendarModule) in single-cell row, module-level props.

---

### Row 3 — Quick Actions (scrollable horizontal, 5 cards)

**Row props:** `scrollable`: true, `snap`: "cell", `cellWidth`: 140, `uniform`: true, `gap`: 12

Each cell contains a **Container** styled as a card (`backgroundColor`: "surfaceElevated", `borderRadius`: 12, `shadow`: "md", `padding`: 16) with 3 components stacked vertically inside:

| Card | Icon (top) | Text (middle) | Button (bottom) |
| --- | --- | --- | --- |
| Card 1 | **Icon** — `name`: "file-text", `size`: 28, `color`: "primary" | **Text** — `variant`: "body", `content`: "New Note" | **Button** — `variant`: "ghost", `size`: "sm", `label`: "Create", `onPress`: `{ type: "server_action", name: "create_note" }` |
| Card 2 | **Icon** — `name`: "calendar", `size`: 28, `color`: "primary" | **Text** — `variant`: "body", `content`: "Add Event" | **Button** — `variant`: "ghost", `size`: "sm", `label`: "Schedule", `onPress`: `{ type: "navigate", target: "planner" }` |
| Card 3 | **Icon** — `name`: "check", `size`: 28, `color`: "primary" | **Text** — `variant`: "body", `content`: "Quick Task" | **Button** — `variant`: "ghost", `size`: "sm", `label`: "Add", `onPress`: `{ type: "server_action", name: "create_task" }` |
| Card 4 | **Icon** — `name`: "message-circle", `size`: 28, `color`: "primary" | **Text** — `variant`: "body", `content`: "Ask AI" | **Button** — `variant`: "ghost", `size`: "sm", `label`: "Chat", `onPress`: `{ type: "navigate", target: "workspace" }` |
| Card 5 | **Icon** — `name`: "share", `size`: 28, `color`: "primary" | **Text** — `variant`: "body", `content`: "Share Day" | **Button** — `variant`: "ghost", `size`: "sm", `label`: "Export", `onPress`: `{ type: "server_action", name: "export_summary" }` |

**Tests:** Scrollable row with snap: "cell", cellWidth, uniform. Container-as-card pattern (replacing removed Card component). Icon atomic component with color theme tokens. Button ghost variant + sm size. server_action + navigate actions from the same row. 5 cells in a scrollable row (more than viewport width).

---

### Row 4 — Divider

| Cell | Width | Component | Props |
| --- | --- | --- | --- |
| Cell 1 | 100% | **Divider** | `direction`: "horizontal", `thickness`: 1, `color`: "border", `indent`: 16 |

**Tests:** Divider atomic component with indent (iOS-style).

---

### Row 5 — Today's Schedule + Focus Stats (responsive)

**Responsive variants:**

- **compact** (phone): 2 cells stacked, each 100% width (schedule on top, stats below)
- **regular** (tablet): 2 cells side by side, 60% + 40%

| Cell | Component | Contents inside |
| --- | --- | --- |
| Cell 1 ("primary" slot) | **Container** (card-styled: surfaceElevated, borderRadius 12, padding 16) | **Text** — `variant`: "heading", `content`: "Today's Schedule". Then **Divider** — `thickness`: 1, `indent`: 0. Then **Markdown** — `content`: "**10:00 AM** — Team Standup *(Zoom)*nn**1:00 PM** — Design Review *(Room 3B)*nn**4:30 PM** — 1:1 with Manager *(Zoom)*" |
| Cell 2 ("secondary" slot) | **Container** (card-styled) | **Text** — `variant`: "heading", `content`: "Focus Stats". Then **Image** (server-rendered chart) — `src`: "/api/charts/focus-time-today", `resizeMode`: "contain", `width`: "100%", `aspectRatio`: 1.5, `placeholder`: "skeleton". Then **Text** — `variant`: "caption", `content`: "3h 20m deep work · 1h 45m meetings", `align`: "center" |

**Tests:** Responsive per-row compact/regular switching. Markdown atomic component (rich formatted text with bold + italic inline). Image with aspectRatio + percentage width (no layout shift). Chart as server-rendered image (data-bound Tier 4 via Image). Container-as-card again. Text + Divider + Markdown stacked inside Container. Named slots for template compatibility.

---

### Row 6 — Recent Notes (scrollable horizontal, 3 cards)

**Row props:** `scrollable`: true, `snap`: "none" (free scroll), `cellWidth`: 240, `uniform`: true, `gap`: 12

Each cell = **Container** (card-styled) containing:

| Layer | Component | Props |
| --- | --- | --- |
| Top | **Text** | `variant`: "body", `bold`: true, `content`: note title (e.g., "Architecture Decisions"), `numberOfLines`: 1 |
| Middle | **Text** | `variant`: "caption", `content`: "2h ago", `color`: "textSecondary" |
| Body | **Markdown** | `content`: first 3 lines of note body as Markdown preview (e.g., "Component tier system finalized. 7 atomics, 4 composites...") |
| Bottom | **Button** | `variant`: "ghost", `size`: "sm", `label`: "Open", `icon`: "external-link", `iconPosition`: "right", `onPress`: `{ type: "navigate", target: "workspace", params: { noteId: "..." } }` |

**Tests:** Scrollable row with snap: "none" (contrast with Row 3's "cell" snap). Button with icon + label + iconPosition: "right". Text with `bold`: true and `numberOfLines` truncation. Markdown preview (short content). Navigate action with params.

---

## Module 2: Planner

### Row 1 — Header (2 cells)

| Cell | Width | Component | Props |
| --- | --- | --- | --- |
| Cell 1 | 75% | **Text** | `variant`: "heading", `content`: "Planner" |
| Cell 2 | 25% | **Button** | `variant`: "primary", `size`: "sm", `label`: "New Event", `icon`: "plus", `iconPosition`: "left", `onPress`: `{ type: "open_sheet", target: "event_form" }` |

**Tests:** Button primary variant + sm size + icon with label. open_sheet action (bottom sheet / modal).

---

### Row 2 — Full Calendar (1 cell)

| Cell | Width | Component | Props |
| --- | --- | --- | --- |
| Cell 1 | 100% | **CalendarModule** | `defaultView`: "threeDay" (3-day time-block view with colored event blocks, now indicator line, swipeable) |

**Tests:** CalendarModule with different defaultView prop than Module 1 (tests that the same composite module renders differently based on props). 3-day view specifically tests the time-block rendering, event overlap handling, and swipe navigation.

---

### Row 3 — Divider

| Cell | Width | Component | Props |
| --- | --- | --- | --- |
| Cell 1 | 100% | **Divider** | `direction`: "horizontal", `thickness`: 1 |

---

### Row 4 — Event Detail + Event Actions (responsive)

**Responsive variants:**

- **compact** (phone): 2 cells stacked, each 100%
- **regular** (tablet): 2 cells, 55% + 45%

**Cell 1 — "Up Next" event cards:**

Container (no card style, just padding) containing:

- **Text** — `variant`: "heading", `content`: "Up Next"

Then 2 **Container** blocks (card-styled), each representing an event:

**Event Card 1:**

| Layer | Component | Props |
| --- | --- | --- |
| Title | **Text** | `variant`: "body", `bold`: true, `content`: "Team Standup" |
| Time | **Text** | `variant`: "caption", `content`: "10:00 AM – 10:30 AM", `color`: "textSecondary" |
| Location row | **Icon**  • **Text** (in a Row) | Icon: `name`: "map-pin", `size`: 16, `color`: "textSecondary". Text: `variant`: "caption", `content`: "Zoom · https://zoom.us/j/123" |
| Divider | **Divider** | `thickness`: 1, `indent`: 0 |
| Description | **Markdown** | `content`: "### Agendan- Sprint progress updaten- **Blocker:** API rate limitingn- Demo: new dashboard layout" |

**Event Card 2:**

| Layer | Component | Props |
| --- | --- | --- |
| Title | **Text** | `variant`: "body", `bold`: true, `content`: "Design Review" |
| Time | **Text** | `variant`: "caption", `content`: "1:00 PM – 2:00 PM" |
| Location row | **Icon**  • **Text** | Icon: `name`: "map-pin", `size`: 16. Text: "Room 3B, Building A" |

**Tests:** Multiple Containers (cards) stacked within a single cell. Icon + Text on the same horizontal line (inline row within a cell). Markdown with headings + bold + list inside an event card. Divider used as intra-card separator.

**Cell 2 — Event action buttons (all 5 Button variants, 2 sizes):**

Container (no card style) containing:

- **Text** — `variant`: "heading", `content`: "Event Actions"

| Order | Component | Props |
| --- | --- | --- |
| 1 | **Button** | `variant`: "primary", `size`: "lg", `label`: "Join Meeting", `icon`: "external-link", `fullWidth`: true, `onPress`: `{ type: "open_url", url: "https://zoom.us/j/123" }` |
| 2 | **Button** | `variant`: "secondary", `size`: "md", `label`: "Reschedule", `icon`: "clock", `fullWidth`: true, `onPress`: `{ type: "server_action", name: "reschedule_event", params: { eventId: "..." } }` |
| 3 | **Button** | `variant`: "ghost", `size`: "md", `label`: "Add Notes", `icon`: "edit", `fullWidth`: true, `onPress`: `{ type: "navigate", target: "workspace", params: { context: "meeting_notes" } }` |
| 4 | **Button** | `variant`: "icon", `size`: "md", `icon`: "copy", `onPress`: `{ type: "copy_text", text: "https://zoom.us/j/123" }` |
| 5 | **Button** | `variant`: "destructive", `size`: "md", `label`: "Cancel Event", `icon`: "trash-2", `fullWidth`: true, `onPress`: `{ type: "server_action", name: "delete_event", params: { eventId: "..." } }` |

**Tests:** ALL 5 button variants in one cell (primary, secondary, ghost, icon, destructive). Button sizes lg + md. fullWidth: true. open_url action. copy_text action. server_action with params. Button with `loading`: false (implicit, but the copilot should know to handle loading state). Button icon-only variant (no label).

---

### Row 5 — Quick Schedule via AI (InputBar with settings)

| Cell | Width | Component | Props |
| --- | --- | --- | --- |
| Cell 1 | 100% | **InputBar** | `placeholder`: "Describe an event to schedule...", `settingsItems`: [{ label: "Calendar", value: "personal", options: ["Personal", "Work", "Family"] }], `maxLines`: 4, `onSend`: `{ type: "server_action", name: "ai_schedule_event" }` |

**Tests:** InputBar composite with settingsItems populated (settings button visible, dropdown with options). Placeholder text. maxLines configured. server_action on send. This is the "universal input strip" in action.

---

## Module 3: Workspace

### Row 1 — Header (3 cells)

| Cell | Width | Component | Props |
| --- | --- | --- | --- |
| Cell 1 | 60% | **Text** | `variant`: "heading", `content`: "Workspace" |
| Cell 2 | 20% | **Button** | `variant`: "icon", `size`: "sm", `icon`: "filter", `onPress`: `{ type: "open_sheet", target: "filter_panel" }` |
| Cell 3 | 20% | **Button** | `variant`: "primary", `size`: "sm", `label`: "New", `icon`: "plus", `onPress`: `{ type: "server_action", name: "create_note" }` |

---

### Row 2 — Notes + Chat (responsive, main content area)

**Responsive variants:**

- **compact** (phone): 2 cells stacked, each 100% (Notes on top, Chat below — each takes ~50vh)
- **regular** (tablet): 2 cells side by side, 55% + 45%

| Cell | Width (regular) | Component | Props |
| --- | --- | --- | --- |
| Cell 1 ("notes" slot) | 55% | **NotesModule** | Feed view — vertical scrollable list of note preview cards. Each card shows author icon (user/AI/system), title (bold, single line), preview text (2-3 lines stripped), relative timestamp. Sorted by updated_at descending. "New Note" FAB. Tap → pushes to full-page dual-mode view (rendered Markdown ↔ raw editor toggle). |
| Cell 2 ("chat" slot) | 45% | **ChatModule** | Multi-threaded chat. Phone: thread list and chat are separate screens. Tablet: split view (thread list left, chat right). Model selector dropdown at top. Streaming responses via WebSocket. Message bubbles (user right, assistant left). InputBar at bottom of chat. |

**Tests:** Two composite modules side by side. Responsive layout (stacked on phone, split on tablet). NotesModule exercises Markdown rendering internally (view mode) and TextInput internally (edit mode). ChatModule exercises InputBar internally (with settingsItems for model selector), streaming, thread management. This row alone tests 3 composites (Notes, Chat, InputBar-inside-Chat).

---

### Row 3 — Divider

| Cell | Width | Component | Props |
| --- | --- | --- | --- |
| Cell 1 | 100% | **Divider** | `direction`: "horizontal", `thickness`: 1, `color`: "border" |

---

### Row 4 — Pinned Note Preview (1 cell, styled)

| Cell | Width | Component | Props |
| --- | --- | --- | --- |
| Cell 1 | 100% | **Container** (card-styled with accent: `backgroundColor`: "primaryLight", `borderRadius`: 12, `padding`: 16) | Contents below ↓ |

**Inside the Container (top to bottom):**

| Layer | Component | Props |
| --- | --- | --- |
| Header row | **Icon**  • **Text** (horizontal) | Icon: `name`: "bookmark", `size`: 20, `color`: "primary". Text: `variant`: "body", `bold`: true, `content`: "Pinned: Helm Architecture Roadmap" |
| Body | **Markdown** | `content`: "### Key Milestonesn- **Phase 1:** Component spec ✅n- **Phase 2:** Security & multi-devicen- **Phase 3:** Backend API completionn- **Phase 4:** Backend UI editingnn*Last updated 2h ago*" |
| Action | **Button** | `variant`: "ghost", `size`: "sm", `label`: "Open Full Note", `icon`: "external-link", `iconPosition`: "right", `onPress`: `{ type: "navigate", target: "note_detail", params: { noteId: "pinned-001" } }` |

**Tests:** Container with non-standard background color (theme token, not hex). Icon + Text on same line within Container. Markdown with headings + bold + italic + list (all supported formats). Button ghost with icon right-aligned.

---

### Row 5 — Quick Note Input (InputBar without settings)

| Cell | Width | Component | Props |
| --- | --- | --- | --- |
| Cell 1 | 100% | **InputBar** | `placeholder`: "Jot down a thought...", `settingsItems`: null *(settings button hidden)*, `maxLines`: 6, `onSend`: `{ type: "server_action", name: "quick_add_note" }` |

**Tests:** InputBar with settingsItems: null (contrast with Module 2's InputBar where settings are visible). This validates the "settings button hidden when null" behavior.
