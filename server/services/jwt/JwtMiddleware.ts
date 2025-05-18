import { Request, Response, NextFunction } from 'express';
import { JwtService } from './JwtService';
import { User } from '@shared/schema';
import { db } from '../../../db';
import { jwtTokenAudit } from '@shared/schema_jwt';
import logger from '../../../server/logger';
import { eq } from 'drizzle-orm';

export interface JwtMiddlewareOptions {
  required?: boolean;
  audience?: string | string[];
  issuer?: string | string[];
  settingsId?: number;
}

/**
 * JwtMiddleware for handling JWT authentication and validation
 */
export class JwtMiddleware {
  private static instance: JwtMiddleware;
  private jwtService: JwtService;

  private constructor() {
    this.jwtService = JwtService.getInstance();
  }

  /**
   * Get the singleton instance of JwtMiddleware
   */
  public static getInstance(): JwtMiddleware {
    if (!JwtMiddleware.instance) {
      JwtMiddleware.instance = new JwtMiddleware();
    }
    return JwtMiddleware.instance;
  }

  /**
   * Create an Express middleware function for JWT authentication
   * 
   * @param options Options for JWT validation
   * @returns Express middleware function
   */
  public createMiddleware(options: JwtMiddlewareOptions = {}) {
    const { required = true, audience, issuer, settingsId } = options;

    return async (req: Request, res: Response, next: NextFunction) => {
      const authHeader = req.headers.authorization;

      // Skip authentication if not required and no token is provided
      if (!required && !authHeader) {
        return next();
      }

      // Check if auth header exists and has the correct format
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        if (required) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Authentication required. Bearer token missing or invalid.'
          });
        } else {
          return next();
        }
      }

      // Extract the token
      const token = authHeader.split(' ')[1];

      try {
        // Verify the token
        const decoded = await this.jwtService.verifyToken(token, settingsId);

        // Check token revocation
        if (decoded.jti) {
          const isRevoked = await this.jwtService.isTokenRevoked(decoded.jti);
          if (isRevoked) {
            return res.status(401).json({
              error: 'Unauthorized',
              message: 'Token has been revoked.'
            });
          }
        }

        // Verify audience if specified
        if (audience && decoded.aud) {
          const audArray = Array.isArray(decoded.aud) ? decoded.aud : [decoded.aud];
          const audToCheck = Array.isArray(audience) ? audience : [audience];
          
          if (!audToCheck.some(aud => audArray.includes(aud))) {
            return res.status(401).json({
              error: 'Unauthorized',
              message: 'Token audience is invalid.'
            });
          }
        }

        // Verify issuer if specified
        if (issuer && decoded.iss) {
          const issArray = Array.isArray(issuer) ? issuer : [issuer];
          
          if (!issArray.includes(decoded.iss)) {
            return res.status(401).json({
              error: 'Unauthorized',
              message: 'Token issuer is invalid.'
            });
          }
        }

        // If we have a user ID in the token, load the user
        if (decoded.sub) {
          try {
            const userId = parseInt(decoded.sub);
            if (!isNaN(userId)) {
              const user = await db.query.users.findFirst({
                where: eq(db.schema.users.id, userId)
              });

              if (user) {
                // Attach user to request object
                req.user = { ...user, role: user.role || 'user' } as User;
              }
            }
          } catch (error) {
            logger.warn('Error loading user from JWT token', { error });
            // Continue without user - this may or may not be a problem depending on the endpoint
          }
        }

        // Attach decoded token to request for route handlers
        req.token = decoded;

        // Call next middleware
        next();
      } catch (error) {
        logger.error('JWT verification error', { error });
        
        if (required) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid token.'
          });
        } else {
          // Continue without authentication if not required
          next();
        }
      }
    };
  }

  /**
   * Create middleware for specific roles
   * 
   * @param roles Array of required roles
   * @param options JWT middleware options
   * @returns Express middleware function
   */
  public requireRoles(roles: string[], options: JwtMiddlewareOptions = {}) {
    const jwtMiddleware = this.createMiddleware({ ...options, required: true });

    return async (req: Request, res: Response, next: NextFunction) => {
      // First run the JWT middleware
      jwtMiddleware(req, res, (err: any) => {
        if (err) return next(err);

        // Check if user exists
        if (!req.user) {
          return res.status(401).json({
            error: 'Unauthorized',
            message: 'Authentication required.'
          });
        }

        // Check if user has required role
        if (!req.user.role || !roles.includes(req.user.role)) {
          return res.status(403).json({
            error: 'Forbidden',
            message: 'Insufficient permissions.'
          });
        }

        // User has required role, proceed
        next();
      });
    };
  }

  /**
   * Create middleware that requires admin role
   * 
   * @param options JWT middleware options
   * @returns Express middleware function
   */
  public requireAdmin(options: JwtMiddlewareOptions = {}) {
    return this.requireRoles(['admin'], options);
  }

  /**
   * Record token usage
   * 
   * @param req Express request
   * @param tokenId JWT token ID
   */
  public async recordTokenUsage(req: Request, tokenId: string): Promise<void> {
    try {
      // Record the token usage
      await db.insert(jwtTokenAudit)
        .values({
          tokenId,
          issuedAt: new Date(),
          expiresAt: new Date(Date.now() + 3600 * 1000), // Default 1 hour expiration
          clientIp: req.ip,
          userAgent: req.headers['user-agent'],
          purpose: 'api_access'
        });
    } catch (error) {
      logger.error('Error recording token usage', { error, tokenId });
      // Don't throw error, just log it
    }
  }
}