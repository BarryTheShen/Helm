/**
 * Keel Demo — Integration tests.
 *
 * Validates that the demo screens, custom components, and action dispatcher
 * all work correctly with the Keel framework packages.
 */
import { sduiPageSchema } from '@keel/protocol';
import { resolveComponent, getRegisteredTypes } from '@keel/renderer';
import { homeScreen, calendarScreen } from '../screens';
import { handleAction, actionLog, clearActionLog } from '../actionDispatcher';

// Register the custom WeatherWidget
import '../WeatherWidget';

// ── Screen Validation ──────────────────────────────────────────────────────

describe('Demo screens validate against sduiPageSchema', () => {
  it('homeScreen passes schema validation', () => {
    const result = sduiPageSchema.safeParse(homeScreen);
    expect(result.success).toBe(true);
  });

  it('calendarScreen passes schema validation', () => {
    const result = sduiPageSchema.safeParse(calendarScreen);
    expect(result.success).toBe(true);
  });

  it('homeScreen has correct module_id', () => {
    expect(homeScreen.module_id).toBe('demo-home');
  });

  it('calendarScreen has correct module_id', () => {
    expect(calendarScreen.module_id).toBe('demo-calendar');
  });

  it('homeScreen has expected number of rows', () => {
    // header, intro, divider, icons, image, card, buttons, input, weather, responsive, inputbar
    expect(homeScreen.rows.length).toBe(11);
  });

  it('all homeScreen components have unique IDs', () => {
    const ids = new Set<string>();
    for (const row of homeScreen.rows) {
      for (const cell of row.cells) {
        expect(ids.has(cell.content.id)).toBe(false);
        ids.add(cell.content.id);
      }
    }
  });
});

// ── Component Types ────────────────────────────────────────────────────────

describe('All component types used in demo are registered', () => {
  it('every component type in homeScreen is resolvable', () => {
    const registeredTypes = getRegisteredTypes();
    for (const row of homeScreen.rows) {
      for (const cell of row.cells) {
        expect(registeredTypes).toContain(cell.content.type);
      }
    }
  });

  it('CalendarModule is resolvable for calendarScreen', () => {
    expect(resolveComponent('CalendarModule')).not.toBeNull();
  });
});

// ── Custom Component Registration ──────────────────────────────────────────

describe('WeatherWidget custom component', () => {
  it('is registered in the component registry', () => {
    expect(resolveComponent('WeatherWidget')).not.toBeNull();
  });

  it('appears in getRegisteredTypes()', () => {
    expect(getRegisteredTypes()).toContain('WeatherWidget');
  });

  it('is used in the homeScreen', () => {
    const weatherRow = homeScreen.rows.find((r) =>
      r.cells.some((c) => c.content.type === 'WeatherWidget')
    );
    expect(weatherRow).toBeDefined();
  });
});

// ── Action Dispatcher ──────────────────────────────────────────────────────

describe('Action dispatcher', () => {
  beforeEach(() => {
    clearActionLog();
  });

  it('handles navigate action', () => {
    handleAction({ type: 'navigate', screen: 'settings', params: { tab: 'general' } });
    expect(actionLog).toHaveLength(1);
    expect(actionLog[0]).toEqual({ type: 'navigate', screen: 'settings', params: { tab: 'general' } });
  });

  it('handles go_back action', () => {
    handleAction({ type: 'go_back' });
    expect(actionLog[0].type).toBe('go_back');
  });

  it('handles open_url action', () => {
    handleAction({ type: 'open_url', url: 'https://example.com' });
    expect(actionLog[0]).toEqual({ type: 'open_url', url: 'https://example.com' });
  });

  it('handles copy_text action', () => {
    handleAction({ type: 'copy_text', text: 'Hello!' });
    expect(actionLog[0]).toEqual({ type: 'copy_text', text: 'Hello!' });
  });

  it('handles send_to_agent action', () => {
    handleAction({ type: 'send_to_agent', message: 'What is Keel?' });
    expect(actionLog[0]).toEqual({ type: 'send_to_agent', message: 'What is Keel?' });
  });

  it('handles server_action action', () => {
    handleAction({ type: 'server_action', function: 'greet', params: { name: 'World' } });
    expect(actionLog[0]).toEqual({
      type: 'server_action',
      function: 'greet',
      params: { name: 'World' },
    });
  });

  it('handles dismiss action', () => {
    handleAction({ type: 'dismiss' });
    expect(actionLog[0].type).toBe('dismiss');
  });

  it('handles api_call action', () => {
    handleAction({ type: 'api_call', method: 'POST', path: '/api/data', body: { key: 'val' } });
    expect(actionLog[0]).toEqual({
      type: 'api_call',
      method: 'POST',
      path: '/api/data',
      body: { key: 'val' },
    });
  });

  it('logs multiple actions in order', () => {
    handleAction({ type: 'go_back' });
    handleAction({ type: 'dismiss' });
    handleAction({ type: 'go_back' });
    expect(actionLog).toHaveLength(3);
    expect(actionLog[1].type).toBe('dismiss');
  });

  it('clearActionLog resets the log', () => {
    handleAction({ type: 'go_back' });
    expect(actionLog).toHaveLength(1);
    clearActionLog();
    expect(actionLog).toHaveLength(0);
  });
});
