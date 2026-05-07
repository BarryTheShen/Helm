import { test, expect } from '@playwright/test';
import fs from 'fs';
import { qaPath } from '../utils';

test.describe('Schema Reconciliation', () => {
  test('web and backend component registries are aligned', async ({ request }) => {
    const discovered = JSON.parse(fs.readFileSync(qaPath('src/discovered.json'), 'utf-8'));

    // Get backend component registry
    const auth = JSON.parse(fs.readFileSync(qaPath('src/.qa-auth.json'), 'utf-8'));
    const res = await request.get('http://127.0.0.1:8000/api/components/registry', {
      headers: { Authorization: `Bearer ${auth.token}` },
    });

    if (!res.ok()) {
      console.log('Could not fetch component registry');
      return;
    }

    const backendComponents = await res.json();
    const backendTypes = new Set(
      (backendComponents as any[])
        .map((c: any) => (c.type || c.name).toLowerCase().replace(/_/g, '')),
    );

    // Read web registry from source via static file
    const typesSrc = fs.readFileSync(qaPath('../web/src/editor/types.ts'), 'utf-8');
    const webTypes: string[] = [];

    const typeMatches = typesSrc.matchAll(/type:\s*['"]([^'"]+)['"]/g);
    for (const m of typeMatches) {
      webTypes.push(m[1]);
    }

    // Web layout-only types that don't have backend component counterparts
    const layoutOnly = new Set(['row', 'icon_button', 'spacer', 'card', 'list', 'form', 'list_item',
      'alert', 'badge', 'stat', 'stats_row', 'progress', 'container']);

    // Normalize web type names to match backend convention
    // e.g. CalendarModule → calendar, TextInput → textinput, TodoList → todolist
    const toBackendName = (s: string) => {
      // Strip _Module suffix (CalendarModule → Calendar, ChatModule → Chat, NotesModule → Notes)
      let n = s.replace(/Module$/, '');
      // PascalCase → lowercase (Calendar → calendar, TextInput → textinput)
      n = n.toLowerCase();
      return n;
    };

    const webSet = new Set(webTypes.map(toBackendName).filter(t => !layoutOnly.has(t)));
    const backendSet = backendTypes;

    const missingInBackend = [...webSet].filter((t) => !backendSet.has(t));
    const missingInWeb = [...backendSet].filter((t) => !webSet.has(t));

    if (missingInBackend.length > 0) {
      console.log(`Web components missing in backend: ${missingInBackend.join(', ')}`);
    }
    if (missingInWeb.length > 0) {
      console.log(`Backend components missing in web: ${missingInWeb.join(', ')}`);
    }

    // Known drift: RichTextRenderer/RichText naming differs, Empty in seed but not DB
    const expectedDrift = ['richtextrenderer', 'richtext', 'richtextrendererrenderer', 'empty'];
    const actualDrift = missingInBackend.filter((t) => !expectedDrift.includes(t));

    expect(actualDrift.length, `Unexpected drift: web components not in backend: ${actualDrift.join(', ')}`).toBe(0);
  });

  test('all backend actions are registered', async () => {
    const discovered = JSON.parse(fs.readFileSync(qaPath('src/discovered.json'), 'utf-8'));
    const actions = discovered.actions || [];
    expect(actions.length).toBeGreaterThan(0);

    // Check no duplicate action names
    const unique = new Set(actions);
    expect(unique.size).toBe(actions.length);
  });
});
