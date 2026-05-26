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

## Subagents

Invoke via Agent chat (e.g. “use helm-backend subagent”) or `/helm-backend` when available.

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
