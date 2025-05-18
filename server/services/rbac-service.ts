import { db } from '@db';
import { eq, and, or, inArray } from 'drizzle-orm';
import {
  roles, userRoles, permissions, permissionGroups,
  Role, UserRole, Permission, User
} from '@shared/schema';

/**
 * Role-Based Access Control (RBAC) Service
 * 
 * Provides methods for managing roles, permissions, and access control
 * with support for workspace-scoped roles and least-privilege principles.
 */
export class RbacService {
  /**
   * Get all roles for a user, optionally filtered by workspace
   */
  async getUserRoles(userId: number, workspaceId?: number): Promise<Role[]> {
    const query = db.query.userRoles.findMany({
      where: and(
        eq(userRoles.userId, userId),
        workspaceId ? eq(userRoles.workspaceId, workspaceId) : undefined
      ),
      with: {
        role: true
      }
    });
    
    const userRoleRecords = await query;
    return userRoleRecords.map(ur => ur.role);
  }

  /**
   * Get all permissions for a user across all their roles
   */
  async getUserPermissions(userId: number, workspaceId?: number): Promise<string[]> {
    const roles = await this.getUserRoles(userId, workspaceId);
    
    // Collect all permissions from all roles
    const allPermissions = new Set<string>();
    
    for (const role of roles) {
      // If the role has a wildcard permission, user has all permissions
      if (role.permissions && Array.isArray(role.permissions)) {
        for (const perm of role.permissions as string[]) {
          if (perm === '*:*') {
            return ['*:*']; // User has all permissions
          }
          allPermissions.add(perm);
        }
      }
    }
    
    return Array.from(allPermissions);
  }

  /**
   * Check if a user has a specific permission
   */
  async hasPermission(
    userId: number, 
    permissionName: string, 
    workspaceId?: number,
    resourceId?: number
  ): Promise<boolean> {
    const userPerms = await this.getUserPermissions(userId, workspaceId);
    
    // Check for wildcard permissions
    if (userPerms.includes('*:*')) {
      return true;
    }
    
    // Check for resource type wildcard
    const [action, resource] = permissionName.split(':');
    if (userPerms.includes(`${action}:*`)) {
      return true;
    }
    
    // Check for exact permission match
    if (userPerms.includes(permissionName)) {
      return true;
    }
    
    // Check for resource-specific permission with ID
    if (resourceId && userPerms.includes(`${permissionName}:${resourceId}`)) {
      return true;
    }
    
    return false;
  }

  /**
   * Assign a role to a user
   */
  async assignRoleToUser(
    userId: number,
    roleId: number,
    assignedById: number,
    workspaceId?: number
  ): Promise<UserRole> {
    // Check if the role exists
    const role = await db.query.roles.findFirst({
      where: eq(roles.id, roleId)
    });
    
    if (!role) {
      throw new Error('Role not found');
    }
    
    // Check if the user already has this role
    const existingRole = await db.query.userRoles.findFirst({
      where: and(
        eq(userRoles.userId, userId),
        eq(userRoles.roleId, roleId),
        workspaceId ? eq(userRoles.workspaceId, workspaceId) : undefined
      )
    });
    
    if (existingRole) {
      throw new Error('User already has this role');
    }
    
    // Assign the role
    const [userRole] = await db
      .insert(userRoles)
      .values({
        userId,
        roleId,
        workspaceId: workspaceId || null,
        assignedById,
        createdAt: new Date()
      })
      .returning();
    
    return userRole;
  }

  /**
   * Remove a role from a user
   */
  async removeRoleFromUser(
    userId: number,
    roleId: number,
    workspaceId?: number
  ): Promise<void> {
    await db
      .delete(userRoles)
      .where(
        and(
          eq(userRoles.userId, userId),
          eq(userRoles.roleId, roleId),
          workspaceId ? eq(userRoles.workspaceId, workspaceId) : undefined
        )
      );
  }

  /**
   * Create a new role
   */
  async createRole(
    name: string,
    description: string,
    permissions: string[],
    workspaceId?: number,
    isSystem: boolean = false
  ): Promise<Role> {
    // Check if a role with this name already exists in this workspace
    const existingRole = await db.query.roles.findFirst({
      where: and(
        eq(roles.name, name),
        workspaceId ? eq(roles.workspaceId, workspaceId) : eq(roles.workspaceId, null)
      )
    });
    
    if (existingRole) {
      throw new Error('A role with this name already exists in this workspace');
    }
    
    // Create the role
    const [role] = await db
      .insert(roles)
      .values({
        name,
        description,
        permissions: permissions,
        workspaceId: workspaceId || null,
        isSystem,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    return role;
  }

  /**
   * Update an existing role
   */
  async updateRole(
    roleId: number,
    updates: {
      name?: string;
      description?: string;
      permissions?: string[];
    }
  ): Promise<Role> {
    // Check if the role exists
    const role = await db.query.roles.findFirst({
      where: eq(roles.id, roleId)
    });
    
    if (!role) {
      throw new Error('Role not found');
    }
    
    // Check if the role is a system role
    if (role.isSystem) {
      throw new Error('System roles cannot be modified');
    }
    
    // Update the role
    const [updatedRole] = await db
      .update(roles)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(roles.id, roleId))
      .returning();
    
    return updatedRole;
  }

  /**
   * Delete a role
   */
  async deleteRole(roleId: number): Promise<void> {
    // Check if the role exists
    const role = await db.query.roles.findFirst({
      where: eq(roles.id, roleId)
    });
    
    if (!role) {
      throw new Error('Role not found');
    }
    
    // Check if the role is a system role
    if (role.isSystem) {
      throw new Error('System roles cannot be deleted');
    }
    
    // Delete the role
    await db
      .delete(roles)
      .where(eq(roles.id, roleId));
  }

  /**
   * Get users with a specific role
   */
  async getUsersWithRole(roleId: number, workspaceId?: number): Promise<User[]> {
    const userRoleRecords = await db.query.userRoles.findMany({
      where: and(
        eq(userRoles.roleId, roleId),
        workspaceId ? eq(userRoles.workspaceId, workspaceId) : undefined
      ),
      with: {
        user: true
      }
    });
    
    return userRoleRecords.map(ur => ur.user);
  }

  /**
   * Check if a user is a workspace admin
   */
  async isWorkspaceAdmin(userId: number, workspaceId: number): Promise<boolean> {
    const userRoles = await this.getUserRoles(userId, workspaceId);
    
    // Check for admin or workspace_admin role
    return userRoles.some(role => 
      role.name === 'admin' || role.name === 'workspace_admin' ||
      (role.permissions && 
       Array.isArray(role.permissions) && 
       ((role.permissions as string[]).includes('*:*') || 
        (role.permissions as string[]).includes('*:workspace')))
    );
  }

  /**
   * Create default system roles if they don't exist
   */
  async createDefaultRoles(): Promise<void> {
    // Define default roles
    const defaultRoles = [
      {
        name: 'admin',
        description: 'System administrator with full access',
        permissions: ['*:*'],
        isSystem: true
      },
      {
        name: 'user',
        description: 'Standard user with limited access',
        permissions: ['read:self', 'update:self'],
        isSystem: true
      },
      {
        name: 'workspace_admin',
        description: 'Workspace administrator',
        permissions: ['*:workspace'],
        isSystem: true
      }
    ];
    
    // Check and create each role
    for (const roleData of defaultRoles) {
      const existingRole = await db.query.roles.findFirst({
        where: and(
          eq(roles.name, roleData.name),
          eq(roles.workspaceId, null)
        )
      });
      
      if (!existingRole) {
        await db
          .insert(roles)
          .values({
            ...roleData,
            workspaceId: null,
            createdAt: new Date(),
            updatedAt: new Date()
          });
      }
    }
  }
}

// Export a singleton instance
export const rbacService = new RbacService();