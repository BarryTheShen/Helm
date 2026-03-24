# Agentic AI Super App — Project Hub

Subjects: General/Other
Date: March 23, 2026 9:23 AM

<aside>
📋

**Instructional Header — Agentic AI Super App**

Barry's vision: an independent, open-source, **React Native** mobile app (iOS-first, Android later) that acts as a **universal agentic AI frontend** — a "browser for AI agents" that dynamically renders rich native UI components (calendar, chat, news, dashboards, forms, etc.) connected to ANY service via APIs. Self-hosted backend, on-device agent support, not locked to any ecosystem. The WeChat/Alipay super app model but AI-native.

---

### Page Purpose

Central hub for the Agentic AI Super App project. Combines research from the original SDUI brainstorm, the agentic AI frontend idea, competitive landscape analysis, and Apple ToS compliance into one deployment plan. **React Native + Expo, iOS-first, developed on Linux.**

### Page Structure

This page uses a **TLDR + sub-page system**: each section has a short summary on this main page. Detailed research, breakdowns, and working docs live in linked sub-pages. When expanding a section, create a sub-page and link it with → at the bottom of that section.

### Updating Related Documents

When new findings emerge from brainstorming sessions or research, **update all related documents on this page** — not just the brainstorming log. Check each section's TLDR: if it's clearly still accurate, skip it. If the TLDR suggests the detailed sub-page might be outdated or you're unsure, **view the sub-page and edit it** — you probably need to.

---

### Reference Documents

- [Agentic AI Frontend for Mobile — The Missing Product Layer](https://www.notion.so/Agentic-AI-Frontend-for-Mobile-The-Missing-Product-Layer-26e48f3c67c344f781570f172ff34871?pvs=21) — Original brainstorm (Session 1: SDUI + agent, Session 2: super app expansion)
- [1-Click Deploy iOS/iPadOS Apps — Vibe Coding Idea](https://www.notion.so/1-Click-Deploy-iOS-iPadOS-Apps-Vibe-Coding-Idea-6c641532bae941129abb6d34a1a245b5?pvs=21) — Apple ToS deep analysis, SDUI compliance, Lua scripting, monetization
- [Apple App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) — Official guidelines (last updated Feb 2026)
- [AG-UI Protocol (GitHub)](https://github.com/ag-ui-protocol/ag-ui) — Open-source agent↔frontend protocol by CopilotKit
- [Google A2UI](https://github.com/anthropics/a2ui) — Agent-to-UI protocol spec (v0.8)
- [DivKit (Yandex)](https://github.com/nicepkg/divkit) — Open-source SDUI renderer (Apache 2.0)

---

### 💬 Brainstorming Sessions

→ Brainstorming Sessions sub-page (see bottom of page)

**Storage rule:** Brainstorming sessions live as **individual sub-pages** inside the Brainstorming Sessions folder. Each session is named `Session X — YYYY-MM-DD — Topic`. Start each session page with a **Key decisions** + **Action items** summary, then the full Barry + Jarvis transcript below a divider. Always create a new sub-page for a new session — never append to an existing session page.

---

### Progress — March 23, 2026

- **Original SDUI brainstorm (2026-03-15):** Barry identified the core idea — a native iOS SDUI platform app that renders JSON configs from a server. Deep analysis of Apple Guideline 2.5.2 confirmed SDUI is Apple-compliant. Explored Lua scripting angle, monetization model, DivKit/Nativeblocks landscape.
- **Agentic AI Frontend brainstorm (2026-03-23, Session 1):** Evolved the idea — instead of SDUI + custom endpoint server, the AI agent runs ON the phone. The app IS the frontend the agent controls. No separate server needed. Research confirmed: Google A2UI (protocol), DivKit (renderer), OpenClaw (agent) exist but nobody combined them.
- **Super App expansion (2026-03-23, Session 2):** Expanded scope to full agentic AI super app — WeChat model but AI-native. Deep competitive landscape research. Found Bluebox/Vectorly (reverse-engineer APIs). First-to-market window: 6-12 months.
- **CopilotKit analysis (2026-03-23, chat):** Evaluated CopilotKit — concluded it's web-only, solves a smaller problem (frontend chat SDK). AG-UI protocol is the only useful piece. Barry's project is a full-stack product (backend platform + protocol + native iOS app) that goes way beyond CopilotKit.
- **Decision: iOS-first.** Android considered for future.
- **Framework decision (2026-03-23, chat):** Chose **React Native** over native Swift. Key reasons: (1) full vibe coding workflow works on Linux (Cursor + hot reload + Android emulator), (2) Mac only needed for final App Store build/submission (Barry has a 2017 MacBook at home), (3) cross-platform — Android comes free, (4) AG-UI protocol is framework-agnostic so RN works just as well as Swift for implementing the protocol client. Performance trade-off is acceptable for an SDUI renderer app.
</aside>

---

## The Vision

**One-line pitch:** An independent, open-source, React Native mobile app that replaces all your apps — AI agents connect to any service via APIs and dynamically render rich native UI, WeChat-style but AI-native.

**Three layers:**

1. **Backend platform** (self-hosted) — Users connect their APIs (Google Calendar, email, food delivery, transit, payments, etc.). AI agent lives here, calls APIs, formats results.
2. **Protocol layer** — How the backend tells the frontend what to display. AG-UI protocol (open-source, framework-agnostic).
3. **React Native app** (Expo) — Rich SDUI renderer with pre-built components (calendar, chat, news feed, charts, forms, maps, notifications, etc.). iOS-first, Android comes free.

**Key differentiator from everything else:**

- NOT locked to any ecosystem (vs Google AppFunctions, WeChat, Lenovo Qira)
- NOT dedicated hardware (vs Rabbit R1, Humane AI Pin — both flopped)
- NOT a developer framework (vs CopilotKit, DroidRun, Open Interpreter)
- NOT voice-only / chat-only (vs OpenClaw, Telegram bots)
- IS a consumer-friendly native mobile app with rich UI
- IS open-source and self-hostable

→ *(sub-page TBD — full vision doc)*

---

## Apple ToS Compliance

**TLDR:** Server-driven UI is a well-established, Apple-approved pattern. Guideline 2.5.2 prohibits downloading *executable code*, NOT data/configs. The app ships with all component types pre-built; the server sends JSON layout configs. This is exactly how Notion, Airbnb, Instagram, Spotify, and Netflix work. ✅

**The heuristic:** If you removed the server entirely and hardcoded every possible JSON config, would the app's *capabilities* be identical? If YES → it's data, you're fine.

**What's allowed:**

- ✅ JSON that says "render a button here, a list there, with these colors" → data
- ✅ Layout templates that arrange pre-built components → data
- ✅ New "screens" that are just new config files pushed from server → data
- ✅ Local AI generating new JSON configs using existing components → data
- ❌ Downloading JavaScript/Swift/Python that creates new component types → code violation
- ❌ Plugin system that runs arbitrary executable code → violation

**Power spectrum (5 levels):**

1. **Level 1 (safest):** Pure JSON configs → layout + styling only → 100% compliant
2. **Level 2 (safe):** JSON with declarative expressions/variables (DivKit-style) → reactive UI, no imperative code
3. **Level 3 (safe, widely tolerated):** Embedded Lua interpreter + bundled scripts → all logic ships in reviewed binary
4. **Level 4 (gray, massively precedented):** Embedded Lua + downloading scripts from server → thousands of games do this
5. **Level 5 (violation):** Downloading compiled native code → clear violation

**Recommended approach:** Ship at Level 2 for SDUI core, with Level 3/4 as opt-in advanced mode.

**Monetization (Apple-safe):**

- iOS app is **free** — just a renderer connecting to user's server endpoint
- Sell hosting/AI service on **website** as web SaaS subscription
- Qualifies as **multiplatform service** (Guideline 3.1.3(b)) — no IAP required
- Self-hosted option is cleanest — Apple has zero monetization claim

→ Apple ToS Deep Analysis sub-page (see bottom of page)

---

## Competitive Landscape

**TLDR:** Everyone is approaching this from one of three directions, and all have critical gaps:

### Big Tech — Adding AI to existing ecosystems (locked in)

- **Alibaba Qwen** (Jan 2026) — Agentic commerce inside existing super app. China-only.
- **Tencent/WeChat** — Adding AI agents INTO WeChat, not building new app.
- **Google Android AppFunctions** (Feb 2026) — OS-level approach. Android 17. Experimental.
- **Lenovo Qira** (MWC 2026) — Cross-device AI super agent. Locked to Lenovo hardware.
- **HP CosmOS** — AI operating system. PC-focused.

### Hardware Startups — All flopped

- **Rabbit R1** ($199, 2024) — Biggest hardware flop of 2024. Wrong form factor + no rich UI.
- **Humane AI Pin** (2024) — Even worse. Voice-only doesn't work for complex tasks.
- **Deutsche Telekom "AI Phone"** — Concept only, never shipped.

### Open Source / Dev Tools — Developer-only, no consumer product

- **CopilotKit / AG-UI** — Web-only frontend SDK. AG-UI protocol is useful but no mobile app.
- **DroidRun** (€2.1M pre-seed) — AI controls Android apps via accessibility tree. Developer framework.
- **MobileAgent / GUI-Owl** (Alibaba) — Research project, not consumer product.
- **Open Interpreter** — Desktop-focused, no mobile.
- **Bluebox / Vectorly** — Reverse-engineers undocumented APIs. Building block, not consumer app.
- **DivKit (Yandex)** — SDUI renderer. Not AI-aware.

**The gap:** Nobody is building an independent, consumer-friendly, native mobile app combining SDUI renderer + agent protocol + universal API access + self-hosted backend.

→ Competitive Landscape sub-page (see bottom of page)

---

## Architecture & Tech Stack

**TLDR:** React Native (Expo), iOS-first, developed entirely on Linux. Three-layer architecture. AG-UI as the agent↔frontend protocol. Mac only needed for final App Store build.

### Layer 1 — Self-Hosted Backend Server

- API gateway where users configure service connections (Google Calendar OAuth, email, weather, etc.)
- AI agent runtime (PydanticAI, LangGraph, or raw LLM API calls)
- Plugin/connector system for adding new services (MCP-style)
- Could use CopilotKit's Copilot Runtime (Node.js) as starting point, or build custom

### Layer 2 — Protocol (AG-UI)

- **AG-UI protocol** — open-source, framework-agnostic message format for agent↔frontend communication
- Adopted by Google, LangChain, AWS, Microsoft, PydanticAI
- Protocol doesn't care what renders the UI — works with React, React Native, Swift, anything
- Backend sends AG-UI events (text streaming, tool calls, state updates, UI component payloads) → RN app parses and renders

### Layer 3 — React Native App (Expo)

- Pre-built component library: calendar widget, chat view, news feed, charts/dashboards, forms, map, notification cards, list views
- SDUI renderer that maps JSON payloads → React Native components
- "Workspace" / home screen where users arrange widgets/screens
- Connects to user's backend server URL
- iOS-first, but Android support comes free from the same codebase

### Dev Workflow

- **Daily development:** Linux workstation + Cursor (AI IDE) + Expo dev server + Android emulator or physical device. Full hot reload. Full vibe coding workflow.
- **iOS testing:** Expo Go app on a physical iPhone (no Mac needed for dev testing)
- **App Store build:** Barry's 2017 MacBook at home — used only for final `eas build` + Xcode signing + App Store submission. Not needed for daily work.

### Starting Point (MVP)

- **Backend:** Python server with AI agent + 2-3 API connectors (Google Calendar + weather)
- **Protocol:** AG-UI over WebSocket
- **App:** React Native (Expo) with 3-4 component types (calendar card, text/chat, list, simple chart)
- **Goal:** End-to-end loop — "What's on my calendar today?" → agent calls API → AG-UI event → native calendar card renders on phone

→ Architecture & Tech Stack sub-page (see bottom of page)

---

## Existing Building Blocks

**TLDR:** The open-source pieces exist. Nobody has assembled them.

| Building Block | What It Does | License |
| --- | --- | --- |
| **DivKit** (Yandex) | SDUI renderer — iOS/Android/Web, JSON layouts render natively | Apache 2.0 |
| **AG-UI** (CopilotKit) | Agent↔frontend protocol — message format for streaming UI | Open source |
| **A2UI** (Google, Dec 2025) | Agent-to-UI protocol spec, v0.8 | Open source |
| **Bluebox / Vectorly** | Reverse-engineers undocumented web APIs | MIT |
| **DroidRun** | AI agents control Android apps via accessibility tree | MIT |
| **OpenClaw** | Personal AI agent, runs locally, 20K+ stars | Open source |
| **SEED Labs style Docker** | Containerized environments for sandboxed execution | Various |

→ *(sub-page TBD — detailed building blocks analysis)*

---

## Research Findings — What CopilotKit Is (and Isn't)

**TLDR:** CopilotKit is a **web-only frontend SDK** for adding AI chat + generative UI into existing React/Angular apps. It is NOT a super app platform. No React Native support (open GitHub issue #3125). The only relevant piece is the **AG-UI protocol** — an open-source, **framework-agnostic** message format for agent↔frontend communication. AG-UI works with any frontend, including React Native.

**What CopilotKit provides:** Pre-built chat sidebar, generative UI (agents render React components), shared state, human-in-the-loop. React + Angular only.

**What it does NOT provide:** Backend API integrations, user account management, service orchestration, native mobile app, SDUI rendering, React Native support.

**Why AG-UI + React Native works (Option B):**

AG-UI is just a protocol — a set of message formats (text events, tool calls, state updates, UI payloads). It doesn't care what renders the UI. CopilotKit built a React web client for it, but you can build a React Native client that speaks the same protocol. The backend sends AG-UI events → your RN app parses them → maps to pre-built RN components. Same architecture as the original SwiftUI plan, just with RN instead.

**React vs React Native vs Native Swift:**

- **React** = web framework (builds websites in browsers). CopilotKit lives here.
- **React Native** = mobile framework using React/JS patterns → outputs real native iOS/Android apps. JS runs in Hermes engine on phone, bridge creates real native UI components. Not a web view. **This is what we're using.**
- **Native Swift/SwiftUI** = best raw performance, but requires Mac for all development, no cross-platform, harder to vibe code.

**Why RN over Swift:** (1) Full vibe coding on Linux — Cursor + Expo + hot reload, (2) Mac only for final App Store build, (3) Android comes free, (4) Performance trade-off acceptable for SDUI renderer, (5) AG-UI is framework-agnostic so works identically.

→ *(sub-page TBD — CopilotKit & AG-UI evaluation)*

---

## Monetization Strategy

**TLDR:** Free renderer app. Revenue from web-based SaaS.

- **iOS app:** Free on App Store — it's just a renderer connecting to whatever server endpoint the user provides
- **Self-hosted:** Users run their own backend server — $0, Apple has zero claim
- **Premium cloud-hosted:** Managed backend as a web SaaS subscription — sold on website, not in-app (avoids Apple's 30% cut)
- **Additional revenue:** Premium component templates, AI credits, managed hosting
- **Multiplatform service model** (Guideline 3.1.3(b)) — if service works across web + Android + iOS, no IAP required

→ *(sub-page TBD — detailed business model)*

---

## First-to-Market Assessment

**TLDR:** 6-12 month window before Big Tech's ecosystem-locked solutions mature.

- The CONCEPT is widely discussed (CNBC, Yahoo Finance, Gartner, Forrester all published pieces Jan-Feb 2026)
- Big Tech is moving but locked to their ecosystems and slow (Google AppFunctions experimental, WeChat agents China-only)
- No independent consumer app exists combining all three layers
- Open-source building blocks are ALL available NOW
- The indie/open-source angle is a moat — nobody trusts Big Tech to build an app that replaces their own app stores
- Closest attempts (Rabbit R1, Humane Pin) failed due to wrong form factor + wrong UI paradigm

→ *(sub-page TBD)*

---

## Open Questions

- [ ]  Define MVP scope — which 3-4 components to build first?
- [ ]  Choose backend framework — PydanticAI vs LangGraph vs raw API calls?
- [ ]  Protocol decision — custom JSON vs AG-UI from the start?
- [ ]  First API integrations — Google Calendar + what else?
- [ ]  Workspace/home screen UX design
- [ ]  How to handle user authentication for connected services (OAuth flows)
- [ ]  Self-hosted deployment story — Docker Compose? One-click install?
- [x]  Android timeline — when to start considering cross-platform? → **Comes free with React Native. Ship iOS first, test Android after.**
- [x]  Framework choice — Swift vs React Native? → **React Native (Expo). Vibe code on Linux, Mac only for final build. AG-UI works with RN.**
- [ ]  Open source strategy — license choice, repo structure, contribution model
- [ ]  Name for the app?

---

## Relationship to Previous Ideas

- Builds directly on [1-Click Deploy iOS/iPadOS Apps — Vibe Coding Idea](https://www.notion.so/1-Click-Deploy-iOS-iPadOS-Apps-Vibe-Coding-Idea-6c641532bae941129abb6d34a1a245b5?pvs=21) (2026-03-15) — SDUI platform concept, Apple ToS analysis
- Evolves from [Agentic AI Frontend for Mobile — The Missing Product Layer](https://www.notion.so/Agentic-AI-Frontend-for-Mobile-The-Missing-Product-Layer-26e48f3c67c344f781570f172ff34871?pvs=21) (2026-03-23) — added agent runtime, super app vision, competitive landscape
- Related Horizon goal: [1-Click Deploy iOS/iPadOS Platform](https://www.notion.so/1-Click-Deploy-iOS-iPadOS-Platform-63dbf373308145d7a03ee72b539f2316?pvs=21)

---

<aside>
🏗️

**🔗 Blueprint — Production Spec Documents**

The detailed production specifications for this project live in the **Blueprint** sub-page below. When implementing or making architectural decisions, always consult these specs:

- 📱 **Frontend Spec** → [Frontend Spec — iOS App (React Native / Expo)](Agentic%20AI%20Super%20App%20%E2%80%94%20Project%20Hub/Blueprint%20%E2%80%94%20Production%20Spec%20Documents/Frontend%20Spec%20%E2%80%94%20iOS%20App%20(React%20Native%20Expo)%208dc82fa5b83b4febb74bec26e4cb42c3.md) — SDUI renderer, navigation, component catalog, design system
- ⚙️ **Backend Spec** → [Backend Spec — Python FastAPI Server](Agentic%20AI%20Super%20App%20%E2%80%94%20Project%20Hub/Blueprint%20%E2%80%94%20Production%20Spec%20Documents/Backend%20Spec%20%E2%80%94%20Python%20FastAPI%20Server%204cd5fe4fda994d6292a1c4b8135049c3.md) — API endpoints, database schema, MCP server, agent proxy, workflow engine
- 🔗 **Protocol Spec** → [Protocol Spec — Communication Layer](Agentic%20AI%20Super%20App%20%E2%80%94%20Project%20Hub/Blueprint%20%E2%80%94%20Production%20Spec%20Documents/Protocol%20Spec%20%E2%80%94%20Communication%20Layer%20acac8b3a316d480aa493c5fe03248980.md) — WebSocket, REST, OpenAI-compatible API, MCP, SDUI JSON schema, sequence diagrams

**Build order:** Backend → Protocol → Frontend. Read all three before starting.

</aside>

[Brainstorming Sessions](Agentic%20AI%20Super%20App%20%E2%80%94%20Project%20Hub/Brainstorming%20Sessions%20dc581b8045a54c038b095d95af3b9313.md)

[Apple ToS Deep Analysis](Agentic%20AI%20Super%20App%20%E2%80%94%20Project%20Hub/Apple%20ToS%20Deep%20Analysis%204841f45561724c91a37a32e612cea5c8.md)

[Competitive Landscape — Who's Building This?](Agentic%20AI%20Super%20App%20%E2%80%94%20Project%20Hub/Competitive%20Landscape%20%E2%80%94%20Who's%20Building%20This%2067f9f8c5a2c743119a790b5ba253d897.md)

[Architecture & Tech Stack](Agentic%20AI%20Super%20App%20%E2%80%94%20Project%20Hub/Architecture%20&%20Tech%20Stack%20089e954eda2d4ceeb6463cfdca1ecdb2.md)

[Research Archive](Agentic%20AI%20Super%20App%20%E2%80%94%20Project%20Hub/Research%20Archive%20b3f0ef4532a34235862b50ba20bc891b.md)

[Blueprint — Production Spec Documents](Agentic%20AI%20Super%20App%20%E2%80%94%20Project%20Hub/Blueprint%20%E2%80%94%20Production%20Spec%20Documents%20e9900e32563f4777b397c5b698b07870.md)

[[CLAUDE.md](http://CLAUDE.md) — Agentic AI Super App](Agentic%20AI%20Super%20App%20%E2%80%94%20Project%20Hub/CLAUDE%20md%20%E2%80%94%20Agentic%20AI%20Super%20App%2034adc575383d43078bd781085ec13cd2.md)