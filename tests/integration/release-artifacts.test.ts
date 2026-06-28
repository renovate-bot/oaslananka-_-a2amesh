import { execFile } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const repoRoot = new URL('../..', import.meta.url);
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

function runPnpm(args: string[]) {
  if (process.platform === 'win32') {
    return execFileAsync('cmd.exe', ['/d', '/s', '/c', pnpmCommand, ...args], {
      cwd: repoRoot,
    });
  }
  return execFileAsync(pnpmCommand, args, {
    cwd: repoRoot,
  });
}

describe('release artifact validation', () => {
  beforeEach(async () => {
    await rm(new URL('.artifacts', repoRoot), { force: true, recursive: true });
  });

  afterEach(async () => {
    await rm(new URL('.artifacts', repoRoot), { force: true, recursive: true });
  });

  it('fails when package tarballs are missing SHA256SUMS', async () => {
    await mkdir(new URL('.artifacts/npm', repoRoot), { recursive: true });
    await mkdir(new URL('.artifacts/sbom', repoRoot), { recursive: true });
    await writeFile(new URL('.artifacts/npm/a2amesh-test-1.0.0.tgz', repoRoot), 'fixture');
    await writeFile(
      new URL('.artifacts/sbom/a2amesh.cdx.json', repoRoot),
      JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.6', components: [] }),
    );

    await expect(
      execFileAsync('node', ['scripts/validate-release-config.mjs'], {
        cwd: repoRoot,
      }),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining('SHA256SUMS'),
    });
  });

  it('fails when the CycloneDX SBOM is missing', async () => {
    await mkdir(new URL('.artifacts/npm', repoRoot), { recursive: true });
    await writeFile(new URL('.artifacts/npm/a2amesh-test-1.0.0.tgz', repoRoot), 'fixture');
    await writeFile(
      new URL('.artifacts/npm/SHA256SUMS', repoRoot),
      'f16d05ec6b29248d2c61adb1e9263f78e4f7bace1b955014a2d17872cfe4064d  a2amesh-test-1.0.0.tgz\n',
    );

    await expect(
      execFileAsync('node', ['scripts/validate-release-config.mjs'], {
        cwd: repoRoot,
      }),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining('a2amesh.cdx.json'),
    });
  });

  it('fails when SHA256SUMS does not match package tarballs', async () => {
    await mkdir(new URL('.artifacts/npm', repoRoot), { recursive: true });
    await mkdir(new URL('.artifacts/sbom', repoRoot), { recursive: true });
    await writeFile(new URL('.artifacts/npm/a2amesh-test-1.0.0.tgz', repoRoot), 'fixture');
    await writeFile(
      new URL('.artifacts/npm/SHA256SUMS', repoRoot),
      '0000000000000000000000000000000000000000000000000000000000000000  a2amesh-test-1.0.0.tgz\n',
    );
    await writeFile(
      new URL('.artifacts/sbom/a2amesh.cdx.json', repoRoot),
      JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.6', components: [] }),
    );

    await expect(
      execFileAsync('node', ['scripts/validate-release-config.mjs'], {
        cwd: repoRoot,
      }),
    ).rejects.toMatchObject({
      stderr: expect.stringContaining('checksum'),
    });
  });

  it('generates a CycloneDX SBOM during release artifact preparation', async () => {
    await runPnpm(['run', 'release:artifacts']);

    const sbom = JSON.parse(
      await readFile(new URL('.artifacts/sbom/a2amesh.cdx.json', repoRoot), 'utf8'),
    );
    expect(sbom).toMatchObject({
      bomFormat: 'CycloneDX',
      specVersion: '1.6',
    });
    expect(sbom.components).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: '@a2amesh/runtime' }),
        expect.objectContaining({ name: '@a2amesh/cli' }),
      ]),
    );
  }, 120_000);

  it('generates SHA256SUMS for prepared release tarballs', async () => {
    await runPnpm(['run', 'release:artifacts']);

    const tarballs = (await readdir(new URL('.artifacts/npm', repoRoot)))
      .filter((entry) => entry.endsWith('.tgz'))
      .sort();
    const checksums = await readFile(new URL('.artifacts/npm/SHA256SUMS', repoRoot), 'utf8');

    expect(tarballs.length).toBeGreaterThan(0);
    for (const tarball of tarballs) {
      expect(checksums).toContain(`  ${tarball}\n`);
    }
    expect(checksums.trim().split('\n')).toEqual(
      expect.arrayContaining([expect.stringMatching(/^[a-f0-9]{64} {2}.+\.tgz$/)]),
    );
  }, 120_000);
});
