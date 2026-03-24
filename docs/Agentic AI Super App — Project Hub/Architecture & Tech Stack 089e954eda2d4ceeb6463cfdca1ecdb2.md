# Architecture & Tech Stack

## How React Native Actually Works

React Native does **not** compile to Swift or native code. Here's what actually happens:

### The Runtime Model

```
Your JavaScript/TypeScript code
        ↓
Hermes JS Engine (runs on the phone)
        ↓
React Native Bridge (translates JS calls → native calls)
        ↓
Real native iOS/Android UI components
```

1. You write JavaScript (or TypeScript) — same language as web React
2. That JS runs inside **Hermes** — a lightweight JavaScript engine (made by Meta, ~2MB) that lives inside your app
3. When your JS says "render a button" → React Native's **bridge** tells the native iOS side to create a real `UIButton`
4. The user sees and touches **real native UI components** — not a web view, not HTML

### What's in the App Bundle

- The Hermes JS engine (~2MB)
- Your JavaScript code (bundled as a single `.js` file)
- The React Native bridge layer (native code that translates between JS and iOS/Android)
- Any native modules you use (camera, GPS, Bluetooth, etc.)
- Pre-built native UI components

### Where It's Fast vs Slow

**Fast (no noticeable difference from native Swift):**

- Rendering lists, cards, forms, calendars, chat
- Navigation between screens
- Network requests and data processing
- Static animations and transitions

**Slower than native (bridge overhead):**

- Heavy real-time animations (60fps complex gestures)
- Games or physics simulations
- Rapid-fire touch events with immediate visual feedback

**For our SDUI renderer app** — we're displaying cards, lists, calendars, chat, charts. All in the "fast" category. The bridge overhead is irrelevant for this use case.

---

## Why React Native Over Native Swift

### The Decision Matrix

| Factor | React Native | Native Swift | Winner |
| --- | --- | --- | --- |
| **Vibe coding on Linux** | ✅ Full workflow — Cursor + Expo + hot reload | ❌ Requires Mac for all dev | **RN** |
| **Mac dependency** | Only for final App Store build | Required for everything | **RN** |
| **Cross-platform** | iOS + Android from one codebase | iOS only | **RN** |
| **Performance** | Good — native components via bridge | Best — direct hardware access | Swift |
| **Apple compliance** | ✅ Standard — avoid CodePush OTA | ✅ Cleanest possible | Swift (slight) |
| **AG-UI compatibility** | ✅ Framework-agnostic protocol | ✅ Framework-agnostic protocol | Tie |
| **AI testing loop** | ✅ AI writes code → hot reload → sees result | ❌ AI writes code → Xcode build → slow | **RN** |
| **Ecosystem / libraries** | Massive npm ecosystem | Smaller, Apple-focused | **RN** |

**Bottom line:** Swift wins on raw performance and Apple purity. React Native wins on everything else — and for an SDUI renderer app, the performance gap doesn't matter.

### The Vibe Coding Problem with Swift

Vibe coding depends on a fast AI feedback loop:

1. AI writes code → 2. Runs it → 3. Sees errors/output → 4. Fixes → repeat

**With React Native:** This loop works perfectly. Expo dev server hot-reloads in under a second. AI can iterate rapidly on Linux.

**With Swift/Xcode:** The loop breaks. Xcode is the only tool that can build and run SwiftUI code. It's Mac-only, heavy, and the build→preview cycle is slow. AI tools (Cursor, Copilot) can *write* Swift code but can't *run or test* it without Xcode in the loop. You'd be constantly copy-pasting errors from Xcode back into Cursor.

---

## macOS Options Evaluation (for App Store Builds)

Since React Native development happens on Linux, we only need a Mac for final App Store builds. Here's what was evaluated:

### Barry's 2017 MacBook (12-inch)

- **Chip:** Intel Core m3/i5/i7 (dual-core, very low power)
- **RAM:** 8GB or 16GB
- **Latest macOS:** Monterey (macOS 12) — Apple dropped support after that
- **Latest Xcode:** 14.2
- **Verdict:** Works as a build-and-submit machine. Don't use for daily development. May eventually need a newer Xcode version for App Store submission — cross that bridge when we get there.

### Other Options Evaluated and Rejected

**Docker-OSX (sickcodes/Docker-OSX):**

- Runs macOS in Docker via QEMU/KVM on Linux
- ❌ Terrible Xcode performance (VM-in-container overhead)
- ❌ iOS Simulator laggy and crash-prone
- ❌ Violates Apple EULA (macOS licensed only for Apple hardware)
- ❌ Fragile — macOS updates break the container
- Verdict: **Rejected.** Usable for CI/CD pipelines, not for development.

**Cloud Mac (MacStadium, AWS EC2 Mac, MacinCloud):**

- $30–50/month rental, remote access via SSH/VNC
- ✅ Legal (runs on real Apple hardware)
- ❌ Painful for daily use over network
- Verdict: **Backup option.** Good if the 2017 MacBook can't run a new enough Xcode.

**macOS VM (OSX-KVM):**

- Same EULA violation as Docker-OSX, slightly better performance
- Verdict: **Rejected.** Same legal issues, still buggy.

**Used M1 Mac Mini ($400–500):**

- Best-in-class option if budget allows
- Verdict: **Future upgrade.** Not needed now since the 2017 MacBook works for builds.

### Recommended Approach

Use Barry's 2017 MacBook for App Store builds. If Xcode version becomes a blocker, rent a cloud Mac ($1–2 per build session) or buy a used M1 Mac Mini.

---

## Three-Layer Architecture (Detailed)

### Layer 1 — Self-Hosted Backend Server

```
┌─────────────────────────────────────┐
│         Self-Hosted Backend          │
│                                      │
│  ┌──────────┐    ┌───────────────┐  │
│  │ AI Agent │───→│ API Gateway   │  │
│  │ Runtime  │    │               │  │
│  │(Pydantic │    │ Google Cal ◄──│  │
│  │ AI /     │    │ Email     ◄──│  │
│  │ LangGraph)│   │ Weather   ◄──│  │
│  └──────────┘    │ Transit   ◄──│  │
│       │          │ Food      ◄──│  │
│       ▼          └───────────────┘  │
│  ┌──────────┐                       │
│  │ AG-UI    │──→ WebSocket/HTTP    │
│  │ Events   │    to mobile app     │
│  └──────────┘                       │
└─────────────────────────────────────┘
```

**Tech choices (TBD):**

- **Agent framework:** PydanticAI (Barry already studying this) vs LangGraph vs raw LLM API calls
- **API connector model:** MCP-style plugin system — each service is a connector with standardized input/output
- **Auth:** OAuth2 flows for Google, Microsoft, etc. — the backend stores tokens, the mobile app never touches them
- **Deployment:** Docker Compose on any Linux server. One `docker compose up` to start.

### Layer 2 — Protocol (AG-UI)

AG-UI defines event types the backend sends to the frontend:

- **Text events** — streaming text from the agent (like ChatGPT typing)
- **Tool call events** — agent is calling an API (e.g., "fetching your calendar…")
- **State update events** — shared state between agent and frontend changes
- **UI component events** — agent sends a JSON payload saying "render this calendar card with this data"

The protocol is **framework-agnostic** — it's just a message format. CopilotKit built a React web client for it. We're building a React Native client. Same protocol, different renderer.

**Alternative:** Start with a simpler custom JSON protocol and migrate to AG-UI later if the custom approach gets messy. AG-UI is still v0.x and web-focused.

### Layer 3 — React Native App (Expo)

**Component library (MVP target: 3-4 components):**

- 📅 Calendar card — displays events from connected calendar
- 💬 Chat view — conversational interface with the AI agent
- 📋 List view — generic list (tasks, emails, notifications)
- 📊 Simple chart — basic data visualization

**SDUI renderer:** The core engine. Takes a JSON payload like:

```json
{
  "component": "calendar_card",
  "props": {
    "title": "Today's Schedule",
    "events": [
      {"time": "09:00", "title": "Team standup", "color": "blue"},
      {"time": "14:00", "title": "Dentist", "color": "red"}
    ]
  }
}
```

…and renders it as a native calendar widget. The JSON schema is the contract between backend and frontend.

**Workspace / home screen:** Where users arrange their widgets. Think of it like iOS home screen but for AI-generated cards.

---

## Development Workflow (Detailed)

### Daily Development (on Linux)

```
Linux Workstation (Delta Desktop)
├── Cursor (AI IDE) — write code, AI generates, AI iterates
├── Expo Dev Server — serves the app, handles hot reload
├── Android Emulator — instant visual preview
│   (or physical Android phone via USB/WiFi)
├── Backend Server — Docker container running the AI agent
└── Terminal — git, npm, docker, etc.
```

**The vibe coding loop:**

1. Tell AI (in Cursor) what you want — "add a calendar card component that takes events as props"
2. AI writes the React Native code
3. Expo hot-reloads in <1 second — you see the result on Android emulator
4. If wrong, tell AI to fix it — it sees the error, iterates
5. Repeat until it looks right

This is the same loop web developers use. It just works.

### iOS Testing (no Mac needed)

- Install **Expo Go** app on a physical iPhone
- Phone and Linux machine on same WiFi
- Expo dev server streams the app to the phone
- You see your app running natively on iOS — real components, real gestures
- Some native modules may need a "development build" (one-time Mac step), but core UI testing works via Expo Go

### App Store Build & Submission (Mac needed — infrequent)

1. Push code to GitHub
2. On the 2017 MacBook: `git pull` → `eas build --platform ios`
3. EAS (Expo Application Services) handles the Xcode build chain
4. Sign with Apple Developer certificate ($99/year)
5. Upload to App Store Connect
6. Apple reviews (1-3 days)
7. Close the MacBook, back to Linux

This step happens once per release. Not daily.

---

## Build Process — What Actually Happens

When you run `eas build --platform ios`:

1. **JS bundle step:** All your JavaScript/TypeScript is bundled into a single optimized `.js` file (like webpack for web)
2. **Native shell compilation:** Xcode compiles the React Native "shell" — the Hermes engine, the bridge layer, any native modules — into an iOS binary
3. **Packaging:** The JS bundle is embedded inside the native binary as a resource file
4. **Signing:** Xcode signs the whole package with your Apple Developer certificate
5. **Output:** A `.ipa` file — the standard iOS app package, indistinguishable from a "native" app

**On the user's phone:**

1. Hermes engine starts → loads the JS bundle
2. JS executes → calls React Native APIs
3. Bridge translates → creates native iOS UI components
4. User interacts with real native UI → events flow back through the bridge → JS handles logic → updates UI

The user never knows or cares that it's React Native. It's just an app.