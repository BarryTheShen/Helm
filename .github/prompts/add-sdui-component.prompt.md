---
mode: agent
description: Add a new SDUI V2 component — type definition, React component, registry registration, and documentation
tools: ['search', 'editFiles', 'usages']
---

# Add SDUI Component: ${input:componentName}

Add a new V2 SDUI component `${input:componentName}` to the Helm frontend.

## Pre-Flight Check

Read these files to understand existing patterns:
1. `mobile/src/renderer/componentRegistry.ts` — Current registry
2. `mobile/src/types/sdui.ts` — Type definitions
3. An existing component in the same tier for reference (pick one from `mobile/src/components/`)
4. [docs/codebase-explanation/frontend.md](../docs/codebase-explanation/frontend.md) — Component tables

## Step 1: Add Type Definition (`sdui.ts`)

In `mobile/src/types/sdui.ts`:
- Add the PascalCase type string to the appropriate type union
- Add a Props interface if the component has typed props

## Step 2: Create Component

Create the component file in the appropriate tier:
- **Atomic** (`src/components/atomic/`) — Primitive UI: text, button, image, input, icon, divider
- **Structural** (`src/components/structural/`) — Layout: container, grid, card
- **Composite** (`src/components/composite/`) — Complex: calendar, chat, forms

Component requirements:
- Functional component, named export
- TypeScript strict — no `any`
- Accepts `dispatch` prop for action handling: `dispatch: (action: SDUIAction) => void`
- Accepts `children` if it's a container type
- Uses `@/` path alias for imports
- Uses theme tokens from `src/theme/tokens.ts` for colors/spacing
- Handles missing/undefined props gracefully

```typescript
import { type SDUIAction } from '@/types/sdui';

interface SDUI${input:componentName}Props {
  // component-specific props
  dispatch: (action: SDUIAction) => void;
}

export function SDUI${input:componentName}({ dispatch, ...props }: SDUI${input:componentName}Props) {
  // implementation
}
```

## Step 3: Register in Component Registry

In `mobile/src/renderer/componentRegistry.ts`:
1. Import the new component
2. Add to the `registry` object with PascalCase key:
```typescript
${input:componentName}: SDUI${input:componentName},
```

## Step 4: Update Documentation

Update `docs/codebase-explanation/frontend.md`:
- Add to the appropriate component table (atomic/structural/composite)

Update `docs/codebase-explanation/AI-TECHNICAL-REFERENCE.md`:
- Add to the frontend file map if this creates a new file

## Component Details

**Name:** ${input:componentName}
**Tier:** ${input:componentTier}
**Description:** ${input:componentDescription}
