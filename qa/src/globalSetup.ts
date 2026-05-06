import { execa } from 'execa';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');

async function waitUntilHealthy(url: string, ms = 120000): Promise<void> {
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

async function httpJSON(method: string, url: string, body?: object): Promise<any> {
  const opts: any = {
    timeout: 15000,
    reject: false,
  };
  if (body) {
    opts.json = body;
  }
  const result = await execa(method === 'GET' ? 'curl' : 'curl', [
    '-s',
    '-X', method,
    '-H', 'Content-Type: application/json',
    body ? '-d', JSON.stringify(body) : undefined,
    url,
  ].filter(Boolean) as string[], { ...opts, reject: false });

  if (result.exitCode !== 0) {
    throw new Error(`HTTP ${method} ${url} failed (exit ${result.exitCode}): ${result.stderr}`);
  }
  if (!result.stdout.trim()) return null;
  return JSON.parse(result.stdout);
}

export default async () => {
  const env = { ...process.env, HELM_ALLOW_INSECURE_DEV: '1' };

  // Start backend only
  console.log('Starting backend server...');
  const backendPromise = execa(
    'bash',
    ['-c', 'source .venv/bin/activate && uvicorn app.main:app --host 127.0.0.1 --port 8000'],
    { cwd: path.join(ROOT, 'backend'), env, detached: true, stdout: 'ignore', stderr: 'ignore' }
  );
  const backendPid = String(backendPromise.pid ?? '');
  process.env.BACKEND_PID = backendPid;
  fs.writeFileSync(path.join(ROOT, 'qa', '.backend-pid.txt'), backendPid);
  console.log(`Backend PID: ${backendPid}`);

  // Wait for backend health
  console.log('Waiting for backend health check...');
  await waitUntilHealthy('http://127.0.0.1:8000/health');
  console.log('Backend is healthy.');

  // Ensure QA credentials file exists
  const qaEnvPath = path.join(ROOT, 'qa', '.qa-env.json');
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
    } catch (err: any) {
      // 409 means another process already set it up — acceptable
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

  // Start Vite dev server
  console.log('Starting Vite dev server...');
  const vitePromise = execa(
    'bash',
    ['-c', `cd "${path.join(ROOT, 'web')}" && npx vite dev --host 127.0.0.1 --port 5174 > /dev/null 2>&1 & echo $!`],
    { env, detached: true, stdout: 'pipe', stderr: 'ignore' }
  );
  const vitePid = vitePromise.stdout?.toString()?.trim() || '';
  process.env.VITE_PID = vitePid;
  // Write Vite PID to shared file so globalTeardown can read it
  fs.writeFileSync(path.join(ROOT, 'qa', '.vite-pid.txt'), vitePid);
  console.log(`Vite PID: ${vitePid}`);

  // Wait for Vite
  console.log('Waiting for Vite health check...');
  await waitUntilHealthy('http://127.0.0.1:5174');
  console.log('Vite is healthy.');

  // Discover templates/pages
  const { discover } = await import('./discover');
  await discover(loginResp.session_token);
  console.log('Global setup complete.');
};
