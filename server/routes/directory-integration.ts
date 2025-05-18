/**
 * Directory Integration API
 * 
 * This module provides endpoints for managing directory service integrations:
 * - LDAP connections and configurations
 * - User synchronization settings
 * - Role mappings and automatic provisioning
 */

import express, { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '@db';
import { eq, and, not, sql, or } from 'drizzle-orm';
import { roles } from '@shared/schema';
import { 
  ldapDirectories, 
  directoryGroups, 
  directoryGroupRoleMappings,
  ldapDirectoryInsertSchema,
  ldapDirectorySelectSchema
} from '@shared/schema_directory';
import { ldapDirectorySchema } from '../services/directory/ldap-sync-service';
import { createAuditLog } from '../services/audit-service';
import { ldapSyncService } from '../services/directory/ldap-sync-service';

const router = express.Router();

// Get all directory connections
router.get('/ldap-connections', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.query;
    
    let query = db.select().from(ldapDirectories);
    
    if (workspaceId) {
      query = query.where(eq(ldapDirectories.workspaceId, parseInt(workspaceId as string)));
    }
    
    const connections = await query.orderBy(ldapDirectories.name);
    
    res.status(200).json(connections);
  } catch (error) {
    console.error('Error getting LDAP connections:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a single LDAP connection
router.get('/ldap-connections/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const connection = await db.query.ldapDirectories.findFirst({
      where: eq(ldapDirectories.id, parseInt(id))
    });
    
    if (!connection) {
      return res.status(404).json({ error: 'LDAP connection not found' });
    }
    
    res.status(200).json(connection);
  } catch (error) {
    console.error('Error getting LDAP connection:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create a new LDAP connection
router.post('/ldap-connections', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedData = ldapDirectoryInsertSchema.parse(req.body);
    
    // Create new LDAP connection
    const [newConnection] = await db.insert(ldapDirectories)
      .values(validatedData)
      .returning();
    
    // Create audit log
    await createAuditLog({
      action: 'create_ldap_connection',
      userId: req.user?.id,
      workspaceId: validatedData.workspaceId,
      resourceType: 'ldap_directory',
      resourceId: newConnection.id.toString(),
      details: {
        name: validatedData.name,
        host: validatedData.host
      }
    });
    
    res.status(201).json(newConnection);
  } catch (error) {
    console.error('Error creating LDAP connection:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update an LDAP connection
router.put('/ldap-connections/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if connection exists
    const existingConnection = await db.query.ldapDirectories.findFirst({
      where: eq(ldapDirectories.id, parseInt(id))
    });
    
    if (!existingConnection) {
      return res.status(404).json({ error: 'LDAP connection not found' });
    }
    
    // Validate request body
    const validatedData = ldapDirectoryInsertSchema.partial().parse(req.body);
    
    // Update connection
    const [updatedConnection] = await db.update(ldapDirectories)
      .set({
        ...validatedData,
        updatedAt: new Date()
      })
      .where(eq(ldapDirectories.id, parseInt(id)))
      .returning();
    
    // Create audit log
    await createAuditLog({
      action: 'update_ldap_connection',
      userId: req.user?.id,
      workspaceId: existingConnection.workspaceId,
      resourceType: 'ldap_directory',
      resourceId: id,
      details: {
        name: validatedData.name || existingConnection.name
      }
    });
    
    res.status(200).json(updatedConnection);
  } catch (error) {
    console.error('Error updating LDAP connection:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete an LDAP connection
router.delete('/ldap-connections/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const connectionId = parseInt(id);
    
    // Check if connection exists
    const existingConnection = await db.query.ldapDirectories.findFirst({
      where: eq(ldapDirectories.id, connectionId)
    });
    
    if (!existingConnection) {
      return res.status(404).json({ error: 'LDAP connection not found' });
    }
    
    // Delete all role mappings associated with this connection's groups
    const directoryGroupIds = await db.query.directoryGroups
      .findMany({
        where: eq(directoryGroups.directoryId, connectionId),
        columns: { id: true }
      })
      .then(groups => groups.map(group => group.id));
    
    if (directoryGroupIds.length > 0) {
      // Delete role mappings for these groups
      await db.delete(directoryGroupRoleMappings)
        .where(sql`directory_group_id IN (${directoryGroupIds.join(',')})`);
      
      // Delete the groups
      await db.delete(directoryGroups)
        .where(eq(directoryGroups.directoryId, connectionId));
    }
    
    // Delete the LDAP connection
    await db.delete(ldapDirectories)
      .where(eq(ldapDirectories.id, connectionId));
    
    // Create audit log
    await createAuditLog({
      action: 'delete_ldap_connection',
      userId: req.user?.id,
      workspaceId: existingConnection.workspaceId,
      resourceType: 'ldap_directory',
      resourceId: id
    });
    
    res.status(200).json({ success: true, message: 'LDAP connection deleted successfully' });
  } catch (error) {
    console.error('Error deleting LDAP connection:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Test an LDAP connection
router.post('/ldap-connections/test', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedData = ldapDirectorySchema.parse(req.body);
    
    // Test the connection
    const result = await ldapSyncService.testConnection(validatedData);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error testing LDAP connection:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Sync an LDAP connection
router.post('/ldap-connections/:id/sync', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const directoryId = parseInt(id);
    
    // Check if connection exists
    const existingConnection = await db.query.ldapDirectories.findFirst({
      where: eq(ldapDirectories.id, directoryId)
    });
    
    if (!existingConnection) {
      return res.status(404).json({ error: 'LDAP connection not found' });
    }
    
    // Start the synchronization
    const result = await ldapSyncService.synchronize(directoryId, req);
    
    // Create audit log
    await createAuditLog({
      action: 'sync_ldap_directory',
      userId: req.user?.id,
      workspaceId: existingConnection.workspaceId,
      resourceType: 'ldap_directory',
      resourceId: id,
      details: {
        usersTotal: result.stats.users.total,
        usersCreated: result.stats.users.created,
        usersUpdated: result.stats.users.updated,
        groupsTotal: result.stats.groups.total,
        groupsCreated: result.stats.groups.created
      }
    });
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Error synchronizing LDAP directory:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get directory groups for an LDAP connection
router.get('/ldap-connections/:id/groups', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const directoryId = parseInt(id);
    
    // Check if connection exists
    const existingConnection = await db.query.ldapDirectories.findFirst({
      where: eq(ldapDirectories.id, directoryId)
    });
    
    if (!existingConnection) {
      return res.status(404).json({ error: 'LDAP connection not found' });
    }
    
    // Get groups for this directory
    const groups = await db.query.directoryGroups.findMany({
      where: eq(directoryGroups.directoryId, directoryId),
      orderBy: directoryGroups.name
    });
    
    // For each group, get its role mappings
    const groupsWithRoleMappings = await Promise.all(
      groups.map(async (group) => {
        const roleMappings = await db.query.directoryGroupRoleMappings.findMany({
          where: eq(directoryGroupRoleMappings.directoryGroupId, group.id),
          columns: {
            id: true,
            roleId: true,
            workspaceId: true,
            isAutoProvisioned: true
          }
        });
        
        // Get role details for each mapping
        const mappingsWithRoles = await Promise.all(
          roleMappings.map(async (mapping) => {
            const role = await db.query.roles.findFirst({
              where: eq(roles.id, mapping.roleId),
              columns: {
                id: true,
                name: true,
                description: true
              }
            });
            
            return {
              ...mapping,
              role
            };
          })
        );
        
        return {
          ...group,
          roleMappings: mappingsWithRoles
        };
      })
    );
    
    res.status(200).json(groupsWithRoleMappings);
  } catch (error) {
    console.error('Error getting directory groups:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update role mappings for a directory group
router.put('/groups/:groupId/role-mappings', async (req: Request, res: Response) => {
  try {
    const { groupId } = req.params;
    const directoryGroupId = parseInt(groupId);
    
    // Get the directory group
    const group = await db.query.directoryGroups.findFirst({
      where: eq(directoryGroups.id, directoryGroupId)
    });
    
    if (!group) {
      return res.status(404).json({ error: 'Directory group not found' });
    }
    
    // Validate request body
    const roleMappings = z.array(z.object({
      roleId: z.number(),
      workspaceId: z.number().optional(),
      isAutoProvisioned: z.boolean().default(false)
    })).parse(req.body.roleMappings);
    
    // Delete existing mappings
    await db.delete(directoryGroupRoleMappings)
      .where(eq(directoryGroupRoleMappings.directoryGroupId, directoryGroupId));
    
    // Insert new mappings
    if (roleMappings.length > 0) {
      await db.insert(directoryGroupRoleMappings)
        .values(
          roleMappings.map(mapping => ({
            directoryGroupId,
            roleId: mapping.roleId,
            workspaceId: mapping.workspaceId || null,
            isAutoProvisioned: mapping.isAutoProvisioned,
            createdById: req.user?.id || null,
            createdAt: new Date(),
            updatedAt: new Date()
          }))
        );
    }
    
    // Get the updated mappings
    const updatedMappings = await db.query.directoryGroupRoleMappings.findMany({
      where: eq(directoryGroupRoleMappings.directoryGroupId, directoryGroupId)
    });
    
    // Get role details for each mapping
    const mappingsWithRoles = await Promise.all(
      updatedMappings.map(async (mapping) => {
        const role = await db.query.roles.findFirst({
          where: eq(roles.id, mapping.roleId)
        });
        
        return {
          ...mapping,
          role
        };
      })
    );
    
    // Create audit log
    await createAuditLog({
      action: 'update_directory_group_role_mappings',
      userId: req.user?.id,
      workspaceId: group.workspaceId,
      resourceType: 'directory_group',
      resourceId: groupId,
      details: {
        groupName: group.name,
        mappingsCount: mappingsWithRoles.length
      }
    });
    
    res.status(200).json({
      group,
      roleMappings: mappingsWithRoles
    });
  } catch (error) {
    console.error('Error updating role mappings:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;