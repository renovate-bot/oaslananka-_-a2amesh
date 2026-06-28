import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { generateSbom } from './generate-sbom.mjs';

const execFileAsync = promisify(execFile);
const artifactDir = '.artifacts';
const npmArtifactDir = '.artifacts/npm';
const pnpmExecPath = process.env.npm_execpath;
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

async function runPnpm(args) {
  if (pnpmExecPath) {
    await execFileAsync(process.execPath, [pnpmExecPath, ...args], {
      maxBuffer: 10 * 1024 * 1024,
    });
    return;
  }

  const file = process.platform === 'win32' ? 'cmd.exe' : pnpmCommand;
  const commandArgs =
    process.platform === 'win32' ? ['/d', '/s', '/c', pnpmCommand, ...args] : args;
  await execFileAsync(file, commandArgs, {
    maxBuffer: 10 * 1024 * 1024,
  });
}

async function listTarballs(dir) {
  const entries = await readdir(dir);
  return entries.filter((entry) => entry.endsWith('.tgz')).sort();
}

async function readTarballVersion(tarballPath) {
  // Extract version via tar pipe to node — avoids temp file
  const { execFileSync } = await import('node:child_process');
  const pkgJson = JSON.parse(
    execFileSync('tar', ['-xOzf', tarballPath, 'package/package.json'], {
      encoding: 'utf-8',
      maxBuffer: 64 * 1024,
      stdio: ['pipe', 'pipe', 'ignore'],
    }),
  );
  return pkgJson.version;
}

async function pruneNonMatchingPackages(dir, expectedVersion) {
  const tarballs = await listTarballs(dir);
  let kept = 0;
  let pruned = 0;
  for (const tarball of tarballs) {
    const tarballPath = join(dir, tarball);
    const version = await readTarballVersion(tarballPath);
    if (version !== expectedVersion) {
      await rm(tarballPath);
      console.warn(
        `[prune] removed ${tarball} (version ${version} !== expected ${expectedVersion})`,
      );
      pruned++;
    } else {
      kept++;
    }
  }
  console.log(`[prune] kept ${kept} package(s), removed ${pruned} mismatched package(s)`);
}

async function writeChecksums(dir) {
  const tarballs = await listTarballs(dir);
  if (tarballs.length === 0) {
    throw new Error(`${dir} must contain release package tarballs before checksums are written`);
  }

  const lines = [];
  for (const tarball of tarballs) {
    const content = await readFile(join(dir, tarball));
    const hash = createHash('sha256').update(content).digest('hex');
    lines.push(`${hash}  ${tarball}`);
  }
  await writeFile(join(dir, 'SHA256SUMS'), `${lines.join('\n')}\n`);
}

await rm(artifactDir, { force: true, recursive: true });
await mkdir(npmArtifactDir, { recursive: true });
await runPnpm([
  '-r',
  '--filter',
  '@a2amesh/protocol',
  '--filter',
  '@a2amesh/runtime',
  '--filter',
  '@a2amesh/registry',
  '--filter',
  '@a2amesh/mcp',
  '--filter',
  '@a2amesh/cli',
  '--filter',
  'create-a2amesh',
  'pack',
  '--pack-destination',
  npmArtifactDir,
]);
// Only the six approved public packages are packed. Internal workspaces remain private.

// Checksums must be written after all tarballs are generated.
await writeChecksums(npmArtifactDir);
await generateSbom();
