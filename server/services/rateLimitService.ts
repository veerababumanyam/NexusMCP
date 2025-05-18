import { Request, Response, NextFunction } from 'express';
import { rateLimit, Options, RateLimitRequestHandler } from 'express-rate-limit';
import { storage } from '../storage';

/**
 * Rate limiting types
 */
export enum RateLimitType {
  IP = 'ip',
  USER = 'user',
  API_KEY = 'api_key',
  CUSTOM = 'custom'
}

/**
 * Rate limiting strategies
 */
export enum RateLimitStrategy {
  FIXED = 'fixed',         // Fixed window - resets after windowMs
  SLIDING = 'sliding',     // Sliding window
  TOKEN_BUCKET = 'token',  // Token bucket algorithm
  LEAKY_BUCKET = 'leaky'   // Leaky bucket algorithm
}

/**
 * Rate limit configuration for a specific endpoint or route
 */
export interface RateLimitConfig {
  type: RateLimitType;
  strategy: RateLimitStrategy;
  windowMs: number;
  maxRequests: number;
  message?: string | object;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

/**
 * Service for creating and managing rate limiters across the application
 */
export class RateLimitService {
  private limiters: Map<string, RateLimitRequestHandler> = new Map();
  private configs: Map<string, RateLimitConfig> = new Map();
  
  constructor() {
    console.log('Rate Limit Service initialized');
  }
  
  /**
   * Create a new rate limiter with the given options
   */
  public createRateLimiter(options: Options): RateLimitRequestHandler {
    return rateLimit(options);
  }
  
  /**
   * Create and register a rate limiter for a specific route/endpoint
   */
  public create(
    name: string, 
    options: Options
  ): RateLimitRequestHandler {
    // If already exists, return it
    if (this.limiters.has(name)) {
      return this.limiters.get(name)!;
    }
    
    // Create and save the rate limiter
    const limiter = this.createRateLimiter(options);
    this.limiters.set(name, limiter);
    
    return limiter;
  }
  
  /**
   * Get a registered rate limiter by name
   */
  public get(name: string): RateLimitRequestHandler | undefined {
    return this.limiters.get(name);
  }
  
  /**
   * Apply multiple rate limiters with different conditions
   */
  public applyMultipleLimiters(configs: {
    name: string;
    condition: (req: Request) => boolean;
    limiter: RateLimitRequestHandler;
  }[]): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction) => {
      // Find the first applicable limiter
      const config = configs.find(c => c.condition(req));
      
      if (config) {
        config.limiter(req, res, next);
      } else {
        next();
      }
    };
  }
  
  /**
   * Create a rate limiter specific to a user
   */
  public createUserLimiter(
    windowMs: number = 60 * 1000, // 1 minute
    maxRequests: number = 100
  ): RateLimitRequestHandler {
    return this.createRateLimiter({
      windowMs,
      max: maxRequests,
      standardHeaders: true,
      keyGenerator: (req: Request) => {
        return req.user ? `user_${req.user.id}` : req.ip;
      },
      handler: (req: Request, res: Response) => {
        const userId = req.user?.id;
        if (userId) {
          // Log rate limit events for users
          storage.createAuditLog({
            userId,
            action: 'rate_limit_exceeded',
            resourceType: 'api',
            resourceId: req.originalUrl,
            details: {
              method: req.method,
              path: req.path,
              limit: maxRequests,
              windowMs
            },
            ipAddress: req.ip
          }).catch(err => console.error('Failed to log rate limit event:', err));
        }
        
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'You have exceeded the request rate limit. Please try again later.'
        });
      }
    });
  }
  
  /**
   * Create a rate limiter specific to an IP address
   */
  public createIpLimiter(
    windowMs: number = 60 * 1000, // 1 minute
    maxRequests: number = 60
  ): RateLimitRequestHandler {
    return this.createRateLimiter({
      windowMs,
      max: maxRequests,
      standardHeaders: true,
      handler: (req: Request, res: Response) => {
        // Log aggressive rate limiting for security monitoring
        if (req.user?.id) {
          storage.createAuditLog({
            userId: req.user.id,
            action: 'rate_limit_exceeded',
            resourceType: 'api',
            resourceId: req.originalUrl,
            details: {
              method: req.method,
              path: req.path,
              limit: maxRequests,
              windowMs,
              ip: req.ip
            },
            ipAddress: req.ip
          }).catch(err => console.error('Failed to log rate limit event:', err));
        }
        
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded for this IP address. Please try again later.'
        });
      }
    });
  }
  
  /**
   * Create a rate limiter specific to an API key
   */
  public createApiKeyLimiter(
    windowMs: number = 60 * 1000, // 1 minute
    maxRequests: number = 120
  ): RateLimitRequestHandler {
    return this.createRateLimiter({
      windowMs,
      max: maxRequests,
      standardHeaders: true,
      keyGenerator: (req: Request) => {
        // Extract API key from request (headers, query, etc.)
        const apiKey = req.headers['x-api-key'] || 
                       req.query.api_key || 
                       'unknown';
                       
        return `api_key_${apiKey}`;
      },
      handler: (req: Request, res: Response) => {
        const apiKey = req.headers['x-api-key'] || 
                      req.query.api_key || 
                      'unknown';
        
        // Log rate limit events for API keys
        storage.createAuditLog({
          userId: req.user?.id,
          action: 'rate_limit_exceeded',
          resourceType: 'api_key',
          resourceId: apiKey.toString(),
          details: {
            method: req.method,
            path: req.path,
            limit: maxRequests,
            windowMs
          },
          ipAddress: req.ip
        }).catch(err => console.error('Failed to log rate limit event:', err));
        
        res.status(429).json({
          error: 'Too Many Requests',
          message: 'API key rate limit exceeded. Please try again later or upgrade your plan.'
        });
      }
    });
  }
}

export const rateLimitService = new RateLimitService();

/**
 * Helper function to create a rate limiter
 */
export function createRateLimiter(options: Options): RateLimitRequestHandler {
  return rateLimitService.createRateLimiter(options);
}