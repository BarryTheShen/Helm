const { execa } = require('execa');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');

async function waitUntilHealthy(url, ms = 120000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try {
      await execa('curl', ['-sf', url], { timeout: 5000 });
      return;
    } catch {
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  throw new Error(`Health check failed: ${url}`);
}

async function httpJSON(method, url, body) {
  const opts = { timeout: 15000, reject: false };
  const result = await execa('curl', [
    '-s',
    '-X', method,
    '-H', 'Content-Type: application/json',
    ...(body ? ['-d', JSON.stringify(body)] : []),
    url,
  ].filter(Boolean), { ...opts, reject: false });

  if (result.exitCode !== 0) {
    throw new Error(`HTTP ${method} ${url} failed (exit ${result.exitCode}): ${result.stderr}`);
  }
  if (!result.stdout.trim()) return null;
  return JSON.parse(result.stdout);
}

async function main() {
  const env = { ...process.env, HELM_ALLOW_INSECURE_DEV: '1' };
  const qaDir = path.join(ROOT, 'qa');

  // Check if backend is already running
  let backendRunning = false;
  try {
    await execa('curl', ['-sf', '--max-time', '3', 'http://127.0.0.1:8000/health'], { timeout: 5000 });
    backendRunning = true;
  } catch { /* not running */ }

  if (!backendRunning) {
    console.log('Starting backend server...');
    const backendPromise = execa(
      'bash',
      ['-c', 'source .venv/bin/activate && uvicorn app.main:app --host 127.0.0.1 --port 8000'],
      { cwd: path.join(ROOT, 'backend'), env, detached: true, stdout: 'ignore', stderr: 'ignore' }
    );
    const backendPid = String(backendPromise.pid ?? '');
    fs.writeFileSync(path.join(qaDir, '.backend-pid.txt'), backendPid);
    console.log(`Backend PID: ${backendPid}`);

    console.log('Waiting for backend health check...');
    await waitUntilHealthy('http://127.0.0.1:8000/health');
    console.log('Backend is healthy.');
  } else {
    console.log('Backend already running, skipping startup.');
    try { fs.unlinkSync(path.join(qaDir, '.backend-pid.txt')); } catch {}
  }

  // Ensure QA credentials file exists
  const qaEnvPath = path.join(qaDir, '.qa-env.json');
  if (!fs.existsSync(qaEnvPath)) {
    fs.writeFileSync(qaEnvPath, JSON.stringify({ username: 'admin', password: 'admin' }));
    console.log('Created default .qa-env.json');
  }
  const qaEnv = JSON.parse(fs.readFileSync(qaEnvPath, 'utf-8'));

  // Check if setup is complete; create first user if not
  console.log('Checking setup status...');
  const status = await httpJSON('GET', 'http://127.0.0.1:8000/auth/status');
  if (status && status.setup_complete === false) {
    console.log('Server not set up, creating first user...');
    try {
      const setupResp = await httpJSON('POST', 'http://127.0.0.1:8000/auth/setup', {
        username: qaEnv.username,
        password: qaEnv.password,
      });
      console.log('Setup complete:', setupResp);
    } catch (err) {
      if (err.message?.includes('409')) {
        console.log('Setup already done by another process, skipping.');
      } else {
        throw err;
      }
    }
  } else {
    console.log('Server already set up.');
  }

  // Login
  console.log('Logging in...');
  const loginResp = await httpJSON('POST', 'http://127.0.0.1:8000/auth/login', {
    username: qaEnv.username,
    password: qaEnv.password,
    device_name: 'QA',
    device_id: `qa-${Date.now()}`,
  });
  if (!loginResp?.session_token) {
    throw new Error(`QA login failed: ${JSON.stringify(loginResp)}`);
  }
  console.log('Login successful.');

  // Write auth file for fixtures
  const authFile = path.join(__dirname, '.qa-auth.json');
  fs.writeFileSync(authFile, JSON.stringify({
    token: loginResp.session_token,
    user_id: loginResp.user_id,
    username: loginResp.username,
    role: loginResp.role,
  }));
  console.log(`Auth credentials written to ${authFile}`);

  // Remove stale QA artifacts (e.g. leaked "New Module" sidebar entries) before tests run
  const { runAdminCleanup } = require('./admin-cleanup.cjs');
  await runAdminCleanup({ label: 'Global setup cleanup' });

  // Check if Vite is already running
  let viteRunning = false;
  try {
    await execa('curl', ['-sf', '--max-time', '3', 'http://127.0.0.1:5174'], { timeout: 5000 });
    viteRunning = true;
  } catch { /* not running */ }

  if (!viteRunning) {
    console.log('Starting Vite dev server...');
    const viteProcess = execa(
      'bash',
      ['-c', `cd "${path.join(ROOT, 'web')}" && npx vite dev --host 127.0.0.1 --port 5174`],
      { env, detached: true, stdio: 'ignore' }
    );
    const vitePid = String(viteProcess.pid ?? '');
    fs.writeFileSync(path.join(qaDir, '.vite-pid.txt'), vitePid);
    console.log(`Vite PID: ${vitePid}`);

    console.log('Waiting for Vite health check...');
    await waitUntilHealthy('http://127.0.0.1:5174');
    console.log('Vite is healthy.');
  } else {
    console.log('Vite already running, skipping startup.');
    try { fs.unlinkSync(path.join(qaDir, '.vite-pid.txt')); } catch {}
  }

  // Discover
  const { discover } = require('./discover');
  await discover(loginResp.session_token);
  console.log('Global setup complete.');
}

module.exports = main;
