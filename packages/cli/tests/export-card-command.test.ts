import { describe, expect, it } from 'vitest';
import { createExportCardCommand } from '../src/commands/export-card.js';
import { expectCommandHelp, jsonOptions } from './command-test-helpers.js';

describe('export-card command', () => {
  it('defines the export-card command and output option', () => {
    const command = createExportCardCommand(jsonOptions);

    expect(command.name()).toBe('export-card');
    expectCommandHelp(command, ['export-card [options] <url>', '--output <path>']);
  });
});
