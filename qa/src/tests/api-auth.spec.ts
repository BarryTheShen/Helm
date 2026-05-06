import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('API Auth', () => {
  test('login with correct credentials returns 200', async ({ request }) => {
    const qaEnv = JSON.parse(fs.readFileSync(path.join(__dirname, '../../.qa-env.json'), 'utf-8'));
    const res = await request.post('http://127.0.0.1:8000/auth/login', {
      data: {
        username: qaEnv.username,
        password: qaEnv.password,
        device_name: 'QA-Test',
        device_id: 'qa-auth-' + Date.now(),
      },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.session_token).toBeTruthy();
  });

  test('login with wrong credentials returns 401', async ({ request }) => {
    const res = await request.post('http://127.0.0.1:8000/auth/login', {
      data: { username: 'wrong', password: 'wrong', device_name: 'QA', device_id: 'qa' },
    });
    expect(res.status()).toBe(401);
  });

  test('unauthenticated API request returns 401', async ({ request }) => {
    const res = await request.get('http://127.0.0.1:8000/api/components/registry');
    expect(res.status()).toBe(401);
  });

  test('authenticated API request returns 200', async ({ request }) => {
    const auth = JSON.parse(fs.readFileSync(path.join(__dirname, '../.qa-auth.json'), 'utf-8'));
    const res = await request.get('http://127.0.0.1:8000/api/components/registry', {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    expect(res.ok()).toBeTruthy();
  });
});
