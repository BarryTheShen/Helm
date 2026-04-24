import { useState } from 'react';
import { PillEditor } from '../editor/PillEditor';

export function PillEditorTestPage() {
  const [singleLineValue, setSingleLineValue] = useState('Hello {{user.name}}, welcome!');
  const [multiLineValue, setMultiLineValue] = useState('Your email: {{user.email}}\nServer: {{env.serverUrl}}');
  const [buttonLabel, setButtonLabel] = useState('Click me, {{user.username}}!');

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-4">Variable Pill Editor Test</h1>
        <p className="text-sm text-gray-600 mb-6">
          Type @ to insert variables. Pills should appear as rounded blue boxes. Try deleting pills with backspace.
        </p>
      </div>

      {/* Single line test */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Single Line Input (Text Component)
        </label>
        <PillEditor
          value={singleLineValue}
          onChange={setSingleLineValue}
          placeholder="Type @ to insert variables"
          multiline={false}
        />
        <div className="text-xs text-gray-500 font-mono bg-gray-50 p-2 rounded">
          Serialized: {singleLineValue}
        </div>
      </div>

      {/* Multiline test */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Multiline Input (Markdown Component)
        </label>
        <PillEditor
          value={multiLineValue}
          onChange={setMultiLineValue}
          placeholder="Type @ to insert variables (multiline)"
          multiline={true}
        />
        <div className="text-xs text-gray-500 font-mono bg-gray-50 p-2 rounded whitespace-pre-wrap">
          Serialized: {multiLineValue}
        </div>
      </div>

      {/* Button label test */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Button Label
        </label>
        <PillEditor
          value={buttonLabel}
          onChange={setButtonLabel}
          placeholder="Button label with variables"
          multiline={false}
        />
        <div className="text-xs text-gray-500 font-mono bg-gray-50 p-2 rounded">
          Serialized: {buttonLabel}
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm">
          Preview: {buttonLabel}
        </button>
      </div>

      {/* Test instructions */}
      <div className="border-t pt-6 space-y-4">
        <h2 className="text-lg font-semibold">Test Checklist</h2>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" />
            <span>Type @ and verify picker opens</span>
          </li>
          <li className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" />
            <span>Select a variable and verify pill appears (blue rounded box)</span>
          </li>
          <li className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" />
            <span>Place cursor after pill and press Backspace - entire pill should delete</span>
          </li>
          <li className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" />
            <span>Place cursor before pill and press Delete - entire pill should delete</span>
          </li>
          <li className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" />
            <span>Try to click inside pill - cursor should not enter pill</span>
          </li>
          <li className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" />
            <span>Verify serialized output shows {`{{namespace.key}}`} format</span>
          </li>
          <li className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" />
            <span>Verify existing {`{{variable}}`} strings load as pills</span>
          </li>
          <li className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" />
            <span>Test multiline editor with line breaks</span>
          </li>
          <li className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" />
            <span>Verify different namespace icons (👤 for user, 🌍 for env, etc.)</span>
          </li>
        </ul>
      </div>

      {/* Raw state display */}
      <div className="border-t pt-6">
        <h2 className="text-lg font-semibold mb-3">Raw State (for debugging)</h2>
        <pre className="text-xs bg-gray-900 text-green-400 p-4 rounded overflow-x-auto">
          {JSON.stringify(
            {
              singleLineValue,
              multiLineValue,
              buttonLabel,
            },
            null,
            2
          )}
        </pre>
      </div>
    </div>
  );
}
