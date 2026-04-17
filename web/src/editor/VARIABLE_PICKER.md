# VariablePicker Component

A popover component for the web admin panel that provides variable insertion with @ trigger in text fields.

## Features

- Triggers on `@` character in text inputs
- Shows categorized variable list in a popover
- Filters variables as user types
- Inserts `{{namespace.key}}` syntax on selection
- Fetches custom variables from `/api/variables`
- Fetches connections from `/api/connections`
- Supports dynamic component variables based on screen components

## Namespaces

### Static Namespaces

- **user.*** — Current user data
  - `user.username` — Username
  - `user.id` — User ID
  - `user.email` — Email address

- **self.*** — Current component state
  - `self.value` — Component value
  - `self.state` — Component state

- **env.*** — Environment variables
  - `env.NODE_ENV` — Environment name
  - `env.API_URL` — API base URL

- **data.*** — Data source fields
  - `data.source_name.field` — Field from data source

### Dynamic Namespaces

- **component.*** — Screen component values (passed via `screenComponents` prop)
  - `component.<id>.value` — Value of specific component

- **custom.*** — Custom variables (fetched from `/api/variables`)
  - `custom.<name>` — User-defined variable

- **connection.*** — Connection credentials (fetched from `/api/connections`)
  - `connection.<name>.credential_key` — Connection credential field

## Usage

### Basic Usage with VariableInput

```tsx
import { VariableInput } from './editor/VariableInput';

function MyComponent() {
  const [value, setValue] = useState('');

  return (
    <VariableInput
      value={value}
      onChange={setValue}
      placeholder="Type @ to insert variables"
    />
  );
}
```

### With Screen Components

```tsx
import { VariableInput } from './editor/VariableInput';
import { useEditorStore } from './editor/useEditorStore';

function PropertyPanel() {
  const rows = useEditorStore(s => s.rows);
  
  // Extract all components from screen
  const screenComponents = rows.flatMap(row =>
    row.cells.flatMap(cell =>
      cell.content ? [{ id: cell.content.id, type: cell.content.type }] : []
    )
  );

  return (
    <VariableInput
      value={propValue}
      onChange={setPropValue}
      screenComponents={screenComponents}
    />
  );
}
```

### Advanced: Direct VariablePicker Usage

```tsx
import { VariablePicker } from './editor/VariablePicker';
import { useVariablePicker } from './editor/useVariablePicker';

function CustomInput() {
  const {
    pickerState,
    handleKeyDown,
    handleChange,
    handleSelect,
    handleClose,
    registerInput,
  } = useVariablePicker();

  return (
    <>
      <input
        ref={registerInput}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
      />
      {pickerState.isOpen && (
        <VariablePicker
          onSelect={handleSelect}
          onClose={handleClose}
          position={pickerState.position}
          filter={pickerState.filter}
        />
      )}
    </>
  );
}
```

## API

### VariablePicker Props

```tsx
interface VariablePickerProps {
  onSelect: (variable: string) => void;  // Called when variable is selected
  onClose: () => void;                    // Called when picker should close
  position?: { x: number; y: number };    // Screen position for popover
  filter?: string;                        // Filter text for variable search
  screenComponents?: Array<{              // Components for component.* namespace
    id: string;
    type: string;
  }>;
}
```

### VariableInput Props

```tsx
interface VariableInputProps {
  value: string;                          // Input value
  onChange: (value: string) => void;      // Change handler
  placeholder?: string;                   // Placeholder text
  className?: string;                     // Custom CSS classes
  multiline?: boolean;                    // Use textarea instead of input
  screenComponents?: Array<{              // Components for component.* namespace
    id: string;
    type: string;
  }>;
}
```

### useVariablePicker Hook

```tsx
const {
  pickerState,      // Current picker state (isOpen, position, filter, cursorPosition)
  handleKeyDown,    // KeyDown handler for input
  handleChange,     // Change handler for input
  handleSelect,     // Variable selection handler
  handleClose,      // Close picker handler
  registerInput,    // Ref callback for input element
} = useVariablePicker();
```

## Files

- `/web/src/editor/VariablePicker.tsx` — Main popover component
- `/web/src/editor/VariableInput.tsx` — Integrated input component
- `/web/src/editor/useVariablePicker.tsx` — Hook for @ trigger logic
- `/web/src/lib/api.ts` — API client with Connection types and methods

## Backend Integration

The component fetches data from:

- `GET /api/variables` — Custom variables
- `GET /api/connections` — Connection credentials

Variable resolution happens server-side via `/backend/app/services/variable_resolver.py`.
