# Session 1 — 2026-03-23 — Blueprint Gap Analysis for Vibe Coding Production

### Key Decisions

| # | Decision | Choice |
| --- | --- | --- |
| 1 | Architecture | 3-layer: iOS SDUI renderer + Python backend + MCP server |
| 2 | AI agent | External only. No built-in agent. Universal frontend. |
| 3 | Communication | Channel 1: OpenAI-compat API (backend→agent, chat). Channel 2: MCP (agent→backend, tools). |
| 4 | Navigation | 4 customizable bottom tabs + Module Center (5th tab, iOS-style icon grid). Alt: sidebar drawer mode. |
| 5 | MVP components | Chat (2-way streaming), Calendar, Form/Input, Notification/Alert, Settings |
| 6 | Design | Notion-like, minimal, light mode only for MVP |
| 7 | Default screen | Chat (user-configurable) |
| 8 | Auth | Required. Token-based for MVP. Multi-device aware (per-device configs). |
| 9 | Workflow engine | Generic (simple automations + multi-step + AI-scheduled). Agent implements. |
| 10 | Deployment | Self-hosted Docker |
| 11 | Backend | Python + FastAPI |
| 12 | Database | SQLite via SQLAlchemy ORM (swappable to Postgres via config change) |
| 13 | Real-time sync | Hybrid: WebSocket for chat (mandatory), pull-to-refresh for other modules (MVP). WebSocket push + JSON validation as later upgrade. |
| 14 | Error handling | Show errors in UI. One agent, one workspace per server for MVP. |
| 15 | Spec format | 3 separate documents: Frontend, Backend, Protocol |
| 16 | First-launch | Enter server URL → auth (token) → empty workspace → template or blank |
| 17 | Future protocols | A2A for richer agent-to-agent communication post-MVP |
| 18 | External services | Post-MVP addon. Backend architected with plugin/connector system. |

### Action Items

- [ ]  **Write Frontend Spec** — screens, navigation, SDUI component catalog, first-launch flow, design direction
- [ ]  **Write Backend Spec** — FastAPI endpoints, SQLAlchemy models, auth flow, MCP server, workflow engine, Docker deployment
- [ ]  **Write Protocol Spec** — OpenAI-compat API integration, MCP tool definitions, WebSocket message format
- [ ]  **Buy Apple Developer Account ($99)** — only when MVP is feature-complete, not before
- [ ]  **Update Architecture & Tech Stack page** with finalized decisions from this session

---

### Transcript

**Barry:**

What are the next steps for building this app in RN. Like what is missing from the blueprint to build this thing. The blueprint should be detailed enough to be directly sent to the vibe coding agent for full production. Let's brainstorm (session 1, put in brainstorm sub page)

**Jarvis:**

I went through the Project Hub, Architecture & Tech Stack page, and all existing research. Here's my gap analysis — what's missing before this blueprint is "hand it to a vibe coding agent and walk away" ready.

**The big picture:** You have the *what* and the *why* nailed. What's missing is the *how* — technical specifications precise enough that an AI agent can write code without asking questions.

**10 gap categories identified:**

**Gap 1 — Project Scaffolding Spec**

No spec for: Expo template choice, folder structure, dependency list, TS config. A vibe coding agent's first question will be "what do I `npx create` and how do I organize files?"

**Gap 2 — SDUI Renderer Engine (THE critical missing piece)**

You described what components to render but not HOW the renderer works:

- Component registry pattern (how does `"calendar_card"` in JSON map to `<CalendarCard />` in RN?)
- Exact JSON schema per component (TypeScript interfaces with required/optional props)
- Nested component support (can a component contain other components?)
- Error/fallback handling (unknown component type? malformed JSON?)
- Layout engine (how are multiple components arranged on a screen?)

**Gap 3 — AG-UI Protocol Client**

You chose AG-UI but there's no spec for the RN client implementation:

- WebSocket connection lifecycle (connect, auth, reconnect, heartbeat)
- Event parsing pipeline
- How each event type (text, tool_call, state_update, ui_component) gets dispatched to the UI
- Offline/buffering behavior

**Gap 4 — Navigation & App Shell**

No routing architecture defined:

- Expo Router vs React Navigation?
- Tab bar? Drawer? Stack navigation?
- How does the "workspace/home screen" work as a screen?
- Deep linking?

**Gap 5 — State Management**

No state architecture:

- What library? (Zustand is probably the right call for RN)
- What's in global state vs local component state?
- How does agent shared state sync work?
- Local persistence layer?

**Gap 6 — Backend API Contract**

The backend is described conceptually but there's no API contract:

- REST endpoints for config/auth/setup
- WebSocket protocol for real-time agent communication
- Request/response TypeScript types
- Error response format
- Service connector plugin interface definition

**Gap 7 — Auth & Security**

Zero spec on:

- How does the app authenticate with the backend?
- OAuth2 flow for connecting services (Google Calendar, etc.) from mobile
- Where are tokens stored? (Keychain/Keystore via expo-secure-store)
- Server URL configuration (first-launch setup flow)

**Gap 8 — Design System / Visual Spec**

A vibe coding agent can't design. It needs:

- Color palette, typography scale, spacing tokens
- Component dimensions and visual specs
- Dark mode strategy
- Loading/error/empty state designs for each component

**Gap 9 — TypeScript Data Models**

No type definitions for:

- SDUI component payloads
- AG-UI event types
- App configuration
- User/workspace/service connection models

**Gap 10 — DevOps & Config**

- EAS Build config (eas.json, app.json)
- Environment variable strategy
- Docker Compose for backend
- Git repo structure (monorepo? separate repos?)

---

**Questions for Barry:**

**Q1:** Which of these gaps do you want to tackle first? I'd argue #2 (SDUI renderer) and #6 (backend API contract) are the two that everything else depends on — get the JSON schema right and everything flows from there.

**Q2:** For the design system (#8) — do you have a visual direction in mind, or should we define a minimal design system that the vibe coding agent can work with? (Think: "looks like Notion" vs "looks like Linear" vs "material design" vs something custom.)

**Q3:** Do you want the blueprint to be a single mega-document, or split into per-layer specs (backend spec, protocol spec, frontend spec)?

**Barry:**

1. I am unsure, I don't know about technical stuff. I can focus more on architecture, less on protocol stuff. Those I think require the AI Agent to do themselves. and do research
2. I think I want something simplistic. Looks like Notion could be a good way to go. Just like the simple feeling of everything. This is for MVP so let's go with this first
3. Of course split layers.

**Jarvis:**

Good — this clarifies the division of labor. Let me reframe the whole approach.

**The key insight:** The blueprint has two types of gaps:

- **Architecture gaps** — product/UX decisions only Barry can make (what screens exist, what components ship, how the home screen works, what the first-launch experience is). These MUST be in the blueprint because the vibe coding agent can't guess your product vision.
- **Implementation gaps** — technical choices the vibe coding agent can research and decide itself (which state management library, WebSocket reconnection patterns, AG-UI event parsing, OAuth2 implementation patterns). These should be LEFT OUT or marked as "agent decides" — over-specifying here just constrains the agent unnecessarily.

**Revised gap priority — what WE need to define in this brainstorm:**

Gap 2 (SDUI renderer) → Split into: architecture (Barry) + implementation (agent)

Gap 4 (Navigation & App Shell) → Mostly Barry — this is product/UX

Gap 6 (Backend API) → Split: what endpoints exist (Barry) + how they're built (agent)

Gap 7 (Auth) → Split: what the UX flow is (Barry) + how it's implemented (agent)

Gap 8 (Design) → Decided: Notion-like, simplistic, MVP. Agent can research Notion's design tokens.

Gaps 1, 3, 5, 9, 10 → Agent handles. We just need to mention them as "agent researches and decides."

**So the three spec documents we'll produce:**

1. **Frontend Spec** — screens, navigation, SDUI component catalog with props, home screen UX, first-launch flow, design direction
2. **Backend Spec** — endpoints, service connector list, what the agent can do, deployment model
3. **Protocol Spec** — marked as "agent researches AG-UI and implements" with minimal constraints

**Design direction locked in:** Notion-like. Clean, minimal, lots of white space, subtle borders, rounded corners, SF Pro or system font. MVP = light mode only, dark mode later.

---

**Questions — drilling into the architecture YOU need to decide:**

**Q4:** Walk me through the app from a user's perspective. You download it, open it for the first time. What do you see? What do you tap? What happens next? (This defines the screen flow and first-launch experience.)

**Q5:** On the home screen / workspace — how do you imagine it? Options:

- (A) A scrollable feed of cards the agent generates (like a news feed)
- (B) A grid of widgets you arrange yourself (like iOS home screen)
- (C) A single chat interface with rich cards inline (like ChatGPT but with native UI cards mixed in)
- (D) Something else?

**Q6:** For MVP — the 3-4 SDUI components. Current list is: calendar card, chat view, list view, simple chart. Keep this list, swap anything, or add one more?

**Barry:**

1. I think when you download it and open it there needs to be an endpoint server. This is sort of where the log in comes in. This is 2 parts. The frontend and the backend. The frontend is the app, and the backend is the endpoint server that the AI can access through an MCP. So TLDR it's frontend (iOS), backend (endpoint server, where all the updates come from, basically if the mobile client will sync their update it's from this server. This should also have workflow functionality, and also ability to connect with other apps), MCP server (bridge for the AI agent to access this).

The iOS app opens with asking for server URL. Then the next step is completely up to the user to create. We can have some usable templates that they can do. But I think the main idea is that there is a way to choose from different bars. We can start with the implementation of a chat based UI, calendar place, and maybe a place. Only 2 parts for now. We need to basically code all the code and the only way needed to update it is through the backend server sending JSON files over. I think the list view and simple chart would work (I can't think of their use though). Let's have that too. Anything more?

**Jarvis:**

This is a major architecture clarification. Let me play it back to make sure I've got it right, then push on the parts that are still fuzzy.

**What I heard — revised 3-layer architecture:**

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────┐
│  iOS App (RN)   │◄───►│   Backend Server      │◄───►│  MCP Server  │
│                 │     │                       │     │  (bridge)    │
│  Pure SDUI      │JSON │  - Data storage/sync  │MCP  │              │
│  renderer       │◄────│  - Workflow engine     │◄────│  AI Agent    │
│                 │     │  - App connections     │     │  connects    │
│  Displays what  │     │  - Pushes JSON configs │     │  here        │
│  server tells   │     │    to mobile client    │     │              │
│  it to display  │     │                       │     │              │
└─────────────────┘     └──────────────────────┘     └─────────────┘
```

**Layer 1 — iOS App (React Native / Expo)**

- Pure SDUI renderer. Dumb client. Displays whatever JSON the server sends.
- First screen: "Enter your server URL" → connects to backend
- After connecting: user sees their workspace, can customize with templates
- "Bars" = navigable sections/tabs the user picks from
- Ships with all component types pre-built. Server only sends layout + data.

**Layer 2 — Backend Server (the brain)**

- The source of truth for ALL data and UI state
- Pushes JSON layout configs to the mobile app
- Handles sync — if user updates something on the app, it syncs back here
- Workflow engine — automations, triggers, scheduled actions
- App connections — connects to external services (Google Calendar, email, etc.)
- Self-hosted (Docker) — users run their own instance

**Layer 3 — MCP Server (AI bridge)**

- Exposes the backend's capabilities as MCP tools
- Any AI agent with MCP support (Claude, GPT, local LLMs) can connect
- AI can: read data, push UI updates, trigger workflows, manage app connections
- This replaces AG-UI as the protocol layer — MCP is already a widely adopted standard

**Key architecture shift from previous plan:** AG-UI is OUT. MCP is IN. This is actually cleaner — MCP is a mature, widely adopted protocol. Any AI agent that supports MCP can control the app. You don't need to build a custom protocol client. The MCP server is a standard bridge.

**First-launch flow:**

1. Open app → "Enter server URL" screen
2. Connect to backend server
3. Empty workspace → choose a template OR start blank
4. User picks which "bars" (tabs/sections) they want
5. Each bar is a screen type (Chat, Calendar, etc.)

**MVP components confirmed (4):**

1. **Chat UI** — conversational interface
2. **Calendar** — events/schedule display
3. **List view** — generic lists (tasks, emails, items)
4. **Simple chart** — data visualization

---

**Where I want to push:**

**Q7:** The "bars" concept — let me make sure I understand. Is this like a bottom tab bar where each tab is a different screen (Chat tab, Calendar tab, etc.)? Or is it more like sections within a single scrollable page? Or something else entirely?

**Q8:** You said "a place" — did you mean a map/location component? Or were you just saying "a place for calendar"?

**Q9:** For "anything more" on components — here's what I think is missing from the MVP if you want the app to actually be *usable*:

- **Form/input component** — Without this, the user can only VIEW data but never INPUT data from the app. They can't create calendar events, send chat messages, fill in forms. This is critical for two-way interaction. You need some way for the user to type/tap/select and send data BACK to the server.
- **Notification/alert card** — A way to surface important info ("You have a meeting in 10 minutes")
- **Settings/config screen** — Not really a component but the app needs a way to manage server connection, connected services, etc.

Do you agree the form/input component is a must for MVP? Without it the app is read-only.

**Q10:** The backend's "workflow functionality" — what do you mean by this? Like:

- (A) Simple automations: "When X happens, do Y" (like IFTTT/Shortcuts)
- (B) Multi-step workflows with conditions and branching
- (C) Just the AI agent doing things on a schedule
- Or something else?

**Barry:**

I'm still a bit confused about how would I access the AI agent remotely. Is it similar to an API where I need an API and have an endpoint and all of these streams come through or what?

1. Like WeChat or Instagram they have those at the bottom. The problem is that this isn't that flexible and if I want more than 5 it will be very crowded and looks bad. There needs to be other ways to do this, ways of accessing different modules.
2. A place for the calendar? Idk.
3. Yes this has to be 2 way. Of course. Notification alert card is good. I think we can add that too. Maybe remove the lists and charts. So calendar (+ alert warning) and chat so far. Form input must be for MVP for sure. And also setting screen ofc. But this can be a small button on the top right corner.
4. Any, suited for users use. So ABC all works.

**Jarvis:**

Good questions. Let me take the AI agent one first because it's foundational — it actually reveals a missing architecture decision.

---

**THE AI AGENT QUESTION — WHERE DOES IT LIVE?**

You're right to be confused because there's actually a gap in the architecture. The 3-layer diagram has an "MCP Server (bridge)" but doesn't answer: **where is the AI agent actually running?**

Here are the three options:

**Option A — AI agent lives INSIDE the backend server**

```
User taps in Chat (iOS)
    ↓
iOS app sends message to Backend Server
    ↓
Backend's BUILT-IN AI agent processes it
    (calls LLM API: Claude/GPT/local model)
    ↓
Agent reads data, updates things, generates UI
    ↓
Backend pushes JSON update to iOS app
    ↓
User sees the response + updated UI
```

Pros: Simplest for end users. Just run the server, everything works. The AI agent has direct access to all backend data — no MCP needed for internal operations.

Cons: Backend is more complex to build.

**Option B — AI agent is EXTERNAL (user brings their own)**

```
User configures Claude Desktop / ChatGPT / local LLM
    ↓
External AI connects to your MCP Server
    ↓
MCP Server exposes tools: read_calendar(), send_message(), update_ui(), etc.
    ↓
AI uses tools → MCP translates to Backend API calls
    ↓
Backend pushes JSON update to iOS app
```

Pros: Backend is simpler (just data + MCP). Users choose their own AI.

Cons: Users need to set up their own AI agent separately. Chat in the iOS app becomes tricky — how does typing in the app reach the user's Claude Desktop?

**Option C — HYBRID (recommended for MVP)**

```
Backend has a BUILT-IN agent (for chat + basic operations)
    +
MCP Server ALSO exists (for power users + external AI agents)
```

This means:

- Normal users: just run the server, chat works out of the box via the built-in agent
- Power users: connect Claude Desktop or custom agents via MCP for advanced workflows
- The built-in agent uses the same MCP tools internally (dogfooding the protocol)

**My recommendation: Option C for MVP, but build Option A first.** Get the built-in agent working (user chats in app → backend agent responds). Then expose those same capabilities as MCP tools. The MCP layer becomes a v1.1 feature, not MVP.

**To directly answer your question:** Yes, it's like an API. The backend server has an endpoint (WebSocket or HTTP) that the iOS app connects to for real-time communication. The AI agent is a process running on that same backend server. When you type in the chat, your message goes to the backend over that connection, the agent processes it (calls an LLM API like Claude's API), and sends the response back. You need an LLM API key (Claude, OpenAI, etc.) configured on the server. The MCP part comes later for external agent access.

---

**Q7 RESPONSE — NAVIGATION BEYOND BOTTOM TABS**

You identified a real problem. Bottom tabs max out at 5 (iOS guideline) and get crowded. Here are proven patterns for apps with many modules:

**(A) Customizable bottom tab bar + "More" menu**

User picks their 4 favorite modules for the bottom bar. Everything else goes in a "More" tab (5th position) that opens a full list. Instagram does this with the "..." overflow.

**(B) Sidebar drawer (swipe from left)**

Like Discord, Slack, Gmail. A sliding panel shows all modules. Bottom tabs show 3-4 most used. This is probably the most flexible option.

**(C) Home screen with module cards**

No bottom tabs. The home screen IS the navigation — a grid/list of module cards. Tap one to open it full-screen. Back button returns to home. Like a phone's app drawer.

**(D) Hybrid: Home screen + customizable bottom bar**

Home screen shows all modules. Bottom bar has 3-4 user-chosen modules for quick access. Best of both worlds. This is what WeChat actually does if you count the Discover page.

For MVP, I'd suggest **(D)** or **(B)** — they scale to unlimited modules without redesigning the navigation later.

**Q8:** Dropped. Moving on.

**Q9 RESPONSE — REVISED MVP COMPONENT LIST**

Locked in:

1. **Chat UI** (2-way — user types, agent responds, rich cards inline)
2. **Calendar** (events display + creation)
3. **Notification/Alert cards** (surfaced within chat or as a dedicated feed)
4. **Form/Input component** (generic data entry — text fields, dropdowns, date pickers, toggles)
5. **Settings** (top-right button → opens settings screen: server URL, API key, connected services)

Lists and charts → dropped from MVP, added to backlog.

**Q10 RESPONSE:** Workflow engine supports all types (A/B/C). For the spec, we'll define it as a generic workflow engine and let the vibe coding agent implement it. The AI agent can orchestrate workflows too.

---

**New questions based on your answers:**

**Q11:** For the AI agent (Option C hybrid) — do you agree with "build the built-in agent first, add MCP later"? Or do you want MCP from day one?

**Q12:** Navigation — which pattern appeals to you: (A) bottom tabs + More, (B) sidebar drawer, (C) home screen grid, or (D) home screen + bottom bar hybrid?

**Q13:** The Chat UI is clearly the primary interface. Should the app open DIRECTLY to the chat screen after first-launch setup? Or should it open to a home/dashboard screen with chat as one of the modules?

**Barry:**

1. Uh I think the main thing is, I don't want it to have a built in agent, because it's supposed to connect to people's own agents or like OpenClaw. That's the use of this rather than building an agent from scratch. So what is the standard protocol for interacting with Agentic AI. Can I really just access them through an API. I didn't really understand what you were explaining b4. The MCP is mainly for the external AI agent to edit the UI so yes.
2. What if we make 2 and make the user able to choose which 1? We can have it default for home tabs and maybe at the bottom there is a button u can click and u open an app store like thing.
3. ALSO depend on the user. I think it can be by default go to the chat.

**Jarvis:**

OK this is the most important clarification yet. No built-in agent. The app is a **universal mobile frontend that any external AI agent can control.** Let me explain exactly how the communication works, because I did a bad job explaining it before.

---

**HOW THE APP TALKS TO EXTERNAL AI AGENTS — EXPLAINED SIMPLY**

There are **TWO separate communication channels**, going in opposite directions:

**Channel 1: Backend → Agent ("Hey, user said something")**

When the user types in chat or taps something, the backend needs to SEND that to the external AI agent. This uses a standard API call.

Most AI agents and services expose an HTTP API. The dominant standard is the **OpenAI-compatible chat API** (`/v1/chat/completions`). Almost every AI service speaks this format:

- OpenAI (GPT)
- Anthropic (Claude)
- Local models via Ollama, vLLM, LM Studio
- OpenClaw
- Most custom agents built with LangChain, PydanticAI, CrewAI, etc.

So in your settings, the user configures:

- Agent API URL (e.g., `https://api.openai.com/v1` or `http://localhost:11434` for local Ollama)
- API key
- Model name

The backend just forwards the user's message to that endpoint and streams the response back. This is a standard REST/streaming API call.

**Channel 2: Agent → Backend ("I want to update the calendar / change the UI")**

This is where MCP comes in. The backend runs an MCP server that exposes tools like:

- `update_ui()` — push new JSON layout to the mobile app
- `read_calendar()` — get calendar data
- `create_event()` — add a calendar event
- `send_notification()` — push an alert to the user

The external AI agent connects to this MCP server and calls these tools when it needs to DO something.

**The complete flow for a chat message:**

```
1. User types "What's on my calendar today?" in the iOS app
2. iOS app sends message to Backend Server (WebSocket)
3. Backend forwards message to External AI Agent (OpenAI-compatible API call)
4. AI Agent receives message, thinks, decides to check calendar
5. AI Agent calls read_calendar() on the MCP server
6. MCP server reads calendar data from backend, returns it to agent
7. AI Agent formats response + calls update_ui() with a calendar card JSON
8. Backend receives the UI update, pushes JSON to iOS app (WebSocket)
9. iOS app renders the calendar card + text response
10. User sees: "Here's your schedule for today" + a native calendar widget
```

**So to answer your question directly:** YES, you access AI agents through an API. The user configures their agent's API URL in settings. The backend calls that API with the user's messages and gets responses back. It's like how any app calls any API. The MCP part is the REVERSE direction — it's how the agent reaches back into your app to modify things.

**There's also A2A (Agent-to-Agent protocol by Google/Linux Foundation)** — a newer, more powerful protocol for agent communication that supports task management, streaming, and agent discovery. This could be a future upgrade, but for MVP, the OpenAI-compatible API + MCP combo covers 95% of use cases.

**Revised architecture diagram:**

```
┌─────────────────┐      ┌──────────────────────────┐       ┌───────────────────┐
│  iOS App (RN)   │      │    Backend Server         │       │ External AI Agent │
│                 │ WS   │                          │       │ (user's own)      │
│  Pure SDUI      │◄───►│  - Data storage/sync     │  API  │                   │
│  renderer       │      │  - Workflow engine        │────►│  Receives messages │
│                 │      │  - App connections        │       │  via OpenAI-compat │
│  Displays JSON  │      │  - Forwards chat to agent │       │  API               │
│  from server    │      │                          │  MCP  │                   │
│                 │      │  MCP Server (built-in)   │◄────│  Calls tools to   │
│                 │      │  - Exposes tools for     │       │  modify UI/data    │
│                 │      │    agent to call          │       │                   │
└─────────────────┘      └──────────────────────────┘       └───────────────────┘

Channel 1 (chat): Backend ──API call──► Agent (sends user messages)
Channel 2 (tools): Agent ──MCP──► Backend (agent modifies data/UI)
```

**Settings the user configures:**

1. Backend server URL (first launch)
2. AI Agent API URL (e.g., OpenAI, Ollama, OpenClaw endpoint)
3. AI Agent API key
4. AI Model name (optional, depends on service)
5. Connected services (Google Calendar OAuth, etc.) — managed on the backend

---

**Q12 RESPONSE — NAVIGATION: DUAL MODE**

Locked in: Two navigation modes, user chooses in settings:

- **Mode A (default): Home screen with tabs** — bottom tab bar with user's favorite modules. A button at the bottom opens a module browser ("app store" style) where they can discover and add more modules.
- **Mode B: Sidebar drawer** — swipe from left to see all modules. Main screen shows the active module.

Both modes have the "module store" accessible — a place to browse all available modules, templates, and potentially community-shared module configs.

**Q13 RESPONSE:** Default screen = Chat. User-configurable.

---

**Summary of decisions locked in this exchange:**

1. ✅ NO built-in agent. App is a universal frontend for external AI agents.
2. ✅ Two communication channels: OpenAI-compatible API (chat) + MCP (tools).
3. ✅ Dual navigation mode: home tabs (default) + sidebar option. Module browser accessible from both.
4. ✅ Default screen: Chat. Configurable.
5. ✅ A2A protocol as future upgrade path for richer agent communication.

---

**Remaining architecture questions:**

**Q14:** The "module store" / app store concept — for MVP, is this just a list of the built-in modules (Chat, Calendar, etc.) that the user can enable/disable? Or do you want it to actually download new module configs from somewhere (like a community store)?I'm asking because for MVP, a simple list of built-in modules you can toggle on/off is way simpler than building an actual store infrastructure.

**Q15:** When the user connects to their backend server for the first time (enters the URL), should there be any authentication? Like a password or token? Or is it just "enter URL and connect"? This matters for security — anyone who knows the URL could connect.

**Q16:** We've now defined the architecture for all 3 layers. Are you ready to move on to defining the actual component specs (what does the Chat UI JSON look like? What does the Calendar JSON look like?), or are there more architecture questions you want to work through first?

**Barry:**

1. Like so there are currently tabs right like WeChat and Instagram. I'm saying that because you can't fit everything in the tabs. The last item on the tabs is something you can click open to open an app center for all your modules. Basically it's a bunch of icons that you can open each module. If you get what I mean. Like the Apple iOS thing.
2. I think there should be some auth, otherwise it's too insecure. Everyone can do anything. I also want in the future have the backend server support multiple devices. So device A can have a different config compared to device B.
3. Let's finish the architecture questions first. I don't really know anything about the JSON things. So. I guess this might matter for customizability right?

**Jarvis:**

**Q14 RESPONSE — NAVIGATION FINALIZED**

Got it. Now I fully understand the navigation model. It's essentially **iOS's own pattern:**

```
┌────────────────────────────────────────────┐
│                                            │
│           Active Module Screen             │
│         (Chat, Calendar, etc.)             │
│                                            │
│                                            │
├────────┬────────┬────────┬────────┬────────┤
│  Chat  │  Cal   │ Module │ Module │  ⊞     │
│  💬    │  📅    │   3    │   4    │ More   │
└────────┴────────┴────────┴────────┴────────┘
                                       │
                                       ▼
                    ┌─────────────────────────┐
                    │     Module Center       │
                    │  (iOS App Library)      │
                    │                         │
                    │  📅 Calendar  💬 Chat   │
                    │  📝 Forms     📊 Charts │
                    │  📋 Lists     🔔 Alerts │
                    │  ... more modules ...   │
                    │                         │
                    │  Each is an icon you    │
                    │  tap to open            │
                    └─────────────────────────┘
```

**How it works:**

- Bottom tab bar shows 4 user-chosen modules + a 5th "More" button (⊞ grid icon)
- Tapping "More" opens the **Module Center** — a grid of all available module icons (like iOS App Library or the Apple Watch app grid)
- User can rearrange which 4 modules appear in the bottom bar
- Module Center is always accessible as the 5th tab
- Each module is a full-screen experience when opened

**For MVP:** The Module Center is just a grid of the built-in modules (Chat, Calendar, Forms, Notifications). No downloading, no community store. Just a clean grid of icons. Store/community features come later.

Locked in. ✅

---

**Q15 RESPONSE — AUTH & MULTI-DEVICE**

Agreed, auth is a must. Here's what the architecture needs:

**Authentication flow:**

1. User sets up backend server (self-hosted Docker)
2. During server setup: creates an admin account (username + password) or generates an API token
3. On the iOS app: enters server URL + credentials (password or token)
4. Backend validates credentials, issues a session token
5. All subsequent communication uses the session token
6. Server can revoke tokens / force re-auth

**Multi-device support (future, but architect for it now):**

- Each device registers with a unique device ID when it connects
- Backend stores per-device configs: which modules are in the tab bar, layout preferences, notification settings
- Shared data (calendar, chat history) is the same across devices
- Per-device data (UI layout, active module, notification preferences) is device-specific
- The user account is the same — just the device config differs

**What this means for the spec:**

- Backend needs a `devices` table: device_id, device_name, config_json, last_seen
- Backend needs a `users` table: user_id, credentials, role (admin/user)
- Auth endpoints: `/auth/login`, `/auth/register`, `/auth/refresh-token`
- Each WebSocket connection is authenticated with the session token
- MCP connections also need auth (the external AI agent needs a token too)

Locked in: Auth required. Multi-device aware from day one (even if MVP is single-user). ✅

---

**Q16 RESPONSE — REMAINING ARCHITECTURE QUESTIONS**

You're right that the JSON component specs matter for customizability — they define WHAT the agent can tell the app to display and HOW flexible each component is. But that's more of an implementation detail the vibe coding agent can handle. We'll give it guidelines ("components should be highly customizable via JSON props") and let it design the schema.

Let me check what architecture decisions are still open:

**What's been decided:**

- ✅ 3-layer architecture: iOS app (SDUI renderer) + Backend server + MCP server
- ✅ No built-in agent — external agents only
- ✅ Two channels: OpenAI-compatible API (chat) + MCP (tools)
- ✅ Navigation: 4 tabs + Module Center (5th tab)
- ✅ MVP components: Chat, Calendar, Form/Input, Notification/Alert, Settings
- ✅ Design: Notion-like, minimal, light mode only for MVP
- ✅ Default screen: Chat (configurable)
- ✅ Auth required, multi-device aware
- ✅ Workflow engine: generic (all types), agent handles implementation
- ✅ Self-hosted Docker deployment
- ✅ 3 separate spec documents (Frontend, Backend, Protocol)

**What's still open:**

**Q17: Backend language/framework** — The backend server needs to be built in something. Options:

- **Python (FastAPI)** — you're already learning PydanticAI, Python ecosystem is huge for AI/ML, FastAPI is fast and modern
- **Node.js (Express/Fastify)** — same language as the React Native frontend (JavaScript/TypeScript), easier to share types between frontend and backend
- **Go** — very performant, good for servers, but steeper learning curve

Do you have a preference, or should we let the vibe coding agent decide? (I'd lean Python/FastAPI since you're already in that ecosystem for AI work.)

**Q18: Data storage** — The backend needs a database. Options:

- **SQLite** — simplest, zero config, single file. Great for self-hosted single-user. Might struggle with multi-device concurrent writes.
- **PostgreSQL** — industry standard, handles concurrency well, more setup. Better for multi-device.
- **Both** — SQLite for MVP, migrate to Postgres later.

Preference?

**Q19: Real-time sync mechanism** — When the agent updates something via MCP, how does the iOS app know to refresh? Options:

- **WebSocket** — persistent connection, backend pushes updates instantly. Standard approach.
- **Server-Sent Events (SSE)** — simpler than WebSocket, one-direction (server → client). Good enough if client only needs to receive pushes.
- **Polling** — simplest but worst UX (delay between updates).

I'd default to WebSocket since we need 2-way communication anyway (user sends messages too). But want to confirm.

**Q20: Is there anything else about the PRODUCT (not technical implementation) that you want to define?** For example:

- What happens when the AI agent is offline/unreachable?
- Can multiple AI agents be connected at once?
- Is there a concept of "workspaces" (like Slack workspaces) or is it one workspace per server?
- Any thoughts on the app name?

Once we close these, I think we have enough architecture to write the spec documents.

**Barry:**

1. I really don't know. Which one do you suggest. What is the real difference. I feel like a Python FastAPI server might be better and then these JSON just gets sent over?
2. Let's do SQLite for now, I guess we can switch right?
3. What? I'm a bit confused. Which part of real time sync.
4. For these I think we can just have it spit out an error or some sort for now.

**Jarvis:**

**Q17 RESPONSE — PYTHON FASTAPI IS THE RIGHT CALL**

Your instinct is correct. Let me explain why and what the real difference is:

**Python (FastAPI) vs Node.js — the actual difference:**

Both can do the same job. The difference is ecosystem fit:

- **Python (FastAPI):** The entire AI/ML ecosystem is Python. PydanticAI (which you're learning), LangChain, CrewAI, Ollama bindings, OpenAI SDK — all Python-first. FastAPI is built on Pydantic (same library as PydanticAI), so your data models work everywhere. When you need to add AI features to the backend later, you're already in the right language. Also, FastAPI natively supports WebSocket and async, and it auto-generates API docs.
- **Node.js:** The React Native frontend is JavaScript/TypeScript, so you COULD share type definitions between frontend and backend. But in practice, this advantage is small — you'd define types separately anyway because the frontend and backend have different needs. Node.js has worse AI library support compared to Python.

**Bottom line:** Python FastAPI is better for this project because:

1. You're already in the Python ecosystem (PydanticAI)
2. MCP SDKs are Python-first
3. AI agent integration is Python-native
4. FastAPI + Pydantic = automatic data validation for all your JSON payloads
5. The backend's job is: receive messages, call AI APIs, manage data, serve JSON — FastAPI does all of this cleanly

The JSON "just gets sent over" is exactly right. FastAPI endpoint returns a JSON response → iOS app receives it → renders it. Simple.

Locked in: **Python + FastAPI.** ✅

---

**Q18 RESPONSE — SQLITE, YES YOU CAN SWITCH**

Yes, absolutely. SQLite → PostgreSQL migration is a well-trodden path. The key is to use an **ORM (Object-Relational Mapper)** like SQLAlchemy or Tortoise ORM from the start. The ORM abstracts the database — your code talks to the ORM, the ORM talks to the database. When you switch from SQLite to Postgres, you change one config line and the ORM handles the rest. Zero code changes.

The vibe coding agent should be instructed: "Use SQLAlchemy with async support. SQLite for MVP. Must be swappable to PostgreSQL with config change only."

Locked in: **SQLite via ORM (SQLAlchemy). Swappable to Postgres later.** ✅

---

**Q19 RESPONSE — REAL-TIME SYNC EXPLAINED**

Sorry, let me explain what I was asking more clearly.

Here's the scenario: An external AI agent calls `update_ui()` via MCP to change something — say, it adds a new event to the calendar. The backend now has the new data. But **how does the iOS app find out** that something changed?

Three options:

**(A) Polling:** The iOS app asks the backend "anything new?" every few seconds. Simple but wastes battery and has delay.

**(B) WebSocket:** The iOS app maintains a persistent connection to the backend. When ANYTHING changes (new calendar event, new chat message, UI update), the backend instantly pushes it to the app through this open connection. No delay. This is the same connection already used for chat messages.

**(C) Push notifications:** Backend sends an iOS push notification. App wakes up and fetches new data. Good for when app is in background, but slow for real-time.

**The answer is (B) WebSocket** — and we already need it for chat anyway. When the user types a chat message, it goes over the WebSocket. When the agent responds, the response comes back over the same WebSocket. When the agent updates the UI, that update also comes through the same WebSocket. One persistent connection handles everything.

This isn't really a decision you need to make — it's the obvious choice. I should have just stated it instead of asking. My bad.

Locked in: **WebSocket for all real-time communication.** ✅

---

**Q20 RESPONSE — ERROR HANDLING**

Simple approach for MVP:

- AI agent offline/unreachable → show error message in chat: "Could not reach AI agent. Check your agent settings."
- Backend server offline → app shows "Connection lost. Retrying..." banner at top
- MCP tool call fails → agent gets an error response, handles it (or doesn't — that's on the agent)
- Multiple agents → not for MVP, one agent connection at a time
- Workspaces → one workspace per server for MVP
- App name → TBD, not blocking

Locked in. ✅

---

**🏁 ALL ARCHITECTURE DECISIONS ARE NOW COMPLETE.**

**Full decision summary:**

| # | Decision | Choice |
| --- | --- | --- |
| 1 | Architecture | 3-layer: iOS SDUI renderer + Python backend + MCP server |
| 2 | AI agent | External only. No built-in agent. |
| 3 | Communication | Channel 1: OpenAI-compat API (chat). Channel 2: MCP (tools). |
| 4 | Navigation | 4 customizable tabs + Module Center (5th tab, grid of icons) |
| 5 | MVP components | Chat (2-way), Calendar, Form/Input, Notification/Alert, Settings |
| 6 | Design | Notion-like, minimal, light mode only |
| 7 | Default screen | Chat (user-configurable) |
| 8 | Auth | Required. Username + password/token. Multi-device aware. |
| 9 | Workflow engine | Generic (all types A/B/C), vibe coding agent implements |
| 10 | Deployment | Self-hosted Docker |
| 11 | Backend | Python + FastAPI |
| 12 | Database | SQLite via SQLAlchemy ORM (swappable to Postgres) |
| 13 | Real-time sync | WebSocket (single persistent connection for everything) |
| 14 | Error handling | Show errors in UI. One agent, one workspace per server for MVP. |
| 15 | Spec format | 3 separate documents: Frontend, Backend, Protocol |
| 16 | First-launch | Enter server URL → auth → empty workspace → template or blank |
| 17 | Future protocols | A2A for richer agent communication post-MVP |

**Next step:** Do you want to continue brainstorming in this session (drill deeper into any area), or are you ready for me to go write the 3 spec documents based on everything we've decided?

**Barry:**

1. Uh, I'm not sure about that actually. Will that be stable. I feel like a push update button might be better. I feel like instant update has issues. Like what if the code doesn't work or something. I just don't have this in mind at the start. Maybe it will work explain a bit, maybe evaluate the 2 sides.

Let's keep brainstorming. Almost ready I think. I still need to buy an apple developer account right for this?

**Jarvis:**

**Q19 REVISITED — WEBSOCKET (INSTANT PUSH) vs MANUAL REFRESH BUTTON**

Good instinct to question this. Let me evaluate both sides properly.

First, important clarification: **this isn't about code updates.** WebSocket push is about DATA updates — new calendar events, new chat messages, notification alerts. The app's actual code (the React Native components) never changes at runtime. It's shipped in the App Store binary. What changes is the JSON DATA the server sends.

So the question is really: when the server has new data (e.g., AI agent just added a calendar event), should the app:

**(A) Instant push via WebSocket**

```
Agent adds event via MCP → Backend updates database
    → Backend INSTANTLY pushes new JSON to app via WebSocket
    → App re-renders the calendar with the new event
    → User sees it appear in real-time
```

**Pros:**

- Chat REQUIRES this — you can't have a chat where you press "refresh" to see new messages. Chat must stream in real-time.
- Feels modern and responsive
- Standard for all chat/messaging apps (WhatsApp, Telegram, Slack all use WebSocket)
- No user action needed to see updates

**Cons:**

- Persistent connection uses some battery (minimal on modern phones, but non-zero)
- If the server sends malformed JSON, the app could show a broken UI
- More complex to implement than simple request/response

**(B) Manual refresh (pull-to-refresh or button)**

```
Agent adds event via MCP → Backend updates database
    → Nothing happens on app
    → User pulls down to refresh (or taps refresh button)
    → App fetches latest JSON from backend
    → App re-renders with new data
```

**Pros:**

- Simpler to implement (standard HTTP request/response)
- User has control over when to update
- Less battery usage (no persistent connection)
- If something breaks, user can just not refresh

**Cons:**

- Chat becomes unusable — you'd have to manually refresh to see new messages
- Feels outdated (like email in 2005 vs modern push email)
- User misses time-sensitive alerts ("meeting in 5 minutes") until they manually check
- Kills the real-time agent experience

**(C) HYBRID (recommended)**

```
WebSocket for CHAT (mandatory — chat must be real-time)
    +
Pull-to-refresh for OTHER modules (Calendar, Forms, etc.)
    +
Optional: WebSocket push for those too, but with a "safe render" guard
```

**The "safe render" guard addresses your concern:** Before rendering any new JSON from the server, the app validates it against the expected schema. If the JSON is malformed or references an unknown component type, it shows the previous good state + a small error indicator ("Update available but couldn't render — tap to retry"). This prevents broken UI from ever appearing.

**My recommendation: Start with (C).** Chat is WebSocket from day one (non-negotiable). Other modules start with pull-to-refresh for simplicity. Add WebSocket push for those modules later when you're confident the JSON validation is solid.

**Your concern about "code doesn't work" — one more clarification:**

The JSON payloads are DATA, not code. They say things like "show a calendar card with these 3 events." If the data is wrong (e.g., wrong date format), the worst that happens is the component shows an error state. It can't crash the app or break other modules. Each component renders independently. A bad calendar JSON can't break the chat.

---

**APPLE DEVELOPER ACCOUNT**

Yes, you need one to publish to the App Store. Here's the breakdown:

**What you need:**

- **Apple Developer Program** — $99/year
- Gives you: App Store publishing, TestFlight (beta testing), push notifications, app signing certificates
- Sign up at [developer.apple.com/programs](http://developer.apple.com/programs)

**When you need it:**

- **NOT yet.** You don't need it during development.
- During development: use **Expo Go** app on your iPhone for testing (free, no account needed)
- You only need the $99 account when you're ready to:
    1. Create a TestFlight build (for beta testers)
    2. Submit to the App Store

**What you DON'T need:**

- A Mac for daily development (Linux + Expo handles everything)
- A separate iOS device for testing (though having one helps — you can use the Android emulator day-to-day)

**Timeline suggestion:**

1. Now: Develop on Linux with Expo + Android emulator (free)
2. When MVP is feature-complete: Buy the $99 Apple Developer account
3. Use your 2017 MacBook for the first TestFlight build
4. Beta test via TestFlight on your iPhone
5. Submit to App Store when ready

Don't spend the $99 until you have something to build. The annual clock starts ticking when you pay.

---

**Updated decision #13:**

Real-time sync → **Hybrid: WebSocket for chat (mandatory), pull-to-refresh for other modules (MVP), with WebSocket push + JSON validation as a later upgrade.**

---

**What's left to brainstorm?** I think we're very close. The only things I can think of:

**Q21:** The backend's "app connections" (Google Calendar, email, etc.) — for MVP, which external services should the backend support connecting to? Or is that entirely up to the vibe coding agent to decide? (I'd suggest Google Calendar as the one MVP integration, since you have a Calendar component.)

**Q22:** Any other product-level concerns before we move to writing specs?

**Barry:**

1. Let's do that later. I think that's an addon.
2. I think we are good here.

**Jarvis:**

Q21 locked — external service integrations (Google Calendar, email, etc.) are **post-MVP addons**. Backend should be architected with a plugin/connector system so these can be added later, but none ship in MVP. ✅

**🏁 ARCHITECTURE BRAINSTORM COMPLETE. Session 1 closed.**