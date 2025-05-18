import express, { Request, Response, NextFunction } from 'express';
import { db } from '../../db';
import { securityPolicies, insertSecurityPolicySchema } from '@shared/schema';
import { and, eq } from 'drizzle-orm';
import { createAuditLog } from '../services/auditLogService';

const router = express.Router();

/**
 * Get security policy for a workspace
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.query;
    
    // Validate workspaceId is provided
    if (!workspaceId || typeof workspaceId !== 'string') {
      return res.status(400).json({ error: 'Workspace ID is required' });
    }
    
    // Get policy for workspace
    const policy = await db.query.securityPolicies.findFirst({
      where: eq(securityPolicies.workspaceId, parseInt(workspaceId))
    });
    
    // If no policy exists, return default values
    if (!policy) {
      // Get default policy schema (uses default values defined in schema)
      const defaultPolicy = {
        workspaceId: parseInt(workspaceId),
        passwordMinLength: 8,
        passwordRequireUppercase: true,
        passwordRequireLowercase: true,
        passwordRequireNumbers: true,
        passwordRequireSymbols: false,
        passwordExpiryDays: 90,
        passwordHistory: 3,
        maxLoginAttempts: 5,
        loginLockoutMinutes: 15,
        mfaRequired: false,
        mfaRememberDays: 30,
        mfaAllowedMethods: ["totp", "webauthn"],
        sessionTimeoutMinutes: 60,
        sessionMaxConcurrent: 5,
        forceReauthHighRisk: true,
        alertOnLocationChange: true,
        alertOnNewDevice: true
      };
      
      return res.status(200).json(defaultPolicy);
    }
    
    return res.status(200).json(policy);
  } catch (error) {
    console.error('Error fetching security policy:', error);
    return res.status(500).json({ error: 'Failed to fetch security policy' });
  }
});

/**
 * Create or update security policy for a workspace
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validatedData = insertSecurityPolicySchema.parse(req.body);
    
    // Check if policy already exists for this workspace
    const existingPolicy = await db.query.securityPolicies.findFirst({
      where: eq(securityPolicies.workspaceId, validatedData.workspaceId)
    });
    
    let policy;
    
    if (existingPolicy) {
      // Update existing policy
      const [updatedPolicy] = await db
        .update(securityPolicies)
        .set({
          ...validatedData,
          updatedAt: new Date()
        })
        .where(eq(securityPolicies.id, existingPolicy.id))
        .returning();
      
      policy = updatedPolicy;
      
      // Create audit log
      await createAuditLog({
        userId: req.user.id,
        action: 'update',
        resource: 'security_policy',
        resourceId: policy.id.toString(),
        details: {
          workspaceId: policy.workspaceId,
          passwordMinLength: policy.passwordMinLength,
          mfaRequired: policy.mfaRequired
        }
      });
    } else {
      // Create new policy
      const [newPolicy] = await db
        .insert(securityPolicies)
        .values(validatedData)
        .returning();
      
      policy = newPolicy;
      
      // Create audit log
      await createAuditLog({
        userId: req.user.id,
        action: 'create',
        resource: 'security_policy',
        resourceId: policy.id.toString(),
        details: {
          workspaceId: policy.workspaceId,
          passwordMinLength: policy.passwordMinLength,
          mfaRequired: policy.mfaRequired
        }
      });
    }
    
    return res.status(200).json(policy);
  } catch (error) {
    console.error('Error saving security policy:', error);
    return res.status(500).json({ error: 'Failed to save security policy' });
  }
});

/**
 * Reset security policy to default values
 */
router.post('/:workspaceId/reset', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { workspaceId } = req.params;
    
    // Delete existing policy
    await db
      .delete(securityPolicies)
      .where(eq(securityPolicies.workspaceId, parseInt(workspaceId)));
    
    // Create audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'reset',
      resource: 'security_policy',
      resourceId: workspaceId,
      details: {
        workspaceId: parseInt(workspaceId),
        action: 'reset to defaults'
      }
    });
    
    // Return default values
    const defaultPolicy = {
      workspaceId: parseInt(workspaceId),
      passwordMinLength: 8,
      passwordRequireUppercase: true,
      passwordRequireLowercase: true,
      passwordRequireNumbers: true,
      passwordRequireSymbols: false,
      passwordExpiryDays: 90,
      passwordHistory: 3,
      maxLoginAttempts: 5,
      loginLockoutMinutes: 15,
      mfaRequired: false,
      mfaRememberDays: 30,
      mfaAllowedMethods: ["totp", "webauthn"],
      sessionTimeoutMinutes: 60,
      sessionMaxConcurrent: 5,
      forceReauthHighRisk: true,
      alertOnLocationChange: true,
      alertOnNewDevice: true
    };
    
    return res.status(200).json(defaultPolicy);
  } catch (error) {
    console.error('Error resetting security policy:', error);
    return res.status(500).json({ error: 'Failed to reset security policy' });
  }
});

export default router;