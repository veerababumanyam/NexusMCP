import { db } from "@db";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  uiPersonalization,
  uiWizardProgress,
  uiFeatureUsage,
  uiPersonalizationInsertSchema,
  uiWizardProgressInsertSchema,
  uiFeatureUsageInsertSchema,
  UiPersonalization,
  UiWizardProgress,
  UiFeatureUsage
} from "@shared/schema_ui_personalization";

export class UiPersonalizationService {
  /**
   * Get personalization settings for a user
   */
  async getUserPersonalization(userId: number): Promise<UiPersonalization | null> {
    try {
      const personalization = await db.query.uiPersonalization.findFirst({
        where: eq(uiPersonalization.userId, userId)
      });
      
      return personalization || null;
    } catch (error) {
      console.error('Error fetching user personalization:', error);
      throw error;
    }
  }

  /**
   * Create or update personalization settings for a user
   */
  async saveUserPersonalization(userId: number, data: Partial<UiPersonalization>): Promise<UiPersonalization> {
    try {
      const existing = await this.getUserPersonalization(userId);
      
      // Validate the data using the schema
      const validatedData = uiPersonalizationInsertSchema.parse({
        ...data,
        userId
      });
      
      if (existing) {
        // Update existing record
        const [updated] = await db
          .update(uiPersonalization)
          .set({
            ...validatedData,
            updatedAt: new Date()
          })
          .where(eq(uiPersonalization.userId, userId))
          .returning();
        
        return updated;
      } else {
        // Create new record
        const [newPersonalization] = await db
          .insert(uiPersonalization)
          .values(validatedData)
          .returning();
        
        return newPersonalization;
      }
    } catch (error) {
      console.error('Error saving user personalization:', error);
      throw error;
    }
  }

  /**
   * Get wizard progress for a user
   */
  async getWizardProgress(userId: number, wizardType: string): Promise<UiWizardProgress | null> {
    try {
      const progress = await db.query.uiWizardProgress.findFirst({
        where: (fields) => {
          return eq(fields.userId, userId) && eq(fields.wizardType, wizardType);
        }
      });
      
      return progress || null;
    } catch (error) {
      console.error('Error fetching wizard progress:', error);
      throw error;
    }
  }

  /**
   * Create or update wizard progress for a user
   */
  async saveWizardProgress(
    userId: number, 
    wizardType: string, 
    data: Partial<UiWizardProgress>
  ): Promise<UiWizardProgress> {
    try {
      const existing = await this.getWizardProgress(userId, wizardType);
      
      // Validate the data using the schema
      const validatedData = uiWizardProgressInsertSchema.parse({
        ...data,
        userId,
        wizardType,
        lastInteractionAt: new Date()
      });
      
      if (existing) {
        // Update existing record
        const [updated] = await db
          .update(uiWizardProgress)
          .set({
            ...validatedData,
            updatedAt: new Date()
          })
          .where((fields) => {
            return eq(fields.userId, userId) && eq(fields.wizardType, wizardType);
          })
          .returning();
        
        return updated;
      } else {
        // Create new record
        const [newProgress] = await db
          .insert(uiWizardProgress)
          .values(validatedData)
          .returning();
        
        return newProgress;
      }
    } catch (error) {
      console.error('Error saving wizard progress:', error);
      throw error;
    }
  }

  /**
   * Mark a wizard step as completed
   */
  async completeWizardStep(
    userId: number, 
    wizardType: string, 
    stepId: string
  ): Promise<UiWizardProgress> {
    try {
      const progress = await this.getWizardProgress(userId, wizardType);
      
      if (!progress) {
        // Create a new progress record with this step completed
        return this.saveWizardProgress(userId, wizardType, {
          currentStep: 1,
          stepsCompleted: [stepId],
          completed: false
        });
      }
      
      // Add to completed steps if not already included
      const stepsCompleted = Array.isArray(progress.stepsCompleted) 
        ? progress.stepsCompleted as string[]
        : [];
        
      if (!stepsCompleted.includes(stepId)) {
        stepsCompleted.push(stepId);
      }
      
      // Update the progress
      return this.saveWizardProgress(userId, wizardType, {
        stepsCompleted,
        currentStep: progress.currentStep + 1,
        lastInteractionAt: new Date()
      });
    } catch (error) {
      console.error('Error completing wizard step:', error);
      throw error;
    }
  }

  /**
   * Mark a wizard as completed
   */
  async completeWizard(userId: number, wizardType: string): Promise<UiWizardProgress> {
    try {
      const progress = await this.getWizardProgress(userId, wizardType);
      
      if (!progress) {
        // Create a new progress record marked as completed
        return this.saveWizardProgress(userId, wizardType, {
          completed: true,
          lastInteractionAt: new Date()
        });
      }
      
      // Update the progress as completed
      return this.saveWizardProgress(userId, wizardType, {
        completed: true,
        lastInteractionAt: new Date()
      });
    } catch (error) {
      console.error('Error completing wizard:', error);
      throw error;
    }
  }

  /**
   * Reset a wizard's progress
   */
  async resetWizard(userId: number, wizardType: string): Promise<UiWizardProgress> {
    try {
      const progress = await this.getWizardProgress(userId, wizardType);
      
      if (!progress) {
        // Create a new progress record with default values
        return this.saveWizardProgress(userId, wizardType, {
          completed: false,
          currentStep: 0,
          stepsCompleted: [],
          data: {},
          lastInteractionAt: new Date()
        });
      }
      
      // Reset the progress
      return this.saveWizardProgress(userId, wizardType, {
        completed: false,
        currentStep: 0,
        stepsCompleted: [],
        data: {},
        lastInteractionAt: new Date()
      });
    } catch (error) {
      console.error('Error resetting wizard:', error);
      throw error;
    }
  }

  /**
   * Track a user's feature usage
   */
  async trackFeatureUsage(userId: number, featureId: string, metadata: Record<string, any> = {}): Promise<UiFeatureUsage> {
    try {
      const existingUsage = await db.query.uiFeatureUsage.findFirst({
        where: (fields) => {
          return eq(fields.userId, userId) && eq(fields.featureId, featureId);
        }
      });

      if (existingUsage) {
        // Update existing usage record
        const [updated] = await db
          .update(uiFeatureUsage)
          .set({
            usageCount: existingUsage.usageCount + 1,
            lastUsedAt: new Date(),
            metadata: {
              ...existingUsage.metadata as Record<string, any>,
              ...metadata,
              lastUsedContext: metadata.context || null
            },
            updatedAt: new Date()
          })
          .where((fields) => {
            return eq(fields.userId, userId) && eq(fields.featureId, featureId);
          })
          .returning();

        return updated;
      } else {
        // Create new usage record
        const validatedData = uiFeatureUsageInsertSchema.parse({
          userId,
          featureId,
          usageCount: 1,
          lastUsedAt: new Date(),
          metadata: {
            ...metadata,
            firstUsedContext: metadata.context || null,
            lastUsedContext: metadata.context || null
          }
        });

        const [newUsage] = await db
          .insert(uiFeatureUsage)
          .values(validatedData)
          .returning();

        return newUsage;
      }
    } catch (error) {
      console.error(`Error tracking feature usage for ${featureId}:`, error);
      throw error;
    }
  }

  /**
   * Get a user's feature usage statistics
   */
  async getUserFeatureUsage(userId: number): Promise<UiFeatureUsage[]> {
    try {
      const usageStats = await db.query.uiFeatureUsage.findMany({
        where: eq(uiFeatureUsage.userId, userId),
        orderBy: [desc(uiFeatureUsage.usageCount)]
      });
      
      return usageStats;
    } catch (error) {
      console.error('Error fetching user feature usage:', error);
      throw error;
    }
  }

  /**
   * Get most frequently used features for a user
   */
  async getMostUsedFeatures(userId: number, limit: number = 5): Promise<UiFeatureUsage[]> {
    try {
      const topFeatures = await db.query.uiFeatureUsage.findMany({
        where: eq(uiFeatureUsage.userId, userId),
        orderBy: [desc(uiFeatureUsage.usageCount)],
        limit
      });
      
      return topFeatures;
    } catch (error) {
      console.error('Error fetching most used features:', error);
      throw error;
    }
  }

  /**
   * Get recently used features for a user
   */
  async getRecentlyUsedFeatures(userId: number, limit: number = 5): Promise<UiFeatureUsage[]> {
    try {
      const recentFeatures = await db.query.uiFeatureUsage.findMany({
        where: eq(uiFeatureUsage.userId, userId),
        orderBy: [desc(uiFeatureUsage.lastUsedAt)],
        limit
      });
      
      return recentFeatures;
    } catch (error) {
      console.error('Error fetching recently used features:', error);
      throw error;
    }
  }

  /**
   * Get feature usage by ID
   */
  async getFeatureUsage(userId: number, featureId: string): Promise<UiFeatureUsage | null> {
    try {
      const usage = await db.query.uiFeatureUsage.findFirst({
        where: (fields) => {
          return eq(fields.userId, userId) && eq(fields.featureId, featureId);
        }
      });
      
      return usage || null;
    } catch (error) {
      console.error(`Error fetching feature usage for ${featureId}:`, error);
      throw error;
    }
  }

  /**
   * Reset feature usage statistics for a user
   */
  async resetFeatureUsage(userId: number): Promise<void> {
    try {
      await db
        .delete(uiFeatureUsage)
        .where(eq(uiFeatureUsage.userId, userId));
      
    } catch (error) {
      console.error('Error resetting feature usage:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const uiPersonalizationService = new UiPersonalizationService();