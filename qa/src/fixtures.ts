import { test as base, expect } from '@playwright/test';
import type { APIRequestContext, Page, Response } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  cleanupCustomModuleFromEditorUrl,
  deleteCustomModule,
} from './test-artifact-cleanup';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function teardownEditorModules(
  page: Page,
  request: APIRequestContext,
  createdModuleIds: Set<string>,
): Promise<void> {
  for (const moduleId of createdModuleIds) {
    await deleteCustomModule(request, moduleId);
  }

  try {
    const url = page.url();
    if (url.includes('/editor')) {
      await cleanupCustomModuleFromEditorUrl(request, url);
    }
  } catch {
    // Page may already be closed after failure — URL cleanup is best-effort.
  }
}

export const test = base.extend<{ login: () => Promise<void> }>({
  login: async ({ page }, use) => {
    const auth = JSON.parse(fs.readFileSync(path.join(__dirname, '.qa-auth.json'), 'utf-8'));
    await page.addInitScript((a: { token: string; user_id: string; username: string; role: string }) => {
      window.localStorage.setItem('admin_token', a.token);
      window.localStorage.setItem('admin_user', JSON.stringify({
        id: a.user_id, username: a.username, role: a.role,
      }));
    }, auth);
    await use(() => Promise.resolve());
  },

  // Auto: track POST /api/sdui/modules during e2e tests and delete custom modules after each test.
  _editorModuleCleanup: [async ({ page, request }, use, testInfo) => {
    if (testInfo.project.name === 'backend-only') {
      await use();
      return;
    }

    const createdModuleIds = new Set<string>();

    const onResponse = async (response: Response) => {
      try {
        if (
          response.url().includes('/api/sdui/modules')
          && response.request().method() === 'POST'
          && response.status() === 201
        ) {
          const body = await response.json() as { module_id?: string };
          if (body.module_id?.startsWith('custom-')) {
            createdModuleIds.add(body.module_id);
          }
        }
      } catch {
        // Ignore parse/race errors on non-JSON responses.
      }
    };

    page.on('response', onResponse);
    await use();
    page.off('response', onResponse);
    await teardownEditorModules(page, request, createdModuleIds);
  }, { auto: true }],
});
export { expect } from '@playwright/test';
