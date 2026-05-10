import { test, expect } from '@playwright/test';
import fs from 'fs';
import { qaPath } from '../utils';

test.describe('API Endpoints', () => {
  test('all discovered endpoints return valid status', async ({ request }) => {
    // Load discovered endpoints
    let discovered: any;
    try {
      discovered = JSON.parse(fs.readFileSync(qaPath('src/discovered.json'), 'utf-8'));
    } catch {
      console.log('discovered.json not found, skipping endpoint tests');
      test.skip(true, 'No discovered.json');
      return;
    }

    const endpoints: Array<{ method: string; path: string }> = discovered.endpoints || [];
    if (endpoints.length === 0) {
      test.skip(true, 'No endpoints discovered');
      return;
    }

    // Load auth token
    let auth: any;
    try {
      auth = JSON.parse(fs.readFileSync(qaPath('src/.qa-auth.json'), 'utf-8'));
    } catch {
      console.log('.qa-auth.json not found, skipping endpoint tests');
      test.skip(true, 'No .qa-auth.json');
      return;
    }

    const baseUrl = 'http://127.0.0.1:8000';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${auth.token}`,
    };

    const failures: string[] = [];

    for (const ep of endpoints) {
      // Endpoints are objects: { method: "GET", path: "/health" }
      const method = ep.method;
      const route = ep.path;

      // Only health-check GET endpoints — other methods need valid request bodies
      if (method.toUpperCase() !== 'GET') {
        continue;
      }

      const url = `${baseUrl}${route}`;
      try {
        const res = await request.get(url, { headers });
        if (res.status() >= 500) {
          failures.push(`${method} ${route} → ${res.status()}`);
        } else if (res.status() !== 200) {
          console.log(`  Non-200: ${method} ${route} → ${res.status()}`);
        }
      } catch (err) {
        failures.push(`${method} ${route} → REQUEST ERROR: ${err}`);
      }
    }

    if (failures.length > 0) {
      console.log(`Endpoint failures:\n${failures.join('\n')}`);
    }
    expect(failures, `Endpoints returning 5xx status:\n${failures.join('\n')}`).toHaveLength(0);
  });
});
