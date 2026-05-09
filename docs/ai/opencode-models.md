# OpenCode Model Policy

This document defines Helm's local-first model policy for OpenCode. The goal is to avoid silently defaulting to paid providers.

## 1. Project Policy

- **Default path:** Local model first for all agent roles.
- **Optional backup:** OpenCode Go or GitHub Copilot if Barry has already connected them personally.
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
| Verified | 2026-05-08 — `curl http://192.168.110.26:8000/v1/models` returns the model list |

If the endpoint is unreachable from the dev machine, it is expected (network-dependent) but the configuration should not break — the agent will fall back to whatever the user has configured.

## 3. Model Tier Strategy

Three model tiers route work by role:

| Tier | Model | Roles |
|------|-------|-------|
| **Reasoning** | MiMo Pro V2.5 | orchestrator, planner, reviewer, security, protocol |
| **Worker** | DeepSeek V4 Flash | build, backend, frontend, agent-runtime, tester, docs, git |
| **Multimodal** | Kimi 2.6 | ui-reviewer (screenshots, visual regressions) |
| **Local fallback** | local Qwen3.6 27B | tester fallback, private/local work, cost-sensitive tasks |

Paid providers should never be silently selected by repo config.

## 4. Agent-to-Model Mapping

| Agent | Model Tier | Model |
|-------|-----------|-------|
| `helm-orchestrator` | Reasoning | MiMo Pro V2.5 |
| `helm-planner` | Reasoning | MiMo Pro V2.5 |
| `helm-reviewer` | Reasoning | MiMo Pro V2.5 |
| `helm-security` | Reasoning | MiMo Pro V2.5 |
| `helm-protocol` | Reasoning | MiMo Pro V2.5 |
| `helm-ui-reviewer` | Multimodal | Kimi 2.6 |
| `helm-build` | Worker | DeepSeek V4 Flash |
| `helm-backend` | Worker | DeepSeek V4 Flash |
| `helm-frontend` | Worker | DeepSeek V4 Flash |
| `helm-agent-runtime` | Worker | DeepSeek V4 Flash |
| `helm-tester` | Worker | DeepSeek V4 Flash (fallback: local Qwen3.6 27B) |
| `helm-docs` | Worker | DeepSeek V4 Flash |
| `helm-git` | Worker | DeepSeek V4 Flash |

**TODO:** Exact model IDs must be filled after running `opencode models`. The agent files currently contain `TODO-MIMO_PRO_V2_5`, `TODO-DEEPSEEK_V4_FLASH`, and `TODO-KIMI_2_6` placeholders. Barry must replace with actual IDs.

## 5. Optional Providers

- **OpenCode Go** — User-managed optional backup. Barry handles `/connect` and login personally.
- **GitHub Copilot** — User-managed optional backup. Use only if Barry already has a Copilot connection.

Do not add `/connect` walkthroughs, account setup steps, or Claude fallback setup to repo docs. These are personal setup tasks Barry will handle.

## 6. Environment Variables

Set these in your local OpenCode provider config (not in the repo). The examples below use placeholder values:

```bash
# Local model (default)
OPENCODE_LOCAL_BASE_URL=http://192.168.110.26:8000/v1
OPENCODE_LOCAL_MODEL=qwen3.6-27b-autoround

# Per-role routing (if your OpenCode version supports it)
OPENCODE_MODEL_PRIMARY=local/qwen3.6-27b-autoround
OPENCODE_MODEL_WORKER=local/qwen3.6-27b-autoround
OPENCODE_MODEL_PLANNER=local/qwen3.6-27b-autoround
OPENCODE_MODEL_MINI=local/qwen3.6-27b-autoround
```

If the local server requires an API key, use a placeholder like `local-dev-key` — not a real secret.

## 7. Config Policy

- `opencode.jsonc` should not hardcode expensive Anthropic/OpenRouter models.
- If safe provider config syntax is unclear for a given OpenCode version, prefer docs-only guidance over broken config.
- Do not add unverified provider config to `opencode.jsonc`.
