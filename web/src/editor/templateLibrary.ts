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
  // ── Personal Dashboard ─────────────────────────────────────────────────
  // Phase 6.1: Weather + Compact Calendar in 50/50 row
  {
    id: 'starter-dashboard',
    name: 'Personal Dashboard',
    description: 'Weather overview with compact calendar, todos, and quick actions.',
    category: 'dashboard',
    kind: 'screen',
    screen: {
      rows: [
        // Row 1: Greeting
        createRow([
          createCell('Text', { content: '# Good morning, {{user.name}} 👋', variant: 'heading', fontSize: 24 }),
        ]),
        // Row 2: Weather (50%) + Compact Calendar (50%)
        createRow([
          createCell('Text', { content: '☀️ 24°C  •  Shanghai', fontSize: 18, fontWeight: 'semibold' }),
          createCell('CalendarModule', { variant: 'compact', maxEvents: 3 }),
        ]),
        // Row 3: Todo list with real data binding
        createRow([
          createCell('Todo', {
            dataBinding: { dataSourceId: 'todos', refreshInterval: 60000 },
            placeholder: 'Add a task...',
          }),
        ]),
        // Row 4: Two action buttons
        createRow([
          createCell('Button', {
            label: '+ New Task',
            variant: 'primary',
            size: 'md',
            onPress: {
              type: 'server_action',
              function: 'todos.create',
              params: { title: 'New task' },
            },
          }),
          createCell('Button', {
            label: '+ New Note',
            variant: 'secondary',
            size: 'md',
            onPress: {
              type: 'server_action',
              function: 'notes.create',
              params: { content: '' },
            },
          }),
        ]),
      ],
    },
  },
  // ── Daily Planner ──────────────────────────────────────────────────────
  // Phase 6.1: Container (vertical row) → Calendar (Week) | Todo | Notes
  {
    id: 'starter-planner',
    name: 'Daily Planner',
    description: 'Calendar week view with todo list and notes stacked in a vertical layout.',
    category: 'planner',
    kind: 'screen',
    screen: {
      rows: [
        // Row 1: Header with dynamic date
        createRow([
          createCell('Text', { content: '# 📋 {{date.today}}', variant: 'heading', align: 'center' }),
        ]),
        // Row 2: Vertical container stacking Calendar (Week) | Todo | Notes
        createRow([
          {
            id: nextSeedId('tpl-cell'),
            width: 1,
            content: {
              id: createEditorId('tpl-component'),
              type: 'Empty',
              props: {},
              children: [
                {
                  id: createEditorId('tpl-component'),
                  type: 'CalendarModule',
                  props: {
                    variant: 'week',
                    dataBinding: { dataSourceId: 'calendar_events', refreshInterval: 60000 },
                  },
                },
                {
                  id: createEditorId('tpl-component'),
                  type: 'Todo',
                  props: {
                    dataBinding: { dataSourceId: 'todos', refreshInterval: 60000 },
                    placeholder: 'Add a task...',
                  },
                },
                {
                  id: createEditorId('tpl-component'),
                  type: 'NotesModule',
                  props: {
                    filterDate: '{{date.today}}',
                    dataBinding: { dataSourceId: 'notes', refreshInterval: 60000 },
                  },
                },
              ],
            },
          },
        ]),
      ],
    },
  },
  // ── Home Module ────────────────────────────────────────────────────────
  // Phase 6.1: InputBar + Todo + Article Cards
  {
    id: 'starter-home',
    name: 'Home Module',
    description: 'Input bar with todo list and article cards for a productivity-focused home screen.',
    category: 'dashboard',
    kind: 'screen',
    screen: {
      rows: [
        // Row 1: Header
        createRow([
          createCell('Text', { content: '# Home', variant: 'heading' }),
        ]),
        // Row 2: Input bar + Todo side by side in an Empty container (vertical)
        createRow([
          {
            id: nextSeedId('tpl-cell'),
            width: 1,
            content: {
              id: createEditorId('tpl-component'),
              type: 'Empty',
              props: {},
              children: [
                {
                  id: createEditorId('tpl-component'),
                  type: 'InputBar',
                  props: {
                    placeholder: 'Add a task or note...',
                    onSend: { type: 'send_to_agent' },
                  },
                },
                {
                  id: createEditorId('tpl-component'),
                  type: 'Todo',
                  props: {
                    dataBinding: { dataSourceId: 'todos', refreshInterval: 30000 },
                    placeholder: 'What needs to be done?',
                  },
                },
              ],
            },
          },
        ]),
        // Row 3: Article card
        createRow([
          createCell('ArticleCard', {
            title: 'Welcome to Your Feed',
            description: 'Your articles and updates will appear here. Start by adding content sources.',
            source: 'Helm',
            publishedAt: '{{date.today}}T00:00:00Z',
          }),
        ]),
      ],
    },
  },
  // ── Calendar Focus ─────────────────────────────────────────────────────
  // Phase 6.1: Full calendar module (Month variant)
  {
    id: 'starter-calendar',
    name: 'Calendar Focus',
    description: 'Full month calendar view with events.',
    category: 'planner',
    kind: 'screen',
    screen: {
      rows: [
        createRow([
          createCell('Text', { content: '# My Calendar', variant: 'heading' }),
        ]),
        createRow([
          createCell('CalendarModule', {
            variant: 'month',
            dataBinding: { dataSourceId: 'calendar_events', refreshInterval: 60000 },
          }),
        ]),
      ],
    },
  },
  // ── Assistant Chat ─────────────────────────────────────────────────────
  {
    id: 'starter-chat',
    name: 'Assistant Chat',
    description: 'Simple AI chat surface with a persistent input bar.',
    category: 'custom',
    kind: 'screen',
    screen: {
      rows: [
        createRow([
          createCell('Text', { content: '# AI Assistant', variant: 'heading' }),
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
  // ── Notes Workspace ────────────────────────────────────────────────────
  {
    id: 'starter-notes',
    name: 'Notes Workspace',
    description: 'Notes module with a clear call to create a new note.',
    category: 'custom',
    kind: 'screen',
    screen: {
      rows: [
        createRow([
          createCell('Text', { content: '# My Notes', variant: 'heading' }),
        ]),
        createRow([
          createCell('NotesModule', {
            dataBinding: { dataSourceId: 'notes', refreshInterval: 60000 },
          }),
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
  // ── Contact Intake ─────────────────────────────────────────────────────
  {
    id: 'starter-form',
    name: 'Contact Intake',
    description: 'Single-message contact starter using the supported input send flow.',
    category: 'form',
    kind: 'screen',
    screen: {
      rows: [
        createRow([
          createCell('Text', { content: '# Contact Intake', variant: 'heading' }),
        ]),
        createRow([
          createCell('Text', { content: 'Share one message and send it directly from the input.', variant: 'body' }),
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
    description: 'Text copy beside an image block.',
    category: 'custom',
    kind: 'row',
    screen: {
      rows: [
        createRow([
          createCell('Text', { content: '## Feature highlight\n\nUse this row for supporting copy.' }, 2),
          createCell('Image', { src: 'https://via.placeholder.com/320x200', fitMode: 'fitWidth' }, 1),
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