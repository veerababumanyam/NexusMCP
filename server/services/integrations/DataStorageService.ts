/**
 * Data Storage & Business Intelligence Integration Service
 * 
 * Provides functionality to manage database connections, data warehouses,
 * BI tool connections, and file storage integrations from a unified service.
 */

import { eq, and, desc, asc, sql, like } from 'drizzle-orm';
import { db } from '@db';
import { 
  dataIntegrations, 
  dataSchemas, 
  dataSyncJobs,
  dataQueryTemplates,
  InsertDataIntegration,
  DataIntegration,
  InsertDataSchema,
  DataSchema,
  InsertDataSyncJob,
  DataSyncJob,
  InsertDataQueryTemplate,
  DataQueryTemplate,
  DATA_INTEGRATION_TYPES
} from '@shared/schema_data_storage_bi';

export class DataStorageService {
  private static instance: DataStorageService;

  /**
   * Get singleton instance
   */
  public static getInstance(): DataStorageService {
    if (!DataStorageService.instance) {
      DataStorageService.instance = new DataStorageService();
    }
    return DataStorageService.instance;
  }

  /**
   * Create a new data integration
   */
  async createIntegration(data: InsertDataIntegration): Promise<DataIntegration> {
    try {
      const [integration] = await db.insert(dataIntegrations)
        .values(data)
        .returning();
      
      return integration;
    } catch (error) {
      console.error('[DataStorageService] ERROR: Error creating integration:', error);
      throw new Error(`Failed to create integration: ${error.message}`);
    }
  }

  /**
   * Update an existing data integration
   */
  async updateIntegration(id: number, data: Partial<InsertDataIntegration>): Promise<DataIntegration> {
    try {
      const [integration] = await db.update(dataIntegrations)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(dataIntegrations.id, id))
        .returning();
      
      if (!integration) {
        throw new Error(`Integration with id ${id} not found`);
      }
      
      return integration;
    } catch (error) {
      console.error('[DataStorageService] ERROR: Error updating integration:', error);
      throw new Error(`Failed to update integration: ${error.message}`);
    }
  }

  /**
   * Delete a data integration
   */
  async deleteIntegration(id: number): Promise<{ success: boolean }> {
    try {
      // Start by deleting related records
      await db.delete(dataSchemas).where(eq(dataSchemas.integrationId, id));
      await db.delete(dataSyncJobs).where(eq(dataSyncJobs.integrationId, id));
      await db.delete(dataQueryTemplates).where(eq(dataQueryTemplates.integrationId, id));
      
      // Then delete the integration itself
      const result = await db.delete(dataIntegrations)
        .where(eq(dataIntegrations.id, id))
        .returning({ id: dataIntegrations.id });
      
      return { success: result.length > 0 };
    } catch (error) {
      console.error('[DataStorageService] ERROR: Error deleting integration:', error);
      throw new Error(`Failed to delete integration: ${error.message}`);
    }
  }

  /**
   * Get a data integration by ID
   */
  async getIntegration(id: number): Promise<DataIntegration> {
    try {
      const integration = await db.query.dataIntegrations.findFirst({
        where: eq(dataIntegrations.id, id),
        with: {
          schemas: true,
          syncJobs: {
            limit: 5,
            orderBy: [desc(dataSyncJobs.createdAt)]
          },
          queryTemplates: true
        }
      });
      
      if (!integration) {
        throw new Error(`Integration with id ${id} not found`);
      }
      
      return integration;
    } catch (error) {
      console.error('[DataStorageService] ERROR: Error getting integration:', error);
      throw new Error(`Failed to get integration: ${error.message}`);
    }
  }

  /**
   * Get all data integrations with optional filtering
   */
  async getAllIntegrations(params: {
    workspaceId?: number;
    type?: typeof DATA_INTEGRATION_TYPES[number];
    system?: string;
    enabled?: boolean;
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: string;
    sortDirection?: 'asc' | 'desc';
  } = {}): Promise<{
    integrations: DataIntegration[];
    count: number;
    page: number;
    totalPages: number;
  }> {
    try {
      const {
        workspaceId,
        type,
        system,
        enabled,
        page = 1,
        limit = 10,
        search = '',
        sortBy = 'createdAt',
        sortDirection = 'desc'
      } = params;
      
      // Build filters
      let conditions = sql`1=1`;
      
      if (workspaceId !== undefined) {
        conditions = sql`${conditions} AND ${dataIntegrations.workspaceId} = ${workspaceId}`;
      }
      
      if (type) {
        conditions = sql`${conditions} AND ${dataIntegrations.type} = ${type}`;
      }
      
      if (system) {
        conditions = sql`${conditions} AND ${dataIntegrations.system} = ${system}`;
      }
      
      if (enabled !== undefined) {
        conditions = sql`${conditions} AND ${dataIntegrations.enabled} = ${enabled}`;
      }
      
      if (search) {
        conditions = sql`${conditions} AND (
          ${dataIntegrations.name} ILIKE ${`%${search}%`} OR
          ${dataIntegrations.description} ILIKE ${`%${search}%`}
        )`;
      }
      
      // Count total results
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(dataIntegrations)
        .where(conditions);
      
      // Calculate pagination
      const offset = (page - 1) * limit;
      const totalPages = Math.ceil(count / limit);
      
      // Get sorted, filtered, paginated results
      let query = db.select()
        .from(dataIntegrations)
        .where(conditions)
        .limit(limit)
        .offset(offset);
      
      // Apply sorting
      if (sortBy && sortDirection) {
        const column = dataIntegrations[sortBy] || dataIntegrations.createdAt;
        
        if (sortDirection === 'asc') {
          query = query.orderBy(asc(column));
        } else {
          query = query.orderBy(desc(column));
        }
      }
      
      const integrations = await query;
      
      return {
        integrations,
        count,
        page,
        totalPages
      };
    } catch (error) {
      console.error('[DataStorageService] ERROR: Error getting integrations:', error);
      throw new Error(`Failed to get integrations: ${error.message}`);
    }
  }

  /**
   * Test a data integration connection
   */
  async testConnection(id: number): Promise<{ success: boolean; message: string }> {
    try {
      const integration = await this.getIntegration(id);
      
      // Simulate connection testing based on type
      // In a real implementation, this would connect to the actual service
      let success = true;
      let message = 'Connection successful';
      
      // For demonstration, randomly succeed or fail
      if (Math.random() > 0.8) {
        success = false;
        message = 'Connection failed: timeout while connecting';
      }
      
      // Update the integration status based on the test result
      await this.updateIntegration(id, {
        status: success ? 'connected' : 'error',
        lastHealthCheck: new Date(),
        healthStatus: success ? 'healthy' : 'error'
      });
      
      return { success, message };
    } catch (error) {
      console.error('[DataStorageService] ERROR: Error testing connection:', error);
      
      // Update the integration status to error
      try {
        await this.updateIntegration(id, {
          status: 'error', 
          lastHealthCheck: new Date(),
          healthStatus: 'error'
        });
      } catch (updateError) {
        console.error('[DataStorageService] ERROR: Error updating integration status:', updateError);
      }
      
      return { success: false, message: `Connection test failed: ${error.message}` };
    }
  }

  /**
   * Discover schemas from a database connection
   */
  async discoverSchemas(integrationId: number): Promise<DataSchema[]> {
    try {
      const integration = await this.getIntegration(integrationId);
      
      if (!['database', 'data_warehouse'].includes(integration.type)) {
        throw new Error(`Schema discovery is only available for database and data warehouse integrations`);
      }
      
      // In a real implementation, this would connect to the database and retrieve schema information
      // For now, we'll create a sample schema
      const [schema] = await db.insert(dataSchemas)
        .values({
          integrationId,
          name: 'discovered_schema',
          type: 'source',
          tables: [
            { name: 'users', rows: 1000 },
            { name: 'orders', rows: 5000 },
            { name: 'products', rows: 200 }
          ],
          columns: [
            { table: 'users', name: 'id', type: 'integer', nullable: false },
            { table: 'users', name: 'name', type: 'varchar', nullable: false },
            { table: 'users', name: 'email', type: 'varchar', nullable: false },
            { table: 'orders', name: 'id', type: 'integer', nullable: false },
            { table: 'orders', name: 'user_id', type: 'integer', nullable: false },
            { table: 'orders', name: 'total', type: 'numeric', nullable: false },
            { table: 'products', name: 'id', type: 'integer', nullable: false },
            { table: 'products', name: 'name', type: 'varchar', nullable: false },
            { table: 'products', name: 'price', type: 'numeric', nullable: false }
          ],
          relationships: [
            { name: 'fk_orders_users', source: 'orders.user_id', target: 'users.id' }
          ]
        })
        .returning();
      
      // Return all schemas for this integration, including the newly created one
      const schemas = await db
        .select()
        .from(dataSchemas)
        .where(eq(dataSchemas.integrationId, integrationId));
      
      return schemas;
    } catch (error) {
      console.error('[DataStorageService] ERROR: Error discovering schemas:', error);
      throw new Error(`Failed to discover schemas: ${error.message}`);
    }
  }

  /**
   * Create a new data schema
   */
  async createSchema(data: InsertDataSchema): Promise<DataSchema> {
    try {
      const [schema] = await db.insert(dataSchemas)
        .values(data)
        .returning();
      
      return schema;
    } catch (error) {
      console.error('[DataStorageService] ERROR: Error creating schema:', error);
      throw new Error(`Failed to create schema: ${error.message}`);
    }
  }

  /**
   * Get data schemas for an integration
   */
  async getSchemas(integrationId: number): Promise<DataSchema[]> {
    try {
      const schemas = await db
        .select()
        .from(dataSchemas)
        .where(eq(dataSchemas.integrationId, integrationId));
      
      return schemas;
    } catch (error) {
      console.error('[DataStorageService] ERROR: Error getting schemas:', error);
      throw new Error(`Failed to get schemas: ${error.message}`);
    }
  }

  /**
   * Create a new sync job
   */
  async createSyncJob(data: InsertDataSyncJob): Promise<DataSyncJob> {
    try {
      const [job] = await db.insert(dataSyncJobs)
        .values({ ...data, status: 'pending' })
        .returning();
      
      return job;
    } catch (error) {
      console.error('[DataStorageService] ERROR: Error creating sync job:', error);
      throw new Error(`Failed to create sync job: ${error.message}`);
    }
  }

  /**
   * Get sync jobs for an integration
   */
  async getSyncJobs(integrationId: number, limit = 10): Promise<DataSyncJob[]> {
    try {
      const jobs = await db
        .select()
        .from(dataSyncJobs)
        .where(eq(dataSyncJobs.integrationId, integrationId))
        .orderBy(desc(dataSyncJobs.createdAt))
        .limit(limit);
      
      return jobs;
    } catch (error) {
      console.error('[DataStorageService] ERROR: Error getting sync jobs:', error);
      throw new Error(`Failed to get sync jobs: ${error.message}`);
    }
  }

  /**
   * Create a new query template
   */
  async createQueryTemplate(data: InsertDataQueryTemplate): Promise<DataQueryTemplate> {
    try {
      const [template] = await db.insert(dataQueryTemplates)
        .values(data)
        .returning();
      
      return template;
    } catch (error) {
      console.error('[DataStorageService] ERROR: Error creating query template:', error);
      throw new Error(`Failed to create query template: ${error.message}`);
    }
  }

  /**
   * Get query templates for an integration
   */
  async getQueryTemplates(integrationId: number): Promise<DataQueryTemplate[]> {
    try {
      const templates = await db
        .select()
        .from(dataQueryTemplates)
        .where(eq(dataQueryTemplates.integrationId, integrationId));
      
      return templates;
    } catch (error) {
      console.error('[DataStorageService] ERROR: Error getting query templates:', error);
      throw new Error(`Failed to get query templates: ${error.message}`);
    }
  }
}