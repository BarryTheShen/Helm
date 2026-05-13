# OpenCode Model Policy

This document defines Helm's model routing strategy for OpenCode. DeepSeek is the primary model family; local Qwen is an optional fallback.

## 1. Project Policy

- **Primary model source:** OpenCode Go (user-managed provider credentials).
- **Default worker/orchestrator model:** DeepSeek V4 Flash via OpenCode Go.
- **Reasoning/planning/review/security model:** DeepSeek V4 Pro via OpenCode Go.
- **Visual/UI:** Qwen3.6 Plus via OpenCode Go.
- **Local fallback:** Qwen3.6 27B (optional — too slow to be default for routine work).
- **MiMo:** No longer used as default. Was removed due to runtime looping and overcomplication in Helm.
- **No Claude fallback** in this repo's default guidance.
- **No OpenRouter default** — cost is too high for routine agent work.
- **No provider secrets** committed to the repo.

## 2. Local Model

| Setting | Value |
|---------|-------|
| Model | `qwen3.6-27b-autoround` |
| Host | `192.168.110.26:8000` |
| Protocol | OpenAI-compatible (`/v1`) |
| Base URL | `http://192.168.110.26:8000/v1` |
| Role | Optional fallback/private/local — not the default for any role |

If the endpoint is unreachable from the dev machine, it is expected (network-dependent) but the configuration should not break — the agent will fall back to whatever the user has configured.

## 3. Model Tier Strategy

Four model tiers route work by role:

| Tier | Model ID | Roles |
|------|----------|-------|
| **Default** | `opencode-go/deepseek-v4-flash` | orchestrator, session-init, build, backend, frontend, agent-runtime, tester, docs, git |
| **Reasoning** | `opencode-go/deepseek-v4-pro` | planner, plan-critic, reviewer, security, protocol |
| **Visual/UI** | `opencode-go/qwen3.6-plus` | ui-reviewer (screenshots, visual regressions, exhaustive page sweep, live visual testing) |
| **Local fallback** | `local/qwen3.6-27b-autoround` | tester fallback, private/local work, cost-sensitive tasks |

### Why two DeepSeek variants?

- **DeepSeek V4 Flash** is the fast default — used for the orchestrator (which delegates but doesn't reason deeply about code) and all worker agents (which implement, test, document, and commit).
- **DeepSeek V4 Pro** is the reasoning variant — used for planner, plan-critic, reviewer, security, and protocol agents, which need deeper analysis and verification before reaching conclusions.

### Why MiMo was removed

MiMo V2.5 Pro was initially configured as the reasoning model. In practice it showed runtime looping behavior and a tendency to overcomplicate tasks in Helm's agent context. DeepSeek V4 Pro provides comparable reasoning quality without these issues.

### Why Kimi K2.6 was replaced for UI review

Kimi K2.6 was initially configured as the multimodal model for UI review. It was replaced with Qwen3.6 Plus because Kimi K2.6 is too expensive for routine UI review. Qwen3.6 Plus provides sufficient visual reasoning capability at lower cost, making frequent UI review sustainable.

## 4. Agent-to-Model Mapping

| Agent | Model Tier | Model ID |
|-------|-----------|----------|
| `helm-orchestrator` | Default | `opencode-go/deepseek-v4-flash` |
| `helm-session-init` | Default | `opencode-go/deepseek-v4-flash` |
| `helm-planner` | Reasoning | `opencode-go/deepseek-v4-pro` |
| `helm-plan-critic` | Reasoning | `opencode-go/deepseek-v4-pro` |
| `helm-reviewer` | Reasoning | `opencode-go/deepseek-v4-pro` |
| `helm-security` | Reasoning | `opencode-go/deepseek-v4-pro` |
| `helm-protocol` | Reasoning | `opencode-go/deepseek-v4-pro` |
| `helm-ui-reviewer` | Visual/UI | `opencode-go/qwen3.6-plus` |
| `helm-build` | Default | `opencode-go/deepseek-v4-flash` |
| `helm-backend` | Default | `opencode-go/deepseek-v4-flash` |
| `helm-frontend` | Default | `opencode-go/deepseek-v4-flash` |
| `helm-agent-runtime` | Default | `opencode-go/deepseek-v4-flash` |
| `helm-tester` | Default | `opencode-go/deepseek-v4-flash` (fallback: `local/qwen3.6-27b-autoround`) |
| `helm-docs` | Default | `opencode-go/deepseek-v4-flash` |
| `helm-git` | Default | `opencode-go/deepseek-v4-flash` |

Note: `helm-plan-critic` uses the reasoning model (`deepseek-v4-pro`) but only for **targeted** critique (max 8 files per invocation), not broad scanning. This keeps cost proportional.

## 5. Reasoning Effort

OpenCode's config schema does not support `reasoning_effort` as a per-agent or global config key. Instead, reasoning effort is set via **prompt-level instructions** in each agent's prompt body.

Every agent file in `.opencode/agents/*.md` includes a `## Reasoning effort` prompt section:

- **Orchestrator:** "Use maximum reasoning for classification, routing, and decisions. Think carefully before delegating. But do not become indecisive — prefer autonomous reasonable defaults over stopping to ask Barry routine questions."
- **Reasoning agents** (planner, plan-critic, reviewer, security): "Use the highest reasoning effort available. Think carefully before acting. Do not guess. Diagnose root causes before proposing or applying fixes. Challenge your own assumptions."
- **Worker agents** (all others): "Use the highest reasoning effort available. Think carefully before acting. Do not guess. Diagnose root causes before proposing or applying fixes. Keep the final action minimal and proportional to the task."

If a future OpenCode version adds schema-level `reasoning_effort`, it should be set to the maximum supported value and these prompt sections should be removed or shortened.

## 6. Optional Providers

- **OpenCode Go** — Primary daily model source. Barry handles `/connect` and login personally.
- **GitHub Copilot** — User-managed optional backup. Use only if Barry already has a Copilot connection.

Do not add `/connect` walkthroughs, account setup steps, or Claude fallback setup to repo docs. These are personal setup tasks Barry will handle.

## 7. Environment Variables

Set these in your local OpenCode provider config (not in the repo). The examples below use placeholder values:

```bash
# Local model (fallback)
OPENCODE_LOCAL_BASE_URL=http://192.168.110.26:8000/v1
OPENCODE_LOCAL_MODEL=qwen3.6-27b-autoround

# Per-role routing (if your OpenCode version supports it)
OPENCODE_MODEL_PRIMARY=opencode-go/deepseek-v4-flash
OPENCODE_MODEL_WORKER=opencode-go/deepseek-v4-flash
OPENCODE_MODEL_REASONING=opencode-go/deepseek-v4-pro
OPENCODE_MODEL_MINI=opencode-go/deepseek-v4-flash
```

If the local server requires an API key, use a placeholder like `local-dev-key` — not a real secret.

## 8. Config Policy

- `opencode.jsonc` keeps `"model": "opencode-go/deepseek-v4-flash"` as the safe default.
- Per-agent model routing lives in `.opencode/agents/*.md` — each agent declares its `model:` in frontmatter.
- Do not add unverified provider config to `opencode.jsonc`.
