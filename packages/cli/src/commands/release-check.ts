import { execFileSync, type ExecFileSyncOptions } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Command } from 'commander';
import { emitResult, writeError, type RootOptionsProvider } from '../io.js';
import { applyCommandDoc, type CliCommandDoc } from './doc-metadata.js';

export const releaseCheckCommandDoc = {
  path: ['release-check'],
  summary: 'Check release readiness.',
  description:
    'Runs the full release readiness checklist: git worktree state, release config integrity, pack dry-run, schema generation, docs build, security audit, public surface, package registry parity, and release artifact validation. Exits non-zero if any check fails.',
  examples: [
    {
      title: 'Run release readiness checks.',
      bash: ['a2amesh release-check'],
      powershell: ['a2amesh release-check'],
    },
    {
      title: 'Emit machine-readable JSON report.',
      bash: ['a2amesh release-check --json'],
      powershell: ['a2amesh release-check --json'],
    },
  ],
} satisfies CliCommandDoc;

interface CheckResult {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
}

interface ReleaseCheckReport {
  command: 'release-check';
  checks: CheckResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    duration: number;
  };
  ready: boolean;
}

function findWorkspaceRoot(start: string): string | undefined {
  let dir = resolve(start);
  for (let i = 0; i < 20; i++) {
    if (existsSync(resolve(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = resolve(dir, '..');
    if (parent === dir) return undefined;
    dir = parent;
  }
  return undefined;
}

function runCheck(
  name: string,
  command: string,
  args: readonly string[],
  options: ExecFileSyncOptions,
): CheckResult {
  const start = performance.now();
  const file =
    process.platform === 'win32' && command.toLowerCase().endsWith('.cmd') ? 'cmd.exe' : command;
  // Quote the .cmd path so cmd.exe /c treats it as a single token even if
  // the absolute path contains spaces.  execFileSync already avoids a
  // shell, but /c still concatenates the remaining arguments into one
  // command line string.
  const commandArgs =
    process.platform === 'win32' && command.toLowerCase().endsWith('.cmd')
      ? ['/d', '/s', '/c', `"${command}"`, ...args]
      : args;
  try {
    execFileSync(file, commandArgs, { ...options, stdio: 'pipe', timeout: 120_000 });
    return { name, status: 'passed', duration: Math.round(performance.now() - start) };
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException & { stdout?: Buffer; stderr?: Buffer };
    const message = err.stderr?.toString().trim() || err.stdout?.toString().trim() || err.message;
    return {
      name,
      status: 'failed',
      duration: Math.round(performance.now() - start),
      error: message || 'Unknown error',
    };
  }
}

function runNodeScript(name: string, script: string, cwd: string): CheckResult {
  return runCheck(name, process.execPath, [script], { cwd });
}

function runPnpm(name: string, args: readonly string[], cwd: string): CheckResult {
  const pnpmExecPath = process.env['npm_execpath'];
  if (pnpmExecPath) {
    return runCheck(name, process.execPath, [pnpmExecPath, ...args], { cwd });
  }
  return runCheck(name, process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', args, { cwd });
}

function runGit(name: string, args: readonly string[], cwd: string): CheckResult {
  return runCheck(name, 'git', args, { cwd });
}

export function createReleaseCheckCommand(getOptions: RootOptionsProvider): Command {
  return applyCommandDoc(new Command('release-check'), releaseCheckCommandDoc).action(() => {
    const options = getOptions();
    const workspaceRoot = findWorkspaceRoot(process.cwd());

    if (!workspaceRoot) {
      writeError('Could not find workspace root (pnpm-workspace.yaml)');
      process.exitCode = 1;
      return;
    }

    const checks: CheckResult[] = [];

    // 1. Git worktree state
    {
      const gitCheck = runGit('Git worktree clean', ['status', '--porcelain'], workspaceRoot);
      checks.push({ ...gitCheck, name: 'Git worktree clean' });
    }

    // 2. Release config integrity
    checks.push(
      runNodeScript(
        'Release config',
        resolve(workspaceRoot, 'scripts/check-release-config.mjs'),
        workspaceRoot,
      ),
    );

    // 3. Pack dry-run
    checks.push(
      runNodeScript(
        'Pack dry-run',
        resolve(workspaceRoot, 'scripts/check-npm-pack.mjs'),
        workspaceRoot,
      ),
    );

    {
      const schemaBuild = runPnpm(
        'Schema core build',
        ['--filter', '@a2amesh/runtime', 'run', 'build'],
        workspaceRoot,
      );
      checks.push(schemaBuild);

      if (schemaBuild.status === 'passed') {
        checks.push(
          runNodeScript(
            'Schema generation',
            resolve(workspaceRoot, 'scripts/generate-json-schemas.mjs'),
            workspaceRoot,
          ),
        );
      } else {
        checks.push({
          name: 'Schema generation',
          status: 'skipped',
          duration: 0,
          error: 'Prerequisite core build failed',
        });
      }
    }

    // 5. Docs build
    checks.push(runPnpm('Docs build', ['run', 'docs:build'], workspaceRoot));

    // 6. Security audit
    checks.push(runPnpm('Security audit', ['audit', '--audit-level', 'high'], workspaceRoot));

    // 7. Public surface (declarations, command surface, names)
    checks.push(
      runNodeScript(
        'Workspace declarations',
        resolve(workspaceRoot, 'scripts/check-workspace-declarations.mjs'),
        workspaceRoot,
      ),
    );
    checks.push(
      runNodeScript(
        'Public surface',
        resolve(workspaceRoot, 'scripts/check-public-surface.mjs'),
        workspaceRoot,
      ),
    );
    checks.push(
      runNodeScript(
        'Command surface',
        resolve(workspaceRoot, 'scripts/check-command-surface.mjs'),
        workspaceRoot,
      ),
    );
    checks.push(
      runNodeScript(
        'Package names',
        resolve(workspaceRoot, 'scripts/check-package-names.mjs'),
        workspaceRoot,
      ),
    );

    // 8. Package registry parity
    checks.push(
      runNodeScript(
        'Package parity',
        resolve(workspaceRoot, 'scripts/check-package-registry-parity.mjs'),
        workspaceRoot,
      ),
    );

    // 9. Release artifact validation
    checks.push(runPnpm('Release artifacts', ['run', 'release:artifacts'], workspaceRoot));
    checks.push(
      runNodeScript(
        'Release artifact validation',
        resolve(workspaceRoot, 'scripts/validate-release-config.mjs'),
        workspaceRoot,
      ),
    );

    const total = checks.length;
    const passed = checks.filter((c) => c.status === 'passed').length;
    const failed = checks.filter((c) => c.status === 'failed').length;
    const skipped = checks.filter((c) => c.status === 'skipped').length;
    const totalDuration = checks.reduce((sum, c) => sum + c.duration, 0);

    const report: ReleaseCheckReport = {
      command: 'release-check',
      checks,
      summary: { total, passed, failed, skipped, duration: totalDuration },
      ready: failed === 0,
    };

    emitResult(report, options);

    if (!report.ready) {
      process.exitCode = 1;
    }
  });
}
