/**
 * Secret Manager Schema
 * 
 * Defines types and validation schemas for the secrets management system
 * with support for multiple enterprise secrets providers:
 * - HashiCorp Vault
 * - AWS Secrets Manager
 * - Azure Key Vault
 * - Google Secret Manager
 * - CyberArk
 */

import { pgTable, serial, text, varchar, timestamp, json, boolean, integer } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

/**
 * Secrets Manager Configuration Table
 * Stores configuration for connecting to secrets management systems
 */
export const secretsManagerConfigs = pgTable('secrets_manager_configs', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  provider: text('provider').notNull(), // 'hashicorp_vault', 'aws_secrets_manager', 'azure_key_vault', 'google_secret_manager', 'cyberark', 'local'
  
  // Connection parameters
  baseUrl: text('base_url'),
  region: text('region'),
  namespace: text('namespace'),
  projectId: text('project_id'),
  vaultId: text('vault_id'),
  
  // Authentication
  authType: text('auth_type').notNull(), // 'token', 'approle', 'iam', 'managed_identity', 'service_account', 'oauth2'
  authCredentials: json('auth_credentials').notNull(), // Encrypted credentials
  
  // Configuration options
  secretsPrefix: text('secrets_prefix'),
  cacheTtl: integer('cache_ttl'), // Cache time-to-live in seconds
  autoRotate: boolean('auto_rotate').default(false),
  rotationFrequency: integer('rotation_frequency'), // Rotation frequency in days
  
  // System fields
  isDefault: boolean('is_default').default(false),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdBy: integer('created_by'),
  updatedBy: integer('updated_by')
});

/**
 * Secret Reference Table
 * Stores metadata about secrets managed by the system
 * Note: The actual secret values are stored in the external secrets management system
 */
export const secretReferences = pgTable('secret_references', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  description: text('description'),
  
  // Secret metadata
  configId: integer('config_id').notNull(), // References secrets_manager_configs.id
  provider: text('provider').notNull(), // Duplicated for query performance
  
  // Secret lifecycle
  version: integer('version').default(1).notNull(),
  lastRotated: timestamp('last_rotated'),
  expiresAt: timestamp('expires_at'),
  
  // Tags for organization
  tags: json('tags').default([]),
  
  // Access control
  accessGroups: json('access_groups').default([]), // Groups that can access this secret
  
  // System fields
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdBy: integer('created_by'),
  updatedBy: integer('updated_by')
});

/**
 * Secret Access Logs
 * Audit trail for secret access
 */
export const secretAccessLogs = pgTable('secret_access_logs', {
  id: serial('id').primaryKey(),
  secretKey: text('secret_key').notNull(),
  action: text('action').notNull(), // 'get', 'set', 'delete', 'rotate', 'list'
  userId: integer('user_id'),
  username: text('username'),
  success: boolean('success').default(true),
  errorMessage: text('error_message'),
  ipAddress: varchar('ip_address', { length: 39 }),
  userAgent: text('user_agent'),
  timestamp: timestamp('timestamp').defaultNow().notNull()
});

// Zod validation schemas

export const secretsManagerConfigSchema = createInsertSchema(secretsManagerConfigs, {
  name: (schema) => schema.min(3, "Name must be at least 3 characters"),
  provider: (schema) => schema.refine((val) => 
    ['hashicorp_vault', 'aws_secrets_manager', 'azure_key_vault', 'google_secret_manager', 'cyberark', 'local'].includes(val), 
    { message: "Provider must be one of the supported providers" }
  ),
  authType: (schema) => schema.refine((val) => 
    ['token', 'approle', 'iam', 'managed_identity', 'service_account', 'oauth2'].includes(val),
    { message: "Auth type must be one of the supported authentication methods" }
  )
});

export type SecretsManagerConfigInsert = z.infer<typeof secretsManagerConfigSchema>;
const secretsManagerSelectSchema = createSelectSchema(secretsManagerConfigs);
export type SecretsManagerConfig = z.infer<typeof secretsManagerSelectSchema>;

export const secretReferenceSchema = createInsertSchema(secretReferences, {
  key: (schema) => schema.min(3, "Key must be at least 3 characters"),
  description: (schema) => schema.optional()
});

export type SecretReferenceInsert = z.infer<typeof secretReferenceSchema>;
const secretReferenceSelectSchema = createSelectSchema(secretReferences);
export type SecretReference = z.infer<typeof secretReferenceSelectSchema>;

export const secretAccessLogSchema = createInsertSchema(secretAccessLogs, {
  secretKey: (schema) => schema.min(1, "Secret key is required"),
  action: (schema) => schema.refine((val) => 
    ['get', 'set', 'delete', 'rotate', 'list', 'test'].includes(val),
    { message: "Action must be one of the supported actions" }
  )
});

export type SecretAccessLogInsert = z.infer<typeof secretAccessLogSchema>;
const secretAccessLogSelectSchema = createSelectSchema(secretAccessLogs);
export type SecretAccessLog = z.infer<typeof secretAccessLogSelectSchema>;

// UI Form Schemas with more detailed validation

export const secretsManagerConfigFormSchema = z.object({
  id: z.number().optional(),
  name: z.string().min(3, "Name must be at least 3 characters").max(100, "Name must be at most 100 characters"),
  description: z.string().optional(),
  provider: z.enum(['hashicorp_vault', 'aws_secrets_manager', 'azure_key_vault', 'google_secret_manager', 'cyberark', 'local'], {
    errorMap: () => ({ message: "Please select a supported secrets provider" })
  }),
  baseUrl: z.string().url("Please enter a valid URL").optional().or(z.literal('')),
  region: z.string().optional(),
  namespace: z.string().optional(),
  projectId: z.string().optional(),
  vaultId: z.string().optional(),
  authType: z.enum(['token', 'approle', 'iam', 'managed_identity', 'service_account', 'oauth2'], {
    errorMap: () => ({ message: "Please select a supported authentication method" })
  }),
  authCredentials: z.record(z.string(), z.any()),
  secretsPrefix: z.string().optional(),
  cacheTtl: z.number().int("Must be a whole number").min(0, "Must be a positive number").optional(),
  autoRotate: z.boolean().default(false),
  rotationFrequency: z.number().int("Must be a whole number").min(1, "Must rotate at least once per day").optional(),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true)
});

export type SecretsManagerConfigForm = z.infer<typeof secretsManagerConfigFormSchema>;

export const secretCreateFormSchema = z.object({
  key: z.string().min(3, "Key must be at least 3 characters").max(255, "Key must be at most 255 characters"),
  value: z.string().min(1, "Value is required"),
  description: z.string().optional(),
  configId: z.number().int("Must be a valid configuration ID"),
  tags: z.array(z.string()).optional(),
  accessGroups: z.array(z.string()).optional(),
  expiresAt: z.date().optional()
});

export type SecretCreateForm = z.infer<typeof secretCreateFormSchema>;

// Provider-specific schemas

// HashiCorp Vault specific fields
export const vaultConfigSchema = z.object({
  baseUrl: z.string().url("Please enter a valid Vault server URL"),
  namespace: z.string().optional(),
  authType: z.enum(['token', 'approle', 'kubernetes', 'userpass', 'ldap', 'aws', 'azure']),
  secretsEngine: z.enum(['kv', 'kv2', 'transit', 'database', 'aws', 'azure', 'pki']).default('kv2'),
  secretsPath: z.string().default('secret/')
});

// AWS Secrets Manager specific fields
export const awsConfigSchema = z.object({
  region: z.string().min(1, "AWS region is required"),
  authType: z.enum(['iam', 'access_key', 'profile']),
  accessKeyId: z.string().optional(),
  secretAccessKey: z.string().optional(),
  profile: z.string().optional()
});

// Azure Key Vault specific fields
export const azureConfigSchema = z.object({
  vaultUrl: z.string().url("Please enter a valid Key Vault URL"),
  tenantId: z.string().optional(),
  clientId: z.string().optional(),
  clientSecret: z.string().optional(),
  authType: z.enum(['managed_identity', 'service_principal', 'client_secret'])
});

// Google Secret Manager specific fields
export const googleConfigSchema = z.object({
  projectId: z.string().min(1, "Google Cloud project ID is required"),
  authType: z.enum(['service_account', 'application_default']),
  credentials: z.record(z.string(), z.any()).optional()
});

// CyberArk specific fields
export const cyberArkConfigSchema = z.object({
  baseUrl: z.string().url("Please enter a valid CyberArk server URL"),
  authType: z.enum(['oauth2', 'cyberark_adc', 'api_key']),
  appId: z.string().optional(),
  safe: z.string().optional()
});