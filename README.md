# Keel — AI-to-UI Protocol for Server-Driven Native Apps

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.11%2B-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![React Native](https://img.shields.io/badge/React%20Native-Expo-000020?logo=expo)](https://expo.dev/)

Keel is an open-source protocol and toolkit that lets AI agents render native mobile UI at runtime. Instead of responding with text, the AI describes screens as JSON and Keel turns them into real components on the user's device. No app update required.

Keel is not a component library. It is a **protocol** -- a standard JSON format for AI-to-UI communication. The protocol is renderer-agnostic: you can build renderers for React Native, web, CLI, or IDE extensions. Keel ships with a React Native renderer and a Python server toolkit out of the box.

---

## How It Works

```
AI Agent                          Keel                           User's Phone
   |                                |                                |
   |-- generate screen JSON ------->|                                |
   |                                |-- validate (Zod schemas) ----->|
   |                                |-- render native components --->|
   |                                |                                |
   |                                |<-- user taps button -----------|
   |<-- form_submit / action -------|                                |
   |                                |                                |
   |-- update single component ---->|-- patch props by ID ---------->|
```

The AI sends a JSON page descriptor. Keel validates it, resolves each component type from a registry, and renders native views. User interactions (button taps, form submissions, screen selections) flow back to the AI as structured actions.

---

## Packages

| Package | Language | What it does |
|---------|----------|-------------|
| [`@keel/protocol`](packages/protocol/README.md) | TypeScript | JSON types for pages, rows, cells, components, and actions. Zod validation schemas. |
| [`@keel/renderer`](packages/renderer/README.md) | TypeScript / React Native | Component registry, page renderer, UI library preset system (e.g. React Native Paper). |
| [`keel-server`](packages/server/README.md) | Python | MCP server factory, WebSocket connection manager, SDUI normalization, form validation, action registry. |

### Quick install

```bash
# TypeScript (frontend)
npm install @keel/protocol @keel/renderer

# Python (backend)
pip install keel-server
```

---

## Protocol Overview

A Keel screen is a **page** made of **rows**, each containing **cells**, each holding one **component**:

```json
{
  "schema_version": "1.0.0",
  "module_id": "home",
  "title": "Dashboard",
  "rows": [
    {
      "id": "row-1",
      "cells": [
        {
          "id": "cell-1",
          "width": 1,
          "content": {
            "type": "Text",
            "id": "greeting",
            "props": { "content": "Good morning!", "variant": "heading" }
          }
        }
      ]
    }
  ]
}
```

### Built-in component types

| Tier | Components |
|------|-----------|
| Atomic | `Text`, `Markdown`, `Button`, `Image`, `TextInput`, `Icon`, `Divider` |
| Structural | `Container` |
| Composite | `CalendarModule`, `ChatModule`, `NotesModule`, `InputBar`, `Form`, `ScreenOptions` |

### Actions (user interactions sent back to the AI)

| Action | Purpose |
|--------|---------|
| `navigate` | Go to a screen |
| `server_action` | Call a named backend function |
| `form_submit` | Submit form data (field values keyed by field ID) |
| `select_screen` | User picks one screen from multiple AI-generated options |
| `update_component` | Patch a single component's props by ID (no full-screen rebuild) |
| `send_to_agent` | Send a text message to the AI |
| `open_url` | Open a URL in the browser |
| `copy_text` | Copy text to clipboard |
| `api_call` | Direct REST call |
| `dismiss` / `go_back` | Navigation |

For full type definitions, see [`packages/protocol/README.md`](packages/protocol/README.md).

### Preset system

Keel's renderer is UI-library-agnostic. A **preset** swaps all built-in components with a UI library's equivalents in one call:

```typescript
import { registerPreset } from '@keel/renderer';
import { PaperPreset } from '@keel/renderer/presets/paper';

registerPreset(PaperPreset);  // All components now use React Native Paper
```

You can write presets for any UI library (Tamagui, NativeBase, etc.).

---

## Running the Demo

The `examples/keel-demo/` directory contains a runnable Expo app that renders Keel screens using the React Native Paper preset.

```bash
cd examples/keel-demo
npm install
npx expo start
```

See [`examples/keel-demo/README.md`](examples/keel-demo/README.md) for details.

---

## Running Tests

```bash
# Protocol (49 tests)
cd packages/protocol && npx jest

# Renderer (22 tests)
cd packages/renderer && npx jest

# Demo app (21 tests)
cd examples/keel-demo && npx jest

# Server (48 tests) — requires Python venv with pytest
cd packages/server && python -m pytest
```

---

## Helm -- Example Application

Helm is a full-stack mobile app built on Keel. It demonstrates what a complete AI-powered super app looks like when you combine Keel's SDUI protocol with a real backend, authentication, calendar, chat, notifications, and workflow automation.

Helm is one example of what you can build with Keel. It is not required to use Keel.

### What Helm adds on top of Keel

- **Python FastAPI backend** with auth, calendar, chat, notifications, and workflow engine
- **React Native (Expo) mobile app** with 7 tab screens, all AI-controllable
- **Draft and approval workflow** -- AI proposes UI changes, user approves or rejects before they go live
- **Standalone PydanticAI agent** that controls the app via MCP tools
- **18 MCP tools** (prefixed `helm_`) for calendar management, screen rendering, notifications, tab control, etc.

### Running Helm

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload --port 9000

# Frontend
cd mobile
npm install
npx expo start

# Standalone agent (optional)
source backend/.venv/bin/activate
cd agent && python helm_agent.py --web    # http://localhost:7860
```

Create `Helm/.env` with at minimum:
```env
OPENROUTER_API_KEY=sk-or-...
SECRET_KEY=your-secret-key-here
```

See [`docs/codebase-explanation/OPERATIONS.md`](docs/codebase-explanation/OPERATIONS.md) for the full setup guide.

### Helm backend tests

```bash
cd backend && source .venv/bin/activate && pytest   # 55 tests
```

---

## Project Structure

```
Helm/
├── packages/                       # Keel framework (standalone, publishable)
│   ├── protocol/                   # @keel/protocol — types + Zod schemas
│   ├── renderer/                   # @keel/renderer — React Native renderer + presets
│   └── server/                     # keel-server — Python MCP + WebSocket utilities
├── examples/
│   └── keel-demo/                  # Runnable demo app (Paper preset)
├── backend/                        # Helm example app — Python FastAPI backend
│   ├── app/
│   │   ├── main.py                 # FastAPI app entry point
│   │   ├── routers/                # REST + WebSocket endpoints
│   │   ├── services/               # Agent proxy, workflow engine, auth
│   │   ├── models/                 # SQLAlchemy ORM (9 models)
│   │   └── mcp/                    # MCP server + 18 tool implementations
│   └── tests/                      # 55 pytest-asyncio tests
├── mobile/                         # Helm example app — React Native frontend
│   ├── app/                        # Expo Router screens (7 tabs)
│   └── src/
│       ├── components/             # SDUI components (atomic, structural, composite)
│       ├── renderer/               # Component registry
│       ├── hooks/                  # useSDUIScreen, useActionDispatcher
│       └── types/                  # TypeScript SDUI + API types
├── agent/                          # Helm standalone PydanticAI agent
│   ├── helm_agent.py               # REPL / web / one-shot modes
│   └── api_server.py               # External agent HTTP service
├── docs/
│   └── codebase-explanation/       # Detailed technical docs
└── CLAUDE.md                       # AI agent + contributor instructions
```

---

## Documentation

| Document | Description |
|----------|-------------|
| [`packages/protocol/README.md`](packages/protocol/README.md) | Keel protocol types, actions, validation schemas |
| [`packages/renderer/README.md`](packages/renderer/README.md) | Renderer architecture, presets, component registry |
| [`packages/server/README.md`](packages/server/README.md) | Python server toolkit, MCP factory, WebSocket manager |
| [`examples/keel-demo/README.md`](examples/keel-demo/README.md) | How to run the demo app |
| [`docs/codebase-explanation/`](docs/codebase-explanation/) | Helm app internals (backend, frontend, protocol, agents) |
| [`CLAUDE.md`](CLAUDE.md) | Contributor instructions and coding conventions |

---

## Contributing

See [CLAUDE.md](CLAUDE.md) for full contribution rules. Key points:

- Never commit directly to `main` -- branch + PR always
- Fix root causes, not symptoms
- Write a failing test before changing production code
- Verify with live testing before merging

---

## License

MIT
