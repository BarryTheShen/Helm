import { test as base } from '@playwright/test';
import { expect } from '../fixtures';
import fs from 'fs';
import path from 'path';

// Security tests use a separate token so they don't invalidate the main auth
const test = base.extend<{ securityToken: string }>({
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
  test('unauthenticated access to /editor redirects to /login', async ({ page }) => {
    // Use a clean context — no auth injected
    const cleanPage = page.context().newPage();
    await cleanPage.addInitScript(() => {
      // Remove any auth that might be injected
      (window as any).__QA_NO_AUTH__ = true;
    });
    await cleanPage.goto('http://127.0.0.1:5174/editor');
    await cleanPage.waitForURL(/\/login/, { timeout: 10000 });
    await cleanPage.context().close();
  });

  test('login with wrong credentials shows error', async ({ page }) => {
    await page.goto('http://127.0.0.1:5174/login');
    await page.waitForLoadState('networkidle');

    const usernameInput = page.locator('label:has-text("Username") >> input');
    const passwordInput = page.locator('label:has-text("Password") >> input');

    await usernameInput.fill('invalid_user');
    await passwordInput.fill('wrong_password');
    await page.locator('button:has-text("Login")').click();

    await expect(page.locator('.text-red-600')).toBeVisible({ timeout: 10000 });
  });

  test('logout with separate token does not affect main auth', async ({ page, securityToken }) => {
    // Login with security token
    await page.addInitScript((t: string) => {
      window.localStorage.setItem('admin_token', t);
    }, securityToken);
    await page.goto('http://127.0.0.1:5174/editor');
    await page.waitForLoadState('networkidle');

    // Logout with security token
    await page.evaluate(async (token: string) => {
      await fetch('/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    }, securityToken);

    // Verify main token still works
    const mainAuth = JSON.parse(fs.readFileSync(path.join(__dirname, '../.qa-auth.json'), 'utf-8'));
    const res = await page.request.get('http://127.0.0.1:8000/api/components/registry', {
      headers: { Authorization: `Bearer ${mainAuth.token}` },
    });
    expect(res.ok()).toBeTruthy();
  });
});
