import { test as base } from '@playwright/test';
export const test = base.extend<{ login: () => Promise<void> }>({
  login: async ({ page }, use) => {
    await page.goto('http://127.0.0.1:5174/login');
    // Login form has username, password, org (3 fields from Session 9)
    await page.getByPlaceholder(/username/i).fill('admin');
    await page.getByPlaceholder(/password/i).fill('admin');
    await page.getByPlaceholder(/organization/i).fill('Helm');
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await page.waitForURL('!*=login');
    await use();
  },
});
export { expect } from '@playwright/test';