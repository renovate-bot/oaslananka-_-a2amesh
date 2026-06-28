import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = resolve(repoRoot, 'docs/protocol/schemas');
const targetDir = resolve(repoRoot, 'packages/protocol/schemas');
const schemasDir = resolve(repoRoot, 'packages/protocol');

mkdirSync(targetDir, { recursive: true });

const expectedNames = readdirSync(sourceDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.schema.json'))
  .map((entry) => entry.name)
  .sort();

for (const name of expectedNames) {
  copyFileSync(resolve(sourceDir, name), resolve(targetDir, name));
}

const existingInTarget = readdirSync(targetDir, { withFileTypes: true })
  .filter((entry) => entry.isFile() && entry.name.endsWith('.schema.json'))
  .map((entry) => entry.name)
  .sort();

for (const name of existingInTarget) {
  if (!expectedNames.includes(name)) {
    rmSync(resolve(targetDir, name));
  }
}

if (!expectedNames.length) {
  console.error('No schema files found in', sourceDir);
  console.error('Run `pnpm run schemas:generate` first.');
  process.exit(1);
}

console.log(`Copied ${expectedNames.length} schema files to packages/protocol/schemas/`);
