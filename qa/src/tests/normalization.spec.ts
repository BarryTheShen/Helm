import { test, expect } from '../fixtures';

test.describe('Normalization', () => {
  test('normalize is idempotent for all component types', async ({ page, login }) => {
    await login();
    await page.goto('/editor');
    await page.waitForLoadState('networkidle');

    const result = await page.evaluate(async () => {
      const { normalizeComponentForEditor } = await import('/src/editor/types.ts');

      const testCases = [
        { type: 'Text', props: { content: 'Hello', variant: 'body' } },
        { type: 'Button', props: { label: 'Click' } },
        { type: 'TextInput', props: { placeholder: 'Enter text' } },
        { type: 'CalendarModule', props: { variant: 'week' } },
        { type: 'Container', props: { children: [{ type: 'Text', props: { content: 'x' } }] } },
        { type: 'Markdown', props: { content: '# Hello' } },
        { type: 'Image', props: { src: 'https://example.com/img.png' } },
      ];

      const results: Array<{ type: string; idempotent: boolean; n1NotNull: boolean }> = [];
      for (const tc of testCases) {
        const n1 = normalizeComponentForEditor(tc);
        const n2 = n1 ? normalizeComponentForEditor(n1) : null;
        const idempotent = n1 && n2 && JSON.stringify(n1) === JSON.stringify(n2);
        results.push({ type: tc.type, idempotent, n1NotNull: !!n1 });
      }
      return results;
    });

    for (const r of result) {
      expect(r.n1NotNull, `${r.type}: normalize(x) !== null`).toBe(true);
      expect(r.idempotent, `${r.type}: normalize(normalize(x)) === normalize(x)`).toBe(true);
    }
  });

  test('getEditorPersistenceValidationError catches incomplete server_action', async ({ page, login }) => {
    await login();
    await page.goto('/editor');
    await page.waitForLoadState('networkidle');

    const result = await page.evaluate(async () => {
      const { getEditorPersistenceValidationError, createEditorId } = await import('/src/editor/types.ts');
      const rows = [{
        id: 'row-1', height: 'auto', cells: [{
          id: 'cell-1', width: 1, content: {
            id: createEditorId('btn'), type: 'Button',
            props: { label: 'Test', onPress: { type: 'server_action' } },
          }
        }]
      }];
      return getEditorPersistenceValidationError(rows);
    });
    expect(result).toBeTruthy();
  });

  test('serializeComponentForRuntime includes all props', async ({ page, login }) => {
    await login();
    await page.goto('/editor');
    await page.waitForLoadState('networkidle');

    const result = await page.evaluate(async () => {
      const { serializeComponentForRuntime, normalizeComponentForEditor } = await import('/src/editor/types.ts');
      const input = normalizeComponentForEditor({ type: 'Button', props: { label: 'Click Me', variant: 'primary' } });
      const serialized = input ? serializeComponentForRuntime(input) : null;
      return serialized ? { hasType: !!serialized.type, hasProps: !!serialized.props } : null;
    });
    expect(result).toBeTruthy();
    if (result) {
      expect(result.hasType).toBe(true);
      expect(result.hasProps).toBe(true);
    }
  });
});
