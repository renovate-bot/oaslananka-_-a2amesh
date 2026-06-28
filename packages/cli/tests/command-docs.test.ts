import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createProgram } from '../src/index.js';

const repoRoot = resolve(import.meta.dirname, '../../..');

function readRepoFile(path: string): string {
  return readFileSync(resolve(repoRoot, path), 'utf8');
}

function topLevelCommandNames(): string[] {
  return createProgram()
    .commands.map((command) => command.name())
    .sort();
}

describe('generated CLI command documentation', () => {
  it('generates command docs from the live Commander program instead of source-string checks', () => {
    const generator = readRepoFile('scripts/generate-command-docs.mjs');

    expect(generator).toContain('createProgram');
    expect(generator).not.toContain("readFileSync('packages/cli/src/index.ts'");
    expect(generator).not.toContain("const commands = ['validate'");
  });

  it('keeps the command docs generator portable across shells and line endings', () => {
    const generator = readRepoFile('scripts/generate-command-docs.mjs');

    expect(generator).toContain("import { runPnpmSync } from './check-utils.mjs'");
    expect(generator).toContain('runPnpmSync([');
    expect(generator).toContain('function renderMarkdownTableCell');
    expect(generator).toContain("replace(/\\\\/g, '\\\\\\\\')");
    expect(generator).toContain("replace(/\\r?\\n/g, ' ')");
    expect(generator).toContain("replace(/\\|/g, '\\\\|')");
    expect(generator).toContain('function normalizeLineEndings');
    expect(generator).toContain("replace(/\\r\\n/g, '\\n')");
  });

  it('keeps generated help output independent of the current terminal width', () => {
    const generator = readRepoFile('scripts/generate-command-docs.mjs');

    expect(generator).toContain('const cliDocsHelpWidth = 100');
    expect(generator).toContain('function configureDeterministicHelp');
    expect(generator).toContain('configureHelp({ helpWidth: cliDocsHelpWidth })');
    expect(generator).toContain('configureDeterministicHelp(createProgram())');
  });

  it('keeps canonical and docs-site command pages in parity with live CLI commands', () => {
    for (const commandName of topLevelCommandNames()) {
      const canonicalPath = `docs/cli/${commandName}.md`;
      const docsSitePath = `docs-site/cli/${commandName}.md`;

      expect(existsSync(resolve(repoRoot, canonicalPath)), `${canonicalPath} missing`).toBe(true);
      expect(existsSync(resolve(repoRoot, docsSitePath)), `${docsSitePath} missing`).toBe(true);

      for (const path of [canonicalPath, docsSitePath]) {
        const text = readRepoFile(path);
        expect(text).toContain(`# a2amesh ${commandName}`);
        expect(text).toContain('<!-- Synced from scripts/generate-command-docs.mjs. -->');
        expect(text).toContain('```bash');
        expect(text).toContain('```powershell');
      }
    }
  });
});
