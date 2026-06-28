import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { getWorkspacePackages } from './check-utils.mjs';

const config = JSON.parse(await readFile('release-please-config.json', 'utf8'));
const manifest = JSON.parse(await readFile('.release-please-manifest.json', 'utf8'));

if (config['release-type'] !== 'node') {
  throw new Error('release-please-config.json must use node release type');
}

if (!config.packages || typeof config.packages !== 'object') {
  throw new Error('release-please-config.json must define manifest packages');
}

const configuredPackagesByName = new Map();
for (const [packagePath, packageConfig] of Object.entries(config.packages)) {
  const packageJson = JSON.parse(await readFile(`${packagePath}/package.json`, 'utf8'));
  if (packageConfig['package-name'] !== packageJson.name) {
    throw new Error(`${packagePath} package-name does not match package.json name`);
  }
  if (!manifest[packagePath]) {
    throw new Error(`${packagePath} is missing from .release-please-manifest.json`);
  }
  if (manifest[packagePath] !== packageJson.version) {
    throw new Error(`${packagePath} manifest version does not match package.json version`);
  }
  configuredPackagesByName.set(packageJson.name, {
    path: packagePath,
    version: packageJson.version,
  });
}

const publishableWorkspacePackages = new Map(
  getWorkspacePackages()
    .filter(
      ({ dir, packageJson }) =>
        packageJson.private !== true &&
        dir.startsWith('packages/') &&
        typeof packageJson.name === 'string' &&
        typeof packageJson.version === 'string',
    )
    .map(({ packageJson }) => [
      packageJson.name,
      {
        version: packageJson.version,
      },
    ]),
);

const npmArtifactDir = '.artifacts/npm';
const npmArtifacts = await readdir(npmArtifactDir);
const packageTarballs = npmArtifacts.filter((entry) => entry.endsWith('.tgz')).sort();
if (packageTarballs.length === 0) {
  throw new Error(`${npmArtifactDir} must contain release package tarballs`);
}

const checksumPath = `${npmArtifactDir}/SHA256SUMS`;
let checksumText;
try {
  checksumText = await readFile(checksumPath, 'utf8');
} catch (error) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
    throw new Error(`release artifacts must include ${checksumPath}`);
  }
  throw error;
}

const checksums = new Map();
for (const line of checksumText.trim().split('\n').filter(Boolean)) {
  const match = /^([a-f0-9]{64}) {2}(.+\.tgz)$/.exec(line);
  if (!match) {
    throw new Error(`${checksumPath} contains an invalid checksum entry: ${line}`);
  }
  checksums.set(match[2], match[1]);
}

for (const tarball of packageTarballs) {
  const expectedChecksum = checksums.get(tarball);
  if (!expectedChecksum) {
    throw new Error(`${checksumPath} is missing checksum for ${tarball}`);
  }
  const actualChecksum = createHash('sha256')
    .update(await readFile(join(npmArtifactDir, tarball)))
    .digest('hex');
  if (actualChecksum !== expectedChecksum) {
    throw new Error(`${checksumPath} checksum mismatch for ${tarball}`);
  }
}

for (const tarball of checksums.keys()) {
  if (!packageTarballs.includes(tarball)) {
    throw new Error(`${checksumPath} references missing tarball ${tarball}`);
  }
}

const sbomPath = '.artifacts/sbom/a2amesh.cdx.json';
let sbomText;
try {
  sbomText = await readFile(sbomPath, 'utf8');
} catch (error) {
  if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
    throw new Error(`release artifacts must include ${sbomPath}`);
  }
  throw error;
}

const sbom = JSON.parse(sbomText);
if (sbom.bomFormat !== 'CycloneDX') {
  throw new Error(`${sbomPath} must be a CycloneDX SBOM`);
}

const tarballPackagesByName = new Map();
for (const tarball of packageTarballs) {
  const packageJson = await readTarballPackageJson(join(npmArtifactDir, tarball));
  const workspacePackage = publishableWorkspacePackages.get(packageJson.name);
  if (!workspacePackage) {
    throw new Error(`${tarball} contains unknown package ${packageJson.name}`);
  }
  if (packageJson.version !== workspacePackage.version) {
    throw new Error(
      `${tarball} contains ${packageJson.name}@${packageJson.version}, expected local version ${workspacePackage.version}`,
    );
  }
  if (tarballPackagesByName.has(packageJson.name)) {
    throw new Error(`release artifacts contain duplicate package ${packageJson.name}`);
  }
  tarballPackagesByName.set(packageJson.name, {
    tarball,
    version: packageJson.version,
  });
}

for (const [packageName, expectedPackage] of configuredPackagesByName) {
  const artifact = tarballPackagesByName.get(packageName);
  if (!artifact) {
    throw new Error(`release artifacts are missing ${packageName}`);
  }
  if (artifact.version !== expectedPackage.version) {
    throw new Error(
      `${artifact.tarball} contains ${packageName}@${artifact.version}, expected manifest version ${expectedPackage.version}`,
    );
  }
}

console.log('release-please manifest configuration validated locally.');

async function readTarballPackageJson(tarballPath) {
  const archive = gunzipSync(await readFile(tarballPath));
  const content = extractTarEntry(archive, 'package/package.json');
  return JSON.parse(content.toString('utf8'));
}

function extractTarEntry(archive, expectedPath) {
  const blockSize = 512;
  let offset = 0;

  while (offset + blockSize <= archive.length) {
    const header = archive.subarray(offset, offset + blockSize);
    if (header.every((byte) => byte === 0)) break;

    const name = readTarHeaderString(header, 0, 100);
    const prefix = readTarHeaderString(header, 345, 155);
    const entryPath = prefix ? `${prefix}/${name}` : name;
    const sizeText = readTarHeaderString(header, 124, 12).trim();
    const size = sizeText ? Number.parseInt(sizeText, 8) : 0;
    const dataStart = offset + blockSize;
    const dataEnd = dataStart + size;

    if (entryPath === expectedPath) {
      return archive.subarray(dataStart, dataEnd);
    }

    offset = dataStart + Math.ceil(size / blockSize) * blockSize;
  }

  throw new Error(`release artifact tarball is missing ${expectedPath}`);
}

function readTarHeaderString(header, start, length) {
  const field = header.subarray(start, start + length);
  const end = field.indexOf(0);
  return field.subarray(0, end === -1 ? field.length : end).toString('utf8');
}
