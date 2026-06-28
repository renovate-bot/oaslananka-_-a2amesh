import { listFiles, fail } from './check-utils.mjs';

const forbiddenSegments = [
  'node_modules',
  'dist',
  'build',
  'coverage',
  'test-results',
  '.turbo',
  '.cache',
  '.nyc_output',
  '.playwright',
];
const failures = [];
for (const file of listFiles()) {
  const parts = file.split('/');
  if (parts.some((part) => forbiddenSegments.includes(part))) failures.push(file);
  if (file.endsWith('.tsbuildinfo')) failures.push(file);
}
if (failures.length > 0) fail('Generated or dependency artifacts found.', failures.slice(0, 120));
