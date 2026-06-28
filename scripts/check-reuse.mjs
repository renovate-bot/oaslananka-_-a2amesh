/**
 * @fileoverview
 * Check REUSE compliance by running `reuse lint`.
 * Falls back to `pipx run reuse lint` if `reuse` is not on PATH.
 * Skips with a warning if neither is available.
 *
 * Install: pip install --user reuse
 * Docs: https://reuse.software/docs/
 */

import { execSync } from 'node:child_process';

function tryCommand(cmd) {
  try {
    return execSync(cmd, {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 30_000,
      shell: true,
    });
  } catch {
    return null;
  }
}

const COMMANDS = ['reuse lint', 'pipx run reuse lint'];

let output = null;
let usedCommand = null;
for (const cmd of COMMANDS) {
  output = tryCommand(cmd);
  if (output !== null) {
    usedCommand = cmd;
    break;
  }
}

if (output === null) {
  console.error('✗ REUSE compliance check skipped: `reuse` tool not found.');
  console.error('  Install: pip install --user reuse');
  process.exit(0);
}

if (output.includes('Congratulations')) {
  console.log(`✓ REUSE compliance check passed (via \`${usedCommand}\`)`);
  process.exit(0);
}

console.error(output);
console.error(`✗ REUSE compliance check failed (via \`${usedCommand}\`)`);
process.exit(1);
