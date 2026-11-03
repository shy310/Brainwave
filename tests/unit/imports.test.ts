import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Vercel runs server code as plain Node ES modules, which need file extensions
// on relative imports. Without them the API crashes on startup in production.
const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const p = join(dir, name);
  return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
});

describe('server imports', () => {
  it('use .js extensions on every relative import', () => {
    const bad: string[] = [];
    for (const file of ['api', 'server', 'shared'].flatMap(walk)) {
      for (const m of readFileSync(file, 'utf8').matchAll(/(?:from|import)\s*\(?\s*['"](\.{1,2}\/[^'"]+)['"]/g)) {
        if (!/\.(js|json)$/.test(m[1])) bad.push(`${file}: ${m[1]}`);
      }
      if (/from\s+['"]@(shared)?\//.test(readFileSync(file, 'utf8'))) bad.push(`${file}: uses a path alias`);
    }
    expect(bad).toEqual([]);
  });
});
