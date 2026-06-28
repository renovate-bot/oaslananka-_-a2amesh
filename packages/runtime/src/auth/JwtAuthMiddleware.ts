/**
 * @file JwtAuthMiddleware.ts
 * Runtime authentication middleware backed by OIDC discovery, JWKS and API keys.
 */

import { timingSafeEqual } from 'node:crypto';
import { promises as dns } from 'node:dns';
import { isIP, isIPv4 } from 'node:net';
import type { NextFunction, Request as ExpressRequest, Response as ExpressResponse } from 'express';
import { createRemoteJWKSet, jwtVerify, type JWTPayload, customFetch } from 'jose';
import {
  attachRequestContext,
  createAuthenticatedRequestContext,
  type RequestWithContext,
} from './requestContext.js';
import type {
  ApiKeyCredential,
  ApiKeyCredentialSource,
  AuthScheme,
  AuthValidationResult,
  HttpAuthScheme,
  OpenIdConnectAuthScheme,
  RequestContext,
} from '@a2amesh/protocol';

export interface JwtAuthOutboundPolicyOptions {
  timeoutMs?: number;
  retries?: number;
  allowedSchemes?: readonly string[];
  allowLocalhost?: boolean;
  allowNetworkTargets?: boolean;
  allowUnresolvedHostnames?: boolean;
  allowedHostnames?: readonly string[];
  resolveHostname?: (hostname: string) => Promise<string[]>;
}

const DEFAULT_AUTH_OUTBOUND_TIMEOUT_MS = 5000;
const DEFAULT_AUTH_OUTBOUND_SCHEMES = ['http', 'https'] as const;
const AUTH_TRANSIENT_STATUS_CODES = new Set([408, 429]);

export interface JwtAuthMiddlewareOptions {
  securitySchemes: AuthScheme[];
  security?: Record<string, string[]>[];
  apiKeys?: ApiKeyCredentialSource;
  outboundPolicy?: JwtAuthOutboundPolicyOptions;
  fetch?: typeof fetch;
}

/**
 * Authentication middleware that evaluates A2A security schemes against incoming requests.
 *
 * Supports API keys, HTTP bearer tokens, and OIDC discovery with JWKS validation.
 *
 * @since 1.0.0
 */
export class JwtAuthMiddleware {
  private readonly remoteSets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
  private readonly fetchFn: typeof fetch;

  constructor(private readonly options: JwtAuthMiddlewareOptions) {
    this.fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  async authenticateRequest(req: ExpressRequest): Promise<AuthValidationResult> {
    const securityRequirements =
      this.options.security && this.options.security.length > 0
        ? this.options.security
        : [Object.fromEntries(this.options.securitySchemes.map((scheme) => [scheme.id, []]))];

    let lastError: Error | undefined;
    for (const requirement of securityRequirements) {
      try {
        for (const schemeId of Object.keys(requirement)) {
          const scheme = this.options.securitySchemes.find((item) => item.id === schemeId);
          if (!scheme) {
            throw new Error(`Unknown security scheme: ${schemeId}`);
          }

          if (scheme.type === 'apiKey') {
            return this.validateApiKey(req, scheme);
          }

          if (scheme.type === 'http') {
            return this.validateBearerToken(req, scheme);
          }

          if (scheme.type === 'openIdConnect') {
            return this.validateOidcToken(req, scheme);
          }
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      }
    }

    throw lastError ?? new Error('Authentication failed');
  }

  async authenticateRequestContext(req: ExpressRequest): Promise<RequestContext> {
    const authResult = await this.authenticateRequest(req);
    const context = createAuthenticatedRequestContext(req, authResult);
    attachRequestContext(req, context);
    Object.assign(req, { auth: authResult });
    return context;
  }

  middleware() {
    return async (req: ExpressRequest, res: ExpressResponse, next: NextFunction): Promise<void> => {
      try {
        const authResult = await this.authenticateRequest(req);
        const context = createAuthenticatedRequestContext(req, authResult);
        attachRequestContext(req, context);
        Object.assign(req as RequestWithContext, { auth: authResult });
        next();
      } catch (error) {
        res.status(401).json({
          jsonrpc: '2.0',
          error: {
            code: -32040,
            message: 'Unauthorized',
            data: { reason: String(error) },
          },
          id: req.body && typeof req.body === 'object' && 'id' in req.body ? req.body.id : null,
        });
      }
    };
  }

  private validateApiKey(
    req: ExpressRequest,
    scheme: Extract<AuthScheme, { type: 'apiKey' }>,
  ): AuthValidationResult {
    const expected = this.options.apiKeys?.[scheme.id];
    const credentials = this.normalizeApiKeyCredentials(expected);
    if (credentials.length === 0) {
      throw new Error(`No API key configured for scheme ${scheme.id}`);
    }

    const incoming =
      scheme.in === 'header'
        ? req.header(scheme.name)
        : typeof req.query[scheme.name] === 'string'
          ? req.query[scheme.name]
          : undefined;

    if (typeof incoming !== 'string') {
      throw new Error('Invalid API key');
    }

    const matched = credentials.find((credential) =>
      this.safeStringEquals(credential.value, incoming),
    );
    if (!matched) {
      throw new Error('Invalid API key');
    }

    return {
      schemeId: scheme.id,
      authMethod: 'apiKey',
      subject: matched.principalId ?? `api-key:${scheme.id}`,
      principalId: matched.principalId ?? `api-key:${scheme.id}`,
      ...(matched.tenantId ? { tenantId: matched.tenantId } : {}),
      scopes: matched.scopes ?? [],
      roles: matched.roles ?? [],
      claims: matched.claims ?? {},
    };
  }

  private async validateOidcToken(
    req: ExpressRequest,
    scheme: OpenIdConnectAuthScheme,
  ): Promise<AuthValidationResult> {
    const token = this.readBearerToken(req);

    const discoveryResponse = await this.fetchWithAuthPolicy(scheme.openIdConnectUrl);

    if (!discoveryResponse.ok) {
      throw new Error(`Failed to fetch OIDC configuration: ${discoveryResponse.status}`);
    }

    const discovery = (await discoveryResponse.json()) as {
      issuer?: string;
      jwks_uri?: string;
    };
    const jwksUri = scheme.jwksUri ?? discovery.jwks_uri;
    if (!jwksUri) {
      throw new Error('OIDC configuration is missing jwks_uri');
    }

    const remoteSet = await this.getRemoteSet(jwksUri);

    const verifyOptions = {
      ...(scheme.audience ? { audience: scheme.audience } : {}),
      ...((scheme.issuer ?? discovery.issuer) ? { issuer: scheme.issuer ?? discovery.issuer } : {}),
      algorithms: scheme.algorithms ?? ['RS256', 'ES256'],
    };

    const { payload } = await jwtVerify(token, remoteSet, verifyOptions);

    return this.resultFromJwtPayload({
      schemeId: scheme.id,
      authMethod: 'oidc',
      payload,
      ...((scheme.issuer ?? discovery.issuer) ? { issuer: scheme.issuer ?? discovery.issuer } : {}),
      ...(scheme.audience ? { audience: scheme.audience } : {}),
    });
  }

  private async validateBearerToken(
    req: ExpressRequest,
    scheme: HttpAuthScheme,
  ): Promise<AuthValidationResult> {
    if (!scheme.jwksUri) {
      throw new Error('Bearer JWT verification is not configured');
    }

    const token = this.readBearerToken(req);
    const { payload } = await jwtVerify(token, await this.getRemoteSet(scheme.jwksUri), {
      ...(scheme.audience ? { audience: scheme.audience } : {}),
      ...(scheme.issuer ? { issuer: scheme.issuer } : {}),
      algorithms: scheme.algorithms ?? ['RS256', 'ES256'],
    });

    return this.resultFromJwtPayload({
      schemeId: scheme.id,
      authMethod: 'bearer',
      payload,
      ...(scheme.issuer ? { issuer: scheme.issuer } : {}),
      ...(scheme.audience ? { audience: scheme.audience } : {}),
    });
  }

  private async getRemoteSet(jwksUri: string): Promise<ReturnType<typeof createRemoteJWKSet>> {
    const jwksUrl = new URL(jwksUri);
    const cacheKey = jwksUrl.toString();
    let remoteSet = this.remoteSets.get(cacheKey);
    if (!remoteSet) {
      remoteSet = createRemoteJWKSet(jwksUrl, {
        timeoutDuration: this.options.outboundPolicy?.timeoutMs ?? DEFAULT_AUTH_OUTBOUND_TIMEOUT_MS,
        [customFetch]: async (url, init) => this.fetchWithAuthPolicy(url, init),
      });
      this.remoteSets.set(cacheKey, remoteSet);
    }

    return remoteSet;
  }

  private async fetchWithAuthPolicy(
    input: string | URL | globalThis.Request,
    init?: RequestInit,
  ): Promise<globalThis.Response> {
    const url = await this.validateAuthOutboundUrl(input);
    const timeoutMs = this.options.outboundPolicy?.timeoutMs ?? DEFAULT_AUTH_OUTBOUND_TIMEOUT_MS;
    const maxRetries = this.options.outboundPolicy?.retries ?? 0;
    let attempt = 0;
    let lastError: unknown;

    while (attempt <= maxRetries) {
      if (init?.signal?.aborted) {
        throw init.signal.reason instanceof Error
          ? init.signal.reason
          : new Error('Request aborted');
      }

      const controller = new AbortController();
      const abortListener = () => controller.abort(init?.signal?.reason);
      init?.signal?.addEventListener('abort', abortListener);
      const timeoutId = setTimeout(
        () => controller.abort(new Error(`Auth outbound fetch timed out after ${timeoutMs}ms`)),
        timeoutMs,
      );

      try {
        const response = await this.fetchFn(url, {
          ...init,
          redirect: init?.redirect ?? 'error',
          signal: controller.signal,
        });

        if (
          attempt < maxRetries &&
          (AUTH_TRANSIENT_STATUS_CODES.has(response.status) || response.status >= 500)
        ) {
          await response.text().catch(() => {});
        } else {
          return response;
        }
      } catch (error) {
        lastError = error;
        if (attempt >= maxRetries) {
          throw error;
        }
      } finally {
        clearTimeout(timeoutId);
        init?.signal?.removeEventListener('abort', abortListener);
      }

      attempt++;
    }

    throw lastError ?? new Error('Auth outbound fetch failed');
  }

  private async validateAuthOutboundUrl(input: string | URL | globalThis.Request): Promise<URL> {
    const url = parseAuthOutboundUrl(input);
    const policy = this.options.outboundPolicy;
    const allowedSchemes = new Set(
      (policy?.allowedSchemes ?? DEFAULT_AUTH_OUTBOUND_SCHEMES).map(normalizeAuthScheme),
    );

    if (!allowedSchemes.has(url.protocol)) {
      throw new Error(
        `Auth outbound policy rejected unsupported protocol: ${url.protocol.replace(/:$/, '')}`,
      );
    }

    const hostname = url.hostname.toLowerCase();
    const allowedHostnames = new Set(
      (policy?.allowedHostnames ?? []).map((value) => value.toLowerCase()),
    );
    if (allowedHostnames.has(hostname)) {
      return url;
    }

    const hostnameWithoutBrackets = hostname.replace(/^\[/, '').replace(/\]$/, '');
    if (isIP(hostnameWithoutBrackets)) {
      if (
        isRestrictedAuthOutboundIp(hostnameWithoutBrackets) &&
        !policy?.allowNetworkTargets &&
        !(policy?.allowLocalhost && isLoopbackAuthOutboundIp(hostnameWithoutBrackets))
      ) {
        throw new Error(
          `Auth outbound policy rejected restricted address: ${hostnameWithoutBrackets}`,
        );
      }
      return url;
    }

    if (hostname === 'localhost' && !policy?.allowLocalhost) {
      throw new Error('Auth outbound policy rejected localhost');
    }

    let addresses: string[];
    try {
      addresses = await (policy?.resolveHostname ?? dns.resolve)(hostname);
    } catch (error) {
      if (policy?.allowUnresolvedHostnames) {
        return url;
      }
      throw new Error('Auth outbound policy could not resolve hostname', { cause: error });
    }

    for (const address of addresses) {
      if (
        isRestrictedAuthOutboundIp(address) &&
        !policy?.allowNetworkTargets &&
        !(policy?.allowLocalhost && isLoopbackAuthOutboundIp(address))
      ) {
        throw new Error(`Auth outbound policy rejected restricted address: ${address}`);
      }
    }

    return url;
  }

  private resultFromJwtPayload(args: {
    schemeId: string;
    authMethod: 'bearer' | 'oidc';
    payload: JWTPayload;
    issuer?: string;
    audience?: string | string[];
  }): AuthValidationResult {
    const claims = args.payload as unknown as Record<string, unknown>;
    const principalId = this.readStringClaim(claims, ['principalId', 'sub', 'client_id', 'azp']);
    if (!principalId) {
      throw new Error('JWT missing principal claim');
    }
    const tenantId = this.readStringClaim(claims, ['tenantId', 'tenant_id', 'org_id']);
    const scopes = this.readStringListClaim(claims, ['scope', 'scp', 'scopes']);
    const roles = this.readStringListClaim(claims, ['roles', 'role']);

    return {
      schemeId: args.schemeId,
      authMethod: args.authMethod,
      subject: args.payload.sub ?? principalId,
      principalId,
      ...(tenantId ? { tenantId } : {}),
      scopes,
      roles,
      ...(args.issuer ? { issuer: args.issuer } : {}),
      ...(args.audience ? { audience: args.audience } : {}),
      claims,
    };
  }

  private readBearerToken(req: ExpressRequest): string {
    const header = req.header('authorization');
    if (!header || !header.toLowerCase().startsWith('bearer ')) {
      throw new Error('Missing bearer token');
    }

    return header.slice('bearer '.length).trim();
  }

  private normalizeApiKeyCredentials(
    expected: ApiKeyCredentialSource[string] | undefined,
  ): ApiKeyCredential[] {
    const values = Array.isArray(expected) ? expected : expected ? [expected] : [];
    return values.map((value) =>
      typeof value === 'string'
        ? { value }
        : {
            value: value.value,
            ...(value.principalId ? { principalId: value.principalId } : {}),
            ...(value.tenantId ? { tenantId: value.tenantId } : {}),
            ...(value.scopes ? { scopes: value.scopes } : {}),
            ...(value.roles ? { roles: value.roles } : {}),
            ...(value.claims ? { claims: value.claims } : {}),
          },
    );
  }

  private safeStringEquals(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left);
    const rightBuffer = Buffer.from(right);
    if (leftBuffer.length !== rightBuffer.length) {
      return false;
    }
    return timingSafeEqual(leftBuffer, rightBuffer);
  }

  private readStringClaim(claims: Record<string, unknown>, names: string[]): string | undefined {
    for (const name of names) {
      const value = claims[name];
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }

    return undefined;
  }

  private readStringListClaim(claims: Record<string, unknown>, names: string[]): string[] {
    for (const name of names) {
      const value = claims[name];
      if (typeof value === 'string' && value.length > 0) {
        return value.split(' ').filter(Boolean);
      }
      if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === 'string');
      }
    }

    return [];
  }
}

function parseAuthOutboundUrl(input: string | URL | globalThis.Request): URL {
  const value =
    input instanceof URL
      ? input.toString()
      : input instanceof globalThis.Request
        ? input.url
        : input;
  try {
    return new URL(value);
  } catch (error) {
    throw new Error('Invalid URL format', { cause: error });
  }
}

function normalizeAuthScheme(scheme: string): string {
  const normalized = scheme.toLowerCase();
  return normalized.endsWith(':') ? normalized : `${normalized}:`;
}

function isRestrictedAuthOutboundIp(ip: string): boolean {
  if (!isIP(ip)) return false;

  if (ip.includes('.') && isIPv4(ip)) {
    const [first = -1, second = -1] = ip.split('.').map(Number);
    if (first === 127 || first === 0 || first === 10) return true;
    if (first === 172 && second >= 16 && second <= 31) return true;
    if (first === 192 && second === 168) return true;
    if (first === 169 && second === 254) return true;
    if (first === 100 && second >= 64 && second <= 127) return true;
    return false;
  }

  const normalized = ip.toLowerCase();
  const mappedIpv4 = ipv4FromMappedAuthOutboundIpv6(normalized);
  if (mappedIpv4) return isRestrictedAuthOutboundIp(mappedIpv4);
  return (
    normalized === '::1' ||
    normalized === '::' ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd')
  );
}

function isLoopbackAuthOutboundIp(ip: string): boolean {
  const normalized = ip.toLowerCase();
  const mappedIpv4 = ipv4FromMappedAuthOutboundIpv6(normalized);
  if (mappedIpv4) return isLoopbackAuthOutboundIp(mappedIpv4);
  if (normalized === '::1') return true;
  return isIPv4(ip) && ip.startsWith('127.');
}

function ipv4FromMappedAuthOutboundIpv6(ip: string): string | undefined {
  if (isIP(ip) !== 6) return undefined;
  const groups = parseAuthOutboundIpv6Groups(ip);
  if (!groups) return undefined;
  const isMappedPrefix =
    groups[0] === 0 &&
    groups[1] === 0 &&
    groups[2] === 0 &&
    groups[3] === 0 &&
    groups[4] === 0 &&
    groups[5] === 0xffff;
  if (!isMappedPrefix || groups[6] === undefined || groups[7] === undefined) return undefined;
  return [
    Math.floor(groups[6] / 256),
    groups[6] % 256,
    Math.floor(groups[7] / 256),
    groups[7] % 256,
  ].join('.');
}

function parseAuthOutboundIpv6Groups(ip: string): number[] | undefined {
  const normalized = normalizeAuthOutboundIpv4Tail(ip);
  if (!normalized) return undefined;
  const compressedParts = normalized.split('::');
  if (compressedParts.length > 2) return undefined;
  const left = parseAuthOutboundIpv6Side(compressedParts[0] ?? '');
  const right =
    compressedParts.length === 2 ? parseAuthOutboundIpv6Side(compressedParts[1] ?? '') : [];
  if (!left || !right) return undefined;
  const missing = 8 - left.length - right.length;
  if (compressedParts.length === 1) return missing === 0 ? [...left, ...right] : undefined;
  if (missing < 1) return undefined;
  return [...left, ...Array.from({ length: missing }, () => 0), ...right];
}

function normalizeAuthOutboundIpv4Tail(ip: string): string | undefined {
  const lastColon = ip.lastIndexOf(':');
  const possibleIpv4Tail = ip.slice(lastColon + 1);
  if (!possibleIpv4Tail.includes('.')) return ip;
  if (!isIPv4(possibleIpv4Tail)) return undefined;
  const [first = 0, second = 0, third = 0, fourth = 0] = possibleIpv4Tail.split('.').map(Number);
  return `${ip.slice(0, lastColon + 1)}${(first * 256 + second).toString(16)}:${(
    third * 256 +
    fourth
  ).toString(16)}`;
}

function parseAuthOutboundIpv6Side(side: string): number[] | undefined {
  if (side === '') return [];
  const parsed: number[] = [];
  for (const group of side.split(':')) {
    if (!/^[\da-f]{1,4}$/.test(group)) return undefined;
    parsed.push(Number.parseInt(group, 16));
  }
  return parsed;
}
