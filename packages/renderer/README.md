# @keel/renderer

React Native renderer for the Keel SDUI protocol — turns protocol JSON into native components.

---

## What Is @keel/renderer

`@keel/renderer` reads a `SDUIPage` from `@keel/protocol` and renders it as native React Native views. It owns the component registry, the preset system, the responsive breakpoint hook, and the theme token map. The renderer is extensible by design: new component types can be registered at runtime without forking the package, and the entire component set can be replaced with a UI library adapter (preset) in three lines of code.

---

## Install

```bash
npm install @keel/renderer
```

Peer dependencies: `react >= 18`, `react-native >= 0.72`. Optional: `react-native-paper >= 5.0` (for the Paper preset).

---

## Quick Start

```tsx
import React from 'react';
import { SDUIPageRenderer } from '@keel/renderer';
import type { SDUIPage, SDUIAction } from '@keel/protocol';

const page: SDUIPage = {
  schema_version: '1.0.0',
  module_id: 'home',
  rows: [
    {
      id: 'row-1',
      cells: [
        {
          id: 'cell-1',
          content: {
            type: 'Text',
            id: 'txt-1',
            props: { content: 'Hello from Keel.' },
          },
        },
      ],
    },
  ],
};

function handleAction(action: SDUIAction) {
  console.log('action', action);
}

export default function Screen() {
  return <SDUIPageRenderer page={page} onAction={handleAction} />;
}
```

`SDUIPageRenderer` accepts two props:

| Prop | Type | Description |
|------|------|-------------|
| `page` | `SDUIPage` | The page descriptor to render |
| `onAction` | `ActionDispatcher` | Called whenever a component triggers an action |

---

## Component Registry

The registry maps SDUI type strings to React components. All 12 built-in types are pre-registered. You can add custom types or replace existing ones at runtime.

```ts
import { registerComponent, resolveComponent, getRegisteredTypes } from '@keel/renderer';
import { MyCustomCard } from './MyCustomCard';

// Register a new type
registerComponent('MyCustomCard', MyCustomCard);

// Resolve a component by type name (returns null if not found)
const Comp = resolveComponent('MyCustomCard');

// List all registered type names
const types = getRegisteredTypes();
// ['Text', 'Markdown', 'Button', ..., 'MyCustomCard']
```

Components receive all `props` from the protocol payload plus a `dispatch` function of type `ActionDispatcher`. Children are rendered recursively.

---

## Preset System

A preset is a plain object mapping SDUI type strings to React components. Calling `registerPreset()` applies the map in one call — it overwrites only the types present in the preset, leaving all others untouched.

```ts
import { registerPreset } from '@keel/renderer';
import type { Preset } from '@keel/renderer';

const MyPreset: Preset = {
  Button: MyButton,
  Text: MyText,
};

registerPreset(MyPreset);
```

`Preset` is exported as a type:

```ts
type Preset = Record<string, ComponentType<any>>;
```

---

## Built-in Paper Preset

The Paper preset replaces the atomic and structural components with Material Design 3 implementations from `react-native-paper`. Composite components (`CalendarModule`, `ChatModule`, `NotesModule`, `InputBar`) are not overridden and keep their defaults.

### Setup

Wrap your app in `PaperProvider`, apply the preset once before any render, then use `SDUIPageRenderer` normally:

```tsx
import { PaperProvider } from 'react-native-paper';
import { SDUIPageRenderer, registerPreset } from '@keel/renderer';
import { PaperPreset } from '@keel/renderer/presets/paper';

// Apply once at app startup — before any SDUIPageRenderer mounts
registerPreset(PaperPreset);

export default function App() {
  return (
    <PaperProvider>
      <SDUIPageRenderer page={page} onAction={handleAction} />
    </PaperProvider>
  );
}
```

The Paper preset overrides: `Button`, `Text`, `TextInput`, `Divider`, `Icon`, `Container`.

---

## Creating a Custom Preset

Map any component type to your own implementation. The mapping is just a plain object:

```ts
import { registerPreset } from '@keel/renderer';
import type { Preset } from '@keel/renderer';
import { UILibButton, UILibText } from 'my-ui-lib';

// Adapter components receive Keel props and translate them to the target library
function MyButtonAdapter({ label, onPress, dispatch }) {
  return (
    <UILibButton onPress={() => onPress && dispatch?.(onPress)}>
      {label}
    </UILibButton>
  );
}

const MyPreset: Preset = {
  Button: MyButtonAdapter,
  Text: ({ content }) => <UILibText>{content}</UILibText>,
};

registerPreset(MyPreset);
```

Call `registerPreset()` once at app startup, before any `SDUIPageRenderer` mounts.

---

## Theme Tokens

Components reference named color tokens instead of raw hex values. The renderer resolves token names to hex values at render time.

```ts
import { themeColors, themeShadows, resolveColor } from '@keel/renderer';

// Token map — use these names in component props
themeColors.primary      // '#007AFF'
themeColors.error        // '#FF3B30'
themeColors.textSecondary // '#8E8E93'

// Shadow presets
themeShadows.sm  // { shadowColor, shadowOffset, shadowOpacity, shadowRadius, elevation }
themeShadows.md
themeShadows.lg

// Resolve a token name or pass-through a raw hex value
resolveColor('primary')   // '#007AFF'
resolveColor('#FF0000')   // '#FF0000' (returned as-is)
resolveColor(undefined)   // '#000000' (default fallback)
```

Available color tokens:

| Category | Tokens |
|----------|--------|
| Brand | `primary`, `primaryLight`, `secondary` |
| Semantic | `success`, `warning`, `error`, `info` |
| Surfaces | `background`, `surface`, `surfaceElevated`, `card` |
| Text | `text`, `textSecondary`, `textTertiary` |
| Borders | `border`, `divider` |

---

## Built-in Components

| Tier | Type | Description |
|------|------|-------------|
| Atomic | `Text` | Single or multi-line text with variant, color, align |
| Atomic | `Markdown` | Rendered markdown text |
| Atomic | `Button` | Button with primary/secondary/ghost/destructive/icon variants |
| Atomic | `Image` | Remote image with aspect ratio control |
| Atomic | `TextInput` | Text input with submit action support |
| Atomic | `Icon` | Named icon, optionally tappable |
| Atomic | `Divider` | Horizontal or vertical separator |
| Structural | `Container` | Flexbox wrapper with gap, padding, shadow, background |
| Composite | `CalendarModule` | Full calendar view |
| Composite | `ChatModule` | Scrollable chat thread |
| Composite | `NotesModule` | Note-taking interface |
| Composite | `InputBar` | Sticky text input bar |

Unknown component types render a visible red fallback (`Unsupported: <type>`) so AI-generated pages with unrecognized types degrade gracefully rather than crashing.

---

## Responsive Layout

`useBreakpoint()` returns the current size class based on device width. The renderer uses it automatically to pick the correct row layout variant per breakpoint.

```ts
import { useBreakpoint } from '@keel/renderer';

function MyComponent() {
  const sizeClass = useBreakpoint(); // 'compact' | 'regular'
  return sizeClass === 'compact' ? <PhoneLayout /> : <TabletLayout />;
}
```

| Size class | Breakpoint | Typical device |
|------------|-----------|---------------|
| `compact` | width < 768px | Phone |
| `regular` | width >= 768px | Tablet / iPad |

The hook subscribes to `Dimensions` change events and re-renders when the device rotates or the window resizes.

---

## Peer Dependencies

| Package | Version | Required |
|---------|---------|----------|
| `react` | `>= 18` | Yes |
| `react-native` | `>= 0.72` | Yes |
| `react-native-paper` | `>= 5.0` | No (Paper preset only) |
