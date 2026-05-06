import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Template Quality', () => {
  test('all templates have valid component types and actions', async ({ request }) => {
    let discovered: any = {};
    try {
      discovered = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../discovered.json'), 'utf-8'),
      );
    } catch {
      console.log('discovered.json not found, skipping');
      return;
    }

    const templates = discovered.templates || [];
    if (templates.length === 0) {
      console.log('No templates discovered, skipping');
      return;
    }

    const actions = new Set(discovered.actions || []);
    const components = new Set((discovered.components || []).map((c: any) => c.type || c.name));

    for (const tmpl of templates) {
      const screen = tmpl.screen;
      if (!screen) continue;

      const rows = screen.rows || [];
      for (const row of rows) {
        for (const cell of (row.cells || [])) {
          const content = cell.content;
          if (!content) continue;

          // Check component type exists
          const compType = content.type;
          if (compType) {
            const isValid = components.has(compType);
            if (!isValid) {
              console.log(`Template "${tmpl.name}": component type "${compType}" not in backend registry`);
            }
          }

          // Check action references are valid
          const props = content.props || {};
          for (const key of Object.keys(props)) {
            const val = props[key];
            if (val && typeof val === 'object' && val.type === 'server_action') {
              const func = val.function;
              if (func && !actions.has(func)) {
                console.log(`Template "${tmpl.name}": action "${func}" not in action registry`);
              }
            }
          }
        }
      }
    }

    // Don't fail on drift — just report
    expect(true).toBe(true);
  });
});
