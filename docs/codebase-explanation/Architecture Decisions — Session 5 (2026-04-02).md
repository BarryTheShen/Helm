# Session 5 — 2026-04-02 — AI Generation Guidelines

### Key Decisions + Action Items

- [ ]  Write the AI Generation Guidelines doc — the "instruction manual" that ships as part of the system prompt for Helm's in-app AI agent
- [ ]  Define the **Component Vocabulary** (V2 PascalCase preferred, V1 lowercase legacy) with required/optional props per type
- [ ]  Establish **Template-First Strategy** — AI picks a template when possible, generates custom rows only when no template matches
- [ ]  Create **Few-Shot Example Bank** — 3–5 canonical SDUI JSON examples covering common patterns (dashboard, list, form, detail, empty state)
- [ ]  Define **Common Mistakes Blacklist** — explicit "never do this" rules in the prompt
- [ ]  Decide on **Token Budget Strategy** — template shortcuts, progressive disclosure, component tier gating
- [ ]  Build the **~30 Most Common Icon Names** reference list (Feather icons)
- [ ]  Implement **Structured Output enforcement** — use OpenAI function calling / JSON mode for `set_screen` tool rather than hoping the LLM produces valid JSON

---

### Chat History

**Barry:** Let's start brainstorming about the AI guidelines things. This is the main branch we're working on. Read some of the code about the MCP as we have some progress, but we need to flesh this out. I personally don't have that much experience in terms of prompting it and giving it tools so I also want you to look at the industry standards for these online.

**Jarvis:** I've done a deep read of the entire codebase on `fix/chat-streaming-tool-calls` and researched industry standards. Here's what I found and where we need to go:

---

## 1. Current State Analysis

### What We Have

The codebase already has a solid foundation:

- **18+ MCP tools** in `tools.py` — calendar CRUD, notifications, chat, SDUI screen management, tab visibility, draft workflow
- **`set_screen` tool** with a massive docstring in `server.py` that tries to serve as the component reference (both V1 and V2 schemas documented inline)
- **Normalization layer** (`normalize_sdui_screen()`) that converts flat AI-generated JSON to the `{type, id, props}` schema the frontend expects
- **Draft workflow** — AI always generates drafts, user approves/rejects before going live
- **3-layer validation concept** from Session 2 — constrained input space → template-first → 2-retry cap + template fallback
- **V2 component registry** with 12 registered types: `Text`, `Markdown`, `Button`, `Image`, `TextInput`, `Icon`, `Divider`, `Container`, `CalendarModule`, `ChatModule`, `NotesModule`, `InputBar`

### What's Missing

The current system prompt in `agent_proxy.py` is minimal:

> *"You are Helm, a helpful AI assistant integrated into a personal super app. You have access to tools for calendar management, notifications, and forms. Be concise, helpful, and proactive."*
> 

That's it. No component vocabulary. No layout rules. No few-shot examples. No constraints on what the AI can generate. The `set_screen` tool's docstring is doing all the heavy lifting, but tool descriptions are **not** the right place for generation guidelines — they're for explaining *what the tool does*, not *how to generate good UI*.

The standalone agent in `helm_agent.py` has a system prompt but it's obfuscated in the GitHub view (`[OBFUSCATED PROMPT INJECTION]`).

---

## 2. Industry Research — Key Takeaways

### 2.1 Structured Output Enforcement

The #1 lesson from industry: **don't rely on prompting alone for JSON output.**

<aside>
⚠️

**Critical finding:** OpenAI's Structured Outputs (via `response_format` with JSON Schema) guarantees schema-valid JSON output at the token generation level — not as a post-hoc check. This is fundamentally more reliable than prompting for JSON. Anthropic Claude and Google Gemini have equivalent features.

</aside>

**Current gap in Helm:** The `agent_proxy.py` sends tool definitions with `"tool_choice": "auto"` but the `set_screen` tool's `screen` parameter is typed as a generic `"type": "object"` with a loose schema. We should tighten this with a strict JSON Schema for `SDUIScreen` / `SDUIPage` that the LLM provider enforces.

**Recommendation:** Use the provider's native structured output / function calling enforcement when available. For models that don't support it (like StepFun), the XML fallback + `json_repair` already handles this, but the primary path should be schema-enforced.

### 2.2 Airbnb Ghost Platform Patterns

Airbnb's Ghost Platform is the gold standard for SDUI, and Helm's architecture is already inspired by it. Key parallels and lessons:

- **Component registry as shared contract** — GP uses a `SectionComponentType` enum that both server and client agree on. Helm has `componentRegistry.ts` serving the same purpose. The AI prompt must reference the *exact same vocabulary*.
- **Sections + Screens architecture** — GP's "Sections are independent, reusable UI components; Screens describe their layout and organization." Helm's V2 rows/cells map to this.
- **Alternative renderings** — GP wraps sections in `SectionContainer` with a `SectionComponentType` to enable different visual renderings of the same data. Helm's responsive `compact`/`regular` variants serve the same purpose.
- **Schema versioning** — GP evolved their schema over years. Helm already has a versioning strategy doc.

### 2.3 Constrained Generation (Puck AI Insight)

<aside>
💡

**"AI Slop vs Constrained UI"** — Puck Editor's analysis nails the core problem: *"When generation is unconstrained, the output diverges from design systems, lacks determinism, and requires downstream refactoring. Production-grade generative UI requires predefined component registries, validated schemas, and explicit architectural constraints."*

</aside>

This directly maps to our approach: the AI generation guidelines ARE the constraints.

### 2.4 Prompt Architecture for Agentic Systems

From multiple sources on building production AI agents:

- **Prompting is not a system** — The system prompt is one layer. Combine with: tool definitions, schema validation, retry logic, and fallback templates.
- **Few-shot examples >> explanations** — LLMs learn patterns from examples 10–50% better than from instructions alone.
- **Persona + constraints + examples** — The winning formula for agent prompts: (1) who you are, (2) what you can/cannot do, (3) show me what good looks like.
- **Chain-of-thought for complex generation** — For multi-section screens, prompt the AI to think through the layout before generating JSON.

### 2.5 Vercel v0 Pattern

Vercel's v0 agent (UI generation specialist) uses a massive system prompt with:

- Complete component library reference inline
- Explicit style constraints ("use Tailwind, never inline styles")
- Few-shot examples of good and bad outputs
- Error correction instructions

We should adopt a similar structure for Helm's guidelines.

---

## 3. Proposed AI Generation Guidelines Structure

Here's the outline for the guidelines document. This would live as a dedicated doc (referenced by the system prompt or injected into it):

### 3.1 Component Vocabulary (The Catalog)

**V2 Components (preferred — PascalCase):**

| Tier | Type | Required Props | Optional Props | Has Children? |
| --- | --- | --- | --- | --- |
| Atomic | `Text` | `content` | `variant`, `color`, `bold`, `italic`, `underline`, `align`, `numberOfLines`, `selectable` | No |
| Atomic | `Markdown` | `content` | — | No |
| Atomic | `Button` | `onPress` (action) | `label`, `icon`, `iconPosition`, `variant`, `size`, `fullWidth`, `disabled`, `loading` | No |
| Atomic | `Image` | `src` | `alt`, `resizeMode`, `width`, `height`, `aspectRatio`, `borderRadius`, `placeholder` | No |
| Atomic | `TextInput` | — | `value`, `placeholder`, `multiline`, `maxLines`, `secureTextEntry`, `keyboardType` | No |
| Atomic | `Icon` | `name` | `size`, `color` | No |
| Atomic | `Divider` | — | `direction`, `thickness`, `color`, `indent` | No |
| Structural | `Container` | — | `direction`, `gap`, `padding`, `backgroundColor`, `borderRadius`, `shadow`, `flex`, `align`, `justify` | **Yes** |
| Composite | `CalendarModule` | `events` | `defaultView` | No |
| Composite | `ChatModule` | — | — | No |
| Composite | `NotesModule` | — | — | No |
| Composite | `InputBar` | `onSend` (action) | `placeholder`, `settingsItems`, `maxLines` | No |

**V1 Components (legacy — lowercase, still supported but not preferred):**

`text`, `heading`, `button`, `icon_button`, `divider`, `spacer`, `card`, `container`, `list`, `form`, `alert`, `badge`, `stat`, `stats_row`, `calendar`, `image`, `progress`

<aside>
📌

**Rule:** Always generate V2 (PascalCase, row-by-row) format unless the user explicitly asks for V1. V2 is the preferred format, is responsive by default, and maps 1:1 to the component registry.

</aside>

### 3.2 Template vs Custom Decision Tree

This is the decision logic the AI should follow:

1. **Does a template match?** → Use it. Fill slots. Zero layout tokens.
2. **Is it a minor variation of a template?** → Start from template, modify specific rows.
3. **Is it truly novel?** → Generate custom rows. Use few-shot examples as reference.

**Template shortcuts save tokens dramatically:**

- Template-based: ~50–100 tokens (template name + slot fills)
- Custom generation: ~500–2000 tokens (full row/cell/component JSON)
- That's a 10–20x token reduction.

**Current templates available:**

- `dashboard-home.json` — Two modules side by side (tablet) / stacked (phone)
- More templates TBD (this is an action item from Session 4)

**Proposed starter template set for MVP:**

- `dashboard-2col` — Two modules side by side
- `dashboard-3col` — Three columns (tablet) / stacked (phone)
- `list-detail` — List on top/left, detail on bottom/right
- `form-standard` — Title + form fields + submit button
- `stats-overview` — Stats row + chart placeholder + list
- `empty-state` — Icon + message + CTA button
- `calendar-full` — Full CalendarModule in single row
- `notes-feed` — NotesModule in single row
- `chat-default` — ChatModule in single row

### 3.3 Few-Shot Example Format

Based on industry research, few-shot examples should be:

1. **Minimal but complete** — Show the full valid JSON, not pseudo-code
2. **Annotated** — Brief comment explaining *why* this structure was chosen
3. **Diverse** — Cover different patterns (simple, complex, responsive)
4. **Paired with the user request** — Show input→output pairs

**Example 1: Simple Welcome Screen**

```json
// User: "Make me a welcome page for the home tab"
{
  "schema_version": "1.0.0",
  "module_id": "home",
  "title": "Home",
  "rows": [
    {
      "id": "greeting",
      "cells": [
        {
          "id": "greeting-text",
          "width": "auto",
          "content": {
            "type": "Text",
            "id": "welcome",
            "props": { "content": "Good morning! 👋", "variant": "heading" }
          }
        }
      ]
    },
    {
      "id": "actions",
      "cells": [
        {
          "id": "cal-btn",
          "width": 0.5,
          "content": {
            "type": "Button",
            "id": "view-cal",
            "props": {
              "label": "View Calendar",
              "icon": "calendar",
              "variant": "secondary",
              "onPress": { "type": "navigate", "screen": "calendar" }
            }
          }
        },
        {
          "id": "chat-btn",
          "width": 0.5,
          "content": {
            "type": "Button",
            "id": "open-chat",
            "props": {
              "label": "Chat",
              "icon": "message-circle",
              "variant": "primary",
              "onPress": { "type": "navigate", "screen": "chat" }
            }
          }
        }
      ],
      "compact": { "stack": true },
      "gap": 12
    }
  ]
}
```

**Example 2: Dashboard with Calendar + Notes (Template-based)**

```json
// User: "Set up my home as a dashboard with calendar and notes"
// → Uses dashboard-2col template pattern
{
  "schema_version": "1.0.0",
  "module_id": "home",
  "title": "Dashboard",
  "rows": [
    {
      "id": "modules-row",
      "cells": [
        {
          "id": "cal-cell",
          "width": 0.5,
          "content": {
            "type": "CalendarModule",
            "id": "cal",
            "props": { "defaultView": "month", "events": [] }
          }
        },
        {
          "id": "notes-cell",
          "width": 0.5,
          "content": {
            "type": "NotesModule",
            "id": "notes",
            "props": {}
          }
        }
      ],
      "compact": { "stack": true },
      "regular": {},
      "gap": 16
    }
  ]
}
```

### 3.4 Common Mistakes Blacklist

These should be explicit "NEVER" rules in the system prompt:

1. **❌ Never use a component type not in the registry** — If it's not in the vocabulary table, the frontend will show a blank fallback. No `Chart`, no `Table`, no `Video` — they don't exist yet.
2. **❌ Never omit `id` fields** — Every row, cell, and component needs a unique `id`. The normalizer generates UUIDs as fallback, but explicit IDs are better for stability.
3. **❌ Never use lowercase types in V2** — `text` ≠ `Text`. V2 uses PascalCase. Lowercase types are V1-only and won't resolve in the V2 component registry.
4. **❌ Never set `draft: false`** — The code in `tools.py` already strips this (`args.pop("draft", None)`), but the AI should never attempt to bypass the draft workflow.
5. **❌ Never generate screens without `schema_version`** — V2 requires `"schema_version": "1.0.0"`, V1 requires `"schema_version": 1`.
6. **❌ Never nest composites inside composites** — `CalendarModule` inside `Container` inside `CalendarModule` = broken. Composites are leaf nodes (except `Container`).
7. **❌ Never use `Image` without sizing constraints** — Always provide `aspectRatio` or explicit `width`/`height`. Unconstrained images blow out layouts.
8. **❌ Never generate more than 10 rows** — Screens with too many rows are slow to render and overwhelming. If you need more content, use scrollable rows or pagination.
9. **❌ Never hardcode user data** — Use tool calls (e.g., `read_calendar`) to fetch data, then populate components. Don't invent fake events or notes.
10. **❌ Never use `api_call` action type** — It's legacy. Use `server_action` with registered function names instead.

### 3.5 Token Budget Strategy

**The Problem:** SDUI JSON is verbose. A moderately complex home screen can be 1500+ tokens of JSON. At scale, this eats into context windows and costs money.

**Strategy 1: Template Shortcuts (Primary)**

As described in 3.2 — templates are the #1 token saver.

**Strategy 2: Progressive Disclosure**

Don't generate the entire screen in one shot. Generate:

1. First: the screen skeleton (rows + cells with placeholder components)
2. Then: populate data-dependent components via follow-up tool calls

This keeps each tool call small and focused.

**Strategy 3: Component Tier Gating**

Only include composite components (`CalendarModule`, `ChatModule`, `NotesModule`) by name — the frontend handles all their internal complexity. The AI never generates the internal structure of composites, just drops them in as black boxes with configuration props.

**Strategy 4: Diff Updates (Future)**

Instead of regenerating the full screen, support partial updates — e.g., "update row X, cell Y" — reducing the JSON payload from 1500 tokens to ~100 tokens. This requires backend support (not yet implemented).

### 3.6 System Prompt Structure

Proposed system prompt architecture (layered):

```
[Layer 1: Identity]
You are Helm, a personal AI assistant inside a mobile super app.
You can build and modify the app's UI using Server-Driven UI (SDUI).

[Layer 2: Constraints]
- Always use V2 row-by-row format (PascalCase components)
- Always generate drafts (never bypass approval)
- Only use components from the registered vocabulary
- Follow the common mistakes blacklist

[Layer 3: Component Reference]
<component_catalog>
  ... (the vocabulary table from 3.1)
</component_catalog>

[Layer 4: Templates]
<templates>
  ... (available template patterns)
</templates>

[Layer 5: Few-Shot Examples]
<examples>
  ... (3-5 input→output pairs from 3.3)
</examples>

[Layer 6: Tool Descriptions]
(Handled by tool definitions — keep tool docstrings focused on
what/when, not how to generate good UI)
```

**Token budget for the system prompt itself:**

- Layer 1–2: ~200 tokens (identity + rules)
- Layer 3: ~400 tokens (component catalog, compressed)
- Layer 4: ~300 tokens (template names + slot descriptions)
- Layer 5: ~800 tokens (3 concise examples)
- Layer 6: handled by tool definitions, not system prompt
- **Total: ~1700 tokens** — reasonable for a system prompt

### 3.7 The ~30 Most Common Feather Icon Names

For the V2 `Icon` component and `Button` icon props:

`home`, `calendar`, `message-circle`, `bell`, `settings`, `user`, `search`, `plus`, `minus`, `check`, `x`, `arrow-left`, `arrow-right`, `chevron-down`, `chevron-up`, `edit`, `trash-2`, `star`, `heart`, `bookmark`, `clock`, `map-pin`, `phone`, `mail`, `camera`, `image`, `file-text`, `download`, `upload`, `refresh-cw`, `eye`, `eye-off`, `lock`, `unlock`, `info`, `alert-triangle`, `zap`

---

## 4. Open Questions for Next Steps

1. **Should the component catalog go in the system prompt or be injected as a tool resource?** Putting it in the system prompt means it's always available but costs tokens every turn. Injecting it as a tool resource means the AI fetches it on-demand.
2. **How strict should schema enforcement be?** We can use OpenAI's strict JSON Schema mode for `set_screen`, but models like StepFun don't support it. Do we maintain two code paths?
3. **Should we implement a `get_component_catalog` tool?** The AI could call this to refresh its knowledge of available components, which would be useful after app updates add new component types.
4. **V1 deprecation timeline?** The codebase supports both V1 and V2. Should the AI guidelines only teach V2, or should we include V1 as a fallback for when simpler models can't handle V2's structure?
5. **Chain-of-thought before generation?** For complex screens, should we prompt the AI to reason about layout before generating JSON? ("Think step by step: What components does this need? How should they be arranged for phone vs tablet?")

---

### Summary

The AI Generation Guidelines should be a single, well-structured document that serves as the "instruction manual" for Helm's AI agent. It bridges the gap between the minimal system prompt we have now and the sophisticated SDUI generation capability we need. The key insight from industry research is: **constraints enable creativity** — the more precisely we define what the AI *can* do, the better it generates within those bounds.

Next session: Write the actual guidelines document, integrating the template set and few-shot examples into a deployable system prompt.

---

## 5. Barry's Feedback + Revised Decisions

### 2.1 → PydanticAI `output_type` for Structured Output (Model-Agnostic)

**Barry's point:** Won't be using OpenAI models (too expensive). PydanticAI has a system where the AI calls an "output tool" to finish — can we use that?

**Jarvis:** You're understanding it correctly. I checked the PydanticAI docs and this is exactly the right approach for Helm:

PydanticAI's `output_type` mechanism works by registering a Pydantic model as a **special output tool**. The model is *forced* to call this tool to finish a run, and PydanticAI validates the arguments against the Pydantic schema. If validation fails, it can automatically retry via `ModelRetry`.

**Why this is perfect for Helm:**

- **Model-agnostic** — It works via standard tool calling, not provider-specific features like OpenAI's `response_format`. Any model that supports tool calling (which is basically all of them) will work.
- **Schema-enforced** — Define an `SDUIPage` Pydantic model, and the agent is forced to produce valid SDUI JSON as its output. Validation is automatic.
- **Retry-capable** — If the model produces invalid JSON (wrong component type, missing required prop), PydanticAI can raise `ModelRetry` with an error message and the model tries again.
- **Already in the stack** — `helm_agent.py` already uses PydanticAI. This is just using it more effectively.

**Concrete implementation:**

```python
from pydantic import BaseModel
from pydantic_ai import Agent, ModelRetry, RunContext

class SDUICell(BaseModel):
    id: str
    width: float | str = "auto"
    content: dict  # component with type, id, props

class SDUIRow(BaseModel):
    id: str
    cells: list[SDUICell]
    compact: dict | None = None
    regular: dict | None = None
    scrollable: bool = False
    gap: int | None = None

class SDUIPage(BaseModel):
    schema_version: str = "1.0.0"
    module_id: str
    title: str
    rows: list[SDUIRow]
    generated_at: str | None = None

# Agent forces the model to output valid SDUIPage
agent = Agent(
    model,
    output_type=SDUIPage,  # ← This is the key line
    tools=[...],  # MCP tools
)
```

The model must call the output tool with valid `SDUIPage` JSON to finish the run. No hoping, no XML fallback needed — it's structurally enforced.

<aside>
✅

**Decision:** Use PydanticAI's `output_type` with an `SDUIPage` Pydantic model for structured SDUI output. This replaces the OpenAI-specific structured output recommendation. Model-agnostic, validation-enforced, retry-capable.

</aside>

**However — MCP context note:** This applies when using PydanticAI as the agent framework (standalone agent mode). When an *external* agent connects via MCP, the MCP tool definitions (`helm_set_screen`) are the enforcement layer — the external agent calls the tool and passes JSON, which gets validated + normalized server-side. The PydanticAI approach and the MCP approach are complementary, not competing.

### 2.5 → Vercel v0 Pattern: Too Token-Heavy

**Barry's point:** Wouldn't v0's massive system prompt take up too many tokens and confuse agents?

**Jarvis:** You're right. v0's approach is designed for a single-purpose code-generation agent with a massive context window — it can afford a 10,000+ token system prompt because code generation is all it does. Helm's situation is different:

- External agents connect via MCP — they bring their *own* system prompts and context
- Helm's MCP tools should be self-describing through good tool docstrings
- Stuffing a giant component reference into the system prompt wastes tokens on every turn, even when the user is just asking about their calendar

<aside>
✅

**Decision:** Don't adopt v0's "everything in the system prompt" pattern. Instead, rely on well-crafted MCP tool descriptions as the primary interface for external agents. Keep the component vocabulary in the `helm_set_screen` tool docstring where it already is — just make it better.

</aside>

### 3.6 → MCP-First Architecture, V2 Only

**Barry's point:** This should be MCP-connected to external agents. There shouldn't be an internal agent — the point is anyone can connect their external agent. Also, just use V2 — don't mention V1 at all.

**Jarvis:** This is a fundamental architecture correction. The guidelines should NOT be written as a "system prompt for Helm's built-in AI agent." They should be written as **MCP tool documentation** that any external agent can consume.

This changes the entire framing:

- ~~System prompt layers~~ → **MCP tool descriptions** are the interface
- ~~Internal agent identity~~ → External agents bring their own identity
- ~~V1/V2 dual support~~ → **V2 only** (the row-by-row format with PascalCase components)
- The guidelines doc becomes a **reference for MCP tool consumers**, not an instruction set for a specific agent

The `helm_set_screen` tool docstring is already the main place where component vocabulary lives. The guidelines should improve that docstring and the overall MCP tool surface, not create a separate system prompt.

<aside>
✅

**Decision:** MCP-first architecture. Guidelines are for external agent consumers, not an internal agent. V2 only — purge all V1 references from tool descriptions and documentation. The current codebase version is effectively V3.

</aside>

### 4.1 → Token Savings > Always-Available Catalog

**Barry's point:** Prefer saving tokens. Not a major decision.

<aside>
✅

**Decision:** Component catalog lives in the `helm_set_screen` tool description (where it already is). Not injected into every conversation turn. Token efficiency wins.

</aside>

### 4.2 → Model-Agnostic Approach

**Barry's point:** Don't reference specific providers. Model-agnostic.

<aside>
✅

**Decision:** All structured output enforcement must be model-agnostic. PydanticAI's `output_type` (tool-calling based) is the primary mechanism. No OpenAI-specific, Anthropic-specific, or any provider-specific code paths. Works with any model that supports tool calling.

</aside>

### 4.3 → MCP Server Self-Updates (No Separate Catalog Tool)

**Barry's point:** Why not just let the MCP server update itself when components change?

**Jarvis:** Exactly right. The MCP server's tool list already reflects the current component vocabulary through the `helm_set_screen` docstring. When a new component is added:

1. Register it in `componentRegistry.ts`
2. Update the `helm_set_screen` docstring in `server.py`
3. Any connected MCP client automatically sees the updated tool definition

No need for a separate `get_component_catalog` tool — that's redundant with the tool definition itself.

<aside>
✅

**Decision:** No `get_component_catalog` tool. The MCP tool definitions are self-describing. When components change, update the tool docstring in `server.py` and connected agents see it automatically.

</aside>

### 4.4 → V2 Only (Current = V3)

**Barry's point:** Just use V2. What we're working on now is more like V3.

<aside>
✅

**Decision:** V2 (row-by-row, PascalCase) is the only format. All V1 references, legacy support mentions, and fallback paths should be removed from guidelines and tool descriptions. Internally, this work represents the next evolution of the schema.

</aside>

### 4.5 → No Explicit Chain-of-Thought Needed

**Barry's point:** These are reasoning models already. Do they need explicit CoT prompting?

**Jarvis:** Good point. Modern reasoning models (DeepSeek-R1, Qwen3, GPT-4o, Claude) already do internal chain-of-thought. Adding explicit "think step by step" instructions is redundant and wastes tokens. The StepFun model you're using (`stepfun/step-3.5-flash`) even has a `delta.reasoning` field in its streaming output — it's already thinking.

<aside>
✅

**Decision:** No explicit chain-of-thought prompting in guidelines. Reasoning models handle this internally. Don't waste tokens on it.

</aside>

---

## 6. Revised Action Items

Based on Barry's feedback, the updated action items are:

- [ ]  **Rewrite `helm_set_screen` tool docstring** — V2 only, clean component catalog, good examples. This IS the guidelines for external agents.
- [ ]  **Define `SDUIPage` Pydantic model** — For PydanticAI `output_type` enforcement in standalone agent mode. Includes `SDUIRow`, `SDUICell`, and component validation.
- [ ]  **Purge all V1 references** — From `server.py` tool descriptions, `agent_proxy.py` tool definitions, and `helm_agent.py` system prompt. V2 only.
- [ ]  **Improve MCP tool descriptions across all 18+ tools** — Self-describing, model-agnostic, token-efficient.
- [ ]  **Create few-shot examples** — 2-3 concise V2 JSON examples embedded in the `helm_set_screen` docstring.
- [ ]  **Define starter template set** — 5-9 template JSON files in `src/templates/`.
- [ ]  **Add server-side SDUI validation** — Validate component types against registry before storing. Return clear error messages that any agent can act on.
- [ ]  **Update common mistakes blacklist** — Embed the most critical rules in tool descriptions (not a separate doc).