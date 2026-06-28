import chalk from 'chalk';
import ora from 'ora';

export interface CliOptions {
  json?: boolean;
}

export type RootOptionsProvider = () => CliOptions;

export function writeOutput(message: string): void {
  process.stdout.write(`${message}\n`);
}

export function writeError(message: string): void {
  process.stderr.write(`${message}\n`);
}

export function emitResult(value: unknown, options: CliOptions): void {
  if (options.json) {
    writeOutput(JSON.stringify(value, null, 2));
    return;
  }

  if (typeof value === 'string') {
    writeOutput(value);
    return;
  }

  writeOutput(chalk.cyan(JSON.stringify(value, null, 2)));
}

export async function withSpinner<T>(
  label: string,
  options: CliOptions,
  fn: () => Promise<T>,
): Promise<T> {
  if (options.json) {
    return fn();
  }

  const spinner = ora(label).start();
  try {
    const result = await fn();
    spinner.succeed(label);
    return result;
  } catch (error) {
    spinner.fail(label);
    throw error;
  }
}
