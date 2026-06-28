import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(
  new URL('../../scripts/check-powershell-doc-parity.mjs', import.meta.url),
);
const tempRoots: string[] = [];

describe('PowerShell docs parity check', () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
    );
  });

  it('does not let a shell block reuse the next shell block PowerShell counterpart', async () => {
    const workspace = await createDocsWorkspace({
      'README.md': [
        '# Fixture',
        '',
        '```bash',
        'pnpm install',
        '```',
        '',
        '```bash',
        'pnpm run test',
        '```',
        '',
        '```powershell',
        'pnpm run test',
        '```',
        '',
      ].join('\n'),
    });

    await expect(execDocsCheck(workspace)).rejects.toMatchObject({
      stderr: expect.stringContaining(
        'README.md:3: shell command block needs a nearby PowerShell block',
      ),
    });
  });

  it('accepts shell command blocks with their own nearby PowerShell counterparts', async () => {
    const workspace = await createDocsWorkspace();

    await expect(execDocsCheck(workspace)).resolves.toBeDefined();
  });
});

async function execDocsCheck(workspace: string) {
  return execFileAsync('node', [scriptPath], { cwd: workspace });
}

async function createDocsWorkspace(overrides: Record<string, string> = {}) {
  const workspace = await mkdtemp(join(tmpdir(), 'a2amesh-docs-parity-'));
  tempRoots.push(workspace);
  await mkdir(join(workspace, 'docs/cli'), { recursive: true });

  const defaultDoc = [
    '# Fixture',
    '',
    '```bash',
    'pnpm run verify',
    '```',
    '',
    '```powershell',
    'pnpm run verify',
    '```',
    '',
  ].join('\n');

  const docs = {
    'README.md': defaultDoc,
    'CONTRIBUTING.md': defaultDoc,
    'docs/development/setup.md': defaultDoc,
    'docs/development/testing.md': defaultDoc,
    'docs/release/process.md': defaultDoc,
    ...overrides,
  };

  await Promise.all(
    Object.entries(docs).map(async ([path, text]) => {
      await mkdir(dirname(join(workspace, path)), { recursive: true });
      await writeFile(join(workspace, path), text, 'utf8');
    }),
  );

  return workspace;
}
