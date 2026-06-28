/**
 * Validate that pnpm-workspace.yaml is the single source of truth
 * for workspace package declarations and that all patterns resolve.
 *
 * This script runs as part of verify:structure.
 * Uses git ls-files to discover workspace contents (matching repo convention).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { listFiles, readJson, fail } from './check-utils.mjs';

// ── 1. pnpm-workspace.yaml must exist and be parseable ────────────────────
if (!existsSync('pnpm-workspace.yaml')) {
  fail('pnpm-workspace.yaml not found — it must be the canonical workspace source.');
  process.exit(1);
}

const raw = readFileSync('pnpm-workspace.yaml', 'utf8');

// Extract the packages list from YAML (simple line-based parse)
const lines = raw.split('\n');
const packagePatterns = [];
let inPackages = false;
for (const line of lines) {
  if (line.trim() === 'packages:') {
    inPackages = true;
    continue;
  }
  if (inPackages) {
    if (/^\s+-/.test(line)) {
      const pattern = line.replace(/^\s*-\s*/, '').trim();
      packagePatterns.push(pattern);
    } else if (/^[a-z]/.test(line.trim()) && line.trim().endsWith(':')) {
      inPackages = false;
    }
  }
}

if (packagePatterns.length === 0) {
  fail('pnpm-workspace.yaml packages list is empty.');
}

// ── 2. Root package.json must NOT have a workspaces field ─────────────────
const rootPkg = readJson('package.json');
if (rootPkg.workspaces) {
  fail(
    'Root package.json must not contain a "workspaces" field; ' +
      'pnpm-workspace.yaml is the single source of truth.',
  );
}

// ── 3. Build a set of expected workspace directories from git-tracked files
const allFiles = listFiles();
const workspaceDirs = new Set();

// Map pnpm patterns to their expanded directories
const patternExpansions = {
  'packages/*': () => {
    const dirs = new Set();
    for (const f of allFiles) {
      const m = f.match(/^packages\/([^/]+)\/package\.json$/);
      if (m) dirs.add(`packages/${m[1]}`);
    }
    return [...dirs].sort();
  },
  'apps/*': () => {
    const dirs = new Set();
    for (const f of allFiles) {
      const m = f.match(/^apps\/([^/]+)\/package\.json$/);
      if (m) dirs.add(`apps/${m[1]}`);
    }
    return [...dirs].sort();
  },
  'examples/*': () => {
    const dirs = new Set();
    for (const f of allFiles) {
      const m = f.match(/^examples\/([^/]+)\/package\.json$/);
      if (m) dirs.add(`examples/${m[1]}`);
    }
    return [...dirs].sort();
  },
};

const defaultMatch = (pattern) => {
  if (!pattern.includes('*') && !pattern.includes('?')) {
    if (existsSync(`${pattern}/package.json`)) return [pattern];
    return [];
  }
  return [];
};

// ── 4. Verify each pattern and collect workspace directories ──────────────
const failures = [];
const allWorkspaceDirs = [];

for (const pattern of packagePatterns) {
  let dirs;
  if (patternExpansions[pattern]) {
    dirs = patternExpansions[pattern]();
  } else {
    dirs = defaultMatch(pattern);
  }

  if (dirs.length === 0) {
    failures.push(`pnpm-workspace.yaml pattern "${pattern}" matched zero workspace directories`);
  }
  for (const d of dirs) {
    allWorkspaceDirs.push(d);
    workspaceDirs.add(d);
  }
}

// ── 5. Every matched directory must have a package.json ───────────────────
for (const dir of allWorkspaceDirs) {
  if (!existsSync(`${dir}/package.json`)) {
    failures.push(`Workspace directory "${dir}" is missing a package.json`);
  }
}

// ── 6. Check for package.json files in workspace that are NOT covered ─────
const uncovered = [];
for (const f of allFiles) {
  if (f.endsWith('/package.json') && f !== 'package.json') {
    const dir = dirname(f);
    const isInWorkspaceRoot = packagePatterns.some((pattern) => {
      const basePattern = pattern.replace('/*', '');
      return dir.startsWith(basePattern) || dir === pattern;
    });
    if (isInWorkspaceRoot && !workspaceDirs.has(dir)) {
      uncovered.push(dir);
    }
  }
}

if (uncovered.length > 0) {
  failures.push(
    `Directories with package.json not covered by pnpm-workspace.yaml: ${uncovered.join(', ')}`,
  );
}

// ── Report ────────────────────────────────────────────────────────────────
if (failures.length > 0) {
  fail('Workspace declaration validation failed.', failures);
}

console.log(
  `Workspace declaration validation passed: ${packagePatterns.length} patterns, ${workspaceDirs.size} workspace directories.`,
);
