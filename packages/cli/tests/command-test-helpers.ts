import type { Command } from 'commander';
import { expect } from 'vitest';
import type { CliOptions } from '../src/io.js';

export function jsonOptions(): CliOptions {
  return { json: true };
}

export function commandNames(command: Command): string[] {
  return command.commands.map((subcommand) => subcommand.name());
}

export function expectCommandHelp(command: Command, snippets: string[]): void {
  const help = command.helpInformation();
  for (const snippet of snippets) {
    expect(help).toContain(snippet);
  }
}
