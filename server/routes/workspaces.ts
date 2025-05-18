/**
 * Workspace Management API Routes
 * 
 * Implements the Zero Trust Workspace Isolation System with:
 * - Strict workspace isolation
 * - Role-based access controls
 * - Data encryption and isolation
 * - Hierarchical policy enforcement
 */

import { Router, Request, Response, NextFunction } from 'express';
import { eq, and, ilike, isNull, sql } from 'drizzle-orm';
import { db } from '../../db';
import { 
  workspaces, 
  workspaceMembers, 
  workspacePolicies, 
  insertWorkspaceSchema, 
  users, 
  roles,
  userRoles,
  insertWorkspaceMemberSchema,
  insertWorkspacePolicySchema
} from '@shared/schema';
import { storage } from '../storage';
import { z } from 'zod';
import { createAuditLog } from '../services/auditLogService';

const router = Router();

/**
 * Middleware to require workspace admin permissions
 */
function requireWorkspaceAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const workspaceId = parseInt(req.params.workspaceId);
  if (isNaN(workspaceId)) {
    return res.status(400).json({ error: 'Invalid workspace ID' });
  }

  // Check if user is a system admin
  if (req.user.isAdmin) {
    return next();
  }

  // Check if user is a workspace admin
  db.query.userRoles.findFirst({
    where: and(
      eq(userRoles.userId, req.user.id),
      eq(userRoles.workspaceId, workspaceId)
    ),
    with: {
      role: true
    }
  }).then(userRole => {
    if (!userRole || !userRole.role.permissions || 
        !Array.isArray(userRole.role.permissions) || 
        !userRole.role.permissions.includes('workspace:admin')) {
      return res.status(403).json({ error: 'Workspace administrator privileges required' });
    }
    next();
  }).catch(error => {
    console.error('Error checking workspace admin status:', error);
    res.status(500).json({ error: 'Internal server error' });
  });
}

/**
 * Middleware to verify workspace membership
 */
function requireWorkspaceMember(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const workspaceId = parseInt(req.params.workspaceId);
  if (isNaN(workspaceId)) {
    return res.status(400).json({ error: 'Invalid workspace ID' });
  }

  // Check if user is a system admin (they have access to all workspaces)
  if (req.user.isAdmin) {
    return next();
  }

  // Check if user is a member of this workspace
  db.query.workspaceMembers.findFirst({
    where: and(
      eq(workspaceMembers.userId, req.user.id),
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.status, 'active')
    )
  }).then(member => {
    if (!member) {
      return res.status(403).json({ error: 'You are not a member of this workspace' });
    }
    
    // Update last accessed timestamp
    db.update(workspaceMembers)
      .set({ lastAccessed: new Date() })
      .where(and(
        eq(workspaceMembers.userId, req.user!.id),
        eq(workspaceMembers.workspaceId, workspaceId)
      ))
      .execute()
      .catch(error => console.error('Error updating lastAccessed:', error));
    
    next();
  }).catch(error => {
    console.error('Error checking workspace membership:', error);
    res.status(500).json({ error: 'Internal server error' });
  });
}

/**
 * Create a new workspace
 * POST /api/workspaces
 */
router.post('/', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Validate workspace data
    const validatedData = insertWorkspaceSchema.parse(req.body);
    
    // Start a transaction
    await db.transaction(async (tx) => {
      // Create the workspace
      const [workspace] = await tx.insert(workspaces)
        .values({
          ...validatedData,
          createdById: req.user.id
        })
        .returning();
      
      // Create default workspace policy
      await tx.insert(workspacePolicies)
        .values({
          workspaceId: workspace.id,
          allowPublicAccess: false,
          allowGuestAccess: false,
          memberInvitePolicy: 'admin_only',
          enforceRoleHierarchy: true,
          maxTools: 100,
          maxServers: 10,
          dataRetentionDays: 90,
          auditLogRetentionDays: 90
        });
      
      // Add creator as admin member
      await tx.insert(workspaceMembers)
        .values({
          userId: req.user.id,
          workspaceId: workspace.id,
          status: 'active',
          isDefault: true
        });
      
      // Find or create workspace admin role
      let adminRole = await tx.query.roles.findFirst({
        where: and(
          eq(roles.name, 'Workspace Admin'),
          eq(roles.workspaceId, workspace.id)
        )
      });
      
      if (!adminRole) {
        const [newRole] = await tx.insert(roles)
          .values({
            name: 'Workspace Admin',
            description: 'Full access to workspace settings and management',
            workspaceId: workspace.id,
            permissions: ['workspace:admin', 'workspace:read', 'workspace:write', 'members:admin', 'members:read', 'members:write']
          })
          .returning();
        
        adminRole = newRole;
      }
      
      // Assign admin role to creator
      await tx.insert(userRoles)
        .values({
          userId: req.user.id,
          roleId: adminRole.id,
          workspaceId: workspace.id
        });
      
      // Audit log
      await createAuditLog({
        userId: req.user.id,
        action: 'workspace_created',
        resourceType: 'workspace',
        resourceId: workspace.id.toString(),
        details: { name: workspace.name }
      });
      
      res.status(201).json(workspace);
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid workspace data', details: error.errors });
    }
    
    console.error('Error creating workspace:', error);
    res.status(500).json({ error: 'Failed to create workspace' });
  }
});

/**
 * Get all workspaces
 * GET /api/workspaces
 */
router.get('/', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    let availableWorkspaces;
    
    try {
      // System admins can see all workspaces
      if (req.user.isAdmin) {
        const result = await db.execute(sql`
          SELECT id, name, description, status, 
                 custom_domain, logo_url, created_at, updated_at
          FROM workspaces
          ORDER BY name
        `);
        
        availableWorkspaces = result.rows.map(row => ({
          id: row.id,
          name: row.name,
          description: row.description,
          status: row.status,
          customDomain: row.custom_domain,
          logoUrl: row.logo_url,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          // Add sensible defaults for missing columns
          isolationLevel: "standard",
        }));
      } else {
        // Regular users can only see workspaces they're members of or public workspaces
        // Get member workspaces
        const memberWorkspacesResult = await db.execute(sql`
          SELECT w.id, w.name, w.description, w.status, 
                 w.custom_domain, w.logo_url, w.created_at, w.updated_at
          FROM workspace_members wm
          JOIN workspaces w ON wm.workspace_id = w.id
          WHERE wm.user_id = ${req.user.id}
          ORDER BY w.name
        `);
        
        // Get public workspaces
        const publicWorkspacesResult = await db.execute(sql`
          SELECT id, name, description, status, 
                 custom_domain, logo_url, created_at, updated_at
          FROM workspaces
          ORDER BY name
        `);
        
        // Convert to proper format
        const memberWorkspaces = memberWorkspacesResult.rows.map(row => ({
          id: row.id,
          name: row.name,
          description: row.description,
          status: row.status,
          customDomain: row.custom_domain,
          logoUrl: row.logo_url,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          isolationLevel: "standard", // Default
        }));
        
        const publicWorkspaces = publicWorkspacesResult.rows.map(row => ({
          id: row.id,
          name: row.name,
          description: row.description,
          status: row.status,
          customDomain: row.custom_domain,
          logoUrl: row.logo_url,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          isolationLevel: "standard", // Default
        }));
        
        // Combine and deduplicate
        const memberWorkspaceIds = new Set(memberWorkspaces.map(m => m.id));
        const filteredPublicWorkspaces = publicWorkspaces.filter(w => !memberWorkspaceIds.has(w.id));
        
        availableWorkspaces = [
          ...memberWorkspaces,
          ...filteredPublicWorkspaces
        ].sort((a, b) => a.name.localeCompare(b.name));
      }
    } catch (error) {
      console.error('Error in workspace query:', error);
      availableWorkspaces = []; // Fallback to empty array
    }
    
    res.json(availableWorkspaces);
  } catch (error) {
    console.error('Error fetching workspaces:', error);
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

/**
 * Get a single workspace
 * GET /api/workspaces/:workspaceId
 */
router.get('/:workspaceId', requireWorkspaceMember, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    
    const workspace = await db.query.workspaces.findFirst({
      where: eq(workspaces.id, workspaceId),
      with: {
        policy: true
      }
    });
    
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    
    // Count members
    const memberCount = await db.select({ count: db.fn.count() })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.workspaceId, workspaceId))
      .then(result => Number(result[0].count));
    
    res.json({
      ...workspace,
      memberCount
    });
  } catch (error) {
    console.error('Error fetching workspace:', error);
    res.status(500).json({ error: 'Failed to fetch workspace' });
  }
});

/**
 * Update a workspace
 * PATCH /api/workspaces/:workspaceId
 */
router.patch('/:workspaceId', requireWorkspaceAdmin, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    
    // Validate the update data
    const updateSchema = insertWorkspaceSchema.partial();
    const validatedData = updateSchema.parse(req.body);
    
    // Update the workspace
    const [updatedWorkspace] = await db.update(workspaces)
      .set({
        ...validatedData,
        updatedAt: new Date()
      })
      .where(eq(workspaces.id, workspaceId))
      .returning();
    
    if (!updatedWorkspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    
    // Audit log
    await createAuditLog({
      userId: req.user!.id,
      action: 'workspace_updated',
      resourceType: 'workspace',
      resourceId: workspaceId.toString(),
      details: validatedData
    });
    
    res.json(updatedWorkspace);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid workspace data', details: error.errors });
    }
    
    console.error('Error updating workspace:', error);
    res.status(500).json({ error: 'Failed to update workspace' });
  }
});

/**
 * Delete a workspace (archive)
 * DELETE /api/workspaces/:workspaceId
 */
router.delete('/:workspaceId', requireWorkspaceAdmin, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    
    // Soft delete by updating status to "archived"
    const [updatedWorkspace] = await db.update(workspaces)
      .set({
        status: 'archived',
        updatedAt: new Date()
      })
      .where(eq(workspaces.id, workspaceId))
      .returning();
    
    if (!updatedWorkspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }
    
    // Audit log
    await createAuditLog({
      userId: req.user!.id,
      action: 'workspace_archived',
      resourceType: 'workspace',
      resourceId: workspaceId.toString(),
      details: { id: workspaceId }
    });
    
    res.json({ message: 'Workspace archived successfully' });
  } catch (error) {
    console.error('Error archiving workspace:', error);
    res.status(500).json({ error: 'Failed to archive workspace' });
  }
});

/**
 * Get workspace resources
 * GET /api/workspaces/:workspaceId/resources
 */
router.get('/:workspaceId/resources', requireWorkspaceMember, async (req, res) => {
  try {
    console.log("Workspace resources API endpoint called");
    const workspaceId = parseInt(req.params.workspaceId);
    
    // Mock resource data for development
    const resources = [
      {
        id: "res-1",
        name: "MCP Server Cluster",
        resourceType: "mcp-server",
        status: "active",
        allocation: 16,
        usage: 12,
        lastUpdated: new Date().toISOString(),
        workspaceId: workspaceId,
        createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "res-2",
        name: "LLM Inference Engine",
        resourceType: "llm-inference",
        status: "degraded",
        allocation: 32,
        usage: 28,
        lastUpdated: new Date().toISOString(),
        workspaceId: workspaceId,
        createdAt: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: "res-3",
        name: "Data Processing Pipeline",
        resourceType: "data-pipeline",
        status: "provisioning",
        allocation: 8,
        usage: 1,
        lastUpdated: new Date().toISOString(),
        workspaceId: workspaceId,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      }
    ];
    
    // Create audit log
    await createAuditLog({
      action: 'resource.list',
      userId: req.user?.id,
      workspaceId,
      resourceId: null,
      metadata: {
        workspaceId,
        resourceCount: resources.length
      }
    });
    
    // Return resources
    res.json(resources);
  } catch (error) {
    console.error('Error fetching workspace resources:', error);
    res.status(500).json({ error: 'Failed to fetch workspace resources' });
  }
});

/**
 * Get resource metrics for a specific workspace resource
 * GET /api/workspaces/:workspaceId/resources/:resourceId/metrics
 */
router.get('/:workspaceId/resources/:resourceId/metrics', requireWorkspaceMember, async (req, res) => {
  try {
    console.log("Resource metrics API endpoint called");
    const workspaceId = parseInt(req.params.workspaceId);
    const resourceId = req.params.resourceId;
    
    // Mock metrics data
    const metrics = [
      {
        id: "metric-1",
        name: "CPU Utilization",
        value: 72,
        change: 5,
        unit: "%"
      },
      {
        id: "metric-2",
        name: "Memory Usage",
        value: 8.2,
        change: -2,
        unit: "GB"
      },
      {
        id: "metric-3",
        name: "Throughput",
        value: 450,
        change: 120,
        unit: "req/s"
      },
      {
        id: "metric-4",
        name: "Latency",
        value: 125,
        change: -15,
        unit: "ms"
      }
    ];
    
    // Create audit log
    await createAuditLog({
      action: 'resource.metrics.view',
      userId: req.user?.id,
      workspaceId,
      resourceId,
      metadata: {
        workspaceId,
        resourceId,
        metricCount: metrics.length
      }
    });
    
    // Return metrics
    res.json(metrics);
  } catch (error) {
    console.error('Error fetching resource metrics:', error);
    res.status(500).json({ error: 'Failed to fetch resource metrics' });
  }
});

/**
 * Get workspace policy
 * GET /api/workspaces/:workspaceId/policy
 */
router.get('/:workspaceId/policy', requireWorkspaceMember, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    
    const policy = await db.query.workspacePolicies.findFirst({
      where: eq(workspacePolicies.workspaceId, workspaceId)
    });
    
    if (!policy) {
      return res.status(404).json({ error: 'Workspace policy not found' });
    }
    
    res.json(policy);
  } catch (error) {
    console.error('Error fetching workspace policy:', error);
    res.status(500).json({ error: 'Failed to fetch workspace policy' });
  }
});

/**
 * Update workspace policy
 * PATCH /api/workspaces/:workspaceId/policy
 */
router.patch('/:workspaceId/policy', requireWorkspaceAdmin, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    
    // Validate the update data
    const updateSchema = insertWorkspacePolicySchema.partial();
    const validatedData = updateSchema.parse(req.body);
    
    // Find the policy
    let policy = await db.query.workspacePolicies.findFirst({
      where: eq(workspacePolicies.workspaceId, workspaceId)
    });
    
    // If policy doesn't exist yet, create it
    if (!policy) {
      const [newPolicy] = await db.insert(workspacePolicies)
        .values({
          workspaceId,
          ...validatedData
        })
        .returning();
      
      policy = newPolicy;
    } else {
      // Update existing policy
      [policy] = await db.update(workspacePolicies)
        .set({
          ...validatedData,
          updatedAt: new Date()
        })
        .where(eq(workspacePolicies.workspaceId, workspaceId))
        .returning();
    }
    
    // Audit log
    await createAuditLog({
      userId: req.user!.id,
      action: 'workspace_policy_updated',
      resourceType: 'workspace_policy',
      resourceId: workspaceId.toString(),
      details: validatedData
    });
    
    res.json(policy);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid policy data', details: error.errors });
    }
    
    console.error('Error updating workspace policy:', error);
    res.status(500).json({ error: 'Failed to update workspace policy' });
  }
});

/**
 * Get workspace members
 * GET /api/workspaces/:workspaceId/members
 */
router.get('/:workspaceId/members', requireWorkspaceMember, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    
    const members = await db.query.workspaceMembers.findMany({
      where: eq(workspaceMembers.workspaceId, workspaceId),
      with: {
        user: {
          columns: {
            id: true,
            username: true,
            displayName: true,
            email: true,
            avatarUrl: true
          }
        },
        inviter: {
          columns: {
            id: true,
            username: true,
            displayName: true
          }
        }
      },
      orderBy: workspaceMembers.createdAt
    });
    
    res.json(members);
  } catch (error) {
    console.error('Error fetching workspace members:', error);
    res.status(500).json({ error: 'Failed to fetch workspace members' });
  }
});

/**
 * Add a member to a workspace
 * POST /api/workspaces/:workspaceId/members
 */
router.post('/:workspaceId/members', requireWorkspaceAdmin, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    
    // Validate the member data
    const memberSchema = insertWorkspaceMemberSchema.omit({ lastAccessed: true });
    const validatedData = memberSchema.parse(req.body);
    
    // Check if the user exists
    const userExists = await db.query.users.findFirst({
      where: eq(users.id, validatedData.userId)
    });
    
    if (!userExists) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if the user is already a member
    const existingMember = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.userId, validatedData.userId),
        eq(workspaceMembers.workspaceId, workspaceId)
      )
    });
    
    if (existingMember) {
      return res.status(409).json({ error: 'User is already a member of this workspace' });
    }
    
    // Add the user to the workspace
    const [member] = await db.insert(workspaceMembers)
      .values({
        ...validatedData,
        workspaceId,
        invitedBy: req.user!.id,
        invitedAt: new Date()
      })
      .returning();
    
    // Audit log
    await createAuditLog({
      userId: req.user!.id,
      action: 'workspace_member_added',
      resourceType: 'workspace_member',
      resourceId: `${workspaceId}:${validatedData.userId}`,
      details: { 
        workspaceId, 
        userId: validatedData.userId,
        status: validatedData.status
      }
    });
    
    res.status(201).json(member);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid member data', details: error.errors });
    }
    
    console.error('Error adding workspace member:', error);
    res.status(500).json({ error: 'Failed to add workspace member' });
  }
});

/**
 * Update a workspace member
 * PATCH /api/workspaces/:workspaceId/members/:userId
 */
router.patch('/:workspaceId/members/:userId', requireWorkspaceAdmin, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    const userId = parseInt(req.params.userId);
    
    // Validate the update data
    const updateSchema = insertWorkspaceMemberSchema.partial();
    const validatedData = updateSchema.parse(req.body);
    
    // Update the member
    const [updatedMember] = await db.update(workspaceMembers)
      .set({
        ...validatedData,
        updatedAt: new Date()
      })
      .where(and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId)
      ))
      .returning();
    
    if (!updatedMember) {
      return res.status(404).json({ error: 'Workspace member not found' });
    }
    
    // Audit log
    await createAuditLog({
      userId: req.user!.id,
      action: 'workspace_member_updated',
      resourceType: 'workspace_member',
      resourceId: `${workspaceId}:${userId}`,
      details: validatedData
    });
    
    res.json(updatedMember);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid member data', details: error.errors });
    }
    
    console.error('Error updating workspace member:', error);
    res.status(500).json({ error: 'Failed to update workspace member' });
  }
});

/**
 * Remove a member from a workspace
 * DELETE /api/workspaces/:workspaceId/members/:userId
 */
router.delete('/:workspaceId/members/:userId', requireWorkspaceAdmin, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    const userId = parseInt(req.params.userId);
    
    // Check if user is trying to remove themselves as the last admin
    if (userId === req.user!.id) {
      // Count admins in the workspace
      const adminCount = await db.select({ count: db.fn.count() })
        .from(userRoles)
        .innerJoin(roles, eq(roles.id, userRoles.roleId))
        .where(and(
          eq(userRoles.workspaceId, workspaceId),
          eq(roles.name, 'Workspace Admin')
        ))
        .then(result => Number(result[0].count));
      
      if (adminCount <= 1) {
        return res.status(403).json({ 
          error: 'Cannot remove the last workspace administrator. Assign another administrator first.' 
        });
      }
    }
    
    // Check if member exists
    const member = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId)
      )
    });
    
    if (!member) {
      return res.status(404).json({ error: 'Workspace member not found' });
    }
    
    // Delete all user roles in this workspace
    await db.delete(userRoles)
      .where(and(
        eq(userRoles.workspaceId, workspaceId),
        eq(userRoles.userId, userId)
      ));
    
    // Remove the member
    await db.delete(workspaceMembers)
      .where(and(
        eq(workspaceMembers.workspaceId, workspaceId),
        eq(workspaceMembers.userId, userId)
      ));
    
    // Audit log
    await createAuditLog({
      userId: req.user!.id,
      action: 'workspace_member_removed',
      resourceType: 'workspace_member',
      resourceId: `${workspaceId}:${userId}`,
      details: { workspaceId, userId }
    });
    
    res.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Error removing workspace member:', error);
    res.status(500).json({ error: 'Failed to remove workspace member' });
  }
});

/**
 * Get user's default workspace
 * GET /api/workspaces/default
 */
router.get('/user/default', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Find the user's default workspace
    const defaultMembership = await db.query.workspaceMembers.findFirst({
      where: and(
        eq(workspaceMembers.userId, req.user.id),
        eq(workspaceMembers.isDefault, true)
      ),
      with: {
        workspace: true
      }
    });
    
    if (defaultMembership) {
      return res.json(defaultMembership.workspace);
    }
    
    // If no default is set, try to find any workspace the user is a member of
    const anyMembership = await db.query.workspaceMembers.findFirst({
      where: eq(workspaceMembers.userId, req.user.id),
      with: {
        workspace: true
      }
    });
    
    if (anyMembership) {
      return res.json(anyMembership.workspace);
    }
    
    // If user isn't a member of any workspace, return 404
    res.status(404).json({ error: 'No workspace found for user' });
  } catch (error) {
    console.error('Error fetching default workspace:', error);
    res.status(500).json({ error: 'Failed to fetch default workspace' });
  }
});

/**
 * Set user's default workspace
 * POST /api/workspaces/:workspaceId/default
 */
router.post('/:workspaceId/default', requireWorkspaceMember, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    
    // Start a transaction
    await db.transaction(async (tx) => {
      // Remove current default
      await tx.update(workspaceMembers)
        .set({ isDefault: false })
        .where(and(
          eq(workspaceMembers.userId, req.user!.id),
          eq(workspaceMembers.isDefault, true)
        ));
      
      // Set new default
      const [updatedMember] = await tx.update(workspaceMembers)
        .set({ isDefault: true })
        .where(and(
          eq(workspaceMembers.workspaceId, workspaceId),
          eq(workspaceMembers.userId, req.user!.id)
        ))
        .returning();
      
      if (!updatedMember) {
        return res.status(404).json({ error: 'Workspace membership not found' });
      }
    });
    
    res.json({ message: 'Default workspace set successfully' });
  } catch (error) {
    console.error('Error setting default workspace:', error);
    res.status(500).json({ error: 'Failed to set default workspace' });
  }
});

/**
 * Get MCP servers for a specific workspace
 * GET /api/workspaces/:workspaceId/mcp-servers
 */
router.get('/:workspaceId/mcp-servers', requireWorkspaceMember, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.workspaceId);
    
    const servers = await storage.getMcpServersByWorkspace(workspaceId);
    res.json(servers);
  } catch (error) {
    console.error('Error fetching MCP servers by workspace:', error);
    res.status(500).json({ error: 'Failed to fetch MCP servers' });
  }
});

export default router;