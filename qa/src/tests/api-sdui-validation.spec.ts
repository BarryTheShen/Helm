import { test, expect } from '@playwright/test';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://127.0.0.1:8000';
const AUTH_FILE = path.resolve(__dirname, '..', '.qa-auth.json');

/**
 * Helper: build the standard headers with auth token.
 */
function authHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

test.describe('SDUI validation via template create', () => {
  let token: string;
  const createdIds: string[] = [];

  test.beforeAll(() => {
    const auth = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
    token = auth.token;
    expect(token).toBeTruthy();
  });

  test.afterEach(async ({ request }) => {
    for (const id of createdIds) {
      try {
        await request.delete(`${BASE_URL}/api/templates/${id}`, {
          headers: authHeaders(token),
        });
      } catch {
        // best-effort cleanup
      }
    }
    createdIds.length = 0;
  });

  // ── Validation failure tests ──────────────────────────────────────────

  test('template create rejects rows without cells', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/templates`, {
      headers: authHeaders(token),
      data: {
        name: 'test-no-cells',
        category: 'custom',
        screen_json: {
          rows: [{ id: 'r1' }],
        },
      },
    });
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.detail).toContain("missing 'cells'");
  });

  test('template create rejects cells without content', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/templates`, {
      headers: authHeaders(token),
      data: {
        name: 'test-no-content',
        category: 'custom',
        screen_json: {
          rows: [{ id: 'r1', cells: [{ id: 'c1' }] }],
        },
      },
    });
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.detail).toContain("missing 'content'");
  });

  test('template create rejects invalid component types', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/templates`, {
      headers: authHeaders(token),
      data: {
        name: 'test-bad-type',
        category: 'custom',
        screen_json: {
          rows: [
            {
              id: 'r1',
              cells: [
                {
                  id: 'c1',
                  content: { type: 'NonExistentWidget', props: {} },
                },
              ],
            },
          ],
        },
      },
    });
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.detail).toContain('Unknown component type');
    expect(body.detail).toContain('NonExistentWidget');
  });

  test('template create rejects rows without id', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/templates`, {
      headers: authHeaders(token),
      data: {
        name: 'test-row-no-id',
        category: 'custom',
        screen_json: {
          rows: [
            {
              cells: [{ id: 'c1', content: { type: 'Text', props: {} } }],
            },
          ],
        },
      },
    });
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.detail).toContain("missing 'id'");
  });

  test('template create rejects cells without id', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/templates`, {
      headers: authHeaders(token),
      data: {
        name: 'test-cell-no-id',
        category: 'custom',
        screen_json: {
          rows: [
            {
              id: 'r1',
              cells: [{ content: { type: 'Text', props: {} } }],
            },
          ],
        },
      },
    });
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.detail).toContain("missing 'id'");
  });

  // ── Valid payload tests ───────────────────────────────────────────────

  test('template create accepts valid V2 payload', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/templates`, {
      headers: authHeaders(token),
      data: {
        name: 'test-valid-v2',
        category: 'custom',
        screen_json: {
          rows: [
            {
              id: 'r1',
              cells: [
                { id: 'c1', content: { type: 'Text', props: { content: 'Hello' } } },
              ],
            },
          ],
        },
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(body.screen_json).toBeTruthy();
    createdIds.push(body.id);
  });

  test('template create accepts Container with valid children', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/templates`, {
      headers: authHeaders(token),
      data: {
        name: 'test-container-valid',
        category: 'custom',
        screen_json: {
          rows: [
            {
              id: 'r1',
              cells: [
                {
                  id: 'c1',
                  content: {
                    type: 'Container',
                    props: {},
                    children: [
                      { id: 'child1', type: 'Text', props: { content: 'Child A' } },
                      { id: 'child2', type: 'Button', props: { label: 'Click' } },
                    ],
                  },
                },
              ],
            },
          ],
        },
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    createdIds.push(body.id);
  });

  test('template create rejects Container with invalid child type', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/templates`, {
      headers: authHeaders(token),
      data: {
        name: 'test-container-bad-child',
        category: 'custom',
        screen_json: {
          rows: [
            {
              id: 'r1',
              cells: [
                {
                  id: 'c1',
                  content: {
                    type: 'Container',
                    props: {},
                    children: [
                      { id: 'child1', type: 'FakeComponent', props: {} },
                    ],
                  },
                },
              ],
            },
          ],
        },
      },
    });
    expect(res.status()).toBe(422);
    const body = await res.json();
    expect(body.detail).toContain('Unknown child component type');
    expect(body.detail).toContain('FakeComponent');
  });
});
