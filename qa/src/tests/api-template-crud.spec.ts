import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = 'http://127.0.0.1:8000';
const AUTH_FILE = path.join(__dirname, '..', '.qa-auth.json');

test.describe('Template CRUD', () => {
  let token: string;
  const createdIds: string[] = [];

  test.beforeAll(() => {
    const auth = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
    token = auth.token;
  });

  test.afterEach(async ({ request }) => {
    for (const id of createdIds) {
      try {
        await request.delete(`${BASE_URL}/api/templates/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // ignore cleanup failures
      }
    }
    createdIds.length = 0;
  });

  /** Minimal valid SDUI screen payload (row-first, empty). */
  const minimalScreenJson = { rows: [] };

  /** Minimal invalid SDUI screen payload — neither rows nor sections. */
  const invalidScreenJson = { foo: 'bar' };

  function authHeaders(): Record<string, string> {
    return { Authorization: `Bearer ${token}` };
  }

  async function createTemplate(
    request: import('@playwright/test').APIRequestContext,
    overrides: Record<string, unknown> = {},
  ) {
    const data = {
      name: `QA Template CRUD ${Date.now()}`,
      category: 'form',
      screen_json: minimalScreenJson,
      ...overrides,
    };
    return request.post(`${BASE_URL}/api/templates`, {
      headers: authHeaders(),
      data,
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Creation
  // ─────────────────────────────────────────────────────────────────────────

  test('create template with valid minimal data', async ({ request }) => {
    const name = `QA Minimal ${Date.now()}`;
    const res = await request.post(`${BASE_URL}/api/templates`, {
      headers: authHeaders(),
      data: {
        name,
        category: 'form',
        screen_json: minimalScreenJson,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(body.name).toBe(name);
    expect(body.category).toBe('form');
    expect(body.screen_json).toHaveProperty('rows');
    createdIds.push(body.id);
  });

  test('create template requires name', async ({ request }) => {
    const res = await request.post(`${BASE_URL}/api/templates`, {
      headers: authHeaders(),
      data: {
        category: 'form',
        screen_json: minimalScreenJson,
      },
    });
    expect(res.status()).toBe(422);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Read / list
  // ─────────────────────────────────────────────────────────────────────────

  test('list templates does not return screen_json', async ({ request }) => {
    // Create a template with known screen_json
    const createRes = await createTemplate(request, {
      screen_json: { rows: [], secret_field: 'should-not-leak' },
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    createdIds.push(created.id);

    // List all templates
    const listRes = await request.get(`${BASE_URL}/api/templates`, {
      headers: authHeaders(),
    });
    expect(listRes.ok()).toBeTruthy();
    const listBody = await listRes.json();
    expect(Array.isArray(listBody.items)).toBe(true);
    expect(typeof listBody.total).toBe('number');
    expect(typeof listBody.has_more).toBe('boolean');

    // Find our template in the list
    const found = listBody.items.find((t: any) => t.id === created.id);
    expect(found).toBeTruthy();
    // TemplateOut should NOT have screen_json
    expect(found).not.toHaveProperty('screen_json');
    // But should have list-level fields
    expect(found.name).toBeTruthy();
    expect(found.category).toBeTruthy();
  });

  test('get template returns full screen_json', async ({ request }) => {
    const customScreen = { rows: [], custom_field: 'test_value' };
    const createRes = await createTemplate(request, {
      screen_json: customScreen,
    });
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    createdIds.push(created.id);

    // GET single template
    const getRes = await request.get(`${BASE_URL}/api/templates/${created.id}`, {
      headers: authHeaders(),
    });
    expect(getRes.ok()).toBeTruthy();
    const body = await getRes.json();

    // TemplateDetailOut MUST have screen_json
    expect(body.screen_json).toBeTruthy();
    expect(body.screen_json).toHaveProperty('rows');
    expect(Array.isArray(body.screen_json.rows)).toBe(true);
    expect(body.screen_json.custom_field).toBe('test_value');

    // Also verify the detail shape extends TemplateOut fields
    expect(body.id).toBe(created.id);
    expect(body.name).toBe(created.name);
    expect(body.category).toBe(created.category);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Update
  // ─────────────────────────────────────────────────────────────────────────

  test('update template validates screen_json when provided', async ({ request }) => {
    const createRes = await createTemplate(request);
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    createdIds.push(created.id);

    // Step 1: PUT with invalid screen_json (no rows, no sections) — should reject
    const invalidRes = await request.put(`${BASE_URL}/api/templates/${created.id}`, {
      headers: authHeaders(),
      data: {
        screen_json: invalidScreenJson,
      },
    });
    expect(invalidRes.status()).toBe(422);

    // Step 2: PUT with valid screen_json — should succeed
    const validRes = await request.put(`${BASE_URL}/api/templates/${created.id}`, {
      headers: authHeaders(),
      data: {
        screen_json: { rows: [{ id: 'row-1', cells: [] }] },
      },
    });
    expect(validRes.status()).toBe(200);
    const updated = await validRes.json();
    expect(updated.screen_json).toHaveProperty('rows');
    expect(updated.screen_json.rows).toHaveLength(1);
    expect(updated.screen_json.rows[0].id).toBe('row-1');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Delete
  // ─────────────────────────────────────────────────────────────────────────

  test('delete template removes it', async ({ request }) => {
    const createRes = await createTemplate(request);
    expect(createRes.status()).toBe(201);
    const created = await createRes.json();
    // Do NOT add to createdIds — we deliberately delete and verify

    // Delete
    const delRes = await request.delete(`${BASE_URL}/api/templates/${created.id}`, {
      headers: authHeaders(),
    });
    expect(delRes.status()).toBe(200);
    const delBody = await delRes.json();
    expect(delBody.deleted).toBe(true);
    expect(delBody.id).toBe(created.id);

    // Verify GET now returns 404
    const getRes = await request.get(`${BASE_URL}/api/templates/${created.id}`, {
      headers: authHeaders(),
    });
    expect(getRes.status()).toBe(404);
  });
});
