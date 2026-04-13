# Keel Quickstart

Render your first AI-driven screen in 5 minutes.

## Install

```bash
# Frontend (React Native)
npm install @keel/protocol @keel/renderer

# Backend (Python)
pip install keel-server
```

## 1. Render an SDUI Screen (Frontend)

```tsx
import React from 'react';
import { View } from 'react-native';
import { SDUIPageRenderer } from '@keel/renderer';
import type { SDUIPage, SDUIAction } from '@keel/protocol';

// This JSON could come from your backend, an AI agent, or a static file
const screen: SDUIPage = {
  schema_version: '1.0.0',
  module_id: 'hello',
  title: 'Hello Keel',
  rows: [
    {
      id: 'row-1',
      cells: [
        {
          id: 'cell-1',
          width: 1,
          content: {
            type: 'Text',
            id: 'greeting',
            props: { content: 'Hello from Keel!', variant: 'heading' },
          },
        },
      ],
    },
    {
      id: 'row-2',
      cells: [
        {
          id: 'cell-2',
          width: 1,
          content: {
            type: 'Button',
            id: 'action-btn',
            props: {
              label: 'Say Hi to AI',
              variant: 'primary',
              onPress: { type: 'send_to_agent', message: 'Hello!' },
            },
          },
        },
      ],
    },
  ],
};

function handleAction(action: SDUIAction) {
  console.log('Action dispatched:', action);
  // Handle navigation, server calls, agent messages, etc.
}

export default function App() {
  return (
    <View style={{ flex: 1 }}>
      <SDUIPageRenderer page={screen} onAction={handleAction} />
    </View>
  );
}
```

That's it — you have a native screen rendered from JSON.

## 2. Register Custom Components

```tsx
import { registerComponent } from '@keel/renderer';

// Your custom component
function WeatherWidget({ city, temp }: { city: string; temp: number }) {
  return <Text>{city}: {temp}°F</Text>;
}

// Register it — now AI can use type: 'WeatherWidget' in SDUI payloads
registerComponent('WeatherWidget', WeatherWidget);
```

## 3. Set Up the Backend (Python)

```python
from fastapi import FastAPI
from keel_server import ConnectionManager, create_mcp_server, normalize_sdui_screen, ActionRegistry

app = FastAPI()

# WebSocket manager for real-time SDUI updates
ws_manager = ConnectionManager()

# MCP server for AI agent tool access
async def validate_token(token: str) -> str | None:
    # Your auth logic here — return user_id or None
    return "user-1" if token == "valid-token" else None

mcp, mcp_auth = await create_mcp_server("MyApp", validate_token)

# Action registry for SDUI button handlers
registry = ActionRegistry()

@registry.register("greet")
async def greet(name: str = "World"):
    return {"message": f"Hello, {name}!"}

# Normalize AI-generated SDUI before storage
raw_screen = {"type": "Text", "content": "Hi"}  # flat format from AI
normalized = normalize_sdui_screen(raw_screen)     # → props-based format
```

## 4. Connect AI to UI

The real power: your AI agent generates SDUI JSON → backend normalizes and stores it → WebSocket pushes to frontend → Keel renders it instantly.

```
AI Agent  →  helm_set_screen("home", sdui_json)  →  WebSocket  →  SDUIPageRenderer
```

See the [Helm example app](../../mobile/) for a complete implementation.

## Next Steps

- [SDUI V2 Specification](./sdui-spec.md) — Full component and layout reference
- [Custom Components Guide](./custom-components.md) — Build and register your own components
- [API Reference](./api-reference.md) — All exports from each package
