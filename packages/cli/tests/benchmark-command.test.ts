import { describe, expect, it } from 'vitest';
import { createBenchmarkCommand } from '../src/commands/benchmark.js';
import { expectCommandHelp, jsonOptions } from './command-test-helpers.js';

describe('benchmark command', () => {
  it('defines the benchmark command and options', () => {
    const command = createBenchmarkCommand(jsonOptions);

    expect(command.name()).toBe('benchmark');
    expectCommandHelp(command, [
      'benchmark [options] <url>',
      '--requests <count>',
      '--concurrency <count>',
      '--message <message>',
    ]);
  });
});
