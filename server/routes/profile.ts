import express, { Request, Response } from 'express';
import { z } from 'zod';
import { storage } from '../storage';
import { db } from '@db';
import { users, userPreferences, userSessions, mfaRecoveryCodes, fido2Credentials } from '@shared/schema';
import { createAuditLogFromRequest } from '../services/enhancedAuditService';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { eq, and } from 'drizzle-orm';
import { NotificationService } from '../services/notificationService';

const scryptAsync = promisify(scrypt);
const router = express.Router();
const notificationService = NotificationService.getInstance();

/**
 * Hash a password with a salt
 */
async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

/**
 * Compare a password with a hashed password
 */
async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split('.');
  const hashedBuf = Buffer.from(hashed, 'hex');
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

/**
 * Get the current user's profile
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    
    // Get user data
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get user preferences
    const userPrefs = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, userId)
    });
    
    // Get user roles
    const roles = await storage.getUserRoles(userId);
    
    // Get user workspaces
    const workspaces = await storage.getUserWorkspaces(userId);
    
    // Get active sessions
    const sessions = await db.query.userSessions.findMany({
      where: and(
        eq(userSessions.userId, userId),
        /* Only include non-expired sessions */
        /* z.date() is greater than now */
        // SQL: WHERE expires_at > NOW()
      )
    });
    
    // Get 2FA status
    const hasMfa = user.mfaEnabled || false;
    const mfaMethod = user.preferredMfaMethod || null;
    
    // Get recovery codes (only existence, not the codes themselves)
    const recoveryCodes = await db.query.mfaRecoveryCodes.findMany({
      where: and(
        eq(mfaRecoveryCodes.userId, userId),
        eq(mfaRecoveryCodes.isUsed, false)
      )
    });
    
    // Get FIDO2 security keys
    const securityKeys = await db.query.fido2Credentials.findMany({
      where: eq(fido2Credentials.userId, userId)
    });
    
    // Get unread notification count
    const unreadNotifications = await notificationService.getUnreadNotificationCount(userId);
    
    // Remove sensitive data before returning
    const { password, ...userWithoutPassword } = user;
    
    return res.status(200).json({
      user: userWithoutPassword,
      preferences: userPrefs || null,
      roles: roles || [],
      workspaces: workspaces || [],
      sessions: sessions || [],
      mfa: {
        enabled: hasMfa,
        method: mfaMethod,
        recoveryCodesCount: recoveryCodes.length,
        securityKeys: securityKeys.map(key => ({
          id: key.id,
          deviceType: key.deviceType,
          lastUsed: key.lastUsed
        }))
      },
      notifications: unreadNotifications
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    return res.status(500).json({ error: 'Failed to fetch profile data' });
  }
});

/**
 * Update the current user's profile
 */
router.put('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    
    // Validate request body
    const updateProfileSchema = z.object({
      fullName: z.string().min(2, 'Full name must be at least 2 characters').optional(),
      email: z.string().email('Invalid email address').optional(),
      phoneNumber: z.string().optional().nullable(),
      avatarUrl: z.string().url().optional().nullable(),
      metadata: z.record(z.any()).optional(),
    });
    
    const validatedData = updateProfileSchema.parse(req.body);
    
    // Check if email is unique if being updated
    if (validatedData.email) {
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ error: 'Email already exists' });
      }
    }
    
    // Update user profile
    const updatedUser = await storage.updateUser(userId, validatedData);
    
    // Create audit log entry
    await createAuditLogFromRequest(req, 'user.profile.update', 
      JSON.stringify({
        userId,
        updatedFields: Object.keys(validatedData)
      })
    );
    
    // Return updated user without password
    const { password, ...userWithoutPassword } = updatedUser;
    
    return res.status(200).json(userWithoutPassword);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    console.error('Error updating profile:', error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

/**
 * Update user preferences
 */
router.put('/preferences', async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    
    // Validate request body
    const updatePreferencesSchema = z.object({
      language: z.string().optional(),
      theme: z.string().optional(),
      timezone: z.string().optional(),
      dateFormat: z.string().optional(),
      timeFormat: z.string().optional(),
      accessibility: z.record(z.any()).optional(),
      notifications: z.record(z.any()).optional(),
      dashboardLayout: z.record(z.any()).optional(),
    });
    
    const validatedData = updatePreferencesSchema.parse(req.body);
    
    // Check if user has preferences
    const existingPrefs = await db.query.userPreferences.findFirst({
      where: eq(userPreferences.userId, userId)
    });
    
    let updatedPrefs;
    
    if (existingPrefs) {
      // Update existing preferences
      const result = await db.update(userPreferences)
        .set({
          ...validatedData,
          updatedAt: new Date()
        })
        .where(eq(userPreferences.userId, userId))
        .returning();
      
      updatedPrefs = result[0];
    } else {
      // Create new preferences
      const result = await db.insert(userPreferences)
        .values({
          userId,
          ...validatedData,
          updatedAt: new Date()
        })
        .returning();
      
      updatedPrefs = result[0];
    }
    
    // Create audit log entry
    await createAuditLogFromRequest(req, 'user.preferences.update', 
      JSON.stringify({
        userId,
        updatedFields: Object.keys(validatedData)
      })
    );
    
    return res.status(200).json(updatedPrefs);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    console.error('Error updating preferences:', error);
    return res.status(500).json({ error: 'Failed to update preferences' });
  }
});

/**
 * Change password
 */
router.put('/change-password', async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    
    // Validate request body
    const changePasswordSchema = z.object({
      currentPassword: z.string(),
      newPassword: z.string().min(8, 'New password must be at least 8 characters'),
      confirmPassword: z.string().min(8, 'Confirm password must be at least 8 characters')
    }).refine(data => data.newPassword === data.confirmPassword, {
      message: "Passwords don't match",
      path: ["confirmPassword"]
    });
    
    const validatedData = changePasswordSchema.parse(req.body);
    
    // Get user to verify current password
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Verify current password
    const passwordValid = await comparePasswords(validatedData.currentPassword, user.password);
    if (!passwordValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    
    // Set new password
    const hashedPassword = await hashPassword(validatedData.newPassword);
    await storage.updateUser(userId, { 
      password: hashedPassword,
      passwordChangedAt: new Date()
    });
    
    // Create audit log entry
    await createAuditLogFromRequest(req, 'user.password.change', {
      userId
    });
    
    return res.status(200).json({ message: 'Password updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    console.error('Error changing password:', error);
    return res.status(500).json({ error: 'Failed to change password' });
  }
});

/**
 * Get user sessions
 */
router.get('/sessions', async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    
    // Get active sessions
    const sessions = await db.query.userSessions.findMany({
      where: eq(userSessions.userId, userId)
    });
    
    return res.status(200).json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    return res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

/**
 * Terminate a session
 */
router.delete('/sessions/:sessionId', async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    const sessionId = req.params.sessionId;
    
    // Check if the session belongs to the user
    const session = await db.query.userSessions.findFirst({
      where: and(
        eq(userSessions.userId, userId),
        eq(userSessions.sessionId, sessionId)
      )
    });
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Cannot terminate the current session
    if (req.sessionID === sessionId) {
      return res.status(400).json({ error: 'Cannot terminate current session' });
    }
    
    // Delete the session
    await db.delete(userSessions)
      .where(and(
        eq(userSessions.userId, userId),
        eq(userSessions.sessionId, sessionId)
      ));
    
    // Create audit log entry
    await createAuditLogFromRequest(req, 'user.session.terminate', {
      userId,
      sessionId
    });
    
    return res.status(200).json({ message: 'Session terminated successfully' });
  } catch (error) {
    console.error('Error terminating session:', error);
    return res.status(500).json({ error: 'Failed to terminate session' });
  }
});

/**
 * Get notification preferences
 */
router.get('/notification-preferences', async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    
    // This will be implemented based on the notification preferences schema
    // Should fetch from userNotificationPreferences table
    
    return res.status(200).json({ message: 'Not yet implemented' });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    return res.status(500).json({ error: 'Failed to fetch notification preferences' });
  }
});

/**
 * Update notification preferences
 */
router.put('/notification-preferences', async (req: Request, res: Response) => {
  try {
    const userId = req.user.id;
    
    // This will be implemented based on the notification preferences schema
    // Should update userNotificationPreferences table
    
    return res.status(200).json({ message: 'Not yet implemented' });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

export default router;