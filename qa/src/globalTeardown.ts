import { execa } from 'execa';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');

async function killPid(pidFile: string, label: string): Promise<void> {
  const filePath = path.join(ROOT, 'qa', pidFile);
  if (!fs.existsSync(filePath)) {
    console.log(`${label} PID file not found, skipping.`);
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

export default async () => {
  console.log('Global teardown — stopping servers...');
  await killPid('.vite-pid.txt', 'Vite');
  await killPid('.backend-pid.txt', 'Backend');
  console.log('Global teardown complete.');
};
