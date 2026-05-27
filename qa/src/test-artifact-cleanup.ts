import fs from 'fs';
import path from 'path';
import type { APIRequestContext } from '@playwright/test';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const QA_BACKEND_URL = 'http://127.0.0.1:8000';

export function readQaAuthToken(): string {
  const authPath = path.join(__dirname, '.qa-auth.json');
  const auth = JSON.parse(fs.readFileSync(authPath, 'utf-8')) as { token: string };
  return auth.token;
}

export async function deleteCustomModule(
  request: APIRequestContext,
  moduleId: string,
  token = readQaAuthToken(),
): Promise<void> {
  if (!moduleId.startsWith('custom-')) {
    return;
  }
  const response = await request.delete(`${QA_BACKEND_URL}/api/sdui/modules/${moduleId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok() && response.status() !== 404) {
    console.warn(`deleteCustomModule(${moduleId}) failed: HTTP ${response.status()}`);
  }
}

export async function deleteWorkflow(
  request: APIRequestContext,
  workflowId: string,
  token = readQaAuthToken(),
): Promise<void> {
  await request.delete(`${QA_BACKEND_URL}/api/workflows/${workflowId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function cleanupCustomModuleFromEditorUrl(
  request: APIRequestContext,
  pageUrl: string,
): Promise<void> {
  const moduleId = new URL(pageUrl).searchParams.get('module_instance_id');
  if (moduleId) {
    await deleteCustomModule(request, moduleId);
  }
}

export async function executeAdminTestCleanup(request: APIRequestContext): Promise<void> {
  const token = readQaAuthToken();
  await request.post(`${QA_BACKEND_URL}/api/admin/cleanup/execute`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await deleteEligibleCustomModules(request, token);
}

/** Names eligible for QA cleanup — mirrors cleanup_service._is_cleanup_eligible_name */
function isCleanupEligibleName(name: string | null | undefined): boolean {
  if (!name) return false;
  if (name.toLowerCase().startsWith('test')) return true;
  if (name === 'New Module') return true;
  const lowered = name.toLowerCase();
  if (lowered.startsWith('qa test') || lowered.startsWith('qa module')) return true;
  return false;
}

/** DELETE all custom-* modules with QA-eligible names via GET /api/sdui/modules. */
export async function deleteEligibleCustomModules(
  request: APIRequestContext,
  token = readQaAuthToken(),
): Promise<number> {
  const response = await request.get(`${QA_BACKEND_URL}/api/sdui/modules`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok()) {
    console.warn(`deleteEligibleCustomModules: list failed HTTP ${response.status()}`);
    return 0;
  }

  const data = await response.json() as { items?: Array<{ module_id?: string; name?: string }> };
  const items = data.items ?? [];
  let deleted = 0;

  for (const mod of items) {
    const moduleId = mod.module_id;
    if (!moduleId?.startsWith('custom-')) continue;
    if (!isCleanupEligibleName(mod.name)) continue;
    await deleteCustomModule(request, moduleId, token);
    deleted += 1;
  }

  return deleted;
}
