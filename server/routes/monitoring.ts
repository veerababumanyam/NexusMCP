/**
 * Monitoring Routes
 * 
 * Enterprise-grade APIs for integrating with APM and logging systems.
 * This unified controller handles all monitoring-related endpoints including:
 * - APM (Application Performance Monitoring)
 * - Log Aggregation
 * - Metrics Collection and Forwarding
 */

import { Router, Request, Response } from 'express';
import { monitoringService } from '../services/integrations/MonitoringService';
import { 
  insertMonitoringIntegrationSchema, 
  insertMonitoringEndpointSchema,
  insertMonitoringAlertSchema
} from '@shared/schema_monitoring';
import { z } from 'zod';

const router = Router();
const apiPrefix = '/api/monitoring';

// ===== Integration routes =====

/**
 * Get all monitoring integrations with filtering options
 */
router.get('/integrations', async (req: Request, res: Response) => {
  try {
    const filters = {
      type: req.query.type as string,
      system: req.query.system as string,
      enabled: req.query.enabled === 'true' ? true : req.query.enabled === 'false' ? false : undefined,
      status: req.query.status as string,
      workspaceId: req.query.workspaceId ? parseInt(req.query.workspaceId as string) : undefined,
      search: req.query.search as string
    };
    
    const integrations = await monitoringService.getAllIntegrations(filters);
    
    res.json(integrations);
  } catch (error) {
    console.error('Error getting integrations', error);
    res.status(500).json({ error: 'Failed to fetch monitoring integrations' });
  }
});

/**
 * Get a single integration by ID
 */
router.get('/integrations/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const integration = await monitoringService.getIntegrationById(id);
    
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }
    
    res.json(integration);
  } catch (error) {
    console.error(`Error getting integration ${req.params.id}`, error);
    res.status(500).json({ error: 'Failed to fetch monitoring integration' });
  }
});

/**
 * Create a new integration
 */
router.post('/integrations', async (req: Request, res: Response) => {
  try {
    // Validate the request body
    const userId = req.user?.id || 1; // Default to admin user if auth not set up
    const validatedData = insertMonitoringIntegrationSchema.parse({
      ...req.body,
      createdBy: userId,
    });
    
    const integration = await monitoringService.createIntegration(validatedData);
    
    res.status(201).json(integration);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    console.error('Error creating integration', error);
    res.status(500).json({ error: 'Failed to create monitoring integration' });
  }
});

/**
 * Update an integration
 */
router.put('/integrations/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    // Validate the request body allowing partial updates
    const validatedData = insertMonitoringIntegrationSchema.partial().parse(req.body);
    
    const integration = await monitoringService.updateIntegration(id, validatedData);
    
    if (!integration) {
      return res.status(404).json({ error: 'Integration not found' });
    }
    
    res.json(integration);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    console.error(`Error updating integration ${req.params.id}`, error);
    res.status(500).json({ error: 'Failed to update monitoring integration' });
  }
});

/**
 * Delete an integration
 */
router.delete('/integrations/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const userId = req.user?.id || 1; // Default to admin user if auth not set up
    const success = await monitoringService.deleteIntegration(id, userId);
    
    if (!success) {
      return res.status(404).json({ error: 'Integration not found' });
    }
    
    res.status(204).end();
  } catch (error) {
    console.error(`Error deleting integration ${req.params.id}`, error);
    res.status(500).json({ error: 'Failed to delete monitoring integration' });
  }
});

/**
 * Test an integration connection
 */
router.post('/integrations/:id/test', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const result = await monitoringService.testConnection(id);
    
    res.json(result);
  } catch (error) {
    console.error(`Error testing integration ${req.params.id}`, error);
    res.status(500).json({ error: 'Failed to test monitoring integration' });
  }
});

/**
 * Refresh an integration data
 */
router.post('/integrations/:id/refresh', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    await monitoringService.refreshIntegration(id);
    
    res.status(200).json({ success: true });
  } catch (error) {
    console.error(`Error refreshing integration ${req.params.id}`, error);
    res.status(500).json({ error: 'Failed to refresh monitoring integration' });
  }
});

// ===== Endpoint routes =====

/**
 * Get all endpoints for an integration
 */
router.get('/integrations/:id/endpoints', async (req: Request, res: Response) => {
  try {
    const integrationId = parseInt(req.params.id);
    
    if (isNaN(integrationId)) {
      return res.status(400).json({ error: 'Invalid integration ID format' });
    }
    
    const endpoints = await monitoringService.getEndpointsByIntegrationId(integrationId);
    
    res.json(endpoints);
  } catch (error) {
    console.error(`Error getting endpoints for integration ${req.params.id}`, error);
    res.status(500).json({ error: 'Failed to fetch monitoring endpoints' });
  }
});

/**
 * Create a new endpoint
 */
router.post('/endpoints', async (req: Request, res: Response) => {
  try {
    // Validate the request body
    const validatedData = insertMonitoringEndpointSchema.parse(req.body);
    
    const endpoint = await monitoringService.createEndpoint(validatedData);
    
    res.status(201).json(endpoint);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    console.error('Error creating endpoint', error);
    res.status(500).json({ error: 'Failed to create monitoring endpoint' });
  }
});

/**
 * Update an endpoint
 */
router.put('/endpoints/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    // Validate the request body allowing partial updates
    const validatedData = insertMonitoringEndpointSchema.partial().parse(req.body);
    
    const endpoint = await monitoringService.updateEndpoint(id, validatedData);
    
    if (!endpoint) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }
    
    res.json(endpoint);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    console.error(`Error updating endpoint ${req.params.id}`, error);
    res.status(500).json({ error: 'Failed to update monitoring endpoint' });
  }
});

/**
 * Delete an endpoint
 */
router.delete('/endpoints/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const success = await monitoringService.deleteEndpoint(id);
    
    if (!success) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }
    
    res.status(204).end();
  } catch (error) {
    console.error(`Error deleting endpoint ${req.params.id}`, error);
    res.status(500).json({ error: 'Failed to delete monitoring endpoint' });
  }
});

// ===== Alert routes =====

/**
 * Get all alerts for an integration
 */
router.get('/integrations/:id/alerts', async (req: Request, res: Response) => {
  try {
    const integrationId = parseInt(req.params.id);
    
    if (isNaN(integrationId)) {
      return res.status(400).json({ error: 'Invalid integration ID format' });
    }
    
    const alerts = await monitoringService.getAlertsByIntegrationId(integrationId);
    
    res.json(alerts);
  } catch (error) {
    console.error(`Error getting alerts for integration ${req.params.id}`, error);
    res.status(500).json({ error: 'Failed to fetch monitoring alerts' });
  }
});

/**
 * Create a new alert
 */
router.post('/alerts', async (req: Request, res: Response) => {
  try {
    // Validate the request body
    const userId = req.user?.id || 1; // Default to admin user if auth not set up
    const validatedData = insertMonitoringAlertSchema.parse({
      ...req.body,
      createdBy: userId,
    });
    
    const alert = await monitoringService.createAlert(validatedData);
    
    res.status(201).json(alert);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    console.error('Error creating alert', error);
    res.status(500).json({ error: 'Failed to create monitoring alert' });
  }
});

/**
 * Update an alert
 */
router.put('/alerts/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    // Validate the request body allowing partial updates
    const validatedData = insertMonitoringAlertSchema.partial().parse(req.body);
    
    const alert = await monitoringService.updateAlert(id, validatedData);
    
    if (!alert) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    res.json(alert);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    console.error(`Error updating alert ${req.params.id}`, error);
    res.status(500).json({ error: 'Failed to update monitoring alert' });
  }
});

/**
 * Delete an alert
 */
router.delete('/alerts/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID format' });
    }
    
    const success = await monitoringService.deleteAlert(id);
    
    if (!success) {
      return res.status(404).json({ error: 'Alert not found' });
    }
    
    res.status(204).end();
  } catch (error) {
    console.error(`Error deleting alert ${req.params.id}`, error);
    res.status(500).json({ error: 'Failed to delete monitoring alert' });
  }
});

// ===== Metadata routes =====

/**
 * Get available monitoring systems information
 */
router.get('/systems', async (req: Request, res: Response) => {
  try {
    const systems = monitoringService.getMonitoringSystemsInfo();
    res.json(systems);
  } catch (error) {
    console.error('Error getting monitoring systems info', error);
    res.status(500).json({ error: 'Failed to fetch monitoring systems information' });
  }
});

// Create a standalone express router for public endpoints with its own middleware
import express from 'express';
export const publicMonitoringRouter = express.Router();

/**
 * Public endpoint for testing - get available monitoring systems information
 * This endpoint is not protected by authentication for development purposes
 */
publicMonitoringRouter.get('/systems', async (req: Request, res: Response) => {
  try {
    console.log('Public monitoring systems endpoint accessed');
    
    // Set CORS headers to allow access from anywhere for this public endpoint
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    
    const systems = monitoringService.getMonitoringSystemsInfo();
    res.json(systems);
  } catch (error) {
    console.error('Error getting monitoring systems info', error);
    res.status(500).json({ error: 'Failed to fetch monitoring systems information' });
  }
});

export default router;