import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../db/index';
import { storage } from '../storage';
import { requireAuth } from '../auth';
import express from 'express';
import { uiPersonalization, uiWizardProgress, uiFeatureUsage } from '@shared/schema_ui_personalization';
import { eq } from 'drizzle-orm';
import { logger } from '../utils/logger';

const router = Router();

// Get user personalization settings
router.get('/personalization', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // Get personalization settings for the user
    const personalizationSettings = await db.query.uiPersonalization.findFirst({
      where: eq(uiPersonalization.userId, userId)
    });
    
    if (!personalizationSettings) {
      // Return default settings if not found
      return res.status(200).json({
        id: 0,
        userId,
        theme: 'system',
        language: 'en',
        sidebarCollapsed: false,
        defaultView: 'dashboard',
        dashboardLayout: 'grid',
        accessibilitySettings: {},
        notifications: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    
    return res.status(200).json(personalizationSettings);
  } catch (error) {
    logger.error('Error getting personalization settings', error);
    return res.status(500).json({ error: 'Failed to retrieve personalization settings' });
  }
});

// Update user personalization settings
router.post('/personalization', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const updateData = req.body;
    
    // Check if settings exist for user
    const existingSettings = await db.query.uiPersonalization.findFirst({
      where: eq(uiPersonalization.userId, userId)
    });
    
    let result;
    
    if (existingSettings) {
      // Update existing settings
      result = await db.update(uiPersonalization)
        .set({
          ...updateData,
          updatedAt: new Date()
        })
        .where(eq(uiPersonalization.userId, userId))
        .returning();
    } else {
      // Create new settings
      result = await db.insert(uiPersonalization)
        .values({
          userId,
          theme: updateData.theme || 'system',
          language: updateData.language || 'en',
          sidebarCollapsed: updateData.sidebarCollapsed || false,
          defaultView: updateData.defaultView || 'dashboard',
          dashboardLayout: updateData.dashboardLayout || 'grid',
          accessibilitySettings: updateData.accessibilitySettings || {},
          notifications: updateData.notifications || {},
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
    }
    
    return res.status(200).json(result[0]);
  } catch (error) {
    logger.error('Error updating personalization settings', error);
    return res.status(500).json({ error: 'Failed to update personalization settings' });
  }
});

// Get wizard progress
router.get('/wizard/personalization', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // Get wizard progress for the user
    const wizardProgress = await db.query.uiWizardProgress.findFirst({
      where: eq(uiWizardProgress.userId, userId)
    });
    
    if (!wizardProgress) {
      // Return default progress if not found
      return res.status(200).json({
        id: 0,
        userId,
        wizardType: 'personalization',
        completed: false,
        currentStep: 0,
        stepsCompleted: [],
        data: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }
    
    return res.status(200).json(wizardProgress);
  } catch (error) {
    logger.error('Error getting wizard progress', error);
    return res.status(500).json({ error: 'Failed to retrieve wizard progress' });
  }
});

// Update wizard progress
router.post('/wizard/personalization', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const updateData = req.body;
    
    // Check if wizard progress exists for user
    const existingProgress = await db.query.uiWizardProgress.findFirst({
      where: eq(uiWizardProgress.userId, userId)
    });
    
    let result;
    
    if (existingProgress) {
      // Merge existing data with new data
      const mergedData = {
        ...existingProgress.data,
        ...(updateData.data || {})
      };
      
      // Update existing progress
      result = await db.update(uiWizardProgress)
        .set({
          currentStep: updateData.currentStep !== undefined ? updateData.currentStep : existingProgress.currentStep,
          completed: updateData.completed !== undefined ? updateData.completed : existingProgress.completed,
          stepsCompleted: updateData.stepsCompleted || existingProgress.stepsCompleted,
          data: mergedData,
          updatedAt: new Date()
        })
        .where(eq(uiWizardProgress.userId, userId))
        .returning();
    } else {
      // Create new progress
      result = await db.insert(uiWizardProgress)
        .values({
          userId,
          wizardType: 'personalization',
          completed: updateData.completed || false,
          currentStep: updateData.currentStep || 0,
          stepsCompleted: updateData.stepsCompleted || [],
          data: updateData.data || {},
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
    }
    
    return res.status(200).json(result[0]);
  } catch (error) {
    logger.error('Error updating wizard progress', error);
    return res.status(500).json({ error: 'Failed to update wizard progress' });
  }
});

// Complete a wizard step
router.post('/wizard/personalization/step/:stepId/complete', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const stepId = req.params.stepId;
    
    // Get existing progress
    const existingProgress = await db.query.uiWizardProgress.findFirst({
      where: eq(uiWizardProgress.userId, userId)
    });
    
    let result;
    let stepsCompleted: string[] = [];
    
    if (existingProgress) {
      // Add step to completed steps if not already included
      stepsCompleted = existingProgress.stepsCompleted;
      if (!stepsCompleted.includes(stepId)) {
        stepsCompleted.push(stepId);
      }
      
      // Update progress
      result = await db.update(uiWizardProgress)
        .set({
          stepsCompleted,
          updatedAt: new Date()
        })
        .where(eq(uiWizardProgress.userId, userId))
        .returning();
    } else {
      // Create new progress with completed step
      stepsCompleted = [stepId];
      
      result = await db.insert(uiWizardProgress)
        .values({
          userId,
          wizardType: 'personalization',
          completed: false,
          currentStep: 0,
          stepsCompleted,
          data: {},
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
    }
    
    return res.status(200).json(result[0]);
  } catch (error) {
    logger.error('Error completing wizard step', error);
    return res.status(500).json({ error: 'Failed to complete wizard step' });
  }
});

// Complete the wizard
router.post('/wizard/personalization/complete', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    
    // Get existing progress
    const existingProgress = await db.query.uiWizardProgress.findFirst({
      where: eq(uiWizardProgress.userId, userId)
    });
    
    let result;
    
    if (existingProgress) {
      // Mark wizard as completed
      result = await db.update(uiWizardProgress)
        .set({
          completed: true,
          updatedAt: new Date()
        })
        .where(eq(uiWizardProgress.userId, userId))
        .returning();
    } else {
      // Create new completed progress
      result = await db.insert(uiWizardProgress)
        .values({
          userId,
          wizardType: 'personalization',
          completed: true,
          currentStep: 0,
          stepsCompleted: [],
          data: {},
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
    }
    
    return res.status(200).json(result[0]);
  } catch (error) {
    logger.error('Error completing wizard', error);
    return res.status(500).json({ error: 'Failed to complete wizard' });
  }
});

// Track feature usage
router.post('/feature-usage', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { featureId, metadata } = req.body;
    
    if (!featureId) {
      return res.status(400).json({ error: 'Feature ID is required' });
    }
    
    // Check if feature usage exists for this user and feature
    const existingUsage = await db.query.uiFeatureUsage.findFirst({
      where: (fields, { and, eq }) => and(
        eq(fields.userId, userId),
        eq(fields.featureId, featureId)
      )
    });
    
    let result;
    
    if (existingUsage) {
      // Increment usage count and update last used
      result = await db.update(uiFeatureUsage)
        .set({
          usageCount: existingUsage.usageCount + 1,
          lastUsedAt: new Date(),
          metadata: metadata || existingUsage.metadata,
          updatedAt: new Date()
        })
        .where(
          eq(uiFeatureUsage.id, existingUsage.id)
        )
        .returning();
    } else {
      // Create new feature usage record
      result = await db.insert(uiFeatureUsage)
        .values({
          userId,
          featureId,
          usageCount: 1,
          lastUsedAt: new Date(),
          metadata: metadata || {},
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
    }
    
    return res.status(200).json(result[0]);
  } catch (error) {
    logger.error('Error tracking feature usage', error);
    return res.status(500).json({ error: 'Failed to track feature usage' });
  }
});

// Get feature usage statistics
router.get('/feature-usage/:featureId', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const featureId = req.params.featureId;
    
    const featureUsage = await db.query.uiFeatureUsage.findFirst({
      where: (fields, { and, eq }) => and(
        eq(fields.userId, userId),
        eq(fields.featureId, featureId)
      )
    });
    
    if (!featureUsage) {
      return res.status(200).json({
        featureId,
        usageCount: 0,
        lastUsedAt: null,
        metadata: {}
      });
    }
    
    return res.status(200).json(featureUsage);
  } catch (error) {
    logger.error('Error getting feature usage', error);
    return res.status(500).json({ error: 'Failed to retrieve feature usage' });
  }
});

export { router as uiPersonalizationRoutes };