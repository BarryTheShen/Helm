import { test, expect } from '@playwright/test';
import fs from 'fs';
import { qaPath } from '../utils';

test.describe('Template Quality', () => {
  test('all templates have valid component types and actions', async ({ request }) => {
    const discovered = JSON.parse(fs.readFileSync(qaPath('src/discovered.json'), 'utf-8'));

    const templates = (discovered.templates?.items) || (discovered.templates) || [];
    const templateList = Array.isArray(templates) ? templates : [];
    if (templateList.length === 0) {
      console.log('No templates discovered, skipping');
      return;
    }

    const actions = new Set(discovered.actions || []);
    const components = new Set((discovered.components || []).map((c: any) => c.type || c.name));

    const invalidComponents: string[] = [];
    const invalidActions: string[] = [];

    for (const tmpl of templateList) {
      const screen = tmpl.screen;
      if (!screen) continue;

      const rows = screen.rows || [];
      for (const row of rows) {
        for (const cell of (row.cells || [])) {
          const content = cell.content;
          if (!content) continue;

          // Check component type exists
          const compType = content.type;
          if (compType && !components.has(compType)) {
            invalidComponents.push(`${tmpl.name}: "${compType}"`);
          }

          // Check action references are valid
          const props = content.props || {};
          for (const key of Object.keys(props)) {
            const val = props[key];
            if (val && typeof val === 'object' && val.type === 'server_action') {
              const func = val.function;
              if (func && !actions.has(func)) {
                invalidActions.push(`${tmpl.name}: "${func}"`);
              }
            }
          }
        }
      }
    }

    expect(invalidComponents.length, `Invalid component types: ${invalidComponents.join(', ')}`).toBe(0);
    expect(invalidActions.length, `Invalid actions: ${invalidActions.join(', ')}`).toBe(0);
  });
});
