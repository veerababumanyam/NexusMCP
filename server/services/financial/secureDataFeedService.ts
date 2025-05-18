/**
 * Secure Data Feed Service
 * 
 * Provides a secure interface for financial data sources with:
 * - Client-specific access permissions and data segregation
 * - Data classification and handling controls
 * - Fine-grained access filtering
 * - Comprehensive audit logging
 * - Real-time monitoring and alerts
 */

import { db } from '../../../db';
import { 
  financialDataSources,
  financialDataPermissions,
  financialInstruments,
  financialAuditTraces
} from '../../../shared/schema_financial';
import { roles, users, userRoles, workspaces } from '../../../shared/schema';
import { and, eq, inArray, like, or, sql } from 'drizzle-orm';
import { eventBus } from '../../eventBus';
import { secureAuditService as auditService } from '../audit/SecureAuditService';

interface DataFeedOptions {
  userId: number;
  workspaceId?: number;
  permissionLevel?: string;
  dataClassification?: string[];
  userRoles?: number[];
  sessionId?: string;
  requestId?: string;
}

interface DataQueryOptions extends DataFeedOptions {
  sourceId?: number;
  sourceName?: string;
  sourceType?: string;
  filters?: Record<string, any>;
  limit?: number;
  offset?: number;
}

/**
 * Secure Data Feed Service
 * Manages access to financial data sources with client-specific permissions
 */
export class SecureDataFeedService {
  /**
   * Get accessible data sources for the current user
   */
  public async getAccessibleDataSources(
    options: DataFeedOptions
  ): Promise<Array<typeof financialDataSources.$inferSelect>> {
    try {
      // Get user's permissions
      const permissions = await this.getUserDataPermissions(options);
      
      if (permissions.length === 0) {
        return [];
      }
      
      // Extract source IDs from permissions
      const sourceIds = [...new Set(permissions.map(p => p.sourceId))];
      
      // Fetch the actual data sources
      const sources = await db.query.financialDataSources.findMany({
        where: inArray(financialDataSources.id, sourceIds),
        orderBy: [
          { column: financialDataSources.name, order: 'asc' }
        ]
      });
      
      return sources;
    } catch (error) {
      console.error('Error getting accessible data sources:', error);
      return [];
    }
  }

  /**
   * Query data from a specific financial data source
   * This is a placeholder - actual implementation would connect to external data sources
   */
  public async queryDataSource(
    options: DataQueryOptions
  ): Promise<{ data: any[], metadata: any }> {
    try {
      // Verify user has permission to access this source
      const hasPermission = await this.verifyDataSourceAccess(
        options.userId,
        options.sourceId,
        options.permissionLevel || 'read',
        options.workspaceId
      );
      
      if (!hasPermission) {
        throw new Error('Access denied: Insufficient permissions for this data source');
      }
      
      // Get data source details
      const dataSource = await db.query.financialDataSources.findFirst({
        where: eq(financialDataSources.id, options.sourceId)
      });
      
      if (!dataSource) {
        throw new Error('Data source not found');
      }
      
      // Apply client-specific data filters
      const permissionFilters = await this.getDataFilters(
        options.userId,
        options.sourceId,
        options.workspaceId
      );
      
      // Combine user-provided filters with permission-based filters
      const combinedFilters = {
        ...permissionFilters,
        ...options.filters
      };

      // Record the data access in the audit log
      await this.recordDataAccess(options, dataSource, combinedFilters);
      
      // Fetch data from the source
      // In a real implementation, this would make API calls to external systems
      // For demonstration, we'll return mock data based on the source type
      const result = await this.fetchExternalData(dataSource, combinedFilters, options);
      
      return result;
    } catch (error) {
      console.error('Error querying data source:', error);
      
      // Record the failed access attempt
      if (options.sourceId) {
        await this.recordFailedDataAccess(options, error.message);
      }
      
      throw error;
    }
  }

  /**
   * Verify a user has permission to access a data source
   */
  private async verifyDataSourceAccess(
    userId: number,
    sourceId: number,
    permissionLevel: string = 'read',
    workspaceId?: number
  ): Promise<boolean> {
    try {
      // Check for direct user permission
      const userPermission = await db.query.financialDataPermissions.findFirst({
        where: and(
          eq(financialDataPermissions.userId, userId),
          eq(financialDataPermissions.sourceId, sourceId),
          workspaceId ? eq(financialDataPermissions.workspaceId, workspaceId) : sql`1=1`,
        )
      });
      
      if (userPermission) {
        // Check permission level is sufficient
        return this.isPermissionSufficient(userPermission.permissionLevel, permissionLevel);
      }
      
      // Check for role-based permissions
      const userRoleIds = await this.getUserRoleIds(userId, workspaceId);
      
      if (userRoleIds.length === 0) {
        return false;
      }
      
      const rolePermissions = await db.query.financialDataPermissions.findMany({
        where: and(
          eq(financialDataPermissions.sourceId, sourceId),
          inArray(financialDataPermissions.roleId, userRoleIds),
          workspaceId ? eq(financialDataPermissions.workspaceId, workspaceId) : sql`1=1`,
        )
      });
      
      if (rolePermissions.length === 0) {
        return false;
      }
      
      // Check if any of the role permissions is sufficient
      return rolePermissions.some(rp => 
        this.isPermissionSufficient(rp.permissionLevel, permissionLevel)
      );
    } catch (error) {
      console.error('Error verifying data source access:', error);
      return false;
    }
  }

  /**
   * Check if a given permission level is sufficient for the requested level
   */
  private isPermissionSufficient(
    actualLevel: string,
    requestedLevel: string
  ): boolean {
    const levels = {
      'read': 1,
      'write': 2,
      'admin': 3
    };
    
    const actualValue = levels[actualLevel.toLowerCase()] || 0;
    const requestedValue = levels[requestedLevel.toLowerCase()] || 0;
    
    return actualValue >= requestedValue;
  }

  /**
   * Get all user's role IDs
   */
  private async getUserRoleIds(
    userId: number,
    workspaceId?: number
  ): Promise<number[]> {
    try {
      const userRolesData = await db.query.userRoles.findMany({
        where: and(
          eq(userRoles.userId, userId),
          workspaceId ? eq(userRoles.workspaceId, workspaceId) : sql`1=1`
        )
      });
      
      return userRolesData.map(ur => ur.roleId);
    } catch (error) {
      console.error('Error getting user role IDs:', error);
      return [];
    }
  }

  /**
   * Get user's data permissions
   */
  private async getUserDataPermissions(
    options: DataFeedOptions
  ): Promise<Array<typeof financialDataPermissions.$inferSelect>> {
    try {
      const userId = options.userId;
      const workspaceId = options.workspaceId;
      
      // Get direct user permissions
      const userConditions = [
        eq(financialDataPermissions.userId, userId)
      ];
      
      if (workspaceId) {
        userConditions.push(eq(financialDataPermissions.workspaceId, workspaceId));
      }
      
      const userPermissions = await db.query.financialDataPermissions.findMany({
        where: and(...userConditions)
      });
      
      // Get role-based permissions
      const userRoleIds = await this.getUserRoleIds(userId, workspaceId);
      
      if (userRoleIds.length === 0) {
        return userPermissions;
      }
      
      const roleConditions = [
        inArray(financialDataPermissions.roleId, userRoleIds)
      ];
      
      if (workspaceId) {
        roleConditions.push(eq(financialDataPermissions.workspaceId, workspaceId));
      }
      
      const rolePermissions = await db.query.financialDataPermissions.findMany({
        where: and(...roleConditions)
      });
      
      // Combine permissions, giving priority to direct user permissions
      const allPermissions = [...userPermissions];
      
      // Add role permissions only if there's no direct user permission for the same source
      for (const rolePermission of rolePermissions) {
        if (!allPermissions.some(p => p.sourceId === rolePermission.sourceId)) {
          allPermissions.push(rolePermission);
        }
      }
      
      return allPermissions;
    } catch (error) {
      console.error('Error getting user data permissions:', error);
      return [];
    }
  }

  /**
   * Get data filters for a user and data source
   */
  private async getDataFilters(
    userId: number,
    sourceId: number,
    workspaceId?: number
  ): Promise<Record<string, any>> {
    try {
      // Get user's permission for this source
      const userPermission = await db.query.financialDataPermissions.findFirst({
        where: and(
          eq(financialDataPermissions.userId, userId),
          eq(financialDataPermissions.sourceId, sourceId),
          workspaceId ? eq(financialDataPermissions.workspaceId, workspaceId) : sql`1=1`
        )
      });
      
      if (userPermission?.dataFilters) {
        return userPermission.dataFilters as Record<string, any>;
      }
      
      // Check for role-based permissions
      const userRoleIds = await this.getUserRoleIds(userId, workspaceId);
      
      if (userRoleIds.length === 0) {
        return {};
      }
      
      const rolePermissions = await db.query.financialDataPermissions.findMany({
        where: and(
          eq(financialDataPermissions.sourceId, sourceId),
          inArray(financialDataPermissions.roleId, userRoleIds),
          workspaceId ? eq(financialDataPermissions.workspaceId, workspaceId) : sql`1=1`
        )
      });
      
      if (rolePermissions.length === 0) {
        return {};
      }
      
      // Combine filters from all applicable roles
      // In a real system, this would use more sophisticated logic
      // to merge filters safely based on business rules
      const combinedFilters = {};
      
      for (const rolePermission of rolePermissions) {
        if (rolePermission.dataFilters) {
          Object.assign(combinedFilters, rolePermission.dataFilters);
        }
      }
      
      return combinedFilters;
    } catch (error) {
      console.error('Error getting data filters:', error);
      return {};
    }
  }

  /**
   * Record data access in audit trail
   */
  private async recordDataAccess(
    options: DataQueryOptions,
    dataSource: typeof financialDataSources.$inferSelect,
    filters: Record<string, any>
  ): Promise<void> {
    try {
      // Create audit log entry
      await auditService.createAuditLog({
        userId: options.userId,
        action: 'data.access',
        resourceType: 'financial_data_source',
        resourceId: String(dataSource.id),
        details: {
          dataSourceName: dataSource.name,
          dataSourceType: dataSource.sourceType,
          provider: dataSource.provider,
          filters: filters,
          sessionId: options.sessionId,
          requestId: options.requestId
        },
        workspaceId: options.workspaceId
      });
      
      // Create detailed trace for financial audit
      await db.insert(financialAuditTraces).values({
        sessionId: options.sessionId,
        requestId: options.requestId,
        userId: options.userId,
        sourceDataPoints: {
          dataSourceId: dataSource.id,
          dataSourceName: dataSource.name,
          dataSourceType: dataSource.sourceType,
          provider: dataSource.provider,
          accessTimestamp: new Date().toISOString(),
          filters: filters
        },
        reasoning: 'Data source access',
        outcome: 'Query executed',
        timestamp: new Date(),
        workspaceId: options.workspaceId,
        metadata: {
          userAgent: 'SecureDataFeedService',
          permissionLevel: options.permissionLevel || 'read'
        }
      });
      
      // Emit event for real-time monitoring
      eventBus.emit('data.accessed', {
        userId: options.userId,
        dataSourceId: dataSource.id,
        dataSourceName: dataSource.name,
        workspaceId: options.workspaceId,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error recording data access:', error);
    }
  }

  /**
   * Record failed data access attempts
   */
  private async recordFailedDataAccess(
    options: DataQueryOptions,
    reason: string
  ): Promise<void> {
    try {
      // Create audit log entry for failed access
      await auditService.createAuditLog({
        userId: options.userId,
        action: 'data.access.denied',
        resourceType: 'financial_data_source',
        resourceId: String(options.sourceId),
        details: {
          reason: reason,
          filters: options.filters,
          sessionId: options.sessionId,
          requestId: options.requestId
        },
        workspaceId: options.workspaceId
      });
      
      // Emit security event for monitoring
      eventBus.emit('security.suspicious.activity', {
        type: 'unauthorized_data_access',
        userId: options.userId,
        dataSourceId: options.sourceId,
        reason: reason,
        workspaceId: options.workspaceId,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error recording failed data access:', error);
    }
  }

  /**
   * Simulate fetching data from an external financial data source
   * In a real implementation, this would connect to external APIs
   */
  private async fetchExternalData(
    dataSource: typeof financialDataSources.$inferSelect,
    filters: Record<string, any>,
    options: DataQueryOptions
  ): Promise<{ data: any[], metadata: any }> {
    try {
      // In a real implementation, this would:
      // 1. Connect to the external data source API
      // 2. Apply the filters to the query
      // 3. Retrieve and transform the data
      // 4. Apply any post-processing or data masking required
      
      // For demonstration, we'll query related instruments or return empty data
      let data: any[] = [];
      let metadata: any = {};
      
      // For market data sources, return financial instruments
      if (dataSource.sourceType === 'market_data') {
        data = await db.query.financialInstruments.findMany({
          where: and(
            eq(financialInstruments.isActive, true),
            filters.symbol ? eq(financialInstruments.symbol, filters.symbol) : sql`1=1`,
            filters.type ? eq(financialInstruments.type, filters.type) : sql`1=1`,
            filters.exchange ? eq(financialInstruments.exchange, filters.exchange) : sql`1=1`,
            filters.currency ? eq(financialInstruments.currency, filters.currency) : sql`1=1`
          ),
          limit: options.limit || 100,
          offset: options.offset || 0
        });
        
        metadata = {
          source: dataSource.name,
          provider: dataSource.provider,
          timestamp: new Date(),
          filteredCount: data.length,
          totalAvailable: data.length // In real implementation, get total count
        };
      } else {
        // For other source types, return empty data since we don't have real integrations
        metadata = {
          source: dataSource.name,
          provider: dataSource.provider,
          timestamp: new Date(),
          message: 'External data source integration would be implemented here',
          sourceType: dataSource.sourceType
        };
      }
      
      return { data, metadata };
    } catch (error) {
      console.error(`Error fetching external data from ${dataSource.name}:`, error);
      throw new Error(`Failed to retrieve data from ${dataSource.name}: ${error.message}`);
    }
  }

  /**
   * Create a new data source
   */
  public async createDataSource(
    dataSourceData: Omit<typeof financialDataSources.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<typeof financialDataSources.$inferSelect> {
    try {
      const [newDataSource] = await db.insert(financialDataSources).values({
        ...dataSourceData,
        updatedAt: new Date()
      }).returning();
      
      // Emit event
      eventBus.emit('data_source.created', {
        dataSourceId: newDataSource.id,
        name: newDataSource.name,
        createdBy: newDataSource.createdBy,
        workspaceId: newDataSource.workspaceId,
        timestamp: new Date()
      });
      
      return newDataSource;
    } catch (error) {
      console.error('Error creating data source:', error);
      throw error;
    }
  }

  /**
   * Update a data source
   */
  public async updateDataSource(
    id: number,
    dataSourceData: Partial<typeof financialDataSources.$inferInsert>
  ): Promise<typeof financialDataSources.$inferSelect | null> {
    try {
      const [updatedDataSource] = await db
        .update(financialDataSources)
        .set({
          ...dataSourceData,
          updatedAt: new Date()
        })
        .where(eq(financialDataSources.id, id))
        .returning();
      
      // Emit event
      eventBus.emit('data_source.updated', {
        dataSourceId: updatedDataSource.id,
        name: updatedDataSource.name,
        workspaceId: updatedDataSource.workspaceId,
        timestamp: new Date()
      });
      
      return updatedDataSource;
    } catch (error) {
      console.error(`Error updating data source ${id}:`, error);
      return null;
    }
  }

  /**
   * Delete a data source
   */
  public async deleteDataSource(
    id: number
  ): Promise<boolean> {
    try {
      // First, delete all permissions for this source
      await db
        .delete(financialDataPermissions)
        .where(eq(financialDataPermissions.sourceId, id));
      
      // Then delete the source itself
      await db
        .delete(financialDataSources)
        .where(eq(financialDataSources.id, id));
      
      // Emit event
      eventBus.emit('data_source.deleted', {
        dataSourceId: id,
        timestamp: new Date()
      });
      
      return true;
    } catch (error) {
      console.error(`Error deleting data source ${id}:`, error);
      return false;
    }
  }

  /**
   * Grant permission to a data source
   */
  public async grantDataSourcePermission(
    permissionData: Omit<typeof financialDataPermissions.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<typeof financialDataPermissions.$inferSelect> {
    try {
      const [newPermission] = await db.insert(financialDataPermissions).values({
        ...permissionData,
        updatedAt: new Date()
      }).returning();
      
      // Emit event
      eventBus.emit('data_source.permission.granted', {
        permissionId: newPermission.id,
        dataSourceId: newPermission.sourceId,
        userId: newPermission.userId,
        roleId: newPermission.roleId,
        workspaceId: newPermission.workspaceId,
        timestamp: new Date()
      });
      
      return newPermission;
    } catch (error) {
      console.error('Error granting data source permission:', error);
      throw error;
    }
  }

  /**
   * Revoke permission from a data source
   */
  public async revokeDataSourcePermission(
    id: number
  ): Promise<boolean> {
    try {
      await db
        .delete(financialDataPermissions)
        .where(eq(financialDataPermissions.id, id));
      
      // Emit event
      eventBus.emit('data_source.permission.revoked', {
        permissionId: id,
        timestamp: new Date()
      });
      
      return true;
    } catch (error) {
      console.error(`Error revoking data source permission ${id}:`, error);
      return false;
    }
  }

  /**
   * Search for financial instruments
   */
  public async searchInstruments(
    query: string,
    options: {
      type?: string;
      exchange?: string;
      currency?: string;
      active?: boolean;
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<Array<typeof financialInstruments.$inferSelect>> {
    try {
      const conditions = [
        or(
          like(financialInstruments.symbol, `%${query}%`),
          like(financialInstruments.name, `%${query}%`),
          like(financialInstruments.isin, `%${query}%`),
          like(financialInstruments.cusip, `%${query}%`)
        )
      ];
      
      if (options.type) {
        conditions.push(eq(financialInstruments.type, options.type));
      }
      
      if (options.exchange) {
        conditions.push(eq(financialInstruments.exchange, options.exchange));
      }
      
      if (options.currency) {
        conditions.push(eq(financialInstruments.currency, options.currency));
      }
      
      if (options.active !== undefined) {
        conditions.push(eq(financialInstruments.isActive, options.active));
      }
      
      return await db.query.financialInstruments.findMany({
        where: and(...conditions),
        limit: options.limit || 100,
        offset: options.offset || 0,
        orderBy: [
          { column: financialInstruments.symbol, order: 'asc' }
        ]
      });
    } catch (error) {
      console.error('Error searching instruments:', error);
      return [];
    }
  }
}

// Export singleton instance
export const secureDataFeedService = new SecureDataFeedService();