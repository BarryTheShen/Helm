import { useEffect, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { VariablePill } from './VariablePillExtension';
import type { VariablePillAttributes } from './VariablePillExtension';
import { VariablePicker } from './VariablePicker';
import './pill-editor.css';

interface PillEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  screenComponents?: Array<{ id: string; type: string }>;
  className?: string;
}

// Parse {{namespace.key}} format to pills and text
function parseValueToPillsAndText(value: string): { type: 'text' | 'pill'; content: string | VariablePillAttributes }[] {
  const parts: { type: 'text' | 'pill'; content: string | VariablePillAttributes }[] = [];
  const regex = /\{\{([^}]+)\}\}/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(value)) !== null) {
    // Add text before the match
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: value.slice(lastIndex, match.index) });
    }

    // Parse the variable
    const variable = match[1];
    const [namespace, ...keyParts] = variable.split('.');
    const key = keyParts.join('.');

    parts.push({
      type: 'pill',
      content: {
        namespace,
        key,
        displayName: variable,
      },
    });

    lastIndex = regex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < value.length) {
    parts.push({ type: 'text', content: value.slice(lastIndex) });
  }

  return parts;
}

// Convert TipTap JSON to {{namespace.key}} format
function serializeEditorContent(json: any): string {
  if (!json || !json.content) return '';

  let result = '';

  function traverse(node: any) {
    if (node.type === 'text') {
      result += node.text || '';
    } else if (node.type === 'variablePill') {
      const { namespace, key } = node.attrs;
      result += `{{${namespace}.${key}}}`;
    } else if (node.content) {
      node.content.forEach(traverse);
    }
  }

  json.content.forEach(traverse);
  return result;
}

export function PillEditor({
  value,
  onChange,
  placeholder = 'Type @ to insert variables',
  multiline = false,
  screenComponents,
  className,
}: PillEditorProps) {
  const [pickerState, setPickerState] = useState<{
    isOpen: boolean;
    position?: { x: number; y: number };
    filter: string;
  }>({
    isOpen: false,
    filter: '',
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        codeBlock: false,
        horizontalRule: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        // Keep paragraph always enabled — disabling it breaks ProseMirror's schema
        // (doc content expression references the 'block' group which paragraph belongs to)
        hardBreak: multiline ? undefined : false,
      }),
      Placeholder.configure({
        placeholder,
      }),
      VariablePill,
    ],
    editorProps: {
      attributes: {
        class: className || 'prose prose-sm focus:outline-none min-h-[32px] px-2 py-1.5 text-xs',
      },
      handleKeyDown: multiline ? undefined : (_view, event) => {
        if (event.key === 'Enter') { event.preventDefault(); return true; }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON();
      const serialized = serializeEditorContent(json);
      onChange(serialized);
    },
    onCreate: ({ editor }) => {
      // Initialize content from value prop
      if (value) {
        const parts = parseValueToPillsAndText(value);
        const content: any[] = [];

        parts.forEach((part) => {
          if (part.type === 'text') {
            content.push({
              type: 'text',
              text: part.content as string,
            });
          } else {
            content.push({
              type: 'variablePill',
              attrs: part.content,
            });
          }
        });

        editor.commands.setContent({
          type: 'doc',
          content: [{ type: 'paragraph', content: content.length > 0 ? content : [] }],
        });
      }
    },
  });

  // Handle @ key to open picker
  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === '@' && !pickerState.isOpen) {
        event.preventDefault();

        // Get cursor position
        const { view } = editor;
        const { from } = view.state.selection;
        const coords = view.coordsAtPos(from);

        // Insert @ character
        editor.commands.insertContent('@');

        // Open picker
        setPickerState({
          isOpen: true,
          position: {
            x: coords.left,
            y: coords.bottom + 5,
          },
          filter: '',
        });
      } else if (event.key === 'Escape' && pickerState.isOpen) {
        event.preventDefault();
        handleClosePicker();
      }
    };

    const handleInput = () => {
      if (!pickerState.isOpen) return;

      const { state } = editor;
      const { from } = state.selection;
      const textBefore = state.doc.textBetween(Math.max(0, from - 50), from);
      const lastAtIndex = textBefore.lastIndexOf('@');

      if (lastAtIndex === -1) {
        // @ was deleted
        handleClosePicker();
        return;
      }

      const filterText = textBefore.slice(lastAtIndex + 1);

      // Close picker if space or special chars
      if (/[\s,;(){}[\]]/.test(filterText)) {
        handleClosePicker();
        return;
      }

      setPickerState((prev) => ({
        ...prev,
        filter: filterText,
      }));
    };

    editor.view.dom.addEventListener('keydown', handleKeyDown);
    editor.on('update', handleInput);

    return () => {
      editor.view.dom.removeEventListener('keydown', handleKeyDown);
      editor.off('update', handleInput);
    };
  }, [editor, pickerState.isOpen]);

  const handleVariableSelect = (variable: string) => {
    if (!editor) return;

    // Parse {{namespace.key}} format
    const match = variable.match(/\{\{([^.]+)\.([^}]+)\}\}/);
    if (!match) return;

    const [, namespace, key] = match;

    // Find and delete the @ and filter text
    const { state } = editor;
    const { from } = state.selection;
    const textBefore = state.doc.textBetween(Math.max(0, from - 50), from);
    const lastAtIndex = textBefore.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const deleteFrom = from - (textBefore.length - lastAtIndex);
      editor.commands.deleteRange({ from: deleteFrom, to: from });
    }

    // Insert the pill
    editor
      .chain()
      .focus()
      .insertVariablePill({
        namespace,
        key,
        displayName: `${namespace}.${key}`,
      })
      .run();

    handleClosePicker();
  };

  const handleClosePicker = () => {
    setPickerState({
      isOpen: false,
      filter: '',
    });

    // Remove trailing @ if picker was closed without selection
    if (editor) {
      const { state } = editor;
      const { from } = state.selection;
      const textBefore = state.doc.textBetween(Math.max(0, from - 1), from);
      if (textBefore === '@') {
        editor.commands.deleteRange({ from: from - 1, to: from });
      }
    }
  };

  // Sync external value changes
  useEffect(() => {
    if (!editor || editor.isFocused) return;

    const currentSerialized = serializeEditorContent(editor.getJSON());
    if (currentSerialized !== value) {
      const parts = parseValueToPillsAndText(value);
      const content: any[] = [];

      parts.forEach((part) => {
        if (part.type === 'text') {
          content.push({
            type: 'text',
            text: part.content as string,
          });
        } else {
          content.push({
            type: 'variablePill',
            attrs: part.content,
          });
        }
      });

      editor.commands.setContent({
        type: 'doc',
        content: [{ type: 'paragraph', content: content.length > 0 ? content : [] }],
      });
    }
  }, [value, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="relative">
      <div
        className={`border border-gray-200 rounded-md focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500 ${
          multiline ? 'min-h-[80px]' : ''
        }`}
      >
        <EditorContent editor={editor} />
      </div>

      {pickerState.isOpen && (
        <VariablePicker
          onSelect={handleVariableSelect}
          onClose={handleClosePicker}
          position={pickerState.position}
          filter={pickerState.filter}
          screenComponents={screenComponents}
        />
      )}
    </div>
  );
}
