/**
 * Directory Service Routes
 * 
 * API endpoints for LDAP/Active Directory integration:
 * - Directory service configuration management
 * - User/group synchronization
 * - User provisioning
 */

import express, { Request, Response } from 'express';
import { z } from 'zod';
import { directoryService } from '../services/directoryService';
import { createAuditLogFromRequest } from '../services/enhancedAuditService';
import { directoryServiceInsertSchema } from '@shared/schema_directory';

export const directoryRouter = express.Router();

/**
 * Get all directory services
 */
directoryRouter.get('/', async (req: Request, res: Response) => {
  try {
    const workspaceId = req.query.workspaceId ? parseInt(req.query.workspaceId as string) : undefined;
    const services = await directoryService.getAllDirectoryServices(workspaceId);
    
    // Mask sensitive information
    const sanitizedServices = services.map(service => {
      const { bindCredentials, ...rest } = service;
      return {
        ...rest,
        hasCredentials: !!bindCredentials
      };
    });
    
    return res.status(200).json(sanitizedServices);
  } catch (error) {
    console.error('Error fetching directory services:', error);
    return res.status(500).json({ error: 'Failed to fetch directory services' });
  }
});

/**
 * Get directory service by ID
 */
directoryRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const service = await directoryService.getDirectoryService(id);
    
    if (!service) {
      return res.status(404).json({ error: 'Directory service not found' });
    }
    
    // Mask sensitive information
    const { bindCredentials, ...sanitizedService } = service;
    
    return res.status(200).json({
      ...sanitizedService,
      hasCredentials: !!bindCredentials
    });
  } catch (error) {
    console.error(`Error fetching directory service ${req.params.id}:`, error);
    return res.status(500).json({ error: 'Failed to fetch directory service' });
  }
});

/**
 * Create directory service
 */
directoryRouter.post('/', async (req: Request, res: Response) => {
  try {
    const validatedData = directoryServiceInsertSchema.parse(req.body);
    
    const service = await directoryService.createDirectoryService(
      validatedData,
      req.user?.id
    );
    
    // Create audit log
    await createAuditLogFromRequest(req, 'directory.service.create', {
      directoryServiceId: service.id,
      name: service.name,
      type: service.type,
    });
    
    // Mask sensitive information
    const { bindCredentials, ...sanitizedService } = service;
    
    return res.status(201).json({
      ...sanitizedService,
      hasCredentials: !!bindCredentials
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    console.error('Error creating directory service:', error);
    return res.status(500).json({ error: 'Failed to create directory service' });
  }
});

/**
 * Update directory service
 */
directoryRouter.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    // Get existing service
    const existingService = await directoryService.getDirectoryService(id);
    if (!existingService) {
      return res.status(404).json({ error: 'Directory service not found' });
    }
    
    // Validate request data
    const updateSchema = directoryServiceInsertSchema.partial();
    const validatedData = updateSchema.parse(req.body);
    
    // If bindCredentials is empty string, keep existing value
    if (validatedData.bindCredentials === '') {
      delete validatedData.bindCredentials;
    }
    
    const service = await directoryService.updateDirectoryService(
      id,
      validatedData,
      req.user?.id
    );
    
    // Create audit log
    await createAuditLogFromRequest(req, 'directory.service.update', {
      directoryServiceId: service.id,
      name: service.name,
      updatedFields: Object.keys(validatedData)
    });
    
    // Mask sensitive information
    const { bindCredentials, ...sanitizedService } = service;
    
    return res.status(200).json({
      ...sanitizedService,
      hasCredentials: !!bindCredentials
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    console.error(`Error updating directory service ${req.params.id}:`, error);
    return res.status(500).json({ error: 'Failed to update directory service' });
  }
});

/**
 * Delete directory service
 */
directoryRouter.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    // Get existing service
    const existingService = await directoryService.getDirectoryService(id);
    if (!existingService) {
      return res.status(404).json({ error: 'Directory service not found' });
    }
    
    // Keep info for audit log
    const { name, type } = existingService;
    
    // Delete service and all related data
    await directoryService.deleteDirectoryService(id);
    
    // Create audit log
    await createAuditLogFromRequest(req, 'directory.service.delete', {
      directoryServiceId: id,
      name,
      type
    });
    
    return res.status(200).json({ message: 'Directory service deleted successfully' });
  } catch (error) {
    console.error(`Error deleting directory service ${req.params.id}:`, error);
    return res.status(500).json({ error: 'Failed to delete directory service' });
  }
});

/**
 * Test directory service connection
 */
directoryRouter.post('/:id/test', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    // Test connection by searching with a simple query
    const users = await directoryService.searchUsers(id, '*');
    
    // Create audit log
    await createAuditLogFromRequest(req, 'directory.service.test', {
      directoryServiceId: id,
      success: true,
      userCount: users.length
    });
    
    return res.status(200).json({ 
      status: 'success',
      message: 'Connection successful',
      userCount: users.length
    });
  } catch (error) {
    console.error(`Error testing directory service ${req.params.id}:`, error);
    
    // Create audit log for failed test
    await createAuditLogFromRequest(req, 'directory.service.test', {
      directoryServiceId: parseInt(req.params.id),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    return res.status(500).json({ 
      status: 'error',
      error: 'Connection test failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Start directory sync
 */
directoryRouter.post('/:id/sync', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    // Validate sync options
    const syncOptionsSchema = z.object({
      fullSync: z.boolean().optional(),
      provisionUsers: z.boolean().optional(),
      syncGroups: z.boolean().optional(),
      filterUsers: z.string().optional(),
      filterGroups: z.string().optional(),
      defaultRoleId: z.number().optional(),
      defaultWorkspaceId: z.number().optional(),
      mapGroupsToRoles: z.boolean().optional()
    });
    
    const syncOptions = syncOptionsSchema.parse(req.body);
    
    // Start sync in background
    res.status(202).json({ 
      status: 'started',
      message: 'Directory synchronization started'
    });
    
    // Create audit log for sync start
    await createAuditLogFromRequest(req, 'directory.sync.start', {
      directoryServiceId: id,
      options: syncOptions
    });
    
    // Run sync after response is sent
    directoryService.syncDirectory(id, {
      ...syncOptions,
      req,
      initiatedBy: req.user?.id
    })
      .then(result => {
        console.log(`Directory sync completed for service ${id}:`, result);
      })
      .catch(error => {
        console.error(`Directory sync failed for service ${id}:`, error);
      });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    console.error(`Error starting directory sync for service ${req.params.id}:`, error);
    return res.status(500).json({ error: 'Failed to start directory synchronization' });
  }
});

/**
 * Get directory sync jobs
 */
directoryRouter.get('/:id/sync/jobs', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const jobs = await directoryService.getDirectorySyncJobs(id);
    
    return res.status(200).json(jobs);
  } catch (error) {
    console.error(`Error fetching sync jobs for directory service ${req.params.id}:`, error);
    return res.status(500).json({ error: 'Failed to fetch sync jobs' });
  }
});

/**
 * Search directory users
 */
directoryRouter.get('/:id/users/search', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const query = (req.query.query as string) || '*';
    
    const users = await directoryService.searchUsers(id, query);
    
    return res.status(200).json(users);
  } catch (error) {
    console.error(`Error searching directory users for service ${req.params.id}:`, error);
    return res.status(500).json({ error: 'Failed to search directory users' });
  }
});

/**
 * Get directory users
 */
directoryRouter.get('/:id/users', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const filter = req.query.filter as string | undefined;
    
    const users = await directoryService.getDirectoryUsers(id, filter);
    
    return res.status(200).json(users);
  } catch (error) {
    console.error(`Error fetching directory users for service ${req.params.id}:`, error);
    return res.status(500).json({ error: 'Failed to fetch directory users' });
  }
});

/**
 * Provision a directory user
 */
directoryRouter.post('/:id/users/:externalId/provision', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const externalId = req.params.externalId;
    
    // Validate provision options
    const provisionOptionsSchema = z.object({
      roleId: z.number().optional(),
      workspaceId: z.number().optional()
    });
    
    const options = provisionOptionsSchema.parse(req.body);
    
    await directoryService.provisionUser(
      id,
      externalId,
      options.roleId,
      options.workspaceId,
      req
    );
    
    return res.status(200).json({ 
      status: 'success',
      message: 'User provisioned successfully'
    });
  } catch (error) {
    console.error(`Error provisioning user ${req.params.externalId} from directory service ${req.params.id}:`, error);
    return res.status(500).json({ 
      status: 'error',
      error: 'User provisioning failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Search directory groups
 */
directoryRouter.get('/:id/groups/search', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const query = (req.query.query as string) || '*';
    
    const groups = await directoryService.searchGroups(id, query);
    
    return res.status(200).json(groups);
  } catch (error) {
    console.error(`Error searching directory groups for service ${req.params.id}:`, error);
    return res.status(500).json({ error: 'Failed to search directory groups' });
  }
});

/**
 * Get directory groups
 */
directoryRouter.get('/:id/groups', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const filter = req.query.filter as string | undefined;
    
    const groups = await directoryService.getDirectoryGroups(id, filter);
    
    return res.status(200).json(groups);
  } catch (error) {
    console.error(`Error fetching directory groups for service ${req.params.id}:`, error);
    return res.status(500).json({ error: 'Failed to fetch directory groups' });
  }
});

// Export the router as directoryRouter
// (already exported at the top of the file)