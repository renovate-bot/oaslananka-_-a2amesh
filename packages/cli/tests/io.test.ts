import { afterEach, describe, expect, it, vi } from 'vitest';
import { emitResult, withSpinner, writeError, writeOutput } from '../src/io.js';

describe('CLI IO helpers', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes stdout, stderr, JSON, string and object output', () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

    writeOutput('hello');
    writeError('bad');
    emitResult({ ok: true }, { json: true });
    emitResult('plain', {});
    emitResult({ nested: { value: 1 } }, {});

    expect(stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('')).toContain('hello\n');
    expect(stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('')).toContain('"ok": true');
    expect(stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('')).toContain('plain\n');
    expect(stdoutSpy.mock.calls.map(([chunk]) => String(chunk)).join('')).toContain('"value": 1');
    expect(stderrSpy).toHaveBeenCalledWith('bad\n');
  });

  it('runs spinner-free operations in JSON mode', async () => {
    await expect(withSpinner('Loading', { json: true }, async () => 'done')).resolves.toBe('done');
  });

  it('propagates spinner-free failures in JSON mode', async () => {
    await expect(
      withSpinner('Loading', { json: true }, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
  });
});
