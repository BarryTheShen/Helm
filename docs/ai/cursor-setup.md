# Cursor Setup — Helm

Helm’s AI workflow is configured for **Cursor** (local Agent + subagents). OpenCode config (`.opencode/`, `opencode.jsonc`) remains during transition but **Cursor is canonical** for day-to-day work.

## Layout

| Path | Purpose |
|------|---------|
| `AGENTS.md` | Portable source of truth (all tools) |
| `.cursor/rules/*.mdc` | Always-on and file-scoped rules |
| `.cursor/agents/helm-*.md` | Subagent prompts (from OpenCode roster) |
| `.cursor/commands/*.md` | Slash commands (`/helm-ship`, etc.) |
| `.cursor/skills/*/SKILL.md` | Workflow skills (`add-mcp-tool`, `helm-codebase`, …) |
| `.cursor/mcp.json` | Project MCP servers |
| `docs/ai/workflows.md` | Canonical loop and FF traceability |
| `.helm-sessions/current/` | Per-task session artifacts (gitignored) |

## MCP

Configure in `.cursor/mcp.json`:

| Server | Use |
|--------|-----|
| **playwright** | Browser automation for UI QA and visual review |
| **context7** | Up-to-date library docs — set `CONTEXT7_API_KEY` in your environment |

Install Playwright browsers once: `cd qa && npx playwright install chromium`

## Hot reload — do you need to restart?

| Change | What to do |
|--------|------------|
| `.cursor/rules/*.mdc`, agents, commands, skills | **New Agent chat** usually picks this up. If behavior looks stale, **Developer: Reload Window** once. |
| `.cursor/mcp.json` | Reload Window, or toggle MCP servers in **Settings → MCP**. |
| `AGENTS.md` / `docs/ai/*` | New chat (rules reference these paths). |
| **Cloud / background agent worker** | Start a **new agent run** after pulling config commits — long-running workers do not always hot-reload mid-flight. |
| This chat (already running) | May still follow **old** instructions until the run ends. Prefer a **new chat** after pulling `dev`. |

There is no separate “restart orchestrator service” on desktop — the Agent session is the unit of reload.

## How the orchestrator is selected

**There is no OpenCode-style `default_agent` in Cursor.**

| Mode | Behavior |
|------|----------|
| **Default (recommended)** | Open a normal **Agent** chat in this repo. `.cursor/rules/helm-core.mdc` is `alwaysApply: true`, so the main Agent **is** the orchestrator (classify → delegate → verify). |
| **Explicit** | Type **`/helm-orchestrate`** plus your task, or ask: “Follow helm-orchestrator for: …” |
| **Subagent file** | Invoke **`helm-orchestrator`** as a subagent when the parent should delegate-only (readonly). |

You do **not** pick `helm-orchestrator` from a separate “primary agent” dropdown unless your Cursor build exposes custom agents in the picker — day-to-day, use normal Agent + rules.

## Subagents

Invoke via “use helm-backend subagent”, the subagent picker, or parallel launches in one turn (see orchestrator parallel policy).

| Agent | Role |
|-------|------|
| `helm-orchestrator` | Classify, delegate, verify — does not edit app source |
| `helm-session-init` | Archive/init `.helm-sessions/` |
| `helm-planner` / `helm-plan-critic` | Plan ↔ critique |
| `helm-requirements-auditor` | FF requirements ledger + slices |
| `helm-build` / `helm-backend` / `helm-frontend` / `helm-agent-runtime` | Implementation |
| `helm-protocol` | API/WS/MCP/SDUI contracts |
| `helm-tester` / `helm-reviewer` / `helm-ui-reviewer` / `helm-security` | Advisory QA |
| `helm-docs` | Documentation |
| `helm-git` | Branch, commit, push |

## Models

Subagents use `model: inherit` (your Cursor model). Adjust per-agent frontmatter if you want a specific model for UI review or planning.

## OpenCode (legacy)

`opencode.jsonc` and `.opencode/` are kept until Cursor parity is confirmed. Do not add new OpenCode-only agents there — add under `.cursor/` instead.

## Local git

Work on `dev` or a feature branch. Never push to `main`. Use `helm-git` or `/helm-ship` after verification.
