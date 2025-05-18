/**
 * Directory Service
 * 
 * Provides integration with LDAP/Active Directory for user and group management.
 * Supports synchronization, search, and automatic provisioning.
 */

import { eq, and, or, ilike } from 'drizzle-orm';
import type { Request } from 'express';
import { createAuditLogFromRequest } from '../enhancedAuditService';
import { 
  directoryServices, 
  directoryGroups, 
  directoryUsers,
  directoryUserGroupMemberships,
  directoryGroupRoleMappings,
  directorySyncJobs,
  directorySyncLogs
} from '@shared/schema_directory';
import { users, roles, userRoles } from '@shared/schema';
import { storage } from '../../storage';
import { EventBus } from '../eventBusService';
import * as auditSchema from '@shared/schema_audit';

/**
 * Mock LDAP client for testing
 * In a real implementation, this would use the 'ldapjs' library
 */
class MockLdapClient {
  constructor(private config: any) {}

  async bind(): Promise<void> {
    console.log(`[MOCK LDAP] Binding to ${this.config.url} with ${this.config.bindDn}`);
    return Promise.resolve();
  }

  async search(base: string, options: any): Promise<any[]> {
    console.log(`[MOCK LDAP] Searching ${base} with filter: ${options.filter}`);
    
    // Return mock data based on search type
    if (base === this.config.searchBase) {
      // User search
      return Promise.resolve([
        { 
          dn: `uid=john.doe,${this.config.baseDn}`, 
          attributes: { 
            uid: 'john.doe', 
            cn: 'John Doe', 
            mail: 'john.doe@example.com',
            givenName: 'John',
            sn: 'Doe',
            title: 'Software Developer',
            department: 'Engineering',
            telephoneNumber: '+1234567890',
            objectClass: ['inetOrgPerson', 'organizationalPerson', 'person', 'top']
          }
        },
        { 
          dn: `uid=jane.smith,${this.config.baseDn}`, 
          attributes: { 
            uid: 'jane.smith', 
            cn: 'Jane Smith', 
            mail: 'jane.smith@example.com',
            givenName: 'Jane',
            sn: 'Smith',
            title: 'Product Manager',
            department: 'Product',
            telephoneNumber: '+1987654321',
            objectClass: ['inetOrgPerson', 'organizationalPerson', 'person', 'top']
          }
        },
        { 
          dn: `uid=admin.user,${this.config.baseDn}`, 
          attributes: { 
            uid: 'admin.user', 
            cn: 'Admin User', 
            mail: 'admin@example.com',
            givenName: 'Admin',
            sn: 'User',
            title: 'System Administrator',
            department: 'IT',
            telephoneNumber: '+1122334455',
            objectClass: ['inetOrgPerson', 'organizationalPerson', 'person', 'top']
          }
        }
      ]);
    } else if (base === this.config.groupSearchBase) {
      // Group search
      return Promise.resolve([
        { 
          dn: `cn=developers,${this.config.baseDn}`, 
          attributes: { 
            cn: 'developers', 
            description: 'Software Development Team',
            member: [
              `uid=john.doe,${this.config.baseDn}`,
              `uid=jane.smith,${this.config.baseDn}`
            ],
            objectClass: ['groupOfNames', 'top']
          }
        },
        { 
          dn: `cn=admins,${this.config.baseDn}`, 
          attributes: { 
            cn: 'admins', 
            description: 'System Administrators',
            member: [
              `uid=admin.user,${this.config.baseDn}`
            ],
            objectClass: ['groupOfNames', 'top']
          }
        },
        { 
          dn: `cn=product,${this.config.baseDn}`, 
          attributes: { 
            cn: 'product', 
            description: 'Product Management Team',
            member: [
              `uid=jane.smith,${this.config.baseDn}`
            ],
            objectClass: ['groupOfNames', 'top']
          }
        }
      ]);
    }

    return Promise.resolve([]);
  }

  unbind(): Promise<void> {
    console.log('[MOCK LDAP] Unbinding');
    return Promise.resolve();
  }
}

// Types for directory functions
type DirectoryClientType = MockLdapClient; // In production, use ldapjs.Client
type DirectoryUserSearchResult = {
  dn: string;
  externalId: string;
  username: string;
  firstName?: string;
  lastName?: string;
  fullName: string;
  email?: string;
  attributes: Record<string, any>;
};

type DirectoryGroupSearchResult = {
  dn: string;
  externalId: string;
  name: string;
  description?: string;
  members: string[]; // Array of user DNs
  attributes: Record<string, any>;
};

type DirectorySyncResult = {
  usersAdded: number;
  usersUpdated: number;
  usersRemoved: number;
  groupsAdded: number;
  groupsUpdated: number;
  groupsRemoved: number;
  usersProvisioned: number;
  mappingsCreated: number;
  errors: string[];
};

type DirectorySyncOptions = {
  fullSync?: boolean;
  provisionUsers?: boolean;
  syncGroups?: boolean;
  filterUsers?: string;
  filterGroups?: string;
  defaultRoleId?: number;
  defaultWorkspaceId?: number;
  mapGroupsToRoles?: boolean;
  req?: Request;
  initiatedBy?: number;
};

/**
 * Directory Service class for LDAP/AD integration
 */
export class DirectoryService {
  private client: DirectoryClientType | null = null;

  /**
   * Create a directory client
   */
  private async createClient(directoryServiceId: number): Promise<DirectoryClientType> {
    // Get directory service configuration
    const directoryService = await storage.getDirectoryService(directoryServiceId);

    if (!directoryService) {
      throw new Error(`Directory service ${directoryServiceId} not found`);
    }

    // In production, use ldapjs
    // const ldap = require('ldapjs');
    // return new ldap.Client({
    //   url: directoryService.url,
    //   tlsOptions: directoryService.tlsEnabled ? {
    //     ca: directoryService.caCertPath ? fs.readFileSync(directoryService.caCertPath) : undefined,
    //     cert: directoryService.tlsCertPath ? fs.readFileSync(directoryService.tlsCertPath) : undefined,
    //   } : undefined,
    //   timeout: directoryService.connectionTimeout,
    //   reconnect: true,
    // });

    // For demo/development, use mock client
    return new MockLdapClient(directoryService);
  }

  /**
   * Connect to directory service and bind with credentials
   */
  private async connect(directoryServiceId: number): Promise<DirectoryClientType> {
    const directoryService = await db.query.directoryServices.findFirst({
      where: eq(directoryServices.id, directoryServiceId)
    });

    if (!directoryService) {
      throw new Error(`Directory service ${directoryServiceId} not found`);
    }

    try {
      const client = await this.createClient(directoryServiceId);
      
      // Bind with service credentials if provided
      if (directoryService.bindDn && directoryService.bindCredentials) {
        await client.bind(directoryService.bindDn, directoryService.bindCredentials);
      } else {
        // Anonymous bind (typically limited access)
        await client.bind();
      }
      
      return client;
    } catch (error) {
      console.error(`Error connecting to directory service ${directoryServiceId}:`, error);
      
      // Log connection error to sync logs
      await this.updateDirectoryServiceStatus(
        directoryServiceId, 
        'error', 
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      throw error;
    }
  }

  /**
   * Update directory service status and last sync info
   */
  private async updateDirectoryServiceStatus(
    directoryServiceId: number,
    status: string,
    error?: string
  ): Promise<void> {
    await db.update(directoryServices)
      .set({
        lastSyncStatus: status,
        lastSyncError: error || null,
        lastSyncAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(directoryServices.id, directoryServiceId));
  }

  /**
   * Create a sync job record
   */
  private async createSyncJob(
    directoryServiceId: number,
    type: string,
    initiatedBy?: number
  ): Promise<number> {
    const [job] = await db.insert(directorySyncJobs)
      .values({
        directoryServiceId,
        status: 'running',
        type,
        initiatedBy: initiatedBy || null,
        startedAt: new Date(),
        stats: {}
      })
      .returning();
    
    return job.id;
  }

  /**
   * Log a sync event
   */
  private async logSyncEvent(
    jobId: number,
    level: 'info' | 'warning' | 'error',
    message: string,
    details?: any
  ): Promise<void> {
    await db.insert(directorySyncLogs)
      .values({
        jobId,
        level,
        message,
        details: details || null
      });
  }

  /**
   * Update sync job status and stats
   */
  private async updateSyncJobStatus(
    jobId: number,
    status: string,
    stats?: any,
    error?: string
  ): Promise<void> {
    await db.update(directorySyncJobs)
      .set({
        status,
        completedAt: new Date(),
        error: error || null,
        stats: stats || {}
      })
      .where(eq(directorySyncJobs.id, jobId));
  }

  /**
   * Search directory users
   */
  public async searchUsers(
    directoryServiceId: number,
    query: string
  ): Promise<DirectoryUserSearchResult[]> {
    const directoryService = await db.query.directoryServices.findFirst({
      where: eq(directoryServices.id, directoryServiceId)
    });

    if (!directoryService) {
      throw new Error(`Directory service ${directoryServiceId} not found`);
    }

    if (!directoryService.isEnabled) {
      throw new Error(`Directory service ${directoryServiceId} is not enabled`);
    }

    let client: DirectoryClientType | null = null;
    try {
      client = await this.connect(directoryServiceId);
      
      // Convert query to LDAP filter format
      const escapedQuery = query.replace(/[*()\\&|=!><~]/g, '');
      const filter = directoryService.searchFilter
        ? directoryService.searchFilter.replace('{query}', escapedQuery)
        : `(|(${directoryService.userIdAttribute || 'uid'}=*${escapedQuery}*)(${directoryService.userEmailAttribute || 'mail'}=*${escapedQuery}*)(${directoryService.userNameAttribute || 'cn'}=*${escapedQuery}*))`;
      
      const searchOptions = {
        filter,
        scope: 'sub',
        attributes: ['*']
      };
      
      const results = await client.search(directoryService.searchBase || directoryService.baseDn, searchOptions);
      
      // Map LDAP results to our format
      return results.map(entry => {
        const attrs = entry.attributes;
        const idAttr = directoryService.userIdAttribute || 'uid';
        const nameAttr = directoryService.userNameAttribute || 'cn';
        const emailAttr = directoryService.userEmailAttribute || 'mail';
        
        return {
          dn: entry.dn,
          externalId: attrs[idAttr] || entry.dn,
          username: attrs[idAttr] || '',
          firstName: attrs.givenName || attrs.gn || null,
          lastName: attrs.sn || null,
          fullName: attrs[nameAttr] || `${attrs.givenName || ''} ${attrs.sn || ''}`.trim(),
          email: attrs[emailAttr] || null,
          attributes: attrs
        };
      });
    } finally {
      if (client) {
        await client.unbind();
      }
    }
  }

  /**
   * Search directory groups
   */
  public async searchGroups(
    directoryServiceId: number,
    query: string
  ): Promise<DirectoryGroupSearchResult[]> {
    const directoryService = await db.query.directoryServices.findFirst({
      where: eq(directoryServices.id, directoryServiceId)
    });

    if (!directoryService) {
      throw new Error(`Directory service ${directoryServiceId} not found`);
    }

    if (!directoryService.isEnabled) {
      throw new Error(`Directory service ${directoryServiceId} is not enabled`);
    }

    let client: DirectoryClientType | null = null;
    try {
      client = await this.connect(directoryServiceId);
      
      // Convert query to LDAP filter format
      const escapedQuery = query.replace(/[*()\\&|=!><~]/g, '');
      const filter = directoryService.groupSearchFilter
        ? directoryService.groupSearchFilter.replace('{query}', escapedQuery)
        : `(${directoryService.groupIdAttribute || 'cn'}=*${escapedQuery}*)`;
      
      const searchOptions = {
        filter,
        scope: 'sub',
        attributes: ['*']
      };
      
      const results = await client.search(directoryService.groupSearchBase || directoryService.baseDn, searchOptions);
      
      // Map LDAP results to our format
      return results.map(entry => {
        const attrs = entry.attributes;
        const idAttr = directoryService.groupIdAttribute || 'cn';
        const memberAttr = directoryService.groupMemberAttribute || 'member';
        
        // Handle different group member formats (single value, array, or none)
        let members: string[] = [];
        if (attrs[memberAttr]) {
          members = Array.isArray(attrs[memberAttr]) 
            ? attrs[memberAttr] 
            : [attrs[memberAttr]];
        }
        
        return {
          dn: entry.dn,
          externalId: attrs[idAttr] || entry.dn,
          name: attrs[idAttr] || entry.dn.split(',')[0].split('=')[1],
          description: attrs.description || null,
          members,
          attributes: attrs
        };
      });
    } finally {
      if (client) {
        await client.unbind();
      }
    }
  }

  /**
   * Sync directory users and groups
   */
  public async syncDirectory(
    directoryServiceId: number,
    options: DirectorySyncOptions = {}
  ): Promise<DirectorySyncResult> {
    const directoryService = await db.query.directoryServices.findFirst({
      where: eq(directoryServices.id, directoryServiceId)
    });

    if (!directoryService) {
      throw new Error(`Directory service ${directoryServiceId} not found`);
    }

    if (!directoryService.isEnabled) {
      throw new Error(`Directory service ${directoryServiceId} is not enabled`);
    }

    // Default options
    const syncOptions: Required<DirectorySyncOptions> = {
      fullSync: options.fullSync || false,
      provisionUsers: options.provisionUsers || false,
      syncGroups: options.syncGroups !== false, // Default to true
      filterUsers: options.filterUsers || '',
      filterGroups: options.filterGroups || '',
      defaultRoleId: options.defaultRoleId || 0,
      defaultWorkspaceId: options.defaultWorkspaceId || 0,
      mapGroupsToRoles: options.mapGroupsToRoles || false,
      req: options.req || undefined,
      initiatedBy: options.initiatedBy || 0
    };

    // Create sync job record
    const jobId = await this.createSyncJob(
      directoryServiceId,
      syncOptions.fullSync ? 'full' : 'incremental',
      syncOptions.initiatedBy
    );

    await this.logSyncEvent(jobId, 'info', 'Directory sync started', { options: syncOptions });

    const result: DirectorySyncResult = {
      usersAdded: 0,
      usersUpdated: 0,
      usersRemoved: 0,
      groupsAdded: 0,
      groupsUpdated: 0,
      groupsRemoved: 0,
      usersProvisioned: 0,
      mappingsCreated: 0,
      errors: []
    };

    let client: DirectoryClientType | null = null;
    try {
      client = await this.connect(directoryServiceId);
      
      // 1. Sync users
      await this.logSyncEvent(jobId, 'info', 'Syncing users');
      const userFilter = syncOptions.filterUsers || 
        directoryService.searchFilter || 
        `(${directoryService.userIdAttribute || 'uid'}=*)`;
      
      const userSearchOptions = {
        filter: userFilter,
        scope: 'sub',
        attributes: ['*']
      };
      
      const userResults = await client.search(
        directoryService.searchBase || directoryService.baseDn, 
        userSearchOptions
      );
      
      // Process user results
      for (const entry of userResults) {
        try {
          const attrs = entry.attributes;
          const idAttr = directoryService.userIdAttribute || 'uid';
          const nameAttr = directoryService.userNameAttribute || 'cn';
          const emailAttr = directoryService.userEmailAttribute || 'mail';
          
          const externalId = attrs[idAttr] || entry.dn;
          const username = attrs[idAttr] || '';
          const email = attrs[emailAttr] || null;
          const firstName = attrs.givenName || attrs.gn || null;
          const lastName = attrs.sn || null;
          const fullName = attrs[nameAttr] || `${firstName || ''} ${lastName || ''}`.trim();
          
          // Check if user already exists in our directory
          const existingUser = await db.query.directoryUsers.findFirst({
            where: and(
              eq(directoryUsers.directoryServiceId, directoryServiceId),
              eq(directoryUsers.externalId, externalId)
            )
          });
          
          if (existingUser) {
            // Update existing user
            await db.update(directoryUsers)
              .set({
                username,
                email,
                firstName,
                lastName,
                attributes: attrs,
                dn: entry.dn,
                updatedAt: new Date(),
                lastSyncAt: new Date()
              })
              .where(eq(directoryUsers.id, existingUser.id));
            
            result.usersUpdated++;
          } else {
            // Create new directory user
            const newUser = {
              directoryServiceId,
              externalId,
              username,
              email,
              firstName,
              lastName,
              dn: entry.dn,
              attributes: attrs,
              isActive: true,
              isProvisioned: false,
              lastSyncAt: new Date()
            };
            
            await db.insert(directoryUsers).values(newUser);
            result.usersAdded++;
          }
          
          // Provision local user if requested
          if (syncOptions.provisionUsers) {
            await this.provisionUser(
              directoryServiceId, 
              externalId, 
              syncOptions.defaultRoleId, 
              syncOptions.defaultWorkspaceId,
              syncOptions.req
            );
            result.usersProvisioned++;
          }
        } catch (error) {
          console.error(`Error processing user ${entry.dn}:`, error);
          await this.logSyncEvent(jobId, 'error', `Error processing user ${entry.dn}`, { error });
          result.errors.push(error instanceof Error ? error.message : 'Unknown error');
        }
      }
      
      // 2. Sync groups if requested
      if (syncOptions.syncGroups) {
        await this.logSyncEvent(jobId, 'info', 'Syncing groups');
        const groupFilter = syncOptions.filterGroups || 
          directoryService.groupSearchFilter || 
          `(${directoryService.groupIdAttribute || 'cn'}=*)`;
        
        const groupSearchOptions = {
          filter: groupFilter,
          scope: 'sub',
          attributes: ['*']
        };
        
        const groupResults = await client.search(
          directoryService.groupSearchBase || directoryService.baseDn, 
          groupSearchOptions
        );
        
        // Process group results
        for (const entry of groupResults) {
          try {
            const attrs = entry.attributes;
            const idAttr = directoryService.groupIdAttribute || 'cn';
            const memberAttr = directoryService.groupMemberAttribute || 'member';
            
            const externalId = attrs[idAttr] || entry.dn;
            const name = attrs[idAttr] || entry.dn.split(',')[0].split('=')[1];
            const description = attrs.description || null;
            
            // Handle different group member formats
            let members: string[] = [];
            if (attrs[memberAttr]) {
              members = Array.isArray(attrs[memberAttr]) 
                ? attrs[memberAttr] 
                : [attrs[memberAttr]];
            }
            
            // Check if group already exists
            const existingGroup = await db.query.directoryGroups.findFirst({
              where: and(
                eq(directoryGroups.directoryServiceId, directoryServiceId),
                eq(directoryGroups.externalId, externalId)
              )
            });
            
            let groupId: number;
            
            if (existingGroup) {
              // Update existing group
              await db.update(directoryGroups)
                .set({
                  name,
                  description,
                  dn: entry.dn,
                  attributes: attrs,
                  memberCount: members.length,
                  updatedAt: new Date(),
                  lastSyncAt: new Date()
                })
                .where(eq(directoryGroups.id, existingGroup.id));
              
              groupId = existingGroup.id;
              result.groupsUpdated++;
            } else {
              // Create new group
              const newGroup = {
                directoryServiceId,
                externalId,
                name,
                description,
                dn: entry.dn,
                attributes: attrs,
                memberCount: members.length,
                lastSyncAt: new Date()
              };
              
              const [insertedGroup] = await db.insert(directoryGroups).values(newGroup).returning();
              groupId = insertedGroup.id;
              result.groupsAdded++;
            }
            
            // Clear existing memberships for this group
            await db.delete(directoryUserGroupMemberships)
              .where(
                eq(directoryUserGroupMemberships.directoryGroupId, groupId)
              );
            
            // Add group memberships
            for (const memberDn of members) {
              // Find directory user by DN
              const directoryUser = await db.query.directoryUsers.findFirst({
                where: and(
                  eq(directoryUsers.directoryServiceId, directoryServiceId),
                  eq(directoryUsers.dn, memberDn)
                )
              });
              
              if (directoryUser) {
                await db.insert(directoryUserGroupMemberships).values({
                  directoryUserId: directoryUser.id,
                  directoryGroupId: groupId
                });
              }
            }
            
            // Map group to role if requested
            if (syncOptions.mapGroupsToRoles && syncOptions.defaultRoleId) {
              const existingMapping = await db.query.directoryGroupRoleMappings.findFirst({
                where: and(
                  eq(directoryGroupRoleMappings.directoryGroupId, groupId),
                  eq(directoryGroupRoleMappings.roleId, syncOptions.defaultRoleId)
                )
              });
              
              if (!existingMapping) {
                await db.insert(directoryGroupRoleMappings).values({
                  directoryGroupId: groupId,
                  roleId: syncOptions.defaultRoleId,
                  workspaceId: syncOptions.defaultWorkspaceId || null,
                  isAutoProvisioned: true,
                  createdById: syncOptions.initiatedBy || null,
                });
                
                result.mappingsCreated++;
              }
            }
          } catch (error) {
            console.error(`Error processing group ${entry.dn}:`, error);
            await this.logSyncEvent(jobId, 'error', `Error processing group ${entry.dn}`, { error });
            result.errors.push(error instanceof Error ? error.message : 'Unknown error');
          }
        }
      }
      
      // Update sync status
      await this.updateDirectoryServiceStatus(directoryServiceId, 'success');
      await this.updateSyncJobStatus(jobId, 'completed', result);
      await this.logSyncEvent(jobId, 'info', 'Directory sync completed', result);
      
      // Fire event
      eventBus.emit('directory.sync.completed', {
        directoryServiceId,
        result
      });
      
      return result;
    } catch (error) {
      console.error(`Error syncing directory ${directoryServiceId}:`, error);
      
      // Update sync status
      await this.updateDirectoryServiceStatus(
        directoryServiceId, 
        'error',
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      await this.updateSyncJobStatus(
        jobId,
        'failed',
        result,
        error instanceof Error ? error.message : 'Unknown error'
      );
      
      await this.logSyncEvent(jobId, 'error', 'Directory sync failed', { error });
      
      // Fire event
      eventBus.emit('directory.sync.failed', {
        directoryServiceId,
        error
      });
      
      throw error;
    } finally {
      if (client) {
        await client.unbind();
      }
    }
  }

  /**
   * Provision a user from directory to local system
   */
  public async provisionUser(
    directoryServiceId: number,
    externalId: string,
    defaultRoleId?: number,
    defaultWorkspaceId?: number,
    req?: Request
  ): Promise<void> {
    // Get directory user
    const directoryUser = await db.query.directoryUsers.findFirst({
      where: and(
        eq(directoryUsers.directoryServiceId, directoryServiceId),
        eq(directoryUsers.externalId, externalId)
      )
    });

    if (!directoryUser) {
      throw new Error(`Directory user ${externalId} not found`);
    }

    // Check if already provisioned
    if (directoryUser.isProvisioned && directoryUser.userId) {
      return;
    }

    // Create local user
    const username = directoryUser.username;
    const email = directoryUser.email;
    const fullName = `${directoryUser.firstName || ''} ${directoryUser.lastName || ''}`.trim() || username;

    // Check if user already exists by username or email
    const existingUser = username 
      ? await storage.getUserByUsername(username)
      : email
        ? await storage.getUserByEmail(email)
        : null;

    if (existingUser) {
      // Link existing user to directory user
      await db.update(directoryUsers)
        .set({
          userId: existingUser.id,
          isProvisioned: true,
          updatedAt: new Date()
        })
        .where(eq(directoryUsers.id, directoryUser.id));

      // No need to create a new user
      return;
    }

    // Create new user
    const newUser = await storage.createUser({
      username: username || `dir_${Date.now()}`,
      email: email || null,
      fullName: fullName || null,
      password: null, // No password for directory users
      isActive: true,
      externalIds: { [directoryServiceId.toString()]: externalId }
    });

    // Update directory user with link to local user
    await db.update(directoryUsers)
      .set({
        userId: newUser.id,
        isProvisioned: true,
        updatedAt: new Date()
      })
      .where(eq(directoryUsers.id, directoryUser.id));

    // Assign default role if provided
    if (defaultRoleId) {
      await storage.assignRoleToUser(newUser.id, defaultRoleId, defaultWorkspaceId);
    }

    // Assign workspace if provided
    if (defaultWorkspaceId) {
      await storage.addUserToWorkspace(newUser.id, defaultWorkspaceId);
    }

    // Assign roles based on group memberships
    const userGroupMemberships = await db.query.directoryUserGroupMemberships.findMany({
      where: eq(directoryUserGroupMemberships.directoryUserId, directoryUser.id),
      with: {
        directoryGroup: true
      }
    });

    for (const membership of userGroupMemberships) {
      const roleMappings = await db.query.directoryGroupRoleMappings.findMany({
        where: eq(directoryGroupRoleMappings.directoryGroupId, membership.directoryGroupId)
      });

      for (const mapping of roleMappings) {
        await storage.assignRoleToUser(newUser.id, mapping.roleId, mapping.workspaceId);
      }
    }

    // Create audit log
    if (req) {
      await createAuditLogFromRequest(req, 'user.provisioned', {
        userId: newUser.id,
        username: newUser.username,
        directoryServiceId,
        externalId
      });
    } else {
      // Create audit log without request context
      await db.insert(auditSchema.enhancedAuditLogs).values({
        action: 'user.provisioned',
        resourceType: 'user',
        resourceId: newUser.id.toString(),
        eventDetails: {
          userId: newUser.id,
          username: newUser.username,
          directoryServiceId,
          externalId
        },
        source: 'directory_service',
        createdAt: new Date()
      });
    }
  }

  /**
   * Get directory service by ID
   */
  public async getDirectoryService(id: number): Promise<any> {
    return await db.query.directoryServices.findFirst({
      where: eq(directoryServices.id, id)
    });
  }

  /**
   * Get all directory services
   */
  public async getAllDirectoryServices(workspaceId?: number): Promise<any[]> {
    if (workspaceId) {
      return await db.query.directoryServices.findMany({
        where: eq(directoryServices.workspaceId, workspaceId)
      });
    }
    return await db.query.directoryServices.findMany();
  }

  /**
   * Create a directory service
   */
  public async createDirectoryService(
    data: any,
    createdById?: number
  ): Promise<any> {
    const [directoryService] = await db.insert(directoryServices)
      .values({
        ...data,
        createdById: createdById || null,
        updatedById: createdById || null
      })
      .returning();
    
    return directoryService;
  }

  /**
   * Update a directory service
   */
  public async updateDirectoryService(
    id: number,
    data: any,
    updatedById?: number
  ): Promise<any> {
    const [directoryService] = await db.update(directoryServices)
      .set({
        ...data,
        updatedById: updatedById || null,
        updatedAt: new Date()
      })
      .where(eq(directoryServices.id, id))
      .returning();
    
    return directoryService;
  }

  /**
   * Delete a directory service
   */
  public async deleteDirectoryService(id: number): Promise<void> {
    // Delete all related records
    await db.delete(directoryGroupRoleMappings)
      .where(
        eq(directoryGroupRoleMappings.directoryGroupId, 
          db.select({ id: directoryGroups.id })
            .from(directoryGroups)
            .where(eq(directoryGroups.directoryServiceId, id))
        )
      );
    
    await db.delete(directoryUserGroupMemberships)
      .where(
        or(
          eq(directoryUserGroupMemberships.directoryGroupId,
            db.select({ id: directoryGroups.id })
              .from(directoryGroups)
              .where(eq(directoryGroups.directoryServiceId, id))
          ),
          eq(directoryUserGroupMemberships.directoryUserId,
            db.select({ id: directoryUsers.id })
              .from(directoryUsers)
              .where(eq(directoryUsers.directoryServiceId, id))
          )
        )
      );
    
    await db.delete(directoryGroups)
      .where(eq(directoryGroups.directoryServiceId, id));
    
    await db.delete(directoryUsers)
      .where(eq(directoryUsers.directoryServiceId, id));
    
    await db.delete(directorySyncLogs)
      .where(
        eq(directorySyncLogs.jobId,
          db.select({ id: directorySyncJobs.id })
            .from(directorySyncJobs)
            .where(eq(directorySyncJobs.directoryServiceId, id))
        )
      );
    
    await db.delete(directorySyncJobs)
      .where(eq(directorySyncJobs.directoryServiceId, id));
    
    // Finally delete the directory service
    await db.delete(directoryServices)
      .where(eq(directoryServices.id, id));
  }

  /**
   * Get directory sync jobs for a directory service
   */
  public async getDirectorySyncJobs(directoryServiceId: number): Promise<any[]> {
    return await db.query.directorySyncJobs.findMany({
      where: eq(directorySyncJobs.directoryServiceId, directoryServiceId),
      orderBy: (jobs, { desc }) => [desc(jobs.startedAt)],
      with: {
        initiator: true
      }
    });
  }

  /**
   * Get directory users for a directory service
   */
  public async getDirectoryUsers(
    directoryServiceId: number,
    filter?: string
  ): Promise<any[]> {
    let query = db.select()
      .from(directoryUsers)
      .where(eq(directoryUsers.directoryServiceId, directoryServiceId));
    
    if (filter) {
      query = query.where(
        or(
          ilike(directoryUsers.username, `%${filter}%`),
          ilike(directoryUsers.email, `%${filter}%`),
          ilike(directoryUsers.firstName, `%${filter}%`),
          ilike(directoryUsers.lastName, `%${filter}%`)
        )
      );
    }
    
    return await query;
  }

  /**
   * Get directory groups for a directory service
   */
  public async getDirectoryGroups(
    directoryServiceId: number,
    filter?: string
  ): Promise<any[]> {
    let query = db.select()
      .from(directoryGroups)
      .where(eq(directoryGroups.directoryServiceId, directoryServiceId));
    
    if (filter) {
      query = query.where(
        or(
          ilike(directoryGroups.name, `%${filter}%`),
          ilike(directoryGroups.description, `%${filter}%`)
        )
      );
    }
    
    return await query;
  }
}

// Create and export an instance
export const directoryService = new DirectoryService();