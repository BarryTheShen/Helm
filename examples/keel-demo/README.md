# keel-demo

Runnable Expo app demonstrating all Keel built-in components with the React Native Paper preset.

---

## What Is This

`keel-demo` demonstrates the full Keel AI-to-UI loop: a backend server generates SDUI screens dynamically, the frontend renders them with Material Design 3 styling via the Paper preset, and user interactions (button taps, form submissions, messages) flow back to the server which responds with new screens. It also includes a static mode showcasing every built-in component.

---

## Running the Demo

### Live Mode (full AI-to-UI loop)

```bash
# Terminal 1 — Start the demo server
cd examples/keel-demo/server
pip install -r requirements.txt
uvicorn main:app --port 8765

# Terminal 2 — Start the app
cd examples/keel-demo
npm install
npx expo start
```

The app connects to the server via WebSocket. A green dot in the status bar means "Live — AI Connected". Try typing messages in the InputBar: "hello", "form", "dashboard", "buttons". Each generates a new screen dynamically.

### Static Mode (no server required)

```bash
cd examples/keel-demo
npm install
npx expo start
```

If no server is running, the app falls back to static demo screens. You can also toggle between Live/Static mode with the switch in the status bar.

---

## What You Will See

### Live Mode

The server responds to user messages with dynamically generated SDUI screens:

| Message | Response |
|---------|----------|
| "hello" | Welcome screen with suggestions |
| "form" | Interactive contact form with validation |
| "dashboard" | Dashboard with stats and action buttons |
| "buttons" | Interactive buttons that trigger new screens |
| anything else | Echoed back in a styled card |

Buttons, forms, and the InputBar all send actions to the server, which responds with new screens — demonstrating the complete Keel protocol loop.

### Static Mode

Two tabs selectable via a segmented control:

| Tab | Contents |
|-----|----------|
| **Home** | Text variants, buttons, icons, dividers, a container card, the custom WeatherWidget |
| **Calendar** | CalendarModule with sample events |

---

## File Structure

```
examples/keel-demo/
├── src/
│   ├── App.tsx              # Root: WebSocket connection, live/static mode, SDUIPageRenderer
│   ├── screens.ts           # Static SDUIPage objects for fallback mode
│   ├── actionDispatcher.ts  # Standalone action handler (used in tests)
│   └── WeatherWidget.ts     # Custom component registered via registerComponent()
├── server/
│   ├── main.py              # FastAPI server using keel-server (WebSocket + SDUI tools)
│   └── requirements.txt     # Python dependencies
├── package.json
├── app.json
├── babel.config.js
└── tsconfig.json
```

### App.tsx

Connects to the demo server via WebSocket. In live mode, user actions (button taps, form submissions, InputBar messages) are sent to the server as JSON, and the server responds with new SDUI screens. Falls back to static screens if no server is running.

### server/main.py

A minimal FastAPI server that uses `keel-server`'s `ConnectionManager`, `normalize_sdui_screen()`, and `InMemoryScreenStore`. It includes a rule-based "AI" responder that generates SDUI screens from user messages. Replace `respond_to_message()` with an LLM call for real AI-driven UI.

### screens.ts

Exports `homeScreen` and `calendarScreen` as typed `SDUIPage` objects. Used as fallback in static mode.

### WeatherWidget.ts

A custom component that registers itself with the Keel renderer at import time. The AI can reference type `"WeatherWidget"` in any SDUI page and the renderer will find it.

---

## How the Paper Preset Works

Three lines in `App.tsx` are all that is needed:

```ts
import { registerPreset } from '@keel/renderer';
import { PaperPreset } from '@keel/renderer/presets/paper';

registerPreset(PaperPreset);
```

After this call, every `Button`, `Text`, `TextInput`, `Divider`, `Icon`, and `Container` in any `SDUIPageRenderer` renders as a Material Design 3 component. Composite components (`CalendarModule`, `ChatModule`, etc.) are unaffected.

---

## Adding a Custom Component

The `WeatherWidget` pattern:

1. Write a React Native component that accepts your props.
2. Call `registerComponent('WeatherWidget', WeatherWidget)` at module load time.
3. Import the file once in `App.tsx` so the registration side effect runs.

```ts
// WeatherWidget.ts
import { registerComponent } from '@keel/renderer';

function WeatherWidget({ city, temperature, unit = 'C' }) {
  // ... render
}

registerComponent('WeatherWidget', WeatherWidget);
```

```ts
// App.tsx
import './WeatherWidget'; // side-effect import triggers registration
```

Now any SDUI page served by an AI agent can include:

```json
{
  "type": "WeatherWidget",
  "id": "weather-1",
  "props": { "city": "San Francisco", "temperature": 18, "unit": "C" }
}
```

---

## Running Tests

From the repository root:

```bash
npm test
```

This runs all Jest tests across the monorepo, including the renderer and protocol packages.
