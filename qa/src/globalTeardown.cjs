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

async function main() {
  console.log('Global teardown — stopping servers...');
  await killPid('.vite-pid.txt', 'Vite');
  await killPid('.backend-pid.txt', 'Backend');
  console.log('Global teardown complete.');
}

module.exports = main;
