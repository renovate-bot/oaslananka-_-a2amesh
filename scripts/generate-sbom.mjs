import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { getWorkspacePackages } from './check-utils.mjs';

const defaultSbomPath = '.artifacts/sbom/a2amesh.cdx.json';

function packagePurl(name, version) {
  if (name.startsWith('@')) {
    const [scope, packageName] = name.split('/');
    return `pkg:npm/${encodeURIComponent(scope)}/${encodeURIComponent(packageName)}@${encodeURIComponent(version)}`;
  }
  return `pkg:npm/${encodeURIComponent(name)}@${encodeURIComponent(version)}`;
}

function licensesFor(packageJson) {
  return typeof packageJson.license === 'string'
    ? [
        {
          license: {
            id: packageJson.license,
          },
        },
      ]
    : undefined;
}

function packageComponent(entry) {
  const { packageJson } = entry;
  const component = {
    type: 'library',
    'bom-ref': `${packageJson.name}@${packageJson.version}`,
    name: packageJson.name,
    version: packageJson.version,
    purl: packagePurl(packageJson.name, packageJson.version),
  };
  const licenses = licensesFor(packageJson);
  return licenses ? { ...component, licenses } : component;
}

function buildWorkspaceSbom() {
  const rootPackage = getWorkspacePackages().find((entry) => entry.path === 'package.json');
  const components = getWorkspacePackages()
    .filter((entry) => entry.path !== 'package.json' && entry.packageJson.private !== true)
    .map(packageComponent)
    .sort((left, right) => left.name.localeCompare(right.name));
  const rootComponent = rootPackage
    ? {
        type: 'application',
        'bom-ref': `${rootPackage.packageJson.name}@${rootPackage.packageJson.version}`,
        name: rootPackage.packageJson.name,
        version: rootPackage.packageJson.version,
        purl: packagePurl(rootPackage.packageJson.name, rootPackage.packageJson.version),
      }
    : undefined;

  return {
    $schema: 'http://cyclonedx.org/schema/bom-1.6.schema.json',
    bomFormat: 'CycloneDX',
    specVersion: '1.6',
    version: 1,
    metadata: {
      tools: {
        components: [
          {
            type: 'application',
            name: 'scripts/generate-sbom.mjs',
            version: '1.0.0',
          },
        ],
      },
      ...(rootComponent ? { component: rootComponent } : {}),
    },
    components,
    dependencies: [
      ...(rootComponent
        ? [
            {
              ref: rootComponent['bom-ref'],
              dependsOn: components.map((component) => component['bom-ref']),
            },
          ]
        : []),
      ...components.map((component) => ({
        ref: component['bom-ref'],
        dependsOn: [],
      })),
    ],
  };
}

export async function generateSbom(outputPath = defaultSbomPath) {
  const sbom = buildWorkspaceSbom();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(sbom, null, 2)}\n`);
  return sbom;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await generateSbom();
}
