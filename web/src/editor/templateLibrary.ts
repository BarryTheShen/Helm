// Local starter templates keep the left panel usable when saved templates are empty or unavailable.
import type { EditorCell, EditorRow, EditorRowHeight, EditorScreen } from './types';
import { cloneEditorComponent, createEditorId } from './types';

export type TemplateCategory = 'dashboard' | 'planner' | 'tracker' | 'form' | 'custom';

export interface LocalTemplateDefinition {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  kind: 'screen' | 'row';
  screen: EditorScreen;
}

let templateSeedCounter = 0;

function nextSeedId(prefix: string): string {
  templateSeedCounter += 1;
  return `${prefix}-${templateSeedCounter}`;
}

function createCell(type: string, props: Record<string, unknown>, width: number = 1): EditorCell {
  return {
    id: nextSeedId('tpl-cell'),
    width,
    content: {
      id: createEditorId('tpl-component'),
      type,
      props: { ...props },
    },
  };
}

function createRow(cells: EditorCell[], height: EditorRowHeight = 'auto'): EditorRow {
  return {
    id: nextSeedId('tpl-row'),
    height,
    cells,
  };
}

export const LOCAL_SCREEN_TEMPLATES: LocalTemplateDefinition[] = [
  {
    id: 'starter-dashboard',
    name: 'Dashboard Landing',
    description: 'Welcome header, quick stats, and two primary actions.',
    category: 'dashboard',
    kind: 'screen',
    screen: {
      rows: [
        createRow([
          createCell('Text', { content: 'Welcome to Helm', fontSize: 24, fontWeight: 'bold' }),
        ]),
        createRow([
          createCell('Text', { content: '12 Events', fontSize: 18, fontWeight: 'semibold' }),
          createCell('Text', { content: '5 Notes', fontSize: 18, fontWeight: 'semibold' }),
        ]),
        createRow([createCell('Divider', {})]),
        createRow([
          createCell('Button', {
            label: 'Open Calendar',
            variant: 'primary',
            size: 'md',
            onPress: { type: 'navigate', screen: 'calendar' },
          }),
          createCell('Button', {
            label: 'New Note',
            variant: 'secondary',
            size: 'md',
            onPress: { type: 'send_to_agent', message: 'Create a new note' },
          }),
        ]),
      ],
    },
  },
  {
    id: 'starter-planner',
    name: 'Planner Overview',
    description: 'Calendar-first screen with a quick-add prompt.',
    category: 'planner',
    kind: 'screen',
    screen: {
      rows: [
        createRow([
          createCell('Text', { content: 'My Calendar', fontSize: 24, fontWeight: 'bold' }),
        ]),
        createRow([
          createCell('CalendarModule', { showTimeBlock: true, defaultView: 'month' }),
        ]),
        createRow([
          createCell('InputBar', {
            placeholder: 'Add a quick event...',
            onSend: { type: 'send_to_agent' },
          }),
        ]),
      ],
    },
  },
  {
    id: 'starter-chat',
    name: 'Assistant Chat',
    description: 'Simple AI chat surface with a persistent input bar.',
    category: 'custom',
    kind: 'screen',
    screen: {
      rows: [
        createRow([
          createCell('Text', { content: 'AI Assistant', fontSize: 24, fontWeight: 'bold' }),
        ]),
        createRow([
          createCell('ChatModule', {}),
        ]),
        createRow([
          createCell('InputBar', {
            placeholder: 'Ask Helm anything...',
            onSend: { type: 'send_to_agent' },
          }),
        ]),
      ],
    },
  },
  {
    id: 'starter-notes',
    name: 'Notes Workspace',
    description: 'Notes module with a clear call to create a new note.',
    category: 'custom',
    kind: 'screen',
    screen: {
      rows: [
        createRow([
          createCell('Text', { content: 'My Notes', fontSize: 24, fontWeight: 'bold' }),
        ]),
        createRow([
          createCell('NotesModule', {}),
        ]),
        createRow([
          createCell('Button', {
            label: 'Create New Note',
            variant: 'primary',
            size: 'md',
            onPress: { type: 'send_to_agent', message: 'Create a new note' },
          }),
        ]),
      ],
    },
  },
  {
    id: 'starter-form',
    name: 'Contact Intake',
    description: 'Single-message contact starter using the supported input send flow.',
    category: 'form',
    kind: 'screen',
    screen: {
      rows: [
        createRow([
          createCell('Text', { content: 'Contact Intake', fontSize: 24, fontWeight: 'bold' }),
        ]),
        createRow([
          createCell('Text', { content: 'Share one message and send it directly from the input.', fontSize: 16 }),
        ]),
        createRow([
          createCell('InputBar', {
            placeholder: 'How can we help?',
            onSend: { type: 'send_to_agent' },
          }),
        ]),
      ],
    },
  },
];

export const LOCAL_ROW_TEMPLATES: LocalTemplateDefinition[] = [
  {
    id: 'row-header-cta',
    name: 'Header + CTA',
    description: 'Section title paired with one clear action.',
    category: 'dashboard',
    kind: 'row',
    screen: {
      rows: [
        createRow([
          createCell('Text', { content: 'Section Title', fontSize: 20, fontWeight: 'bold' }, 2),
          createCell('Button', {
            label: 'Take Action',
            variant: 'primary',
            size: 'md',
            onPress: { type: 'send_to_agent', message: 'Help me take the next step' },
          }, 1),
        ]),
      ],
    },
  },
  {
    id: 'row-metrics',
    name: 'Metric Pair',
    description: 'Two side-by-side summary values for dashboards.',
    category: 'tracker',
    kind: 'row',
    screen: {
      rows: [
        createRow([
          createCell('Text', { content: 'Steps: 8,432', fontSize: 18, fontWeight: 'semibold' }),
          createCell('Text', { content: 'Focus: 2 hrs', fontSize: 18, fontWeight: 'semibold' }),
        ]),
      ],
    },
  },
  {
    id: 'row-content-split',
    name: 'Content Split',
    description: 'Markdown copy beside an image block.',
    category: 'custom',
    kind: 'row',
    screen: {
      rows: [
        createRow([
          createCell('Markdown', { content: '## Feature highlight\n\nUse this row for supporting copy.' }, 2),
          createCell('Image', { src: 'https://via.placeholder.com/320x220', height: 220, borderRadius: 16 }, 1),
        ]),
      ],
    },
  },
  {
    id: 'row-quick-actions',
    name: 'Quick Actions',
    description: 'Three compact actions for common next steps.',
    category: 'dashboard',
    kind: 'row',
    screen: {
      rows: [
        createRow([
          createCell('Button', {
            label: 'Schedule',
            variant: 'primary',
            size: 'sm',
            onPress: { type: 'navigate', screen: 'calendar' },
          }),
          createCell('Button', {
            label: 'Draft',
            variant: 'secondary',
            size: 'sm',
            onPress: { type: 'send_to_agent', message: 'Draft a summary for me' },
          }),
          createCell('Button', {
            label: 'Share',
            variant: 'secondary',
            size: 'sm',
            onPress: { type: 'send_to_agent', message: 'Help me share an update' },
          }),
        ]),
      ],
    },
  },
  {
    id: 'row-message-prompt',
    name: 'Message Prompt',
    description: 'Single-row conversational prompt input.',
    category: 'custom',
    kind: 'row',
    screen: {
      rows: [
        createRow([
          createCell('InputBar', {
            placeholder: 'Type a message...',
            onSend: { type: 'send_to_agent' },
          }),
        ]),
      ],
    },
  },
];

let templateCloneCounter = 0;

function nextCloneId(prefix: string): string {
  templateCloneCounter += 1;
  return `${prefix}-${Date.now()}-${templateCloneCounter}`;
}

export function cloneTemplateScreen(screen: EditorScreen): EditorScreen {
  return {
    ...screen,
    rows: screen.rows.map(row => ({
      ...row,
      id: nextCloneId('row'),
      cells: row.cells.map(cell => ({
        ...cell,
        id: nextCloneId('cell'),
        content: cell.content ? cloneEditorComponent(cell.content) : null,
      })),
    })),
  };
}