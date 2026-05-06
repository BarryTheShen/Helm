import { test as base } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export const test = base.extend<{ login: () => Promise<void> }>({
  login: async ({ page }, use) => {
    const auth = JSON.parse(fs.readFileSync(path.join(__dirname, '.qa-auth.json'), 'utf-8'));
    await page.addInitScript((a: any) => {
      window.localStorage.setItem('admin_token', a.token);
      window.localStorage.setItem('admin_user', JSON.stringify({
        id: a.user_id, username: a.username, role: a.role
      }));
    }, auth);
    await use();
  },
});
export { expect } from '@playwright/test';
