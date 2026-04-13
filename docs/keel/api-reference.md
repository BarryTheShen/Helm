# Keel API Reference

## @keel/protocol

Types and validation schemas for the SDUI V2 protocol.

```bash
npm install @keel/protocol
```

### Types

```tsx
import type {
  SDUIAction,          // Discriminated union of all action types
  SDUIComponentType,   // String literal union of built-in component types
  SDUIComponent,       // { type, id, props, children? }
  SDUICell,            // { id, width?, content }
  SDUIRow,             // { id, cells, compact?, regular?, scrollable?, gap?, ... }
  SDUIPage,            // { schema_version, module_id, title?, rows }
  ActionDispatcher,    // (action: SDUIAction) => void
} from '@keel/protocol';
```

### Functions

```tsx
import { isSDUIPage } from '@keel/protocol';

isSDUIPage(payload)  // Type guard: true if payload has `rows` array
```

### Validation Schemas (Zod)

```tsx
import {
  sduiComponentSchema,  // Validates a single component (recursive)
  sduiCellSchema,       // Validates a cell
  sduiRowSchema,        // Validates a row
  sduiPageSchema,       // Validates a complete SDUIPage
  wsMessageSchema,      // Validates a WebSocket message (with .passthrough())
  calendarPropsSchema,  // Validates calendar event props
  formPropsSchema,      // Validates form field definitions
} from '@keel/protocol';
```

---

## @keel/renderer

SDUI V2 renderer, component registry, and theme system.

```bash
npm install @keel/renderer
```

### Core

```tsx
import { SDUIPageRenderer } from '@keel/renderer';

<SDUIPageRenderer
  page={sduiPage}           // SDUIPage JSON payload
  onAction={handleAction}   // ActionDispatcher callback
/>
```

### Component Registry

```tsx
import {
  registerComponent,    // (type: string, component: React.ComponentType) => void
  resolveComponent,     // (type: string) => React.ComponentType | undefined
  getRegisteredTypes,   // () => string[]
} from '@keel/renderer';
```

### Built-in Components

```tsx
import {
  // Atomic
  SDUIText,        // { content, variant?, color?, bold?, italic?, align?, ... }
  SDUIMarkdown,    // { content }
  SDUIButton,      // { label?, icon?, variant?, size?, onPress, ... }
  SDUIImage,       // { src, alt?, aspectRatio?, borderRadius?, ... }
  SDUITextInput,   // { value?, placeholder?, multiline?, ... }
  SDUIIcon,        // { name, size?, color? }
  SDUIDivider,     // { direction?, thickness?, color? }

  // Structural
  SDUIContainer,   // { direction?, gap?, padding?, backgroundColor?, ... } + children

  // Composite
  CalendarModule,  // { defaultView?, events }
  ChatModule,      // Placeholder
  NotesModule,     // Placeholder
  InputBar,        // { placeholder?, onSend }
} from '@keel/renderer';
```

### Hooks

```tsx
import { useBreakpoint } from '@keel/renderer';

const sizeClass = useBreakpoint();  // 'compact' (<768px) | 'regular' (≥768px)
```

### Theme

```tsx
import {
  themeColors,     // Extended color palette with theme tokens
  themeShadows,    // { sm, md, lg } shadow presets
  resolveColor,    // (tokenOrHex: string, fallback?: string) => string
  colors,          // iOS-style color constants
  spacing,         // { xs, sm, md, lg, xl, xxl }
  borderRadius,    // { sm, md, lg, xl, full }
  typography,      // { largeTitle, title1, ..., caption2 }
} from '@keel/renderer';
```

---

## keel-server (Python)

FastAPI helpers for building Keel-compatible backends.

```bash
pip install keel-server
```

### ConnectionManager

```python
from keel_server import ConnectionManager

manager = ConnectionManager()

# In your WebSocket endpoint:
await manager.connect(user_id, device_id, websocket)
manager.disconnect(user_id, device_id)
await manager.send(user_id, {"type": "sdui_screen_update", ...})
await manager.broadcast({"type": "notification", ...})

# Properties:
manager.connected_user_ids  # set[str]
```

### MCP Server

```python
from keel_server import create_mcp_server, get_current_user_id

async def validate_token(token: str) -> str | None:
    # Your auth logic — return user_id or None
    ...

mcp, auth_middleware = await create_mcp_server("MyApp", validate_token)

@mcp.tool()
async def my_tool(param: str) -> dict:
    user_id = get_current_user_id()  # Set by auth middleware
    return {"result": f"Hello {user_id}"}

# Mount in FastAPI:
app.mount("/mcp", auth_middleware)
```

### SDUI Normalization

```python
from keel_server import normalize_sdui_screen

# AI-generated flat format:
raw = {"type": "text", "content": "Hello"}

# Normalized props-based format:
normalized = normalize_sdui_screen(raw)
# → {"type": "text", "props": {"content": "Hello"}}
```

### Action Registry

```python
from keel_server import ActionRegistry

registry = ActionRegistry()

registry.register("greet", greet_handler)
registry.register("submit_form", form_handler)

result = await registry.execute("greet", name="World")
actions = registry.list_actions()  # ["greet", "submit_form"]
```
