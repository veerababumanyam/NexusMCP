import { pgTable, serial, text, boolean, timestamp, jsonb, integer } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

/**
 * File Storage Integration Schema
 * 
 * Defines tables and schemas for enterprise file storage integrations:
 * - SharePoint (Microsoft 365)
 * - Box
 * - Dropbox Business
 * - Google Drive (Google Workspace)
 * - OneDrive for Business
 */

// Supported file storage providers
export const supportedProviders = [
  'sharepoint',
  'box',
  'dropbox',
  'google_drive',
  'onedrive'
] as const;

// Authentication types
export const authTypes = [
  'oauth2',
  'api_key',
  'client_credentials',
  'graph_api'
] as const;

// File storage integrations table
export const fileStorageIntegrations = pgTable('file_storage_integrations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  provider: text('provider').notNull().$type<typeof supportedProviders[number]>(),
  tenantId: text('tenant_id'),
  driveId: text('drive_id'),
  siteId: text('site_id'),
  rootFolderId: text('root_folder_id'),
  authType: text('auth_type').notNull().$type<typeof authTypes[number]>(),
  authConfig: jsonb('auth_config').notNull().default({}),
  isActive: boolean('is_active').notNull().default(true),
  defaultIntegration: boolean('default_integration').default(false),
  connectionStatus: text('connection_status').default('pending'),
  lastSyncedAt: timestamp('last_synced_at'),
  refreshToken: text('refresh_token'),
  accessToken: text('access_token'),
  tokenExpiresAt: timestamp('token_expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: integer('created_by'),
  updatedBy: integer('updated_by'),
});

// File reference table to track synced files
export const fileReferences = pgTable('file_references', {
  id: serial('id').primaryKey(),
  integrationId: integer('integration_id').notNull().references(() => fileStorageIntegrations.id, { onDelete: 'cascade' }),
  externalId: text('external_id').notNull(),
  name: text('name').notNull(),
  mimeType: text('mime_type'),
  path: text('path').notNull(),
  size: integer('size'),
  parentFolderId: text('parent_folder_id'),
  webUrl: text('web_url'),
  downloadUrl: text('download_url'),
  thumbnailUrl: text('thumbnail_url'),
  isFolder: boolean('is_folder').notNull().default(false),
  metadata: jsonb('metadata').default({}),
  lastSyncedAt: timestamp('last_synced_at').notNull().defaultNow(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// File storage operations log
export const fileOperationsLog = pgTable('file_operations_log', {
  id: serial('id').primaryKey(),
  integrationId: integer('integration_id').notNull().references(() => fileStorageIntegrations.id, { onDelete: 'cascade' }),
  fileId: integer('file_id').references(() => fileReferences.id, { onDelete: 'set null' }),
  operation: text('operation').notNull(), // upload, download, rename, delete, etc.
  status: text('status').notNull(), // success, failure
  userId: integer('user_id'),
  errorMessage: text('error_message'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

// Zod schemas for validation
export const fileStorageIntegrationInsertSchema = createInsertSchema(fileStorageIntegrations, {
  provider: z.enum(supportedProviders),
  authType: z.enum(authTypes),
  name: (schema) => schema.min(2, "Integration name must be at least 2 characters"),
  authConfig: z.record(z.string(), z.any()).refine((data) => {
    // Different validation based on auth type
    if (data.authType === 'oauth2') {
      return !!data.clientId && !!data.clientSecret && !!data.redirectUri;
    } else if (data.authType === 'api_key') {
      return !!data.apiKey;
    }
    return true;
  }, "Missing required authentication configuration"),
});

export type FileStorageIntegrationInsert = z.infer<typeof fileStorageIntegrationInsertSchema>;
export const fileStorageIntegrationSelectSchema = createSelectSchema(fileStorageIntegrations);
export type FileStorageIntegration = z.infer<typeof fileStorageIntegrationSelectSchema>;

export const fileReferenceInsertSchema = createInsertSchema(fileReferences);
export type FileReferenceInsert = z.infer<typeof fileReferenceInsertSchema>;
export const fileReferenceSelectSchema = createSelectSchema(fileReferences);
export type FileReference = z.infer<typeof fileReferenceSelectSchema>;

export const fileOperationLogInsertSchema = createInsertSchema(fileOperationsLog);
export type FileOperationLogInsert = z.infer<typeof fileOperationLogInsertSchema>;
export const fileOperationLogSelectSchema = createSelectSchema(fileOperationsLog);
export type FileOperationLog = z.infer<typeof fileOperationLogSelectSchema>;