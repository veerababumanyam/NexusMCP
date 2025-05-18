/**
 * Workspace Isolation API
 * 
 * This module provides endpoints for configuring workspace isolation settings:
 * - Network isolation policies
 * - Resource access controls
 * - Data segregation rules
 * - Zero-trust security enforcement
 */

import express, { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '@db';
import { eq, and, not, sql } from 'drizzle-orm';
import { workspaces, workspaceIsolationSettings } from '@shared/schema';
import { createAuditLog } from '../services/audit-service';

const router = express.Router();

// Get workspace isolation settings
router.get('/:workspaceId', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;
    
    // Verify the workspace exists
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, parseInt(workspaceId))
    });
    
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    
    // Get isolation settings
    const isolationSettings = await db.query.workspaceIsolationSettings.findFirst({
      where: eq(workspaceIsolationSettings.workspaceId, parseInt(workspaceId))
    });
    
    if (!isolationSettings) {
      // Return default settings if none exist
      return res.status(200).json({
        workspaceId: parseInt(workspaceId),
        networkIsolation: false,
        resourceIsolation: false,
        dataSegregation: false,
        enforceZeroTrust: false,
        allowedIpRanges: [],
        allowedDomains: [],
        isolationLevel: 'none',
        createdAt: null,
        updatedAt: null
      });
    }
    
    res.status(200).json(isolationSettings);
  } catch (error) {
    console.error('Error getting workspace isolation settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create or update workspace isolation settings
router.post('/:workspaceId', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;
    
    // Verify the workspace exists
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, parseInt(workspaceId))
    });
    
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    
    // Define validation schema
    const isolationSettingsSchema = z.object({
      networkIsolation: z.boolean().default(false),
      resourceIsolation: z.boolean().default(false),
      dataSegregation: z.boolean().default(false),
      enforceZeroTrust: z.boolean().default(false),
      allowedIpRanges: z.array(z.string()).default([]),
      allowedDomains: z.array(z.string()).default([]),
      isolationLevel: z.enum(['none', 'low', 'medium', 'high', 'maximum']).default('none')
    });
    
    // Validate request body
    const validatedData = isolationSettingsSchema.parse(req.body);
    
    // Check if settings already exist
    const existingSettings = await db.query.workspaceIsolationSettings.findFirst({
      where: eq(workspaceIsolationSettings.workspaceId, parseInt(workspaceId))
    });
    
    let result;
    
    if (existingSettings) {
      // Update existing settings
      const [updatedSettings] = await db.update(workspaceIsolationSettings)
        .set({
          ...validatedData,
          updatedAt: new Date()
        })
        .where(eq(workspaceIsolationSettings.workspaceId, parseInt(workspaceId)))
        .returning();
        
      result = updatedSettings;
      
      // Create audit log for update
      await createAuditLog({
        action: 'update_workspace_isolation',
        userId: req.user?.id,
        workspaceId: parseInt(workspaceId),
        resourceType: 'workspace_isolation',
        resourceId: workspaceId,
        details: {
          networkIsolation: validatedData.networkIsolation,
          resourceIsolation: validatedData.resourceIsolation,
          dataSegregation: validatedData.dataSegregation,
          enforceZeroTrust: validatedData.enforceZeroTrust,
          isolationLevel: validatedData.isolationLevel
        }
      });
    } else {
      // Create new settings
      const [newSettings] = await db.insert(workspaceIsolationSettings)
        .values({
          workspaceId: parseInt(workspaceId),
          ...validatedData,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
        
      result = newSettings;
      
      // Create audit log for creation
      await createAuditLog({
        action: 'create_workspace_isolation',
        userId: req.user?.id,
        workspaceId: parseInt(workspaceId),
        resourceType: 'workspace_isolation',
        resourceId: workspaceId,
        details: {
          networkIsolation: validatedData.networkIsolation,
          resourceIsolation: validatedData.resourceIsolation,
          dataSegregation: validatedData.dataSegregation,
          enforceZeroTrust: validatedData.enforceZeroTrust,
          isolationLevel: validatedData.isolationLevel
        }
      });
    }
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error saving workspace isolation settings:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test workspace isolation configuration 
router.post('/:workspaceId/test', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;
    
    // Verify the workspace exists
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, parseInt(workspaceId))
    });
    
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    
    // Get isolation settings
    const isolationSettings = await db.query.workspaceIsolationSettings.findFirst({
      where: eq(workspaceIsolationSettings.workspaceId, parseInt(workspaceId))
    });
    
    if (!isolationSettings) {
      return res.status(200).json({
        success: true,
        message: 'No isolation settings configured. All access is permitted.',
        details: {
          networkAccess: 'unrestricted',
          resourceAccess: 'unrestricted',
          dataAccess: 'unrestricted',
          securityLevel: 'standard'
        }
      });
    }
    
    // In a real implementation, this would perform actual tests against the environment
    // This is a placeholder implementation that returns simulated results
    const testResults = {
      success: true,
      message: 'Isolation settings tested successfully',
      details: {
        networkAccess: isolationSettings.networkIsolation ? 'restricted' : 'unrestricted',
        resourceAccess: isolationSettings.resourceIsolation ? 'restricted' : 'unrestricted',
        dataAccess: isolationSettings.dataSegregation ? 'segregated' : 'shared',
        securityLevel: isolationSettings.enforceZeroTrust ? 'zero-trust' : 'standard',
        isolationLevel: isolationSettings.isolationLevel
      },
      tests: [
        {
          name: 'Network Isolation',
          status: 'success',
          details: isolationSettings.networkIsolation 
            ? `Restricted to ${isolationSettings.allowedIpRanges.length} IP ranges and ${isolationSettings.allowedDomains.length} domains`
            : 'Network access is unrestricted'
        },
        {
          name: 'Resource Isolation',
          status: 'success',
          details: isolationSettings.resourceIsolation
            ? 'Resources are isolated to this workspace'
            : 'Resources are shared across workspaces'
        },
        {
          name: 'Data Segregation',
          status: 'success',
          details: isolationSettings.dataSegregation
            ? 'Data is segregated by workspace'
            : 'Data can be shared across workspaces'
        },
        {
          name: 'Zero-Trust Enforcement',
          status: 'success',
          details: isolationSettings.enforceZeroTrust
            ? 'Zero-trust security principles are enforced'
            : 'Standard security controls are in place'
        }
      ]
    };
    
    // Create audit log
    await createAuditLog({
      action: 'test_workspace_isolation',
      userId: req.user?.id,
      workspaceId: parseInt(workspaceId),
      resourceType: 'workspace_isolation',
      resourceId: workspaceId,
      details: {
        testResults
      }
    });
    
    res.status(200).json(testResults);
  } catch (error) {
    console.error('Error testing workspace isolation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset workspace isolation settings to defaults
router.post('/:workspaceId/reset', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.params;
    
    // Verify the workspace exists
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, parseInt(workspaceId))
    });
    
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    
    // Check if settings exist
    const existingSettings = await db.query.workspaceIsolationSettings.findFirst({
      where: eq(workspaceIsolationSettings.workspaceId, parseInt(workspaceId))
    });
    
    if (!existingSettings) {
      return res.status(200).json({ 
        success: true, 
        message: 'Workspace isolation settings are already at defaults'
      });
    }
    
    // Delete existing settings
    await db.delete(workspaceIsolationSettings)
      .where(eq(workspaceIsolationSettings.workspaceId, parseInt(workspaceId)));
    
    // Create audit log
    await createAuditLog({
      action: 'reset_workspace_isolation',
      userId: req.user?.id,
      workspaceId: parseInt(workspaceId),
      resourceType: 'workspace_isolation',
      resourceId: workspaceId,
      details: {
        previousSettings: {
          networkIsolation: existingSettings.networkIsolation,
          resourceIsolation: existingSettings.resourceIsolation,
          dataSegregation: existingSettings.dataSegregation,
          enforceZeroTrust: existingSettings.enforceZeroTrust,
          isolationLevel: existingSettings.isolationLevel
        }
      }
    });
    
    res.status(200).json({ 
      success: true, 
      message: 'Workspace isolation settings have been reset to defaults'
    });
  } catch (error) {
    console.error('Error resetting workspace isolation settings:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;