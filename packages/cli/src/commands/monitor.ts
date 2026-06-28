import { Command } from 'commander';
import type { A2AClient } from '@a2amesh/runtime';
import { emitResult, type CliOptions, type RootOptionsProvider } from '../io.js';
import { addNetworkOptions, createA2AClient, type NetworkCommandOptions } from '../network.js';
import { applyCommandDoc, type CliCommandDoc } from './doc-metadata.js';

export const monitorCommandDoc = {
  path: ['monitor'],
  summary: 'Poll task status snapshots.',
  description:
    'Polls task status snapshots from an A2A endpoint and emits task state summaries for each cycle.',
  examples: [
    {
      title: 'Poll three task status snapshots.',
      bash: ['a2amesh monitor http://127.0.0.1:3000 --cycles 3'],
      powershell: ['a2amesh monitor http://127.0.0.1:3000 --cycles 3'],
    },
  ],
} satisfies CliCommandDoc;

interface MonitorCommandOptions extends NetworkCommandOptions {
  interval: string;
  cycles?: string;
  limit: string;
  contextId?: string;
}

interface MonitoredTask {
  id: string;
  contextId?: string;
  status: {
    state: string;
    timestamp: string;
  };
}

interface TaskListSnapshot {
  tasks: MonitoredTask[];
  total: number;
}

async function monitorTasks(
  url: string,
  commandOptions: MonitorCommandOptions,
  options: CliOptions,
): Promise<void> {
  const client = createA2AClient(url, commandOptions) as A2AClient & {
    listTasks(params: {
      contextId?: string;
      limit?: number;
      offset?: number;
    }): Promise<TaskListSnapshot>;
  };
  const intervalMs = Number(commandOptions.interval);
  const cycles = commandOptions.cycles ? Number(commandOptions.cycles) : Number.POSITIVE_INFINITY;
  const limit = Number(commandOptions.limit);

  let completedCycles = 0;
  while (completedCycles < cycles) {
    const snapshot = await client.listTasks({
      ...(commandOptions.contextId ? { contextId: commandOptions.contextId } : {}),
      limit,
      offset: 0,
    });
    emitResult(
      {
        timestamp: new Date().toISOString(),
        total: snapshot.total,
        tasks: snapshot.tasks.map((task: MonitoredTask) => ({
          id: task.id,
          contextId: task.contextId,
          state: task.status.state,
          updatedAt: task.status.timestamp,
        })),
      },
      options,
    );
    completedCycles += 1;
    if (completedCycles < cycles) {
      await new Promise<void>((resolvePromise) => {
        setTimeout(resolvePromise, intervalMs);
      });
    }
  }
}

export function createMonitorCommand(getOptions: RootOptionsProvider): Command {
  return addNetworkOptions(
    applyCommandDoc(new Command('monitor'), monitorCommandDoc)
      .argument('<url>')
      .option('--interval <ms>', 'Polling interval in milliseconds', '2000')
      .option('--cycles <count>', 'Number of polling cycles before exit')
      .option('--limit <count>', 'Number of tasks to fetch', '50')
      .option('--context-id <contextId>', 'Filter tasks by context id')
      .action(async (url: string, commandOptions: MonitorCommandOptions) => {
        await monitorTasks(url, commandOptions, getOptions());
      }),
  );
}
