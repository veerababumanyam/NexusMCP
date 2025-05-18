/**
 * Directory Service
 * 
 * Provides integration with LDAP/Active Directory for user and group management.
 * Supports synchronization, search, and automatic provisioning.
 */

import { eq, and, or, ilike } from 'drizzle-orm';
import type { Request } from 'express';
import { 
  directoryServices, 
  directoryGroups, 
  directoryUsers,
  directoryUserGroupMemberships,
  directoryGroupRoleMappings,
  directorySyncJobs,
  directorySyncLogs,
  DirectoryService as DirectoryServiceType
} from '@shared/schema_directory';
import { users, roles, userRoles } from '@shared/schema';
import { storage } from '../storage';
import { EventBus } from './eventBusService';

/**
 * Directory Service class for LDAP/AD integration
 */
class DirectoryService {
  /**
   * Get all directory services
   */
  async getAllDirectoryServices(workspaceId?: number): Promise<DirectoryServiceType[]> {
    try {
      if (workspaceId) {
        return await storage.getDirectoryServicesByWorkspace(workspaceId);
      } else {
        return await storage.getAllDirectoryServices();
      }
    } catch (error) {
      console.error('Error fetching directory services:', error);
      return [];
    }
  }

  /**
   * Get a directory service by ID
   */
  async getDirectoryService(id: number): Promise<DirectoryServiceType | null> {
    try {
      return await storage.getDirectoryService(id);
    } catch (error) {
      console.error(`Error fetching directory service ${id}:`, error);
      return null;
    }
  }

  /**
   * Create a new directory service
   */
  async createDirectoryService(
    data: any,
    userId?: number
  ): Promise<DirectoryServiceType> {
    try {
      const directoryService = await storage.createDirectoryService(data);
      
      // Log event
      EventBus.getInstance().emit('directory.service.created', {
        directoryServiceId: directoryService.id,
        userId,
        name: directoryService.name,
        type: directoryService.type
      });
      
      return directoryService;
    } catch (error) {
      console.error('Error creating directory service:', error);
      throw error;
    }
  }

  /**
   * Update a directory service
   */
  async updateDirectoryService(
    id: number,
    data: any,
    userId?: number
  ): Promise<DirectoryServiceType> {
    try {
      const directoryService = await storage.updateDirectoryService(id, data);
      
      // Log event
      EventBus.getInstance().emit('directory.service.updated', {
        directoryServiceId: id,
        userId,
        name: directoryService.name,
        updatedFields: Object.keys(data)
      });
      
      return directoryService;
    } catch (error) {
      console.error(`Error updating directory service ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete a directory service
   */
  async deleteDirectoryService(id: number): Promise<void> {
    try {
      await storage.deleteDirectoryService(id);
      
      // Log event
      EventBus.getInstance().emit('directory.service.deleted', {
        directoryServiceId: id
      });
    } catch (error) {
      console.error(`Error deleting directory service ${id}:`, error);
      throw error;
    }
  }

  /**
   * Search directory users
   */
  async searchUsers(directoryServiceId: number, query: string): Promise<any[]> {
    try {
      // In a real implementation, this would query the LDAP server
      // Here we'll return mock data for demonstration
      return [
        {
          dn: "uid=john.doe,ou=users,dc=example,dc=com",
          externalId: "john.doe",
          username: "john.doe",
          firstName: "John",
          lastName: "Doe",
          fullName: "John Doe",
          email: "john.doe@example.com",
          attributes: {
            uid: "john.doe",
            cn: "John Doe",
            mail: "john.doe@example.com",
            givenName: "John",
            sn: "Doe",
            title: "Software Developer",
            department: "Engineering"
          }
        },
        {
          dn: "uid=jane.smith,ou=users,dc=example,dc=com",
          externalId: "jane.smith",
          username: "jane.smith",
          firstName: "Jane",
          lastName: "Smith",
          fullName: "Jane Smith",
          email: "jane.smith@example.com",
          attributes: {
            uid: "jane.smith",
            cn: "Jane Smith",
            mail: "jane.smith@example.com",
            givenName: "Jane",
            sn: "Smith",
            title: "Product Manager",
            department: "Product"
          }
        }
      ].filter(user => {
        if (query === '*') return true;
        
        const searchTerms = query.toLowerCase().split(' ');
        return searchTerms.some(term => 
          user.username.toLowerCase().includes(term) ||
          user.fullName.toLowerCase().includes(term) ||
          user.email.toLowerCase().includes(term)
        );
      });
    } catch (error) {
      console.error(`Error searching directory users for ${directoryServiceId}:`, error);
      throw error;
    }
  }

  /**
   * Get directory users
   */
  async getDirectoryUsers(directoryServiceId: number, filter?: string): Promise<any[]> {
    try {
      return await storage.getDirectoryUsers(directoryServiceId, filter);
    } catch (error) {
      console.error(`Error fetching directory users for ${directoryServiceId}:`, error);
      return [];
    }
  }

  /**
   * Search directory groups
   */
  async searchGroups(directoryServiceId: number, query: string): Promise<any[]> {
    try {
      // In a real implementation, this would query the LDAP server
      // Here we'll return mock data for demonstration
      return [
        {
          dn: "cn=developers,ou=groups,dc=example,dc=com",
          externalId: "developers",
          name: "Developers",
          description: "Software Development Team",
          members: [
            "uid=john.doe,ou=users,dc=example,dc=com",
            "uid=jane.smith,ou=users,dc=example,dc=com"
          ],
          attributes: {
            cn: "developers",
            description: "Software Development Team"
          }
        },
        {
          dn: "cn=product,ou=groups,dc=example,dc=com",
          externalId: "product",
          name: "Product",
          description: "Product Management Team",
          members: [
            "uid=jane.smith,ou=users,dc=example,dc=com"
          ],
          attributes: {
            cn: "product",
            description: "Product Management Team"
          }
        }
      ].filter(group => {
        if (query === '*') return true;
        
        const searchTerms = query.toLowerCase().split(' ');
        return searchTerms.some(term => 
          group.name.toLowerCase().includes(term) ||
          (group.description && group.description.toLowerCase().includes(term))
        );
      });
    } catch (error) {
      console.error(`Error searching directory groups for ${directoryServiceId}:`, error);
      throw error;
    }
  }
  
  /**
   * Get directory groups
   */
  async getDirectoryGroups(directoryServiceId: number, filter?: string): Promise<any[]> {
    try {
      return await storage.getDirectoryGroups(directoryServiceId, filter);
    } catch (error) {
      console.error(`Error fetching directory groups for ${directoryServiceId}:`, error);
      return [];
    }
  }

  /**
   * Sync a directory
   */
  async syncDirectory(directoryServiceId: number, options: any = {}): Promise<any> {
    try {
      // Create sync job
      const jobId = await storage.createDirectorySyncJob(directoryServiceId, options);
      
      // In a real implementation, this would:
      // 1. Connect to the LDAP server
      // 2. Query users and groups
      // 3. Create, update, or delete local records
      // 4. Provision users if requested
      // 5. Map groups to roles if requested
      
      // For demo/development, we'll just simulate a successful sync
      const result = {
        usersAdded: 5,
        usersUpdated: 2,
        usersRemoved: 0,
        groupsAdded: 3,
        groupsUpdated: 1,
        groupsRemoved: 0,
        usersProvisioned: options.provisionUsers ? 3 : 0,
        mappingsCreated: options.mapGroupsToRoles ? 2 : 0,
        errors: []
      };
      
      // Update job status
      await storage.updateDirectorySyncJobStatus(jobId, 'completed', result);
      
      // Log event
      EventBus.getInstance().emit('directory.sync.completed', {
        directoryServiceId,
        jobId,
        result
      });
      
      return result;
    } catch (error) {
      console.error(`Error syncing directory ${directoryServiceId}:`, error);
      
      // Log error event
      EventBus.getInstance().emit('directory.sync.failed', {
        directoryServiceId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      throw error;
    }
  }

  /**
   * Get sync jobs for a directory service
   */
  async getDirectorySyncJobs(directoryServiceId: number): Promise<any[]> {
    try {
      return await storage.getDirectorySyncJobs(directoryServiceId);
    } catch (error) {
      console.error(`Error fetching sync jobs for directory service ${directoryServiceId}:`, error);
      return [];
    }
  }

  /**
   * Provision a user from directory
   */
  async provisionUser(
    directoryServiceId: number,
    externalId: string,
    roleId?: number,
    workspaceId?: number,
    req?: Request
  ): Promise<any> {
    try {
      // In a real implementation, this would:
      // 1. Get the directory user record
      // 2. Create a local user account
      // 3. Assign roles and workspaces
      
      // For demo/development, we'll simulate provisioning
      const user = await storage.provisionDirectoryUser(
        directoryServiceId,
        externalId,
        roleId,
        workspaceId
      );
      
      // Log event if request object is provided
      if (req) {
        const auditDetails = {
          userId: req.user?.id,
          username: user.username,
          directoryServiceId,
          externalId
        };
        
        // Create audit log
        await storage.createAuditLog({
          userId: req.user?.id,
          action: 'create',
          resourceType: 'user',
          resourceId: user.id.toString(),
          details: auditDetails,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] || 'unknown'
        });
      }
      
      return user;
    } catch (error) {
      console.error(`Error provisioning user ${externalId} from directory ${directoryServiceId}:`, error);
      throw error;
    }
  }
}

export const directoryService = new DirectoryService();