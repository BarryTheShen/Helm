# SDUI Schema Versioning Strategy

**Status:** Strategy defined — needs implementation.

**Priority:** Highest deployment concern. Must be in place before any real multi-version usage.

**Repo location:** `docs/sdui-versioning.md` (copy this page's content into that file)

---

## The Problem

Helm's entire UI is server-driven JSON. The server sends JSON referencing component type strings (`"Text"`, `"CalendarModule"`, etc.), and the client's `componentRegistry.ts` maps those strings to React Native components. Without versioning:

- Server adds a new component type → old app binary doesn't recognize it → **silent failure or crash**
- Server removes/renames a component → old layouts referencing it break
- Server changes a prop schema (e.g., Button gets a new required prop) → old client ignores it or errors
- No way to know which client can render what

This is the #1 deployment risk for any SDUI system.

---

## Industry Standard: How Production SDUI Systems Handle This

Researched from Airbnb Ghost Platform, Shopify, Faire, Nativeblocks, and the DebuggAI SDUI blueprint (2025).

**Three mechanisms used together:**

**1. Schema version in every JSON payload** — Every SDUI JSON object includes a `schemaVersion` field (semantic versioning: `major.minor.patch`). The client checks this before rendering.

**2. Capability negotiation** — On connection, the client announces what it supports (app version, schema version range, supported component types). The server only generates JSON the client can handle.

**3. Graceful fallback for unknown components** — If a component type isn't in the client's registry, render a placeholder (empty container, error boundary, or hidden) — never crash.

---

## Helm's Versioning Strategy

### 1. Schema Version Field — `schemaVersion`

Every SDUI JSON payload from the server MUST include:

```json
{
  "schemaVersion": "1.0.0",
  "type": "Page",
  "rows": [...]
}
```

**Versioning rules (semantic versioning):**

- **MAJOR** (1.x.x → 2.x.x): Breaking changes. Removed components, renamed type strings, changed Row/Cell structure, removed required props. Old clients CANNOT render this.
- **MINOR** (1.0.x → 1.1.x): Additive changes. New component types, new optional props on existing components, new action types. Old clients can still render — they just skip/fallback unknown parts.
- **PATCH** (1.0.0 → 1.0.1): Bug fixes, documentation. No schema changes. Purely informational.

**Rule: Prefer additive (MINOR) changes. Avoid MAJOR bumps.** The industry standard is to keep MAJOR version changes to once per year at most, with a 6-month deprecation window.

### 2. Single Source of Truth — `docs/sdui-schema-version.json`

A single file in the repo root tracks the current schema version and the component catalog:

```json
{
  "schemaVersion": "1.0.0",
  "lastUpdated": "2026-03-30",
  "components": {
    "Text": { "since": "1.0.0", "status": "stable" },
    "Markdown": { "since": "1.0.0", "status": "stable" },
    "Button": { "since": "1.0.0", "status": "stable" },
    "Image": { "since": "1.0.0", "status": "stable" },
    "TextInput": { "since": "1.0.0", "status": "stable" },
    "Icon": { "since": "1.0.0", "status": "stable" },
    "Divider": { "since": "1.0.0", "status": "stable" },
    "Container": { "since": "1.0.0", "status": "stable" },
    "CalendarModule": { "since": "1.0.0", "status": "stable" },
    "ChatModule": { "since": "1.0.0", "status": "stable" },
    "NotesModule": { "since": "1.0.0", "status": "stable" },
    "InputBar": { "since": "1.0.0", "status": "stable" }
  },
  "actions": {
    "navigate": { "since": "1.0.0" },
    "go_back": { "since": "1.0.0" },
    "open_url": { "since": "1.0.0" },
    "dismiss": { "since": "1.0.0" },
    "open_sheet": { "since": "1.0.0" },
    "copy_text": { "since": "1.0.0" },
    "toggle": { "since": "1.0.0" },
    "server_action": { "since": "1.0.0" },
    "send_to_agent": { "since": "1.0.0" }
  },
  "deprecations": []
}
```

**Update workflow:** When you add/remove/change anything in the SDUI contract:

1. Edit `docs/sdui-schema-version.json` — bump version, add/deprecate component
2. The version number is the ONLY place the schema version lives — everything else reads from it
3. Both backend and frontend import this file at build time

### 3. Capability Negotiation — Client → Server Handshake

On WebSocket connection (or first REST call), the client sends:

```json
{
  "type": "capability_handshake",
  "appVersion": "1.2.0",
  "schemaVersion": "1.0.0",
  "supportedComponents": ["Text", "Markdown", "Button", "Image", ...],
  "supportedActions": ["navigate", "server_action", ...]
}
```

The server stores this per-connection and uses it to:

- Only generate JSON with components the client supports
- Warn/log if a layout references unsupported components
- Send an upgrade hint if the client is behind

**For MVP (single user, single device):** The handshake can be simplified — the backend reads `sdui-schema-version.json` directly and assumes the client matches. Full negotiation becomes critical when multiple app versions exist in the wild.

### 4. Client-Side Fallback — Never Crash

In `SDUIRenderer.tsx`, when looking up a component type:

```tsx
const Component = componentRegistry[node.type];
if (!Component) {
  // Option A: Render empty Container (invisible)
  // Option B: Render error boundary with "Update app" message
  // Option C: Skip entirely (render nothing)
  console.warn(`Unknown SDUI component: ${node.type}. Client schema: ${CLIENT_SCHEMA_VERSION}`);
  return <FallbackComponent type={node.type} />;
}
```

**Never** let an unknown component crash the app. This is the single most important client-side rule.

### 5. Auto-Validation — CI/CD Check

A script runs on every push (GitHub Actions) that validates:

- `docs/sdui-schema-version.json` is valid and version is bumped if component catalog changed
- `componentRegistry.ts` matches the component list in the schema version file
- Backend SDUI generator only references components that exist in the schema version file
- All SDUI template JSON files have valid `schemaVersion` fields
- No component is referenced that has `status: "deprecated"` past its removal date

**Script location:** `scripts/validate-sdui-schema.ts` (or `.py`)

**This is the auto-check that runs through the entire system** — instead of relying on developers to manually keep things in sync, the CI pipeline catches mismatches before they ship.

```
scripts/validate-sdui-schema.ts
├── Read docs/sdui-schema-version.json
├── Parse src/renderer/componentRegistry.ts → extract registered types
├── Compare: every registry key must be in schema file, and vice versa
├── Parse all src/templates/*.json → every component type must be in schema
├── Parse backend SDUI generator → every emitted type must be in schema
├── Check schemaVersion field matches across all sources
└── Exit 1 if ANY mismatch found
```

---

## Version Bump Workflow

When making changes to the SDUI contract:

**Adding a new component:**

1. Create the component file (e.g., `src/components/atomic/Badge.tsx`)
2. Register in `componentRegistry.ts`
3. Edit `docs/sdui-schema-version.json`: bump MINOR version (1.0.0 → 1.1.0), add component with `"since": "1.1.0"`
4. Run `scripts/validate-sdui-schema.ts` — should pass
5. Push — CI validates automatically

**Deprecating a component:**

1. Add to `deprecations` array with removal target date (min 6 months out for production, can be shorter for personal use)
2. Bump MINOR version
3. Component still works — just logged as deprecated
4. After removal date: remove from registry, bump MAJOR version

**Changing component props (additive):**

1. Add new optional prop — MINOR bump
2. Existing JSON without the prop still works (backward compatible)

**Changing component props (breaking):**

1. MAJOR bump required
2. Must support old prop format for deprecation window
3. Or: create new component type (e.g., `ButtonV2`) and deprecate old one — avoids MAJOR bump

---

## File Structure in Repo

```
helm/
├── docs/
│   ├── sdui-versioning.md          ← This strategy doc (copy of this page)
│   └── sdui-schema-version.json    ← Single source of truth for version + catalog
├── scripts/
│   └── validate-sdui-schema.ts     ← CI auto-check script
├── src/
│   ├── renderer/
│   │   ├── SDUIRenderer.tsx         ← Reads schema version, fallback for unknown
│   │   └── componentRegistry.ts     ← Must match schema version file
│   └── constants/
│       └── schemaVersion.ts         ← Imports from docs/sdui-schema-version.json
└── .github/
    └── workflows/
        └── validate-sdui.yml        ← Runs validate script on push
```

---

## Why This Approach (vs Alternatives)

**vs. No versioning (current state):** Silent breakage when server/client mismatch. Unacceptable.

**vs. API versioning (REST-style `/v1/`, `/v2/` endpoints):** Overkill for SDUI — the "API" is the JSON schema itself, not REST endpoints. Schema version in JSON is simpler and more granular.

**vs. GraphQL-style deprecation:** Good pattern but requires GraphQL infrastructure. Helm uses REST+WS. The `deprecations` array achieves the same goal.

**vs. Feature flags per component:** Too granular, creates combinatorial explosion. Schema version as a single number is simpler. Capability negotiation handles the per-component case when needed.

---

## References

- [Nativeblocks — SDUI Best Practices: Version Schemas and Components Properly](https://nativeblocks.io/blog/best-practices-and-common-pitfalls/)
- [DebuggAI — Server-Driven UI in 2025: Versioned Layout Schemas, Capability Negotiation, and Safe Mobile Rollouts](https://debugg.ai/resources/server-driven-ui-2025-versioned-layout-schemas-capability-negotiation-safe-mobile-rollouts)
- [Faire — Transitioning to Server-Driven UI](https://craft.faire.com/transitioning-to-server-driven-ui-a76b216ed408)
- [MobileNativeFoundation — Server-driven UI strategies discussion](https://github.com/MobileNativeFoundation/discussions/discussions/47)