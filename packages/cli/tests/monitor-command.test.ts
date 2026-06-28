import { describe, expect, it } from 'vitest';
import { createMonitorCommand } from '../src/commands/monitor.js';
import { expectCommandHelp, jsonOptions } from './command-test-helpers.js';

describe('monitor command', () => {
  it('defines the monitor command and polling options', () => {
    const command = createMonitorCommand(jsonOptions);

    expect(command.name()).toBe('monitor');
    expectCommandHelp(command, [
      'monitor [options] <url>',
      '--interval <ms>',
      '--cycles <count>',
      '--limit <count>',
      '--context-id <contextId>',
    ]);
  });
});
