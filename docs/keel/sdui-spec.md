# Keel SDUI V2 Specification

The Server-Driven UI (SDUI) V2 format is a JSON schema for describing native mobile screens. An AI agent or backend service generates the JSON; the Keel renderer turns it into native React Native components.

## Page Structure

```json
{
  "schema_version": "1.0.0",
  "module_id": "home",
  "title": "Dashboard",
  "rows": [
    {
      "id": "row-1",
      "cells": [
        {
          "id": "cell-1",
          "width": 1,
          "content": { "type": "Text", "id": "t1", "props": { "content": "Hello" } }
        }
      ],
      "compact": { "stack": true },
      "regular": { "direction": "row" },
      "gap": 12
    }
  ]
}
```

### Hierarchy

```
SDUIPage
  └── rows[]           — Vertical stack of rows
        └── cells[]    — Horizontal cells within a row
              └── content  — One component per cell
```

### Page Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schema_version` | `"1.0.0"` | Yes | Always `"1.0.0"` for V2 |
| `module_id` | string | Yes | Screen identifier (e.g., `"home"`, `"settings"`) |
| `title` | string | No | Page title for navigation header |
| `rows` | SDUIRow[] | Yes | Rows rendered top-to-bottom |
| `generated_at` | string | No | ISO 8601 timestamp |
| `meta` | object | No | Arbitrary metadata |

### Row Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | string | Required | Unique row identifier |
| `cells` | SDUICell[] | Required | Cells in this row |
| `compact` | object | — | Phone layout (<768px) |
| `compact.stack` | boolean | false | Stack cells vertically on phone |
| `compact.hidden` | boolean | false | Hide row on phone |
| `regular` | object | — | Tablet layout (≥768px) |
| `regular.hidden` | boolean | false | Hide row on tablet |
| `scrollable` | boolean | false | Horizontal scroll with snap |
| `backgroundColor` | string | — | Row background color |
| `padding` | number | — | Inner padding |
| `gap` | number | — | Gap between cells |

### Cell Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | string | Required | Unique cell identifier |
| `width` | number \| `"auto"` | `"auto"` | Fractional width (0-1) or natural width |
| `content` | SDUIComponent | Required | The component to render |

---

## Component Types

### Atomic Components (Tier 2)

#### Text
```json
{ "type": "Text", "id": "t1", "props": {
    "content": "Hello World",
    "variant": "heading",
    "color": "#333",
    "bold": true,
    "italic": false,
    "underline": false,
    "strikethrough": false,
    "align": "left",
    "numberOfLines": 2,
    "selectable": false
}}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `content` | string | Required | Text to display |
| `variant` | `"heading"` \| `"body"` \| `"caption"` | `"body"` | Text style preset |
| `color` | string | theme default | Text color (hex or theme token) |
| `bold` | boolean | false | Bold weight |
| `italic` | boolean | false | Italic style |
| `align` | `"left"` \| `"center"` \| `"right"` | `"left"` | Text alignment |
| `numberOfLines` | number | — | Truncation limit |

#### Markdown
```json
{ "type": "Markdown", "id": "md1", "props": { "content": "# Title\n\nSome **bold** text" } }
```

#### Button
```json
{ "type": "Button", "id": "b1", "props": {
    "label": "Submit",
    "icon": "check",
    "variant": "primary",
    "size": "md",
    "fullWidth": false,
    "loading": false,
    "disabled": false,
    "onPress": { "type": "server_action", "function": "submit_form", "params": {} }
}}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | string | — | Button text |
| `icon` | string | — | Feather icon name |
| `variant` | `"primary"` \| `"secondary"` \| `"ghost"` \| `"icon"` \| `"destructive"` | `"primary"` | Visual style |
| `size` | `"sm"` \| `"md"` \| `"lg"` | `"md"` | Button size |
| `fullWidth` | boolean | false | Stretch to container width |
| `onPress` | SDUIAction | Required | Action on tap |

#### Image
```json
{ "type": "Image", "id": "img1", "props": {
    "src": "https://example.com/photo.jpg",
    "alt": "A photo",
    "aspectRatio": 1.5,
    "borderRadius": 12
}}
```

#### TextInput
```json
{ "type": "TextInput", "id": "input1", "props": {
    "placeholder": "Enter your name...",
    "multiline": false,
    "secureTextEntry": false,
    "keyboardType": "default"
}}
```

#### Icon
```json
{ "type": "Icon", "id": "ic1", "props": { "name": "star", "size": 24, "color": "#FFD700" } }
```

Uses Feather icon names mapped to emoji/unicode.

#### Divider
```json
{ "type": "Divider", "id": "d1", "props": { "direction": "horizontal", "thickness": 1 } }
```

### Structural Components (Tier 1)

#### Container
```json
{ "type": "Container", "id": "c1", "props": {
    "direction": "row",
    "gap": 12,
    "padding": 16,
    "backgroundColor": "surface",
    "borderRadius": 12,
    "shadow": "md",
    "align": "center",
    "justify": "space-between"
}, "children": [ ...components ] }
```

### Composite Components (Tier 3)

#### CalendarModule
```json
{ "type": "CalendarModule", "id": "cal1", "props": {
    "defaultView": "month",
    "events": [
      { "id": "e1", "title": "Meeting", "start": "2026-04-12T10:00:00", "end": "2026-04-12T11:00:00", "color": "#007AFF" }
    ]
}}
```

#### InputBar
```json
{ "type": "InputBar", "id": "ib1", "props": {
    "placeholder": "Ask anything...",
    "onSend": { "type": "send_to_agent", "message": "" }
}}
```

#### ChatModule / NotesModule
Placeholder composites — render navigation prompts to their respective tabs.

---

## Action Types

Actions describe what happens when a user interacts with a component.

| Type | Fields | Description |
|------|--------|-------------|
| `navigate` | `screen`, `params?` | Navigate to a screen/tab |
| `go_back` | — | Navigate back |
| `server_action` | `function`, `params?` | Call a registered backend action |
| `send_to_agent` | `message` | Send a chat message to the AI agent |
| `open_url` | `url` | Open URL (http/https/mailto/tel) |
| `copy_text` | `text` | Copy string to clipboard |
| `dismiss` | — | Navigate back / close |
| `api_call` | `method`, `path`, `body?` | Direct API call |

---

## Responsive Layout

Keel uses a breakpoint at **768px** to switch between phone and tablet layouts.

- `compact` props apply on screens **< 768px** (phone)
- `regular` props apply on screens **≥ 768px** (tablet)

```json
{
  "id": "row-1",
  "cells": [
    { "id": "c1", "width": 0.5, "content": { ... } },
    { "id": "c2", "width": 0.5, "content": { ... } }
  ],
  "compact": { "stack": true },
  "regular": { "direction": "row" }
}
```

On phone: cells stack vertically. On tablet: cells sit side-by-side.

---

## Custom Components

Register your own components with the Keel renderer:

```tsx
import { registerComponent } from '@keel/renderer';

registerComponent('MyChart', MyChartComponent);
```

Now your backend/AI can include `{ "type": "MyChart", "props": { ... } }` in SDUI payloads.

See [Custom Components Guide](./custom-components.md) for details.
