/**
 * Data Storage & Business Intelligence Schema
 * 
 * Unified schema for data storage and BI integrations, providing:
 * - Database connections (PostgreSQL, MySQL, MongoDB, SQL Server)
 * - Data warehouse integration (Snowflake, Redshift, BigQuery)
 * - Business intelligence tool connectors (Tableau, Power BI, Looker, Qlik)
 * - File storage integration (AWS S3, Azure Blob, Google Drive, Dropbox)
 */

import { pgTable, serial, text, integer, timestamp, jsonb, boolean, unique } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';
import { users, workspaces } from './schema';

// Enum values for integration types
export const DATA_INTEGRATION_TYPES = ['database', 'data_warehouse', 'bi_tool', 'file_storage'] as const;

// Systems supported by type
export const DATABASE_SYSTEMS = [
  'postgresql', 'mysql', 'mongodb', 'sqlserver', 'oracle', 'mariadb', 'sqlite'
] as const;

export const DATA_WAREHOUSE_SYSTEMS = [
  'snowflake', 'redshift', 'bigquery', 'synapse', 'databricks', 'firebolt'
] as const;

export const BI_TOOL_SYSTEMS = [
  'tableau', 'powerbi', 'looker', 'qlik', 'metabase', 'mode', 'thoughtspot'
] as const;

export const FILE_STORAGE_SYSTEMS = [
  'aws_s3', 'azure_blob', 'gcp_storage', 'google_drive', 'dropbox', 'onedrive', 'box'
] as const;

// Connection status values
export const CONNECTION_STATUS = ['connected', 'disconnected', 'error', 'pending', 'configured'] as const;

// Authentication types
export const AUTH_TYPES = [
  'username_password', 
  'api_key', 
  'oauth2', 
  'connection_string', 
  'aws_iam',
  'service_account'
] as const;

// Data integration configuration table
export const dataIntegrations = pgTable('data_integrations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type', { enum: DATA_INTEGRATION_TYPES }).notNull(),
  system: text('system').notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  status: text('status', { enum: CONNECTION_STATUS }).default('configured').notNull(),
  
  // Connection details
  host: text('host'),
  port: integer('port'),
  authType: text('auth_type', { enum: AUTH_TYPES }),
  username: text('username'),
  password: text('password'),
  apiKey: text('api_key'),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  connectionString: text('connection_string'),
  region: text('region'),
  
  // Integration-specific settings
  databaseName: text('database_name'),
  schema: text('schema'),
  bucket: text('bucket'),
  folderPath: text('folder_path'),
  endpoint: text('endpoint'),
  
  // OAuth configuration
  oauthClientId: text('oauth_client_id'),
  oauthClientSecret: text('oauth_client_secret'),
  oauthRedirectUri: text('oauth_redirect_uri'),
  oauthScope: text('oauth_scope'),
  tokenExpiresAt: timestamp('token_expires_at'),
  
  // Advanced configuration
  config: jsonb('config').default({}).notNull(),
  sslEnabled: boolean('ssl_enabled').default(true),
  
  // Synchronization and scheduling
  syncEnabled: boolean('sync_enabled').default(false),
  syncInterval: text('sync_interval'), // e.g., "30m", "1h", "1d"
  syncSchedule: text('sync_schedule'), // cron expression
  lastSyncedAt: timestamp('last_synced_at'),
  lastSyncStatus: text('last_sync_status'),
  lastSyncError: text('last_sync_error'),
  
  // Organization alignment
  workspaceId: integer('workspace_id').references(() => workspaces.id),
  createdBy: integer('created_by').references(() => users.id),
  
  // Security and compliance
  dataClassification: text('data_classification'),
  encryptionEnabled: boolean('encryption_enabled').default(true),
  accessRestricted: boolean('access_restricted').default(true),
  
  // Monitoring and health
  lastHealthCheck: timestamp('last_health_check'),
  healthStatus: text('health_status'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    nameIdx: unique('data_integrations_name_workspace_idx').on(table.name, table.workspaceId),
  };
});

// Schema mapping table for database/warehouse integrations
export const dataSchemas = pgTable('data_schemas', {
  id: serial('id').primaryKey(),
  integrationId: integer('integration_id').notNull().references(() => dataIntegrations.id),
  name: text('name').notNull(),
  type: text('type').notNull(), // source or destination
  tables: jsonb('tables').default([]).notNull(),
  columns: jsonb('columns').default([]).notNull(),
  relationships: jsonb('relationships').default([]).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Sync jobs table to track data synchronization
export const dataSyncJobs = pgTable('data_sync_jobs', {
  id: serial('id').primaryKey(),
  integrationId: integer('integration_id').notNull().references(() => dataIntegrations.id),
  status: text('status').notNull(), // pending, running, completed, failed
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  recordsProcessed: integer('records_processed'),
  bytesProcessed: integer('bytes_processed'),
  error: text('error'),
  logs: jsonb('logs').default([]),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Query templates for BI tools
export const dataQueryTemplates = pgTable('data_query_templates', {
  id: serial('id').primaryKey(),
  integrationId: integer('integration_id').notNull().references(() => dataIntegrations.id),
  name: text('name').notNull(),
  description: text('description'),
  query: text('query').notNull(),
  parameters: jsonb('parameters').default([]),
  outputFormat: text('output_format'),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const dataIntegrationsRelations = relations(dataIntegrations, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [dataIntegrations.workspaceId],
    references: [workspaces.id]
  }),
  creator: one(users, {
    fields: [dataIntegrations.createdBy],
    references: [users.id]
  }),
  schemas: many(dataSchemas),
  syncJobs: many(dataSyncJobs),
  queryTemplates: many(dataQueryTemplates),
}));

export const dataSchemasRelations = relations(dataSchemas, ({ one }) => ({
  integration: one(dataIntegrations, {
    fields: [dataSchemas.integrationId],
    references: [dataIntegrations.id]
  }),
}));

export const dataSyncJobsRelations = relations(dataSyncJobs, ({ one }) => ({
  integration: one(dataIntegrations, {
    fields: [dataSyncJobs.integrationId],
    references: [dataIntegrations.id]
  }),
}));

export const dataQueryTemplatesRelations = relations(dataQueryTemplates, ({ one }) => ({
  integration: one(dataIntegrations, {
    fields: [dataQueryTemplates.integrationId],
    references: [dataIntegrations.id]
  }),
  creator: one(users, {
    fields: [dataQueryTemplates.createdBy],
    references: [users.id]
  }),
}));

// Validation schemas
export const insertDataIntegrationSchema = createInsertSchema(dataIntegrations, {
  name: (schema) => schema.min(1, "Name is required"),
  type: (schema) => schema.refine(val => DATA_INTEGRATION_TYPES.includes(val as any), {
    message: `Type must be one of: ${DATA_INTEGRATION_TYPES.join(', ')}`
  }),
});

export const selectDataIntegrationSchema = createSelectSchema(dataIntegrations);

export const insertDataSchemaSchema = createInsertSchema(dataSchemas);
export const selectDataSchemaSchema = createSelectSchema(dataSchemas);

export const insertDataSyncJobSchema = createInsertSchema(dataSyncJobs);
export const selectDataSyncJobSchema = createSelectSchema(dataSyncJobs);

export const insertDataQueryTemplateSchema = createInsertSchema(dataQueryTemplates);
export const selectDataQueryTemplateSchema = createSelectSchema(dataQueryTemplates);

// Types
export type DataIntegration = z.infer<typeof selectDataIntegrationSchema>;
export type InsertDataIntegration = z.infer<typeof insertDataIntegrationSchema>;

export type DataSchema = z.infer<typeof selectDataSchemaSchema>;
export type InsertDataSchema = z.infer<typeof insertDataSchemaSchema>;

export type DataSyncJob = z.infer<typeof selectDataSyncJobSchema>;
export type InsertDataSyncJob = z.infer<typeof insertDataSyncJobSchema>;

export type DataQueryTemplate = z.infer<typeof selectDataQueryTemplateSchema>;
export type InsertDataQueryTemplate = z.infer<typeof insertDataQueryTemplateSchema>;

// Export combined schema
export const dataStorageSchema = {
  dataIntegrations,
  dataSchemas,
  dataSyncJobs,
  dataQueryTemplates,
};