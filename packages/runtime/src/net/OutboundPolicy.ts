import { promises as dns } from 'node:dns';
import { fetchWithPolicy, type FetchPolicyOptions } from './fetchWithPolicy.js';
import { validateSafeUrl, type SafeUrlOptions } from '../security/url.js';

export interface OutboundPolicyOptions extends SafeUrlOptions, FetchPolicyOptions {
  /** Allowed outbound HTTP schemes. Defaults to http and https. */
  allowedSchemes?: readonly string[];
  /** Cache successful DNS lookups for this many milliseconds. Disabled by default. */
  dnsCacheTtlMs?: number;
}

type DnsCacheEntry = {
  addresses: string[];
  expiresAt: number;
};

const dnsCache = new Map<string, DnsCacheEntry>();

export async function validateUrl(
  url: string | URL,
  policy: OutboundPolicyOptions = {},
): Promise<URL> {
  const urlString = url.toString();
  const parsed = parseUrl(urlString);
  const allowedSchemes = new Set((policy.allowedSchemes ?? ['http', 'https']).map(normalizeScheme));

  if (!allowedSchemes.has(parsed.protocol)) {
    throw new Error(
      `Unsupported URL protocol. Allowed protocols: ${Array.from(allowedSchemes).join(', ')}`,
    );
  }

  return validateSafeUrl(urlString, createSafeUrlOptions(policy));
}

export async function validateAndFetch(
  url: string | URL,
  init?: RequestInit,
  policy: OutboundPolicyOptions = {},
): Promise<Response> {
  const safeUrl = await validateUrl(url, policy);
  return fetchWithPolicy(safeUrl, init, createFetchPolicyOptions(policy));
}

export function clearOutboundPolicyDnsCache(): void {
  dnsCache.clear();
}

function parseUrl(urlString: string): URL {
  try {
    return new URL(urlString);
  } catch (error: unknown) {
    throw new Error('Invalid URL format', { cause: error });
  }
}

function normalizeScheme(scheme: string): string {
  const normalized = scheme.toLowerCase();
  return normalized.endsWith(':') ? normalized : `${normalized}:`;
}

function createSafeUrlOptions(policy: OutboundPolicyOptions): SafeUrlOptions {
  const safeOptions: SafeUrlOptions = {
    ...(policy.allowLocalhost !== undefined ? { allowLocalhost: policy.allowLocalhost } : {}),
    ...(policy.allowPrivateNetworks !== undefined
      ? { allowPrivateNetworks: policy.allowPrivateNetworks }
      : {}),
    ...(policy.allowUnresolvedHostnames !== undefined
      ? { allowUnresolvedHostnames: policy.allowUnresolvedHostnames }
      : {}),
    ...(policy.allowedHostnames !== undefined ? { allowedHostnames: policy.allowedHostnames } : {}),
  };

  const ttlMs = policy.dnsCacheTtlMs ?? 0;
  if (ttlMs > 0) {
    const resolver = policy.resolveHostname ?? dns.resolve;
    safeOptions.resolveHostname = (hostname) => resolveHostnameWithCache(hostname, ttlMs, resolver);
  } else if (policy.resolveHostname) {
    safeOptions.resolveHostname = policy.resolveHostname;
  }

  return safeOptions;
}

function createFetchPolicyOptions(policy: OutboundPolicyOptions): FetchPolicyOptions {
  return {
    ...(policy.timeoutMs !== undefined ? { timeoutMs: policy.timeoutMs } : {}),
    ...(policy.retries !== undefined ? { retries: policy.retries } : {}),
    ...(policy.backoffBaseMs !== undefined ? { backoffBaseMs: policy.backoffBaseMs } : {}),
    ...(policy.backoffMaxMs !== undefined ? { backoffMaxMs: policy.backoffMaxMs } : {}),
    ...(policy.jitter !== undefined ? { jitter: policy.jitter } : {}),
    ...(policy.signal ? { signal: policy.signal } : {}),
    ...(policy.telemetryLabels !== undefined ? { telemetryLabels: policy.telemetryLabels } : {}),
  };
}

async function resolveHostnameWithCache(
  hostname: string,
  ttlMs: number,
  resolver: (hostname: string) => Promise<string[]>,
): Promise<string[]> {
  const cacheKey = hostname.toLowerCase();
  const cached = dnsCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.addresses;
  }

  const addresses = await resolver(hostname);
  dnsCache.set(cacheKey, {
    addresses,
    expiresAt: now + ttlMs,
  });
  return addresses;
}
