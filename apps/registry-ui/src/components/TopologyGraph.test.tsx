import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { researcherAgent, writerAgent } from '../test/fixtures';
import { TopologyGraph } from './TopologyGraph';

describe('TopologyGraph', () => {
  it('renders registry and agent nodes with selectable topology controls', () => {
    const onSelect = vi.fn();

    render(
      <TopologyGraph
        agents={[researcherAgent, writerAgent]}
        selectedAgentId={writerAgent.id}
        onSelect={onSelect}
      />,
    );

    expect(screen.getByText('Registry')).toBeTruthy();
    expect(screen.getByText('Control plane')).toBeTruthy();
    expect(screen.getByText('Researcher Agent')).toBeTruthy();
    expect(screen.getByText('Writer Agent')).toBeTruthy();

    const selectedNode = screen.getByRole('button', {
      name: 'Select Writer Agent in topology',
    });
    expect(selectedNode.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Select Researcher Agent in topology' }));

    expect(onSelect).toHaveBeenCalledWith(researcherAgent);
  });

  it('supports keyboard selection for topology nodes', () => {
    const onSelect = vi.fn();

    render(
      <TopologyGraph
        agents={[researcherAgent, writerAgent]}
        selectedAgentId={null}
        onSelect={onSelect}
      />,
    );

    fireEvent.keyDown(screen.getByRole('button', { name: 'Select Writer Agent in topology' }), {
      key: 'Enter',
    });

    expect(onSelect).toHaveBeenCalledWith(writerAgent);
  });
});
