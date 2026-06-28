import { execFileSync } from 'node:child_process';
import { readText, fail } from './check-utils.mjs';

execFileSync(process.execPath, ['scripts/generate-command-docs.mjs', '--check'], {
  stdio: 'inherit',
});

const commandIndex = readText('docs/cli/index.md');
const requiredCommands = [
  ...new Set([...commandIndex.matchAll(/`a2amesh ([a-z][a-z0-9-]*)`/g)].map((match) => match[1])),
].sort();

const failures = [];
for (const command of requiredCommands) {
  const path = `docs/cli/${command}.md`;
  const text = readText(path);
  if (!text.includes(`a2amesh ${command}`)) failures.push(`${path}: missing command example`);
  if (!text.includes('```bash')) failures.push(`${path}: missing bash example block`);
  if (!text.includes('```powershell')) failures.push(`${path}: missing PowerShell example block`);
}

const readme = readText('README.md');
for (const command of requiredCommands) {
  if (!readme.includes(`a2amesh ${command}`)) {
    failures.push(`README.md: missing ${command} example`);
  }
}

if (failures.length > 0) fail('Command documentation validation failed.', failures);
