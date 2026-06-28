import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  completedTask,
  failedTask,
  publicAgent,
  researcherAgent,
  workingTask,
  writerAgent,
} from '../test/fixtures';
import { EnterpriseControlsPanel } from './EnterpriseControlsPanel';

describe('EnterpriseControlsPanel', () => {
  it('summarizes registry controls for an authenticated fleet', () => {
    render(
      <EnterpriseControlsPanel
        accessMode="authenticated"
        agents={[researcherAgent, writerAgent, publicAgent]}
        tasks={[completedTask, workingTask, failedTask]}
      />,
    );

    expect(screen.getByText('Enterprise policy console')).toBeTruthy();
    expect(screen.getByText('Tenants')).toBeTruthy();
    expect(screen.getByText('Public agents')).toBeTruthy();
    expect(screen.getByText('Callback-capable')).toBeTruthy();
    expect(screen.getByText('Registry access mode')).toBeTruthy();
    expect(screen.getByText('Tenant isolation')).toBeTruthy();
    expect(screen.getByText('Callback surface')).toBeTruthy();
  });

  it('blocks promotion when unhealthy agents or terminal task failures exist', () => {
    render(
      <EnterpriseControlsPanel
        accessMode="authenticated"
        agents={[researcherAgent, writerAgent]}
        tasks={[completedTask, failedTask]}
      />,
    );

    expect(screen.getByText('blocked')).toBeTruthy();

    const healthCard = screen.getByText('Health promotion gate').closest('article');
    expect(healthCard).not.toBeNull();
    expect(within(healthCard as HTMLElement).getByText('block')).toBeTruthy();
    expect(screen.getByText(/unhealthy agent/)).toBeTruthy();

    const taskCard = screen.getByText('Task failure watch').closest('article');
    expect(taskCard).not.toBeNull();
    expect(within(taskCard as HTMLElement).getByText('block')).toBeTruthy();
  });

  it('warns in readonly mode while keeping healthy fleets promotable', () => {
    render(
      <EnterpriseControlsPanel
        accessMode="readonly-public"
        agents={[researcherAgent, publicAgent]}
        tasks={[completedTask]}
      />,
    );

    expect(screen.getByText('ready')).toBeTruthy();

    const accessCard = screen.getByText('Registry access mode').closest('article');
    expect(accessCard).not.toBeNull();
    expect(within(accessCard as HTMLElement).getByText('watch')).toBeTruthy();
    expect(screen.getByText(/Public readonly mode is active/)).toBeTruthy();
  });
});
