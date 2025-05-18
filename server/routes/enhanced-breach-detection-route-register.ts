/**
 * Enhanced Breach Detection Routes Registration
 * This file exports a function to register all breach detection routes
 */
import { Express } from 'express';
import { requireAuth } from '../auth';
import enhancedBreachDetectionRouter from './enhanced-breach-detection-routes';

/**
 * Register all enhanced breach detection routes with the Express application
 */
export function registerEnhancedBreachDetectionRoutes(app: Express) {
  // Register all breach detection routes under /api/breach-detection
  app.use('/api/breach-detection', requireAuth, enhancedBreachDetectionRouter);
}