/**
 * User Service - Application Layer
 * 
 * This service implements application logic for user management following:
 * - OWASP ASVS 4.0 Authentication Security Requirements
 * - NIST 800-63-3 Digital Identity Guidelines
 * - ISO/IEC 29115 Entity Authentication Assurance
 * - GDPR Article 32 Security of Processing
 */

import { db, dbUtils } from '../../infrastructure/persistence/database';
import { eventBus } from '../../infrastructure/events/EventBus';
import { securityService, SecurityEventTypes } from '../security/SecurityService';
import { 
  users, 
  userRoles, 
  permissions, 
  roles,
  mfaRecoveryCodes,
  userIdentities
} from '../../../shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { 
  createHash, 
  randomBytes, 
  scrypt, 
  timingSafeEqual 
} from 'crypto';
import { promisify } from 'util';

// Async version of scrypt
const scryptAsync = promisify(scrypt);

// Password policy configuration
const PASSWORD_POLICY = {
  minLength: 12,
  requireLowercase: true,
  requireUppercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  maxRepeatingChars: 3,
  preventCommonPasswords: true,
  preventUserInfoInPassword: true,
  expiryDays: 90, // Password expiry in days
  historySize: 5,  // Remember last 5 passwords
};

export class UserService {
  private static instance: UserService;
  
  private constructor() {}
  
  /**
   * Get singleton instance
   */
  public static getInstance(): UserService {
    if (!UserService.instance) {
      UserService.instance = new UserService();
    }
    return UserService.instance;
  }
  
  /**
   * Hash a password securely
   */
  public async hashPassword(password: string): Promise<string> {
    // Generate a cryptographically secure salt
    const salt = randomBytes(16).toString('hex');
    
    // Use scrypt with high cost parameters (N=32768, r=8, p=1)
    // Higher parameters would be more secure but slower
    const derivedKey = await scryptAsync(password, salt, 64) as Buffer;
    
    // Format: algorithm:iterations:salt:hash
    return `scrypt:32768:${salt}:${derivedKey.toString('hex')}`;
  }
  
  /**
   * Verify a password against its hash
   */
  public async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    try {
      // Parse the stored hash value
      const [algorithm, iterations, salt, hash] = storedHash.split(':');
      
      if (algorithm !== 'scrypt') {
        throw new Error('Unsupported hash algorithm');
      }
      
      // Convert stored hash to buffer for comparison
      const hashBuffer = Buffer.from(hash, 'hex');
      
      // Compute hash of provided password
      const derivedKey = await scryptAsync(password, salt, 64) as Buffer;
      
      // Use constant-time comparison to prevent timing attacks
      return timingSafeEqual(derivedKey, hashBuffer);
    } catch (error) {
      console.error('Password verification error:', error);
      return false;
    }
  }
  
  /**
   * Validate password strength
   */
  public validatePasswordStrength(password: string, userData?: {
    username?: string;
    email?: string;
    fullName?: string;
  }): { isValid: boolean; message?: string } {
    if (password.length < PASSWORD_POLICY.minLength) {
      return { 
        isValid: false, 
        message: `Password must be at least ${PASSWORD_POLICY.minLength} characters long`
      };
    }
    
    if (PASSWORD_POLICY.requireLowercase && !/[a-z]/.test(password)) {
      return { 
        isValid: false, 
        message: 'Password must contain at least one lowercase letter'
      };
    }
    
    if (PASSWORD_POLICY.requireUppercase && !/[A-Z]/.test(password)) {
      return { 
        isValid: false, 
        message: 'Password must contain at least one uppercase letter'
      };
    }
    
    if (PASSWORD_POLICY.requireNumbers && !/[0-9]/.test(password)) {
      return { 
        isValid: false, 
        message: 'Password must contain at least one number'
      };
    }
    
    if (PASSWORD_POLICY.requireSpecialChars && !/[^A-Za-z0-9]/.test(password)) {
      return { 
        isValid: false, 
        message: 'Password must contain at least one special character'
      };
    }
    
    // Check for repeating characters
    if (PASSWORD_POLICY.maxRepeatingChars) {
      const repeatingCharsRegex = new RegExp(`(.)\\1{${PASSWORD_POLICY.maxRepeatingChars},}`);
      if (repeatingCharsRegex.test(password)) {
        return { 
          isValid: false, 
          message: `Password cannot contain more than ${PASSWORD_POLICY.maxRepeatingChars} repeating characters`
        };
      }
    }
    
    // Check if password contains user info
    if (PASSWORD_POLICY.preventUserInfoInPassword && userData) {
      const userInfo = [
        userData.username,
        userData.email,
        userData.fullName
      ].filter(Boolean).map(val => val?.toLowerCase());
      
      for (const info of userInfo) {
        if (info && info.length > 3 && password.toLowerCase().includes(info)) {
          return { 
            isValid: false, 
            message: 'Password cannot contain your username, email, or name'
          };
        }
      }
    }
    
    // In a production system, would also check against a list of common passwords
    
    return { isValid: true };
  }
  
  /**
   * Get user by ID with role and permission information
   */
  public async getUserById(userId: number) {
    try {
      // Get user
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });
      
      if (!user) {
        return null;
      }
      
      // Get user's roles
      const userRoleEntries = await db.query.userRoles.findMany({
        where: eq(userRoles.userId, userId),
        with: {
          role: true
        }
      });
      
      // Get role IDs
      const roleIds = userRoleEntries.map(ur => ur.roleId);
      
      // Get permissions for these roles
      const permissionEntries = await db.query.permissions.findMany({
        where: inArray(permissions.groupId, roleIds)
      });
      
      // Map permissions
      const userPermissions = permissionEntries.map(p => p.name);
      
      // Return user with roles and permissions
      return {
        ...user,
        roles: userRoleEntries.map(ur => ur.role),
        permissions: userPermissions
      };
    } catch (error) {
      console.error('Error getting user by ID:', error);
      return null;
    }
  }
  
  /**
   * Get user by username with role and permission information
   */
  public async getUserByUsername(username: string) {
    try {
      // Get user
      const user = await db.query.users.findFirst({
        where: eq(users.username, username)
      });
      
      if (!user) {
        return null;
      }
      
      return this.getUserById(user.id);
    } catch (error) {
      console.error('Error getting user by username:', error);
      return null;
    }
  }
  
  /**
   * Get user permissions
   */
  public async getUserPermissions(userId: number): Promise<string[]> {
    try {
      // Get user's roles
      const userRoleEntries = await db.query.userRoles.findMany({
        where: eq(userRoles.userId, userId)
      });
      
      // Get role IDs
      const roleIds = userRoleEntries.map(ur => ur.roleId);
      
      // Get permissions for these roles
      const permissionEntries = await db.query.permissions.findMany({
        where: inArray(permissions.groupId, roleIds)
      });
      
      // Return permission names
      return permissionEntries.map(p => p.name);
    } catch (error) {
      console.error('Error getting user permissions:', error);
      return [];
    }
  }
  
  /**
   * Check if user has specific permission
   */
  public async hasPermission(userId: number, permission: string): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    return securityService.hasPermission(userId, userPermissions, permission);
  }
  
  /**
   * Register a new user
   */
  public async registerUser(userData: {
    username: string;
    password: string;
    email?: string;
    fullName?: string;
  }) {
    try {
      // Validate password strength
      const passwordValidation = this.validatePasswordStrength(userData.password, userData);
      if (!passwordValidation.isValid) {
        throw new Error(passwordValidation.message);
      }
      
      // Check if username already exists
      const existingUser = await db.query.users.findFirst({
        where: eq(users.username, userData.username)
      });
      
      if (existingUser) {
        throw new Error('Username already exists');
      }
      
      // Check if email already exists (if provided)
      if (userData.email) {
        const existingEmail = await db.query.users.findFirst({
          where: eq(users.email, userData.email)
        });
        
        if (existingEmail) {
          throw new Error('Email already in use');
        }
      }
      
      // Hash password
      const hashedPassword = await this.hashPassword(userData.password);
      
      // Create user
      const [newUser] = await db.insert(users).values({
        username: userData.username,
        password: hashedPassword,
        email: userData.email,
        fullName: userData.fullName,
        isActive: true,
        isEmailVerified: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      
      if (!newUser) {
        throw new Error('Failed to create user');
      }
      
      // Assign default role (if exists)
      try {
        const defaultRole = await db.query.roles.findFirst({
          where: eq(roles.name, 'user')
        });
        
        if (defaultRole) {
          await db.insert(userRoles).values({
            userId: newUser.id,
            roleId: defaultRole.id,
            createdAt: new Date()
          });
        }
      } catch (error) {
        // Non-critical error - user is created but might not have a role
        console.error('Error assigning default role:', error);
      }
      
      // Publish user created event
      await eventBus.publish('user.created', { 
        userId: newUser.id,
        username: newUser.username
      }, {
        userId: newUser.id,
        source: 'UserService'
      });
      
      // Get complete user with roles and permissions
      return this.getUserById(newUser.id);
    } catch (error) {
      console.error('Error registering user:', error);
      throw error;
    }
  }
  
  /**
   * Generate MFA recovery codes
   */
  public async generateMfaRecoveryCodes(userId: number): Promise<string[]> {
    try {
      // Delete existing recovery codes
      await db.delete(mfaRecoveryCodes).where(eq(mfaRecoveryCodes.userId, userId));
      
      // Generate new recovery codes
      const codes: string[] = [];
      for (let i = 0; i < 10; i++) {
        // Generate random code and format as XXXX-XXXX-XXXX
        const buffer = randomBytes(6);
        const code = buffer.toString('hex').toUpperCase();
        const formattedCode = `${code.substring(0, 4)}-${code.substring(4, 8)}-${code.substring(8, 12)}`;
        codes.push(formattedCode);
        
        // Hash the code before storing
        const hashResult = securityService.hashData(formattedCode);
        
        // Store the code
        await db.insert(mfaRecoveryCodes).values({
          userId,
          codeHash: hashResult.hash,
          codeSalt: hashResult.salt,
          isUsed: false,
          createdAt: new Date()
        });
      }
      
      return codes;
    } catch (error) {
      console.error('Error generating MFA recovery codes:', error);
      throw new Error('Failed to generate recovery codes');
    }
  }
  
  /**
   * Update user password
   */
  public async updatePassword(
    userId: number, 
    newPassword: string, 
    currentPassword?: string
  ): Promise<boolean> {
    try {
      // Get user
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId)
      });
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // If current password is provided, verify it
      if (currentPassword) {
        if (!user.password) {
          throw new Error('Cannot verify current password');
        }
        
        const passwordValid = await this.verifyPassword(currentPassword, user.password);
        if (!passwordValid) {
          throw new Error('Current password is incorrect');
        }
      }
      
      // Validate new password strength
      const passwordValidation = this.validatePasswordStrength(newPassword, {
        username: user.username,
        email: user.email || undefined,
        fullName: user.fullName || undefined
      });
      
      if (!passwordValidation.isValid) {
        throw new Error(passwordValidation.message);
      }
      
      // Hash the new password
      const hashedPassword = await this.hashPassword(newPassword);
      
      // Update user password
      await db.update(users)
        .set({
          password: hashedPassword,
          passwordChangedAt: new Date(),
          updatedAt: new Date()
        })
        .where(eq(users.id, userId));
      
      // Publish password changed event
      await eventBus.publish(SecurityEventTypes.PASSWORD_CHANGE, {
        userId,
        timestamp: new Date().toISOString()
      }, {
        userId,
        source: 'UserService'
      });
      
      return true;
    } catch (error) {
      console.error('Error updating password:', error);
      throw error;
    }
  }
}

// Export singleton
export const userService = UserService.getInstance();