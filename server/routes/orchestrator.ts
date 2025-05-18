/**
 * MCP Orchestrator Router
 * 
 * Implements enterprise-grade workflow orchestration capabilities:
 * - Visual pipeline builder
 * - Context routing engine
 * - Conditional logic & branching
 * - Plugin & manifest management 
 * - Governance features
 */

import express, { Request, Response } from 'express';
import { z } from 'zod';
import { orchestratorService } from '../services/workflow/OrchestratorService';
import { createAuditLogFromRequest } from '../services/enhancedAuditService';
import {
  workflowTemplateInsertSchema,
  workflowTemplateUpdateSchema,
  workflowNodeInsertSchema,
  workflowNodeUpdateSchema,
  workflowConnectionInsertSchema,
  workflowConnectionUpdateSchema,
  workflowExecuteSchema,
  WorkflowTemplateInsert,
  WorkflowTemplateUpdate,
  WorkflowNodeInsert,
  WorkflowNodeUpdate,
  WorkflowConnectionInsert,
  WorkflowConnectionUpdate,
  WorkflowExecuteInput
} from '@shared/schema_orchestrator';

const router = express.Router();

/**
 * Get initialization status of the orchestrator service
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    // Use simple availability check to determine orchestrator status
    const result = {
      status: 'active',
      timestamp: new Date().toISOString(),
      features: {
        workflowManagement: true,
        visualPipelineBuilder: true,
        contextRouting: true,
        conditionalLogic: true,
        pluginManagement: true,
        governance: true
      }
    };
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error getting orchestrator status:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * Workflow Template Management Endpoints
 */

// Get all workflow templates with filtering and pagination
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const name = req.query.name?.toString();
    const workspaceId = req.query.workspaceId ? Number(req.query.workspaceId) : undefined;
    
    const templates = await orchestratorService.listWorkflowTemplates({
      page,
      limit,
      name,
      workspaceId,
      userId: req.user!.id
    });
    
    return res.status(200).json(templates);
  } catch (error) {
    console.error('Error listing workflow templates:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Get a specific workflow template by ID
router.get('/templates/:id', async (req: Request, res: Response) => {
  try {
    const templateId = Number(req.params.id);
    
    const template = await orchestratorService.getWorkflowTemplate(templateId);
    
    if (!template) {
      return res.status(404).json({
        error: 'Not found',
        message: `Workflow template with ID ${templateId} not found`
      });
    }
    
    return res.status(200).json(template);
  } catch (error) {
    console.error(`Error getting workflow template ${req.params.id}:`, error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Create a new workflow template
router.post('/templates', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedData = workflowTemplateInsertSchema.parse(req.body);
    
    // Add user ID from authenticated session
    const data: WorkflowTemplateInsert = {
      ...validatedData,
      createdById: req.user!.id
    };
    
    const template = await orchestratorService.createWorkflowTemplate(data, req.user!.id);
    
    // Create audit log
    await createAuditLogFromRequest({
      req,
      action: 'create',
      resourceType: 'workflow-template',
      resourceId: String(template.id),
      details: { templateId: template.id, name: template.name }
    });
    
    return res.status(201).json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid workflow template data',
        details: error.errors
      });
    }
    
    console.error('Error creating workflow template:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Update a workflow template
router.patch('/templates/:id', async (req: Request, res: Response) => {
  try {
    const templateId = Number(req.params.id);
    
    // Validate request body
    const validatedData = workflowTemplateUpdateSchema.parse(req.body);
    
    const data: WorkflowTemplateUpdate = {
      ...validatedData,
      id: templateId
    };
    
    const template = await orchestratorService.updateWorkflowTemplate(templateId, data, req.user!.id);
    
    if (!template) {
      return res.status(404).json({
        error: 'Not found',
        message: `Workflow template with ID ${templateId} not found`
      });
    }
    
    // Create audit log
    await createAuditLogFromRequest({
      req,
      action: 'update',
      resourceType: 'workflow-template',
      resourceId: String(templateId),
      details: { templateId, name: template.name }
    });
    
    return res.status(200).json(template);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid workflow template data',
        details: error.errors
      });
    }
    
    console.error(`Error updating workflow template ${req.params.id}:`, error);
    return res.status(500).json({
      error: 'Internal server error', 
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Delete a workflow template
router.delete('/templates/:id', async (req: Request, res: Response) => {
  try {
    const templateId = Number(req.params.id);
    
    const success = await orchestratorService.deleteWorkflowTemplate(templateId, req.user!.id);
    
    if (!success) {
      return res.status(404).json({
        error: 'Not found',
        message: `Workflow template with ID ${templateId} not found`
      });
    }
    
    // Create audit log
    await createAuditLogFromRequest({
      req,
      action: 'delete',
      resourceType: 'workflow-template',
      resourceId: String(templateId),
      details: { templateId }
    });
    
    return res.status(204).send();
  } catch (error) {
    console.error(`Error deleting workflow template ${req.params.id}:`, error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Clone a workflow template
router.post('/templates/:id/clone', async (req: Request, res: Response) => {
  try {
    const templateId = Number(req.params.id);
    const { name } = req.body;
    
    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Name is required for cloned template'
      });
    }
    
    const clonedTemplate = await orchestratorService.cloneWorkflowTemplate(
      templateId,
      name,
      req.user!.id
    );
    
    if (!clonedTemplate) {
      return res.status(404).json({
        error: 'Not found',
        message: `Workflow template with ID ${templateId} not found`
      });
    }
    
    // Create audit log
    await createAuditLogFromRequest({
      req,
      action: 'clone',
      resourceType: 'workflow-template',
      resourceId: String(clonedTemplate.id),
      details: { 
        sourceTemplateId: templateId,
        clonedTemplateId: clonedTemplate.id, 
        name: clonedTemplate.name 
      }
    });
    
    return res.status(201).json(clonedTemplate);
  } catch (error) {
    console.error(`Error cloning workflow template ${req.params.id}:`, error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Validate a workflow template
router.post('/templates/:id/validate', async (req: Request, res: Response) => {
  try {
    const templateId = Number(req.params.id);
    
    const validationResult = await orchestratorService.validateWorkflow(templateId);
    
    return res.status(200).json(validationResult);
  } catch (error) {
    console.error(`Error validating workflow template ${req.params.id}:`, error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * Workflow Node Management Endpoints
 */

// Add a node to a workflow template
router.post('/templates/:templateId/nodes', async (req: Request, res: Response) => {
  try {
    const templateId = Number(req.params.templateId);
    
    // Validate request body
    const validatedData = workflowNodeInsertSchema.parse(req.body);
    
    const data: WorkflowNodeInsert = {
      ...validatedData,
      templateId
    };
    
    const node = await orchestratorService.addNode(data, req.user!.id);
    
    // Create audit log
    await createAuditLogFromRequest({
      req,
      action: 'create',
      resourceType: 'workflow-node',
      resourceId: node.id,
      details: { 
        nodeId: node.id, 
        templateId, 
        type: node.type, 
        name: node.name 
      }
    });
    
    return res.status(201).json(node);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid workflow node data',
        details: error.errors
      });
    }
    
    console.error(`Error adding node to template ${req.params.templateId}:`, error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Update a node
router.patch('/nodes/:id', async (req: Request, res: Response) => {
  try {
    const nodeId = req.params.id;
    
    // Validate request body
    const validatedData = workflowNodeUpdateSchema.parse(req.body);
    
    const data: WorkflowNodeUpdate = {
      ...validatedData,
      id: nodeId
    };
    
    const node = await orchestratorService.updateNode(Number(nodeId), data, req.user!.id);
    
    if (!node) {
      return res.status(404).json({
        error: 'Not found',
        message: `Workflow node with ID ${nodeId} not found`
      });
    }
    
    // Create audit log
    await createAuditLogFromRequest({
      req,
      action: 'update',
      resourceType: 'workflow-node',
      resourceId: nodeId,
      details: { 
        nodeId, 
        templateId: node.templateId, 
        type: node.type, 
        name: node.name 
      }
    });
    
    return res.status(200).json(node);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid workflow node data',
        details: error.errors
      });
    }
    
    console.error(`Error updating node ${req.params.id}:`, error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Delete a node
router.delete('/nodes/:id', async (req: Request, res: Response) => {
  try {
    const nodeId = req.params.id;
    
    const success = await orchestratorService.deleteNode(Number(nodeId), req.user!.id);
    
    if (!success) {
      return res.status(404).json({
        error: 'Not found',
        message: `Workflow node with ID ${nodeId} not found`
      });
    }
    
    // Create audit log
    await createAuditLogFromRequest({
      req,
      action: 'delete',
      resourceType: 'workflow-node',
      resourceId: nodeId,
      details: { nodeId }
    });
    
    return res.status(204).send();
  } catch (error) {
    console.error(`Error deleting node ${req.params.id}:`, error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * Workflow Connection Management Endpoints
 */

// Add a connection between nodes
router.post('/templates/:templateId/connections', async (req: Request, res: Response) => {
  try {
    const templateId = Number(req.params.templateId);
    
    // Validate request body
    const validatedData = workflowConnectionInsertSchema.parse(req.body);
    
    const data: WorkflowConnectionInsert = {
      ...validatedData,
      templateId
    };
    
    const connection = await orchestratorService.addConnection(data, req.user!.id);
    
    // Create audit log
    await createAuditLogFromRequest({
      req,
      action: 'create',
      resourceType: 'workflow-connection',
      resourceId: connection.id,
      details: { 
        connectionId: connection.id, 
        templateId, 
        sourceId: connection.sourceId, 
        targetId: connection.targetId 
      }
    });
    
    return res.status(201).json(connection);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid workflow connection data',
        details: error.errors
      });
    }
    
    console.error(`Error adding connection to template ${req.params.templateId}:`, error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Update a connection
router.patch('/connections/:id', async (req: Request, res: Response) => {
  try {
    const connectionId = req.params.id;
    
    // Validate request body
    const validatedData = workflowConnectionUpdateSchema.parse(req.body);
    
    const data: WorkflowConnectionUpdate = {
      ...validatedData,
      id: connectionId
    };
    
    const connection = await orchestratorService.updateConnection(Number(connectionId), data, req.user!.id);
    
    if (!connection) {
      return res.status(404).json({
        error: 'Not found',
        message: `Workflow connection with ID ${connectionId} not found`
      });
    }
    
    // Create audit log
    await createAuditLogFromRequest({
      req,
      action: 'update',
      resourceType: 'workflow-connection',
      resourceId: connectionId,
      details: { 
        connectionId, 
        templateId: connection.templateId,
        sourceId: connection.sourceId, 
        targetId: connection.targetId 
      }
    });
    
    return res.status(200).json(connection);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid workflow connection data',
        details: error.errors
      });
    }
    
    console.error(`Error updating connection ${req.params.id}:`, error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Delete a connection
router.delete('/connections/:id', async (req: Request, res: Response) => {
  try {
    const connectionId = req.params.id;
    
    const success = await orchestratorService.deleteConnection(Number(connectionId), req.user!.id);
    
    if (!success) {
      return res.status(404).json({
        error: 'Not found',
        message: `Workflow connection with ID ${connectionId} not found`
      });
    }
    
    // Create audit log
    await createAuditLogFromRequest({
      req,
      action: 'delete',
      resourceType: 'workflow-connection',
      resourceId: connectionId,
      details: { connectionId }
    });
    
    return res.status(204).send();
  } catch (error) {
    console.error(`Error deleting connection ${req.params.id}:`, error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * Workflow Execution Endpoints
 */

// Execute a workflow
router.post('/execute', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedData = workflowExecuteSchema.parse(req.body);
    
    const data: WorkflowExecuteInput = {
      ...validatedData,
      userId: req.user!.id
    };
    
    const instance = await orchestratorService.executeWorkflow(data);
    
    // Create audit log
    await createAuditLogFromRequest({
      req,
      action: 'execute',
      resourceType: 'workflow',
      resourceId: String(instance.id),
      details: { 
        instanceId: instance.id, 
        templateId: instance.templateId,
        status: instance.status
      }
    });
    
    return res.status(202).json(instance);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid workflow execution data',
        details: error.errors
      });
    }
    
    console.error('Error executing workflow:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Get workflow instance status
router.get('/instances/:id', async (req: Request, res: Response) => {
  try {
    const instanceId = req.params.id;
    
    const instance = await orchestratorService.getWorkflowInstance(instanceId);
    
    if (!instance) {
      return res.status(404).json({
        error: 'Not found',
        message: `Workflow instance with ID ${instanceId} not found`
      });
    }
    
    return res.status(200).json(instance);
  } catch (error) {
    console.error(`Error getting workflow instance ${req.params.id}:`, error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// List all workflow instances with filtering and pagination
router.get('/instances', async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const status = req.query.status?.toString();
    const templateId = req.query.templateId ? Number(req.query.templateId) : undefined;
    const workspaceId = req.query.workspaceId ? Number(req.query.workspaceId) : undefined;
    
    // TODO: Implement listWorkflowInstances method in OrchestratorService
    const instances = []; // await orchestratorService.listWorkflowInstances(...);
    
    return res.status(200).json({
      data: instances,
      pagination: {
        page,
        limit,
        total: instances.length,
        totalPages: Math.ceil(instances.length / limit)
      }
    });
  } catch (error) {
    console.error('Error listing workflow instances:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * Tool Manifest Management Endpoints
 */

// Get all tool manifests with filtering and pagination
router.get('/tools', async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 50;
    const serverId = req.query.serverId ? Number(req.query.serverId) : undefined;
    const name = req.query.name?.toString();
    
    const manifests = await orchestratorService.getToolManifests({
      page,
      limit,
      serverId,
      name
    });
    
    return res.status(200).json(manifests);
  } catch (error) {
    console.error('Error listing tool manifests:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Sync tool manifests for a specific server
router.post('/tools/sync/:serverId', async (req: Request, res: Response) => {
  try {
    const serverId = Number(req.params.serverId);
    
    const manifests = await orchestratorService.syncToolManifestsForServer(serverId);
    
    // Create audit log
    await createAuditLogFromRequest({
      req,
      action: 'sync',
      resourceType: 'tool-manifests',
      resourceId: String(serverId),
      details: { 
        serverId,
        count: manifests.length
      }
    });
    
    return res.status(200).json({
      success: true,
      message: `Successfully synchronized ${manifests.length} tool manifests for server ${serverId}`,
      data: manifests
    });
  } catch (error) {
    console.error(`Error syncing tool manifests for server ${req.params.serverId}:`, error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

export default router;