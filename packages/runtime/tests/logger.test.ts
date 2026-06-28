import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../src/utils/logger.js';

describe('logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env['NODE_ENV'];
    process.env['LOG_LEVEL'] = 'silent';
  });

  it('writes structured JSON in production mode', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['LOG_LEVEL'] = 'info';
    const spy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    logger.info('hello', { taskId: 'task-1' });
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('"taskId":"task-1"'));
  });

  it('respects log level filtering', () => {
    process.env['LOG_LEVEL'] = 'error';
    const spy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    logger.info('skip me');
    expect(spy).not.toHaveBeenCalled();
  });

  it('writes to stderr for error logs', () => {
    process.env['LOG_LEVEL'] = 'error';
    const spy = vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    logger.error('boom', { error: new Error('broken') });
    expect(spy).toHaveBeenCalled();
  });

  it('supports silent log filtering for test and embedding environments', () => {
    process.env['LOG_LEVEL'] = 'silent';
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);
    const stderr = vi.spyOn(process.stderr, 'write').mockReturnValue(true);

    logger.info('skip info');
    logger.warn('skip warn');
    logger.error('skip error');

    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).not.toHaveBeenCalled();
  });

  it('redacts secret-like values in structured and pretty logs', () => {
    process.env['NODE_ENV'] = 'production';
    process.env['LOG_LEVEL'] = 'info';
    const stdout = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

    logger.info('sensitive context', {
      Authorization: 'Bearer production-token',
      apiKey: 'api-key-value',
      nested: {
        token: 'nested-token-value',
        client_secret: 'nested-client-secret-value',
      },
      safe: 'visible',
    });

    const output = String(stdout.mock.calls[0]?.[0] ?? '');
    expect(output).toContain('"safe":"visible"');
    expect(output).toContain('[REDACTED]');
    expect(output).not.toContain('production-token');
    expect(output).not.toContain('api-key-value');
    expect(output).not.toContain('nested-token-value');
    expect(output).not.toContain('nested-client-secret-value');
  });
});
