import fs from 'fs';
import path from 'path';

export default async () => {
  const root = path.resolve(__dirname, '../..');

  // Kill Vite if running
  try {
    const vitePid = fs.readFileSync(path.join(root, 'qa', '.vite-pid.txt'), 'utf-8').trim();
    if (vitePid) {
      console.log(`Killing Vite PID ${vitePid}`);
      process.kill(parseInt(vitePid));
    }
  } catch { /* no vite pid file */ }

  // Kill backend if running
  try {
    const backendPid = fs.readFileSync(path.join(root, 'qa', '.backend-pid.txt'), 'utf-8').trim();
    if (backendPid) {
      console.log(`Killing backend PID ${backendPid}`);
      process.kill(parseInt(backendPid));
    }
  } catch { /* no backend pid file */ }

  // Clean up pid files
  try { fs.unlinkSync(path.join(root, 'qa', '.vite-pid.txt')); } catch {}
  try { fs.unlinkSync(path.join(root, 'qa', '.backend-pid.txt')); } catch {}

  console.log('Global teardown complete.');
};
