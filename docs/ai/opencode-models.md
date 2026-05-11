# OpenCode Model Policy

This document defines Helm's model routing strategy for OpenCode. OpenCode Go is the primary daily model source; local Qwen remains as fallback/private/local.

## 1. Project Policy

- **Primary model source:** OpenCode Go (user-managed provider credentials).
- **Worker default:** DeepSeek V4 Flash via OpenCode Go.
- **Reasoning/default:** MiMo V2.5 Pro via OpenCode Go.
- **Multimodal:** Kimi K2.6 via OpenCode Go.
- **Local fallback:** Qwen3.6 27B for private/local/cost-sensitive work.
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
| Role | Fallback/private/local — not the primary default for every role |

If the endpoint is unreachable from the dev machine, it is expected (network-dependent) but the configuration should not break — the agent will fall back to whatever the user has configured.

## 3. Model Tier Strategy

Three model tiers route work by role:

| Tier | Model ID | Roles |
|------|----------|-------|
| **Reasoning** | `opencode-go/mimo-v2.5-pro` | orchestrator, planner, plan-critic, reviewer, security, protocol |
| **Worker** | `opencode-go/deepseek-v4-flash` | session-init, build, backend, frontend, agent-runtime, tester, docs, git |
| **Multimodal** | `opencode-go/kimi-k2.6` | ui-reviewer (screenshots, visual regressions) |
| **Local fallback** | `local/qwen3.6-27b-autoround` | tester fallback, private/local work, cost-sensitive tasks |

## 4. Agent-to-Model Mapping

| Agent | Model Tier | Model ID |
|-------|-----------|----------|
| `helm-orchestrator` | Reasoning | `opencode-go/mimo-v2.5-pro` |
| `helm-planner` | Reasoning | `opencode-go/mimo-v2.5-pro` |
| `helm-plan-critic` | Reasoning | `opencode-go/mimo-v2.5-pro` |
| `helm-reviewer` | Reasoning | `opencode-go/mimo-v2.5-pro` |
| `helm-security` | Reasoning | `opencode-go/mimo-v2.5-pro` |
| `helm-protocol` | Reasoning | `opencode-go/mimo-v2.5-pro` |
| `helm-ui-reviewer` | Multimodal | `opencode-go/kimi-k2.6` |
| `helm-session-init` | Worker | `opencode-go/deepseek-v4-flash` |
| `helm-build` | Worker | `opencode-go/deepseek-v4-flash` |
| `helm-backend` | Worker | `opencode-go/deepseek-v4-flash` |
| `helm-frontend` | Worker | `opencode-go/deepseek-v4-flash` |
| `helm-agent-runtime` | Worker | `opencode-go/deepseek-v4-flash` |
| `helm-tester` | Worker | `opencode-go/deepseek-v4-flash` (fallback: `local/qwen3.6-27b-autoround`) |
| `helm-docs` | Worker | `opencode-go/deepseek-v4-flash` |
| `helm-git` | Worker | `opencode-go/deepseek-v4-flash` |

Note: `helm-plan-critic` uses expensive reasoning (`mimo-v2.5-pro`) but only for **targeted** critique (max 8 files per invocation), not broad scanning. This keeps cost proportional.

## 5. Optional Providers

- **OpenCode Go** — Primary daily model source. Barry handles `/connect` and login personally.
- **GitHub Copilot** — User-managed optional backup. Use only if Barry already has a Copilot connection.

Do not add `/connect` walkthroughs, account setup steps, or Claude fallback setup to repo docs. These are personal setup tasks Barry will handle.

## 6. Environment Variables

Set these in your local OpenCode provider config (not in the repo). The examples below use placeholder values:

```bash
# Local model (fallback)
OPENCODE_LOCAL_BASE_URL=http://192.168.110.26:8000/v1
OPENCODE_LOCAL_MODEL=qwen3.6-27b-autoround

# Per-role routing (if your OpenCode version supports it)
OPENCODE_MODEL_PRIMARY=opencode-go/mimo-v2.5-pro
OPENCODE_MODEL_WORKER=opencode-go/deepseek-v4-flash
OPENCODE_MODEL_PLANNER=opencode-go/mimo-v2.5-pro
OPENCODE_MODEL_MINI=opencode-go/deepseek-v4-flash
```

If the local server requires an API key, use a placeholder like `local-dev-key` — not a real secret.

## 7. Config Policy

- `opencode.jsonc` keeps `"model": "local/qwen3.6-27b-autoround"` as the safe fallback.
- Per-agent model routing lives in `.opencode/agents/*.md` — each agent declares its `model:` in frontmatter.
- Do not add unverified provider config to `opencode.jsonc`.
