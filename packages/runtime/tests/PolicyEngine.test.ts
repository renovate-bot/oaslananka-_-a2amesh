import { describe, expect, it } from 'vitest';

import { createPolicyEngine } from '../src/policy/PolicyEngine.js';

describe('PolicyEngine', () => {
  it('allows matching tenant, skill, and action rules', () => {
    const engine = createPolicyEngine([
      {
        id: 'allow-summarize',
        effect: 'allow',
        tenants: ['acme'],
        skills: ['summarize'],
        actions: ['skill.invoke'],
      },
    ]);

    expect(
      engine.can({
        tenant: 'acme',
        skillId: 'summarize',
        action: 'skill.invoke',
      }),
    ).toBe(true);
  });

  it('uses block precedence over allow', () => {
    const engine = createPolicyEngine([
      { id: 'allow-all-tools', effect: 'allow', tenants: ['acme'], actions: ['tool.invoke'] },
      { id: 'block-export-tool', effect: 'block', tenants: ['acme'], tools: ['export'] },
    ]);

    const result = engine.simulate({
      tenant: 'acme',
      toolId: 'export',
      action: 'tool.invoke',
    });

    expect(result.decision).toBe('block');
    expect(result.matchedRules.map((rule) => rule.id)).toEqual([
      'allow-all-tools',
      'block-export-tool',
    ]);
  });

  it('supports review decisions for human approval flows', () => {
    const engine = createPolicyEngine([
      {
        id: 'review-sensitive-data',
        effect: 'review',
        actions: ['tool.invoke'],
        conditions: [{ attribute: 'classification', equals: 'restricted' }],
      },
    ]);

    const result = engine.simulate({
      action: 'tool.invoke',
      attributes: { classification: 'restricted' },
    });

    expect(result.decision).toBe('review');
  });

  it('does not match missing attributes against null entries', () => {
    const engine = createPolicyEngine([
      {
        id: 'allow-null-region',
        effect: 'allow',
        actions: ['tool.invoke'],
        conditions: [{ attribute: 'region', in: [null] }],
      },
    ]);

    expect(engine.can({ action: 'tool.invoke', attributes: {} })).toBe(false);
    expect(engine.can({ action: 'tool.invoke', attributes: { region: null } })).toBe(true);
  });

  it('falls back to the configured default decision', () => {
    const engine = createPolicyEngine([], { defaultDecision: 'review' });

    const result = engine.simulate({ action: 'registry.discover' });

    expect(result.decision).toBe('review');
    expect(result.reasons[0]).toContain('default decision');
  });
});
