import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../../db';
import { policyManagementService } from '../services/policyManagementService';
import { storage } from '../storage';
import { insertPolicySchema, insertPolicyVersionSchema } from '@shared/schema_policies';
import * as z from 'zod';
import { rateLimitService } from '../services/rateLimitService';

/**
 * Workspace Policies API Router
 * 
 * Handles all workspace-specific policy management operations:
 * - CRUD operations for policies
 * - Policy versioning
 * - Policy evaluation logs
 * - Policy templates
 */
export const workspacePoliciesRouter = Router();

// Apply rate limiting to API endpoints
const apiLimiter = rateLimitService.create('workspace-policies-api', {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  message: { error: 'Too many requests from this IP, please try again later' }
});

// More aggressive rate limiting for create/update operations
const writeLimiter = rateLimitService.create('workspace-policies-write', {
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 60, // Limit each IP to 60 write operations per hour
  standardHeaders: true,
  message: { error: 'Too many write operations from this IP, please try again later' }
});

// Apply middleware to all routes
workspacePoliciesRouter.use(apiLimiter);

// Verify workspace access middleware
const verifyWorkspaceAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const workspaceId = parseInt(req.params.workspaceId);
    if (isNaN(workspaceId)) {
      return res.status(400).json({ error: 'Invalid workspace ID' });
    }
    
    // Check if workspace exists and user has access
    const workspace = await storage.getWorkspace(workspaceId);
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    
    // Check if user is a member of the workspace
    // This is where you'd implement your workspace access control logic
    // For now, we'll just check if the workspace exists
    
    next();
  } catch (error) {
    console.error('Error verifying workspace access:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get policies for a workspace
 * 
 * GET /api/workspaces/:workspaceId/policies
 * 
 * Query parameters:
 * - policyType: Filter by policy type (rego, json, yaml)
 * - status: Filter by status (draft, published, archived, deprecated)
 * - appliesTo: Filter by resource type
 * - tags: Comma-separated list of tags
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 * - isSystem: Filter system policies (true/false)
 */
workspacePoliciesRouter.get('/:workspaceId/policies', verifyWorkspaceAccess, async (req: Request, res: Response) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    
    // Parse query parameters
    const policyType = req.query.policyType as string | undefined;
    const status = req.query.status as string | undefined;
    const appliesTo = req.query.appliesTo as string | undefined;
    const tags = req.query.tags ? (req.query.tags as string).split(',') : undefined;
    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const isSystem = req.query.isSystem !== undefined ? 
      (req.query.isSystem === 'true') : undefined;
    
    // Get policies
    const result = await policyManagementService.getPolicies({
      workspaceId,
      policyType,
      status,
      appliesTo,
      tags,
      isSystem,
      page,
      limit
    });
    
    // Return policies with pagination metadata
    res.json({
      policies: result.policies,
      pagination: {
        total: result.total,
        page,
        limit,
        pages: Math.ceil(result.total / limit)
      }
    });
  } catch (error) {
    console.error('Error getting workspace policies:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get a policy by ID
 * 
 * GET /api/workspaces/:workspaceId/policies/:policyId
 */
workspacePoliciesRouter.get('/:workspaceId/policies/:policyId', verifyWorkspaceAccess, async (req: Request, res: Response) => {
  try {
    const policyId = parseInt(req.params.policyId);
    
    if (isNaN(policyId)) {
      return res.status(400).json({ error: 'Invalid policy ID' });
    }
    
    const policy = await policyManagementService.getPolicy(policyId);
    
    if (!policy) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    
    const workspaceId = parseInt(req.params.workspaceId);
    
    // Verify policy belongs to the workspace
    if (policy.workspaceId !== workspaceId) {
      return res.status(403).json({ error: 'Policy does not belong to this workspace' });
    }
    
    res.json(policy);
  } catch (error) {
    console.error('Error getting policy:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Create a new policy
 * 
 * POST /api/workspaces/:workspaceId/policies
 */
workspacePoliciesRouter.post('/:workspaceId/policies', [verifyWorkspaceAccess, writeLimiter], async (req: Request, res: Response) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    
    // Validate request body
    let policyData;
    try {
      policyData = insertPolicySchema.parse({
        ...req.body,
        workspaceId,
        createdBy: req.user!.id
      });
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation error', details: validationError.errors });
      }
      throw validationError;
    }
    
    // Create policy
    const policy = await policyManagementService.createPolicy(policyData);
    
    // Log audit event
    await storage.createAuditLog({
      userId: req.user!.id,
      action: 'policy.create',
      resourceType: 'policy',
      resourceId: policy.id.toString(),
      details: { policyName: policy.name }
    });
    
    res.status(201).json(policy);
  } catch (error) {
    console.error('Error creating policy:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Update a policy
 * 
 * PUT /api/workspaces/:workspaceId/policies/:policyId
 */
workspacePoliciesRouter.put('/:workspaceId/policies/:policyId', [verifyWorkspaceAccess, writeLimiter], async (req: Request, res: Response) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    const policyId = parseInt(req.params.policyId);
    
    if (isNaN(policyId)) {
      return res.status(400).json({ error: 'Invalid policy ID' });
    }
    
    // Get existing policy
    const existingPolicy = await policyManagementService.getPolicy(policyId);
    
    if (!existingPolicy) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    
    // Verify policy belongs to the workspace
    if (existingPolicy.workspaceId !== workspaceId) {
      return res.status(403).json({ error: 'Policy does not belong to this workspace' });
    }
    
    // Prevent updates to system policies
    if (existingPolicy.isSystem) {
      return res.status(403).json({ error: 'System policies cannot be modified' });
    }
    
    // Update policy
    const updatedPolicy = await policyManagementService.updatePolicy(policyId, {
      ...req.body,
      approvedBy: req.user!.id
    });
    
    // Log audit event
    await storage.createAuditLog({
      userId: req.user!.id,
      action: 'policy.update',
      resourceType: 'policy',
      resourceId: policyId.toString(),
      details: { policyName: existingPolicy.name }
    });
    
    res.json(updatedPolicy);
  } catch (error) {
    console.error('Error updating policy:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Delete a policy
 * 
 * DELETE /api/workspaces/:workspaceId/policies/:policyId
 */
workspacePoliciesRouter.delete('/:workspaceId/policies/:policyId', [verifyWorkspaceAccess, writeLimiter], async (req: Request, res: Response) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    const policyId = parseInt(req.params.policyId);
    
    if (isNaN(policyId)) {
      return res.status(400).json({ error: 'Invalid policy ID' });
    }
    
    // Get existing policy
    const existingPolicy = await policyManagementService.getPolicy(policyId);
    
    if (!existingPolicy) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    
    // Verify policy belongs to the workspace
    if (existingPolicy.workspaceId !== workspaceId) {
      return res.status(403).json({ error: 'Policy does not belong to this workspace' });
    }
    
    // Prevent deletion of system policies
    if (existingPolicy.isSystem) {
      return res.status(403).json({ error: 'System policies cannot be deleted' });
    }
    
    // Instead of deleting, we update the status to 'archived'
    const archivedPolicy = await policyManagementService.updatePolicy(policyId, {
      status: 'archived',
      approvedBy: req.user!.id
    });
    
    // Log audit event
    await storage.createAuditLog({
      userId: req.user!.id,
      action: 'policy.archive',
      resourceType: 'policy',
      resourceId: policyId.toString(),
      details: { policyName: existingPolicy.name }
    });
    
    res.json({ message: 'Policy archived successfully', policy: archivedPolicy });
  } catch (error) {
    console.error('Error archiving policy:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get policy versions
 * 
 * GET /api/workspaces/:workspaceId/policies/:policyId/versions
 */
workspacePoliciesRouter.get('/:workspaceId/policies/:policyId/versions', verifyWorkspaceAccess, async (req: Request, res: Response) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    const policyId = parseInt(req.params.policyId);
    
    if (isNaN(policyId)) {
      return res.status(400).json({ error: 'Invalid policy ID' });
    }
    
    // Get existing policy
    const existingPolicy = await policyManagementService.getPolicy(policyId);
    
    if (!existingPolicy) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    
    // Verify policy belongs to the workspace
    if (existingPolicy.workspaceId !== workspaceId) {
      return res.status(403).json({ error: 'Policy does not belong to this workspace' });
    }
    
    // Get policy versions
    const versions = await policyManagementService.getPolicyVersions(policyId);
    
    res.json(versions);
  } catch (error) {
    console.error('Error getting policy versions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get policy evaluation logs
 * 
 * GET /api/workspaces/:workspaceId/policies/:policyId/logs
 */
workspacePoliciesRouter.get('/:workspaceId/policies/:policyId/logs', verifyWorkspaceAccess, async (req: Request, res: Response) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    const policyId = parseInt(req.params.policyId);
    
    if (isNaN(policyId)) {
      return res.status(400).json({ error: 'Invalid policy ID' });
    }
    
    // Get existing policy
    const existingPolicy = await policyManagementService.getPolicy(policyId);
    
    if (!existingPolicy) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    
    // Verify policy belongs to the workspace
    if (existingPolicy.workspaceId !== workspaceId) {
      return res.status(403).json({ error: 'Policy does not belong to this workspace' });
    }
    
    // Parse query parameters for date filtering
    let startDate: Date | undefined;
    let endDate: Date | undefined;
    
    if (req.query.startDate) {
      startDate = new Date(req.query.startDate as string);
    }
    
    if (req.query.endDate) {
      endDate = new Date(req.query.endDate as string);
    }
    
    // Get logs
    const logs = await policyManagementService.getPolicyEvaluationLogs({
      policyId,
      startDate,
      endDate
    });
    
    res.json(logs);
  } catch (error) {
    console.error('Error getting policy logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Evaluate a policy (test mode)
 * 
 * POST /api/workspaces/:workspaceId/policies/:policyId/evaluate
 */
workspacePoliciesRouter.post('/:workspaceId/policies/:policyId/evaluate', verifyWorkspaceAccess, async (req: Request, res: Response) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    const policyId = parseInt(req.params.policyId);
    
    if (isNaN(policyId)) {
      return res.status(400).json({ error: 'Invalid policy ID' });
    }
    
    // Get existing policy
    const existingPolicy = await policyManagementService.getPolicy(policyId);
    
    if (!existingPolicy) {
      return res.status(404).json({ error: 'Policy not found' });
    }
    
    // Verify policy belongs to the workspace
    if (existingPolicy.workspaceId !== workspaceId) {
      return res.status(403).json({ error: 'Policy does not belong to this workspace' });
    }
    
    // Extract input from request body
    const input = req.body.input;
    
    if (!input) {
      return res.status(400).json({ error: 'Input data is required for policy evaluation' });
    }
    
    // Evaluate policy
    const result = await policyManagementService.evaluatePolicy({
      policyId,
      input,
      userId: req.user?.id,
      testMode: true
    });
    
    res.json(result);
  } catch (error) {
    console.error('Error evaluating policy:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});