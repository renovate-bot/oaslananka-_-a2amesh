import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { completedTask, failedTask, workingTask } from '../test/fixtures';
import {
  installEventSourceMock,
  installFetchMock,
  MockRegistryEventSource,
} from '../test/test-utils';
import { useTaskStream } from './useTaskStream';

describe('useTaskStream', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    MockRegistryEventSource.reset();
  });

  it('keeps task data unavailable in readonly public mode', async () => {
    installEventSourceMock();

    const { result } = renderHook(() => useTaskStream('readonly-public'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.tasks).toEqual([]);
    expect(result.current.connected).toBe(false);
    expect(result.current.error).toBe('Task stream requires operator authentication.');
    expect(MockRegistryEventSource.instances).toHaveLength(0);
  });

  it('loads recent tasks and merges live stream events by recency', async () => {
    installEventSourceMock();
    installFetchMock([{ path: '/api/tasks/recent?limit=2', body: [completedTask] }]);

    const { result, unmount } = renderHook(() => useTaskStream('authenticated', 2));

    await waitFor(() => expect(result.current.loading).toBe(false));
    await waitFor(() => expect(MockRegistryEventSource.instances).toHaveLength(1));

    const source = MockRegistryEventSource.instances[0];
    expect(source?.url).toBe('/api/tasks/stream');
    expect(result.current.tasks.map((task) => task.taskId)).toEqual([completedTask.taskId]);

    act(() => {
      source?.emitJson(workingTask);
    });

    await waitFor(() => {
      expect(result.current.connected).toBe(true);
      expect(result.current.tasks.map((task) => task.taskId)).toEqual([
        workingTask.taskId,
        completedTask.taskId,
      ]);
    });

    act(() => {
      source?.emitJson({ ...completedTask, updatedAt: '2026-04-06T10:02:00.000Z' });
      source?.emitJson(failedTask);
      source?.emitMalformed();
    });

    await waitFor(() =>
      expect(result.current.tasks.map((task) => task.taskId)).toEqual([
        completedTask.taskId,
        failedTask.taskId,
      ]),
    );

    unmount();
    expect(source?.closed).toBe(true);
  });

  it('reports task stream fetch and event-source errors', async () => {
    installEventSourceMock();
    installFetchMock([
      { path: '/api/tasks/recent?limit=30', status: 503, body: { error: 'down' } },
    ]);

    const { result } = renderHook(() => useTaskStream('authenticated'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Task stream error: 503');

    const source = MockRegistryEventSource.instances[0];

    act(() => {
      source?.fail();
    });

    await waitFor(() => {
      expect(result.current.connected).toBe(false);
      expect(result.current.error).toBe('Task stream error: 503');
    });
  });

  it('reports rejected task fetches as offline errors', async () => {
    installEventSourceMock();
    installFetchMock([
      { path: '/api/tasks/recent?limit=30', error: new TypeError('network offline') },
    ]);

    const { result } = renderHook(() => useTaskStream('authenticated'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.tasks).toEqual([]);
    expect(result.current.connected).toBe(false);
    expect(result.current.error).toBe('network offline');
  });
});
