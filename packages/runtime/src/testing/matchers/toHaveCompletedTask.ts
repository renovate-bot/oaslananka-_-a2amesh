import type { Task } from '@a2amesh/runtime';

export function toHaveCompletedTask(received: Task) {
  const pass = received.status.state === 'COMPLETED';

  return {
    pass,
    message: () =>
      pass
        ? `expected task ${received.id} not to be completed`
        : `expected task ${received.id} to be completed, received ${received.status.state}`,
  };
}
