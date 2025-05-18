import express, { Router } from "express";
import { a2aService } from "../services/a2a-service";
import { storage } from "../storage";
import { createAuditLogFromRequest } from "../services/enhancedAuditService";

/**
 * Register routes for the Agent-to-Agent (A2A) orchestration system
 *
 * @param app Express application instance
 * @param httpServer HTTP server instance for WebSocket support
 */
export function registerA2ARoutes(app: express.Express, httpServer: any) {
  const router = Router();

  // Middleware to check user permissions
  const checkPermission = (requiredPermission: string) => {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
      // Skip permission check if user is not authenticated (will be caught by auth middleware)
      if (!req.isAuthenticated()) {
        return next();
      }
      
      // Get user permissions from the session
      const userPermissions = (req.user as any)?.permissions || [];
      
      // Check if user has required permission
      const hasPermission = Array.isArray(userPermissions) && 
        (userPermissions.includes(requiredPermission) || userPermissions.includes('*:*'));
      
      if (!hasPermission) {
        return res.status(403).json({
          error: 'Forbidden',
          message: `You don't have the required permission: ${requiredPermission}`
        });
      }
      
      next();
    };
  };

  // Apply authentication middleware for all routes
  router.use((req, res, next) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }
    next();
  });

  // Get all agents
  router.get('/a2a/agents', checkPermission('agents:view'), async (req, res) => {
    try {
      const agents = await a2aService.getAgents();
      
      // Create audit log
      createAuditLogFromRequest(req, {
        action: 'view',
        resourceType: 'a2a-agents',
        detail: 'Retrieved all A2A agents'
      }).catch(err => console.error('Failed to create audit log:', err));
      
      res.json(agents);
    } catch (error) {
      console.error('Error fetching agents:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });

  // Get agent by ID
  router.get('/a2a/agents/:id', checkPermission('agents:view'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid agent ID'
        });
      }
      
      const agent = await a2aService.getAgentById(id);
      if (!agent) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Agent with ID ${id} not found`
        });
      }
      
      // Create audit log
      createAuditLogFromRequest(req, {
        action: 'view',
        resourceType: 'a2a-agent',
        resourceId: id.toString(),
        detail: `Retrieved A2A agent ${id}`
      }).catch(err => console.error('Failed to create audit log:', err));
      
      res.json(agent);
    } catch (error) {
      console.error(`Error fetching agent ${req.params.id}:`, error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });

  // Create a new agent
  router.post('/a2a/agents', checkPermission('agents:create'), async (req, res) => {
    try {
      const agent = await a2aService.createAgent(req.body);
      
      // Create audit log
      createAuditLogFromRequest(req, {
        action: 'create',
        resourceType: 'a2a-agent',
        resourceId: agent.id.toString(),
        detail: `Created A2A agent ${agent.name}`,
        details: { agentName: agent.name, agentType: agent.type }
      }).catch(err => console.error('Failed to create audit log:', err));
      
      res.status(201).json(agent);
    } catch (error) {
      console.error('Error creating agent:', error);
      
      if (error instanceof Error && error.message.includes('validation')) {
        return res.status(400).json({
          error: 'Bad Request',
          message: error.message
        });
      }
      
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });

  // Update an existing agent
  router.put('/a2a/agents/:id', checkPermission('agents:update'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid agent ID'
        });
      }
      
      const existingAgent = await a2aService.getAgentById(id);
      if (!existingAgent) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Agent with ID ${id} not found`
        });
      }
      
      const updatedAgent = await a2aService.updateAgent(id, req.body);
      
      // Create audit log
      createAuditLogFromRequest(req, {
        action: 'update',
        resourceType: 'a2a-agent',
        resourceId: id.toString(),
        detail: `Updated A2A agent ${updatedAgent.name}`,
        details: {
          before: existingAgent,
          after: updatedAgent
        }
      }).catch(err => console.error('Failed to create audit log:', err));
      
      res.json(updatedAgent);
    } catch (error) {
      console.error(`Error updating agent ${req.params.id}:`, error);
      
      if (error instanceof Error && error.message.includes('validation')) {
        return res.status(400).json({
          error: 'Bad Request',
          message: error.message
        });
      }
      
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });

  // Delete an agent
  router.delete('/a2a/agents/:id', checkPermission('agents:delete'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid agent ID'
        });
      }
      
      const agent = await a2aService.getAgentById(id);
      if (!agent) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Agent with ID ${id} not found`
        });
      }
      
      await a2aService.deleteAgent(id);
      
      // Create audit log
      createAuditLogFromRequest(req, {
        action: 'delete',
        resourceType: 'a2a-agent',
        resourceId: id.toString(),
        detail: `Deleted A2A agent ${agent.name}`,
        details: { deletedAgent: agent }
      }).catch(err => console.error('Failed to create audit log:', err));
      
      res.status(204).send();
    } catch (error) {
      console.error(`Error deleting agent ${req.params.id}:`, error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });

  // Get all flows
  router.get('/a2a/flows', checkPermission('agents:view'), async (req, res) => {
    try {
      const flows = await a2aService.getFlows();
      
      // Create audit log
      createAuditLogFromRequest(req, {
        action: 'view',
        resourceType: 'a2a-flows',
        detail: 'Retrieved all A2A flows'
      }).catch(err => console.error('Failed to create audit log:', err));
      
      res.json(flows);
    } catch (error) {
      console.error('Error fetching flows:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });

  // Get flow by ID
  router.get('/a2a/flows/:id', checkPermission('agents:view'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid flow ID'
        });
      }
      
      const flow = await a2aService.getFlowById(id);
      if (!flow) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Flow with ID ${id} not found`
        });
      }
      
      // Create audit log
      createAuditLogFromRequest(req, {
        action: 'view',
        resourceType: 'a2a-flow',
        resourceId: id.toString(),
        detail: `Retrieved A2A flow ${id}`
      }).catch(err => console.error('Failed to create audit log:', err));
      
      res.json(flow);
    } catch (error) {
      console.error(`Error fetching flow ${req.params.id}:`, error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });

  // Create a new flow
  router.post('/a2a/flows', checkPermission('agents:create'), async (req, res) => {
    try {
      const flow = await a2aService.createFlow(req.body);
      
      // Create audit log
      createAuditLogFromRequest(req, {
        action: 'create',
        resourceType: 'a2a-flow',
        resourceId: flow.id.toString(),
        detail: `Created A2A flow ${flow.name}`,
        details: { flowName: flow.name, status: flow.status }
      }).catch(err => console.error('Failed to create audit log:', err));
      
      res.status(201).json(flow);
    } catch (error) {
      console.error('Error creating flow:', error);
      
      if (error instanceof Error && error.message.includes('validation')) {
        return res.status(400).json({
          error: 'Bad Request',
          message: error.message
        });
      }
      
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });

  // Update an existing flow
  router.put('/a2a/flows/:id', checkPermission('agents:update'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid flow ID'
        });
      }
      
      const existingFlow = await a2aService.getFlowById(id);
      if (!existingFlow) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Flow with ID ${id} not found`
        });
      }
      
      const updatedFlow = await a2aService.updateFlow(id, req.body);
      
      // Create audit log
      createAuditLogFromRequest(req, {
        action: 'update',
        resourceType: 'a2a-flow',
        resourceId: id.toString(),
        detail: `Updated A2A flow ${updatedFlow.name}`,
        details: {
          before: existingFlow,
          after: updatedFlow
        }
      }).catch(err => console.error('Failed to create audit log:', err));
      
      res.json(updatedFlow);
    } catch (error) {
      console.error(`Error updating flow ${req.params.id}:`, error);
      
      if (error instanceof Error && error.message.includes('validation')) {
        return res.status(400).json({
          error: 'Bad Request',
          message: error.message
        });
      }
      
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });

  // Delete a flow
  router.delete('/a2a/flows/:id', checkPermission('agents:delete'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid flow ID'
        });
      }
      
      const flow = await a2aService.getFlowById(id);
      if (!flow) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Flow with ID ${id} not found`
        });
      }
      
      await a2aService.deleteFlow(id);
      
      // Create audit log
      createAuditLogFromRequest(req, {
        action: 'delete',
        resourceType: 'a2a-flow',
        resourceId: id.toString(),
        detail: `Deleted A2A flow ${flow.name}`,
        details: { deletedFlow: flow }
      }).catch(err => console.error('Failed to create audit log:', err));
      
      res.status(204).send();
    } catch (error) {
      console.error(`Error deleting flow ${req.params.id}:`, error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });

  // Execute a flow
  router.post('/a2a/flows/:id/execute', checkPermission('agents:execute'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid flow ID'
        });
      }
      
      const flow = await a2aService.getFlowById(id);
      if (!flow) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Flow with ID ${id} not found`
        });
      }
      
      if (flow.status !== 'active') {
        return res.status(400).json({
          error: 'Bad Request',
          message: `Flow ${id} is not active and cannot be executed`
        });
      }
      
      const execution = await a2aService.executeFlow(id, req.user?.id);
      
      // Create audit log
      createAuditLogFromRequest(req, {
        action: 'execute',
        resourceType: 'a2a-flow',
        resourceId: id.toString(),
        detail: `Executed A2A flow ${flow.name}`,
        details: { 
          flowId: flow.id,
          flowName: flow.name,
          executionId: execution.id 
        }
      }).catch(err => console.error('Failed to create audit log:', err));
      
      res.status(202).json(execution);
    } catch (error) {
      console.error(`Error executing flow ${req.params.id}:`, error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });

  // Get flow execution history
  router.get('/a2a/flows/:id/executions', checkPermission('agents:view'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid flow ID'
        });
      }
      
      const flow = await a2aService.getFlowById(id);
      if (!flow) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Flow with ID ${id} not found`
        });
      }
      
      const executions = await a2aService.getFlowExecutions(id);
      
      // Create audit log
      createAuditLogFromRequest(req, {
        action: 'view',
        resourceType: 'a2a-flow-executions',
        resourceId: id.toString(),
        detail: `Retrieved execution history for A2A flow ${flow.name}`
      }).catch(err => console.error('Failed to create audit log:', err));
      
      res.json(executions);
    } catch (error) {
      console.error(`Error fetching executions for flow ${req.params.id}:`, error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });

  // Get execution details
  router.get('/a2a/executions/:id', checkPermission('agents:view'), async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Invalid execution ID'
        });
      }
      
      const execution = await a2aService.getExecutionById(id);
      if (!execution) {
        return res.status(404).json({
          error: 'Not Found',
          message: `Execution with ID ${id} not found`
        });
      }
      
      // Create audit log
      createAuditLogFromRequest(req, {
        action: 'view',
        resourceType: 'a2a-execution',
        resourceId: id.toString(),
        detail: `Retrieved A2A execution details for ID ${id}`
      }).catch(err => console.error('Failed to create audit log:', err));
      
      res.json(execution);
    } catch (error) {
      console.error(`Error fetching execution ${req.params.id}:`, error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  });

  app.use('/api', router);
}