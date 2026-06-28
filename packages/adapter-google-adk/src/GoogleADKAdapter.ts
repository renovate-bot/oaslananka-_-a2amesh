/**
 * @file GoogleADKAdapter.ts
 * HTTP adapter for deployed Google Agent Development Kit agents.
 */

import { BaseAdapter } from '@a2amesh/internal-adapter-base';
import { isAgentMessage, logger, normalizeAgentCard, validateAndFetch } from '@a2amesh/runtime';
import type {
  AnyAgentCard,
  Artifact,
  Message,
  OutboundPolicyOptions,
  Task,
} from '@a2amesh/runtime';
import {
  createTextArtifact,
  extractRequiredText,
  extractText,
} from '@a2amesh/internal-adapter-base';

/**
 * Remote HTTP adapter for Google Agent Development Kit deployments.
 *
 * @experimental
 * @since 1.0.0
 */
export interface GoogleADKAdapterOptions {
  outboundPolicy?: OutboundPolicyOptions;
}

export class GoogleADKAdapter extends BaseAdapter {
  constructor(
    card: AnyAgentCard,
    private readonly adkEndpoint: string,
    private readonly apiKey?: string,
    private readonly adapterOptions: GoogleADKAdapterOptions = {},
  ) {
    super(normalizeAgentCard(card));
  }

  async handleTask(task: Task, message: Message): Promise<Artifact[]> {
    logger.info('Google ADK processing task', {
      taskId: task.id,
      ...(task.contextId ? { contextId: task.contextId } : {}),
    });

    const history = task.history.map((entry) => ({
      role: isAgentMessage(entry) ? 'model' : 'user',
      content: extractText(entry.parts),
    }));
    const inputText = extractRequiredText(message.parts, 'Google ADK');

    const response = await validateAndFetch(
      this.adkEndpoint,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { 'x-goog-api-key': this.apiKey } : {}),
        },
        body: JSON.stringify({
          taskId: task.id,
          contextId: task.contextId,
          message: inputText,
          history,
        }),
      },
      { timeoutMs: 60000, retries: 2, ...(this.adapterOptions.outboundPolicy ?? {}) },
    );

    if (!response.ok) {
      throw new Error(`Google ADK request failed with status ${response.status}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('text/event-stream')) {
      const body = response.body;
      if (!body) {
        throw new Error('Google ADK stream response has no body');
      }

      const reader = body.getReader();
      const decoder = new TextDecoder();
      let chunks = '';
      let done = false;
      let buffer = '';

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          buffer += decoder.decode(value, { stream: !done });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              chunks += line.slice('data: '.length) + '\n';
            }
          }
        }
      }
      if (buffer && buffer.startsWith('data: ')) {
        chunks += buffer.slice('data: '.length) + '\n';
      }

      const artifact = createTextArtifact(task, {
        artifactId: `google-adk-${Date.now()}`,
        name: 'Google ADK Stream Response',
        text: chunks.trim(),
        provider: 'google-adk',
        compatibility: 'beta',
        streamed: true,
        supportsStreaming: true,
        metadata: {
          streamed: true,
        },
      }) as Artifact;
      return [artifact];
    }

    const json = (await response.json()) as {
      output?: string;
      result?: string;
      metadata?: Record<string, unknown>;
    };
    const artifact = createTextArtifact(task, {
      artifactId: `google-adk-${Date.now()}`,
      name: 'Google ADK Response',
      text: json.output ?? json.result ?? '',
      provider: 'google-adk',
      compatibility: 'beta',
      supportsStreaming: true,
      metadata: {
        ...(json.metadata ?? {}),
      },
    }) as Artifact;
    return [artifact];
  }
}
