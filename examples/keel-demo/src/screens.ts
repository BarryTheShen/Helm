/**
 * Demo SDUI screens — showcases every built-in Keel component.
 *
 * These are plain JSON objects typed as SDUIPage. In production,
 * they'd come from your backend or an AI agent over WebSocket.
 */
import type { SDUIPage } from '@keel/protocol';

/** Home screen — demonstrates all atomic + structural components */
export const homeScreen: SDUIPage = {
  schema_version: '1.0.0',
  module_id: 'demo-home',
  title: 'Keel Demo',
  rows: [
    // ── Heading ────────────────────────────────────────────────────────
    {
      id: 'header',
      cells: [
        {
          id: 'header-cell',
          width: 1,
          content: {
            type: 'Text',
            id: 'title',
            props: {
              content: 'Welcome to Keel',
              variant: 'heading',
              bold: true,
              align: 'center',
            },
          },
        },
      ],
      padding: 16,
    },

    // ── Markdown ───────────────────────────────────────────────────────
    {
      id: 'intro',
      cells: [
        {
          id: 'intro-cell',
          width: 1,
          content: {
            type: 'Markdown',
            id: 'intro-md',
            props: {
              content:
                '**Keel** is an open-source AI-UI framework.\n\n' +
                'This demo renders *every* built-in component from a JSON payload.',
            },
          },
        },
      ],
      padding: 16,
    },

    // ── Divider ────────────────────────────────────────────────────────
    {
      id: 'div-1',
      cells: [
        {
          id: 'div-1-cell',
          content: { type: 'Divider', id: 'divider-1', props: { direction: 'horizontal' } },
        },
      ],
    },

    // ── Icon row ───────────────────────────────────────────────────────
    {
      id: 'icons',
      cells: [
        {
          id: 'icon-star',
          width: 0.33,
          content: { type: 'Icon', id: 'ic-star', props: { name: 'star', size: 32, color: '#FFD700' } },
        },
        {
          id: 'icon-heart',
          width: 0.33,
          content: { type: 'Icon', id: 'ic-heart', props: { name: 'heart', size: 32, color: '#FF4444' } },
        },
        {
          id: 'icon-check',
          width: 0.33,
          content: { type: 'Icon', id: 'ic-check', props: { name: 'check', size: 32, color: '#44CC44' } },
        },
      ],
      gap: 8,
      padding: 16,
    },

    // ── Image ──────────────────────────────────────────────────────────
    {
      id: 'image-row',
      cells: [
        {
          id: 'image-cell',
          width: 1,
          content: {
            type: 'Image',
            id: 'hero-img',
            props: {
              src: 'https://picsum.photos/600/300',
              alt: 'Demo hero image',
              aspectRatio: 2,
              borderRadius: 12,
            },
          },
        },
      ],
      padding: 16,
    },

    // ── Container with nested components ───────────────────────────────
    {
      id: 'card-row',
      cells: [
        {
          id: 'card-cell',
          width: 1,
          content: {
            type: 'Container',
            id: 'info-card',
            props: {
              direction: 'column',
              gap: 8,
              padding: 16,
              backgroundColor: 'surface',
              borderRadius: 12,
              shadow: 'md',
            },
            children: [
              {
                type: 'Text',
                id: 'card-title',
                props: { content: 'Nested Container', variant: 'heading', bold: true },
              },
              {
                type: 'Text',
                id: 'card-body',
                props: {
                  content: 'This card is a Container with nested Text and Button children.',
                  variant: 'body',
                },
              },
              {
                type: 'Button',
                id: 'card-btn',
                props: {
                  label: 'Learn More',
                  variant: 'secondary',
                  onPress: { type: 'open_url', url: 'https://github.com/BarryTheShen/Helm' },
                },
              },
            ],
          },
        },
      ],
      padding: 16,
    },

    // ── Buttons row ────────────────────────────────────────────────────
    {
      id: 'buttons',
      cells: [
        {
          id: 'btn-primary-cell',
          width: 0.5,
          content: {
            type: 'Button',
            id: 'btn-primary',
            props: {
              label: 'Copy Text',
              variant: 'primary',
              onPress: { type: 'copy_text', text: 'Hello from Keel!' },
            },
          },
        },
        {
          id: 'btn-ghost-cell',
          width: 0.5,
          content: {
            type: 'Button',
            id: 'btn-ghost',
            props: {
              label: 'Go Back',
              variant: 'ghost',
              icon: 'arrow-left',
              onPress: { type: 'go_back' },
            },
          },
        },
      ],
      gap: 12,
      padding: 16,
    },

    // ── TextInput ──────────────────────────────────────────────────────
    {
      id: 'input-row',
      cells: [
        {
          id: 'input-cell',
          width: 1,
          content: {
            type: 'TextInput',
            id: 'user-input',
            props: {
              placeholder: 'Type something here...',
              multiline: false,
            },
          },
        },
      ],
      padding: 16,
    },

    // ── Custom Component (WeatherWidget) ──────────────────────────────
    {
      id: 'weather-row',
      cells: [
        {
          id: 'weather-cell',
          width: 1,
          content: {
            type: 'WeatherWidget',
            id: 'weather-1',
            props: {
              city: 'San Francisco',
              temperature: 68,
              unit: 'F',
              condition: 'Sunny',
            },
          },
        },
      ],
      padding: 16,
    },

    // ── Responsive row (stacks on phone, side-by-side on tablet) ──────
    {
      id: 'responsive-row',
      cells: [
        {
          id: 'resp-cell-1',
          width: 0.5,
          content: {
            type: 'Text',
            id: 'resp-text-1',
            props: { content: 'Left on tablet', variant: 'body', align: 'center' },
          },
        },
        {
          id: 'resp-cell-2',
          width: 0.5,
          content: {
            type: 'Text',
            id: 'resp-text-2',
            props: { content: 'Right on tablet', variant: 'body', align: 'center' },
          },
        },
      ],
      compact: { stack: true },
      regular: { direction: 'row' },
      gap: 12,
      padding: 16,
      backgroundColor: '#F0F4F8',
    },

    // ── InputBar (chat-style) ─────────────────────────────────────────
    {
      id: 'inputbar-row',
      cells: [
        {
          id: 'inputbar-cell',
          width: 1,
          content: {
            type: 'InputBar',
            id: 'chat-input',
            props: {
              placeholder: 'Ask the AI anything...',
              onSend: { type: 'send_to_agent', message: '' },
            },
          },
        },
      ],
    },
  ],
};

/** Calendar screen — demonstrates the CalendarModule composite */
export const calendarScreen: SDUIPage = {
  schema_version: '1.0.0',
  module_id: 'demo-calendar',
  title: 'Calendar Demo',
  rows: [
    {
      id: 'cal-row',
      cells: [
        {
          id: 'cal-cell',
          width: 1,
          content: {
            type: 'CalendarModule',
            id: 'demo-cal',
            props: {
              defaultView: 'month',
              events: [
                {
                  id: 'e1',
                  title: 'Team Standup',
                  start: '2026-04-12T09:00:00',
                  end: '2026-04-12T09:30:00',
                  color: '#007AFF',
                },
                {
                  id: 'e2',
                  title: 'Keel Demo Review',
                  start: '2026-04-12T14:00:00',
                  end: '2026-04-12T15:00:00',
                  color: '#34C759',
                },
                {
                  id: 'e3',
                  title: 'Lunch',
                  start: '2026-04-12T12:00:00',
                  end: '2026-04-12T13:00:00',
                  color: '#FF9500',
                },
              ],
            },
          },
        },
      ],
    },
  ],
};
