import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { AgentStatus } from '../api/registry';
import { HealthBadge } from './HealthBadge';

describe('HealthBadge', () => {
  it.each([
    ['healthy', 'Healthy', 'text-emerald-200'],
    ['unhealthy', 'Unhealthy', 'text-rose-200'],
    ['unknown', 'Unknown', 'text-slate-200'],
  ] satisfies [AgentStatus, string, string][])(
    'renders the %s status label and color treatment',
    (status, label, textClass) => {
      render(<HealthBadge status={status} />);

      const badge = screen.getByText(label);
      expect(badge.className).toContain(textClass);
      expect(badge.textContent).toBe(label);
    },
  );
});
