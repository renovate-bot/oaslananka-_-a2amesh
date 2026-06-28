import type { Express, Response } from 'express';
import type { AgentCard } from '../../types/agent-card.js';
import type { A2AHealthResponse, TaskCounts } from '../../types/task.js';
import type { RuntimeMetrics } from '../../telemetry/index.js';

export interface HealthResponseInput {
  agentCard: AgentCard;
  startedAt: number;
  now?: number;
  taskCounts: TaskCounts;
  memoryUsage: Pick<NodeJS.MemoryUsage, 'heapUsed' | 'heapTotal'>;
}

export interface MetricsRouteDependencies {
  app: Express;
  agentCard: AgentCard;
  startedAt: number;
  runtimeMetrics: RuntimeMetrics;
  getTaskCounts: () => TaskCounts;
}

export function buildHealthResponse(input: HealthResponseInput): A2AHealthResponse {
  return {
    status: 'healthy',
    version: input.agentCard.version,
    protocol: 'A2A/1.0',
    uptime: Math.floor(((input.now ?? Date.now()) - input.startedAt) / 1000),
    tasks: {
      active: input.taskCounts.active,
      completed: input.taskCounts.completed,
      failed: input.taskCounts.failed,
      total: input.taskCounts.total,
    },
    memory: {
      heapUsedMb: Number((input.memoryUsage.heapUsed / 1024 / 1024).toFixed(1)),
      heapTotalMb: Number((input.memoryUsage.heapTotal / 1024 / 1024).toFixed(1)),
    },
  };
}

export function registerMetricsRoutes(deps: MetricsRouteDependencies): void {
  deps.app.get('/health', (_req, res) => {
    res.json(
      buildHealthResponse({
        agentCard: deps.agentCard,
        startedAt: deps.startedAt,
        taskCounts: deps.getTaskCounts(),
        memoryUsage: process.memoryUsage(),
      }),
    );
  });

  deps.app.get('/metrics', (_req, res: Response) => {
    res.setHeader('Content-Type', 'text/plain; version=0.0.4');
    res.send(deps.runtimeMetrics.renderPrometheus(deps.getTaskCounts()));
  });
}
