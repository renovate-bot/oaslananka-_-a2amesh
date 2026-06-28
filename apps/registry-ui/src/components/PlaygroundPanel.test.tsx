import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { completedTask, researcherAgent, writerAgent } from '../test/fixtures';
import { PlaygroundPanel } from './PlaygroundPanel';

describe('PlaygroundPanel', () => {
  it('renders a dry-run composer, timeline, and payload preview for a selected agent', () => {
    render(
      <PlaygroundPanel
        agents={[researcherAgent, writerAgent]}
        tasks={[completedTask]}
        selectedAgent={researcherAgent}
        accessMode="authenticated"
        onSelectAgent={vi.fn()}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Dry-run A2A task console' })).toBeTruthy();
    expect(screen.getByText('operator dry run')).toBeTruthy();
    expect(screen.getByRole('button', { name: /MCP bridge/ }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByText('Task timeline')).toBeTruthy();
    expect(screen.getByText('Payload preview')).toBeTruthy();
    expect(screen.getByText(/"method": "message\/send"/)).toBeTruthy();
    expect(screen.getByText(/"bridge": "mcp"/)).toBeTruthy();
  });

  it('updates the payload when the operator edits the message and runs a streaming preview', () => {
    render(
      <PlaygroundPanel
        agents={[researcherAgent]}
        tasks={[completedTask]}
        selectedAgent={researcherAgent}
        accessMode="authenticated"
        onSelectAgent={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Streaming task/ }));
    fireEvent.change(screen.getByLabelText('User message'), {
      target: { value: 'Trace the active task and show streaming artifacts.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Run preview' }));

    expect(screen.getByText(/"method": "message\/stream"/)).toBeTruthy();
    expect(screen.getByText('Stream subscribed')).toBeTruthy();
  });

  it('notifies the parent when a different target agent is selected', () => {
    const onSelectAgent = vi.fn();

    render(
      <PlaygroundPanel
        agents={[researcherAgent, writerAgent]}
        tasks={[]}
        selectedAgent={researcherAgent}
        accessMode="readonly-public"
        onSelectAgent={onSelectAgent}
      />,
    );

    fireEvent.change(screen.getByLabelText('Target agent'), {
      target: { value: writerAgent.id },
    });

    expect(screen.getByText('public preview')).toBeTruthy();
    expect(onSelectAgent).toHaveBeenCalledWith(writerAgent);
  });
});
