# @keel/protocol

Type definitions, Zod validation schemas, and type guards for the Keel SDUI protocol.

---

## What Is @keel/protocol

`@keel/protocol` is the shared contract layer for the Keel framework. It defines the TypeScript types that describe every SDUI page, component, and action, along with Zod schemas for runtime validation. Any renderer, server adapter, or AI agent that speaks the Keel protocol imports from this package. The protocol is renderer-agnostic: nothing here depends on React, React Native, or any platform API.

---

## Install

```bash
npm install @keel/protocol
```

Peer dependency: `zod >= 3.0.0`

---

## Layout Hierarchy

A Keel SDUI payload is a tree: **Page → Rows → Cells → Component**.

```
SDUIPage
  rows: SDUIRow[]
    cells: SDUICell[]
      content: SDUIComponent
```

### SDUIPage

The top-level payload sent by an AI agent or server.

```ts
import type { SDUIPage } from '@keel/protocol';

const page: SDUIPage = {
  schema_version: '1.0.0',
  module_id: 'home',
  title: 'Dashboard',
  rows: [],
  generated_at: new Date().toISOString(),
};
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schema_version` | `'1.0.0'` | Yes | Always `'1.0.0'` |
| `module_id` | `string` | Yes | Identifies the screen slot |
| `title` | `string` | No | Optional display title |
| `rows` | `SDUIRow[]` | Yes | Ordered list of layout rows |
| `generated_at` | `string` | No | ISO 8601 timestamp |
| `meta` | `Record<string, unknown>` | No | Arbitrary metadata |

### SDUIRow

A horizontal strip containing one or more cells. Rows support responsive overrides and horizontal scrolling.

```ts
import type { SDUIRow } from '@keel/protocol';

const row: SDUIRow = {
  id: 'row-1',
  cells: [],
  compact: { stack: true },   // phone: stack cells vertically
  regular: { direction: 'row' }, // tablet: side by side
  gap: 12,
};
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique row identifier |
| `cells` | `SDUICell[]` | Cells within this row |
| `compact` | `object` | Layout overrides for phone (< 768px) |
| `regular` | `object` | Layout overrides for tablet (>= 768px) |
| `scrollable` | `boolean` | Enables horizontal scroll with snap |
| `backgroundColor` | `string` | Row background color or token |
| `padding` | `number \| string` | Row padding |
| `gap` | `number` | Gap between cells |

### SDUICell

A single slot within a row. Holds one component and controls fractional width.

```ts
import type { SDUICell } from '@keel/protocol';

const cell: SDUICell = {
  id: 'cell-1',
  width: 0.5,          // takes 50% of row width
  content: { type: 'Text', id: 'txt-1', props: { content: 'Hello' } },
};
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique cell identifier |
| `width` | `number \| 'auto'` | Fractional width (0-1) or `'auto'` |
| `content` | `SDUIComponent` | The component rendered in this cell |

### SDUIComponent

The leaf node of the layout tree. A type string plus a props bag.

```ts
import type { SDUIComponent } from '@keel/protocol';

const component: SDUIComponent = {
  type: 'Button',
  id: 'btn-submit',
  props: {
    label: 'Submit',
    variant: 'primary',
    onPress: { type: 'server_action', function: 'submitForm' },
  },
};
```

| Field | Type | Description |
|-------|------|-------------|
| `type` | `SDUIComponentType \| string` | Component type name (PascalCase) |
| `id` | `string` | Unique component identifier |
| `props` | `Record<string, any>` | Component-specific properties |
| `children` | `SDUIComponent[]` | Optional nested components |

---

## Action Types

`SDUIAction` is a discriminated union. Components reference actions by value in their props; the renderer dispatches them to an `ActionDispatcher`.

| Action type | Fields | Description |
|-------------|--------|-------------|
| `navigate` | `screen`, `params?` | Push a named screen |
| `go_back` | — | Pop the navigation stack |
| `api_call` | `method`, `path`, `body?` | Make a REST API call |
| `server_action` | `function`, `params?` | Invoke a named server-side handler |
| `send_to_agent` | `message` | Send a text message to the AI agent |
| `dismiss` | — | Dismiss a sheet or modal |
| `open_sheet` | `content` | Open a bottom sheet with an SDUI component |
| `copy_text` | `text` | Copy text to the clipboard |
| `open_url` | `url` | Open a URL in the system browser |
| `toggle` | `target` | Toggle a named UI element |

```ts
import type { SDUIAction } from '@keel/protocol';

const action: SDUIAction = {
  type: 'server_action',
  function: 'bookAppointment',
  params: { date: '2025-04-15', time: '10:00' },
};
```

---

## Component Types

`SDUIComponentType` lists the 12 built-in types organized by tier. Components are resolved by the renderer at runtime — the protocol only defines the type names.

| Tier | Type name | Description |
|------|-----------|-------------|
| Atomic | `Text` | Single or multi-line text |
| Atomic | `Markdown` | Markdown-rendered text |
| Atomic | `Button` | Tappable button with variants |
| Atomic | `Image` | Remote or local image |
| Atomic | `TextInput` | Single or multi-line text input |
| Atomic | `Icon` | Named icon with optional press action |
| Atomic | `Divider` | Horizontal or vertical separator |
| Structural | `Container` | Flexbox layout wrapper |
| Composite | `CalendarModule` | Full calendar view |
| Composite | `ChatModule` | Scrollable chat thread |
| Composite | `NotesModule` | Note-taking interface |
| Composite | `InputBar` | Sticky text input bar |

Components can use any string type beyond these 12. The renderer resolves types at runtime, so custom types registered via `registerComponent()` work without changes to the protocol package.

---

## Validation Schemas

All schemas are Zod-based and exported from `@keel/protocol`.

| Schema | Validates |
|--------|-----------|
| `sduiPageSchema` | A complete `SDUIPage` object |
| `sduiRowSchema` | A single `SDUIRow` |
| `sduiCellSchema` | A single `SDUICell` |
| `sduiComponentSchema` | A single `SDUIComponent` (recursive) |
| `wsMessageSchema` | WebSocket messages (`.passthrough()` — preserves extra fields) |
| `safeUrlSchema` | URLs — allows only `http`, `https`, `mailto`, `tel` |
| `calendarPropsSchema` | Props for a `CalendarModule` component |
| `formPropsSchema` | Fields definition for a form component |

```ts
import { sduiPageSchema } from '@keel/protocol';

const result = sduiPageSchema.safeParse(payload);
if (!result.success) {
  console.error(result.error.issues);
}
```

---

## Type Guard

`isSDUIPage()` checks that an arbitrary value is a valid V2 `SDUIPage` at runtime.

```ts
import { isSDUIPage } from '@keel/protocol';

const raw = JSON.parse(incoming);
if (isSDUIPage(raw)) {
  // raw is typed as SDUIPage here
  renderPage(raw);
}
```

---

## Full Example

Constructing a simple page with one row, one cell, and a text component:

```ts
import type { SDUIPage } from '@keel/protocol';

const page: SDUIPage = {
  schema_version: '1.0.0',
  module_id: 'welcome',
  title: 'Welcome',
  rows: [
    {
      id: 'row-1',
      cells: [
        {
          id: 'cell-1',
          content: {
            type: 'Text',
            id: 'txt-1',
            props: {
              content: 'Hello from Keel.',
              variant: 'heading',
              align: 'center',
            },
          },
        },
      ],
    },
    {
      id: 'row-2',
      cells: [
        {
          id: 'cell-2',
          content: {
            type: 'Button',
            id: 'btn-1',
            props: {
              label: 'Get Started',
              variant: 'primary',
              onPress: { type: 'navigate', screen: 'home' },
            },
          },
        },
      ],
    },
  ],
};
```

---

## Peer Dependencies

| Package | Version |
|---------|---------|
| `zod` | `>= 3.0.0` |
