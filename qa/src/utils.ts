import { fileURLToPath } from 'url';
import path from 'path';

export function getDirname(importMeta: ImportMeta) {
  return path.dirname(fileURLToPath(import.meta.url));
}

// Global QA paths — use these instead of __dirname
export function qaPath(...segments: string[]) {
  const root = path.resolve(getDirname(import.meta), '..');
  return path.join(root, ...segments);
}
