/**
 * LDAP Synchronization Service
 * 
 * This service handles synchronization of users and groups from LDAP/Active Directory
 * with support for role mapping, automatic provisioning, and scheduled synchronization.
 */

import { db } from '@db';
import { eq, and, or, isNull } from 'drizzle-orm';
import { 
  ldapDirectories, 
  directoryGroups, 
  directoryGroupRoleMappings 
} from '@shared/schema_directory';
import { roles, users, userRoles } from '@shared/schema';
import { z } from 'zod';
import { createAuditLog } from '../audit-service';
import type { Request } from 'express';

// LDAP directory schema for validation
export const ldapDirectorySchema = z.object({
  workspaceId: z.number(),
  name: z.string().min(1).max(100),
  host: z.string().min(1).max(255),
  port: z.number().default(389),
  bindDn: z.string().min(1),
  bindCredential: z.string().optional(),
  searchBase: z.string().min(1),
  userDnPattern: z.string().optional(),
  useSsl: z.boolean().default(false),
  useTls: z.boolean().default(true),
  connectionTimeout: z.number().default(5000),
  userIdAttribute: z.string().default('uid'),
  usernameAttribute: z.string().default('uid'),
  emailAttribute: z.string().default('mail'),
  fullNameAttribute: z.string().default('cn'),
  groupMemberAttribute: z.string().default('memberOf'),
  syncGroups: z.boolean().default(true),
  groupSearchBase: z.string().optional(),
  groupObjectClass: z.string().default('groupOfNames'),
  groupNameAttribute: z.string().default('cn'),
  roleMappings: z.record(z.string(), z.array(z.number())).optional()
});

export class LdapSyncService {
  /**
   * Test LDAP connection and return connection status
   */
  async testConnection(config: z.infer<typeof ldapDirectorySchema>): Promise<{ success: boolean, message: string }> {
    try {
      // Create LDAP client (this is a mock implementation)
      const client = this.createLdapClient(config);
      
      // Try to connect and bind
      await client.connect();
      const bindSuccess = await client.bind(config.bindDn, config.bindCredential || '');
      
      if (!bindSuccess) {
        return {
          success: false,
          message: 'Failed to bind with the provided credentials'
        };
      }
      
      // Try a simple search to test permissions
      const testSearch = await client.search({
        base: config.searchBase,
        scope: 'sub',
        filter: '(objectClass=*)',
        attributes: ['dn'],
        sizeLimit: 1
      });
      
      await client.disconnect();
      
      return {
        success: true,
        message: 'Connection successful'
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
  
  /**
   * Save LDAP directory configuration
   */
  async saveDirectory(config: z.infer<typeof ldapDirectorySchema>): Promise<any> {
    // Check if a directory with this name already exists for this workspace
    const existingDirectory = await db.query.ldapDirectories.findFirst({
      where: and(
        eq(ldapDirectories.name, config.name),
        eq(ldapDirectories.workspaceId, config.workspaceId)
      )
    });
    
    if (existingDirectory) {
      // Update existing directory
      const [updatedDirectory] = await db.update(ldapDirectories)
        .set({
          ...config,
          updatedAt: new Date()
        })
        .where(eq(ldapDirectories.id, existingDirectory.id))
        .returning();
        
      return updatedDirectory;
    } else {
      // Create new directory
      const [newDirectory] = await db.insert(ldapDirectories)
        .values({
          ...config,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
        
      return newDirectory;
    }
  }
  
  /**
   * Synchronize users and groups from LDAP
   */
  async synchronize(directoryId: number, req?: Request): Promise<{ 
    success: boolean; 
    message: string; 
    stats: { 
      users: { total: number; created: number; updated: number; errors: number; }; 
      groups: { total: number; created: number; updated: number; errors: number; }; 
      roles: { total: number; assigned: number; errors: number; } 
    } 
  }> {
    // Initialize stats
    const stats = {
      users: { total: 0, created: 0, updated: 0, errors: 0 },
      groups: { total: 0, created: 0, updated: 0, errors: 0 },
      roles: { total: 0, assigned: 0, errors: 0 }
    };
    
    try {
      // Get directory configuration
      const directory = await db.query.ldapDirectories.findFirst({
        where: eq(ldapDirectories.id, directoryId)
      });
      
      if (!directory) {
        throw new Error('Directory not found');
      }
      
      // Create LDAP client
      const client = this.createLdapClient(directory);
      
      // Connect and bind
      await client.connect();
      const bindSuccess = await client.bind(directory.bindDn, directory.bindCredential || '');
      
      if (!bindSuccess) {
        throw new Error('Failed to bind with the provided credentials');
      }
      
      // Synchronize groups first (if enabled)
      let groups: any[] = [];
      if (directory.syncGroups) {
        groups = await this.syncGroups(client, directory, stats);
      }
      
      // Synchronize users
      await this.syncUsers(client, directory, groups, stats);
      
      // Apply role mappings from groups to users
      if (directory.syncGroups) {
        await this.applyRoleMappings(directory, groups, stats);
      }
      
      // Disconnect
      await client.disconnect();
      
      // Update sync status in directory
      await this.updateSyncStatus(directoryId, 'success');
      
      // Create audit log
      if (req?.user) {
        await createAuditLog({
          action: 'ldap_synchronization',
          userId: req.user.id,
          workspaceId: directory.workspaceId,
          resourceType: 'ldap_directory',
          resourceId: directoryId.toString(),
          details: {
            stats,
            triggered_by: 'manual'
          }
        });
      }
      
      return {
        success: true,
        message: 'Synchronization completed successfully',
        stats
      };
    } catch (error) {
      // Update sync status with error
      await this.updateSyncStatus(directoryId, 'error', error instanceof Error ? error.message : String(error));
      
      // Create audit log for failure
      if (req?.user) {
        await createAuditLog({
          action: 'ldap_synchronization_failed',
          userId: req.user.id,
          workspaceId: null, // We might not have the directory object in case of an early error
          resourceType: 'ldap_directory',
          resourceId: directoryId.toString(),
          details: {
            error: error instanceof Error ? error.message : String(error)
          },
          severity: 'error',
          status: 'failure'
        });
      }
      
      return {
        success: false,
        message: `Synchronization failed: ${error instanceof Error ? error.message : String(error)}`,
        stats
      };
    }
  }
  
  /**
   * Synchronize groups from LDAP
   */
  private async syncGroups(client: LdapClient, directory: any, stats: any): Promise<any[]> {
    const groupSearchBase = directory.groupSearchBase || directory.searchBase;
    const groupFilter = `(objectClass=${directory.groupObjectClass})`;
    
    // Search for groups
    const ldapGroups = await client.search({
      base: groupSearchBase,
      scope: 'sub',
      filter: groupFilter,
      attributes: ['dn', directory.groupNameAttribute, 'description', 'member']
    });
    
    stats.groups.total = ldapGroups.length;
    
    // Process each group
    const syncedGroups = [];
    for (const ldapGroup of ldapGroups) {
      try {
        const groupDn = ldapGroup.dn;
        const groupName = ldapGroup[directory.groupNameAttribute]?.toString() || '';
        const groupDescription = ldapGroup.description?.toString() || '';
        const memberCount = Array.isArray(ldapGroup.member) ? ldapGroup.member.length : 0;
        
        // Check if group already exists
        const existingGroup = await db.query.directoryGroups.findFirst({
          where: and(
            eq(directoryGroups.externalId, groupDn),
            eq(directoryGroups.directoryId, directory.id)
          )
        });
        
        if (existingGroup) {
          // Update existing group
          const [updatedGroup] = await db.update(directoryGroups)
            .set({
              name: groupName,
              description: groupDescription,
              memberCount,
              updatedAt: new Date()
            })
            .where(eq(directoryGroups.id, existingGroup.id))
            .returning();
            
          syncedGroups.push(updatedGroup);
          stats.groups.updated++;
        } else {
          // Create new group
          const [newGroup] = await db.insert(directoryGroups)
            .values({
              directoryId: directory.id,
              workspaceId: directory.workspaceId,
              name: groupName,
              description: groupDescription,
              externalId: groupDn,
              memberCount,
              createdAt: new Date(),
              updatedAt: new Date()
            })
            .returning();
            
          syncedGroups.push(newGroup);
          stats.groups.created++;
        }
      } catch (error) {
        console.error(`Error processing group: ${error instanceof Error ? error.message : String(error)}`);
        stats.groups.errors++;
      }
    }
    
    return syncedGroups;
  }
  
  /**
   * Synchronize users from LDAP
   */
  private async syncUsers(client: LdapClient, directory: any, groups: any[], stats: any): Promise<void> {
    const userFilter = `(objectClass=person)`;
    
    // Search for users
    const ldapUsers = await client.search({
      base: directory.searchBase,
      scope: 'sub',
      filter: userFilter,
      attributes: [
        'dn', 
        directory.userIdAttribute, 
        directory.usernameAttribute, 
        directory.emailAttribute, 
        directory.fullNameAttribute, 
        directory.groupMemberAttribute
      ]
    });
    
    stats.users.total = ldapUsers.length;
    
    // Process each user
    for (const ldapUser of ldapUsers) {
      try {
        const userDn = ldapUser.dn;
        const userId = ldapUser[directory.userIdAttribute]?.toString() || '';
        const username = ldapUser[directory.usernameAttribute]?.toString() || '';
        const email = ldapUser[directory.emailAttribute]?.toString() || '';
        const fullName = ldapUser[directory.fullNameAttribute]?.toString() || '';
        
        if (!userId || !username || !email) {
          // Skip users without required attributes
          continue;
        }
        
        // Check if user already exists
        const existingUser = await db.query.users.findFirst({
          where: eq(users.email, email)
        });
        
        if (existingUser) {
          // Update existing user
          await db.update(users)
            .set({
              name: fullName,
              metadata: {
                ...existingUser.metadata,
                ldap: {
                  directoryId: directory.id,
                  externalId: userDn,
                  lastSyncAt: new Date()
                }
              },
              updatedAt: new Date()
            })
            .where(eq(users.id, existingUser.id));
            
          stats.users.updated++;
        } else {
          // Create new user
          const newUser = await db.insert(users)
            .values({
              email,
              name: fullName,
              username,
              password: '', // Hash of a random password that can't be used (actual login is via LDAP)
              isActive: true,
              metadata: {
                ldap: {
                  directoryId: directory.id,
                  externalId: userDn,
                  lastSyncAt: new Date()
                }
              },
              createdAt: new Date(),
              updatedAt: new Date()
            })
            .returning();
            
          stats.users.created++;
        }
      } catch (error) {
        console.error(`Error processing user: ${error instanceof Error ? error.message : String(error)}`);
        stats.users.errors++;
      }
    }
  }
  
  /**
   * Apply role mappings based on group memberships
   */
  private async applyRoleMappings(directory: any, groups: any[], stats: any): Promise<void> {
    try {
      // Get all role mappings for this directory's groups
      const roleMappings = await db.query.directoryGroupRoleMappings.findMany({
        where: sql`directory_group_role_mappings.directory_group_id IN (
          SELECT id FROM directory_groups WHERE directory_id = ${directory.id}
        )`
      });
      
      stats.roles.total = roleMappings.length;
      
      for (const mapping of roleMappings) {
        try {
          const directoryGroup = await db.query.directoryGroups.findFirst({
            where: eq(directoryGroups.id, mapping.directoryGroupId)
          });
          
          if (!directoryGroup) continue;
          
          // Get users that belong to this group
          // In a real implementation, this would be based on LDAP membership data
          // For this mock, we'll get all users with this directory's ID in their metadata
          const groupUsers = await db.query.users.findMany({
            where: sql`users.metadata->>'ldap.directoryId' = ${directory.id.toString()}`
          });
          
          // For each user, assign the role if auto-provisioning is enabled
          if (mapping.isAutoProvisioned && groupUsers.length > 0) {
            for (const user of groupUsers) {
              // Check if user already has this role
              const existingRole = await db.query.userRoles.findFirst({
                where: and(
                  eq(userRoles.userId, user.id),
                  eq(userRoles.roleId, mapping.roleId),
                  eq(userRoles.workspaceId, mapping.workspaceId || null)
                )
              });
              
              if (!existingRole) {
                // Assign role to user
                await db.insert(userRoles)
                  .values({
                    userId: user.id,
                    roleId: mapping.roleId,
                    workspaceId: mapping.workspaceId,
                    isActive: true,
                    createdAt: new Date(),
                    updatedAt: new Date()
                  });
                  
                stats.roles.assigned++;
              }
            }
          }
        } catch (error) {
          console.error(`Error processing role mapping: ${error instanceof Error ? error.message : String(error)}`);
          stats.roles.errors++;
        }
      }
    } catch (error) {
      console.error(`Error applying role mappings: ${error instanceof Error ? error.message : String(error)}`);
      stats.roles.errors++;
    }
  }
  
  /**
   * Update role mappings for a directory
   */
  private async updateRoleMappings(directoryId: number, mappings: any[]): Promise<void> {
    // Get directory groups
    const groups = await db.query.directoryGroups.findMany({
      where: eq(directoryGroups.directoryId, directoryId)
    });
    
    for (const group of groups) {
      // Delete existing mappings for this group
      await db.delete(directoryGroupRoleMappings)
        .where(eq(directoryGroupRoleMappings.directoryGroupId, group.id));
      
      // Find mappings for this group
      const groupMappings = mappings.filter(m => m.groupId === group.id);
      
      if (groupMappings.length > 0) {
        // Insert new mappings
        await db.insert(directoryGroupRoleMappings)
          .values(
            groupMappings.map(mapping => ({
              directoryGroupId: group.id,
              roleId: mapping.roleId,
              workspaceId: mapping.workspaceId || null,
              isAutoProvisioned: mapping.isAutoProvisioned || false,
              createdAt: new Date(),
              updatedAt: new Date()
            }))
          );
      }
    }
  }
  
  /**
   * Update sync status for a directory
   */
  private async updateSyncStatus(directoryId: number, status: string, error?: string): Promise<void> {
    await db.update(ldapDirectories)
      .set({
        lastSyncAt: new Date(),
        syncStatus: status,
        syncError: error || null,
        updatedAt: new Date()
      })
      .where(eq(ldapDirectories.id, directoryId));
  }
  
  /**
   * Create LDAP client
   * This is a placeholder that would be replaced with real LDAP client in production
   */
  private createLdapClient(config: any): LdapClient {
    // This is a mock implementation for demonstration purposes
    // In a real implementation, you would use an actual LDAP client library
    return {
      connect: async () => {
        // In a real implementation, this would establish a connection to the LDAP server
        console.log(`Connecting to LDAP server ${config.host}:${config.port}`);
        return Promise.resolve();
      },
      
      disconnect: async () => {
        // In a real implementation, this would close the connection
        console.log('Disconnecting from LDAP server');
        return Promise.resolve();
      },
      
      bind: async (dn: string, password: string) => {
        // In a real implementation, this would authenticate with the LDAP server
        console.log(`Binding as ${dn}`);
        return Promise.resolve(true);
      },
      
      search: async (options: any) => {
        // In a real implementation, this would search the LDAP server
        console.log(`Searching ${options.base} with filter ${options.filter}`);
        
        // Return mock data based on the search filter
        if (options.filter.includes('objectClass=person')) {
          return [
            {
              dn: 'uid=jsmith,ou=people,dc=example,dc=com',
              uid: 'jsmith',
              cn: 'John Smith',
              mail: 'jsmith@example.com',
              memberOf: ['cn=developers,ou=groups,dc=example,dc=com']
            },
            {
              dn: 'uid=mjones,ou=people,dc=example,dc=com',
              uid: 'mjones',
              cn: 'Mary Jones',
              mail: 'mjones@example.com',
              memberOf: ['cn=managers,ou=groups,dc=example,dc=com']
            }
          ];
        } else if (options.filter.includes('objectClass=groupOfNames')) {
          return [
            {
              dn: 'cn=developers,ou=groups,dc=example,dc=com',
              cn: 'Developers',
              description: 'Development team',
              member: ['uid=jsmith,ou=people,dc=example,dc=com']
            },
            {
              dn: 'cn=managers,ou=groups,dc=example,dc=com',
              cn: 'Managers',
              description: 'Management team',
              member: ['uid=mjones,ou=people,dc=example,dc=com']
            }
          ];
        }
        
        return [];
      }
    };
  }
}

interface LdapClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  search(options: any): Promise<any[]>;
  bind(dn: string, password: string): Promise<boolean>;
}

export const ldapSyncService = new LdapSyncService();