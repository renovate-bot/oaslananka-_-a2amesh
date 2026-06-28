import { describe, it, expect, vi } from 'vitest';
import { LangChainAdapter } from '../src/LangChainAdapter.js';
import type { AnyAgentCard, Task, Message } from '@a2amesh/runtime';
import { runAdapterContract } from './contracts/adapterContract.js';

function createLangChainContractInstance(
  card: AnyAgentCard,
  responseText = 'langchain contract response',
) {
  const runnable = {
    invoke: vi.fn().mockResolvedValue({
      messages: [{ role: 'assistant', content: responseText }],
    }),
  };

  return {
    adapter: new LangChainAdapter(card, runnable),
    context: { runnable },
  };
}

describe('LangChainAdapter', () => {
  runAdapterContract({
    adapterName: 'LangChainAdapter',
    provider: 'langchain',
    compatibility: 'stable',
    supportsStreaming: false,
    expectedText: 'langchain contract response',
    createInstance: (card) => createLangChainContractInstance(card),
    createProviderErrorCase: (card) => {
      const instance = createLangChainContractInstance(card);
      instance.context.runnable.invoke.mockRejectedValueOnce(new Error('langchain unavailable'));
      return { instance, expectedError: /langchain unavailable/ };
    },
    assertProviderRequest: ({ context }) => {
      expect(context.runnable.invoke).toHaveBeenCalledWith({
        messages: [
          { role: 'user', content: 'previous user' },
          { role: 'assistant', content: 'previous agent' },
          { role: 'user', content: 'contract current' },
        ],
      });
    },
  });

  it('should map history and invoke the runnable', async () => {
    const card: AnyAgentCard = {
      protocolVersion: '1.0',
      name: 'LC',
      description: 'desc',
      url: 'http://test',
      version: '1.0',
    };

    const mockRunnable = {
      invoke: vi.fn().mockResolvedValue({
        messages: [{ role: 'assistant', content: 'hello from lc' }],
      }),
    };

    const adapter = new LangChainAdapter(card, mockRunnable);

    const task: Task = {
      id: 'task-1',
      status: { state: 'WORKING', timestamp: '' },
      history: [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'hi' }],
          messageId: 'msg-0',
          timestamp: '',
        },
      ],
    };

    const currentMsg: Message = {
      role: 'user',
      parts: [{ type: 'text', text: 'whats up' }],
      messageId: 'msg-1',
      timestamp: '',
    };

    const artifacts = await adapter.handleTask(task, currentMsg);

    expect(mockRunnable.invoke).toHaveBeenCalledWith({
      messages: [
        { role: 'user', content: 'hi' },
        { role: 'user', content: 'whats up' },
      ],
    });
    expect(artifacts.length).toBe(1);
    const firstArtifact = artifacts[0];
    if (!firstArtifact) {
      throw new Error('Expected one artifact');
    }
    const firstPart = firstArtifact.parts[0];
    expect(firstPart).toEqual({ type: 'text', text: 'hello from lc' });
  });
});
