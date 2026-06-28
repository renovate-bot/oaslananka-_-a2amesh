import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

const commandModules = [
  'send',
  'task',
  'registry',
  'health',
  'validate',
  'monitor',
  'benchmark',
  'conformance',
  'conformance-badge',
  'doctor',
  'export-card',
];

const dedicatedCommandTests = [
  'benchmark-command.test.ts',
  'conformance-badge-command.test.ts',
  'conformance-command.test.ts',
  'discover-command.test.ts',
  'doctor-command.test.ts',
  'export-card-command.test.ts',
  'health-command.test.ts',
  'monitor-command.test.ts',
  'registry-command.test.ts',
  'scaffold-command.test.ts',
  'send-command.test.ts',
  'task-command.test.ts',
  'validate-command.test.ts',
];

describe('CLI command module structure', () => {
  it('keeps the root entrypoint focused on program construction and registration', () => {
    const source = readFileSync(resolve(repoRoot, 'packages/cli/src/index.ts'), 'utf8');

    expect(source.split('\n').length).toBeLessThanOrEqual(150);
    expect(source).not.toContain("from '@a2amesh/runtime'");
    expect(source).not.toContain("from '@a2amesh/registry'");
    expect(source).not.toContain("from 'chalk'");
    expect(source).not.toContain("from 'ora'");
  });

  it('has a module and dedicated test file for each CLI command refactor target', () => {
    for (const command of commandModules) {
      expect(existsSync(resolve(repoRoot, `packages/cli/src/commands/${command}.ts`))).toBe(true);
    }

    for (const testFile of dedicatedCommandTests) {
      expect(existsSync(resolve(repoRoot, `packages/cli/tests/${testFile}`))).toBe(true);
    }
  });
});
