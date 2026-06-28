import { Command } from 'commander';
import { emitResult, type RootOptionsProvider } from '../io.js';
import { CLI_VERSION } from '../version.js';
import { applyCommandDoc, type CliCommandDoc } from './doc-metadata.js';

export const doctorCommandDoc = {
  path: ['doctor'],
  summary: 'Print local CLI diagnostics.',
  description:
    'Prints local CLI diagnostics including CLI version, Node.js version, and current platform.',
  examples: [
    {
      title: 'Print diagnostics as JSON.',
      bash: ['a2amesh doctor --json'],
      powershell: ['a2amesh doctor --json'],
    },
  ],
} satisfies CliCommandDoc;

export function createDoctorCommand(getOptions: RootOptionsProvider): Command {
  return applyCommandDoc(new Command('doctor'), doctorCommandDoc).action(() => {
    emitResult(
      {
        cli: 'a2amesh',
        version: CLI_VERSION,
        node: process.version,
        platform: process.platform,
      },
      getOptions(),
    );
  });
}
