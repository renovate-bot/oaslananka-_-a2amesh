import type { EventSource } from 'eventsource';

export async function* createEventSourceReader<T>(
  source: EventSource,
  eventName: string,
): AsyncGenerator<T> {
  const queue: T[] = [];
  let resolveNext: (() => void) | undefined;
  let closed = false;

  source.addEventListener(eventName, (event) => {
    const data = 'data' in event ? JSON.parse(String((event as MessageEvent).data)) : null;
    queue.push(data);
    resolveNext?.();
  });

  source.onerror = () => {
    closed = true;
    source.close();
    resolveNext?.();
  };

  try {
    while (!closed || queue.length > 0) {
      if (queue.length === 0) {
        await new Promise<void>((resolve) => {
          resolveNext = resolve;
        });
        resolveNext = undefined;
      }
      const next = queue.shift();
      if (next !== undefined) {
        yield next;
      }
    }
  } finally {
    source.close();
  }
}
