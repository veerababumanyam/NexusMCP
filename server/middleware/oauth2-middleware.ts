/**
 * OAuth2 Client Credentials Middleware
 * 
 * This middleware validates OAuth 2.0 Bearer tokens for protected API endpoints
 * and implements scope-based authorization for machine-to-machine communication.
 */

import { Request, Response, NextFunction } from 'express';
import { OAuth2ClientCredentialsService } from '../services/oauth/OAuth2ClientCredentialsService';

// Initialize OAuth service
const oauthService = new OAuth2ClientCredentialsService();

/**
 * Express middleware to require a valid OAuth2 token
 */
export function requireOAuth() {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'unauthorized',
          error_description: 'Missing or invalid authorization token'
        });
      }

      // Extract the token
      const token = authHeader.substring(7);
      
      // Validate the token
      const tokenInfo = await oauthService.validateToken(token);
      if (!tokenInfo) {
        return res.status(401).json({
          error: 'invalid_token',
          error_description: 'The access token provided is expired, revoked, or invalid'
        });
      }
      
      // Add token info to request for use in route handlers
      req.oauthClient = {
        id: tokenInfo.clientId,
        scopes: tokenInfo.scopes
      };
      
      next();
    } catch (error) {
      console.error('OAuth validation error:', error);
      res.status(500).json({
        error: 'server_error',
        error_description: 'An error occurred while validating the token'
      });
    }
  };
}

/**
 * Express middleware to require specific OAuth2 scopes
 * 
 * @param requiredScopes - Array of scopes required for the endpoint
 */
export function requireScopes(requiredScopes: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Make sure requireOAuth middleware has been run first
    if (!req.oauthClient) {
      return res.status(401).json({
        error: 'unauthorized',
        error_description: 'OAuth token validation required before scope check'
      });
    }
    
    // Check if token has all required scopes
    const hasAllScopes = requiredScopes.every(scope => 
      req.oauthClient.scopes.includes(scope)
    );
    
    if (!hasAllScopes) {
      return res.status(403).json({
        error: 'insufficient_scope',
        error_description: 'The token does not have the required scopes',
        scope: requiredScopes.join(' ')
      });
    }
    
    next();
  };
}

// Extend Express Request interface to include OAuth client info
declare global {
  namespace Express {
    interface Request {
      oauthClient?: {
        id: string;
        scopes: string[];
      };
    }
  }
}