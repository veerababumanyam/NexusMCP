/**
 * OAuth Routes Registration
 * 
 * This file registers all OAuth-related routes in the Express application
 */

import { Express } from 'express';
import oauthRouter from './oauth-routes';
import { rateLimitService, RateLimitType, RateLimitStrategy } from '../services/rateLimitService';

/**
 * Register OAuth routes with the main Express app
 */
export function registerOAuthRoutes(app: Express): void {
  // Add rate limiting to token endpoint to prevent abuse
  const tokenRateLimit = rateLimitService.createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 token requests per minute
    standardHeaders: true,
    message: 'Too many token requests, please try again later'
  });
  
  // Register the OAuth routes
  app.use('/api/oauth', tokenRateLimit, oauthRouter);
  
  console.log('OAuth routes registered');
}