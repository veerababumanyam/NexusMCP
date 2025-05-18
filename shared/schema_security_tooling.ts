import { z } from 'zod';
import { pgTable, serial, text, integer, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';

// Security tooling table schema
export const securityTooling = pgTable('security_tooling', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').notNull(),  // 'siem', 'secrets', 'casb'
  system: text('system').notNull(),
  authType: text('auth_type').notNull(),
  enabled: boolean('enabled').default(true),
  status: text('status').default('configured'),
  config: jsonb('config').default({}),
  
  // Connection details
  host: text('host'),
  port: integer('port'),
  apiKey: text('api_key'),
  username: text('username'),
  password: text('password'),
  oauthClientId: text('oauth_client_id'),
  oauthClientSecret: text('oauth_client_secret'),
  oauthRedirectUri: text('oauth_redirect_uri'),
  oauthTokenUrl: text('oauth_token_url'),
  oauthAuthUrl: text('oauth_auth_url'),
  oauthScope: text('oauth_scope'),
  certificatePath: text('certificate_path'),
  privateKeyPath: text('private_key_path'),
  
  // SIEM-specific configurations
  logFormat: text('log_format'),
  logLevel: text('log_level'),
  bufferSize: integer('buffer_size'),
  retryCount: integer('retry_count'),
  maxBatchSize: integer('max_batch_size'),
  logSourceIdentifier: text('log_source_identifier'),
  
  // Secrets-specific configurations
  vaultPath: text('vault_path'),
  mountPoint: text('mount_point'),
  namespaceId: text('namespace_id'),
  
  // CASB-specific configurations
  tenantId: text('tenant_id'),
  instanceId: text('instance_id'),
  
  // Audit tracking
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdBy: integer('created_by'),
  updatedBy: integer('updated_by'),
  lastSuccessfulConnection: timestamp('last_successful_connection'),
  errorMessage: text('error_message')
});

// Define allowed systems and auth types
export const SIEM_SYSTEMS = [
  'splunk',
  'qradar',
  'sentinel',
  'arcsight',
  'elastic_siem',
  'sumo_logic',
  'logrhythm',
  'rapid7_insightdr',
  'mcafee_esm'
] as const;

export const SECRETS_MANAGER_SYSTEMS = [
  'hashicorp_vault',
  'aws_secrets_manager',
  'azure_key_vault',
  'google_secret_manager',
  'cyberark',
  'thycotic_secret_server',
  'keepassx',
  'akeyless',
  '1password'
] as const;

export const CASB_SYSTEMS = [
  'netskope',
  'microsoft_defender_cloud',
  'palo_alto_prisma',
  'mcafee_mvision',
  'forcepoint_casb',
  'bitglass',
  'symantec_cloudSOC',
  'cisco_cloudlock'
] as const;

export const SECURITY_AUTH_TYPES = [
  'api_key',
  'username_password',
  'oauth2',
  'client_certificate',
  'jwt',
  'saml',
  'hmac',
  'aws_sig_v4'
] as const;

export const LOG_FORMATS = [
  'cef',
  'leef',
  'json',
  'syslog',
  'xml',
  'csv',
  'kv',
  'plain'
] as const;

// Zod schema for validation
export const securityToolingFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  type: z.enum(['siem', 'secrets', 'casb']),
  system: z.string().min(1, 'System is required'),
  authType: z.enum(SECURITY_AUTH_TYPES),
  enabled: z.boolean().default(true),
  host: z.string().optional(),
  port: z.number().int().positive().optional(),
  apiKey: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  oauthClientId: z.string().optional(),
  oauthClientSecret: z.string().optional(),
  oauthRedirectUri: z.string().optional(),
  oauthTokenUrl: z.string().optional(),
  oauthAuthUrl: z.string().optional(),
  oauthScope: z.string().optional(),
  certificatePath: z.string().optional(),
  privateKeyPath: z.string().optional(),
  
  // SIEM-specific configurations
  logFormat: z.string().optional(),
  logLevel: z.string().optional(),
  bufferSize: z.number().int().positive().optional(),
  retryCount: z.number().int().positive().optional(),
  maxBatchSize: z.number().int().positive().optional(),
  logSourceIdentifier: z.string().optional(),
  
  // Secrets-specific configurations
  vaultPath: z.string().optional(),
  mountPoint: z.string().optional(),
  namespaceId: z.string().optional(),
  
  // CASB-specific configurations
  tenantId: z.string().optional(),
  instanceId: z.string().optional(),
  
  // Config object for additional settings
  config: z.any().optional(),
});

// Create schemas for insert and select operations
export const securityToolingInsertSchema = createInsertSchema(securityTooling);
export const securityToolingSelectSchema = createSelectSchema(securityTooling);

// Type definitions
export type SiemFormValues = z.infer<typeof securityToolingFormSchema> & {
  type: 'siem';
};

export type SecretsFormValues = z.infer<typeof securityToolingFormSchema> & {
  type: 'secrets';
};

export type CasbFormValues = z.infer<typeof securityToolingFormSchema> & {
  type: 'casb';
  config?: {
    monitoredApplications?: string[];
    maxSessions?: number;
    scanFrequency?: string;
    incidentNotifications?: boolean;
    sensitiveDataTypes?: string[];
    allowedRegions?: string[];
    dlpEnabled?: boolean;
    malwareScanning?: boolean;
  };
};

export type SecurityToolingInsert = z.infer<typeof securityToolingInsertSchema>;
export type SecurityTooling = z.infer<typeof securityToolingSelectSchema>;