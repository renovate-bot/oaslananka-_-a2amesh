import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { failedTask, writerAgent } from '../test/fixtures';
import { AgentInspector } from './AgentInspector';

function formatRelativeTime(timestamp?: string) {
  return timestamp ? 'recently' : 'Never';
}

describe('AgentInspector', () => {
  const writeText = vi.fn<(value: string) => Promise<void>>().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText },
    });
  });

  afterEach(() => {
    writeText.mockClear();
    vi.unstubAllGlobals();
  });

  it('renders health reasons, remediation hints, visibility, and quick actions', () => {
    render(
      <AgentInspector
        selectedAgent={writerAgent}
        selectedAgentTasks={[failedTask]}
        accessMode="authenticated"
        formatRelativeTime={formatRelativeTime}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Writer Agent' })).toBeTruthy();
    expect(screen.getByText('private agent')).toBeTruthy();
    expect(screen.getByText('tenant: tenant-a')).toBeTruthy();
    expect(screen.getByText('operator actions enabled')).toBeTruthy();
    expect(screen.getByText(/Provider timeout while drafting reports/)).toBeTruthy();
    expect(screen.getByText(/Check OpenAI\/Anthropic provider latency/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy card' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export config' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Replay latest' })).toBeTruthy();
  });

  it('copies the agent card and exported config to the clipboard', async () => {
    render(
      <AgentInspector
        selectedAgent={writerAgent}
        selectedAgentTasks={[failedTask]}
        accessMode="authenticated"
        formatRelativeTime={formatRelativeTime}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy card' }));
    await waitFor(() => expect(screen.getByText('Agent card copied.')).toBeTruthy());
    expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining('Writer Agent'));

    fireEvent.click(screen.getByRole('button', { name: 'Export config' }));
    await waitFor(() => expect(screen.getByText('Agent config exported.')).toBeTruthy());
    expect(writeText).toHaveBeenLastCalledWith(expect.stringContaining('"visibility": "private"'));
  });

  it('prepares replay context for the latest task event', () => {
    render(
      <AgentInspector
        selectedAgent={writerAgent}
        selectedAgentTasks={[failedTask]}
        accessMode="authenticated"
        formatRelativeTime={formatRelativeTime}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Replay latest' }));

    expect(screen.getByText(`Replay prepared for ${failedTask.taskId}.`)).toBeTruthy();
  });
});
