import { test as base, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// Security tests need isolated contexts — do NOT use the shared login fixture
// which injects auth via addInitScript (that contaminates child pages).
const test = base.extend<{
  noAuthPage: import('@playwright/test').Page;
  securityToken: string;
}>({
  noAuthPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
  securityToken: async ({ request }, use) => {
    const auth = JSON.parse(fs.readFileSync(path.join(__dirname, '../.qa-auth.json'), 'utf-8'));
    const res = await request.post('http://127.0.0.1:8000/auth/login', {
      data: {
        username: auth.username,
        password: JSON.parse(fs.readFileSync(path.join(__dirname, '../../.qa-env.json'), 'utf-8')).password,
        device_name: 'QA-Security',
        device_id: 'qa-sec-' + Date.now(),
      },
    });
    const body = JSON.parse(await res.text());
    await use(body.session_token);
  },
});

test.describe('Security', () => {
  test('unauthenticated access to /editor redirects to /login', async ({ noAuthPage }) => {
    await noAuthPage.goto('http://127.0.0.1:5174/editor');
    await noAuthPage.waitForURL(/\/login/, { timeout: 10000 });
  });

  test('login with wrong credentials shows error', async ({ noAuthPage }) => {
    await noAuthPage.goto('http://127.0.0.1:5174/login');
    await noAuthPage.waitForLoadState('networkidle');

    const usernameInput = noAuthPage.locator('label:has-text("Username") >> input');
    const passwordInput = noAuthPage.locator('label:has-text("Password") >> input');

    await usernameInput.fill('invalid_user');
    await passwordInput.fill('wrong_password');
    await noAuthPage.locator('button:has-text("Login")').click();

    await expect(noAuthPage.locator('.text-red-600')).toBeVisible({ timeout: 10000 });
  });

  test('logout with separate token does not affect main auth', async ({ noAuthPage, securityToken }) => {
    // Inject security token manually into this clean page
    await noAuthPage.addInitScript((t: string) => {
      window.localStorage.setItem('admin_token', t);
    }, securityToken);
    await noAuthPage.goto('http://127.0.0.1:5174/editor');
    await noAuthPage.waitForLoadState('networkidle');

    // Logout with security token
    await noAuthPage.evaluate(async (token: string) => {
      await fetch('/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    }, securityToken);

    // Verify main token still works
    const mainAuth = JSON.parse(fs.readFileSync(path.join(__dirname, '../.qa-auth.json'), 'utf-8'));
    const res = await noAuthPage.request.get('http://127.0.0.1:8000/api/components/registry', {
      headers: { Authorization: `Bearer ${mainAuth.token}` },
    });
    expect(res.ok()).toBeTruthy();
  });
});
