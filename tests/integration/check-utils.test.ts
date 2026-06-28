import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

const tempRoots: string[] = [];

interface CheckUtilsModule {
  runCommandSync(
    file: string,
    args: string[],
    options: {
      encoding: 'utf8';
      env?: NodeJS.ProcessEnv;
      stdio: 'pipe';
    },
  ): string;
}

async function loadCheckUtilsModule(): Promise<CheckUtilsModule> {
  return (await import(
    new URL('../../scripts/check-utils.mjs', import.meta.url).href
  )) as unknown as CheckUtilsModule;
}

describe('check-utils command execution', () => {
  afterEach(async () => {
    await Promise.all(
      tempRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })),
    );
  });

  it.runIf(process.platform === 'win32')(
    'runs cmd shims whose absolute path and arguments contain spaces',
    async () => {
      const root = await mkdtemp(join(tmpdir(), 'a2a-command-'));
      tempRoots.push(root);
      const binDir = join(root, 'bin with spaces');
      const shim = join(binDir, 'smoke command.cmd');
      await mkdir(binDir, { recursive: true });
      await writeFile(shim, '@echo [%~1]\r\n');

      const { runCommandSync } = await loadCheckUtilsModule();
      const output = runCommandSync(shim, ['argument with spaces'], {
        encoding: 'utf8',
        stdio: 'pipe',
      });

      expect(output.trim()).toBe('[argument with spaces]');
    },
  );

  it.runIf(process.platform === 'win32')(
    'resolves cmd shims from PATH before execution',
    async () => {
      const root = await mkdtemp(join(tmpdir(), 'a2a-command-path-'));
      tempRoots.push(root);
      const binDir = join(root, 'bin');
      const shim = join(binDir, 'path-smoke.cmd');
      await mkdir(binDir, { recursive: true });
      await writeFile(shim, '@echo [%~dp0] [%~1]\r\n');

      const { runCommandSync } = await loadCheckUtilsModule();
      const output = runCommandSync('path-smoke.cmd', ['argument with spaces'], {
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${binDir};${process.env['PATH'] ?? ''}`,
        },
        stdio: 'pipe',
      });

      expect(output.trim()).toBe(`[${binDir}\\] [argument with spaces]`);
    },
  );
});
