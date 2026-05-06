/**
 * Discovers available templates/pages from the backend for QA metadata.
 * Called during globalSetup to populate test fixtures with live data.
 */
import { execa } from 'execa';

export async function discover(token: string): Promise<void> {
  const result = await execa('curl', [
    '-s',
    '-H', `Authorization: Bearer ${token}`,
    'http://127.0.0.1:8000/api/templates/',
  ], { reject: false });

  if (result.exitCode === 0 && result.stdout) {
    console.log('Discovered templates:', result.stdout.slice(0, 200));
  }
}
