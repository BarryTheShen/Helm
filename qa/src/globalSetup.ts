import { execa } from 'execa';
const ROOT = process.env.HOME + '/Nextcloud/vc_projects/Helm';
async function wait(url: string, ms = 120000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    try { await execa('curl', ['-sf', url], { timeout: 5000 }); return; } catch { await new Promise(r => setTimeout(r, 3000)); }
  }
  throw new Error(`Health check failed: ${url}`);
}
export default async () => {
  const env = { ...process.env, HELM_ALLOW_INSECURE_DEV: '1' };
  process.env.BACKEND_PID = (await execa('bash', ['-c', 'cd backend && source .venv/bin/activate && uvicorn app.main:app --host 127.0.0.1 --port 8000 & echo $!'], { cwd: ROOT, env })).stdout.trim();
  process.env.WEB_PID = (await execa('bash', ['-c', 'cd web && npx vite --host 127.0.0.1 & echo $!'], { cwd: ROOT, env })).stdout.trim();
  console.log('Waiting for backend...');
  await wait('http://127.0.0.1:8000/health');
  console.log('Waiting for web...');
  await wait('http://127.0.0.1:5174');
  console.log('Both servers ready.');
};