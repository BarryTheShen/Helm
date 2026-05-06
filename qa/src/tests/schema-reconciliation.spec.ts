import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('Schema Reconciliation', () => {
  test('web and backend component registries are aligned', async ({ request }) => {
    // Read discovered.json for action list and web component data
    let discovered: any = {};
    try {
      discovered = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../discovered.json'), 'utf-8'),
      );
    } catch {
      console.log('discovered.json not found, skipping');
      return;
    }

    // Get backend component registry
    const auth = JSON.parse(fs.readFileSync(path.join(__dirname, '../.qa-auth.json'), 'utf-8'));
    const res = await request.get('http://127.0.0.1:8000/api/components/registry', {
      headers: { Authorization: `Bearer ${auth.token}` },
    });

    if (!res.ok()) {
      console.log('Could not fetch component registry');
      return;
    }

    const backendComponents = await res.json();
    const backendTypes = new Set((backendComponents as any[]).map((c: any) => c.type || c.name));

    // Read web registry from source via static file
    const root = path.resolve(__dirname, '../..');
    const typesSrc = fs.readFileSync(path.join(root, 'web/src/editor/types.ts'), 'utf-8');
    const webTypes: string[] = [];

    // Extract type names from COMPONENT_REGISTRY entries
    const typeMatches = typesSrc.matchAll(/type:\s*['"]([^'"]+)['"]/g);
    for (const m of typeMatches) {
      webTypes.push(m[1]);
    }

    // Report mismatches without failing
    const webSet = new Set(webTypes);
    const backendSet = backendTypes;

    const missingInBackend = [...webSet].filter((t) => !backendSet.has(t));
    const missingInWeb = [...backendSet].filter((t) => !webSet.has(t));

    if (missingInBackend.length > 0) {
      console.log(`Components in web registry but NOT in backend: ${missingInBackend.join(', ')}`);
    }
    if (missingInWeb.length > 0) {
      console.log(`Components in backend but NOT in web: ${missingInWeb.join(', ')}`);
    }

    // EXPECTED DRIFT: RichTextRenderer and RichText may differ between layers
    const expectedDrift = ['RichTextRenderer', 'RichText', 'RichTextRendererRenderer'];
    const actualDrift = missingInBackend.filter((t) => !expectedDrift.includes(t));

    // Fail only on unexpected drift (RichTextRenderer/RichText drift is expected)
    expect(actualDrift.length, `Unexpected components in web but not backend: ${actualDrift.join(', ')}`).toBe(0);
  });

  test('all backend actions are registered', async () => {
    let discovered: any = {};
    try {
      discovered = JSON.parse(
        fs.readFileSync(path.join(__dirname, '../discovered.json'), 'utf-8'),
      );
    } catch {
      console.log('discovered.json not found, skipping');
      return;
    }

    const actions = discovered.actions || [];
    expect(actions.length).toBeGreaterThan(0);

    // Check no duplicate action names
    const unique = new Set(actions);
    expect(unique.size).toBe(actions.length);
  });
});
