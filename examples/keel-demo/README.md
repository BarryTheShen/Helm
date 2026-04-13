# keel-demo

Runnable Expo app demonstrating all Keel built-in components with the React Native Paper preset.

---

## What Is This

`keel-demo` is a self-contained Expo application that exercises every built-in Keel component. It uses the Paper preset to render all atomic components with Material Design 3 styling from `react-native-paper`. It also includes a custom `WeatherWidget` component that shows how to extend the registry with third-party or app-specific components. The demo requires no backend — all screen data is defined as static TypeScript objects.

---

## Running the Demo

```bash
cd examples/keel-demo
npm install
npx expo start
```

Scan the QR code with Expo Go on a physical device, or press `i` for iOS simulator / `a` for Android emulator.

---

## What You Will See

The app has two tabs selectable via a segmented control at the top:

| Tab | Contents |
|-----|----------|
| **Home** | Text variants, buttons (primary/secondary/ghost/destructive), icons, dividers, a container card, the custom WeatherWidget |
| **Calendar** | CalendarModule with sample events |

All tappable components show an `Alert` describing the action that would fire in a real app. No network requests are made.

---

## File Structure

```
examples/keel-demo/
├── src/
│   ├── App.tsx              # Root component: PaperProvider, tab bar, SDUIPageRenderer
│   ├── screens.ts           # Static SDUIPage objects for Home and Calendar tabs
│   ├── actionDispatcher.ts  # handleAction() — maps all SDUIAction types to Alert()
│   └── WeatherWidget.ts     # Custom component registered via registerComponent()
├── package.json
├── app.json
├── babel.config.js
└── tsconfig.json
```

### App.tsx

Sets up `PaperProvider` and `SafeAreaProvider`, applies the Paper preset, and renders `SDUIPageRenderer` with the active screen. The tab switch is a plain state variable — no navigation library needed.

### screens.ts

Exports `homeScreen` and `calendarScreen` as typed `SDUIPage` objects. Edit these to experiment with different layouts and component props without touching the app shell.

### actionDispatcher.ts

A switch statement over all 10 `SDUIAction` types. In a real app you would replace `Alert.alert()` calls with actual navigation, API calls, or agent messages.

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
