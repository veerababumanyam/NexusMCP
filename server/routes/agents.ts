import { Router, Request, Response, NextFunction } from 'express';
import { agentManagementService } from '../services/agentManagementService';
import { insertMcpAgentSchema } from '@shared/schema_agents';
import { z } from 'zod';
import { rateLimitService, RateLimitType, RateLimitStrategy } from '../services/rateLimitService';
import { storage } from '../storage';

// Validation schemas
const registerAgentSchema = insertMcpAgentSchema.omit({ apiKey: true, apiKeyHash: true });
const updateAgentSchema = insertMcpAgentSchema.partial().omit({ apiKey: true, apiKeyHash: true });
const assignToolsSchema = z.object({
  toolIds: z.array(z.number()).min(1, "At least one tool ID is required")
});
const removeToolsSchema = assignToolsSchema;
const createWorkflowSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  status: z.enum(["draft", "active", "inactive", "archived"]).default("draft"),
  definition: z.any().refine(val => typeof val === 'object', "Definition must be a valid JSON object"),
  workspaceId: z.number().optional(),
  isTemplate: z.boolean().optional()
});
const updateWorkflowSchema = createWorkflowSchema.partial();

export function registerAgentRoutes(router: Router) {
  // Apply rate limiting for agent routes
  router.use('/agents', rateLimitService.create('agents', {
    windowMs: 60 * 1000, // 1 minute
    max: 150, // 150 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' }
  }));

  // Registration and management endpoints
  router.use('/agents/registration', rateLimitService.create('agent-registration', {
    windowMs: 60 * 1000, // 1 minute
    max: 50, // 50 registrations per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many registration requests, please try again later' }
  }));

  // Authentication endpoint rate limiting
  router.use('/agents/auth', rateLimitService.create('agent-auth', {
    windowMs: 60 * 1000, // 1 minute
    max: 300, // 300 auth requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many authentication requests, please try again later' }
  }));

  // Get all agents
  router.get('/agents', async (req: Request, res: Response) => {
    try {
      // Parse query parameters
      const workspaceId = req.query.workspaceId ? parseInt(req.query.workspaceId as string) : undefined;
      const agentType = req.query.agentType as string | undefined;
      const serverId = req.query.serverId ? parseInt(req.query.serverId as string) : undefined;
      const status = req.query.status as string | undefined;
      const implementsA2A = req.query.implementsA2A !== undefined ? 
        req.query.implementsA2A === 'true' : undefined;
      const search = req.query.search as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

      // Get agents with pagination and filtering
      const result = await agentManagementService.getAgents({
        workspaceId,
        agentType,
        serverId,
        status,
        implementsA2A,
        search,
        limit,
        offset
      });

      // Create response with pagination metadata
      const response = {
        agents: result.agents,
        pagination: {
          total: result.total,
          limit,
          offset,
          hasMore: offset + result.agents.length < result.total
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting agents:', error);
      res.status(500).json({ error: 'Failed to get agents' });
    }
  });

  // Get a single agent
  router.get('/agents/:id', async (req: Request, res: Response) => {
    try {
      const agentId = parseInt(req.params.id);
      if (isNaN(agentId)) {
        return res.status(400).json({ error: 'Invalid agent ID' });
      }

      const agent = await agentManagementService.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      res.json(agent);
    } catch (error) {
      console.error(`Error getting agent ${req.params.id}:`, error);
      res.status(500).json({ error: 'Failed to get agent' });
    }
  });

  // Register a new agent
  router.post('/agents/registration', async (req: Request, res: Response) => {
    try {
      // Validate request body
      const validatedData = registerAgentSchema.parse(req.body);

      // Add user ID if authenticated
      const createdById = req.user?.id;

      // Register the agent
      const agent = await agentManagementService.registerAgent({
        ...validatedData,
        createdById: createdById
      });

      // Create audit log
      if (createdById) {
        await storage.createAuditLog({
          userId: createdById,
          action: 'register_agent',
          resourceType: 'agent',
          resourceId: agent.id.toString(),
          details: {
            agentType: agent.agentType,
            name: agent.name
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });
      }

      res.status(201).json(agent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error('Error registering agent:', error);
      res.status(500).json({ error: 'Failed to register agent' });
    }
  });

  // Authenticate an agent
  router.post('/agents/auth', async (req: Request, res: Response) => {
    try {
      const { agentId, apiKey } = req.body;
      if (!agentId || !apiKey) {
        return res.status(400).json({ error: 'Agent ID and API key are required' });
      }

      const isAuthenticated = await agentManagementService.authenticateAgent(
        parseInt(agentId),
        apiKey
      );

      if (!isAuthenticated) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      res.json({ authenticated: true });
    } catch (error) {
      console.error('Error authenticating agent:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  });

  // Update an agent
  router.patch('/agents/:id', async (req: Request, res: Response) => {
    try {
      const agentId = parseInt(req.params.id);
      if (isNaN(agentId)) {
        return res.status(400).json({ error: 'Invalid agent ID' });
      }

      // Validate request body
      const validatedData = updateAgentSchema.parse(req.body);

      // Update the agent
      const agent = await agentManagementService.updateAgent(agentId, validatedData);

      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      // Create audit log
      if (req.user?.id) {
        await storage.createAuditLog({
          userId: req.user.id,
          action: 'update_agent',
          resourceType: 'agent',
          resourceId: agent.id.toString(),
          details: {
            fields: Object.keys(validatedData)
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });
      }

      res.json(agent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error(`Error updating agent ${req.params.id}:`, error);
      res.status(500).json({ error: 'Failed to update agent' });
    }
  });

  // Deregister an agent
  router.delete('/agents/:id', async (req: Request, res: Response) => {
    try {
      const agentId = parseInt(req.params.id);
      if (isNaN(agentId)) {
        return res.status(400).json({ error: 'Invalid agent ID' });
      }

      // Get agent info before deletion for audit log
      const agent = await agentManagementService.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      // Deregister the agent
      const success = await agentManagementService.deregisterAgent(agentId);

      if (!success) {
        return res.status(404).json({ error: 'Agent not found or already deleted' });
      }

      // Create audit log
      if (req.user?.id) {
        await storage.createAuditLog({
          userId: req.user.id,
          action: 'deregister_agent',
          resourceType: 'agent',
          resourceId: agentId.toString(),
          details: {
            name: agent.name,
            agentType: agent.agentType
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error(`Error deregistering agent ${req.params.id}:`, error);
      res.status(500).json({ error: 'Failed to deregister agent' });
    }
  });

  // Regenerate API key for an agent
  router.post('/agents/:id/regenerate-api-key', async (req: Request, res: Response) => {
    try {
      const agentId = parseInt(req.params.id);
      if (isNaN(agentId)) {
        return res.status(400).json({ error: 'Invalid agent ID' });
      }

      // Regenerate API key
      const result = await agentManagementService.regenerateApiKey(agentId);

      if (!result) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      // Create audit log
      if (req.user?.id) {
        await storage.createAuditLog({
          userId: req.user.id,
          action: 'regenerate_agent_api_key',
          resourceType: 'agent',
          resourceId: agentId.toString(),
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });
      }

      res.json(result);
    } catch (error) {
      console.error(`Error regenerating API key for agent ${req.params.id}:`, error);
      res.status(500).json({ error: 'Failed to regenerate API key' });
    }
  });

  // Tool management endpoints

  // Assign tools to an agent
  router.post('/agents/:id/tools', async (req: Request, res: Response) => {
    try {
      const agentId = parseInt(req.params.id);
      if (isNaN(agentId)) {
        return res.status(400).json({ error: 'Invalid agent ID' });
      }

      // Validate request body
      const validatedData = assignToolsSchema.parse(req.body);

      // Assign tools
      const count = await agentManagementService.assignToolsToAgent(agentId, validatedData.toolIds);

      // Create audit log
      if (req.user?.id) {
        await storage.createAuditLog({
          userId: req.user.id,
          action: 'assign_tools_to_agent',
          resourceType: 'agent',
          resourceId: agentId.toString(),
          details: {
            toolIds: validatedData.toolIds,
            count
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });
      }

      res.json({ success: true, count });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error(`Error assigning tools to agent ${req.params.id}:`, error);
      res.status(500).json({ error: 'Failed to assign tools to agent' });
    }
  });

  // Remove tools from an agent
  router.delete('/agents/:id/tools', async (req: Request, res: Response) => {
    try {
      const agentId = parseInt(req.params.id);
      if (isNaN(agentId)) {
        return res.status(400).json({ error: 'Invalid agent ID' });
      }

      // Validate request body
      const validatedData = removeToolsSchema.parse(req.body);

      // Remove tools
      const count = await agentManagementService.removeToolsFromAgent(agentId, validatedData.toolIds);

      // Create audit log
      if (req.user?.id) {
        await storage.createAuditLog({
          userId: req.user.id,
          action: 'remove_tools_from_agent',
          resourceType: 'agent',
          resourceId: agentId.toString(),
          details: {
            toolIds: validatedData.toolIds,
            count
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });
      }

      res.json({ success: true, count });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error(`Error removing tools from agent ${req.params.id}:`, error);
      res.status(500).json({ error: 'Failed to remove tools from agent' });
    }
  });

  // Workflow management endpoints

  // Get all workflows
  router.get('/workflows', async (req: Request, res: Response) => {
    try {
      // Parse query parameters
      const workspaceId = req.query.workspaceId ? parseInt(req.query.workspaceId as string) : undefined;
      const status = req.query.status as string | undefined;
      const isTemplate = req.query.isTemplate !== undefined ? 
        req.query.isTemplate === 'true' : undefined;
      const search = req.query.search as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;

      // Get workflows with pagination and filtering
      const result = await agentManagementService.getWorkflows({
        workspaceId,
        status,
        isTemplate,
        search,
        limit,
        offset
      });

      // Create response with pagination metadata
      const response = {
        workflows: result.workflows,
        pagination: {
          total: result.total,
          limit,
          offset,
          hasMore: offset + result.workflows.length < result.total
        }
      };

      res.json(response);
    } catch (error) {
      console.error('Error getting workflows:', error);
      res.status(500).json({ error: 'Failed to get workflows' });
    }
  });

  // Get a single workflow
  router.get('/workflows/:id', async (req: Request, res: Response) => {
    try {
      const workflowId = parseInt(req.params.id);
      if (isNaN(workflowId)) {
        return res.status(400).json({ error: 'Invalid workflow ID' });
      }

      const workflow = await agentManagementService.getWorkflow(workflowId);
      if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found' });
      }

      res.json(workflow);
    } catch (error) {
      console.error(`Error getting workflow ${req.params.id}:`, error);
      res.status(500).json({ error: 'Failed to get workflow' });
    }
  });

  // Create a new workflow
  router.post('/workflows', async (req: Request, res: Response) => {
    try {
      // Validate request body
      const validatedData = createWorkflowSchema.parse(req.body);

      // Add user ID if authenticated
      const createdById = req.user?.id;

      // Create the workflow
      const workflow = await agentManagementService.createWorkflow({
        ...validatedData,
        createdById
      });

      // Create audit log
      if (createdById) {
        await storage.createAuditLog({
          userId: createdById,
          action: 'create_workflow',
          resourceType: 'workflow',
          resourceId: workflow.id.toString(),
          details: {
            name: workflow.name,
            status: workflow.status,
            isTemplate: workflow.isTemplate
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });
      }

      res.status(201).json(workflow);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error('Error creating workflow:', error);
      res.status(500).json({ error: 'Failed to create workflow' });
    }
  });

  // Update a workflow
  router.patch('/workflows/:id', async (req: Request, res: Response) => {
    try {
      const workflowId = parseInt(req.params.id);
      if (isNaN(workflowId)) {
        return res.status(400).json({ error: 'Invalid workflow ID' });
      }

      // Validate request body
      const validatedData = updateWorkflowSchema.parse(req.body);

      // Update the workflow
      const workflow = await agentManagementService.updateWorkflow(workflowId, validatedData);

      if (!workflow) {
        return res.status(404).json({ error: 'Workflow not found' });
      }

      // Create audit log
      if (req.user?.id) {
        await storage.createAuditLog({
          userId: req.user.id,
          action: 'update_workflow',
          resourceType: 'workflow',
          resourceId: workflow.id.toString(),
          details: {
            fields: Object.keys(validatedData)
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });
      }

      res.json(workflow);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ errors: error.errors });
      }
      console.error(`Error updating workflow ${req.params.id}:`, error);
      res.status(500).json({ error: 'Failed to update workflow' });
    }
  });

  // Delete a workflow
  router.delete('/workflows/:id', async (req: Request, res: Response) => {
    try {
      const workflowId = parseInt(req.params.id);
      if (isNaN(workflowId)) {
        return res.status(400).json({ error: 'Invalid workflow ID' });
      }

      // Delete the workflow
      const success = await agentManagementService.deleteWorkflow(workflowId);

      if (!success) {
        return res.status(404).json({ error: 'Workflow not found or already deleted' });
      }

      // Create audit log
      if (req.user?.id) {
        await storage.createAuditLog({
          userId: req.user.id,
          action: 'delete_workflow',
          resourceType: 'workflow',
          resourceId: workflowId.toString(),
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error(`Error deleting workflow ${req.params.id}:`, error);
      res.status(500).json({ error: 'Failed to delete workflow' });
    }
  });

  console.log('Agent management routes registered');
}