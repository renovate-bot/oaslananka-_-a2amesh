import { describe, expect, it } from 'vitest';
import { createTaskCommand } from '../src/commands/task.js';
import { commandNames, expectCommandHelp, jsonOptions } from './command-test-helpers.js';

describe('task command', () => {
  it('defines the task command group and lifecycle subcommands', () => {
    const command = createTaskCommand(jsonOptions);

    expect(command.name()).toBe('task');
    expect(commandNames(command)).toEqual(['send', 'stream', 'status', 'cancel']);
    expectCommandHelp(command, [
      'Runs task lifecycle operations including',
      'send',
      'stream',
      'status',
      'cancel',
    ]);
  });
});
