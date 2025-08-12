import { createScopedLogger } from '~/utils/logger';

const logger = createScopedLogger('rate-limiter');

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  keyGenerator?: (request: Request) => string; // Function to generate unique keys
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private _store = new Map<string, RateLimitEntry>();
  private _config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this._config = config;

    // Clean up expired entries every minute
    setInterval(() => {
      this._cleanup();
    }, 60000);
  }

  private _cleanup() {
    const now = Date.now();

    for (const [key, entry] of this._store.entries()) {
      if (entry.resetTime <= now) {
        this._store.delete(key);
      }
    }
  }

  private _getKey(request: Request): string {
    if (this._config.keyGenerator) {
      return this._config.keyGenerator(request);
    }

    // Default: use IP address or a fallback
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : 'unknown';

    return `ip:${ip}`;
  }

  checkLimit(request: Request): { allowed: boolean; resetTime?: number; remaining?: number } {
    const key = this._getKey(request);
    const now = Date.now();
    const resetTime = now + this._config.windowMs;

    let entry = this._store.get(key);

    // If no entry exists or the window has expired, create a new one
    if (!entry || entry.resetTime <= now) {
      entry = {
        count: 1,
        resetTime,
      };
      this._store.set(key, entry);

      logger.debug(`Rate limit: New window for ${key}, count: 1/${this._config.maxRequests}`);

      return {
        allowed: true,
        resetTime,
        remaining: this._config.maxRequests - 1,
      };
    }

    // Increment the count
    entry.count++;

    const allowed = entry.count <= this._config.maxRequests;
    const remaining = Math.max(0, this._config.maxRequests - entry.count);

    logger.debug(`Rate limit check for ${key}: ${entry.count}/${this._config.maxRequests}, allowed: ${allowed}`);

    return {
      allowed,
      resetTime: entry.resetTime,
      remaining,
    };
  }

  getRemainingTime(request: Request): number {
    const key = this._getKey(request);
    const entry = this._store.get(key);

    if (!entry) {
      return 0;
    }

    return Math.max(0, entry.resetTime - Date.now());
  }
}

// Create rate limiter instances for different endpoints
export const chatRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 requests per minute
  keyGenerator: (request) => {
    // Use a combination of IP and user agent for better identification
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    return `chat:${ip}:${userAgent.slice(0, 50)}`;
  },
});

export const llmCallRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20, // 20 requests per minute
  keyGenerator: (request) => {
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : 'unknown';

    return `llm:${ip}`;
  },
});

export const enhancerRateLimiter = new RateLimiter({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 15, // 15 requests per minute
  keyGenerator: (request) => {
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : 'unknown';

    return `enhancer:${ip}`;
  },
});

// Helper function to create rate limit response
export function createRateLimitResponse(resetTime: number) {
  const resetDate = new Date(resetTime);

  return new Response(
    JSON.stringify({
      error: true,
      message: 'Too Many Requests',
      statusCode: 429,
      isRetryable: true,
      resetTime: resetDate.toISOString(),
      retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': Math.ceil((resetTime - Date.now()) / 1000).toString(),
        'X-RateLimit-Reset': resetDate.toISOString(),
      },
      statusText: 'Too Many Requests',
    },
  );
}

export { RateLimiter };
