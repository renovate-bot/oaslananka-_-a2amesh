export type AgentsSurfaceEventType =
  | 'handoff'
  | 'guardrail'
  | 'session'
  | 'tool-approval'
  | 'mcp-tool'
  | 'trace';

export interface AgentsSurfaceEvent {
  type: AgentsSurfaceEventType;
  name: string;
  status?: 'started' | 'completed' | 'failed' | 'requires-action';
  data?: Record<string, unknown>;
}

export interface AgentsSurfaceMapping {
  taskState?: 'WORKING' | 'INPUT_REQUIRED' | 'COMPLETED' | 'FAILED';
  metadata: Record<string, unknown>;
  skillTags: string[];
}

export function mapAgentsEventToA2A(event: AgentsSurfaceEvent): AgentsSurfaceMapping {
  const metadata: Record<string, unknown> = {
    openaiAgentsEvent: event.type,
    openaiAgentsName: event.name,
    ...(event.status ? { openaiAgentsStatus: event.status } : {}),
    ...(event.data ? { openaiAgentsData: event.data } : {}),
  };

  switch (event.type) {
    case 'handoff':
      return { taskState: 'WORKING', metadata, skillTags: ['openai-agents', 'handoff'] };
    case 'guardrail':
      return {
        taskState: event.status === 'failed' ? 'FAILED' : 'WORKING',
        metadata,
        skillTags: ['openai-agents', 'guardrail'],
      };
    case 'session':
      return { metadata, skillTags: ['openai-agents', 'session'] };
    case 'tool-approval':
      return { taskState: 'INPUT_REQUIRED', metadata, skillTags: ['openai-agents', 'approval'] };
    case 'mcp-tool':
      return { metadata, skillTags: ['openai-agents', 'mcp'] };
    case 'trace':
      return { metadata, skillTags: ['openai-agents', 'trace'] };
  }
}

export function createAgentsSkillTags(events: readonly AgentsSurfaceEvent[]): string[] {
  return [...new Set(events.flatMap((event) => mapAgentsEventToA2A(event).skillTags))];
}

export function createAgentsMetadata(
  events: readonly AgentsSurfaceEvent[],
): Record<string, unknown> {
  return {
    openaiAgentsEvents: events.map((event) => mapAgentsEventToA2A(event).metadata),
    openaiAgentsSkillTags: createAgentsSkillTags(events),
  };
}
