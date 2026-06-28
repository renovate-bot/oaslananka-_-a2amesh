import { describe, it, expect, vi } from 'vitest';
import { OpenAIAdapter } from '../src/OpenAIAdapter.js';
import type { AnyAgentCard, Task, Message } from '@a2amesh/runtime';
import { runAdapterContract } from './contracts/adapterContract.js';

type OpenAIClient = ConstructorParameters<typeof OpenAIAdapter>[1];

function createOpenAIContractInstance(
  card: AnyAgentCard,
  responseText = 'openai contract response',
) {
  const client = {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: responseText } }],
        }),
      },
    },
  };

  return {
    adapter: new OpenAIAdapter(
      card,
      client as unknown as OpenAIClient,
      'gpt-contract',
      'contract system',
    ),
    context: { client },
  };
}

describe('OpenAIAdapter', () => {
  runAdapterContract({
    adapterName: 'OpenAIAdapter',
    provider: 'openai',
    compatibility: 'stable',
    supportsStreaming: false,
    expectedText: 'openai contract response',
    createInstance: (card) => createOpenAIContractInstance(card),
    createProviderErrorCase: (card) => {
      const instance = createOpenAIContractInstance(card);
      instance.context.client.chat.completions.create.mockRejectedValueOnce(
        new Error('openai unavailable'),
      );
      return { instance, expectedError: /openai unavailable/ };
    },
    assertProviderRequest: ({ context }) => {
      expect(context.client.chat.completions.create).toHaveBeenCalledWith({
        model: 'gpt-contract',
        messages: [
          { role: 'system', content: 'contract system' },
          { role: 'user', content: 'previous user' },
          { role: 'assistant', content: 'previous agent' },
          { role: 'user', content: 'contract current' },
        ],
      });
    },
  });

  it('should map history and invoke chat completions', async () => {
    const card: AnyAgentCard = {
      protocolVersion: '1.0',
      name: 'OAI',
      description: 'desc',
      url: 'http://test',
      version: '1.0',
    };

    const mockOpenAIClient = {
      chat: {
        completions: {
          create: vi.fn().mockResolvedValue({
            choices: [{ message: { content: 'hello from openai' } }],
          }),
        },
      },
    };

    const adapter = new OpenAIAdapter(
      card,
      mockOpenAIClient as any,
      'gpt-4o',
      'You are a test bot.',
    );

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

    expect(mockOpenAIClient.chat.completions.create).toHaveBeenCalledWith({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a test bot.' },
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
    expect(firstPart).toEqual({ type: 'text', text: 'hello from openai' });
  });
});
