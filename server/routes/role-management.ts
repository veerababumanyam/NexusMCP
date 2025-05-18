/**
 * Role Management API
 * 
 * This module provides endpoints for role creation, management, and permission assignment:
 * - Create, read, update, delete roles
 * - Assign permissions to roles
 * - List all permissions in the system
 * - Manage role assignments
 */

import express, { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '@db';
import { eq, and, not, or, sql, inArray } from 'drizzle-orm';
import { roles, permissions, rolePermissions, users, userRoles } from '@shared/schema';
import { createAuditLog } from '../services/audit-service';

const router = express.Router();

// Get all roles
router.get('/', async (req: Request, res: Response) => {
  try {
    const { workspaceId, includeSystem } = req.query;
    
    let query = db.select().from(roles);
    
    // Filter by workspace if provided
    if (workspaceId) {
      const workspaceIdInt = parseInt(workspaceId as string);
      query = query.where(
        or(
          eq(roles.workspaceId, workspaceIdInt),
          sql`${roles.workspaceId} IS NULL`
        )
      );
    }
    
    // Only include non-system roles unless specified
    if (includeSystem !== 'true') {
      query = query.where(
        or(
          eq(roles.isSystem, false),
          sql`${roles.isSystem} IS NULL`
        )
      );
    }
    
    const allRoles = await query.orderBy(roles.name);
    
    // For each role, get its associated permissions
    const rolesWithPermissions = await Promise.all(
      allRoles.map(async (role) => {
        const rolePerms = await db.query.rolePermissions.findMany({
          where: eq(rolePermissions.roleId, role.id),
          with: {
            permission: true
          }
        });
        
        return {
          ...role,
          permissions: rolePerms.map(rp => rp.permission)
        };
      })
    );
    
    res.status(200).json(rolesWithPermissions);
  } catch (error) {
    console.error('Error getting roles:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single role
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const role = await db.query.roles.findFirst({
      where: eq(roles.id, parseInt(id))
    });
    
    if (!role) {
      return res.status(404).json({ error: 'Role not found' });
    }
    
    // Get permissions associated with this role
    const rolePerms = await db.query.rolePermissions.findMany({
      where: eq(rolePermissions.roleId, role.id),
      with: {
        permission: true
      }
    });
    
    const roleWithPermissions = {
      ...role,
      permissions: rolePerms.map(rp => rp.permission)
    };
    
    res.status(200).json(roleWithPermissions);
  } catch (error) {
    console.error('Error getting role:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new role
router.post('/', async (req: Request, res: Response) => {
  try {
    // Define validation schema
    const createRoleSchema = z.object({
      name: z.string().min(2).max(50),
      description: z.string().optional(),
      workspaceId: z.number().optional(),
      permissions: z.array(z.number()).optional()
    });
    
    // Validate request body
    const validatedData = createRoleSchema.parse(req.body);
    
    // Create new role
    const [newRole] = await db.insert(roles)
      .values({
        name: validatedData.name,
        description: validatedData.description || null,
        workspaceId: validatedData.workspaceId || null,
        isSystem: false,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    // Assign permissions if provided
    if (validatedData.permissions && validatedData.permissions.length > 0) {
      await db.insert(rolePermissions)
        .values(
          validatedData.permissions.map(permId => ({
            roleId: newRole.id,
            permissionId: permId,
            createdAt: new Date(),
            updatedAt: new Date()
          }))
        );
    }
    
    // Get the newly created role with its permissions
    const rolePerms = await db.query.rolePermissions.findMany({
      where: eq(rolePermissions.roleId, newRole.id),
      with: {
        permission: true
      }
    });
    
    const roleWithPermissions = {
      ...newRole,
      permissions: rolePerms.map(rp => rp.permission)
    };
    
    // Create audit log
    await createAuditLog({
      action: 'create_role',
      userId: req.user?.id,
      resourceType: 'role',
      resourceId: newRole.id.toString(),
      workspaceId: validatedData.workspaceId,
      details: {
        name: validatedData.name,
        permissionCount: rolePerms.length
      }
    });
    
    res.status(201).json(roleWithPermissions);
  } catch (error) {
    console.error('Error creating role:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update a role
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const roleId = parseInt(id);
    
    // Check if role exists
    const existingRole = await db.query.roles.findFirst({
      where: eq(roles.id, roleId)
    });
    
    if (!existingRole) {
      return res.status(404).json({ error: 'Role not found' });
    }
    
    // Prevent modification of system roles
    if (existingRole.isSystem) {
      return res.status(403).json({ error: 'System roles cannot be modified' });
    }
    
    // Define validation schema
    const updateRoleSchema = z.object({
      name: z.string().min(2).max(50).optional(),
      description: z.string().optional().nullable(),
      workspaceId: z.number().optional().nullable(),
      permissions: z.array(z.number()).optional()
    });
    
    // Validate request body
    const validatedData = updateRoleSchema.parse(req.body);
    
    // Update the role
    const updateData: any = {
      updatedAt: new Date()
    };
    
    if (validatedData.name !== undefined) {
      updateData.name = validatedData.name;
    }
    
    if (validatedData.description !== undefined) {
      updateData.description = validatedData.description;
    }
    
    if (validatedData.workspaceId !== undefined) {
      updateData.workspaceId = validatedData.workspaceId;
    }
    
    const [updatedRole] = await db.update(roles)
      .set(updateData)
      .where(eq(roles.id, roleId))
      .returning();
    
    // Update permissions if provided
    if (validatedData.permissions !== undefined) {
      // Delete all existing role permissions
      await db.delete(rolePermissions)
        .where(eq(rolePermissions.roleId, roleId));
      
      // Insert new role permissions
      if (validatedData.permissions.length > 0) {
        await db.insert(rolePermissions)
          .values(
            validatedData.permissions.map(permId => ({
              roleId,
              permissionId: permId,
              createdAt: new Date(),
              updatedAt: new Date()
            }))
          );
      }
    }
    
    // Get the updated role with its permissions
    const rolePerms = await db.query.rolePermissions.findMany({
      where: eq(rolePermissions.roleId, roleId),
      with: {
        permission: true
      }
    });
    
    const roleWithPermissions = {
      ...updatedRole,
      permissions: rolePerms.map(rp => rp.permission)
    };
    
    // Create audit log
    await createAuditLog({
      action: 'update_role',
      userId: req.user?.id,
      resourceType: 'role',
      resourceId: id,
      workspaceId: updatedRole.workspaceId,
      details: {
        name: updatedRole.name,
        permissionCount: rolePerms.length
      }
    });
    
    res.status(200).json(roleWithPermissions);
  } catch (error) {
    console.error('Error updating role:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete a role
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const roleId = parseInt(id);
    
    // Check if role exists
    const existingRole = await db.query.roles.findFirst({
      where: eq(roles.id, roleId)
    });
    
    if (!existingRole) {
      return res.status(404).json({ error: 'Role not found' });
    }
    
    // Prevent deletion of system roles
    if (existingRole.isSystem) {
      return res.status(403).json({ error: 'System roles cannot be deleted' });
    }
    
    // Delete all role permissions
    await db.delete(rolePermissions)
      .where(eq(rolePermissions.roleId, roleId));
    
    // Delete all user roles
    await db.delete(userRoles)
      .where(eq(userRoles.roleId, roleId));
    
    // Delete the role
    await db.delete(roles)
      .where(eq(roles.id, roleId));
    
    // Create audit log
    await createAuditLog({
      action: 'delete_role',
      userId: req.user?.id,
      resourceType: 'role',
      resourceId: id,
      workspaceId: existingRole.workspaceId,
      details: {
        name: existingRole.name
      }
    });
    
    res.status(200).json({ success: true, message: 'Role deleted successfully' });
  } catch (error) {
    console.error('Error deleting role:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Assign permissions to a role
router.post('/:id/permissions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const roleId = parseInt(id);
    
    // Check if role exists
    const existingRole = await db.query.roles.findFirst({
      where: eq(roles.id, roleId)
    });
    
    if (!existingRole) {
      return res.status(404).json({ error: 'Role not found' });
    }
    
    // Validate request body
    const permissionSchema = z.array(z.number());
    const permissionIds = permissionSchema.parse(req.body.permissionIds);
    
    // Delete existing permissions for this role
    await db.delete(rolePermissions)
      .where(eq(rolePermissions.roleId, roleId));
    
    // Add new permissions
    if (permissionIds.length > 0) {
      await db.insert(rolePermissions)
        .values(
          permissionIds.map(permissionId => ({
            roleId,
            permissionId,
            createdAt: new Date(),
            updatedAt: new Date()
          }))
        );
    }
    
    // Retrieve updated role with permissions
    const rolePerms = await db.query.rolePermissions.findMany({
      where: eq(rolePermissions.roleId, roleId),
      with: {
        permission: true
      }
    });
    
    // Create audit log
    await createAuditLog({
      action: 'update_role_permissions',
      userId: req.user?.id,
      resourceType: 'role',
      resourceId: id,
      workspaceId: existingRole.workspaceId,
      details: {
        name: existingRole.name,
        permissionCount: permissionIds.length
      }
    });
    
    res.status(200).json({
      role: existingRole,
      permissions: rolePerms.map(rp => rp.permission)
    });
  } catch (error) {
    console.error('Error assigning permissions to role:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all permissions in the system
router.get('/permissions/all', async (req: Request, res: Response) => {
  try {
    const allPermissions = await db.query.permissions.findMany({
      orderBy: permissions.name
    });
    
    // Transform permissions into categorized structure
    const permissionsByGroup: Record<string, any[]> = {};
    
    allPermissions.forEach(permission => {
      // Group permissions by the first part of their name (e.g., "workspace:read" -> "workspace")
      const group = permission.name.split(':')[0] || 'general';
      
      if (!permissionsByGroup[group]) {
        permissionsByGroup[group] = [];
      }
      
      permissionsByGroup[group].push(permission);
    });
    
    res.status(200).json({
      permissions: allPermissions,
      permissionsByGroup
    });
  } catch (error) {
    console.error('Error getting permissions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get users with a specific role
router.get('/:id/users', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const roleId = parseInt(id);
    
    // Check if role exists
    const existingRole = await db.query.roles.findFirst({
      where: eq(roles.id, roleId)
    });
    
    if (!existingRole) {
      return res.status(404).json({ error: 'Role not found' });
    }
    
    // Get all user IDs with this role
    const userRolesWithThisRole = await db.query.userRoles.findMany({
      where: eq(userRoles.roleId, roleId),
      columns: {
        userId: true,
        workspaceId: true,
        // Remove isActive which doesn't exist in the schema
      }
    });
    
    // Get user details for each user ID - convert to Array to avoid Set iteration issues
    const userIdArray = Array.from(new Set(userRolesWithThisRole.map(ur => ur.userId)));
    
    if (userIdArray.length === 0) {
      return res.status(200).json({ users: [] });
    }
    
    // Get user details using standard eq for better type safety
    const userDetails = await db.query.users.findMany({
      where: inArray(users.id, userIdArray),
      columns: {
        id: true,
        username: true,
        email: true,
        fullName: true, // Use fullName from schema instead of name
        // Remove isActive which isn't in the schema
      }
    });
    
    // Map user roles to users
    const usersWithRoleDetails = userDetails.map(user => {
      const userRoleEntries = userRolesWithThisRole.filter(ur => ur.userId === user.id);
      
      return {
        ...user,
        roleAssignments: userRoleEntries.map(ur => ({
          workspaceId: ur.workspaceId,
          isActive: ur.isActive
        }))
      };
    });
    
    res.status(200).json({
      role: existingRole,
      users: usersWithRoleDetails
    });
  } catch (error) {
    console.error('Error getting users with role:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;