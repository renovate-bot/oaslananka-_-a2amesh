import { describe, expect, it } from 'vitest';

import {
  createAgentsMetadata,
  createAgentsSkillTags,
  mapAgentsEventToA2A,
} from '../src/AgentsSurface.js';

describe('AgentsSurface mapping', () => {
  it('maps handoff events to working task metadata', () => {
    const result = mapAgentsEventToA2A({ type: 'handoff', name: 'researcher', status: 'started' });

    expect(result.taskState).toBe('WORKING');
    expect(result.skillTags).toContain('handoff');
  });

  it('creates aggregate metadata and unique skill tags', () => {
    const events = [
      { type: 'mcp-tool', name: 'search' },
      { type: 'trace', name: 'run-1' },
      { type: 'mcp-tool', name: 'search' },
    ] as const;

    expect(createAgentsSkillTags(events)).toEqual(['openai-agents', 'mcp', 'trace']);
    expect(createAgentsMetadata(events)['openaiAgentsEvents']).toHaveLength(3);
  });
});
