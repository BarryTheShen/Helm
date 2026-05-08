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

## 3. Routing Recommendation

| Role | Model |
|------|-------|
| Default / build | Local `qwen3.6-27b-autoround` |
| Worker agents (backend, frontend, agent-runtime) | Local model |
| Planner / reviewer | Local first; user-selected backup only when local model is insufficient |
| Docs / git / simple tasks | Local or cheapest already-configured model |

Paid providers should never be silently selected by repo config.

## 4. Optional Providers

- **OpenCode Go** — User-managed optional backup. Barry handles `/connect` and login personally.
- **GitHub Copilot** — User-managed optional backup. Use only if Barry already has a Copilot connection.

Do not add `/connect` walkthroughs, account setup steps, or Claude fallback setup to repo docs. These are personal setup tasks Barry will handle.

## 5. Environment Variables

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

## 6. Config Policy

- `opencode.jsonc` should not hardcode expensive Anthropic/OpenRouter models.
- If safe provider config syntax is unclear for a given OpenCode version, prefer docs-only guidance over broken config.
- Do not add unverified provider config to `opencode.jsonc`.
