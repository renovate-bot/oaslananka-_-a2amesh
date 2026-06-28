import { mkdtemp, mkdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { discoverAgent } from '../src/commands/discover.js';
import { scaffoldAgent } from '../src/commands/scaffold.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

async function readJsonFile<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T;
}

type PackageJson = {
  version: string;
  packageManager?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

type RuntimeVersions = {
  node: string;
  pnpm: string;
  nodeDockerAlpineDigest: string;
};

describe('discoverAgent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('prints agent details when JSON mode is disabled', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          protocolVersion: '1.0',
          name: 'Writer Agent',
          description: 'Writes polished drafts',
          url: 'http://localhost:4000',
          version: '1.0.0',
          skills: [{ id: 'draft', name: 'Drafting', tags: ['writing', 'summary'] }],
        }),
        { status: 200 },
      ),
    );
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    const card = await discoverAgent('http://localhost:4000');

    expect(card.name).toBe('Writer Agent');
    const output = writeSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(output).toContain('Discovered Agent Card for: Writer Agent v1.0.0');
    expect(output).toContain('Drafting [writing, summary]');
  });

  it('suppresses terminal output when JSON mode is enabled', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          protocolVersion: '1.0',
          name: 'Quiet Agent',
          description: 'Returns data only',
          url: 'http://localhost:4100',
          version: '1.0.0',
        }),
        { status: 200 },
      ),
    );
    const writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await discoverAgent('http://localhost:4100', { json: true });

    expect(writeSpy).not.toHaveBeenCalled();
  });
});

describe('scaffoldAgent', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the custom template with auth, rate limiting and Docker support', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'a2a-scaffold-custom-'));
    const previousCwd = process.cwd();
    process.chdir(tempDir);

    try {
      scaffoldAgent('custom-agent', {
        adapter: 'custom',
        auth: true,
        rateLimit: true,
        docker: true,
      });
    } finally {
      process.chdir(previousCwd);
    }

    const packageJson = await readFile(join(tempDir, 'custom-agent', 'package.json'), 'utf8');
    const readme = await readFile(join(tempDir, 'custom-agent', 'README.md'), 'utf8');
    const envExample = await readFile(join(tempDir, 'custom-agent', '.env.example'), 'utf8');
    const agentSource = await readFile(join(tempDir, 'custom-agent', 'src', 'agent.ts'), 'utf8');
    const dockerfile = await readFile(join(tempDir, 'custom-agent', 'Dockerfile'), 'utf8');

    expect(packageJson).toContain('"@a2amesh/runtime"');
    expect(packageJson).toContain('"@a2amesh/protocol"');
    expect(packageJson).not.toContain('@a2amesh/internal-');
    expect(readme).toContain('pnpm install');
    expect(envExample).toContain('A2A_API_KEY=your-secure-api-key-here');
    expect(agentSource).toContain("name: 'x-api-key'");
    expect(agentSource).toContain('maxRequests: 100');
    expect(dockerfile).toContain('FROM node:24-alpine@sha256:');
  });

  it('renders package versions from workspace manifests and runtime pins', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'a2a-scaffold-versions-'));
    const previousCwd = process.cwd();
    process.chdir(tempDir);

    try {
      scaffoldAgent('alpha-agent', {
        adapter: 'custom',
        auth: false,
        rateLimit: false,
        docker: false,
      });
    } finally {
      process.chdir(previousCwd);
    }

    const runtime = await readJsonFile<RuntimeVersions>(
      join(repoRoot, 'tools', 'runtime-versions.json'),
    );
    const rootPackage = await readJsonFile<PackageJson>(join(repoRoot, 'package.json'));
    const protocolPackage = await readJsonFile<PackageJson>(
      join(repoRoot, 'packages', 'protocol', 'package.json'),
    );
    const runtimePackage = await readJsonFile<PackageJson>(
      join(repoRoot, 'packages', 'runtime', 'package.json'),
    );
    const demoPackage = await readJsonFile<PackageJson>(
      join(repoRoot, 'apps', 'demo', 'package.json'),
    );

    const generatedPackage = await readJsonFile<PackageJson>(
      join(tempDir, 'alpha-agent', 'package.json'),
    );

    expect(generatedPackage.packageManager).toBe(`pnpm@${runtime.pnpm}`);
    expect(generatedPackage.dependencies).toEqual({
      '@a2amesh/protocol': `^${protocolPackage.version}`,
      '@a2amesh/runtime': `^${runtimePackage.version}`,
    });
    expect(generatedPackage.devDependencies).toMatchObject({
      '@types/node': rootPackage.devDependencies?.['@types/node'],
      tsx: demoPackage.devDependencies?.['tsx'],
      typescript: rootPackage.devDependencies?.['typescript'],
    });
  });

  it('renders Dockerfile runtime details from the runtime manifest', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'a2a-scaffold-docker-'));
    const previousCwd = process.cwd();
    process.chdir(tempDir);

    try {
      scaffoldAgent('docker-agent', {
        adapter: 'custom',
        auth: false,
        rateLimit: false,
        docker: true,
      });
    } finally {
      process.chdir(previousCwd);
    }

    const runtime = await readJsonFile<RuntimeVersions>(
      join(repoRoot, 'tools', 'runtime-versions.json'),
    );
    const nodeMajor = runtime.node.split('.')[0];
    const dockerfile = await readFile(join(tempDir, 'docker-agent', 'Dockerfile'), 'utf8');

    expect(runtime.nodeDockerAlpineDigest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(dockerfile).toContain(
      `# node:${nodeMajor}-alpine digest from tools/runtime-versions.json: ${runtime.nodeDockerAlpineDigest}`,
    );
    expect(dockerfile).toContain(`FROM node:${nodeMajor}-alpine@${runtime.nodeDockerAlpineDigest}`);
    expect(dockerfile).toContain(`corepack prepare pnpm@${runtime.pnpm} --activate`);
    expect(dockerfile).toContain('pnpm install --frozen-lockfile');
    expect(dockerfile).toMatch(/USER node\s+CMD \["pnpm", "run", "start"\]/);
  });

  it('refuses to overwrite an existing directory', async () => {
    const tempDir = await mkdtemp(join(tmpdir(), 'a2a-scaffold-existing-'));
    const previousCwd = process.cwd();
    process.chdir(tempDir);

    try {
      await mkdir(join(tempDir, 'existing-agent'));
      const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
        throw new Error(`exit:${code ?? 0}`);
      }) as never);

      expect(() =>
        scaffoldAgent('existing-agent', {
          adapter: 'custom',
          auth: false,
          rateLimit: false,
          docker: false,
        }),
      ).toThrow('exit:1');
      expect(exitSpy).toHaveBeenCalledWith(1);
      expect(stderrSpy).toHaveBeenCalledWith('Directory existing-agent already exists.\n');
    } finally {
      process.chdir(previousCwd);
    }
  });
});
