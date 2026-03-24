# Blueprint — Production Spec Documents

This page contains the three production-ready specification documents for the Agentic AI Super App. These specs are designed to be handed directly to a vibe coding agent for full implementation.

> **All architecture decisions were finalized in [Session 1](Brainstorming%20Sessions/Session%201%20%E2%80%94%202026-03-23%20%E2%80%94%20Blueprint%20Gap%20Analysis%20fo%20c219cbb1b8114434b652e2e57a1ccb72.md).** These specs translate those decisions into implementation-ready detail.
> 

### Documents

1. **Frontend Spec** — React Native / Expo app, SDUI renderer, navigation, component catalog, design system, first-launch flow
2. **Backend Spec** — Python FastAPI server, SQLAlchemy/SQLite, auth, MCP server, workflow engine, Docker deployment
3. **Protocol Spec** — OpenAI-compatible API integration, MCP tool definitions, WebSocket message format, error handling

### How to Use These Specs

Each spec is a self-contained document. A vibe coding agent should:

1. Read all three specs fully before writing any code
2. Start with the **Backend Spec** (the brain)
3. Then **Protocol Spec** (the communication layer)
4. Then **Frontend Spec** (the renderer)

### Architecture Summary

```
┌─────────────────┐      ┌──────────────────────────┐       ┌───────────────────┐
│  iOS App (RN)   │      │    Backend Server         │       │ External AI Agent │
│                 │ WS   │    (Python/FastAPI)       │       │ (user's own)      │
│  Pure SDUI      │◄───►│                           │  API  │                   │
│  renderer       │      │  - SQLite/SQLAlchemy      │─────►│  OpenAI-compat    │
│                 │      │  - Auth + sessions        │       │  API endpoint     │
│  Renders JSON   │      │  - Workflow engine         │  MCP  │                   │
│  from server    │      │  - MCP Server (built-in)  │◄─────│  Calls tools to   │
│                 │      │                           │       │  modify UI/data   │
└─────────────────┘      └──────────────────────────┘       └───────────────────┘
```

---

*Sub-pages below contain the full specs:*

[Frontend Spec — iOS App (React Native / Expo)](Blueprint%20%E2%80%94%20Production%20Spec%20Documents/Frontend%20Spec%20%E2%80%94%20iOS%20App%20(React%20Native%20Expo)%208dc82fa5b83b4febb74bec26e4cb42c3.md)

[Backend Spec — Python FastAPI Server](Blueprint%20%E2%80%94%20Production%20Spec%20Documents/Backend%20Spec%20%E2%80%94%20Python%20FastAPI%20Server%204cd5fe4fda994d6292a1c4b8135049c3.md)

[Protocol Spec — Communication Layer](Blueprint%20%E2%80%94%20Production%20Spec%20Documents/Protocol%20Spec%20%E2%80%94%20Communication%20Layer%20acac8b3a316d480aa493c5fe03248980.md)