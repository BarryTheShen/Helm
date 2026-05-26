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

## Models (per subagent)

**Yes.** Each file in `.cursor/agents/*.md` can set a different model in YAML frontmatter:

```yaml
---
name: helm-ui-reviewer
description: ...
model: inherit   # use parent chat model (default today)
readonly: true
---
```

| Value | Meaning |
|-------|---------|
| `inherit` | Same model as the parent Agent chat (all Helm agents use this today). |
| A Cursor model id / name | That subagent run uses the named model (exact string depends on your plan — e.g. a faster model for `helm-build`, a stronger multimodal model for `helm-ui-reviewer`). |

Example override for visual review only:

```yaml
model: claude-sonnet-4-20250514
```

(Use the model picker in Cursor → copy the id your account exposes.)

There is **no** central `opencode.jsonc`-style default model list in Cursor — routing is **per subagent file** (or whatever model you pick for the main chat). `docs/ai/opencode-models.md` is legacy reference only.

**MCP Context7:** set `CONTEXT7_API_KEY` in repo-root `.env` (gitignored). `.cursor/mcp.json` loads it via `envFile`. Reload Window after changing `.env`.

## OpenCode (legacy)

`opencode.jsonc` and `.opencode/` are kept until Cursor parity is confirmed. Do not add new OpenCode-only agents there — add under `.cursor/` instead.

## Local git

Work on `dev` or a feature branch. Never push to `main`. Use `helm-git` or `/helm-ship` after verification.
