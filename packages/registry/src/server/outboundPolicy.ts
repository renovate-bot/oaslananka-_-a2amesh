import type { OutboundPolicyOptions } from '@a2amesh/runtime';
import type { RegistryServerContext } from './types.js';

export function createRegistryOutboundPolicy(
  context: RegistryServerContext,
  overrides: OutboundPolicyOptions = {},
): OutboundPolicyOptions {
  const base = context.options.outboundPolicy ?? {};
  const telemetryLabels = {
    ...(base.telemetryLabels ?? {}),
    ...(overrides.telemetryLabels ?? {}),
  };
  const policy: OutboundPolicyOptions = {
    ...base,
    ...overrides,
    allowLocalhost:
      overrides.allowLocalhost ?? base.allowLocalhost ?? context.options.allowLocalhost ?? false,
    allowPrivateNetworks:
      overrides.allowPrivateNetworks ??
      base.allowPrivateNetworks ??
      context.options.allowPrivateNetworks ??
      false,
    allowUnresolvedHostnames:
      overrides.allowUnresolvedHostnames ??
      base.allowUnresolvedHostnames ??
      context.options.allowUnresolvedHostnames ??
      false,
  };

  return Object.keys(telemetryLabels).length > 0 ? { ...policy, telemetryLabels } : policy;
}
