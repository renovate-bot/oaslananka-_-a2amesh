import { readText, fail } from './check-utils.mjs';

const packages = [
  ['@a2amesh/runtime', 'docs/packages/runtime.md'],
  ['@a2amesh/registry', 'docs/packages/registry.md'],
  ['@a2amesh/cli', 'docs/packages/cli.md'],
  ['@a2amesh/mcp', 'docs/packages/mcp.md'],
  ['@a2amesh/protocol', 'docs/packages/protocol.md'],
  ['create-a2amesh', 'docs/packages/create-a2amesh.md'],
];
const failures = [];
const readme = readText('README.md');
for (const [pkg, path] of packages) {
  if (!readme.includes(pkg)) failures.push(`README.md: missing ${pkg}`);
  if (!readText(path).includes(pkg)) failures.push(`${path}: missing ${pkg}`);
}
if (failures.length > 0) fail('Docs/package parity validation failed.', failures);
