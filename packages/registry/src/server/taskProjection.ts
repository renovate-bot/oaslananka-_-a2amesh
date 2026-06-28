import type { Task } from '@a2amesh/runtime';
import type { RegisteredAgent } from '../storage/IAgentStorage.js';
import type { RegistryServerContext, RegistryTaskEvent } from './types.js';

export interface RegistryTaskProjectionController {
  getRecentTasks(limit: number): RegistryTaskEvent[];
  recordTask(agent: RegisteredAgent, task: Task): RegistryTaskEvent | null;
  toTaskEvent(agent: RegisteredAgent, task: Task): RegistryTaskEvent;
  buildTaskVersion(taskEvent: RegistryTaskEvent): string;
  trimRecentTasks(): void;
  purgeAgentTaskState(agentId: string): void;
}

export function createRegistryTaskProjection(
  context: RegistryServerContext,
): RegistryTaskProjectionController {
  const getRecentTasks = (limit: number): RegistryTaskEvent[] =>
    [...context.recentTasks.values()]
      .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt))
      .slice(0, limit);

  const buildTaskVersion = (taskEvent: RegistryTaskEvent): string =>
    JSON.stringify({
      status: taskEvent.status,
      updatedAt: taskEvent.updatedAt,
      historyCount: taskEvent.historyCount,
      artifactCount: taskEvent.artifactCount,
      summary: taskEvent.summary,
    });

  const trimRecentTasks = (): void => {
    const maxRecentTasks = context.options.maxRecentTasks ?? 50;
    const recentEntries = [...context.recentTasks.entries()].sort(
      (left, right) => Date.parse(right[1].updatedAt) - Date.parse(left[1].updatedAt),
    );

    for (const [key] of recentEntries.slice(maxRecentTasks)) {
      context.recentTasks.delete(key);
      context.taskVersions.delete(key);
    }
  };

  const toTaskEvent = (agent: RegisteredAgent, task: Task): RegistryTaskEvent => {
    const summary = extractTaskSummary(task);

    return {
      taskId: task.id,
      agentId: agent.id,
      agentName: agent.card.name,
      agentUrl: agent.url,
      status: task.status.state,
      updatedAt: task.status.timestamp,
      ...(task.contextId ? { contextId: task.contextId } : {}),
      ...(summary ? { summary } : {}),
      historyCount: task.history.length,
      artifactCount: task.artifacts?.length ?? 0,
      task,
    };
  };

  const recordTask = (agent: RegisteredAgent, task: Task): RegistryTaskEvent | null => {
    const taskEvent = toTaskEvent(agent, task);
    const version = buildTaskVersion(taskEvent);
    const key = `${agent.id}:${task.id}`;

    if (context.taskVersions.get(key) === version) {
      return null;
    }

    context.taskVersions.set(key, version);
    context.recentTasks.set(key, taskEvent);
    trimRecentTasks();
    return taskEvent;
  };

  return {
    getRecentTasks,
    recordTask,
    toTaskEvent,
    buildTaskVersion,
    trimRecentTasks,
    purgeAgentTaskState(agentId: string): void {
      context.nextHealthCheckAt.delete(agentId);
      context.nextTaskPollAt.delete(agentId);
      for (const key of [...context.recentTasks.keys()]) {
        if (key.startsWith(`${agentId}:`)) {
          context.recentTasks.delete(key);
          context.taskVersions.delete(key);
        }
      }
    },
  };
}

function extractTaskSummary(task: Task): string | undefined {
  const artifactText = task.artifacts
    ?.flatMap((artifact) => artifact.parts)
    .find((part) => part.type === 'text');

  if (artifactText?.type === 'text') {
    return artifactText.text.slice(0, 180);
  }

  const latestHistory = [...task.history]
    .reverse()
    .find((message) => message.parts.some((part) => part.type === 'text'));
  const latestText = latestHistory?.parts.find((part) => part.type === 'text');

  return latestText?.type === 'text' ? latestText.text.slice(0, 180) : undefined;
}
