/**
 * Policy Service
 * 
 * Enterprise-grade policy engine that combines RBAC and ABAC capabilities
 * Provides centralized policy enforcement for MCP tool access and execution
 */

import { db } from '../../db';
import { eq, and, or, inArray } from 'drizzle-orm';
import { users, roles, permissions, userRoles, rolePermissions, workspaces } from '@shared/schema';
import { ToolMetadata } from './mcp-core-service';
import { createAuditLog } from './auditLogService';
import { eventBus } from '../eventBus';

export interface PolicyDecision {
  allowed: boolean;
  reason?: string;
  filteredData?: any;
}

export interface PolicyContext {
  userId: number;
  workspaceId?: number;
  resourceType: string;
  resourceId?: string;
  action: string;
  attributes?: Record<string, any>;
}

export class PolicyService {
  /**
   * Evaluate access against policies
   * 
   * @param context Policy evaluation context
   * @returns Policy decision
   */
  public async evaluateAccess(context: PolicyContext): Promise<PolicyDecision> {
    const { userId, workspaceId, resourceType, resourceId, action, attributes } = context;
    
    try {
      // Get user information
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        with: {
          roles: {
            with: {
              role: {
                with: {
                  permissions: {
                    with: {
                      permission: true
                    }
                  }
                }
              }
            }
          }
        }
      });
      
      if (!user) {
        return { allowed: false, reason: 'User not found' };
      }
      
      // Check workspace membership if workspaceId is provided
      if (workspaceId) {
        // Using direct SQL query since workspaceUsers might have a different structure
        const workspaceMembership = await db.execute(
          `SELECT * FROM workspace_users WHERE user_id = $1 AND workspace_id = $2 LIMIT 1`,
          [userId, workspaceId]
        );
        
        if (workspaceMembership.rows.length === 0) {
          return { allowed: false, reason: 'User is not a member of the workspace' };
        }
      }
      
      // Extract user permissions from roles
      const userPermissions = this.extractUserPermissions(user);
      
      // Check if user has the required permission for this action
      const requiredPermission = this.mapActionToPermission(resourceType, action);
      const hasPermission = this.checkPermission(userPermissions, requiredPermission);
      
      if (!hasPermission) {
        // Log policy denial
        await createAuditLog({
          userId,
          action: 'policy_denied',
          resourceType,
          resourceId: resourceId || '',
          details: {
            requiredPermission,
            workspaceId,
            context: JSON.stringify(context)
          }
        });
        
        return { allowed: false, reason: 'Insufficient permissions' };
      }
      
      // Log policy approval
      await createAuditLog({
        userId,
        action: 'policy_allowed',
        resourceType,
        resourceId: resourceId || '',
        details: {
          requiredPermission,
          workspaceId
        }
      });
      
      // For more complex ABAC decisions, additional attribute-based rules would be evaluated here
      
      return { allowed: true };
    } catch (error) {
      console.error('Policy evaluation error:', error);
      return { allowed: false, reason: 'Policy evaluation error' };
    }
  }
  
  /**
   * Filter MCP tools based on user permissions
   * 
   * @param userId User ID
   * @param tools List of tools to filter
   * @returns Filtered list of tools the user can access
   */
  public async filterToolsForUser(userId: number, tools: ToolMetadata[]): Promise<ToolMetadata[]> {
    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, userId),
        with: {
          roles: {
            with: {
              role: {
                with: {
                  permissions: {
                    with: {
                      permission: true
                    }
                  }
                }
              }
            }
          }
        }
      });
      
      if (!user) {
        return [];
      }
      
      // Extract user permissions from roles
      const userPermissions = this.extractUserPermissions(user);
      
      // Check global permission to use all tools
      if (this.checkPermission(userPermissions, 'mcp.tools.use.all')) {
        return tools;
      }
      
      // Filter tools based on permissions
      const filteredTools = tools.filter(tool => {
        // Check specific tool permission
        return this.checkPermission(userPermissions, `mcp.tools.use.${tool.id}`);
      });
      
      // Log the filtering event
      await createAuditLog({
        userId,
        action: 'tools_filtered',
        resourceType: 'mcp_tools',
        details: {
          totalTools: tools.length,
          allowedTools: filteredTools.length
        }
      });
      
      return filteredTools;
    } catch (error) {
      console.error('Error filtering tools:', error);
      return [];
    }
  }
  
  /**
   * Extract all permissions a user has through their roles
   */
  private extractUserPermissions(user: any): string[] {
    const permissions = new Set<string>();
    
    // Extract permissions from user roles
    if (user.roles) {
      user.roles.forEach((userRole: any) => {
        if (userRole.role && userRole.role.permissions) {
          userRole.role.permissions.forEach((rolePermission: any) => {
            if (rolePermission.permission) {
              permissions.add(rolePermission.permission.name);
            }
          });
        }
      });
    }
    
    return Array.from(permissions);
  }
  
  /**
   * Map a resource action to a required permission
   */
  private mapActionToPermission(resourceType: string, action: string): string {
    // Standard permission format: {resourceType}.{action}
    return `${resourceType}.${action}`;
  }
  
  /**
   * Check if a user has a specific permission, accounting for wildcards
   */
  private checkPermission(userPermissions: string[], requiredPermission: string): boolean {
    // Direct permission check
    if (userPermissions.includes(requiredPermission)) {
      return true;
    }
    
    // Admin permission check
    if (userPermissions.includes('admin')) {
      return true;
    }
    
    // Wildcard permission checks
    const parts = requiredPermission.split('.');
    
    // Check progressively more specific wildcards
    for (let i = parts.length; i > 0; i--) {
      const wildcardParts = [...parts.slice(0, i), '*'];
      if (i < parts.length) {
        const wildcardPermission = wildcardParts.join('.');
        if (userPermissions.includes(wildcardPermission)) {
          return true;
        }
      }
    }
    
    // Super admin wildcard
    if (userPermissions.includes('*')) {
      return true;
    }
    
    return false;
  }
}

// Create and export singleton instance
export const policyService = new PolicyService();