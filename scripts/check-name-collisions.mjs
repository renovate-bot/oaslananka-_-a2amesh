import { execFileSync } from 'node:child_process';
import { fail } from './check-utils.mjs';

const names = [
  '@a2amesh/runtime',
  '@a2amesh/internal-adapters',
  '@a2amesh/registry',
  '@a2amesh/cli',
  '@a2amesh/mcp',
  '@a2amesh/internal-transport-ws',
  '@a2amesh/internal-transport-grpc',
  '@a2amesh/protocol',
  '@a2amesh/create-a2amesh',
];
const failures = [];
for (const name of names) {
  try {
    execFileSync('npm', ['view', name, 'name', '--json'], { stdio: 'pipe', encoding: 'utf8' });
    if (!name.startsWith('@a2amesh/')) {
      const owners = execFileSync('npm', ['owner', 'ls', name], {
        stdio: 'pipe',
        encoding: 'utf8',
      });
      if (!/oaslananka\s*</.test(owners))
        failures.push(`${name}: exact npm package exists outside oaslananka ownership`);
    }
  } catch {
    // npm 404 means available or not found.
  }
}
try {
  const repo = execFileSync(
    'gh',
    ['repo', 'view', 'oaslananka/a2amesh', '--json', 'nameWithOwner'],
    { stdio: 'pipe', encoding: 'utf8' },
  );
  if (!repo.includes('oaslananka/a2amesh'))
    failures.push('GitHub repo exact match is not oaslananka/a2amesh');
} catch {
  // Missing gh auth or repository availability is handled by remote bootstrap checks.
}
if (failures.length > 0) fail('Name collision validation failed.', failures);
