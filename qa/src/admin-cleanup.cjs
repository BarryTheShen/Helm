const { execa } = require('execa');
const fs = require('fs');
const path = require('path');

const QA_BACKEND_URL = 'http://127.0.0.1:8000';

function readQaAuthToken() {
  const authPath = path.join(__dirname, '.qa-auth.json');
  if (!fs.existsSync(authPath)) {
    return null;
  }
  const auth = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
  return auth.token || null;
}

/** Match backend/app/services/cleanup_service.py _is_cleanup_eligible_name */
function isCleanupEligibleName(name) {
  if (!name) return false;
  if (name.toLowerCase().startsWith('test')) return true;
  if (name === 'New Module') return true;
  const lowered = name.toLowerCase();
  if (lowered.startsWith('qa test') || lowered.startsWith('qa module')) return true;
  return false;
}

async function curlJson(args) {
  const result = await execa('curl', args, { timeout: 30000, reject: false });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr || `curl failed (exit ${result.exitCode})`);
  }
  if (!result.stdout.trim()) return null;
  return JSON.parse(result.stdout);
}

/**
 * DELETE every custom-* module whose name looks like QA junk.
 * Uses the module API directly so cleanup works even when admin cleanup is stale.
 */
async function deleteEligibleCustomModules(token) {
  const data = await curlJson([
    '-sf',
    '-H', `Authorization: Bearer ${token}`,
    `${QA_BACKEND_URL}/api/sdui/modules`,
  ]);
  const items = data?.items || [];
  let deleted = 0;

  for (const mod of items) {
    const moduleId = mod.module_id || mod.id;
    if (!moduleId?.startsWith('custom-')) continue;
    if (!isCleanupEligibleName(mod.name)) continue;

    const result = await execa('curl', [
      '-sf',
      '-X', 'DELETE',
      '-H', `Authorization: Bearer ${token}`,
      `${QA_BACKEND_URL}/api/sdui/modules/${moduleId}`,
    ], { timeout: 15000, reject: false });

    if (result.exitCode === 0) {
      deleted += 1;
    } else {
      console.warn(`Failed to delete custom module ${moduleId}: exit ${result.exitCode}`);
    }
  }

  return deleted;
}

/**
 * POST /api/admin/cleanup/execute plus direct custom-module sweep.
 * Returns summary object or null on skip/failure.
 */
async function runAdminCleanup(options = {}) {
  const { label = 'Admin cleanup' } = options;
  const token = readQaAuthToken();
  if (!token) {
    console.log(`${label}: no QA auth token — skipping.`);
    return null;
  }

  let customModulesDeleted = 0;
  try {
    customModulesDeleted = await deleteEligibleCustomModules(token);
  } catch (err) {
    console.warn(`${label}: custom module sweep failed:`, err.message || err);
  }

  let adminBody = null;
  try {
    adminBody = await curlJson([
      '-sf',
      '-X', 'POST',
      '-H', `Authorization: Bearer ${token}`,
      '-H', 'Content-Type: application/json',
      `${QA_BACKEND_URL}/api/admin/cleanup/execute`,
    ]);
  } catch (err) {
    console.warn(`${label}: admin execute skipped or failed:`, err.message || err);
  }

  const adminCustom = adminBody?.custom_modules_deleted || 0;
  const total =
    customModulesDeleted
    + adminCustom
    + (adminBody?.workflows_deleted || 0)
    + (adminBody?.apps_deleted || 0)
    + (adminBody?.module_instances_deleted || 0)
    + (adminBody?.templates_deleted || 0);

  console.log(
    `${label}: removed ${total} test artifact(s) `
    + `(custom_modules=${customModulesDeleted + adminCustom}).`,
  );

  return {
    custom_modules_deleted: customModulesDeleted + adminCustom,
    ...adminBody,
  };
}

module.exports = {
  runAdminCleanup,
  deleteEligibleCustomModules,
  readQaAuthToken,
  isCleanupEligibleName,
  QA_BACKEND_URL,
};
