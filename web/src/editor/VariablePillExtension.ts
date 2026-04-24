import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { VariablePillNodeView } from './VariablePillNodeView';

export interface VariablePillAttributes {
  namespace: string;
  key: string;
  displayName: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    variablePill: {
      insertVariablePill: (attributes: VariablePillAttributes) => ReturnType;
    };
  }
}

export const VariablePill = Node.create({
  name: 'variablePill',

  group: 'inline',

  inline: true,

  atom: true,

  addAttributes() {
    return {
      namespace: {
        default: '',
        parseHTML: element => element.getAttribute('data-namespace'),
        renderHTML: attributes => ({
          'data-namespace': attributes.namespace,
        }),
      },
      key: {
        default: '',
        parseHTML: element => element.getAttribute('data-key'),
        renderHTML: attributes => ({
          'data-key': attributes.key,
        }),
      },
      displayName: {
        default: '',
        parseHTML: element => element.getAttribute('data-display-name'),
        renderHTML: attributes => ({
          'data-display-name': attributes.displayName,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-type="variable-pill"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'variable-pill' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VariablePillNodeView);
  },

  addCommands() {
    return {
      insertVariablePill:
        (attributes: VariablePillAttributes) =>
        ({ commands, state, tr }) => {
          // Insert the pill with a trailing space
          return commands.insertContent([
            {
              type: this.name,
              attrs: attributes,
            },
            {
              type: 'text',
              text: ' ',
            },
          ]);
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      ArrowLeft: () => {
        const { state } = this.editor;
        const { selection } = state;
        const { $from } = selection;

        // Check if cursor is right after a variable pill
        const nodeBefore = $from.nodeBefore;
        if (nodeBefore && nodeBefore.type.name === this.name) {
          // Jump to before the pill
          return this.editor.commands.setTextSelection($from.pos - nodeBefore.nodeSize);
        }

        return false;
      },
      ArrowRight: () => {
        const { state } = this.editor;
        const { selection } = state;
        const { $from } = selection;

        // Check if cursor is right before a variable pill
        const nodeAfter = $from.nodeAfter;
        if (nodeAfter && nodeAfter.type.name === this.name) {
          // Jump to after the pill
          return this.editor.commands.setTextSelection($from.pos + nodeAfter.nodeSize);
        }

        return false;
      },
      Backspace: () => {
        const { state } = this.editor;
        const { selection } = state;
        const { $from } = selection;

        // Check if cursor is right after a variable pill
        const nodeBefore = $from.nodeBefore;
        if (nodeBefore && nodeBefore.type.name === this.name) {
          // Delete the entire pill
          return this.editor.commands.deleteRange({
            from: $from.pos - nodeBefore.nodeSize,
            to: $from.pos,
          });
        }

        return false;
      },
      Delete: () => {
        const { state } = this.editor;
        const { selection } = state;
        const { $from } = selection;

        // Check if cursor is right before a variable pill
        const nodeAfter = $from.nodeAfter;
        if (nodeAfter && nodeAfter.type.name === this.name) {
          // Delete the entire pill
          return this.editor.commands.deleteRange({
            from: $from.pos,
            to: $from.pos + nodeAfter.nodeSize,
          });
        }

        return false;
      },
    };
  },
});
