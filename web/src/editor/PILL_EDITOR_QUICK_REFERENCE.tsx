// @ts-nocheck
/* eslint-disable */
// Quick Reference: Using the Variable Pill Editor
// NOTE: This file is a reference document with code examples. It is not meant
// to be executed - the examples below are illustrative code snippets.
//
// ============================================================================
// BASIC USAGE
// ============================================================================
//
// import { PillEditor } from '../editor/PillEditor';
// function MyComponent() {
//   const [value, setValue] = useState('Hello {{user.name}}!');
//   return <PillEditor value={value} onChange={setValue} />;
// }
//
// ============================================================================
// WITH SCREEN COMPONENTS
// ============================================================================
//
// const screenComponents = [
//   { id: 'input1', type: 'InputBar' },
//   { id: 'button1', type: 'Button' },
// ];
// <PillEditor value={value} onChange={setValue} screenComponents={screenComponents} />
//
// ============================================================================
// MULTILINE MODE
// ============================================================================
//
// <PillEditor value={markdownContent} onChange={setMarkdownContent} multiline={true} />
//
// ============================================================================
// CUSTOM STYLING
// ============================================================================
//
// <PillEditor value={value} onChange={setValue} className="custom-editor-class" />
//
// ============================================================================
// SERIALIZATION FORMAT
// ============================================================================
//
// Input (what user sees):  "Hello [user.name], your email is [user.email]"
// Output (what onChange receives): "Hello {{user.name}}, your email is {{user.email}}"
// Backend receives the {{}} format unchanged
//
// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================
//
// @ - Open variable picker
// ESC - Close picker
// Arrow keys - Navigate text (pills are atomic, cursor jumps over them)
//
// ============================================================================
// NAMESPACE ICONS
// ============================================================================
//
// const NAMESPACE_ICONS = {
//   user: 'user', self: 'self', custom: 'custom',
//   env: 'env', component: 'component', connection: 'connection', data: 'data',
// };
//
// ============================================================================
// EXTENDING THE EDITOR
// ============================================================================
//
// import { useEditor } from '@tiptap/react';
// import { VariablePill } from './VariablePillExtension';
// const editor = useEditor({ extensions: [StarterKit, VariablePill] });
//
// ============================================================================
// PROGRAMMATIC PILL INSERTION
// ============================================================================
//
// editor?.commands.insertVariablePill({ namespace: 'user', key: 'name', displayName: 'user.name' });
//
// ============================================================================
// COMMON PATTERNS
// ============================================================================
//
// 1. Controlled input with validation:
// function ValidatedPillInput() {
//   const [value, setValue] = useState('');
//   const [error, setError] = useState('');
//   const handleChange = (newValue) => { setValue(newValue); if (newValue.length > 200) setError('Too long'); else setError(''); };
//   return <div><PillEditor value={value} onChange={handleChange} />{error && <span>{error}</span>}</div>;
// }
//
// 2. Debounced onChange:
// const debouncedSave = useMemo(() => debounce(onSave, 500), [onSave]);
// <PillEditor value={localValue} onChange={handleChange} />
//
// 3. Read-only display:
// <PillEditor value={value} onChange={() => {}} className="pointer-events-none opacity-75" />
//
// ============================================================================
// PERFORMANCE TIPS
// ============================================================================
//
// 1. Memoize screenComponents prop
// 2. Debounce onChange for expensive operations
// 3. Lazy load editor for large forms
//
// ============================================================================
// MIGRATION FROM OLD VariableInput
// ============================================================================
//
// Old code: <input value={value} onChange={e => onChange(e.target.value)} ... />
// New code: <VariableInput value={value} onChange={onChange} ... />
// VariableInput now uses PillEditor internally - no changes needed!
