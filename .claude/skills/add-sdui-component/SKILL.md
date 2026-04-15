---
name: add-sdui-component
description: Step-by-step checklist for adding a new SDUI V2 component to the Helm frontend. Covers type definition, component creation, registry registration, and documentation. Use when implementing new SDUI components.
---

# Add SDUI Component to Helm

Adding a V2 SDUI component follows a 4-step registration process.

## Pre-Flight Check

Read these files:
1. `mobile/src/renderer/componentRegistry.ts` — Current registry
2. `mobile/src/types/sdui.ts` — Type definitions
3. An existing component in the same tier for reference
4. `docs/codebase-explanation/frontend.md` — Component tables

## Step 1: Add Type Definition (`sdui.ts`)

In `mobile/src/types/sdui.ts`:
- Add the PascalCase type string to the appropriate type union
- Add a Props interface if the component has typed props

## Step 2: Create Component

Create in the appropriate tier:
- **Atomic** (`src/components/atomic/`) — text, button, image, input, icon, divider
- **Structural** (`src/components/structural/`) — container, grid, card
- **Composite** (`src/components/composite/`) — calendar, chat, forms

Requirements:
- Functional component, named export
- TypeScript strict — no `any`
- Accepts `dispatch` prop: `(action: SDUIAction) => void`
- Accepts `children` if container type
- Uses `@/` path alias
- Uses theme tokens for colors/spacing
- Handles missing/undefined props gracefully

```typescript
import { type SDUIAction } from '@/types/sdui';

interface SDUIComponentProps {
  dispatch: (action: SDUIAction) => void;
}

export function SDUIComponent({ dispatch, ...props }: SDUIComponentProps) {
  // implementation
}
```

## Step 3: Register in Component Registry

In `mobile/src/renderer/componentRegistry.ts`:
1. Import the new component
2. Add to the registry object with PascalCase key

## Step 4: Update Documentation

- `docs/codebase-explanation/frontend.md` — component table
- `docs/codebase-explanation/AI-TECHNICAL-REFERENCE.md` — file map if new file
