import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

for (const path of [
  'dist',
  'coverage',
  'test-results',
  '.turbo',
  '.cache',
  '.artifacts',
  'docs-site/.vitepress/dist',
  'docs-site/.vitepress/cache',
  'docs-site/.vitepress/.temp',
]) {
  rmSync(path, { recursive: true, force: true });
}

function removeBuildInfoFiles(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') {
      continue;
    }

    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      removeBuildInfoFiles(path);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.tsbuildinfo')) {
      rmSync(path, { force: true });
    }
  }
}

removeBuildInfoFiles(process.cwd());
