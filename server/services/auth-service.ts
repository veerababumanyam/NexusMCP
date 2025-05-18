import { Request } from 'express';
import * as crypto from 'crypto';
import { promisify } from 'util';
import { z } from 'zod';
import { db } from '@db';
import { eq, and } from 'drizzle-orm';
import {
  users, authProviders, userIdentities, userSessions, 
  mfaRecoveryCodes, fido2Credentials, InsertUser, 
  User
} from '@shared/schema';

// Convert scrypt to promise-based API
const scryptAsync = promisify(crypto.scrypt);

/**
 * Authentication Service
 * 
 * Provides methods for user authentication, registration, and identity management
 * supporting multiple authentication methods and MFA.
 */
export class AuthService {
  /**
   * Hash a password using scrypt with salt
   */
  async hashPassword(password: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString('hex');
    const buf = await scryptAsync(password, salt, 64) as Buffer;
    return `${buf.toString('hex')}.${salt}`;
  }

  /**
   * Compare a supplied password with a stored hashed password
   */
  async comparePasswords(supplied: string, stored: string): Promise<boolean> {
    try {
      const [hashed, salt] = stored.split('.');
      const hashedBuf = Buffer.from(hashed, 'hex');
      const suppliedBuf = await scryptAsync(supplied, salt, 64) as Buffer;
      return crypto.timingSafeEqual(hashedBuf, suppliedBuf);
    } catch (error) {
      return false;
    }
  }

  /**
   * Register a new local user
   */
  async registerLocalUser(userData: InsertUser): Promise<User> {
    // Check if the username already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.username, userData.username)
    });

    if (existingUser) {
      throw new Error('Username already exists');
    }

    // Hash the password
    const hashedPassword = await this.hashPassword(userData.password!);

    // Create the user record
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        password: hashedPassword,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return user;
  }

  /**
   * Authenticate a user with local username/password
   */
  async authenticateLocal(username: string, password: string): Promise<User> {
    // Find the user by username
    const user = await db.query.users.findFirst({
      where: eq(users.username, username)
    });

    if (!user || !user.password) {
      throw new Error('Invalid username or password');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new Error('Account is temporarily locked. Please try again later.');
    }

    // Verify the password
    const passwordValid = await this.comparePasswords(password, user.password);
    
    if (!passwordValid) {
      // Increment failed login attempts
      await db
        .update(users)
        .set({
          failedLoginAttempts: (user.failedLoginAttempts || 0) + 1,
          // Lock account after 5 failed attempts for 15 minutes
          lockedUntil: (user.failedLoginAttempts || 0) >= 4 ? new Date(Date.now() + 15 * 60 * 1000) : null,
        })
        .where(eq(users.id, user.id));
      
      throw new Error('Invalid username or password');
    }

    // Reset failed login attempts on successful login
    await db
      .update(users)
      .set({
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLogin: new Date()
      })
      .where(eq(users.id, user.id));

    return user;
  }

  /**
   * Register and authenticate an SSO user (OIDC, SAML, Google, Microsoft)
   */
  async authenticateOrCreateSsoUser(
    providerId: number,
    externalId: string,
    profile: any
  ): Promise<User> {
    // Check if this identity already exists
    const existingIdentity = await db.query.userIdentities.findFirst({
      where: and(
        eq(userIdentities.providerId, providerId),
        eq(userIdentities.externalId, externalId)
      ),
      with: {
        user: true
      }
    });

    if (existingIdentity) {
      // Update the user's last login time
      await db
        .update(users)
        .set({
          lastLogin: new Date()
        })
        .where(eq(users.id, existingIdentity.userId));

      return existingIdentity.user;
    }

    // Get the email from the profile
    const email = profile.email || '';
    const name = profile.name || profile.displayName || '';

    // Check if a user with this email already exists
    let user: User | undefined;
    if (email) {
      user = await db.query.users.findFirst({
        where: eq(users.email, email)
      });
    }

    // If no user exists, create a new one
    if (!user) {
      const username = this.generateUsernameFromEmail(email || externalId);
      
      const [newUser] = await db
        .insert(users)
        .values({
          username,
          email: email || null,
          fullName: name,
          isActive: true,
          isEmailVerified: true, // Assume email is verified from SSO provider
          externalIds: { [providerId]: externalId },
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      
      user = newUser;
    }

    // Create the identity record linking the user to this provider
    await db
      .insert(userIdentities)
      .values({
        userId: user.id,
        providerId,
        externalId,
        profileData: profile,
        createdAt: new Date(),
        updatedAt: new Date()
      });

    // Update last login
    await db
      .update(users)
      .set({
        lastLogin: new Date()
      })
      .where(eq(users.id, user.id));

    return user;
  }

  /**
   * Handle Authentication with LDAP (requires external LDAP client)
   */
  async authenticateLdap(
    username: string,
    password: string,
    domain?: string
  ): Promise<User> {
    // In a real implementation, this would use an LDAP client
    // to authenticate against an LDAP server
    // For now, we'll throw an error indicating it's not implemented
    throw new Error('LDAP authentication not yet implemented');
  }

  /**
   * Generate a unique username from an email address
   */
  private generateUsernameFromEmail(email: string): string {
    const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
    const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${baseUsername}${randomSuffix}`;
  }

  /**
   * Create a new session for a user
   */
  async createSession(
    userId: number,
    req: Request,
    rememberMe: boolean = false
  ): Promise<string> {
    // Generate a unique session ID
    const sessionId = crypto.randomBytes(32).toString('hex');

    // Determine expiry duration (30 days for remember me, 24 hours otherwise)
    const expiresAt = new Date();
    if (rememberMe) {
      expiresAt.setDate(expiresAt.getDate() + 30);
    } else {
      expiresAt.setHours(expiresAt.getHours() + 24);
    }

    // Store session in the database
    await db
      .insert(userSessions)
      .values({
        userId,
        sessionId,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || '',
        expiresAt,
        createdAt: new Date(),
        lastActive: new Date()
      });

    return sessionId;
  }

  /**
   * Verify and update a session
   */
  async verifySession(sessionId: string): Promise<User | null> {
    const session = await db.query.userSessions.findFirst({
      where: eq(userSessions.sessionId, sessionId),
      with: {
        user: true
      }
    });

    if (!session || session.expiresAt < new Date() || !session.user.isActive) {
      return null;
    }

    // Update last active time
    await db
      .update(userSessions)
      .set({
        lastActive: new Date()
      })
      .where(eq(userSessions.id, session.id));

    return session.user;
  }

  /**
   * Destroy a session
   */
  async destroySession(sessionId: string): Promise<void> {
    await db
      .delete(userSessions)
      .where(eq(userSessions.sessionId, sessionId));
  }

  /**
   * Enable MFA for a user
   */
  async enableMfa(
    userId: number,
    method: 'totp' | 'sms' | 'email',
    secret?: string,
    phoneNumber?: string
  ): Promise<void> {
    const updateData: { [key: string]: any } = {
      mfaEnabled: true,
      preferredMfaMethod: method,
      updatedAt: new Date()
    };

    if (secret) {
      updateData.mfaSecret = secret;
    }

    if (phoneNumber) {
      updateData.phoneNumber = phoneNumber;
    }

    await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId));
  }

  /**
   * Generate recovery codes for MFA
   */
  async generateRecoveryCodes(userId: number, count: number = 10): Promise<string[]> {
    // Generate recovery codes
    const recoveryCodes: string[] = [];
    for (let i = 0; i < count; i++) {
      // Format: XXXX-XXXX-XXXX (where X is a alphanumeric character)
      const code = [
        crypto.randomBytes(2).toString('hex').toUpperCase(),
        crypto.randomBytes(2).toString('hex').toUpperCase(),
        crypto.randomBytes(2).toString('hex').toUpperCase()
      ].join('-');
      recoveryCodes.push(code);
    }

    // Hash the recovery codes and store them
    const hashedCodes = await Promise.all(
      recoveryCodes.map(async (code) => this.hashPassword(code))
    );

    // Delete any existing unused recovery codes
    await db
      .delete(mfaRecoveryCodes)
      .where(
        and(
          eq(mfaRecoveryCodes.userId, userId),
          eq(mfaRecoveryCodes.isUsed, false)
        )
      );

    // Insert new recovery codes
    for (const hashedCode of hashedCodes) {
      await db
        .insert(mfaRecoveryCodes)
        .values({
          userId,
          code: hashedCode,
          isUsed: false,
          createdAt: new Date()
        });
    }

    // Return plain text recovery codes to be shown to the user once
    return recoveryCodes;
  }

  /**
   * Verify a TOTP code
   */
  async verifyTotpCode(userId: number, code: string): Promise<boolean> {
    // In a real implementation, this would use a TOTP library
    // to verify the code against the user's secret
    // For now, we'll return a placeholder value
    return false;
  }

  /**
   * Verify a recovery code
   */
  async verifyRecoveryCode(userId: number, code: string): Promise<boolean> {
    // Get all unused recovery codes for the user
    const recoveryCodes = await db.query.mfaRecoveryCodes.findMany({
      where: and(
        eq(mfaRecoveryCodes.userId, userId),
        eq(mfaRecoveryCodes.isUsed, false)
      )
    });

    // Check each code
    for (const recoveryCode of recoveryCodes) {
      const isValid = await this.comparePasswords(code, recoveryCode.code);
      if (isValid) {
        // Mark the code as used
        await db
          .update(mfaRecoveryCodes)
          .set({
            isUsed: true,
            usedAt: new Date()
          })
          .where(eq(mfaRecoveryCodes.id, recoveryCode.id));
        
        return true;
      }
    }

    return false;
  }
}

// Export a singleton instance
export const authService = new AuthService();