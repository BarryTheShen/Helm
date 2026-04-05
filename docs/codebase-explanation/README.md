# Codebase Explanation

Documentation that explains how the Helm codebase actually works — what exists today, not what the specs say should exist.

## Running & Configuring the Stack

| Document | Purpose |
|----------|---------|
| [OPERATIONS.md](OPERATIONS.md) | **Start here.** How to run backend + frontend, all API keys (OpenRouter, OpenAI, Ollama), `.env` reference (note: `.env` lives at repo root, not `backend/`), common troubleshooting. |

## For Humans

Each doc has three tiers:
- **Tier 1 (TLDR)** — 30 second overview
- **Tier 2 (Deeper)** — Architecture diagrams, key components, how things connect
- **Tier 3 (Extensive)** — File-by-file breakdown, every detail, known bugs

| Document | What It Covers |
|----------|---------------|
| [backend.md](backend.md) | Python FastAPI server — API endpoints, database, auth, services |
| [frontend.md](frontend.md) | React Native Expo app — screens, navigation, SDUI, state management |
| [protocol.md](protocol.md) | REST API contracts, WebSocket message types, MCP tools, SDUI schema |
| [agents-and-systems.md](agents-and-systems.md) | AI Agent Proxy, MCP Server, Workflow Engine, standalone PydanticAI agent (`agent/`), testing infrastructure |
| [FUTURE_PLANS.md](FUTURE_PLANS.md) | Planned features, known gaps, and improvement roadmap |

## For AI Agents

| Document | Purpose |
|----------|---------|
| [AI-TECHNICAL-REFERENCE.md](AI-TECHNICAL-REFERENCE.md) | **Read this first.** File map, data flow diagrams, known bugs, patterns to follow. |

The AI reference is designed to be loaded at the start of any coding session so the AI knows exactly where everything is and what the current pitfalls are.
