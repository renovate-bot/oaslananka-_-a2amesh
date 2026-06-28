import type { RegistryMetricsSummary, RegistryServerContext } from './types.js';

export interface RegistryMetricsController {
  getSummary(): Promise<RegistryMetricsSummary>;
  renderPrometheusText(summary: RegistryMetricsSummary): string;
}

export function createRegistryMetrics(context: RegistryServerContext): RegistryMetricsController {
  return {
    async getSummary(): Promise<RegistryMetricsSummary> {
      const agents = await context.store.summarize();

      return {
        registrations: context.state.metrics.registrations,
        searches: context.state.metrics.searches,
        heartbeats: context.state.metrics.heartbeats,
        agentCount: agents.agentCount,
        healthyAgents: agents.healthyAgents,
        unhealthyAgents: agents.unhealthyAgents,
        unknownAgents: agents.unknownAgents,
        activeTenants: agents.activeTenants,
        publicAgents: agents.publicAgents,
      };
    },
    renderPrometheusText,
  };
}

function renderPrometheusText(summary: RegistryMetricsSummary): string {
  return [
    '# HELP a2a_registry_registrations_total Total agent registrations.',
    '# TYPE a2a_registry_registrations_total counter',
    `a2a_registry_registrations_total ${summary.registrations}`,
    '# HELP a2a_registry_searches_total Total registry searches.',
    '# TYPE a2a_registry_searches_total counter',
    `a2a_registry_searches_total ${summary.searches}`,
    '# HELP a2a_registry_heartbeats_total Total registry heartbeats.',
    '# TYPE a2a_registry_heartbeats_total counter',
    `a2a_registry_heartbeats_total ${summary.heartbeats}`,
    '# HELP a2a_registry_agents Number of known agents.',
    '# TYPE a2a_registry_agents gauge',
    `a2a_registry_agents ${summary.agentCount}`,
    '# HELP a2a_registry_healthy_agents Number of healthy agents.',
    '# TYPE a2a_registry_healthy_agents gauge',
    `a2a_registry_healthy_agents ${summary.healthyAgents}`,
    '# HELP a2a_registry_active_tenants Number of unique tenants with registered agents.',
    '# TYPE a2a_registry_active_tenants gauge',
    `a2a_registry_active_tenants ${summary.activeTenants}`,
    '# HELP a2a_registry_public_agents Number of public agents.',
    '# TYPE a2a_registry_public_agents gauge',
    `a2a_registry_public_agents ${summary.publicAgents}`,
  ].join('\n');
}
