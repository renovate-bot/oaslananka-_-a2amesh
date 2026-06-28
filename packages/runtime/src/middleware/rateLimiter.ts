/**
 * @file rateLimiter.ts
 * Express middleware for per-client request throttling.
 */

import type { NextFunction, Request, Response } from 'express';
import {
  ipKeyGenerator,
  rateLimit,
  type IncrementResponse,
  type Options as ExpressRateLimitOptions,
  type Store as ExpressRateLimitStore,
} from 'express-rate-limit';
import { ErrorCodes } from '../types/jsonrpc.js';
import { makeErrorInfo } from '../utils/errors.js';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
}

export interface RateLimitState {
  count: number;
  resetTime: number;
}

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<RateLimitState>;
  destroy?(): void;
}

export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly state = new Map<string, RateLimitState>();
  private readonly cleanupInterval: NodeJS.Timeout;

  constructor(cleanupIntervalMs = 60_000) {
    this.cleanupInterval = setInterval(() => this.evict(), cleanupIntervalMs);
    this.cleanupInterval.unref?.();
  }

  async increment(key: string, windowMs: number): Promise<RateLimitState> {
    const now = Date.now();
    const current = this.state.get(key);
    if (!current || current.resetTime <= now) {
      const nextState = { count: 1, resetTime: now + windowMs };
      this.state.set(key, nextState);
      return nextState;
    }

    const nextState = { ...current, count: current.count + 1 };
    this.state.set(key, nextState);
    return nextState;
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.state.clear();
  }

  private evict(): void {
    const now = Date.now();
    for (const [key, entry] of this.state) {
      if (entry.resetTime <= now) {
        this.state.delete(key);
      }
    }
  }
}

export class SlidingWindowRateLimitStore implements RateLimitStore {
  private readonly requests = new Map<string, number[]>();

  async increment(key: string, windowMs: number): Promise<RateLimitState> {
    const now = Date.now();
    const windowStart = now - windowMs;
    const timestamps = (this.requests.get(key) ?? []).filter(
      (timestamp) => timestamp > windowStart,
    );
    timestamps.push(now);
    this.requests.set(key, timestamps);

    return {
      count: timestamps.length,
      resetTime: (timestamps[0] ?? now) + windowMs,
    };
  }

  destroy(): void {
    this.requests.clear();
  }
}

export interface RedisRateLimitClient {
  get(key: string): Promise<string | null>;
  incr(key: string): Promise<number>;
  pexpire(key: string, ttl: number): Promise<number>;
  pttl(key: string): Promise<number>;
}

export class RedisRateLimitStore implements RateLimitStore {
  constructor(private readonly client: RedisRateLimitClient) {}

  async increment(key: string, windowMs: number): Promise<RateLimitState> {
    const current = await this.client.get(key);
    if (current === null) {
      await this.client.incr(key);
      await this.client.pexpire(key, windowMs);
      return {
        count: 1,
        resetTime: Date.now() + windowMs,
      };
    }

    const count = await this.client.incr(key);
    const ttl = await this.client.pttl(key);
    return {
      count,
      resetTime: Date.now() + Math.max(ttl, 0),
    };
  }
}

function getClientIp(req: Request): string {
  return ipKeyGenerator(req.ip || req.socket.remoteAddress || 'unknown');
}

/**
 * Adapts the A2A Mesh rate-limit store to express-rate-limit.
 *
 * The internal store contract increments monotonically until the window resets, so per-key
 * decrement and reset hooks are intentionally no-ops unless a future store adds that support.
 */
class ExpressRateLimitStoreAdapter implements ExpressRateLimitStore {
  private windowMs = 60_000;

  constructor(private readonly store: RateLimitStore) {}

  init(options: ExpressRateLimitOptions): void {
    this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<IncrementResponse> {
    const state = await this.store.increment(key, this.windowMs);
    return {
      totalHits: state.count,
      resetTime: new Date(state.resetTime),
    };
  }

  decrement(_key: string): void {
    // The A2A Mesh store contract is monotonic within a window.
  }

  resetKey(_key: string): void {
    // Per-key reset is not part of the public A2A Mesh store contract.
  }

  shutdown(): void {
    this.store.destroy?.();
  }
}

function rateLimitExceededPayload(req: Request) {
  const rateLimitInfo = (req as Request & { rateLimit?: { resetTime?: Date } }).rateLimit;
  const resetTimeMs = rateLimitInfo?.resetTime?.getTime() ?? Date.now();

  return {
    jsonrpc: '2.0',
    error: {
      code: ErrorCodes.RateLimitExceeded,
      message: 'Too Many Requests',
      data: makeErrorInfo('RATE_LIMIT_EXCEEDED', {
        retryAfterMs: String(Math.max(resetTimeMs - Date.now(), 0)),
      }),
    },
    id: req.body && typeof req.body === 'object' && 'id' in req.body ? req.body.id : null,
  };
}

export function createExpressRateLimitOptions(
  config: Partial<RateLimitConfig> = {},
  store: RateLimitStore = new InMemoryRateLimitStore(),
): Partial<ExpressRateLimitOptions> {
  const windowMs = config.windowMs ?? 60_000;
  const maxRequests = config.maxRequests ?? 100;
  const resolvedKeyGenerator = config.keyGenerator ?? getClientIp;

  return {
    windowMs,
    limit: maxRequests,
    legacyHeaders: true,
    standardHeaders: false,
    keyGenerator: (req) => resolvedKeyGenerator(req),
    store: new ExpressRateLimitStoreAdapter(store),
    handler: (req, res) => {
      res.status(429).json(rateLimitExceededPayload(req));
    },
    validate: {
      xForwardedForHeader: false,
      keyGeneratorIpFallback: false,
    },
  };
}

/**
 * Create an Express middleware that enforces per-client request limits and emits JSON-RPC errors.
 *
 * @param config Partial limiter configuration.
 * @param store Optional backing store implementation.
 * @returns Express-compatible async middleware.
 * @since 1.0.0
 */
export function createRateLimiter(
  config: Partial<RateLimitConfig> = {},
  store: RateLimitStore = new InMemoryRateLimitStore(),
) {
  return rateLimit(createExpressRateLimitOptions(config, store)) as (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => void | Promise<void>;
}
