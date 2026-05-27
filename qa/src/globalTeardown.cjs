const { execa } = require('execa');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

async function killPid(pidFile, label) {
  const filePath = path.join(ROOT, 'qa', pidFile);
  if (!fs.existsSync(filePath)) {
    console.log(`${label} PID file not found (server was pre-existing), skipping kill.`);
    return;
  }
  const pid = fs.readFileSync(filePath, 'utf-8').trim();
  if (!pid) {
    console.log(`${label} PID is empty, skipping.`);
    return;
  }
  await execa('kill', [pid]).catch(() => {});
  console.log(`${label} process ${pid} killed.`);
  fs.unlinkSync(filePath);
  console.log(`${pidFile} removed.`);
}

async function runAdminCleanup() {
  const authPath = path.join(__dirname, '.qa-auth.json');
  if (!fs.existsSync(authPath)) {
    console.log('No QA auth file — skipping admin cleanup.');
    return;
  }
  const auth = JSON.parse(fs.readFileSync(authPath, 'utf-8'));
  if (!auth.token) {
    console.log('No QA auth token — skipping admin cleanup.');
    return;
  }
  try {
    const result = await execa('curl', [
      '-sf',
      '-X', 'POST',
      '-H', `Authorization: Bearer ${auth.token}`,
      '-H', 'Content-Type: application/json',
      'http://127.0.0.1:8000/api/admin/cleanup/execute',
    ], { timeout: 30000 });
    const body = JSON.parse(result.stdout || '{}');
    const total =
      (body.custom_modules_deleted || 0)
      + (body.workflows_deleted || 0)
      + (body.apps_deleted || 0)
      + (body.module_instances_deleted || 0)
      + (body.templates_deleted || 0);
    console.log(`Admin cleanup removed ${total} test artifact(s).`);
  } catch (err) {
    console.warn('Admin cleanup skipped or failed:', err.message || err);
  }
}

async function main() {
  console.log('Global teardown — cleaning test artifacts...');
  await runAdminCleanup();
  console.log('Global teardown — stopping servers...');
  await killPid('.vite-pid.txt', 'Vite');
  await killPid('.backend-pid.txt', 'Backend');
  console.log('Global teardown complete.');
}

module.exports = main;
