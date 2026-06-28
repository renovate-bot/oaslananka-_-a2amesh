import { describe, expect, it, vi } from 'vitest';
import { LlamaIndexAdapter } from '../src/LlamaIndexAdapter.js';
import type { AnyAgentCard, Message, Task } from '@a2amesh/runtime';
import { runAdapterContract } from './contracts/adapterContract.js';

function createLlamaIndexContractInstance(
  card: AnyAgentCard,
  responseText = 'llamaindex contract response',
) {
  const engine = {
    chat: vi.fn().mockResolvedValue({
      response: responseText,
      sourceNodes: [{ score: 0.7, node: { metadata: { source: 'contract-doc' } } }],
    }),
  };

  return {
    adapter: new LlamaIndexAdapter(card, engine),
    context: { engine },
  };
}

describe('LlamaIndexAdapter', () => {
  runAdapterContract({
    adapterName: 'LlamaIndexAdapter',
    provider: 'llamaindex',
    compatibility: 'beta',
    supportsStreaming: false,
    expectedText: 'llamaindex contract response',
    createInstance: (card) => createLlamaIndexContractInstance(card),
    createProviderErrorCase: (card) => {
      const instance = createLlamaIndexContractInstance(card);
      instance.context.engine.chat.mockRejectedValueOnce(new Error('llamaindex unavailable'));
      return { instance, expectedError: /llamaindex unavailable/ };
    },
    assertProviderRequest: ({ context }) => {
      expect(context.engine.chat).toHaveBeenCalledWith({
        message: 'contract current',
        chatHistory: [
          { role: 'user', content: 'previous user' },
          { role: 'assistant', content: 'previous agent' },
        ],
        stream: false,
      });
    },
  });

  it('supports query engines', async () => {
    const card: AnyAgentCard = {
      protocolVersion: '1.0',
      name: 'Llama',
      description: 'desc',
      url: 'http://test',
      version: '1.0',
    };
    const engine = {
      query: vi.fn().mockResolvedValue({
        response: 'query response',
        sourceNodes: [{ score: 0.9, node: { metadata: { source: 'doc-1' } } }],
      }),
    };

    const adapter = new LlamaIndexAdapter(card, engine);
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
    expect(artifacts[0]?.parts[0]).toEqual({ type: 'text', text: 'query response' });
  });

  it('supports chat engines', async () => {
    const card: AnyAgentCard = {
      protocolVersion: '1.0',
      name: 'Llama Chat',
      description: 'desc',
      url: 'http://test',
      version: '1.0',
    };
    const engine = {
      chat: vi.fn().mockResolvedValue({
        response: 'chat response',
        sourceNodes: [],
      }),
    };

    const adapter = new LlamaIndexAdapter(card, engine);
    const task: Task = {
      id: 'task-1',
      status: { state: 'WORKING', timestamp: '' },
      history: [],
    };
    const message: Message = {
      role: 'user',
      parts: [{ type: 'text', text: 'hello' }],
      messageId: 'msg-1',
      timestamp: '',
    };

    const artifacts = await adapter.handleTask(task, message);
    expect(artifacts[0]?.parts[0]).toEqual({ type: 'text', text: 'chat response' });
  });

  it('throws when chat engine returns an async iterable', async () => {
    const card: AnyAgentCard = {
      protocolVersion: '1.0',
      name: 'Llama Chat',
      description: 'desc',
      url: 'http://test',
      version: '1.0',
    };
    const engine = {
      chat: vi.fn().mockResolvedValue({
        async *[Symbol.asyncIterator]() {
          yield { response: 'chunk' };
        },
      }),
    };

    const adapter = new LlamaIndexAdapter(card, engine);
    await expect(
      adapter.handleTask(
        {
          id: 'task-1',
          status: { state: 'WORKING', timestamp: '' },
          history: [],
        },
        {
          role: 'user',
          parts: [{ type: 'text', text: 'hello' }],
          messageId: 'msg-1',
          timestamp: '',
        },
      ),
    ).rejects.toThrow('Streaming LlamaIndex responses are not supported');
  });
});
