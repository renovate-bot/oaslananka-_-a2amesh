import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export interface RunOptions {
  args?: string[];
  cliEntry?: string;
  env?: NodeJS.ProcessEnv;
  spawn?: typeof spawnSync;
  stderr?: Pick<NodeJS.WriteStream, 'write'>;
}

function writeError(message: string): void {
  process.stderr.write(`${message}\n`);
}

export function run(options: RunOptions = {}): number {
  const cliEntry = options.cliEntry ?? require.resolve('@a2amesh/cli');
  const args = options.args ?? process.argv.slice(2);
  const spawn = options.spawn ?? spawnSync;

  const result = spawn(process.execPath, [cliEntry, 'init', ...args], {
    stdio: 'inherit',
    env: options.env ?? process.env,
  });

  if (typeof result.status === 'number') {
    return result.status;
  }

  if (result.error) {
    if (options.stderr) {
      options.stderr.write(`${result.error.message}\n`);
    } else {
      writeError(result.error.message);
    }
  }

  return 1;
}

export function runCli(options?: RunOptions): void {
  process.exitCode = run(options);
}
