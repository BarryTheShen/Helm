import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './src/tests',
  globalSetup: './src/globalSetup',
  globalTeardown: './src/globalTeardown',
  use: { baseURL: 'http://127.0.0.1:5174', screenshot: 'only-on-failure', trace: 'on-first-retry' },
  retries: 1,
  reporter: [['list'], ['json', { outputFile: '../results/playwright-results.json' }]],
});