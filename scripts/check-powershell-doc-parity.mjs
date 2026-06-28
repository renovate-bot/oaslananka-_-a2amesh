import { readdirSync } from 'node:fs';
import { readText, fail } from './check-utils.mjs';

const shellLanguages = new Set(['bash', 'sh', 'shell']);
const powerShellLanguages = new Set(['powershell', 'pwsh']);

const requiredPowerShellDocs = new Set([
  'README.md',
  'CONTRIBUTING.md',
  'docs/development/setup.md',
  'docs/development/testing.md',
  'docs/release/process.md',
]);

const selectedDocs = [
  ...requiredPowerShellDocs,
  ...readdirSync('docs/cli')
    .filter((entry) => entry.endsWith('.md'))
    .map((entry) => `docs/cli/${entry}`)
    .sort(),
].sort();

function getFences(text) {
  const fences = [];
  const lines = text.split('\n');
  let current;

  for (const [index, line] of lines.entries()) {
    const match = line.match(/^```([a-z0-9-]+)?\s*$/i);
    if (!match) continue;

    const lineNumber = index + 1;
    if (!current) {
      current = {
        lang: (match[1] ?? '').toLowerCase(),
        start: lineNumber,
        end: lineNumber,
      };
    } else {
      current.end = lineNumber;
      fences.push(current);
      current = undefined;
    }
  }

  return fences;
}

function hasNearbyPowerShell(shellFence, powerShellFences, shellFences) {
  return powerShellFences.some(
    (fence) =>
      fence.start >= shellFence.end &&
      fence.start - shellFence.end <= 12 &&
      !shellFences.some((other) => other.start > shellFence.start && other.start < fence.start),
  );
}

const failures = [];

for (const file of selectedDocs) {
  const text = readText(file);
  const fences = getFences(text);
  const shellFences = fences.filter((fence) => shellLanguages.has(fence.lang));
  const powerShellFences = fences.filter((fence) => powerShellLanguages.has(fence.lang));

  if (requiredPowerShellDocs.has(file) && powerShellFences.length === 0) {
    failures.push(`${file}: missing PowerShell command block`);
  }

  for (const shellFence of shellFences) {
    if (!hasNearbyPowerShell(shellFence, powerShellFences, shellFences)) {
      failures.push(
        `${file}:${shellFence.start}: shell command block needs a nearby PowerShell block`,
      );
    }
  }
}

if (failures.length > 0) {
  fail('PowerShell documentation parity validation failed.', failures);
}
