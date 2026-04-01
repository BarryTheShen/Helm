# Architecture Decisions — Sessions 3 & 4 (2026-03-30)

**Source:** [Session 3 — 2026-03-30 — Component Specification & Behavior Design](https://www.notion.so/Session-3-2026-03-30-Component-Specification-Behavior-Design-9b4c85608ab9489b814c7dd3ee9ff955?pvs=21) and [Session 4 — 2026-03-30 — Layout System & Architecture Comparison](https://www.notion.so/Session-4-2026-03-30-Layout-System-Architecture-Comparison-7f3f0c1e76e84e8aa0643ef492ac3c71?pvs=21)

**Scope:** Component tier system (final), all atomic/composite/data-bound component specs, layout system (Row-by-Row), universal data architecture, codebase structure, responsive strategy, templates, agent↔frontend chat protocol.

**Status:** Decided — ready to implement.

---

## 1. Component Tier System (Final)

### Decision: 4-Tier Component Architecture

All UI elements in Helm are organized into 4 tiers with strict downward-only import rules.

**Tier 1 — Structural (skeleton):** Container, Row, Column, ScrollView, Spacer

- Used by developers building templates and composite module internals
- AI does NOT use these directly — the Row-by-Row layout system handles AI-facing structure

**Tier 2 — Atomic (7 components):** Text, Markdown, Button, Image, TextInput, Icon, Divider

- Smallest building blocks — the bricks
- AI uses these to fill cells in the Row-by-Row layout

**Tier 3 — Composite (Modules):** CalendarModule, ChatModule, NotesModule, InputBar

- Pre-built smart blocks with internal rendering logic
- AI treats these as black boxes — specifies props only, never touches internals
- Each wraps external libraries + custom code behind a unified API

**Tier 4 — Data-bound:** Chart (deferred — server-rendered image for MVP)

- Components that bind to backend data sources and display computed visualizations

### Removed Components (with rationale)

- **List → REMOVED.** Redundant with ScrollView + children. A "list" is just a ScrollView containing Rows of atomic components. No special ListModule needed.
- **Card → REMOVED.** Redundant with styled Container. A "card" is just Container with `backgroundColor: "surfaceElevated"`, `borderRadius: 12`, `shadow: "md"`, `padding: 16`. No separate component.
- **Form → REPLACED by InputBar.** Generic multi-field forms deferred. What's actually needed for MVP is a universal input strip (settings + textbox + send), which InputBar provides.

---

## 2. Atomic Components — Full Specification

### 2.1 Text

**Purpose:** UI labels, headers, timestamps — precise single-style text elements positioned by Flexbox. NOT for rich formatted content (use Markdown for that).

**Variants (via `variant` prop) — simplified to 3:**

| Variant | Use Case | Approx. Size | Weight |
| --- | --- | --- | --- |
| `heading` | Section titles, page headers | ~28-32px | Bold |
| `body` **(default)** | Normal text, descriptions | ~16px | Regular |
| `caption` | Timestamps, labels, metadata | ~12-13px | Regular/Light |

All sizes scale proportionally across breakpoints via theme tokens, not hardcoded pixels.

**Full props:**

- `content: string` — the text to render (required)
- `variant?: 'heading' | 'body' | 'caption'` — default `body`
- `color?: string` — override color (theme token name, not raw hex)
- `bold?: boolean`, `italic?: boolean`, `underline?: boolean`, `strikethrough?: boolean`
- `align?: 'left' | 'center' | 'right'`
- `numberOfLines?: number` — truncate with ellipsis after N lines
- `selectable?: boolean` — whether user can select/copy

**Key distinction from Markdown:** Text is an inline element (`<span>`) for precise Flexbox positioning — e.g., "Meeting" on the left and "3:00 PM" on the right of a Row. Markdown is a block element (`<div>`) that flows top-to-bottom like a document. Text = UI chrome. Markdown = content.

### 2.2 Markdown (NEW — added in Session 3)

**Purpose:** Rich formatted content blocks — notes body, chat messages, AI-generated summaries, help articles. Anywhere the AI needs rich text within SDUI layouts.

**Props:**

- `content: string` — Markdown source string (required)

**Rendering library:** `react-native-markdown-display` — converts Markdown → native RN components.

**Supports:** Headings, bold, italic, lists, inline image URLs, code blocks, links, blockquotes.

**Why a separate component from Text:**

| Aspect | Text | Markdown |
| --- | --- | --- |
| **Analogy** | Writing on a specific spot on a form | Pasting a Word document into a container |
| **Formatting** | Single style (one variant) | Mixed styles (bold, italic, headings, lists…) |
| **Layout** | Inline — sits where Flexbox puts it | Block — flows top-to-bottom internally |
| **Precision** | Can align in a Row between Icon and Button | Cannot align precisely — renders own paragraph spacing |
| **Performance** | Instant (native RN `<Text>`) | Must parse Markdown every render |
| **AI compatibility** | Variant prop in SDUI JSON | Raw Markdown string — LLMs write Markdown natively |

### 2.3 Button

**Purpose:** Primary interaction element with clear visual hierarchy.

**Variants (via `variant` prop):**

| Variant | Visual | Use Case | AI Frequency |
| --- | --- | --- | --- |
| `primary` **(default)** | Filled background, high contrast text | Main action ("Send", "Save", "Create") | ~90% |
| `secondary` | Outlined border, no fill | Supporting actions ("Cancel", "Back") | Edge case |
| `ghost` | No border, no fill, just text | Tertiary actions, toolbars, subtle | ~8% |
| `icon` | Icon-only, transparent background | Toolbars, close buttons, settings gear | ~2% |
| `destructive` | Filled red/warning background | Dangerous actions ("Delete", "Remove") | Edge case |

**Sizes (via `size` prop):**

- `sm` — compact (28-32px height). Inline/toolbar.
- `md` — standard (40-44px height). Most buttons. **Default.**
- `lg` — large (48-56px height). Primary CTAs, onboarding.

Sizes use theme tokens, not hardcoded pixels. Width determined by parent Flexbox. Text scales with theme font size.

**Full props:**

- `label?: string` — button text (required for all except `icon`)
- `icon?: string` — Feather icon name. Alone (`icon` variant) or with label.
- `iconPosition?: 'left' | 'right'` — default `left`
- `onPress: Action` — SDUI action (navigate, server_action, etc.)
- `disabled?: boolean` — grayed out, not tappable
- `loading?: boolean` — spinner replacing label/icon
- `fullWidth?: boolean` — stretches to fill parent width

**`icon` variant specifics:** Transparent background. Min 44×44px touch hit area per Apple HIG accessibility guidelines.

### 2.4 Image

**Purpose:** Display images from URLs or local assets. Used in notes, cards (templates), event details, charts (server-rendered), avatars.

**Implementation:** Wraps **expo-image** (NOT RN built-in `<Image>`) for: automatic downsampling, disk caching, progressive loading, blur-up placeholders, memory management.

**Full props:**

- `src: string` — image URL or local asset (required)
- `alt?: string` — accessibility description
- `resizeMode?: 'cover' | 'contain' | 'stretch' | 'center'` — default **`contain`** (safer, no crop)
- `width?: number | string` — number = px, string = percentage
- `height?: number | string`
- `aspectRatio?: number` — e.g., `16/9`. Used with percentage width for responsive.
- `borderRadius?: number` — 0 = sharp, 999 = circle for avatars
- `onPress?: Action` — optional tap action
- `placeholder?: 'blur' | 'skeleton' | 'none'` — loading state. Default `skeleton`.

**CRITICAL RULE — enforced in AI generation guidelines:** Never create an Image without size constraints. Always specify either explicit width+height OR width+aspectRatio. Omitting dimensions causes images to render as 0×0 until loaded → layout shift.

**Resizing solutions:**

| Problem | Solution |
| --- | --- |
| Layout shift on load | Always specify dimensions/aspectRatio + placeholder |
| Too large on phone, too small on tablet | Use `width: "100%"`  • `aspectRatio` — responsive |
| Unexpected cropping | `contain` (no crop) vs `cover` (fills, may crop) |
| Blurry on Retina/high-DPI | Serve 2x/3x resolution; expo-image handles auto |
| Memory with large images | expo-image auto-downsamples and caches |

**Special cases:**

- Avatar: Image with `borderRadius: 999`, fixed width/height (e.g., 40×40)
- Chart image: `resizeMode: 'contain'` so chart isn't cropped
- Background: `resizeMode: 'cover'` filling a Container

### 2.5 TextInput

**Purpose:** Text entry field. Used standalone AND inside InputBar.

**Full props:**

- `value: string` — current text (controlled component)
- `onChangeText: (text: string) => void`
- `placeholder?: string`
- `multiline?: boolean` — default `false`
- `maxLines?: number` — max visible lines before internal scroll (multiline only)
- `secureTextEntry?: boolean` — password dots. Default `false`.
- `keyboardType?: 'default' | 'email' | 'numeric' | 'phone' | 'url'`
- `autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'`
- `autoCorrect?: boolean` — default `true`
- `editable?: boolean` — default `true`

**Variant:** `outlined` only for MVP (border around input). `plain` variant exists in code but used only internally by InputBar (no border inside the input strip). Other variants (`filled`, `underline`) deferred.

**Auto-resize behavior (critical for InputBar):** When `multiline: true`, TextInput starts at 1 line height, grows as user types (up to `maxLines`), then scrolls internally. Standard RN behavior with `multiline={true}` + `onContentSizeChange` dynamic height. No special library needed.

**Labels:** Separate Text component above TextInput. No built-in `label` prop — compose via `Column > Text("Email") + TextInput`.

### 2.6 Icon

**Purpose:** Vector icons for buttons, navigation, status indicators.

**Primary set: Feather** (287 icons) via `@expo/vector-icons` (pre-installed with Expo, zero extra installation).

- Visual style: thin, consistent 24×24 strokes. Minimal, modern, no-fill. Clean aesthetic.
- Browse all icons: [feathericons.com](http://feathericons.com)
- Browse Expo icon sets: [icons.expo.fyi](http://icons.expo.fyi)

**Fallback sets (for icons Feather doesn't have):**

- Ionicons (1,300+ icons) — iOS-style
- MaterialCommunityIcons (7,000+ icons) — covers everything

**Props:**

- `name: string` — Feather icon name (required). E.g., `'send'`, `'settings'`, `'calendar'`
- `size?: number` — px. Default 24.
- `color?: string` — theme token name. Default theme text color.
- `set?: 'feather' | 'ionicons' | 'material'` — default `'feather'`
- `onPress?: Action` — if provided, icon becomes tappable with hit slop

**AI usage:** AI just uses the icon name string from Feather set. Doesn't know about `@expo/vector-icons` or implementation.

**Common icon names for AI generation guidelines (~30 most used):**

send, settings, search, calendar, edit, edit-2, trash-2, plus, chevron-right, chevron-left, chevron-down, chevron-up, x, menu, user, message-circle, file-text, image, home, bell, bookmark, check, clock, download, external-link, eye, filter, folder, heart, info, link, lock, log-out, map-pin, more-horizontal, more-vertical, phone, refresh-cw, save, share, star, upload

**Implementation:**

```tsx
// Icon.tsx
import \{ Feather \} from '@expo/vector-icons';
import \{ Ionicons \} from '@expo/vector-icons';

export function Icon(\{ name, size = 24, color, set = 'feather' \}) \{
  const resolvedColor = useThemeColor(color || 'text');
  if (set === 'feather') return <Feather name=\{name\} size=\{size\} color=\{resolvedColor\} />;
  if (set === 'ionicons') return <Ionicons name=\{name\} size=\{size\} color=\{resolvedColor\} />;
\}
```

All icon sets are **vector SVG-based** rendered as native font glyphs. Scale perfectly at any size/resolution.

### 2.7 Divider

**Purpose:** Horizontal/vertical line for visual separation. Used constantly between list items, sections, content groups.

**Props:**

- `direction?: 'horizontal' | 'vertical'` — default `horizontal`
- `thickness?: number` — line thickness in px. Default 1.
- `color?: string` — theme token. Default theme border/separator color.
- `indent?: number` — left/right inset in px (iOS-style list dividers). Default 0.

**Why kept as atomic (not eliminated like List/Card):** `\{ "type": "Divider" \}` is 1 line of JSON. The alternative — `\{ "type": "Container", "props": \{ "height": 1, "backgroundColor": "border", "marginHorizontal": 16 \} \}` — is 4 lines with magic numbers. Over dozens of uses across a screen, this adds up significantly for both humans and AI. Industry standard: every design system (Material UI, shadcn/ui, Apple SwiftUI `Divider()`) has this as a dedicated component.

---

## 3. Composite Modules — Full Specification

### 3.1 CalendarModule

**Libraries:**

- Month grid: **react-native-calendars** (Wix, 9k+ stars) — dot marking, day press, swipe months
- 3-day view: **react-native-big-calendar** — time-block grid with swipe
- Wrapped in Helm's `CalendarModule.tsx` with view switcher

**Two views (switchable via selector at top):**

#### Month Grid View (default)

- 7-column grid (Sun–Sat), rows = weeks of the month
- Each day cell shows **colored dots** underneath — one dot per event source (color = source identity)
- **Phone behavior:** Tap a day → bottom half of screen populates with agenda list for that day (event title, time, source color). Tap event in list → event detail card.
- **Tablet/iPad behavior:** Events display **inline under each day cell** directly in the grid as small pills/chips (title + time + source color). Tap → event detail card.
- Swipe left/right to change months. Today highlighted with accent color.

#### 3-Day Time-Block View

- X-axis (top) = 3 dates as columns. Y-axis (side) = 00:00–23:59, scrollable vertically.
- Events rendered as **colored blocks** positioned by start/end time within their date column.
- Block color = event source color (same color system as month view dots).
- **Swipeable** — swipe to shift the 3-day window forward/backward to any range.
- Tap any event block → event detail (popup or new page).
- **Now indicator line** — horizontal line at current time across all columns.
- Overlapping events: side-by-side within the same time column.

**Event Detail Card (shown on tap from either view):**

- **CalDAV events:** Title, start/end time, location, description, source calendar name + color
- **Notion events:** Title, date/time range, reminder time, status, tags, ALL custom page properties, notes content — rich property card like a Notion page peek. This is the key differentiator from standard calendar apps.

**Unified Event Data Shape:**

```json
\{
  "id": "string",
  "title": "string",
  "start": "ISO-8601",
  "end": "ISO-8601",
  "allDay": false,
  "sourceId": "string",
  "sourceColor": "#hex",
  "sourceType": "caldav | notion | custom",
  "properties": \{ "key": "value" \}
\}
```

Frontend consumes this unified shape. Doesn't care about source.

**Data Architecture:**

- **CalDAV connector:** Connects to any CalDAV server (Google Calendar, iCloud, Fastmail, Nextcloud). Syncs events into local SQLite. Assigns source color.
- **Notion connector:** Syncs Notion database pages with date properties. Maps all page properties into event's `properties` field. This enables rich Notion property display.
- Each source gets **auto-assigned color** (user-configurable later as QoL improvement).
- Push updates via WebSocket when backend re-syncs from remote sources.

**Search:** Search bar at top of calendar module. Filters events by title, description, or property values. Results shown as list, tap to jump to event's date.

**MVP Scope:**

- Read-only (no event creation/editing — needs API write support, deferred)
- Month grid + 3-day view only
- Single data source first (CalDAV or mock data), multi-source later
- Phone layout first, tablet after responsive breakpoint system built

### 3.2 ChatModule

**Core concept:** ChatGPT-style multi-threaded chat. Text in, text out for MVP. The module is reusable — can be slide-up panel, tab, or embedded in a page.

**Thread Management:**

- Create new threads
- List all threads (auto-generated title from first message, last message preview, timestamp)
- Switch between threads
- Delete threads
- Delete individual messages (no tool call reversion — deleted message's tool effects persist)

**Message Types (MVP):**

- User message (text only)
- Assistant message (text only, streamed token-by-token)
- System message (hidden from user, provides agent context)
- Tool call indicator (optional — shows "Searching calendar..." while agent uses tools, but details hidden)

**Model Selection (optional, extensible):**

- Dropdown/picker at top of chat or in thread settings
- Maps to backend model parameter via OpenRouter
- Can be hidden if not configured — no standard protocol for this, Helm defines its own
- Model name passed as param on message send endpoint

**Backend API:**

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/chat/threads` | POST | Create new thread |
| `/chat/threads` | GET | List all threads |
| `/chat/threads/:id` | DELETE | Delete thread |
| `/chat/threads/:id/messages` | GET | Get message history |
| `/chat/threads/:id/messages` | POST | Send message (streams response via WebSocket) |
| `/chat/threads/:id/messages/:msgId` | DELETE | Delete message |

Backend stores full message history per thread in SQLite. Calls LLM via OpenRouter (Chat Completions API format) with thread's message history.

**UI Layout:**

- **Slide-up panel opens → new empty thread** ready to type. Always opens fresh.
- **Side drawer / left swipe** (phone) or **persistent left sidebar** (tablet) → thread list
- Thread list: title, last message preview, timestamp. Swipe left → delete.
- Message bubbles: user right-aligned, assistant left-aligned. Text input at bottom.
- "New Chat" button at top of thread list

**Streaming:** Assistant responses stream token-by-token via WebSocket. Typing indicator while waiting for first token. Message appears and grows as tokens arrive.

**Responsive:**

- **Phone:** Thread list and chat are separate screens (push navigation)
- **Tablet:** Split view — thread list on left, chat on right (like iPad Messages)

**Deferred (not MVP):**

- Rich content in messages (cards, buttons, images, inline SDUI)
- Image/file/voice input from user
- Agent navigating to other modules from chat
- Tool call reversion
- Complex workflow visualization
- Per-module contextual chats

### 3.3 NotesModule

**Core concept:** Document feed where users AND AI create, view, and edit rich-text notes. Each note is a mini-document with title and Markdown body.

**SQLite Table Schema:**

| Column | Type | Description |
| --- | --- | --- |
| id | TEXT PK | Unique identifier |
| title | TEXT | Note title |
| body | TEXT | Markdown source content |
| author_type | TEXT | 'user' | 'ai' | 'system' |
| author_id | TEXT | User ID or agent ID |
| created_at | TEXT | ISO-8601 |
| updated_at | TEXT | ISO-8601 |
| is_pinned | INTEGER | 0 or 1 |
| tags | TEXT | JSON array (optional) |

**Feed View (main screen):**

- Vertical scrollable list of note preview cards
- Each card shows: **Author icon** (different per creator — user avatar, AI bot icon, system gear), **Title** (bold, single line), **Preview text** (first 2-3 lines, plain, stripped of formatting), **Timestamp** (relative: "2h ago", "Yesterday")
- Sorted by `updated_at` descending. Pull-to-refresh. "New Note" FAB or top-right button.

**Full-Page View — Dual Mode (tap a note):**

**View mode (default):**

- Rendered rich text via react-native-markdown-display
- Supports: headings, bold, italic, lists, images, code blocks, links, blockquotes
- Author icon + name at top, timestamp, back button

**Edit mode (toggle):**

- Raw Markdown text editor — plain `TextInput` with `multiline`, monospace font
- User types/edits Markdown source directly
- Toggle button to switch back to View mode and see rendered result
- Auto-saves on toggle or after debounce

**Permission model:**

- **AI-authored notes:** View mode only (read-only). Edit toggle hidden. User can copy text.
- **User-authored notes:** Both modes. Edit toggle visible.

**Note Creation Flow:**

- **User creates:** Tap "New Note" → opens in Edit mode with empty title and body
- **AI creates:** Backend `POST /notes` with `author_type: 'ai'` → appears at top of feed with AI icon

**Backend API:** Standard CRUD — GET/POST/PUT/DELETE on `/notes`. AI creates notes by calling `POST /notes`.

**Responsive:**

- **Phone:** Feed full-screen. Tap → push navigation to full-page note view.
- **Tablet:** Split view — feed on left, selected note's full view on right (Apple Notes style).

**Libraries:**

- Markdown rendering (View mode): `react-native-markdown-display`
- Text editing (Edit mode): standard RN `TextInput` with `multiline={true}`
- No WYSIWYG editor needed — dual-mode avoids mobile rich text editor problems entirely

**Deferred:** SDUI-rendered notes (notes as SDUI JSON with embedded charts/components), user image upload, note sharing/collaboration, templates, remote sync to Notion/Apple Notes, tags/folders/organization.

### 3.4 InputBar

**Core concept:** Universal input strip — settings + textbox + send. Reusable across Chat, Search, Notes quick-add, anywhere text input with an action is needed.

**Layout (3 elements, same row):**

`\[ ⚙️ Settings \] \[  Text input field (flex-grows)  \] \[ ➤ Send \]`

1. **Settings button** (left) — tappable icon button opening dropdown/bottom sheet. Content is configurable per parent module (e.g., model selector in Chat, search scope in Search). If `settingsItems` is null/empty, button is hidden.
2. **Text input** (center, flex-grows) — auto-expanding multiline TextInput. Starts as single line. Wraps to next line and grows vertically as user types. Max height (default 6 lines), then scrolls internally.
3. **Send button** (right) — fires configurable action. Disabled when input is empty.

**Props:**

- `onSend: (text: string) => void` — callback when send pressed
- `placeholder?: string` — e.g., "Message...", "Search..."
- `settingsItems?: Array<\{ label, value, options \}>` — dropdown content. Null = settings button hidden.
- `maxLines?: number` — max auto-expand lines. Default 6.
- `disabled?: boolean` — disable input (e.g., while waiting for AI response)

**Keyboard handling:** InputBar pinned above keyboard via `KeyboardAvoidingView`. Standard mobile behavior.

**File location:**

```
src/components/composite/InputBar/
├── InputBar.tsx         ← main component
├── SettingsDropdown.tsx ← the settings popup
└── types.ts             ← InputBarProps, SettingsItem
```

---

## 4. Data-Bound Components

### 4.1 Chart (Deferred — Server-Rendered Image for MVP)

**Decision:** Backend generates chart using Python (matplotlib/plotly), saves as PNG, sends image URL. Frontend renders `<Image src=\{chartUrl\} />`.

**Why enough for MVP:**

- No frontend charting library needed (saves bundle size)
- Backend has full control over chart type, styling, data
- AI can generate any chart type (bar, line, pie, heatmap) since it's just Python
- Frontend = zero complexity

**Why insufficient later:**

- Not interactive (can't tap bars, zoom, filter)
- Static snapshots, not real-time
- Less "native" feel than JS-rendered chart

**Future upgrade path:** Add `react-native-chart-kit` or `victory-native` when interactive charting is needed.

---

## 5. Universal Data Architecture

### Decision: Local-First with Remote-Optional Connectors

Established from the Notes discussion in Session 3, this pattern applies universally to ALL modules.

**4 principles:**

1. **Local-first:** Every module stores data locally in SQLite as primary source of truth
2. **Remote-optional:** Each data type has a standardized **connector interface** for remote sources
3. **Independence:** Local version fully functional without any remote connection
4. **Easy to connect:** Connector interface allows adding sync later without changing module internals

**Per-module application:**

| Module | Local Storage | Remote Connector |
| --- | --- | --- |
| Calendar | Events table in SQLite | CalDAV servers, Notion databases with date properties |
| Notes | Notes table in SQLite | Notion pages, Apple Notes, other note services |
| Chat | Threads + messages in SQLite | Backend manages LLM calls directly |
| Future modules | Same pattern — local table |   • optional remote connector |

**Key principle:** Modules don't care where data comes from. They read from and write to the local DB. A **sync layer** (separate from the module) handles pulling from and pushing to remote sources. This separation of concerns means adding a new remote source never requires changing module code.

---

## 6. Layout System — Row-by-Row (LOCKED)

### Decision: Row-by-Row Containers (Approach C)

Three layout approaches were evaluated in Session 4. Row-by-Row was selected unanimously.

### The Three Approaches Compared

| Aspect | A: Flexbox Nesting | B: Fixed-Column Grid | C: Row-by-Row ✅ |
| --- | --- | --- | --- |
| **AI freedom** | Too much — must make nesting decisions | Medium — grid coords can confuse | Minimal — linear rows, no nesting |
| **Variable columns per row** | Yes but complex | No — every row has same column count | Yes — each row defines its own cell count |
| **Horizontal scroll** | Requires extra component | Doesn't support natively | First-class: `scrollable: true` prop on row |
| **RN native support** | Yes (Flexbox is native) | No (must build custom Grid) | Yes (ScrollView + View + Flexbox) |
| **Industry usage for SDUI** | Almost nobody in production | Web only (Bootstrap/Material) | Every major app (see below) |
| **AI-friendliness** | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

### Industry Research — Who Uses Row-by-Row

| Company | Implementation | Result |
| --- | --- | --- |
| **Airbnb** (Ghost Platform) | Sections stacked vertically, each with own layout | Powers search, listings, checkout across iOS/Android/web |
| **Shopify** (Shop App) | Section-based page builder | New Store Screen built with SDUI sections |
| **Netflix** | Hero row + carousel rows | Entire UI is rows of content |
| **Spotify** | Vertical stack of horizontal sections | Browse, home, search all section-based |
| **Uber** | Vertical stacks of components | **10x feature velocity** on dozens of features |
| **Faire** | Section-based architecture | **90% rendering logic eliminated**, **65% code reduction** |
| **Every low-code builder** | Retool, Squarespace, Wix, [Builder.io](http://Builder.io) | All use section/row editors |

### How Row-by-Row Works

- **Page** = vertical stack of Rows (scrollable)
- **Row** = horizontal band with N Cells + optional horizontal scroll
- **Cell** = slot within a row holding one component/module
- **AI vocabulary:** Page → Rows → Cells → Components. That's the entire structural interface.

Each row **independently** defines: cell count, cell widths (% or px), height (auto or explicit), gap, padding. Variable columns per row — row 1 can have 1 cell, row 2 can have 3, row 3 can have 2. No fixed grid enforced.

### Row Props (Final)

| Prop | Type | Default | Description |
| --- | --- | --- | --- |
| `height` | `"auto"` | px | % | `"auto"` | Row height — auto grows to content |
| `cells` | Array<Cell> | required | Array of Cell objects in this row |
| `gap` | number | theme default | Spacing between cells |
| `padding` | number | 0 | Row-level padding |
| `scrollable` | boolean | `false` | Enable horizontal scroll |
| `snap` | `"cell"` | `"none"` | `"none"` | Snap behavior (scrollable only). `"cell"` = snap to nearest cell boundary. `"none"` = free scroll. |
| `cellWidth` | px | % | — | Per-cell width when scrollable |
| `uniform` | boolean | `true` | Equal cell widths when scrollable |

### Cell Props (Final)

| Prop | Type | Description |
| --- | --- | --- |
| `width` | % | px | Cell width. Non-scrollable rows: widths should sum to 100%. |
| `content` | Component JSON | null | The component to render, or null for empty cell |

### SDUI JSON Examples

**Basic layout — Calendar full-width, Notes + Chat side by side:**

```json
\{
  "type": "Page",
  "rows": \[
    \{
      "height": "auto",
      "cells": \[
        \{ "width": "100%", "content": \{ "type": "CalendarModule", "props": \{\} \} \}
      \]
    \},
    \{
      "height": "auto",
      "gap": 12,
      "cells": \[
        \{ "width": "60%", "content": \{ "type": "NotesModule", "props": \{\} \} \},
        \{ "width": "40%", "content": \{ "type": "ChatModule", "props": \{\} \} \}
      \]
    \}
  \]
\}
```

**Scrollable carousel row:**

```json
\{
  "scrollable": true,
  "snap": "none",
  "cellWidth": 280,
  "uniform": true,
  "cells": \[
    \{ "content": \{ "type": "Container", "children": \["card 1"\] \} \},
    \{ "content": \{ "type": "Container", "children": \["card 2"\] \} \},
    \{ "content": \{ "type": "Container", "children": \["card 3"\] \} \}
  \]
\}
```

### Responsive Behavior (Per-Row)

Each row can define `compact` and `regular` variants with different cell configurations:

```json
\{
  "compact": \{
    "cells": \[
      \{ "width": "100%", "content": \{ "slot": "primary" \} \},
      \{ "width": "100%", "content": \{ "slot": "secondary" \} \}
    \]
  \},
  "regular": \{
    "cells": \[
      \{ "width": "50%", "content": \{ "slot": "primary" \} \},
      \{ "width": "50%", "content": \{ "slot": "secondary" \} \}
    \]
  \}
\}
```

Phone: stacks vertically (each 100%). Tablet: side by side (50/50).

### Structural Component Split

**For AI (SDUI JSON):** Page, Row, Cell — that's it. The AI's entire layout vocabulary.

**For Developers (internal use):** Container, Row, Column, ScrollView, Spacer — used inside composite modules and template implementations. Not AI-facing.

---

## 7. Templates — Dual Purpose

### Decision: Templates Serve Two Roles Simultaneously

**Role 1 — Few-shot examples for AI generation:** When the AI needs to generate a custom layout, it references template JSON as examples of valid Row-by-Row patterns. Templates teach the AI the vocabulary, valid cell configurations, and common patterns.

**Role 2 — Token-saving shortcuts for users:** Most users don't need custom layouts. "Give me a dashboard" → AI drops in `template: "dashboard"` — a pre-built array of rows. No layout generation needed, no tokens spent.

**Key insight: More templates = fewer tokens = faster responses = cheaper API costs.**

### Template Format (Row-by-Row)

A template is a named JSON file containing pre-defined row arrays with named slots:

```json
\{
  "name": "dashboard-2col",
  "description": "Two modules side by side on tablet, stacked on phone",
  "rows": \[
    \{
      "compact": \{
        "cells": \[
          \{ "width": "100%", "content": \{ "slot": "primary" \} \},
          \{ "width": "100%", "content": \{ "slot": "secondary" \} \}
        \]
      \},
      "regular": \{
        "cells": \[
          \{ "width": "50%", "content": \{ "slot": "primary" \} \},
          \{ "width": "50%", "content": \{ "slot": "secondary" \} \}
        \]
      \}
    \}
  \]
\}
```

**AI fills the template with zero layout tokens:**

```json
\{
  "template": "dashboard-2col",
  "slots": \{
    "primary": \{ "type": "CalendarModule", "props": \{ "defaultView": "month" \} \},
    "secondary": \{ "type": "NotesModule", "props": \{\} \}
  \}
\}
```

When the user asks for something no template matches, the AI generates custom rows (more tokens, more flexibility) using the templates as few-shot examples.

### Template Storage

```
src/templates/
├── calendar-compact.json
├── calendar-full.json
├── chat-default.json
├── notes-feed.json
├── dashboard-home.json
└── ... (starter set TBD)
```

---

## 8. Codebase Structure — 3-Layer System

### Layer 1 — React Native Components (in app binary)

```
src/
├── components/
│   ├── atomic/           ← Tier 2: smallest building blocks
│   │   ├── Text.tsx
│   │   ├── Markdown.tsx  ← NEW (Session 3)
│   │   ├── Button.tsx
│   │   ├── Image.tsx
│   │   ├── TextInput.tsx
│   │   ├── Icon.tsx
│   │   └── Divider.tsx
│   ├── structural/       ← Tier 1: layout containers (dev-only, not AI-facing)
│   │   ├── Container.tsx
│   │   ├── Row.tsx
│   │   ├── Column.tsx
│   │   ├── ScrollView.tsx
│   │   └── Spacer.tsx
│   ├── composite/        ← Tier 3: complex multi-part modules
│   │   ├── Calendar/
│   │   │   ├── CalendarModule.tsx    ← main component with view switcher
│   │   │   ├── MonthGrid.tsx         ← wraps react-native-calendars
│   │   │   ├── ThreeDayView.tsx      ← wraps react-native-big-calendar
│   │   │   ├── EventDetailCard.tsx
│   │   │   └── types.ts
│   │   ├── Chat/
│   │   │   ├── ChatModule.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   ├── ThreadList.tsx
│   │   │   └── types.ts
│   │   ├── Notes/
│   │   │   ├── NotesModule.tsx
│   │   │   ├── NotePreview.tsx
│   │   │   └── NoteFullView.tsx
│   │   └── InputBar/
│   │       ├── InputBar.tsx
│   │       ├── SettingsDropdown.tsx
│   │       └── types.ts
│   └── data-bound/       ← Tier 4
│       └── Chart/
├── renderer/
│   ├── SDUIRenderer.tsx      ← THE CORE: takes SDUI JSON → maps to RN components
│   ├── componentRegistry.ts  ← maps type strings to React components
│   └── actionHandler.ts      ← dispatches actions (navigate, server_action, etc.)
├── templates/            ← pre-built SDUI JSON configs
│   ├── calendar-compact.json
│   ├── dashboard-home.json
│   └── ...
├── theme/
│   ├── tokens.ts             ← design tokens (colors, spacing, typography)
│   └── breakpoints.ts        ← compact vs regular
└── hooks/
    ├── useBreakpoint.ts      ← returns 'compact' | 'regular'
    └── useTheme.ts
```

### Layer 2 — SDUI JSON (from server)

Server sends JSON referencing component type strings:

```json
\{ "type": "CalendarModule", "props": \{ "defaultView": "month" \} \}
```

`SDUIRenderer.tsx` looks up the type in `componentRegistry.ts`, finds the React component, renders it with props.

### Layer 3 — Component Registry (the glue)

```tsx
// componentRegistry.ts — single source of truth
export const componentRegistry: Record<string, React.ComponentType<any>> = \{
  'Text': Text,
  'Markdown': Markdown,
  'Button': Button,
  'Image': ImageComponent,
  'TextInput': TextInputComponent,
  'Icon': Icon,
  'Divider': Divider,
  'Container': Container,
  'CalendarModule': CalendarModule,
  'ChatModule': ChatModule,
  'NotesModule': NotesModule,
  // ... every component SDUI JSON can reference
\};
```

If a type string doesn't match a key → invalid. The 3-layer validation (from Session 2) checks against this registry.

### Import Rules — Future-Proof Architecture

1. **Imports only flow downward:** Tier 3 → Tier 2 → Tier 1 → RN primitives. Never reverse. No circular dependencies.
2. **Atomics never know about composites:** Button.tsx has no idea it's inside CalendarModule. Just accepts props and renders.
3. **Composites never import other composites:** CalendarModule doesn't import ChatModule. Interaction through action system or shared state.
4. **Renderer is the only omniscient component:** `componentRegistry.ts` imports ALL components. The single place with full catalog knowledge.
5. **Types co-located:** Each composite has its own `types.ts`. Shared types (Action, ThemeTokens) in top-level `types/` folder.

**Adding a new component:** Create file → register in componentRegistry.ts → done. Zero changes to existing code.

**Swapping a library:** Only the wrapper file changes. Parent composite unaffected (e.g., replacing react-native-calendars with Flash Calendar only touches `MonthGrid.tsx`).

---

## 9. Responsive Strategy

### Decision: Hybrid — Per-Row Layout Switching + Breakpoint-Aware Props

**Two breakpoints:** `compact` (phone) and `regular` (tablet/iPad).

**Main mechanism — per-row layout switching:** Each row in SDUI JSON defines two layouts (compact/regular) with completely different cell configurations. Phone: cells stack vertically. Tablet: cells sit side by side.

**Fine-tuning — theme token scaling:** Spacing, padding, font sizes adjust per breakpoint automatically through theme tokens. Components don't need breakpoint logic — the theme handles it.

**AI doesn't think about responsive at all:**

- When AI picks a template → template already handles responsive.
- When AI generates custom rows → each row independently defines compact/regular variants.
- Templates handle the hard responsive work. AI just fills slots.

**Calendar-specific responsive:**

- **Phone (compact):** Month grid top half, day agenda bottom half on tap
- **Tablet (regular):** Month grid with inline event pills under each day cell (Notion Calendar style)

---

## 10. Agent↔Frontend Chat Protocol — Research & Decision

### Current State of the World (Researched)

| Protocol/API | Status | Relevance to Helm |
| --- | --- | --- |
| OpenAI Chat Completions API | Most widely used | Stateless, no threads — you manage history yourself |
| OpenAI Assistants API | Deprecated (Aug 2026) | Had threads — but being killed. Don't build on it. |
| OpenAI Responses API | Replacement for Assistants | Manual chaining, still no standard thread management |
| AG-UI Protocol (CopilotKit) | Active, event-driven | Good for real-time events within a turn — no multi-thread mgmt |
| MCP | Active | For tools/data connections, NOT for chat UI |

### The Gap

No standard protocol exists for: multi-thread session management, model selection from frontend, complex workflow rendering in chat, tool call reversion.

### Helm's Approach

Custom simple REST API for thread CRUD + WebSocket for streaming. Pragmatic, not dependent on evolving standards. Protocol defined in Section 3.2 (ChatModule backend API).

---

## 11. Simulator & Dev Environment (Researched, Parked)

**Android Studio Emulator on Linux** — recommended for daily dev. RN renders identically on Android. Create AVDs at any screen size (small phone, regular phone, large phone, tablet).

**mobile-mcp** ([github.com/mobile-next/mobile-mcp](http://github.com/mobile-next/mobile-mcp)) — MCP server for mobile simulators. AI can take screenshots, tap, swipe, type, inspect accessibility tree. Works with Android emulator on Linux. Apache 2.0, 1,500+ stars.

**Expo Web + Chrome DevTools** — rapid layout iteration in browser. Not pixel-perfect but fastest loop for Flexbox testing. `npx expo start --web`.

**Expo Go on physical iPhone** — final iOS verification.

**Setup walkthrough deferred to later session.** Barry's machine supports KVM hardware virtualization.

---

## 12. Carried Forward / Still Open

### Next Session Priority: AI Generation Guidelines

The "instruction manual" for the in-app AI agent. Should cover:

- Complete component vocabulary the AI can use
- How AI decides between template vs custom rows
- Few-shot example format
- Required vs optional props per component
- Common mistakes to avoid (e.g., Images without size constraints)
- Token budget strategies
- The ~30 most common icon names

### Other Open Items

- Starter template set for MVP (how many, which patterns)
- Chart use cases brainstorm (concrete scenarios)
- Full architecture review: SDUI JSON → renderer → component registry → Row-by-Row → templates → responsive (optional, can run alongside guidelines)
- Template bundling spec — how a template packages SDUI layout JSON + backend functions
- Push notifications + offline — design into module schema or bolt on later?
- Android Studio emulator + mobile-mcp setup on Linux workstation

---

## 13. Action Items (Implementation Order)

1. **Wire up each component end-to-end** — replace stubs/console.log with actual working handlers in every component
2. **Write AI generation guidelines** — component vocabulary, template vs custom, few-shot format, required/optional props, token strategies
3. **Define starter template set** — minimum viable set of pre-built Row-by-Row templates for MVP
4. **Chart use cases brainstorm** — define what Chart actually needs to display
5. **Set up Android Studio emulator + mobile-mcp** on Linux workstation for responsive testing
6. **Full architecture review** (optional alongside above) — trace entire path from SDUI JSON through renderer/registry/layout/templates/responsive
7. **SDUI schema versioning strategy** — define a versioning contract between server-sent JSON and client component registry. Without this, any component addition/removal/change risks silent UI breakage. See dedicated versioning doc: [SDUI Schema Versioning Strategy](https://www.notion.so/SDUI-Schema-Versioning-Strategy-d2ffda05ba6943f2ac1553da7cb1cfe6?pvs=21) + `docs/sdui-versioning.md` in repo. This is the highest priority deployment concern.