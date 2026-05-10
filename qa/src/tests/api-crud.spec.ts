import { test, expect } from '@playwright/test';
import fs from 'fs';
import { qaPath } from '../utils';

const BASE_URL = 'http://127.0.0.1:8000';

/**
 * Helper: log in with QA credentials and return the session_token.
 */
async function login(request: import('@playwright/test').APIRequestContext): Promise<string> {
  const qaEnv = JSON.parse(fs.readFileSync(qaPath('.qa-env.json'), 'utf-8'));
  const res = await request.post(`${BASE_URL}/auth/login`, {
    data: {
      username: qaEnv.username,
      password: qaEnv.password,
      device_name: 'QA-CRUD',
      device_id: `qa-crud-${Date.now()}`,
    },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.session_token).toBeTruthy();
  return body.session_token;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Chat API
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Chat API', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await login(request);
  });

  test('GET /api/chat/history returns 200 with messages array', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/chat/history`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.messages)).toBe(true);
    expect(typeof body.has_more).toBe('boolean');
  });

  test('DELETE /api/chat/history returns 200', async ({ request }) => {
    const res = await request.delete(`${BASE_URL}/api/chat/history`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.message).toBeTruthy();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Variables API
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Variables API', () => {
  let token: string;
  let createdVariableId: string;
  const randomSuffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  test.beforeAll(async ({ request }) => {
    token = await login(request);
  });

  test.afterAll(async ({ request }) => {
    // Clean up: delete the variable if it was created and the delete test didn't run
    if (createdVariableId) {
      try {
        await request.delete(`${BASE_URL}/api/variables/${createdVariableId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // ignore cleanup failures
      }
    }
  });

  test('GET /api/variables returns 200 with paginated response', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/variables`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe('number');
    expect(typeof body.has_more).toBe('boolean');
  });

  test('POST /api/variables creates a variable and returns 201', async ({ request }) => {
    const name = `qa-test-var-${randomSuffix}`;
    const res = await request.post(`${BASE_URL}/api/variables`, {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        name,
        value: 'test-value-' + randomSuffix,
        type: 'text',
        description: 'Created by QA CRUD test',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(body.name).toBe(name);
    expect(body.value).toBe('test-value-' + randomSuffix);
    createdVariableId = body.id;
  });

  test('Created variable appears in list', async ({ request }) => {
    // Ensure the prerequisite POST ran
    test.skip(!createdVariableId, 'Skipping: no variable was created (previous test may have failed)');

    const res = await request.get(`${BASE_URL}/api/variables`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const found = body.items.find((v: any) => v.id === createdVariableId);
    expect(found).toBeTruthy();
    expect(found.name).toContain('qa-test-var-');
  });

  test('DELETE /api/variables/{id} returns 204 and variable is removed', async ({ request }) => {
    // Ensure the prerequisite POST ran
    test.skip(!createdVariableId, 'Skipping: no variable was created (previous test may have failed)');

    const delRes = await request.delete(`${BASE_URL}/api/variables/${createdVariableId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(delRes.status()).toBe(204);

    // Verify it's gone
    const getRes = await request.get(`${BASE_URL}/api/variables`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await getRes.json();
    const found = body.items.find((v: any) => v.id === createdVariableId);
    expect(found).toBeFalsy();

    // Clear ID so afterAll doesn't retry
    createdVariableId = '';
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Settings API
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Settings API', () => {
  let token: string;
  const testDisplayName = `QA Test User ${Date.now()}`;

  test.beforeAll(async ({ request }) => {
    token = await login(request);
  });

  test('GET /api/settings returns 200 with user settings', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.id).toBeTruthy();
    expect(body.user_id).toBeTruthy();
    // display_name may be null initially
    expect('display_name' in body).toBe(true);
    expect('dark_mode' in body).toBe(true);
  });

  test('PATCH /api/settings updates display_name and change sticks', async ({ request }) => {
    // Update display_name
    const patchRes = await request.patch(`${BASE_URL}/api/settings`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { display_name: testDisplayName },
    });
    expect(patchRes.ok()).toBeTruthy();
    const patchBody = await patchRes.json();
    expect(patchBody.display_name).toBe(testDisplayName);

    // Verify it stuck
    const getRes = await request.get(`${BASE_URL}/api/settings`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const getBody = await getRes.json();
    expect(getBody.display_name).toBe(testDisplayName);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Modules API
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Modules API', () => {
  let token: string;
  let customModuleId: string | null = null;

  test.beforeAll(async ({ request }) => {
    token = await login(request);
  });

  test.afterAll(async ({ request }) => {
    // Clean up custom module if created
    if (customModuleId) {
      try {
        await request.delete(`${BASE_URL}/api/sdui/modules/${customModuleId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // ignore cleanup failures
      }
    }
  });

  test('GET /api/modules returns 200 with module list', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/modules`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.modules)).toBe(true);
    expect(body.modules.length).toBeGreaterThan(0);

    // Verify module shape
    const first = body.modules[0];
    expect(first.id).toBeTruthy();
    expect(typeof first.name).toBe('string');
    expect(typeof first.icon).toBe('string');
    expect(typeof first.enabled).toBe('boolean');
  });

  test('GET /api/sdui/modules returns SDUI module list', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/sdui/modules`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    if (body.items.length > 0) {
      const first = body.items[0];
      expect(first.module_id).toBeTruthy();
      expect(typeof first.name).toBe('string');
      expect(typeof first.has_screen).toBe('boolean');
    }
  });

  test('POST /api/sdui/modules creates a custom module', async ({ request }) => {
    const moduleName = `QA Test Module ${Date.now()}`;
    const res = await request.post(`${BASE_URL}/api/sdui/modules`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: moduleName, icon: '🧪' },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.module_id).toBeTruthy();
    expect(body.name).toBe(moduleName);
    expect(body.icon).toBe('🧪');
    customModuleId = body.module_id;

    // Verify it appears in the module list
    const listRes = await request.get(`${BASE_URL}/api/modules`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const listBody = await listRes.json();
    const found = listBody.modules.find((m: any) => m.id === customModuleId);
    expect(found).toBeTruthy();
    expect(found.name).toBe(moduleName);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Templates API
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Templates API', () => {
  let token: string;
  const randomSuffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  test.beforeAll(async ({ request }) => {
    token = await login(request);
  });

  test('GET /api/templates returns 200 with paginated response', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/templates`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(typeof body.total).toBe('number');
    expect(typeof body.has_more).toBe('boolean');
  });

  test('GET /api/templates/{id} returns template when it exists', async ({ request }) => {
    // First, get the list to find a template ID
    const listRes = await request.get(`${BASE_URL}/api/templates`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(listRes.ok()).toBeTruthy();
    const listBody = await listRes.json();

    test.skip(listBody.items.length === 0, 'Skipping: no templates exist in the database');

    const templateId = listBody.items[0].id;
    const res = await request.get(`${BASE_URL}/api/templates/${templateId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.id).toBe(templateId);
    expect(body.name).toBeTruthy();
    expect(body.category).toBeTruthy();
    // Template detail includes screen_json
    expect(body.screen_json).toBeTruthy();
  });

  test('GET /api/templates/{id} returns 404 for non-existent id', async ({ request }) => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res = await request.get(`${BASE_URL}/api/templates/${fakeId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.status()).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Actions Registry
// ─────────────────────────────────────────────────────────────────────────────
test.describe('Actions Registry', () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    token = await login(request);
  });

  test('GET /api/actions/functions returns 200 with registered function names', async ({ request }) => {
    const res = await request.get(`${BASE_URL}/api/actions/functions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.functions)).toBe(true);
    expect(body.functions.length).toBeGreaterThan(0);
    // Registry returns function name strings, not objects
    const first = body.functions[0];
    expect(typeof first).toBe('string');
  });
});
