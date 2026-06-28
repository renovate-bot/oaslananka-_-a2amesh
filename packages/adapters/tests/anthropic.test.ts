import { describe, expect, it, vi } from 'vitest';
import { AnthropicAdapter } from '../src/anthropic/AnthropicAdapter.js';
import type { AnyAgentCard, Message, Task } from '@a2amesh/runtime';
import { runAdapterContract } from './contracts/adapterContract.js';

type AnthropicClient = ConstructorParameters<typeof AnthropicAdapter>[1];

function createAnthropicContractInstance(
  card: AnyAgentCard,
  responseText = 'anthropic contract response',
) {
  const client = {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: responseText }],
        usage: { input_tokens: 3, output_tokens: 5 },
      }),
    },
  };

  return {
    adapter: new AnthropicAdapter(
      card,
      client as unknown as AnthropicClient,
      'claude-contract',
      'contract system',
      128,
    ),
    context: { client },
  };
}

function createAnthropicStreamInstance(card: AnyAgentCard) {
  const stream = {
    async *[Symbol.asyncIterator]() {
      yield {
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: 'anthropic stream contract' },
      };
    },
  };
  const client = {
    messages: {
      create: vi.fn().mockResolvedValue(stream),
    },
  };

  return {
    adapter: new AnthropicAdapter(
      card,
      client as unknown as AnthropicClient,
      'claude-contract',
      'contract system',
      128,
    ),
    context: { client },
  };
}

describe('AnthropicAdapter', () => {
  runAdapterContract({
    adapterName: 'AnthropicAdapter',
    provider: 'anthropic',
    compatibility: 'stable',
    supportsStreaming: true,
    expectedText: 'anthropic contract response',
    createInstance: (card) => createAnthropicContractInstance(card),
    createProviderErrorCase: (card) => {
      const instance = createAnthropicContractInstance(card);
      instance.context.client.messages.create.mockRejectedValueOnce(
        new Error('anthropic unavailable'),
      );
      return { instance, expectedError: /anthropic unavailable/ };
    },
    assertProviderRequest: ({ context }) => {
      expect(context.client.messages.create).toHaveBeenCalledWith({
        model: 'claude-contract',
        max_tokens: 128,
        system: 'contract system',
        messages: [
          { role: 'user', content: 'previous user' },
          { role: 'assistant', content: 'previous agent' },
          { role: 'user', content: 'contract current' },
        ],
      });
    },
    streamingCase: {
      expectedText: 'anthropic stream contract',
      createInstance: (card) => createAnthropicStreamInstance(card),
      assertProviderRequest: ({ context }) => {
        expect(context.client.messages.create).toHaveBeenCalledWith({
          model: 'claude-contract',
          max_tokens: 128,
          system: 'contract system',
          messages: [
            { role: 'user', content: 'previous user' },
            { role: 'assistant', content: 'previous agent' },
            { role: 'user', content: 'contract current' },
          ],
          stream: true,
        });
      },
    },
  });

  it('maps messages and returns content plus usage metadata', async () => {
    const card: AnyAgentCard = {
      protocolVersion: '1.0',
      name: 'Claude',
      description: 'desc',
      url: 'http://test',
      version: '1.0',
    };
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'hello from claude' }],
          usage: { input_tokens: 12, output_tokens: 34 },
        }),
      },
    };

    const adapter = new AnthropicAdapter(card, client);
    const task: Task = {
      id: 'task-1',
      status: { state: 'WORKING', timestamp: '' },
      history: [],
    };
    const message: Message = {
      role: 'user',
      parts: [{ type: 'text', text: 'hi' }],
      messageId: 'msg-1',
      timestamp: '',
    };

    const artifacts = await adapter.handleTask(task, message);
    expect(artifacts[0]?.parts[0]).toEqual({ type: 'text', text: 'hello from claude' });
  });

  it('supports streaming responses', async () => {
    const card: AnyAgentCard = {
      protocolVersion: '1.0',
      name: 'Claude',
      description: 'desc',
      url: 'http://test',
      version: '1.0',
    };
    const stream = {
      async *[Symbol.asyncIterator]() {
        yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'hi' } };
      },
    };
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue(stream),
      },
    };

    const adapter = new AnthropicAdapter(card, client);
    const task: Task = {
      id: 'task-1',
      status: { state: 'WORKING', timestamp: '' },
      history: [],
      metadata: { stream: true },
    };
    const message: Message = {
      role: 'user',
      parts: [{ type: 'text', text: 'hi' }],
      messageId: 'msg-1',
      timestamp: '',
    };

    const artifacts = await adapter.handleTask(task, message);
    expect(artifacts[0]?.parts[0]).toEqual({ type: 'text', text: 'hi' });
  });
});
