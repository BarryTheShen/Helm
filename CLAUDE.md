# Helm — AI Instructions (compat)

**Read [AGENTS.md](AGENTS.md) first.** That is the primary source of truth.

Helm uses **Cursor** for AI development. Configuration:

| What | Where |
|------|--------|
| Rules | `.cursor/rules/` |
| Subagents | `.cursor/agents/helm-*.md` |
| Commands | `.cursor/commands/` |
| Skills | `.cursor/skills/` |
| MCP | `.cursor/mcp.json` |
| Workflows | `docs/ai/workflows.md` |
| Setup | `docs/ai/cursor-setup.md` |

OpenCode (`.opencode/`, `opencode.jsonc`) is legacy during transition — do not add new agents there.

## Entry points

| File | When |
|------|------|
| [AGENTS.md](AGENTS.md) | Every session |
| [docs/codebase-explanation/AI-TECHNICAL-REFERENCE.md](docs/codebase-explanation/AI-TECHNICAL-REFERENCE.md) | File map, patterns |
| [docs/codebase-explanation/OPERATIONS.md](docs/codebase-explanation/OPERATIONS.md) | Ports, services |
| [docs/ai/](docs/ai/README.md) | Workflows, agents |

## Patterns

- **Canonical loop:** session init → context → plan ↔ critic → implement → QA/review → live test → docs → helm-git
- **Task-size depth:** Same loop; shallow or deep per step — see `docs/ai/workflows.md`
- **Context7:** MCP for library docs
- **Backend 8000**, Web **5174**, Agent **7860**
