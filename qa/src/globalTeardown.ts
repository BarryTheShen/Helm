import { execa } from 'execa';

export default async () => {
  if (process.env.BACKEND_PID) {
    await execa('kill', [process.env.BACKEND_PID]).catch(() => {});
    console.log(`Backend process ${process.env.BACKEND_PID} killed.`);
  }
  if (process.env.VITE_PID) {
    await execa('kill', [process.env.VITE_PID]).catch(() => {});
    console.log(`Vite process ${process.env.VITE_PID} killed.`);
  }
  console.log('Global teardown complete.');
};
