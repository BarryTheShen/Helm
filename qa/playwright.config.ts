import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './src/tests',
  globalSetup: './src/globalSetup.cjs',
  globalTeardown: './src/globalTeardown.cjs',
  use: {
    channel: 'chrome',
  },
  projects: [
    {
      name: 'backend-only',
      testMatch: '**/api-*.spec.ts',
      use: { baseURL: 'http://127.0.0.1:8000' },
    },
    {
      name: 'e2e',
      testIgnore: '**/api-*.spec.ts',
      testMatch: '**/*.spec.ts',
      use: {
        baseURL: 'http://127.0.0.1:5174',
        screenshot: 'only-on-failure',
        trace: 'on-first-retry',
      },
    },
  ],
  retries: 1,
  reporter: [['list'], ['json', { outputFile: 'results/playwright-results.json' }]],
});