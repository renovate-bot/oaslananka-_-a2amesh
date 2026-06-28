/**
 * @file SSEStreamer.ts
 * Server-Sent Events handler for task progress streaming.
 */

import type { Task } from '../types/task.js';
import { a2aMeshTracer, SpanStatusCode } from '../telemetry/index.js';

type SSETransportResponse = {
  write(chunk: string): boolean;
  end(): void;
  on(event: 'close', listener: () => void): void;
  writeHead?(statusCode: number, headers?: Record<string, string>): SSETransportResponse;
  setHeader?(name: string, value: string): void;
};

export class SSEStreamer {
  private clients: Map<string, Set<SSETransportResponse>> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startHeartbeat();
  }

  private startHeartbeat() {
    // Send a comment ping every 15 seconds to keep idle connections alive
    this.heartbeatInterval = setInterval(() => {
      this.clients.forEach((taskClients, taskId) => {
        taskClients.forEach((res) => {
          try {
            res.write(': heartbeat\n\n');
          } catch {
            this.removeClient(taskId, res);
          }
        });
      });
    }, 15000);
    this.heartbeatInterval.unref?.();
  }

  /**
   * Add a client to the stream map (allows multiple subscribers per task).
   * @param taskId The task ID associated with the stream.
   * @param res The Express Response object.
   */
  addClient(taskId: string, res: SSETransportResponse, onClose?: () => void) {
    if (!this.clients.has(taskId)) {
      this.clients.set(taskId, new Set());
    }
    const taskClients = this.clients.get(taskId);
    if (!taskClients) {
      return;
    }
    taskClients.add(res);

    if (res.writeHead) {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
    } else {
      res.setHeader?.('Content-Type', 'text/event-stream');
      res.setHeader?.('Cache-Control', 'no-cache');
      res.setHeader?.('Connection', 'keep-alive');
    }

    res.on('close', () => {
      this.removeClient(taskId, res);
      onClose?.();
    });
  }

  /**
   * Broadcast an event to all subscribers of a specific task.
   * @param taskId The task ID.
   * @param event The SSE event type (e.g. 'task_updated').
   * @param data The JSON data payload.
   */
  sendEvent(taskId: string, event: string, data: unknown) {
    const taskClients = this.clients.get(taskId);
    if (taskClients) {
      const span = a2aMeshTracer.startSpan('sse.sendEvent', {
        attributes: {
          'a2a.task_id': taskId,
          'a2a.event': event,
          'a2a.client_count': taskClients.size,
        },
      });
      try {
        const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        taskClients.forEach((res) => {
          try {
            res.write(payload);
          } catch {
            this.removeClient(taskId, res);
          }
        });
      } finally {
        span.setStatus({ code: SpanStatusCode.OK });
        span.end();
      }
    }
  }

  /**
   * Send a task update and complete the streams if terminal state reached.
   * @param taskId The task ID.
   * @param task The updated task object.
   */
  sendTaskUpdate(taskId: string, task: Task) {
    this.sendEvent(taskId, 'task_updated', task);
    if (['COMPLETED', 'FAILED', 'CANCELED'].includes(task.status.state)) {
      this.closeStream(taskId);
    }
  }

  /**
   * Close all streams for a specific task.
   * @param taskId The task ID.
   */
  closeStream(taskId: string) {
    const taskClients = this.clients.get(taskId);
    if (taskClients) {
      taskClients.forEach((res) => {
        try {
          res.end();
        } catch {
          /* ignore */
        }
      });
      this.clients.delete(taskId);
    }
  }

  /**
   * Remove a specific client from the map.
   * @param taskId The task ID.
   * @param res The specific Response object.
   */
  removeClient(taskId: string, res: SSETransportResponse) {
    const taskClients = this.clients.get(taskId);
    if (taskClients) {
      taskClients.delete(res);
      if (taskClients.size === 0) {
        this.clients.delete(taskId);
      }
    }
  }

  /**
   * Stops the heartbeat interval. Useful for graceful shutdown.
   */
  stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    // End all remaining connections
    this.clients.forEach((taskClients) => {
      taskClients.forEach((res) => {
        try {
          res.end();
        } catch {
          /* ignore */
        }
      });
    });
    this.clients.clear();
  }
}
