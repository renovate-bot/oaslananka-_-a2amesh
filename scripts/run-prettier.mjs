import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const prettierBin = require.resolve('prettier/bin/prettier.cjs');

const files = process.argv.slice(2).map((filePath) => resolve(filePath));

if (files.length === 0) {
  process.exit(0);
}

const result = spawnSync(
  process.execPath,
  [prettierBin, '--write', '--ignore-path', '.prettierignore', '--ignore-unknown', ...files],
  { stdio: 'inherit' },
);

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
