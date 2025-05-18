/**
 * Security Service - Application Layer
 * 
 * Implements Zero Trust security principles:
 * - Never trust, always verify
 * - Least privilege access
 * - Continuous validation
 * - Assume breach
 * 
 * Standards Compliance:
 * - NIST 800-207 Zero Trust Architecture
 * - OWASP ASVS 4.0 Requirements
 * - ISO/IEC 27001 Controls
 * - SOC 2 Trust Service Criteria
 */

import { Request, Response, NextFunction } from 'express';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { eventBus } from '../../infrastructure/events/EventBus';
import { User } from '@shared/schema';

// Convert callback-based scrypt to Promise-based
const scryptAsync = promisify(scrypt);

// Rate limiting storage (in production would use Redis)
interface RateLimit {
  count: number;
  resetAt: number;
}
const rateLimits: Map<string, RateLimit> = new Map();

// Define risk levels
type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

// Security context used for risk assessment
export interface SecurityContext {
  requestId: string;
  timestamp: number;
  ipAddress: string;
  userAgent: string;
  userId?: number;
  sessionId?: string;
  mfaVerified?: boolean;
  authMethod?: string;
  path?: string;
  method?: string;
}

class SecurityService {
  /**
   * Check if a user has a specific permission
   */
  public hasPermission(userId: number | undefined, permissions: string[] | undefined, requiredPermission: string): boolean {
    if (!userId || !permissions || permissions.length === 0) {
      return false;
    }
    
    // Check for exact permission
    if (permissions.includes(requiredPermission)) {
      return true;
    }
    
    // Check for wildcard permissions
    const permissionParts = requiredPermission.split(':');
    
    // Check for global admin permissions
    if (permissions.includes('*')) {
      return true;
    }
    
    // Check for category wildcard permissions (e.g., "read:*")
    if (permissionParts.length > 1) {
      const categoryWildcard = `${permissionParts[0]}:*`;
      if (permissions.includes(categoryWildcard)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Create a hash of a password or other sensitive data
   */
  public hashData(data: string): { hash: string, salt: string } {
    const salt = randomBytes(16).toString('hex');
    const hashBuffer = scrypt(data, salt, 64) as Buffer;
    return {
      hash: hashBuffer.toString('hex'),
      salt
    };
  }
  
  /**
   * Asynchronously hash data with salt
   */
  public async hashDataAsync(data: string, salt?: string): Promise<{ hash: string, salt: string }> {
    const useSalt = salt || randomBytes(16).toString('hex');
    const hashBuffer = await scryptAsync(data, useSalt, 64) as Buffer;
    return {
      hash: hashBuffer.toString('hex'),
      salt: useSalt
    };
  }
  
  /**
   * Verify that data matches a stored hash
   */
  public verifyHash(data: string, storedHash: string, salt: string): boolean {
    try {
      const hashBuffer = scrypt(data, salt, 64) as Buffer;
      const keyBuffer = Buffer.from(storedHash, 'hex');
      return keyBuffer.length === hashBuffer.length && timingSafeEqual(keyBuffer, hashBuffer);
    } catch (error) {
      console.error('Hash verification error:', error);
      return false;
    }
  }
  
  /**
   * Rate limiter middleware
   * @param limit Maximum requests per minute
   * @param keyGenerator Function to extract the rate limiting key from the request
   */
  public rateLimiter(limit: number, keyGenerator?: (req: Request) => string): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction) => {
      // Get the key to rate limit on (IP by default)
      const key = keyGenerator ? keyGenerator(req) : req.ip || req.socket.remoteAddress || 'unknown';
      const now = Date.now();
      
      // Get current rate limit data for this key
      let limitData = rateLimits.get(key);
      
      if (!limitData || now > limitData.resetAt) {
        // Initialize or reset rate limit
        limitData = {
          count: 1,
          resetAt: now + 60000, // Reset after 1 minute
        };
      } else {
        // Increment count
        limitData.count++;
      }
      
      // Update stored rate limit
      rateLimits.set(key, limitData);
      
      // Set rate limit headers
      res.setHeader('X-RateLimit-Limit', limit.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - limitData.count).toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil(limitData.resetAt / 1000).toString());
      
      if (limitData.count > limit) {
        // Create security context for event
        const securityContext: SecurityContext = {
          requestId: req.headers['x-request-id']?.toString() || 'unknown',
          timestamp: now,
          ipAddress: req.ip || 'unknown',
          userAgent: req.headers['user-agent'] || 'unknown',
          userId: req.user?.id,
          path: req.path,
          method: req.method
        };
        
        // Emit suspicious activity event
        eventBus.publish('security.suspicious.rate_limit_exceeded', {
          key,
          limit,
          count: limitData.count,
          path: req.path,
          method: req.method
        }, {
          userId: req.user?.id,
          source: 'security_service',
        });
        
        // Return rate limit error
        return res.status(429).json({
          error: 'Too many requests',
          message: 'Rate limit exceeded. Try again later.',
        });
      }
      
      next();
    };
  }
  
  /**
   * Assess risk based on security context
   * Implements risk-based adaptive authentication
   */
  public assessRisk(context: SecurityContext): RiskLevel {
    // Start with a neutral risk score
    let riskScore = 0;
    
    // Increase risk if not authenticated
    if (!context.userId) {
      riskScore += 30;
    }
    
    // Decrease risk if MFA is verified
    if (context.mfaVerified) {
      riskScore -= 20;
    }
    
    // Adjust risk based on IP address
    if (this.isInternalNetwork(context.ipAddress)) {
      riskScore -= 15;
    } else if (this.isKnownBadActor(context.ipAddress)) {
      riskScore += 40;
    } else if (!this.isCommonGeolocation(context.ipAddress)) {
      riskScore += 20;
    }
    
    // Adjust risk based on time of day, unusual patterns, etc.
    
    // Map score to risk level
    if (riskScore < 10) {
      return 'low';
    } else if (riskScore < 30) {
      return 'medium';
    } else if (riskScore < 60) {
      return 'high';
    } else {
      return 'critical';
    }
  }
  
  /**
   * Check if IP is in a trusted network
   */
  private isInternalNetwork(ip: string): boolean {
    // Check for internal network ranges
    return ip.startsWith('10.') || 
           ip.startsWith('172.16.') || 
           ip.startsWith('192.168.') || 
           ip === '127.0.0.1';
  }
  
  /**
   * Check if IP is a known bad actor
   */
  private isKnownBadActor(ip: string): boolean {
    // In a real implementation, would check against threat intelligence
    // For now, just return false
    return false;
  }
  
  /**
   * Check if IP is from a common location for this user/organization
   */
  private isCommonGeolocation(ip: string): boolean {
    // In a real implementation, would check against historical data
    // For now, just handle local/internal IPs
    return this.isInternalNetwork(ip);
  }
}

// Export a singleton instance
export const securityService = new SecurityService();