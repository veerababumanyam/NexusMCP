/**
 * Rate Limiter Utility
 * 
 * Provides configurable rate limiting for API endpoints
 */

import rateLimit, { Options } from 'express-rate-limit';

/**
 * Rate limiting strategy
 */
export enum RateLimitStrategy {
  FIXED_WINDOW = 'fixed-window',
  SLIDING_WINDOW = 'sliding-window'
}

/**
 * Creates a rate limiter middleware with the specified options
 * @param options Rate limiter options
 * @returns Rate limiter middleware
 */
export function createRateLimiter(options: {
  windowMs: number;
  max: number;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  skipSuccessfulRequests?: boolean;
  type?: RateLimitStrategy;
}) {
  const {
    windowMs,
    max,
    message = 'Too many requests, please try again later.',
    standardHeaders = true,
    legacyHeaders = false,
    skipSuccessfulRequests = false,
    type = RateLimitStrategy.SLIDING_WINDOW
  } = options;

  const config: Options = {
    windowMs,
    max,
    standardHeaders,
    legacyHeaders,
    message,
    skipSuccessfulRequests
  };

  // Optional typing for specific limiter implementations
  if (type) {
    (config as any).type = type;
  }

  return rateLimit(config);
}