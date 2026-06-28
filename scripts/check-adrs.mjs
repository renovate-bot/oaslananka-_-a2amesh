import { readText, fail } from './check-utils.mjs';

const adrDir = 'docs/architecture/adr';
const adrIndexPath = `${adrDir}/index.md`;

const requiredAdrs = [
  {
    number: '0004',
    title: 'Storage semantics',
    path: `${adrDir}/0004-storage-semantics.md`,
  },
  {
    number: '0005',
    title: 'Transport contracts',
    path: `${adrDir}/0005-transport-contracts.md`,
  },
  {
    number: '0006',
    title: 'Outbound network policy',
    path: `${adrDir}/0006-outbound-network-policy.md`,
  },
  {
    number: '0007',
    title: 'Release provenance',
    path: `${adrDir}/0007-release-provenance.md`,
  },
  {
    number: '0008',
    title: 'Protocol conformance versioning',
    path: `${adrDir}/0008-protocol-conformance-versioning.md`,
  },
];

const requiredSections = [
  '## Status',
  '## Context',
  '## Decision',
  '## Consequences',
  '## Validation Commands',
];

const requiredValidationCommands = ['pnpm run lint:md', 'pnpm run docs:build'];

const failures = [];

function readRequiredDoc(path) {
  try {
    return readText(path);
  } catch (error) {
    failures.push(`${path} is missing or unreadable: ${String(error)}`);
    return null;
  }
}

const adrIndex = readRequiredDoc(adrIndexPath);

for (const adr of requiredAdrs) {
  const text = readRequiredDoc(adr.path);
  const fileName = adr.path.split('/').at(-1);
  const indexEntry = `[ADR-${adr.number}: ${adr.title}](${fileName})`;

  if (adrIndex !== null && !adrIndex.includes(indexEntry)) {
    failures.push(`${adrIndexPath} missing entry: ${indexEntry}`);
  }

  if (text === null) continue;

  if (!text.includes(`# ADR-${adr.number}:`)) {
    failures.push(`${adr.path} missing ADR title for ADR-${adr.number}`);
  }

  for (const section of requiredSections) {
    if (!text.includes(section)) {
      failures.push(`${adr.path} missing section: ${section}`);
    }
  }

  for (const command of requiredValidationCommands) {
    if (!text.includes(command)) {
      failures.push(`${adr.path} missing validation command: ${command}`);
    }
  }
}

if (failures.length > 0) fail('ADR documentation validation failed.', failures);
