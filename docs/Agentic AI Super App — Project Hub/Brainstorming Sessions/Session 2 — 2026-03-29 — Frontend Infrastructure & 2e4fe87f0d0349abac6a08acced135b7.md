# Session 2 — 2026-03-29 — Frontend Infrastructure & Mutability Model

### Key Decisions

**Terminology**

1. **Module** = a tab on the bottom bar. A mini-app with its own layout, components, and data connections.
2. **Component** = a UI element inside a module (button, calendar, text, etc.). Has templates.
3. **Shallow nesting** = components can have child components, but no grandchildren. Current codebase already supports this via `children` arrays.

**Project Framing**

1. **Not "Agentic AI Super App."** Better framing: **A self-hosted SDUI platform with AI-assisted editing.** System works without AI. AI is the editor + chat interface. Value over webapp: push notifications, offline, native Apple features, MCP/OpenClaw bridge.

**Layout & Rendering**

1. **Flexbox-based layout** with semantic grid (4-column compact). No absolute pixel values anywhere in SDUI JSON. All sizing relative (percentages, flex ratios, grid column spans). Semantic text sizing (caption, body, title, headline).
2. **Breakpoints parked.** Flexbox handles responsiveness. Per-device layouts deferred — same JSON to all devices, client adapts.
3. **Component variants hardcoded** in app binary (e.g., calendar-compact, calendar-full). Custom components later.

**Templates & Validation**

1. **Template-first.** AI defaults to templates. Freeform creation is fallback only.
2. **3-layer validation:** (1) Constrained input space via grid/schema, (2) Template-first bias, (3) Validation + 2-retry cap then fallback to template.
3. **Human-in-the-loop.** All AI layout changes go through draft/approval flow. User can approve, reject with feedback, or reject and revert. Skip/auto-approval available.

**Component Catalog (4 Tiers)**

1. **Tier 1 — Structural:** Container/Row/Column, ScrollView, Spacer.
2. **Tier 2 — Atomic:** Text, Button, Image, TextInput, Icon, Divider.
3. **Tier 3 — Composite:** Calendar, List, Card, Chat.
4. **Tier 4 — Data-bound:** Form, Chart, Map (skip Map for now).

**Action System (#1 Priority)**

1. **Client-side actions** (no server call): navigate, go_back, open_url, dismiss, open_sheet, copy_text, toggle.
2. **Server-side actions** (hit backend): `server_action` (named function registry, replaces `api_call`), `send_to_agent`.
3. **Delete `api_call`** from sdui.ts. Replace with `server_action` using named functions.
4. **Function registry** — new backend component. Templates bundle their own backend functions (calendar template → refresh_calendar, create_event, delete_event). Starter set for testing: `refresh_data`, `submit_form`, `send_to_agent`.
5. **The app doesn't need AI to function.** AI is only (1) the editor that builds modules and (2) a chat interface. Everything else works independently.

**Architecture**

1. **API-first UI.** Both AI and future editor are clients calling the same module management API.
2. **Data pipeline:** External API → Backend Sync Layer → Local DB Cache → SDUI JSON Generator → Frontend. Write-back via agent tool calls → re-sync.
3. **Hardcoded:** SDUI component renderers (Apple ToS), auth/OAuth flow, design system. **Dynamic:** Tab bar, module list, layouts, data bindings, refresh strategies.
4. **AI-only module creation ships first.** Backend visual editor (Level B, Retool-like) comes later. Admin panel on backend for user management; later becomes the visual editor too.
5. **Settings** accessible always (possibly via iOS Settings app for server endpoint).

**Multi-Device**

1. **Same SDUI JSON to all devices, client adapts via Flexbox.** Per-device routing infrastructure (device IDs, targeted WS messages) designed in from the start, but per-device layouts deferred.

**Authentication**

1. **Current auth works** for self-hosted local use (JWT token per request, session-based).
2. **User creation: CLI only** on the server. Remove public `POST /auth/setup` endpoint.
3. **Auth fixes deferred** — not a priority now. Get it working first.

**Security Issues Noted (fix later)**

- No rate limiting on login — brute force possible
- `POST /auth/setup` wide open — needs removal/lockdown
- CORS `allow_origins=["*"]` — browser-only, fix when web editor ships
- Frontend logout doesn't invalidate backend session
- Token in WebSocket URL visible in logs
- No HTTPS enforcement

### Action Items

1. **Wire up client-side action handlers** — Replace `console.log` in every tab's `onAction` with actual dispatch (navigate → React Navigation, open_url → Linking, copy_text → Clipboard, etc.)
2. **Build function registry** — New `backend/app/services/action_registry.py`. Dict mapping function names → handlers + allowed modules + param schemas. Wire into `POST /api/modules/{module_id}/action`.
3. **Replace `api_call` with `server_action`** in `sdui.ts` type definitions. Add `server_action` type: `{ type: 'server_action', function: string, params?: Record<string, any> }`.
4. **Implement starter functions** — `refresh_data`, `submit_form`, `send_to_agent` to test the plumbing.
5. **Remove or lock `POST /auth/setup`** — Replace with CLI user creation (`python manage.py create_user`).
6. **Wire device ID into WebSocket manager** — `devices` table exists but WS manager doesn't distinguish between devices. Add device identification on WS connect.
7. **Design template bundling spec** — Define how a template package includes both SDUI layout JSON and its associated backend functions.
8. **Build draft/approval flow** — When AI creates/modifies a module, it enters "draft" state. User sees preview, can approve/reject/revert.

---

## Chat History

**Barry:** We need to brainstorm the exact infrastructure of the frontend. Like what can get changed what cannot changed. Things like this. Also how will the entire thing work. I am just really clueless. Let's brainstorm.

---

**Jarvis:** Before we go deep, I want to make sure we're solving the right layer of problems first. Here are 5 foundational questions:

**Q1 — Hardcoded vs. Dynamic:** In the current codebase, certain things are hardcoded (tab list, module layouts, component catalog). When you say "what can get changed," are you asking: (a) What should be changeable by the AI agent at runtime? (b) What should be configurable by the end-user? (c) What should be changeable by a developer/deployer?

**Q2 — Scope of "infrastructure":** Are you more interested in: (a) The component architecture (what SDUI components exist, how they compose)? (b) The data flow (how data gets from backend → SDUI JSON → rendered UI)? (c) The mutation model (how the AI agent or user changes what's on screen)? (d) All of the above, and you want a priority order?

**Q3 — The "app shell" question:** Right now the app has a fixed tab bar with fixed screens. Do you want the tab bar itself to be dynamic? Like, should the AI be able to say "this user needs a Calendar tab, a Tasks tab, and a Finance tab" and the app restructures?

**Q4 — Real-time vs. request-response:** When the AI changes the UI, should it: (a) Push changes instantly via WebSocket (current approach)? (b) Queue changes that the user pulls on refresh? (c) Hybrid — some changes are instant, some are queued?

**Q5 — Offline / degraded state:** If the server goes down, what should the app show? Last known state? A fallback UI? Nothing?

---

**Barry:** It's sort of coded you can check here, but it's bad and not functional. We need a huge revamp: [https://github.com/BarryTheShen/Helm](https://github.com/BarryTheShen/Helm)

One other architecture decision I want to make is that backend should exist with its own editor. Right now what I am shipping is still a self hostable SDUI. The backend should be some sort of editor or thing, and then the outputs from some sort of API so that the AI can use or some workflow can use. These architecture is very important. The backend is still very important and I think we've been ignoring it largely.

1. I want most things to be not hardcoded. I want basically most things to be non hardcoded. Maybe at the start somethings can be with a template but most things shouldn't be hardcoded.
2. I think it would be the technical flow. How would the AI generate a UI that they can use. The main part is the SDUI part. How are we going to make it? And then the next question is how can the AI interact with it.
3. I don't think that's what I wanted. Basically what I wanted is maybe at the start they only have "chat" but when they tell their AI, I want a calendar that points to the google calendar API. The AI can add a new tab on the bottom with "calendar" with all their info imported in. There can be well designed templates already in there.
4. I'm a bit confused about this. I think the flow goes like this. When the user tells the agent to update the calendar, it should call a tool or some sort of thing that will update the google calendar, then there is another process that pulls data from google calendar then it shows up. It can be pull to refresh or auto refresh, I think it can also depend on the user. Maybe the default can be auto refresh but if the user wants optimization in their stuff, they should make it so that it's pull to refresh or something. I am still very unsure and I think we are very early in terms of architecture design.
5. I think cache last known state would make sense. Maybe the client pulls from the server every 30 seconds or something. Maybe some modules can have faster update speed depends on the modules.

Please check out the github page for what we are at right now. I did a lot of ground work already. The MVP of an agent editing the UI is already working. It's just a lot of things are hard coded so we need to make it better. The main architecture stuff is in the docs/codebase-explanation folder.

---

**Jarvis:** Okay, I've read through the codebase docs — [frontend.md](http://frontend.md), [backend.md](http://backend.md), and the AI Technical Reference. Here's what I'm understanding from your answers, and the next round of questions.

**What I'm hearing — the mental model shift:**

Your current codebase has 7 hardcoded tabs (Home, Chat, Modules, Calendar, Forms, Alerts, Settings) with a fixed tab bar. The AI can hide/show tabs and push SDUI JSON into any of them, but it can't create new tabs or connect to external services. The calendar reads from an internal SQLite DB, not Google Calendar.

What you're describing is fundamentally different:

1. The app starts blank — just Chat. No calendar, no forms, no alerts. Empty.
2. The user tells the AI what they want — "I want a calendar connected to Google Calendar"
3. The AI instantiates a module — picks a pre-built calendar template, creates a new tab, connects it to the Google Calendar API via the backend
4. Data flows through the backend as a bridge — backend connects to Google Calendar API, pulls events, transforms them into SDUI JSON, serves to frontend
5. The backend also has an "editor" — a separate web interface where you can manually configure modules, API connections, and layouts without going through the AI

**Q1 — The Module Lifecycle:** Right now a "module" in Helm is just a hardcoded tab name + an SDUI screen blob in `module_states`. You're describing modules as something much richer — a module is a configured instance with: a template type (calendar, list, form, etc.), an external data source connection (Google Calendar OAuth), a refresh strategy, and an SDUI layout. What creates this module object? Is it the AI calling a `create_module` tool? Is it the user clicking "Add module" in the backend editor? Both?

**Q2 — Templates vs SDUI:** You said "there can be well-designed templates already in there." So when the AI says "create a calendar module," it doesn't generate raw SDUI JSON from scratch — it picks a template (like "Calendar Template") that already has the layout, colors, event card design, etc. pre-made. The template then gets filled with data from the connected API. Is that right? If so, templates are a separate concept from raw SDUI — they're more like pre-built module blueprints that know how to render a certain kind of data.

**Q3 — The Backend Editor:** What do you actually picture when you say "editor"? Three levels:

- Level A: A web dashboard where you can see your modules, toggle them on/off, configure API keys and connections (settings panel)
- Level B: A visual layout editor where you can drag-and-drop SDUI components to design screens (like Retool or Appsmith)
- Level C: Something in between — you configure data sources and pick templates, but the actual layout is handled by templates + AI

**Q4 — The Data Pipeline:** You described: "agent calls tool → updates Google Calendar → separate process pulls data → shows up in app." This means the backend needs a data sync layer. The flow would be:

```
External API (Google Cal) → Backend Sync Layer → Local DB Cache → SDUI JSON Generator → Frontend
```

Is that how you see it? Because this means the backend is doing two very different jobs: (1) acting as an API gateway to external services, and (2) generating SDUI layouts from that data.

**Q5 — What stays hardcoded in the app binary?** In the current codebase, these things are baked into the React Native binary:

- The 19 SDUI component types (calendar, form, alert, card, text, etc.)
- The tab bar itself (its existence, its position at the bottom)
- The Chat screen's special streaming behavior
- The auth/connect flow
- The design system (colors, typography, spacing)

Which of these do you want to stay hardcoded vs become server-controlled?

---

**Barry:** OK not necessarily app starts blank. Because an external agent doesn't need to be the one in chat. The one connected in chat can be the external agent but not necessarily need to be. The user can also access this external agent somewhere else perhaps.

Other than that I think you are mostly correct and I have been trying to build that but I think the vibe coding agent isn't really understanding. I don't want 7 hard coded tabs that's not that good. I want more versatility. These hard coded tabs can be just templates.

1. Yes I think that is what I wanted. A module can be just the calendar list form or something, but it can be something way richer. Something that can be a combination of calendars and like task schedule or something. Perhaps there are multiple calendars each connected to a different API? I don't know. I feel like there still isn't a very standardized API for these that can be suited for plug and play that we can do as of now. I think create module tool is interesting and also the add module in the backend editor. Both will work.
2. Yes I think prebuilt templates and if it doesn't think it is good enough, it will just create one from scratch. Creating UI is very tricky because it might go out of bounds and all the things like that might cause problems.
3. I think this can be a visual layout editor so level B. I think it's just the exact tools that the AI has but for humans. The drag and drop togglable functions and all of that like that.
4. I think so? I'm not an SDUI developer, so what is the industry standard for these? I'm not sure about the data flow. Can you explain each step by step.
5. The only things that needs to be hardcoded should be the low level stuff like the SDUI components because of the Apple's ToS problems I think. We need to have these code already but any JSON can just come in and go. The tab bar should be all not hard coded, except for maybe the settings part. Like settings should be placed somewhere and can be placed somewhere at all times so that the user can change server or do something like that. If it's possible they can also change it in the iOS settings app. That might be better. Like directly change endpoint server in that might be more versatile and cleaner.

Everything else, I want to adopt it like this. It shouldn't be hardcoded if we are not going to have serious problems with it. Perhaps it could be the data pipeline. If we don't hard code that that might cause problems then we hard code it. They can't change it or can only change a tiny bit (refresh speed etc.) We afterall are building a platform for Agentic AI apps.

I'm not sure about auth/connect flow system and I'm a bit confused about that.

---

**Jarvis:** Correction noted — the app doesn't start blank. The in-app chat agent and the "external agent" that builds modules are not necessarily the same thing. The app shell needs a default layout config that ships with the server, not a blank canvas.

On modules being composable — a module could be "a combination of calendars and task schedules" — a composite module. A module is not just "one component type," it's a layout of multiple components, each potentially connected to different data sources.

The data pipeline step by step:

1. User or AI triggers a connection ("Connect my Google Calendar"). Backend initiates OAuth, stores tokens.
2. Backend syncs data from external API via background job. Stores normalized local copy in backend DB (the "sync layer").
3. SDUI JSON generator reads from local copy. When frontend requests the calendar module's screen, backend reads from local DB cache and assembles SDUI JSON.
4. Frontend receives SDUI JSON and renders it. The renderer maps each component type to its native implementation.
5. Refresh cycle. Client polls backend on interval or backend pushes via WebSocket. Backend re-syncs from external API based on module's refresh strategy.
6. Write-back (mutations). User via AI says "add meeting at 3pm" → agent writes to Google Calendar API → triggers re-sync → new SDUI JSON push to frontend.

Industry standard: Retool, Appsmith, Superblocks all use this pattern — data source connection layer, query/transform layer, UI binding layer. Difference with Helm is the AI does the wiring.

Follow-up questions:

- Q1: Editor = AI's toolbox but visual. Same API for both (`create_module`, `update_layout`, `connect_data_source`, etc.). Editor is just a GUI on top.
- Q2: Composite modules — if a module contains multiple calendars + task list, its layout is a tree of SDUI components. How deep should nesting go? Is a module always one screen?
- Q3: Plug-and-play API problem — no standardized API across Google/Outlook/Apple Calendar. Backend needs adapters that normalize data into common schemas. How many at MVP?
- Q4: Auth/connect flow — two concerns: app auth (JWT, current system) and service auth (OAuth 2.0 for external services). Where does OAuth flow happen? Probably should be hardcoded/built-in since it's security-critical.

---

**Barry:** OK I like the data pipeline.

1. Yes I guess so? Would that be possible? I think that would make sense to be the infrastructure.

It sounds like you are flattering me. I don't need that. More constructive criticism and trying to question the validity and everything is what I need.

1. Oh I think I get what you mean. I think we need to start clarifying a lot of the terminology because I'm just using them very interchangeably. Let's start defining this. Each module would be a tab on the bottom of the screen (if it doesn't fit it can be stored somewhere else). Then from here, each module will have components. Each of these components could be a button, could be a chat, could be some textbox + send button or something — these are components. Basically each module is a small application with a bunch of components that can run things and make things work.

Back to the template. Modules can have templates. Most of the time having a calendar as its own application is good and enough, therefore calendar should be its own module. Chat also is its own module. Maybe you can view history, connect to a TTS module here to convert text etc. That would be the chat module. There can be all sorts of things, and we need guidelines for the AI to generate these. Components also have templates. The ones above I listed are the templates, the AI just makes small changes to it. I'm not sure about how much can the modules have inside.

There should also be things like push notification directly to the phone and things like that. That's the main sell point of this app compared to a webapp otherwise there is no need to use my SDUI. Push notification, local cache, and some logic still works offline.

When you talk about nesting, I don't think there are nesting. It's just module + components. Maybe there is somewhere to store the components and that's really it.

1. I personally don't know. I think we will consider this later. This is a future problem. Depends on how they will do all of these. Ideally I want to connect this to my Notion page.
2. Sure let's make it built in for now. I don't see a problem in that.

---

**Jarvis:** Pushed back on several points:

- **Flat component model won't work.** A calendar module with an event list where each event card has a button is already 3 levels. Need at least shallow nesting (components can have child components, but no grandchildren). Current codebase already has `children` arrays.
- **AI-generated freeform layout is dangerous.** AI doesn't respect safe areas, scroll boundaries, touch target sizes. Suggested grid-based layout constraint system like Retool/Appsmith.
- **Push notifications + offline is a big scope expansion.** APNs integration, notification service, per-module notification settings, offline mutation queuing. Suggested treating as extension point, not core architecture.
- **Editor doubles surface area.** Building API + web editor + mobile app = three clients. Suggested shipping AI-only first, editor later. API stays the same either way.
- **API-first UI pattern:** Both AI and editor are just different clients calling the same module management API.

Questions:

1. Shallow nesting or truly flat?
2. AI layout validation — what happens when layout is broken?
3. Push notifications — design into module schema now or bolt on later?
4. Editor priority — AI-only first, or editor first?

---

**Barry:** Sure then, let's have child components. That's reasonable and we sort of already have that.

Yes there would be a safe backend validation layer. I will make some more things hard coded. Perhaps I won't give it the freedom to set a button as big as the entire screen. Make it a reasonable range or something.

Good point on the grid. Maybe everything in a grid would work. The times when you go out of the grid is very small and if this is going to be towards OpenClaw users who barely know programming, not having it on the grid times is very low.

Yes let's do API first UI.

1. Shallow nesting.
2. Would it be ok if the MCP server raises some sort of validation error and then just sends it back to the AI? That might cause some problems with the end user because it might use loads of tokens because they might be going back and forth with the problem again and again.
3. Let's talk about that later.
4. I think AI only module creation is the main idea and that should be the main thing.

---

**Jarvis:** Addressed the validation loop / token burn problem. Three layers of defense:

**Layer 1 — Constrain the input space.** Grid system (e.g. 12-column). Each component type has min/max column spans and row heights baked into its type definition. The tool schema itself prevents bad output. Example: `column_span: int (1-12)`, `row_span: int (1-4)`. AI literally cannot produce "button as big as entire screen." Eliminates ~80% of layout errors.

**Layer 2 — Default to templates.** System heavily biased toward templates. `create_module` tool has required `template_id` field, "blank" is just one option. When AI uses a template and just swaps data bindings, layout errors are nearly impossible.

**Layer 3 — Validation with retry budget.** MCP server validates, returns error. Cap at 2 retries max. After 2 failures, fall back to closest matching template and tell user "I couldn't create the exact layout, so I used the calendar template as a starting point. You can customize further." Caps token spend, gives user something rather than nothing.

Key insight: the more you constrain Layers 1 and 2, the less Layer 3 ever fires.

Pushed on the grid decision: 12-column grid is overkill on a phone in portrait. Options:

- Responsive grid: 12 columns on tablet/landscape, collapses to 4 on phone/portrait (more complex)
- Simple fixed grid: 4 columns on phone always (easier, probably enough for MVP)

Questions:

1. Template-first or freeform-first? (Suggesting template-first)
2. Grid spec — 4-column phone grid, or responsive 12-column?
3. Retry cap of 2 then fallback to template — or never allow freeform, always require starting from template?

---

**Barry:** I think there is a huge problem here which is that every single UI has different dimensions. The text might fit perfectly here but just looks really shit on the other UI. There are horizontal screens, vertical screens so many problems with it and I think that's the main thing we need to consider and solve. Some sort of dynamic system. What is the industry standard for this for now.

Regarding 3 layers. I like it. And yes, let's use it.

1. Of course default to use templates.
2. I think responsive of some sort. It is a hard problem. Do some research, how do they all do it?
3. Sure retry cap of 2. That sounds about right. But that also means it's really frustrating. I think we can do something where the user can see what their AI renders, and click approve or not, and we can raise validation errors to it. So the user can also be the person validating the UI or just telling it what is going wrong, and also seeing that it's not really our fault but it's really their AI is kind of dumb.

---

**Jarvis:** Did research on responsive SDUI layout. Here's how the big players handle it:

**Approach 1 — Flexbox / auto-layout (what most mobile SDUI does).** This is what React Native already uses under the hood, and it's what Airbnb, Lyft, and most mobile SDUI systems rely on. The server does NOT send pixel coordinates or absolute positions. Instead it sends layout intent: "these 3 cards are in a row, each takes equal width" or "this list scrolls vertically, each item is full width." The client's Flexbox engine figures out the actual pixel dimensions based on the screen size. Text wraps automatically, components grow/shrink based on available space. The server never says "this button is 200px wide" — it says "this button fills its container."

This is actually what your React Native app already does natively. The problem is when your SDUI JSON tries to specify absolute sizes or positions, which breaks across screen sizes.

**Approach 2 — Breakpoint-based layouts (what responsive web does).** The server sends multiple layout variants for different screen size "buckets" — compact (phone portrait), medium (phone landscape / small tablet), expanded (tablet). The client checks which bucket it falls into and picks the right layout. Android's Jetpack Compose calls these "window size classes." This is heavier — the server needs to generate 2-3 layout variants, or templates need to define all variants. But it handles the phone-vs-tablet-vs-landscape problem cleanly.

**Approach 3 — Constraint-based layout (what SwiftUI and Jetpack Compose do natively).** Instead of a grid, components express constraints: "minimum width 100pt, maximum width 300pt, preferred aspect ratio 16:9." The layout engine resolves constraints at render time. This is extremely powerful but very hard to express in JSON — it's essentially a constraint solver, and AI models are bad at reasoning about constraint systems.

**Recommendation for Helm:** Use Approach 1 (Flexbox) as the foundation, with a simple column grid on top. The SDUI JSON should express layout using Flexbox semantics — row/column direction, flex-grow/shrink ratios, alignment, wrapping. On top of that, the grid system is just a convenience: "this component spans 2 of 4 columns" is really just shorthand for "flex-basis: 50%." The client renderer translates grid units into Flexbox properties.

For the phone-vs-tablet-vs-landscape problem, use a simplified breakpoint system with just 2 breakpoints:

- Compact (phone portrait, <600pt width): 4-column grid
- Regular (phone landscape, tablet, anything wider): 8-column grid

Templates define both layouts. When the AI generates custom layouts, it only needs to specify the compact layout — the regular layout auto-expands (e.g., 2 columns on compact becomes 4 columns on regular). This is a sensible default that the AI doesn't need to think about.

No absolute pixel values anywhere in the SDUI JSON. All sizing is relative (percentages, flex ratios, grid column spans). Text sizes use a semantic scale (small, body, title, headline) that the client maps to actual point sizes based on device and user accessibility settings.

Pushed back on assumptions:

- The "text fits here but looks shit there" problem is mostly solved by Flexbox. If the SDUI spec never allows absolute pixel widths and always uses flex-based layouts, text naturally wraps and containers naturally resize. Edge cases: (1) fixed-aspect-ratio components like images or calendars (solution: set aspect ratio, not pixel size), (2) long text in small containers (solution: line-clamp with ellipsis).
- Horizontal screens are not as hard as you think. Flexbox + 2-breakpoint system means rotating the phone just triggers a re-layout. Components reflow. No new JSON needed from the server.
- The actually hard problem is not layout — it's component behavior at different sizes. A calendar component at full-screen width can show a month grid. At half-width, it can only show a week strip. The component itself needs to know how to render at different sizes. This is called "adaptive components" and it has to be baked into the native component code, not the SDUI JSON. Templates can encode this (e.g., "calendar-compact" vs "calendar-full" are different component variants), but the AI needs to pick the right variant for the available space.

On the user-approval flow (Q3 answer): When the AI creates or significantly modifies a module layout, the module enters a "draft" state. The user sees a preview (maybe a modal or a special "draft" badge on the tab). They can:

- Approve → layout goes live
- Reject with feedback → their text feedback gets sent back to the AI as context for the next attempt (counts against the 2-retry budget)
- Reject and revert → falls back to template

This makes it transparent: the user sees exactly what the AI produced, they control whether it goes live, and if it's bad, they know it's the AI's output, not Helm's platform. The user's feedback is way more useful than a generic validation error — "the calendar is too small, make it bigger" is actionable for the AI in a way that "VALIDATION_ERROR: component exceeds bounds" is not.

Questions:

1. Flexbox + 2-breakpoint system (compact/regular) — does that feel like the right level of complexity? Or simpler (just Flexbox, no breakpoints) or more complex (3+ breakpoints)?
2. Adaptive components — should component variants (calendar-full, calendar-compact) be hardcoded in the app binary? Or should the server define how a component adapts?
3. The draft/preview flow — should every AI layout change go through approval, or only "big" changes (new module creation, major restructure)?

---

**Barry:** 1. Yes I like that, but there are still many problems. Since we have 2 break points that will cause unnecessary amounts of more work that can't really be solved easily. Maybe the user just wants it to work for their tablet or something. Like we can make some marketplace guidelines and show compatibility issues overall. But it's very tricky system. Tbh, let's not think about this, and let's dig down the more specifics of the other part of things which is what components we hardcode first for the next update, and how are we going to have all the grid things.

1. I think these component variants be hard coded is the best option. Showing a calendar on the phone is always really annoying because you just have 0 real estate. Hard coded be best for now. Then if they want they can make custom components.
2. I'd say all through approval. Of course there can be the skip approval or auto approval and things like that. Just need that human in the loop thing of some sort I think.

---

**Jarvis:** Proposed the component catalog in 4 tiers:

**Tier 1 — Structural components (the grid skeleton):**

- Container / Row / Column — Flexbox primitives. "Span 2 of 4 columns" = column with `flex: 2`.
- ScrollView — scrollable container. Almost every module needs this.
- Spacer — pushes things apart. Simple but critical.

**Tier 2 — Atomic components (the bricks):**

- Text — semantic sizing (caption, body, title, headline). No pixel font sizes. Markdown formatting.
- Button — variants (primary, secondary, outline, ghost). Has an `action` binding.
- Image — aspect-ratio-based sizing. URL source.
- TextInput — single line and multiline. "Send message" = TextInput + Button in a Row.
- Icon — fixed icon set (SF Symbols or Lucide).
- Divider — horizontal line.

**Tier 3 — Composite components (pre-built smart blocks):**

- Calendar — Compact = week strip, Full = month grid. Hardcoded rendering logic.
- List — scrollable list of items. Each item is a child component. Supports pull-to-refresh.
- Card — bordered/shadowed container for grouping. Can have child components.
- Chat — streaming chat interface. Needs WebSocket integration.

**Tier 4 — Data-bound components (need data pipeline first):**

- Form — input fields that write back to a data source.
- Chart — bar, line, pie.
- Map — needs location data. Probably skip for now.

Highlighted the biggest gap: the action system. The AI Technical Reference doc from the codebase lists "SDUI actions never execute" as a known gap. Without actions, buttons are just rectangles, list items can't navigate, forms can't submit.

Proposed minimum action types: navigate (switch module/tab), call_tool (invoke MCP tool), open_url (open link), refresh (re-fetch data), submit_form (collect inputs, send to backend).

Proposed grid system Flexbox properties for structural components: direction, flex, align, justify, wrap, gap (semantic: none/xs/sm/md/lg), padding (semantic). Grid shorthand: gridColumns (e.g. 4), columnSpan (1-4). Client translates columnSpan into flex-basis percentage. No pixels anywhere.

Questions:

1. Action system priority — should it be #1 for next update?
2. Component tiers build order — does it make sense? Reorder anything?
3. Action types — should `call_tool` (MCP) be how UI talks to the agent? Or simpler "send message to chat" action?

---

**Barry:** I think I can agree with the 4 tier stuff and those are fine I agree.

Wait what do you mean my AI technical reference doc says SDUI actions never execute. What does that mean. I don't remember saying that. I just need something that is Apple ToS compliant. OK back to this action problem. Of course I need the action system, yes it should be #1 priority for all of these.

And what you have right now I think it's alright. This is the client side code.

1. Yes #1 priority.
2. I think this makes sense. I mean a component can take up multiple "cells" on the grid right? So I don't think there needs to be reordering. We just build this one by one.
3. Sure? I'm confused about this. I think this application on its own really doesn't need AI. Like AI is only the editor + like a part where you can access the agent somehow (so the chat function). Other than that all these buttons can be defined itself. It can be client side buttons or server side buttons. Client side buttons could be for like changing a page, going to another module, things like that. Server side buttons could be buttons that call a function in the server side. Could be a refresh button that pulls in the updated information, could be sending a request to the AI, who knows. That's the difference I think.

I'm a bit confused overall but the current architecture works.

---

**Jarvis:** Clarified the "SDUI actions never execute" line — it's from `AI-TECHNICAL-REFERENCE.md` in the repo's `docs/codebase-explanation` folder, listed under "Known Gaps & Limitations" as description of current code state, not a design choice. Buttons render visually but tapping them does nothing — the action handlers all just `console.log`.

Validated Barry's client-side vs server-side action split as the clearest architectural insight of the session:

- **Client-side actions:** navigate, go_back, open_url, toggle, copy_to_clipboard (no server call)
- **Server-side actions:** api_call (hit backend endpoint), send_to_agent (route to AI chat)
- **Key insight:** The app doesn't need AI to function. AI is only (1) the editor that builds modules and (2) a chat interface.

Pushed back on raw API calls — server-side actions should reference **named functions** registered on the backend (not arbitrary URLs) for security. Backend needs a function registry.

Asked: (Q1) Named functions vs raw API endpoints? (Q2) Does backend function registry exist yet? (Q3) Ready to shift topics or keep going on action system?

---

**Barry:** 1. I'm confused. I don't know what you mean. If it's more safer and more portable choose that. I'm just confused so please explain. This is detailed stuff.

1. I don't know how my code works right now. It's all vibe coded and I don't have experience in terms of RN. I guess it would be new. Go read the code.
2. You know what. The components are sort of already there, and we already gotten most of it. The action system we just need to get to more detail.

One thing to reemphasize. I think instead of calling an Agentic AI super app, it's better for it to be called something else. This entire project is just a self hosted SDUI solution where editing is very easy thanks to AI. You can easily deploy your application and what you want, and your connection to OpenClaw easily from here by connecting an MCP server to it. This entire system isn't dependent on AI, but AI made it easier, it just completes the last part of the loop which is pushing your application out from AI to mobile without using the annoying webapp. Plus it would support notifications and all the possible Apple stuff. (perhaps even screentime control) who knows.

---

**Jarvis:** Read the codebase — `sdui.ts`, `mcp/tools.py`, `routers/modules.py`, and `AI-TECHNICAL-REFERENCE.md`.

**Q1 — Named functions vs raw endpoints explained:**

Current `sdui.ts` has `api_call` with raw `method`, `path`, `body` — the SDUI JSON literally contains the URL to hit. Problem: nothing stops the AI (or bad actor) from writing any URL. Named functions fix this — instead of `{ type: 'api_call', path: '/api/calendar/events' }`, use `{ type: 'server_action', function: 'refresh_calendar' }`. Backend has a registry (whitelist) of allowed function names. Safer (whitelist, per-module scoping) and more portable (change backend URLs in one place, AI only knows function names). **Named functions is the right call.**

**Q2 — Current code state after reading:**

- `POST /api/modules/{module_id}/action` exists but is a complete stub — returns `{"status": "ok"}`, does nothing.
- `sdui.ts` defines 6 action types: navigate, api_call, dismiss, open_sheet, copy_text, open_url.
- **None of them work.** Every `onAction` handler is `console.log`. Buttons render but do nothing.
- `mcp/tools.py` has 16 tools but none are callable from SDUI actions — only from AI chat or MCP.
- Function registry does not exist. Entirely new work. Stub endpoint is there.

**Q3 — Concrete action system spec:**

Client-side actions (no network, handled in RN):

| navigate | Switch to another module/tab |
| --- | --- |
| go_back | Return to previous screen |
| open_url | Open link in system browser |
| dismiss | Close modal/sheet |
| open_sheet | Open bottom sheet with SDUI content |
| copy_text | Copy to clipboard |
| toggle | Show/hide section locally |

Most already typed in sdui.ts. Need onAction handler to dispatch instead of console.log.

Server-side actions (hit backend):

| server_action | Call named function on backend (replaces api_call) |
| --- | --- |
| send_to_agent | Send message to AI chat |

Function registry — new backend component. Simplest version: a dict mapping function names → handlers + allowed modules + param schemas. Templates register their own functions when installed (calendar template registers refresh_calendar, create_event, delete_event).

**On the reframe:** Agreed. "Agentic AI Super App" oversells AI dependency and undersells the product. Better framing: **A self-hosted SDUI platform with AI-assisted editing.** System works without AI. AI is the editor + chat interface. Value over webapp: push notifications, offline, native Apple features, MCP connection to OpenClaw. Value over native app: don't need Swift/Kotlin, SDUI renders natively from JSON.

Asked: (Q1) Function registry starter set — refresh_data, submit_form, send_to_agent enough? (Q2) Should templates bundle their own backend functions or use generic shared functions? (Q3) Delete `api_call` type in sdui.ts and replace with `server_action`, or keep as deprecated fallback?

---

**Barry:** 1. Oh I see you mean these "server side" functions that I can call. Let's brainstorm about it. I think refresh data, submit form, send to agent is necessary. (Actually why do I need a form, it's not a survey or anything if you get what I mean). I think we can define more in the backend. That's the main thing. After all we are basically building a platform for more SDUI to run on. We can have a few to verify if the AI is working.

1. I think the templates can all have their own.
2. I don't know about it though. If it's not needed we don't need it. I'm still a bit confused about it.

In addition, how does authentication work? Can't a malicious actor just send a request to the API server and then they will have access to it? Does a token or API key get sent. How does this work? Client ID. What is the situation right now from what you see.

---

**Jarvis:** Addressed Q1-Q3, then deep-dived into auth.

**Q1 — submit_form clarification:** "Form" here means any time user fills inputs and sends data to backend — not surveys. E.g., TextInput + Send button, settings save, event creation. Could call it `submit_inputs` or `send_data`. But for MVP starter set, just need 2: `refresh_data` and `send_to_agent`. `submit_inputs` comes when TextInput components are wired up. Real power is templates bringing their own functions (calendar template → refresh_calendar, create_event, delete_event).

**Q2 — Templates bundle their own functions.** Agreed.

**Q3 — Delete `api_call` from sdui.ts.** Replace with `server_action`. Nothing uses api_call right now (all handlers are console.log), so nothing breaks. No need for deprecated fallback.

**Authentication — current code state:**

1. Setup: User opens app → enters server URL + username/password → `POST /auth/setup` creates user with bcrypt hash.
2. Login: `POST /auth/login` → backend verifies password → creates Session row with JWT token + expiration → returns token.
3. Every request: App sends `Authorization: Bearer {token}` header. Backend's `get_current_user()` checks Session table: token exists, is_active=True, not expired. If no → 401.
4. WebSocket: Token passed as query param `ws?token=...`
5. MCP: Own auth middleware reads Bearer token, sets user context.

**Answer: Yes, a token is sent with every request. Without the token, you get 401'd on everything except /health, /auth/status, /auth/setup, /auth/login.**

**Security problems found:**

1. No rate limiting on login — brute force possible.
2. `POST /auth/setup` is wide open — anyone who knows server URL can create a user. No lockout after first user.
3. CORS is `allow_origins=["*"]` — every origin can make requests.
4. Frontend logout doesn't invalidate backend session — stolen token stays valid until expiry.
5. Token in WebSocket URL appears in server logs/proxy logs.
6. No HTTPS enforcement.

For self-hosted single-user on local network, current auth is functional. For public internet, problems 1-4 need fixing. Problem 2 is most urgent.

**Action system + auth connection:** `POST /api/modules/{module_id}/action` already includes auth token. Backend validates token, identifies user, runs function for that user's data only. Function registry is already scoped to authenticated users. Need to also check per-module ownership.

Asked: (Q1) Lock `POST /auth/setup` after first user? (Q2) Server-side actions scoped to user only, user+module, or more granular? (Q3) Is auth a priority to fix now or later?

---

**Barry:** Yes sure I am fine with that. Submit form sounds about right. We just need some to test it out.

Sure then let's delete it. I don't think it's needed anyways.

Regarding security. I agree problem 1 and 2. That needs to be restricted. I think that should be just eliminated and only from the backend you can create users. Maybe an admin panel in the backend of some sort and later this is where the visual editor will also be at.

I'm a bit confused about problem 3. What do you mean by that. I think we should still have some sort of device ID type of thing because I do want multi device interaction of some sort.

All of these problems are problems, and I want you to take note of them.

Regarding the action system — which is why I'm suggesting a multi device system. I wouldn't expect more people having the same backend because that is kind of chaotic but it's doable. Main thing is different devices. The backend can send the same stuff to different device ID but also maybe different stuff to different device ID. There needs to be clear routing for these.

1. I think yes, or even, I think it should be more like only backend can create users.
2. I'm confused about this. I think I answered it above.
3. Not a priority. I want the thing working now.

---

**Jarvis:** Clarified problem 3, addressed multi-device, pushed back on user creation.

**Problem 3 (CORS) clarified:** CORS is a browser-only security feature — controls which websites can talk to the API. `allow_origins=["*"]` means any website can make requests. Has zero impact on mobile apps (React Native doesn't use CORS). Only matters when the web editor ships. Low priority — note it, fix later.

**Multi-device architecture:**

Current code has a `devices` table and WebSocket manager, but WS sends to all connections for a user_id — no device distinction. Barry wants: one user, multiple devices. Backend should send same or different SDUI JSON per device. Recommendation: single layout + client adapts via Flexbox for now (same JSON, different screens). Per-device server-side layouts is a later optimization. But device routing infrastructure (knowing which device, targeted WS messages) should be designed in from the start. `devices` table exists, just needs wiring into WS manager.

**Pushback on "only backend can create users":**

If POST /auth/setup is removed entirely, how does the first user get created? Options:

1. CLI command — `python manage.py create_user` on the server. No HTTP endpoint.
2. Admin panel — but admin panel itself needs auth (chicken-and-egg).
3. First-run setup only — POST /auth/setup works exactly once (when zero users exist), then permanently locks. Additional users through admin panel.

Recommended option 3 as cleanest.

Asked: (Q1) Multi-device: same JSON, client adapts? Or per-device layouts from day one? (Q2) First user bootstrap: option 3 (setup works once then locks) or CLI? (Q3) Ready to wrap up session and compile Key Decisions + Action Items?

---

**Barry:** OK then CORS isn't that useful and not applicable I guess?

1. Yes. Client adapts via Flexbox I guess. We can then give like different device ID different stuff.
2. Yes CLI on the server. We don't need to tackle this for now that's the next step.
3. I think it's good enough yeah. Put in the top of the doc.

---

**Jarvis:** Session wrap-up. Confirmed: CORS is browser-only, not applicable to mobile app. Multi-device: same JSON, client adapts via Flexbox; per-device routing designed in but per-device layouts deferred. First user: CLI on the server. Auth fixes deferred — get it working first. Compiled Key Decisions and Action Items at top of document.