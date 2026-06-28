import type { Command } from 'commander';

interface CliCommandExample {
  title: string;
  bash: readonly string[];
  powershell: readonly string[];
}

export interface CliCommandDoc {
  path: readonly [string, ...string[]];
  summary: string;
  description: string;
  examples: readonly CliCommandExample[];
  additionalMarkdown?: string;
}

export function applyCommandDoc<TCommand extends Command>(
  command: TCommand,
  doc: Pick<CliCommandDoc, 'description' | 'summary'>,
): TCommand {
  return command.summary(doc.summary).description(doc.description);
}

export function commandDocKey(path: readonly string[]): string {
  return path.join(' ');
}
