# Custom Components Guide

Keel's component registry is extensible — you can add your own components that AI agents can render dynamically.

## Registering a Component

```tsx
import { registerComponent } from '@keel/renderer';
import type { SDUIAction } from '@keel/protocol';

// Define your component — it receives props from the SDUI JSON
interface WeatherWidgetProps {
  city: string;
  temperature: number;
  unit?: 'C' | 'F';
  onPress?: SDUIAction;
}

function WeatherWidget({ city, temperature, unit = 'C', onPress }: WeatherWidgetProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.city}>{city}</Text>
      <Text style={styles.temp}>{temperature}°{unit}</Text>
    </View>
  );
}

// Register it — type string must match what the AI/backend sends
registerComponent('WeatherWidget', WeatherWidget);
```

## Using It in SDUI JSON

Once registered, your component is available in any SDUI payload:

```json
{
  "schema_version": "1.0.0",
  "module_id": "home",
  "rows": [
    {
      "id": "weather-row",
      "cells": [
        {
          "id": "weather-cell",
          "width": 1,
          "content": {
            "type": "WeatherWidget",
            "id": "weather-1",
            "props": {
              "city": "San Francisco",
              "temperature": 68,
              "unit": "F"
            }
          }
        }
      ]
    }
  ]
}
```

## Component Contract

Your component receives exactly what's in `props` from the SDUI JSON. The renderer:

1. Looks up the `type` string in the registry
2. Passes `props` as React props to your component
3. If your component has `children`, they are rendered recursively

### Handling Actions

If your component has interactive elements, accept an `onPress` or `dispatch` prop typed as `SDUIAction`, and call the parent's `onAction` callback:

```tsx
interface MyButtonProps {
  label: string;
  onPress: SDUIAction;
}

// The renderer wraps your component and provides dispatch via context
function MyButton({ label, onPress }: MyButtonProps & { dispatch?: (action: SDUIAction) => void }) {
  return (
    <TouchableOpacity onPress={() => dispatch?.(onPress)}>
      <Text>{label}</Text>
    </TouchableOpacity>
  );
}
```

## Checking Registered Types

```tsx
import { getRegisteredTypes } from '@keel/renderer';

console.log(getRegisteredTypes());
// ['Text', 'Markdown', 'Button', 'Image', 'TextInput', 'Icon', 'Divider',
//  'Container', 'CalendarModule', 'ChatModule', 'NotesModule', 'InputBar',
//  'WeatherWidget']
```

## Best Practices

1. **Use PascalCase** for type names — `'WeatherWidget'` not `'weather_widget'`
2. **Keep components pure** — no side effects, no global state, no API calls
3. **Type your props** — helps AI agents generate correct SDUI payloads
4. **Register early** — call `registerComponent()` at app startup, before any SDUI renders
5. **Handle missing props gracefully** — AI-generated JSON may be incomplete
