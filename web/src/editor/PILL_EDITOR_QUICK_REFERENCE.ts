// Quick Reference: Using the Variable Pill Editor

// ============================================================================
// BASIC USAGE
// ============================================================================

import { PillEditor } from '../editor/PillEditor';

function MyComponent() {
  const [value, setValue] = useState('Hello {{user.name}}!');

  return (
    <PillEditor
      value={value}
      onChange={setValue}
      placeholder="Type @ to insert variables"
    />
  );
}

// ============================================================================
// MULTILINE MODE
// ============================================================================

<PillEditor
  value={markdownContent}
  onChange={setMarkdownContent}
  placeholder="Type @ to insert variables"
  multiline={true}  // Enables line breaks
/>

// ============================================================================
// WITH COMPONENT VARIABLES
// ============================================================================

const screenComponents = [
  { id: 'input1', type: 'TextInput' },
  { id: 'button1', type: 'Button' },
];

<PillEditor
  value={value}
  onChange={setValue}
  screenComponents={screenComponents}  // Enables component.* variables
/>

// ============================================================================
// CUSTOM STYLING
// ============================================================================

<PillEditor
  value={value}
  onChange={setValue}
  className="custom-editor-class"  // Applied to ProseMirror container
/>

// ============================================================================
// SERIALIZATION FORMAT
// ============================================================================

// Input (what user sees):
// "Hello [👤 user.name], your email is [👤 user.email]"

// Output (what onChange receives):
// "Hello {{user.name}}, your email is {{user.email}}"

// Backend receives the {{}} format unchanged

// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================

// @ - Open variable picker
// ESC - Close picker
// Backspace - Delete pill when cursor is after it
// Delete - Delete pill when cursor is before it
// Arrow keys - Navigate text (pills are atomic, cursor jumps over them)

// ============================================================================
// NAMESPACE ICONS
// ============================================================================

const NAMESPACE_ICONS = {
  user: '👤',        // User variables (user.name, user.email)
  self: '🔄',        // Self-referential (self.value, self.state)
  custom: '⚙️',      // Custom variables (custom.appName)
  env: '🌍',         // Environment (env.serverUrl)
  component: '🧩',   // Component references (component.input1.value)
  connection: '🔗',  // API connections (connection.github.token)
  data: '📊',        // Data sources (data.calendar.events)
};

// ============================================================================
// EXTENDING THE EDITOR
// ============================================================================

// To add custom extensions:
import { useEditor } from '@tiptap/react';
import { VariablePill } from './VariablePillExtension';
import MyCustomExtension from './MyCustomExtension';

const editor = useEditor({
  extensions: [
    StarterKit,
    VariablePill,
    MyCustomExtension,  // Add your extension here
  ],
});

// ============================================================================
// PROGRAMMATIC PILL INSERTION
// ============================================================================

// Insert a pill programmatically:
editor?.commands.insertVariablePill({
  namespace: 'user',
  key: 'name',
  displayName: 'user.name',
});

// ============================================================================
// ACCESSING EDITOR INSTANCE
// ============================================================================

import { useEditor } from '@tiptap/react';

function MyComponent() {
  const editorRef = useRef<Editor | null>(null);

  const editor = useEditor({
    // ... config
    onCreate: ({ editor }) => {
      editorRef.current = editor;
    },
  });

  // Later:
  editorRef.current?.commands.focus();
}

// ============================================================================
// VALIDATION
// ============================================================================

// Check if value contains variables:
function hasVariables(value: string): boolean {
  return /\{\{[^}]+\}\}/.test(value);
}

// Extract all variables:
function extractVariables(value: string): string[] {
  const matches = value.matchAll(/\{\{([^}]+)\}\}/g);
  return Array.from(matches, m => m[1]);
}

// Example:
const vars = extractVariables('Hello {{user.name}}, email: {{user.email}}');
// Returns: ['user.name', 'user.email']

// ============================================================================
// COMMON PATTERNS
// ============================================================================

// 1. Controlled input with validation
function ValidatedPillInput() {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');

  const handleChange = (newValue: string) => {
    setValue(newValue);

    // Validate
    if (newValue.length > 200) {
      setError('Text too long');
    } else {
      setError('');
    }
  };

  return (
    <div>
      <PillEditor value={value} onChange={handleChange} />
      {error && <span className="text-red-500 text-xs">{error}</span>}
    </div>
  );
}

// 2. Debounced onChange
import { useMemo } from 'react';
import { debounce } from 'lodash';

function DebouncedPillInput({ onSave }: { onSave: (value: string) => void }) {
  const [localValue, setLocalValue] = useState('');

  const debouncedSave = useMemo(
    () => debounce(onSave, 500),
    [onSave]
  );

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);
    debouncedSave(newValue);
  };

  return <PillEditor value={localValue} onChange={handleChange} />;
}

// 3. Read-only display
function ReadOnlyPillDisplay({ value }: { value: string }) {
  return (
    <PillEditor
      value={value}
      onChange={() => {}}  // No-op
      className="pointer-events-none opacity-75"
    />
  );
}

// ============================================================================
// TROUBLESHOOTING
// ============================================================================

// Problem: Pills don't render
// Solution: Check console for TipTap import errors, verify npm install

// Problem: @ trigger doesn't work
// Solution: Ensure editor has focus, check VariablePicker renders

// Problem: Serialization issues
// Solution: Test with simple case, check regex in parseValueToPillsAndText

// Problem: Styling conflicts
// Solution: Check pill-editor.css loads, verify no global CSS conflicts

// ============================================================================
// TESTING
// ============================================================================

// Unit test example (Jest + React Testing Library):
import { render, screen, fireEvent } from '@testing-library/react';

test('inserts pill on variable selection', () => {
  const handleChange = jest.fn();
  render(<PillEditor value="" onChange={handleChange} />);

  const editor = screen.getByRole('textbox');
  fireEvent.keyDown(editor, { key: '@' });

  // Select variable from picker
  const userNameOption = screen.getByText('user.name');
  fireEvent.click(userNameOption);

  // Verify serialized output
  expect(handleChange).toHaveBeenCalledWith('{{user.name}}');
});

// ============================================================================
// PERFORMANCE TIPS
// ============================================================================

// 1. Memoize screenComponents prop
const screenComponents = useMemo(
  () => rows.flatMap(r => r.cells.map(c => ({ id: c.id, type: c.type }))),
  [rows]
);

// 2. Debounce onChange for expensive operations
const debouncedOnChange = useMemo(() => debounce(onChange, 300), [onChange]);

// 3. Lazy load editor for large forms
const PillEditor = lazy(() => import('./PillEditor'));

// ============================================================================
// MIGRATION FROM OLD VariableInput
// ============================================================================

// Old code:
<input
  value={value}
  onChange={e => onChange(e.target.value)}
  placeholder="Type @ to insert variables"
/>

// New code (drop-in replacement):
<VariableInput
  value={value}
  onChange={onChange}
  placeholder="Type @ to insert variables"
/>

// VariableInput now uses PillEditor internally - no changes needed!
