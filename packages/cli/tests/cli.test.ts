import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const nodePath = process.execPath;
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const cliEntry = resolve(repoRoot, 'packages', 'cli', 'dist', 'index.js');
const cliPackagePath = resolve(repoRoot, 'packages', 'cli', 'package.json');

async function readCliPackageVersion(): Promise<string> {
  const packageJson = JSON.parse(await readFile(cliPackagePath, 'utf8')) as { version: string };
  return packageJson.version;
}

describe('a2a CLI', () => {
  it('prints help output', async () => {
    const { stdout } = await execFileAsync(nodePath, [cliEntry, '--help'], {
      cwd: repoRoot,
    });

    expect(stdout).toContain('A2A Mesh developer CLI');
    expect(stdout).toContain('a2amesh');
    expect(stdout).toContain('send');
    expect(stdout).toContain('conformance');
    expect(stdout).toContain('doctor');
    expect(stdout).toContain('task');
    expect(stdout).toContain('registry');
  });

  it('prints the launch version', async () => {
    const expectedVersion = await readCliPackageVersion();
    const { stdout } = await execFileAsync(nodePath, [cliEntry, '--version'], {
      cwd: repoRoot,
    });

    expect(stdout.trim()).toBe(expectedVersion);
  });

  it('reports local doctor diagnostics as JSON', async () => {
    const expectedVersion = await readCliPackageVersion();
    const { stdout } = await execFileAsync(nodePath, [cliEntry, '--json', 'doctor'], {
      cwd: repoRoot,
    });

    const payload = JSON.parse(stdout);
    expect(payload.cli).toBe('a2amesh');
    expect(payload.version).toBe(expectedVersion);
    expect(payload.node).toMatch(/^v/);
    expect(payload.platform).toBe(process.platform);
  });

  it('accepts pnpm script argument separators before a command', async () => {
    const expectedVersion = await readCliPackageVersion();
    const { stdout } = await execFileAsync(nodePath, [cliEntry, '--', 'doctor', '--json'], {
      cwd: repoRoot,
    });

    const payload = JSON.parse(stdout);
    expect(payload.cli).toBe('a2amesh');
    expect(payload.version).toBe(expectedVersion);
  });

  it('validates an agent card and emits JSON', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'a2a-cli-validate-'));
    const cardPath = join(tempDir, 'agent-card.json');
    await writeFile(
      cardPath,
      JSON.stringify({
        protocolVersion: '0.3',
        name: 'Legacy Agent',
        description: 'desc',
        url: 'http://localhost:3000',
        version: '1.0.0',
      }),
      'utf8',
    );

    const { stdout } = await execFileAsync(nodePath, [cliEntry, '--json', 'validate', cardPath], {
      cwd: repoRoot,
    });

    const payload = JSON.parse(stdout);
    expect(payload.protocolVersion).toBe('1.0');
    expect(payload.name).toBe('Legacy Agent');
  }, 15000);

  it('initializes a new agent project', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'a2a-cli-scaffold-'));

    const { stdout } = await execFileAsync(nodePath, [cliEntry, 'init', 'sample-agent'], {
      cwd: tempDir,
    });

    expect(stdout).toContain('Scaffold complete!');

    const packageJson = await readFile(join(tempDir, 'sample-agent', 'package.json'), 'utf8');
    const tsconfigJson = await readFile(join(tempDir, 'sample-agent', 'tsconfig.json'), 'utf8');
    const agentFile = await readFile(join(tempDir, 'sample-agent', 'src', 'agent.ts'), 'utf8');
    const indexFile = await readFile(join(tempDir, 'sample-agent', 'src', 'index.ts'), 'utf8');
    expect(packageJson).toContain('"@a2amesh/runtime"');
    expect(packageJson).toContain('"@types/node"');
    const runtimeVersions = JSON.parse(
      await readFile(join(repoRoot, 'tools', 'runtime-versions.json'), 'utf8'),
    ) as { pnpm: string };
    expect(packageJson).toContain(`"packageManager": "pnpm@${runtimeVersions.pnpm}"`);
    expect(tsconfigJson).toContain('"types"');
    expect(tsconfigJson).toContain('"node"');
    expect(agentFile).toContain('A2AServer');
    expect(indexFile).toContain("import { createAgent } from './agent.js';");
  }, 15000);
});
