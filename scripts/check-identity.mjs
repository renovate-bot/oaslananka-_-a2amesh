import { isTextFile, listFiles, readText, fail } from './check-utils.mjs';

const forbidden = [
  new RegExp('A2A ' + 'Warp', 'g'),
  new RegExp('a2a-' + 'warp', 'gi'),
  new RegExp('a2a_' + 'warp', 'gi'),
  new RegExp('@oaslananka\\/a2a-' + 'warp(?:-[a-z0-9-]+)?', 'gi'),
  new RegExp('create-a2a-' + 'warp', 'gi'),
  new RegExp('create-a2a-' + 'agent', 'gi'),
];
const allowedHistoricalPaths = [
  /^docs\/architecture\/adr\/0010-a2amesh-clean-start\.md$/,
  /^docs\/audits\/a2amesh-clean-start-report\.md$/,
  /^docs\/roadmap\/open-issues-triage-2026-06-27\.md$/,
  /^docs\/migrating\/.*\.md$/,
  /^CHANGELOG\.md$/,
  /\/CHANGELOG\.md$/,
  /^scripts\/check-identity\.mjs$/,
  /^scripts\/check-package-names\.mjs$/,
  /^tests\//,
];

const failures = [];
for (const file of listFiles()) {
  if (!isTextFile(file)) continue;
  if (allowedHistoricalPaths.some((rule) => rule.test(file))) continue;
  const text = readText(file);
  for (const pattern of forbidden) {
    pattern.lastIndex = 0;
    const match = pattern.exec(text);
    if (match) failures.push(`${file}: ${match[0]}`);
  }
}

if (failures.length > 0) fail('Stale identity references found.', failures.slice(0, 100));
