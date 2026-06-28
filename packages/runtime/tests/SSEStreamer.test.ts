import { describe, expect, it, vi } from 'vitest';
import { SSEStreamer } from '../src/server/SSEStreamer.js';

describe('SSEStreamer', () => {
  it('sets individual headers when writeHead is unavailable and invokes close hooks', () => {
    const streamer = new SSEStreamer();
    const closeListeners: Array<() => void> = [];
    const onClose = vi.fn();
    const response = {
      setHeader: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
      on: vi.fn((event: 'close', listener: () => void) => {
        if (event === 'close') {
          closeListeners.push(listener);
        }
      }),
    };

    streamer.addClient('task-header', response, onClose);
    closeListeners[0]?.();
    streamer.sendEvent('task-header', 'task_updated', { ignored: true });
    streamer.stop();

    expect(response.setHeader).toHaveBeenCalledWith('Content-Type', 'text/event-stream');
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-cache');
    expect(response.setHeader).toHaveBeenCalledWith('Connection', 'keep-alive');
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(response.write).not.toHaveBeenCalled();
  });

  it('broadcasts task updates and closes terminal streams', () => {
    const streamer = new SSEStreamer();
    const end = vi.fn();
    const write = vi.fn();
    const response = {
      writeHead: vi.fn(),
      write,
      end,
      on: vi.fn(),
    };

    streamer.addClient('task-1', response as never);
    streamer.sendTaskUpdate('task-1', {
      id: 'task-1',
      status: { state: 'COMPLETED', timestamp: new Date().toISOString() },
      history: [],
    });

    expect(write).toHaveBeenCalled();
    expect(end).toHaveBeenCalled();
    streamer.stop();
  });

  it('removes clients that fail during writes and ignores missing streams', () => {
    const streamer = new SSEStreamer();
    const stableResponse = {
      writeHead: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
      on: vi.fn(),
    };
    const failingResponse = {
      writeHead: vi.fn(),
      write: vi.fn(() => {
        throw new Error('socket closed');
      }),
      end: vi.fn(),
      on: vi.fn(),
    };

    streamer.sendEvent('missing-task', 'task_updated', { ok: true });
    streamer.addClient('task-2', stableResponse as never);
    streamer.addClient('task-2', failingResponse as never);
    streamer.sendEvent('task-2', 'task_updated', { ok: true });
    streamer.removeClient('task-2', stableResponse as never);
    streamer.closeStream('task-2');

    expect(stableResponse.write).toHaveBeenCalledTimes(1);
    expect(failingResponse.write).toHaveBeenCalledTimes(1);
    expect(stableResponse.end).not.toHaveBeenCalled();
    streamer.stop();
  });

  it('removes clients that fail during heartbeat writes', async () => {
    vi.useFakeTimers();
    const streamer = new SSEStreamer();
    const response = {
      writeHead: vi.fn(),
      write: vi.fn(() => {
        throw new Error('heartbeat failed');
      }),
      end: vi.fn(),
      on: vi.fn(),
    };

    try {
      streamer.addClient('task-heartbeat', response as never);
      await vi.advanceTimersByTimeAsync(15000);
      streamer.sendEvent('task-heartbeat', 'task_updated', { after: 'remove' });

      expect(response.write).toHaveBeenCalledWith(': heartbeat\n\n');
      expect(response.write).toHaveBeenCalledTimes(1);
    } finally {
      streamer.stop();
      vi.useRealTimers();
    }
  });

  it('continues stopping streams when a client end throws', () => {
    const streamer = new SSEStreamer();
    const throwingResponse = {
      writeHead: vi.fn(),
      write: vi.fn(),
      end: vi.fn(() => {
        throw new Error('already closed');
      }),
      on: vi.fn(),
    };
    const stableResponse = {
      writeHead: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
      on: vi.fn(),
    };

    streamer.addClient('task-stop', throwingResponse as never);
    streamer.addClient('task-stop', stableResponse as never);
    expect(() => streamer.stop()).not.toThrow();

    expect(throwingResponse.end).toHaveBeenCalled();
    expect(stableResponse.end).toHaveBeenCalled();
  });
});
