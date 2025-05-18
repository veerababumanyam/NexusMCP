import { Express } from 'express';
import { logger } from '../utils/logger';
import { db } from '@db';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { 
  connectionSettings, 
  connectionSettingsInsertSchema, 
  connectionSettingsSelectSchema,
  type ConnectionSettings
} from '@shared/schema_connection';

export const connectionSettingsSchema = z.object({
  maxConnections: z.number().int().min(1).max(1000),
  connectionTimeout: z.number().int().min(1000).max(60000),
  idleTimeout: z.number().int().min(1000).max(300000),
  keepAliveInterval: z.number().int().min(1000).max(60000),
  retryInterval: z.number().int().min(100).max(10000),
  maxRetries: z.number().int().min(0).max(20),
  circuitBreakerEnabled: z.boolean(),
  circuitBreakerThreshold: z.number().int().min(1).max(100),
  circuitBreakerResetTimeout: z.number().int().min(1000).max(300000),
  healthCheckEnabled: z.boolean(),
  healthCheckInterval: z.number().int().min(1000).max(300000),
  loadBalancingEnabled: z.boolean(),
  loadBalancingStrategy: z.enum(['round_robin', 'least_connections', 'weighted', 'sticky_session']),
  tlsVerification: z.boolean()
});

export function setupConnectionSettingsRoutes(app: Express) {
  // Middleware to check if the user is authenticated
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }
    next();
  };

  // Get connection settings
  app.get('/api/mcp/connection-settings', requireAuth, async (req, res) => {
    try {
      logger.info('Getting connection settings');
      
      // Get the settings from the database
      const settings = await db.query.connectionSettings.findFirst();
      
      if (!settings) {
        // If no settings exist, return default settings
        const defaultSettings = {
          id: 0,
          maxConnections: 100,
          connectionTimeout: 5000,
          idleTimeout: 60000,
          keepAliveInterval: 30000,
          retryInterval: 2000,
          maxRetries: 5,
          circuitBreakerEnabled: true,
          circuitBreakerThreshold: 5,
          circuitBreakerResetTimeout: 30000,
          healthCheckEnabled: true,
          healthCheckInterval: 60000,
          loadBalancingEnabled: true,
          loadBalancingStrategy: 'round_robin',
          tlsVerification: true,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        return res.status(200).json(defaultSettings);
      }
      
      return res.status(200).json(settings);
    } catch (error) {
      logger.error('Error getting connection settings', error);
      return res.status(500).json({ error: 'Failed to get connection settings' });
    }
  });
  
  // Update connection settings
  app.put('/api/mcp/connection-settings', requireAuth, async (req, res) => {
    try {
      logger.info('Updating connection settings');
      
      // Validate request body
      const validatedData = connectionSettingsSchema.parse(req.body);
      
      // Check if settings already exist
      const existingSettings = await db.query.connectionSettings.findFirst();
      
      if (existingSettings) {
        // Update existing settings
        const [updated] = await db
          .update(connectionSettings)
          .set({
            ...validatedData,
            updatedAt: new Date()
          })
          .where(eq(connectionSettings.id, existingSettings.id))
          .returning();
        
        // Audit logging would go here, but we'll implement it later
        logger.info(`Connection settings updated by user ${req.user?.id}`)
        
        return res.status(200).json(updated);
      } else {
        // Create new settings
        const [created] = await db
          .insert(connectionSettings)
          .values({
            ...validatedData,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();
        
        // Audit logging would go here, but we'll implement it later
        logger.info(`Connection settings created by user ${req.user?.id}`)
        
        return res.status(201).json(created);
      }
    } catch (error) {
      logger.error('Error updating connection settings', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      
      return res.status(500).json({ error: 'Failed to update connection settings' });
    }
  });
}