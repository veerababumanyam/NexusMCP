/**
 * Zero Trust Configuration - Infrastructure Layer
 * 
 * Implements NIST 800-207 Zero Trust Architecture principles:
 * 1. All resources treated as hostile
 * 2. All communication must be secured
 * 3. Access granted per-session with strict verification
 * 4. Access determined by multiple attributes (dynamic policies)
 * 5. All resources monitored and validated continuously
 * 6. Access enforcement is dynamic and strictly enforced
 * 7. Authentication and authorization are dynamic and continuously evaluated
 * 
 * This class configures the express middleware and security settings.
 */

import { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import express from 'express';
import { randomUUID } from 'crypto';
import { eventBus } from '../events/EventBus';
import { securityService, SecurityContext } from '../../application/security/SecurityService';

// Request with additional security properties
export interface EnhancedRequest extends Request {
  requestId: string;
  startTime: number;
  riskLevel?: string;
}

// Authenticated Request
export interface AuthenticatedRequest extends EnhancedRequest {
  isAuthenticated(): boolean;
}

// Security policy for endpoints
export interface SecurityPolicy {
  requireAuth?: boolean;
  requireMfa?: boolean;
  permissions?: string[];
  maxRiskLevel?: string;
  rateLimitPerMinute?: number;
}

/**
 * Configure Express app with Zero Trust security principles
 */
export class ZeroTrustConfig {
  constructor(private app: Express) {}
  
  /**
   * Initialize all Zero Trust security middleware
   */
  public initialize(): void {
    this.configureSecurityHeaders();
    this.configureRequest();
    this.configureErrorHandling();
    this.configureMethodOverride();
    this.configureRequestLogging();
    this.configureSessionValidation();
  }
  
  /**
   * Apply security headers using Helmet
   */
  private configureSecurityHeaders(): void {
    // Set strict security headers
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"], // Unsafe inline for development only
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          connectSrc: ["'self'", "ws:", "wss:"], // Allow WebSocket connections
          fontSrc: ["'self'"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      xssFilter: true,
      hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true,
      },
      noSniff: true,
      referrerPolicy: { policy: 'same-origin' },
    }));
    
    // Prevent clickjacking attacks
    this.app.use(helmet.frameguard({ action: 'deny' }));
    
    // Set Cache-Control headers
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      next();
    });
  }
  
  /**
   * Configure request enhancement middleware
   */
  private configureRequest(): void {
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      // Add unique ID to each request for tracking
      const requestId = req.headers['x-request-id'] || randomUUID();
      (req as EnhancedRequest).requestId = requestId.toString();
      res.setHeader('X-Request-ID', requestId);
      
      // Track request start time for performance monitoring
      (req as EnhancedRequest).startTime = Date.now();
      
      // Add security context for risk assessment
      const securityContext: SecurityContext = {
        requestId: (req as EnhancedRequest).requestId,
        timestamp: (req as EnhancedRequest).startTime,
        ipAddress: req.ip || req.socket.remoteAddress || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        userId: req.user?.id,
        sessionId: req.session?.id,
        mfaVerified: req.session?.mfaVerified || false,
        path: req.path,
        method: req.method,
        authMethod: req.session?.authMethod || 'none'
      };
      
      // Assess risk level for this request
      const riskLevel = securityService.assessRisk(securityContext);
      (req as EnhancedRequest).riskLevel = riskLevel;
      
      // Add risk level header (in development only, would be internal only in production)
      if (process.env.NODE_ENV === 'development') {
        res.setHeader('X-Risk-Level', riskLevel);
      }
      
      // Validate session on every request
      if (req.session && req.isAuthenticated()) {
        // Continuously validate session integrity
        if (riskLevel === 'critical') {
          // Force re-authentication for critical risk
          req.logout((err) => {
            if (err) {
              console.error('Error during forced logout:', err);
            }
            
            // Log security event
            eventBus.publish('security.session.terminated', {
              reason: 'critical_risk_level',
              riskLevel,
              path: req.path,
              method: req.method
            }, {
              userId: req.user?.id,
              source: 'zero_trust_middleware'
            });
            
            // Redirect to login for GET requests
            if (req.method === 'GET') {
              return res.redirect('/auth?reason=security');
            }
            
            // Return 401 for API requests
            return res.status(401).json({
              error: 'Session terminated due to security concerns',
              requireReauthentication: true
            });
          });
          return;
        }
        
        // For high risk, require MFA validation if not already done
        if (riskLevel === 'high' && !req.session.mfaVerified && req.session.mfaRequired) {
          return res.status(403).json({
            error: 'Multi-factor authentication required',
            requireMfa: true
          });
        }
      }
      
      next();
    });
  }
  
  /**
   * Configure error handling middleware
   */
  private configureErrorHandling(): void {
    // JSON body parser with size limits
    this.app.use(express.json({ limit: '1mb' }));
    
    // Handle invalid JSON
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      if (err instanceof SyntaxError && 'body' in err) {
        // Log security event - potential JSON injection
        eventBus.publish('security.input_validation.json_error', {
          error: err.message,
          path: req.path,
          method: req.method,
          ip: req.ip
        }, {
          userId: req.user?.id,
          source: 'zero_trust_middleware'
        });
        
        return res.status(400).json({
          error: 'Invalid JSON',
          message: 'The request contains malformed JSON.'
        });
      }
      next(err);
    });
  }
  
  /**
   * Protect against HTTP Method override attacks
   */
  private configureMethodOverride(): void {
    // Only allow GET and POST for HTML forms, all others through API
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      // Block method override attempts
      if (req.headers['x-http-method-override']) {
        eventBus.publish('security.suspicious.method_override_attempt', {
          method: req.method,
          override: req.headers['x-http-method-override'],
          path: req.path,
          ip: req.ip
        }, {
          userId: req.user?.id,
          source: 'zero_trust_middleware'
        });
        
        return res.status(400).json({
          error: 'Method override not allowed',
          message: 'HTTP method override is not permitted in this application.'
        });
      }
      next();
    });
  }
  
  /**
   * Configure request logging for audit and monitoring
   */
  private configureRequestLogging(): void {
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      // Log all requests for audit trail
      const startTime = (req as EnhancedRequest).startTime;
      
      // Capture response data for auditing
      const originalEnd = res.end;
      res.end = function(chunk?: any, encoding?: any) {
        // Calculate response time
        const responseTime = Date.now() - startTime;
        
        // Add response time header
        res.setHeader('X-Response-Time', `${responseTime}ms`);
        
        // Log the request for audit purposes (sensitive routes only)
        const isSensitiveRoute = req.path.includes('/api/auth') || 
                                req.path.includes('/api/admin') ||
                                req.path.includes('/api/mcp');
        
        if (isSensitiveRoute) {
          eventBus.publish('audit.http_request', {
            requestId: (req as EnhancedRequest).requestId,
            path: req.path,
            method: req.method,
            statusCode: res.statusCode,
            responseTime,
            userAgent: req.headers['user-agent'],
            ip: req.ip
          }, {
            userId: req.user?.id,
            source: 'zero_trust_middleware'
          });
        }
        
        return originalEnd.apply(res, [chunk, encoding]);
      };
      
      next();
    });
  }
  
  /**
   * Special handling for authenticated sessions
   */
  private configureSessionValidation(): void {
    // Session validation middleware to check session age
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      // Skip for unauthenticated requests
      if (!req.session || !req.isAuthenticated()) {
        return next();
      }
      
      // Get session creation time
      const now = Date.now();
      const sessionStartTime = req.session.cookie.expires?.getTime() || 0;
      
      // Check session age - force re-authentication after a set time
      const SESSION_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours
      if (now - sessionStartTime > SESSION_MAX_AGE) {
        req.logout((err) => {
          if (err) {
            console.error('Error during session expiration logout:', err);
          }
          
          // Log security event
          eventBus.publish('security.session.expired', {
            reason: 'max_age_exceeded',
            path: req.path,
            method: req.method
          }, {
            userId: req.user?.id,
            source: 'zero_trust_middleware'
          });
          
          if (req.method === 'GET') {
            return res.redirect('/auth?reason=session_expired');
          }
          
          return res.status(401).json({
            error: 'Session expired',
            requireReauthentication: true
          });
        });
        return;
      }
      
      next();
    });
  }
  
  /**
   * Create security policy middleware for routes
   * @param policy The security policy to apply
   */
  public createPolicyMiddleware(policy: SecurityPolicy) {
    return (req: Request, res: Response, next: NextFunction) => {
      // Check authentication if required
      if (policy.requireAuth && !req.isAuthenticated()) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'You must be logged in to access this resource.'
        });
      }
      
      // Check MFA if required
      if (policy.requireMfa && (!req.session?.mfaVerified)) {
        return res.status(403).json({
          error: 'MFA required',
          message: 'Multi-factor authentication is required to access this resource.',
          requireMfa: true
        });
      }
      
      // Check permissions if specified
      if (policy.permissions && policy.permissions.length > 0 && req.user) {
        const user = req.user as User;
        let hasPermission = false;
        
        // Check each required permission
        for (const permission of policy.permissions) {
          if (securityService.hasPermission(user.id, user.permissions, permission)) {
            hasPermission = true;
            break;
          }
        }
        
        if (!hasPermission) {
          // Log access denied event
          eventBus.publish('security.access_denied.permission', {
            requiredPermissions: policy.permissions,
            userPermissions: user.permissions,
            path: req.path,
            method: req.method
          }, {
            userId: user.id,
            source: 'zero_trust_policy'
          });
          
          return res.status(403).json({
            error: 'Insufficient permissions',
            message: 'You do not have the required permissions to access this resource.'
          });
        }
      }
      
      // Check risk level if specified
      if (policy.maxRiskLevel && (req as EnhancedRequest).riskLevel) {
        const riskLevel = (req as EnhancedRequest).riskLevel;
        const riskLevels = ['low', 'medium', 'high', 'critical'];
        const maxAllowedIndex = riskLevels.indexOf(policy.maxRiskLevel);
        const currentIndex = riskLevels.indexOf(riskLevel);
        
        if (currentIndex > maxAllowedIndex) {
          // Log access denied due to risk level
          eventBus.publish('security.access_denied.risk_level', {
            requiredMaxRiskLevel: policy.maxRiskLevel,
            currentRiskLevel: riskLevel,
            path: req.path,
            method: req.method
          }, {
            userId: req.user?.id,
            source: 'zero_trust_policy'
          });
          
          return res.status(403).json({
            error: 'Security risk too high',
            message: 'Access denied due to security risk assessment.'
          });
        }
      }
      
      // Apply rate limiting if specified
      if (policy.rateLimitPerMinute) {
        const rateLimiter = securityService.rateLimiter(policy.rateLimitPerMinute);
        return rateLimiter(req, res, next);
      }
      
      next();
    };
  }
  
  /**
   * Helper method to check if request is authenticated
   */
  public static isAuthenticated(req: Request): req is AuthenticatedRequest {
    return req.isAuthenticated();
  }
}

// Export singleton instance creator
export function createZeroTrustConfig(app: Express): ZeroTrustConfig {
  return new ZeroTrustConfig(app);
}