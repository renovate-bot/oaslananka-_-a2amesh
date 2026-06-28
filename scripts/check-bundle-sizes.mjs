import { stat } from 'node:fs/promises';

const LIMITS = {
  '@a2amesh/runtime': 120_000,
  '@a2amesh/registry': 60_000,
  '@a2amesh/cli': 200_000,
};

const BUNDLE_LIMITS = [
  { name: '@a2amesh/runtime', path: 'packages/runtime/dist/index.js' },
  { name: '@a2amesh/registry', path: 'packages/registry/dist/index.js' },
  { name: '@a2amesh/cli', path: 'packages/cli/dist/index.js' },
];

let hasFailure = false;

for (const bundle of BUNDLE_LIMITS) {
  const maxSize = LIMITS[bundle.name];
  const info = await stat(bundle.path);
  const sizeKb = info.size / 1024;
  const maxSizeKb = maxSize / 1024;

  if (info.size > maxSize) {
    hasFailure = true;
    console.error(
      `Bundle size check failed for ${bundle.path}: ${sizeKb.toFixed(1)} kB > ${maxSizeKb.toFixed(1)} kB`,
    );
  } else {
    console.log(
      `Bundle size OK for ${bundle.path}: ${sizeKb.toFixed(1)} kB <= ${maxSizeKb.toFixed(1)} kB`,
    );
  }
}

if (hasFailure) {
  process.exitCode = 1;
}
