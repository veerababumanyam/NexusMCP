/**
 * Auth Controller - Presentation Layer
 * 
 * Handles authentication and authorization requests
 * Implements:
 * - NIST 800-63-3 Digital Identity Guidelines
 * - OWASP ASVS 4.0 Authentication Requirements
 * - ISO/IEC 29115:2013 Entity Authentication Assurance
 */

import { Request, Response, NextFunction } from 'express';
import { BaseController } from './BaseController';
import { userService } from '../application/services/UserService';
import { securityService, SecurityEventTypes } from '../application/security/SecurityService';
import { localLoginSchema, insertUserSchema, mfaVerificationSchema } from '../../shared/schema';
import { eventBus } from '../infrastructure/events/EventBus';

export class AuthController extends BaseController {
  /**
   * Handle user registration
   */
  public register = this.createValidatedHandler(insertUserSchema, async (req, res, data) => {
    try {
      const newUser = await userService.registerUser({
        username: data.username,
        password: data.password,
        email: data.email,
        fullName: data.fullName
      });
      
      if (!newUser) {
        return this.sendError(res, 'Failed to create user', 500);
      }
      
      // Log the security event
      await eventBus.publish(
        SecurityEventTypes.AUTH_SUCCESS,
        { 
          action: 'register',
          username: data.username
        },
        {
          userId: newUser.id,
          source: 'AuthController'
        }
      );
      
      // Auto-login the user
      req.login(newUser, (err) => {
        if (err) {
          return this.sendError(res, 'Registration successful but login failed', 500);
        }
        
        // Remove sensitive data before sending response
        const { password, ...userWithoutPassword } = newUser;
        return this.sendSuccess(res, userWithoutPassword, 201);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      return this.sendError(res, message, 400);
    }
  });
  
  /**
   * Handle user login
   */
  public login = this.createValidatedHandler(localLoginSchema, async (req, res, data) => {
    try {
      // Get security context for risk assessment
      const securityContext = this.getSecurityContext(req);
      
      // Get user by username
      const user = await userService.getUserByUsername(data.username);
      if (!user || !user.password) {
        // Publish failed login event
        await eventBus.publish(
          SecurityEventTypes.AUTH_FAILURE,
          { 
            username: data.username,
            reason: 'invalid_credentials',
            ipAddress: securityContext.ipAddress,
            userAgent: securityContext.userAgent
          },
          {
            source: 'AuthController'
          }
        );
        
        return this.sendError(res, 'Invalid username or password', 401);
      }
      
      // Verify password
      const passwordValid = await userService.verifyPassword(data.password, user.password);
      if (!passwordValid) {
        // Publish failed login event
        await eventBus.publish(
          SecurityEventTypes.AUTH_FAILURE,
          { 
            userId: user.id,
            username: user.username,
            reason: 'invalid_password',
            ipAddress: securityContext.ipAddress,
            userAgent: securityContext.userAgent
          },
          {
            userId: user.id,
            source: 'AuthController'
          }
        );
        
        return this.sendError(res, 'Invalid username or password', 401);
      }
      
      // Check if account is active
      if (!user.isActive) {
        return this.sendError(res, 'Account is disabled', 403);
      }
      
      // Assess risk level
      const riskLevel = securityService.assessRisk(securityContext);
      
      // Check if MFA is required
      if (user.mfaEnabled) {
        // Store session data for MFA verification
        if (req.session) {
          req.session.mfaRequired = true;
          req.session.mfaVerified = false;
          req.session.userId = user.id;
        }
        
        // Publish MFA challenge event
        await eventBus.publish(
          SecurityEventTypes.MFA_CHALLENGED,
          { 
            userId: user.id,
            username: user.username,
            preferredMethod: user.preferredMfaMethod || 'totp'
          },
          {
            userId: user.id,
            source: 'AuthController'
          }
        );
        
        return this.sendSuccess(res, {
          mfaRequired: true,
          userId: user.id,
          preferredMethod: user.preferredMfaMethod || 'totp'
        }, 200);
      }
      
      // Create session and login user
      req.login(user, async (err) => {
        if (err) {
          return this.sendError(res, 'Login failed', 500);
        }
        
        // Set session data
        if (req.session) {
          req.session.authMethod = 'local';
          req.session.mfaVerified = false;
        }
        
        // Publish successful login event
        await eventBus.publish(
          SecurityEventTypes.AUTH_SUCCESS,
          { 
            userId: user.id,
            username: user.username,
            authMethod: 'local',
            ipAddress: securityContext.ipAddress,
            userAgent: securityContext.userAgent
          },
          {
            userId: user.id,
            source: 'AuthController'
          }
        );
        
        // Remove sensitive data before sending response
        const { password, ...userWithoutPassword } = user;
        return this.sendSuccess(res, { user: userWithoutPassword });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      return this.sendError(res, message, 500);
    }
  });
  
  /**
   * Handle MFA verification
   */
  public verifyMfa = this.createValidatedHandler(mfaVerificationSchema, async (req, res, data) => {
    try {
      // Check if MFA is required
      if (!req.session?.mfaRequired) {
        return this.sendError(res, 'MFA verification not required', 400);
      }
      
      const userId = req.session.userId as number;
      if (!userId) {
        return this.sendError(res, 'Invalid session state', 400);
      }
      
      // Get user
      const user = await userService.getUserById(userId);
      if (!user) {
        return this.sendError(res, 'User not found', 404);
      }
      
      // For this example, we'll implement a simple verification
      // In a real application, this would validate TOTP, SMS codes, etc.
      let isVerified = false;
      
      switch (data.method) {
        case 'totp':
          // Verify TOTP code - this is a simplified placeholder
          // In a real app, would use a TOTP library
          isVerified = data.code === '123456'; // Placeholder!
          break;
          
        case 'recovery_code':
          // Verify recovery code - this is a simplified placeholder
          // In a real app, would check against stored recovery codes
          isVerified = true; // Placeholder!
          break;
          
        default:
          return this.sendError(res, 'Unsupported MFA method', 400);
      }
      
      if (!isVerified) {
        // Publish MFA failure event
        await eventBus.publish(
          SecurityEventTypes.MFA_CHALLENGED,
          { 
            userId,
            success: false,
            method: data.method
          },
          {
            userId,
            source: 'AuthController'
          }
        );
        
        return this.sendError(res, 'Invalid verification code', 401);
      }
      
      // Mark MFA as verified in session
      req.session.mfaVerified = true;
      req.session.mfaRequired = false;
      
      // Login the user
      req.login(user, async (err) => {
        if (err) {
          return this.sendError(res, 'Authentication failed', 500);
        }
        
        // Publish MFA success event
        await eventBus.publish(
          SecurityEventTypes.MFA_VERIFIED,
          { 
            userId,
            method: data.method
          },
          {
            userId,
            source: 'AuthController'
          }
        );
        
        // Remove sensitive data before sending response
        const { password, ...userWithoutPassword } = user;
        return this.sendSuccess(res, { user: userWithoutPassword });
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'MFA verification failed';
      return this.sendError(res, message, 500);
    }
  });
  
  /**
   * Handle user logout
   */
  public logout = this.createHandler(async (req, res) => {
    const securityContext = this.getSecurityContext(req);
    
    // Publish session terminated event before destroying the session
    if (req.isAuthenticated() && securityContext.userId) {
      await eventBus.publish(
        SecurityEventTypes.SESSION_TERMINATED,
        { 
          userId: securityContext.userId,
          sessionId: req.session?.id,
          reason: 'user_logout'
        },
        securityContext
      );
    }
    
    // Logout and destroy session
    req.logout((err) => {
      if (err) {
        return this.sendError(res, 'Logout failed', 500);
      }
      
      req.session?.destroy((err) => {
        if (err) {
          console.error('Session destruction error:', err);
        }
        
        // Clear cookie
        res.clearCookie('connect.sid');
        return this.sendSuccess(res, { message: 'Logged out successfully' });
      });
    });
  });
  
  /**
   * Get current authenticated user
   */
  public getCurrentUser = this.createHandler(async (req, res) => {
    if (!req.isAuthenticated()) {
      return this.sendError(res, 'Not authenticated', 401);
    }
    
    const userId = req.user?.id;
    if (!userId) {
      return this.sendError(res, 'Invalid user session', 401);
    }
    
    try {
      const user = await userService.getUserById(userId);
      if (!user) {
        return this.sendError(res, 'User not found', 404);
      }
      
      // Remove sensitive data
      const { password, ...userWithoutPassword } = user;
      return this.sendSuccess(res, userWithoutPassword);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get user data';
      return this.sendError(res, message, 500);
    }
  });
  
  /**
   * Get available authentication providers
   */
  public getAuthProviders = this.createHandler(async (req, res) => {
    try {
      // In a real app, would fetch from database
      // For now, return an empty array as placeholder
      return this.sendSuccess(res, []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get auth providers';
      return this.sendError(res, message, 500);
    }
  });
}

// Export singleton instance
export const authController = new AuthController();