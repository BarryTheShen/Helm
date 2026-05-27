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
  await request.delete(`${QA_BACKEND_URL}/api/sdui/modules/${moduleId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
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
}
