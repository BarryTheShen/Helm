// Component property schemas for the dynamic property inspector.

export type FieldType = 'text' | 'number' | 'select' | 'toggle' | 'textarea' | 'color' | 'icon-picker' | 'action-params';

export interface FieldSchema {
  key: string;
  label: string;
  type: FieldType;
  defaultValue?: unknown;
  options?: Array<{ label: string; value: unknown }>;
  placeholder?: string;
  group?: string;
  visibleWhen?: (props: Record<string, unknown>) => boolean;
}

export interface ActionSchema {
  type: string;
  label: string;
  fields: FieldSchema[];
}

export const ACTION_TYPES: ActionSchema[] = [
  { type: 'none', label: 'None', fields: [] },
  {
    type: 'navigate',
    label: 'Navigate',
    fields: [
      { key: 'screen', label: 'Screen', type: 'select', placeholder: 'Select module' },
    ],
  },
  {
    type: 'server_action',
    label: 'Server Action',
    fields: [
      { key: 'function', label: 'Function', type: 'select', placeholder: 'Select function' },
      { key: 'params', label: 'Parameters', type: 'action-params' },
    ],
  },
  {
    type: 'run_workflow',
    label: 'Run Workflow',
    fields: [
      { key: 'workflow', label: 'Workflow', type: 'select', placeholder: 'Select workflow' },
      { key: 'params', label: 'Parameters', type: 'action-params' },
    ],
  },
  {
    type: 'open_url',
    label: 'Open URL',
    fields: [
      { key: 'url', label: 'URL', type: 'text', placeholder: 'https://example.com' },
    ],
  },
  { type: 'go_back', label: 'Go Back', fields: [] },
  {
    type: 'send_to_agent',
    label: 'Send to Agent',
    fields: [
      { key: 'message', label: 'Message', type: 'text', placeholder: 'Message to send' },
    ],
  },
  {
    type: 'copy_text',
    label: 'Copy Text',
    fields: [
      { key: 'text', label: 'Text to Copy', type: 'text', placeholder: 'Text to copy to clipboard' },
    ],
  },
];

export const COMPONENT_SCHEMAS: Record<string, FieldSchema[]> = {
  Text: [
    { key: 'content', label: 'Content', type: 'text', defaultValue: 'Text' },
    { key: 'variant', label: 'Variant', type: 'select', defaultValue: 'body', options: [
      { label: 'Heading', value: 'heading' },
      { label: 'Body', value: 'body' },
      { label: 'Caption', value: 'caption' },
    ] },
    { key: 'fontSize', label: 'Font Size', type: 'number', placeholder: 'Variant default' },
    { key: 'fontWeight', label: 'Font Weight', type: 'text', placeholder: 'Variant default' },
    { key: 'color', label: 'Color', type: 'color', defaultValue: '#000000' },
    { key: 'align', label: 'Align', type: 'select', defaultValue: 'left', options: [
      { label: 'Left', value: 'left' },
      { label: 'Center', value: 'center' },
      { label: 'Right', value: 'right' },
    ] },
    { key: 'bold', label: 'Bold', type: 'toggle', defaultValue: false },
    { key: 'italic', label: 'Italic', type: 'toggle', defaultValue: false },
  ],
  Markdown: [
    { key: 'content', label: 'Content', type: 'textarea', defaultValue: '# Heading\n\nParagraph text' },
  ],
  Button: [
    {
      key: 'label',
      label: 'Label',
      type: 'text',
      defaultValue: 'Button',
      visibleWhen: (props) => props.variant !== 'icon',
    },
    { key: 'icon', label: 'Icon', type: 'icon-picker', defaultValue: '' },
    { key: 'variant', label: 'Variant', type: 'select', defaultValue: 'primary', options: [
      { label: 'Primary', value: 'primary' },
      { label: 'Secondary', value: 'secondary' },
      { label: 'Ghost', value: 'ghost' },
      { label: 'Destructive', value: 'destructive' },
      { label: 'Icon Only', value: 'icon' },
    ] },
  ],
  Image: [
    { key: 'src', label: 'Image URL', type: 'text', defaultValue: 'https://via.placeholder.com/300x200' },
    { key: 'alt', label: 'Alt Text', type: 'text', defaultValue: '' },
    { key: 'width', label: 'Width', type: 'text', defaultValue: '100%' },
    { key: 'height', label: 'Height', type: 'number', defaultValue: 200 },
    { key: 'aspectRatio', label: 'Aspect Ratio', type: 'number', defaultValue: 1.7777777778 },
    { key: 'borderRadius', label: 'Border Radius', type: 'number', defaultValue: 0 },
    { key: 'resizeMode', label: 'Resize Mode', type: 'select', defaultValue: 'contain', options: [
      { label: 'Cover', value: 'cover' },
      { label: 'Contain', value: 'contain' },
      { label: 'Stretch', value: 'stretch' },
      { label: 'Center', value: 'center' },
    ] },
  ],
  TextInput: [
    { key: 'value', label: 'Default Value', type: 'text', defaultValue: '' },
    { key: 'placeholder', label: 'Placeholder', type: 'text', defaultValue: 'Enter text...' },
    { key: 'multiline', label: 'Multiline', type: 'toggle', defaultValue: false },
    { key: 'maxLines', label: 'Max Lines', type: 'number', defaultValue: 3 },
    { key: 'secureTextEntry', label: 'Secure Entry', type: 'toggle', defaultValue: false },
    { key: 'keyboardType', label: 'Keyboard Type', type: 'select', defaultValue: 'default', options: [
      { label: 'Default', value: 'default' },
      { label: 'Email', value: 'email-address' },
      { label: 'Numeric', value: 'numeric' },
      { label: 'Phone', value: 'phone-pad' },
      { label: 'URL', value: 'url' },
    ] },
    { key: 'editable', label: 'Editable', type: 'toggle', defaultValue: true },
  ],
  Icon: [
    { key: 'name', label: 'Icon', type: 'icon-picker', defaultValue: 'star' },
    { key: 'size', label: 'Size', type: 'number', defaultValue: 24, placeholder: '24' },
    { key: 'color', label: 'Color', type: 'color', defaultValue: '#000000' },
  ],
  Container: [
    { key: 'direction', label: 'Direction', type: 'select', defaultValue: 'column', options: [
      { label: 'Column', value: 'column' },
      { label: 'Row', value: 'row' },
    ] },
    { key: 'gap', label: 'Gap', type: 'number', defaultValue: 0 },
    { key: 'padding', label: 'Padding', type: 'number', defaultValue: 0 },
    { key: 'backgroundColor', label: 'Background', type: 'color', defaultValue: '#FFFFFF' },
    { key: 'borderRadius', label: 'Border Radius', type: 'number', defaultValue: 0 },
    { key: 'shadow', label: 'Shadow', type: 'select', defaultValue: '', options: [
      { label: 'None', value: '' },
      { label: 'Small', value: 'sm' },
      { label: 'Medium', value: 'md' },
      { label: 'Large', value: 'lg' },
    ] },
    { key: 'flex', label: 'Flex', type: 'number', defaultValue: 0 },
    { key: 'align', label: 'Align', type: 'select', defaultValue: '', options: [
      { label: 'Default', value: '' },
      { label: 'Start', value: 'flex-start' },
      { label: 'Center', value: 'center' },
      { label: 'End', value: 'flex-end' },
      { label: 'Stretch', value: 'stretch' },
    ] },
    { key: 'justify', label: 'Justify', type: 'select', defaultValue: '', options: [
      { label: 'Default', value: '' },
      { label: 'Start', value: 'flex-start' },
      { label: 'Center', value: 'center' },
      { label: 'End', value: 'flex-end' },
      { label: 'Space Between', value: 'space-between' },
      { label: 'Space Around', value: 'space-around' },
    ] },
  ],
  CalendarModule: [
    { key: 'defaultView', label: 'Variant', type: 'select', defaultValue: 'month', options: [
      { label: 'Month', value: 'month' },
      { label: 'Week', value: 'week' },
      { label: 'Day', value: 'day' },
      { label: 'Event List', value: 'agenda' },
      { label: 'Compact', value: 'compact' },
    ] },
  ],
  Calendar: [
    { key: 'variant', label: 'Variant', type: 'select', defaultValue: 'month', options: [
      { label: 'Month', value: 'month' },
      { label: 'Week', value: 'week' },
      { label: 'Day', value: 'day' },
      { label: 'Event List', value: 'agenda' },
      { label: 'Compact', value: 'compact' },
    ] },
    { key: 'events', label: 'Events (JSON)', type: 'textarea', placeholder: '[{"id":"1","title":"Event","start":"2026-04-17T10:00:00Z","end":"2026-04-17T11:00:00Z"}]' },
  ],
  Todo: [
    { key: 'items', label: 'Items (JSON)', type: 'textarea', placeholder: '[{"id":"1","text":"Task 1","completed":false}]' },
    { key: 'placeholder', label: 'Placeholder', type: 'text', defaultValue: 'Add a new task...' },
  ],
  RichTextRenderer: [
    { key: 'content', label: 'Content (Markdown)', type: 'textarea', placeholder: '# Heading\n\nParagraph with **bold** and *italic*.' },
    { key: 'theme', label: 'Theme', type: 'select', defaultValue: 'light', options: [
      { label: 'Light', value: 'light' },
      { label: 'Dark', value: 'dark' },
    ] },
  ],
  ArticleCard: [
    { key: 'title', label: 'Title', type: 'text', defaultValue: 'Article Title' },
    { key: 'description', label: 'Description', type: 'textarea', placeholder: 'Brief article description...' },
    { key: 'imageUrl', label: 'Image URL', type: 'text', placeholder: 'https://example.com/image.jpg' },
    { key: 'publishedAt', label: 'Published At', type: 'text', placeholder: '2026-04-17T10:00:00Z' },
    { key: 'source', label: 'Source', type: 'text', placeholder: 'Source name' },
  ],
  ChatModule: [
    { key: 'threadId', label: 'Thread ID', type: 'text', placeholder: 'Optional conversation thread ID' },
  ],
  NotesModule: [],
  InputBar: [
    { key: 'value', label: 'Default Value', type: 'text', defaultValue: '' },
    { key: 'placeholder', label: 'Placeholder', type: 'text', defaultValue: 'Type a message...' },
    { key: 'maxLines', label: 'Max Lines', type: 'number', defaultValue: 6 },
  ],
  Empty: [
    { key: 'gap', label: 'Gap', type: 'number', defaultValue: 8 },
    { key: 'padding', label: 'Padding', type: 'number', defaultValue: 0 },
    { key: 'backgroundColor', label: 'Background', type: 'color', defaultValue: '#FFFFFF' },
  ],
};

export function getDefaultProps(componentType: string): Record<string, unknown> {
  const schema = COMPONENT_SCHEMAS[componentType];
  if (!schema) return {};

  const props: Record<string, unknown> = {};
  for (const field of schema) {
    if (field.defaultValue !== undefined) {
      props[field.key] = field.defaultValue;
    }
  }

  return props;
}