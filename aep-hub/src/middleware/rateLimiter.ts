import { Request, Response, NextFunction } from 'express';

/**
 * Rate limiter configuration
 */
export interface RateLimiterConfig {
  /**
   * Maximum requests allowed in the window
   */
  limit: number;

  /**
   * Window size in seconds
   */
  windowSeconds: number;

  /**
   * Function to extract identifier from request (default: IP-based)
   */
  keyExtractor?: (req: Request) => string;

  /**
   * Custom key prefix for storage
   */
  keyPrefix?: string;
}

/**
 * In-memory rate limit entry
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * In-memory rate limiter for development/testing
 * For production, replace with Redis-backed implementation
 */
export class InMemoryRateLimiter {
  private store: Map<string, RateLimitEntry> = new Map();
  private config: RateLimiterConfig;

  constructor(config: RateLimiterConfig) {
    this.config = config;

    // Cleanup expired entries every minute
    setInterval(() => this.cleanup(), 60000);
  }

  /**
   * Check if request is allowed
   * Returns { allowed: true } or { allowed: false, retryAfter: seconds }
   */
  check(key: string): { allowed: true } | { allowed: false; retryAfter: number } {
    const now = Date.now();
    const fullKey = `${this.config.keyPrefix || 'rl'}:${key}`;
    const entry = this.store.get(fullKey);

    // If no entry or window expired, create new entry
    if (!entry || now > entry.resetAt) {
      this.store.set(fullKey, {
        count: 1,
        resetAt: now + (this.config.windowSeconds * 1000),
      });
      return { allowed: true };
    }

    // Check if limit exceeded
    if (entry.count >= this.config.limit) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      return { allowed: false, retryAfter };
    }

    // Increment counter
    entry.count++;
    return { allowed: true };
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    const fullKey = `${this.config.keyPrefix || 'rl'}:${key}`;
    this.store.delete(fullKey);
  }

  /**
   * Get remaining requests for a key
   */
  getRemaining(key: string): number {
    const now = Date.now();
    const fullKey = `${this.config.keyPrefix || 'rl'}:${key}`;
    const entry = this.store.get(fullKey);

    if (!entry || now > entry.resetAt) {
      return this.config.limit;
    }

    return Math.max(0, this.config.limit - entry.count);
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetAt) {
        this.store.delete(key);
      }
    }
  }
}

/**
 * Default rate limiter for publish endpoint
 * 10 requests per minute per agent
 */
export const publishRateLimiter = new InMemoryRateLimiter({
  limit: 10,
  windowSeconds: 60,
  keyPrefix: 'publish',
});

/**
 * Create rate limiting middleware
 */
export function rateLimitMiddleware(
  limiter: InMemoryRateLimiter,
  keyExtractor: (req: Request) => string
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyExtractor(req);
    const result = limiter.check(key);

    if (!result.allowed) {
      res.status(429).json({
        error: 'rate_limited',
        message: `Publish rate limit exceeded. Maximum ${limiter['config'].limit} requests per ${limiter['config'].windowSeconds} seconds.`,
        retry_after: result.retryAfter,
      });
      return;
    }

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', limiter['config'].limit);
    res.setHeader('X-RateLimit-Remaining', limiter.getRemaining(key));

    next();
  };
}

/**
 * Express middleware for publish rate limiting
 */
export function publishRateLimitMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Extract agent ID from request (should be attached by auth middleware)
  const agentId = (req as any).agentId || req.ip || 'unknown';

  const result = publishRateLimiter.check(agentId);

  if (!result.allowed) {
    res.status(429).json({
      error: 'rate_limited',
      message: `Publish rate limit exceeded. Maximum 10 requests per minute.`,
      retry_after: result.retryAfter,
    });
    return;
  }

  // Add rate limit headers
  res.setHeader('X-RateLimit-Limit', 10);
  res.setHeader('X-RateLimit-Remaining', publishRateLimiter.getRemaining(agentId));

  next();
}
