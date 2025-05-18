/**
 * Data Storage & Business Intelligence API Routes
 * 
 * Unified API for managing database connections, data warehouses,
 * BI tool integrations, and file storage from a single endpoint.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { DataStorageService } from '../services/integrations/DataStorageService';
import { 
  insertDataIntegrationSchema,
  DATA_INTEGRATION_TYPES,
  DATABASE_SYSTEMS,
  DATA_WAREHOUSE_SYSTEMS,
  BI_TOOL_SYSTEMS,
  FILE_STORAGE_SYSTEMS,
  CONNECTION_STATUS
} from '@shared/schema_data_storage_bi';

// Create router instance
const router = Router();
const dataStorageService = DataStorageService.getInstance();

// Error handling middleware
const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * Get all available integration systems by type
 */
router.get('/systems', (req, res) => {
  try {
    res.json({
      types: DATA_INTEGRATION_TYPES,
      systems: {
        database: DATABASE_SYSTEMS,
        data_warehouse: DATA_WAREHOUSE_SYSTEMS,
        bi_tool: BI_TOOL_SYSTEMS,
        file_storage: FILE_STORAGE_SYSTEMS
      },
      statuses: CONNECTION_STATUS
    });
  } catch (error) {
    console.error('Error getting data storage systems:', error);
    res.status(500).json({ error: 'Failed to fetch data storage systems', message: error.message });
  }
});

/**
 * Get all integrations with optional filtering
 * 
 * Root-level endpoint to support direct access from landing page
 */
router.get('/', asyncHandler(async (req, res) => {
  try {
    const { workspaceId, type, system, enabled, page, limit, search, sortBy, sortDirection } = req.query;
    
    const result = await dataStorageService.getAllIntegrations({
      workspaceId: workspaceId ? Number(workspaceId) : undefined,
      type: type as any,
      system: system as string,
      enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      search: search as string,
      sortBy: sortBy as string,
      sortDirection: sortDirection as 'asc' | 'desc'
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error getting data storage integrations:', error);
    res.status(500).json({ error: 'Failed to fetch data storage integrations', message: error.message });
  }
}));

/**
 * Get all integrations with optional filtering
 */
router.get('/integrations', asyncHandler(async (req, res) => {
  try {
    const { workspaceId, type, system, enabled, page, limit, search, sortBy, sortDirection } = req.query;
    
    const result = await dataStorageService.getAllIntegrations({
      workspaceId: workspaceId ? Number(workspaceId) : undefined,
      type: type as any,
      system: system as string,
      enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      search: search as string,
      sortBy: sortBy as string,
      sortDirection: sortDirection as 'asc' | 'desc'
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error getting data storage integrations:', error);
    res.status(500).json({ error: 'Failed to fetch data storage integrations', message: error.message });
  }
}));

/**
 * Create a new integration from root path
 */
router.post('/', asyncHandler(async (req, res) => {
  try {
    const validatedData = insertDataIntegrationSchema.parse(req.body);
    const integration = await dataStorageService.createIntegration(validatedData);
    res.status(201).json(integration);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', message: error.errors });
    } else {
      console.error('Error creating integration:', error);
      res.status(500).json({ error: 'Failed to create integration', message: error.message });
    }
  }
}));

/**
 * Create a new integration
 */
router.post('/integrations', asyncHandler(async (req, res) => {
  try {
    const validatedData = insertDataIntegrationSchema.parse(req.body);
    const integration = await dataStorageService.createIntegration(validatedData);
    res.status(201).json(integration);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', message: error.errors });
    } else {
      console.error('Error creating integration:', error);
      res.status(500).json({ error: 'Failed to create integration', message: error.message });
    }
  }
}));

/**
 * Get integration by ID
 */
router.get('/integrations/:id', asyncHandler(async (req, res) => {
  try {
    const id = Number(req.params.id);
    const integration = await dataStorageService.getIntegration(id);
    res.json(integration);
  } catch (error) {
    console.error(`Error getting integration ${req.params.id}:`, error);
    res.status(404).json({ error: 'Integration not found', message: error.message });
  }
}));

/**
 * Update an integration
 */
router.patch('/integrations/:id', asyncHandler(async (req, res) => {
  try {
    const id = Number(req.params.id);
    
    // Validate only the fields that are being updated
    const updateData = req.body;
    
    const integration = await dataStorageService.updateIntegration(id, updateData);
    res.json(integration);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', message: error.errors });
    } else {
      console.error(`Error updating integration ${req.params.id}:`, error);
      res.status(500).json({ error: 'Failed to update integration', message: error.message });
    }
  }
}));

/**
 * Delete an integration
 */
router.delete('/integrations/:id', asyncHandler(async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await dataStorageService.deleteIntegration(id);
    
    if (result.success) {
      res.status(200).json({ message: 'Integration deleted successfully' });
    } else {
      res.status(404).json({ error: 'Integration not found' });
    }
  } catch (error) {
    console.error(`Error deleting integration ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete integration', message: error.message });
  }
}));

/**
 * Test integration connection
 */
router.post('/integrations/:id/test-connection', asyncHandler(async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await dataStorageService.testConnection(id);
    res.json(result);
  } catch (error) {
    console.error(`Error testing connection for integration ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to test connection', message: error.message });
  }
}));

/**
 * Discover schemas for a database integration
 */
router.post('/integrations/:id/discover-schemas', asyncHandler(async (req, res) => {
  try {
    const id = Number(req.params.id);
    const schemas = await dataStorageService.discoverSchemas(id);
    res.json(schemas);
  } catch (error) {
    console.error(`Error discovering schemas for integration ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to discover schemas', message: error.message });
  }
}));

/**
 * Get schemas for an integration
 */
router.get('/integrations/:id/schemas', asyncHandler(async (req, res) => {
  try {
    const id = Number(req.params.id);
    const schemas = await dataStorageService.getSchemas(id);
    res.json(schemas);
  } catch (error) {
    console.error(`Error getting schemas for integration ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to get schemas', message: error.message });
  }
}));

/**
 * Create a new schema for an integration
 */
router.post('/integrations/:id/schemas', asyncHandler(async (req, res) => {
  try {
    const id = Number(req.params.id);
    const schema = await dataStorageService.createSchema({
      ...req.body,
      integrationId: id
    });
    res.status(201).json(schema);
  } catch (error) {
    console.error(`Error creating schema for integration ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to create schema', message: error.message });
  }
}));

/**
 * Get sync jobs for an integration
 */
router.get('/integrations/:id/sync-jobs', asyncHandler(async (req, res) => {
  try {
    const id = Number(req.params.id);
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const jobs = await dataStorageService.getSyncJobs(id, limit);
    res.json(jobs);
  } catch (error) {
    console.error(`Error getting sync jobs for integration ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to get sync jobs', message: error.message });
  }
}));

/**
 * Create a new sync job for an integration
 */
router.post('/integrations/:id/sync-jobs', asyncHandler(async (req, res) => {
  try {
    const id = Number(req.params.id);
    const job = await dataStorageService.createSyncJob({
      ...req.body,
      integrationId: id,
      status: 'pending'
    });
    res.status(201).json(job);
  } catch (error) {
    console.error(`Error creating sync job for integration ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to create sync job', message: error.message });
  }
}));

/**
 * Get query templates for an integration
 */
router.get('/integrations/:id/query-templates', asyncHandler(async (req, res) => {
  try {
    const id = Number(req.params.id);
    const templates = await dataStorageService.getQueryTemplates(id);
    res.json(templates);
  } catch (error) {
    console.error(`Error getting query templates for integration ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to get query templates', message: error.message });
  }
}));

/**
 * Create a new query template for an integration
 */
router.post('/integrations/:id/query-templates', asyncHandler(async (req, res) => {
  try {
    const id = Number(req.params.id);
    const template = await dataStorageService.createQueryTemplate({
      ...req.body,
      integrationId: id
    });
    res.status(201).json(template);
  } catch (error) {
    console.error(`Error creating query template for integration ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to create query template', message: error.message });
  }
}));

export default router;