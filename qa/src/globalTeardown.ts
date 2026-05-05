export default async () => {
  const { execa } = await import('execa');
  if (process.env.BACKEND_PID) await execa('kill', [process.env.BACKEND_PID]).catch(() => {});
  if (process.env.WEB_PID) await execa('kill', [process.env.WEB_PID]).catch(() => {});
  console.log('Servers stopped.');
};