import { pgTable, serial, text, integer, timestamp, boolean, json, jsonb, decimal } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';

// Clinical plugins table
export const clinicalPlugins = pgTable('healthcare_clinical_plugins', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(), // analytics, ai, monitoring, prescription, research
  version: text('version').notNull(),
  author: text('author').notNull(),
  status: text('status').notNull().default('inactive'), // active, inactive, degraded
  hipaaCompliant: boolean('hipaa_compliant').notNull().default(false),
  lastUsed: timestamp('last_used'),
  usageCount: integer('usage_count').default(0),
  apiEndpoint: text('api_endpoint'),
  configuration: jsonb('configuration'),
  dataAccess: json('data_access').$type<string[]>(),
  metadataSchema: jsonb('metadata_schema'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  tags: json('tags').$type<string[]>(),
  securityReview: jsonb('security_review'),
  installationSource: text('installation_source'), // marketplace, custom, etc.
  marketplaceId: text('marketplace_id'), // Reference to marketplace listing if installed from there
});

// Plugin usage logs
export const clinicalPluginUsageLogs = pgTable('healthcare_clinical_plugin_usage', {
  id: serial('id').primaryKey(),
  pluginId: integer('plugin_id').notNull().references(() => clinicalPlugins.id),
  userId: integer('user_id').notNull(),
  sessionId: text('session_id'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  action: text('action').notNull(), // started, completed, failed, etc.
  duration: integer('duration'), // in milliseconds
  status: text('status'), // success, error
  errorDetails: text('error_details'),
  metadata: jsonb('metadata'),
});

// Marketplace plugins
export const clinicalPluginMarketplace = pgTable('healthcare_clinical_plugin_marketplace', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  version: text('version').notNull(),
  author: text('author').notNull(),
  rating: integer('rating'),
  installations: integer('installations').default(0),
  hipaaCompliant: boolean('hipaa_compliant').notNull().default(false),
  price: text('price'), // free, paid, subscription
  setupComplexity: text('setup_complexity'), // simple, medium, complex
  dataAccess: json('data_access').$type<string[]>(),
  averageSetupTime: text('average_setup_time'),
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
  features: json('features').$type<string[]>(),
  requiresApproval: boolean('requires_approval').default(false),
  approvalStatus: text('approval_status'), // approved, pending, rejected
  certifications: json('certifications').$type<string[]>(),
});

// Relations
export const clinicalPluginsRelations = relations(clinicalPlugins, ({ many }) => ({
  usageLogs: many(clinicalPluginUsageLogs),
}));

export const clinicalPluginUsageLogsRelations = relations(clinicalPluginUsageLogs, ({ one }) => ({
  plugin: one(clinicalPlugins, {
    fields: [clinicalPluginUsageLogs.pluginId],
    references: [clinicalPlugins.id],
  }),
}));

// Zod schemas
export const clinicalPluginsInsertSchema = createInsertSchema(clinicalPlugins, {
  name: (schema) => schema.min(3, "Name must be at least 3 characters"),
  description: (schema) => schema.min(10, "Description must be at least 10 characters"),
  category: (schema) => schema.refine(
    (val) => ['analytics', 'ai', 'monitoring', 'prescription', 'research'].includes(val),
    "Category must be one of: analytics, ai, monitoring, prescription, research"
  ),
  version: (schema) => schema.regex(/^\d+\.\d+\.\d+$/, "Version must follow semantic versioning (x.y.z)"),
});

export const clinicalPluginsUpdateSchema = clinicalPluginsInsertSchema.partial();

export const clinicalPluginMarketplaceInsertSchema = createInsertSchema(clinicalPluginMarketplace, {
  name: (schema) => schema.min(3, "Name must be at least 3 characters"),
  description: (schema) => schema.min(10, "Description must be at least 10 characters"),
  category: (schema) => schema.refine(
    (val) => ['analytics', 'ai', 'monitoring', 'prescription', 'research'].includes(val),
    "Category must be one of: analytics, ai, monitoring, prescription, research"
  ),
});

export const clinicalPluginMarketplaceUpdateSchema = clinicalPluginMarketplaceInsertSchema.partial();

// Create select schemas first to avoid TypeScript errors
const clinicalPluginsSelectSchema = createSelectSchema(clinicalPlugins);
const clinicalPluginMarketplaceSelectSchema = createSelectSchema(clinicalPluginMarketplace);
const clinicalPluginUsageLogsSelectSchema = createSelectSchema(clinicalPluginUsageLogs);

export type ClinicalPlugin = z.infer<typeof clinicalPluginsSelectSchema>;
export type ClinicalPluginInsert = z.infer<typeof clinicalPluginsInsertSchema>;
export type ClinicalPluginUpdate = z.infer<typeof clinicalPluginsUpdateSchema>;

export type ClinicalPluginMarketplace = z.infer<typeof clinicalPluginMarketplaceSelectSchema>;
export type ClinicalPluginMarketplaceInsert = z.infer<typeof clinicalPluginMarketplaceInsertSchema>;
export type ClinicalPluginMarketplaceUpdate = z.infer<typeof clinicalPluginMarketplaceUpdateSchema>;

export type ClinicalPluginUsageLog = z.infer<typeof clinicalPluginUsageLogsSelectSchema>;

// EHR Integrations schema
export const ehrIntegrations = pgTable('healthcare_ehr_integrations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // FHIR, HL7, Proprietary
  version: text('version').notNull(),
  endpoint: text('endpoint').notNull(),
  status: text('status').notNull().default('inactive'), // active, degraded, inactive
  credentials: text('credentials_type').notNull(), // OAuth 2.0, Client Certificate, API Key, Basic Auth
  credentialId: integer('credential_id'), // Reference to secure credentials in vault
  syncFrequency: text('sync_frequency').notNull(),
  lastSync: timestamp('last_sync'),
  nextSync: timestamp('next_sync'),
  dataTypes: json('data_types').$type<string[]>(),
  configuration: jsonb('configuration'),
  mappingRules: jsonb('mapping_rules'),
  hipaaCompliant: boolean('hipaa_compliant').notNull().default(false),
  auditEnabled: boolean('audit_enabled').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// EHR Sync Logs
export const ehrSyncLogs = pgTable('healthcare_ehr_sync_logs', {
  id: serial('id').primaryKey(),
  integrationId: integer('integration_id').notNull().references(() => ehrIntegrations.id),
  startTime: timestamp('start_time').defaultNow().notNull(),
  endTime: timestamp('end_time'),
  status: text('status').notNull(), // success, failed, partial
  recordsProcessed: integer('records_processed').default(0),
  recordsSuccess: integer('records_success').default(0),
  recordsFailed: integer('records_failed').default(0),
  errorMessage: text('error_message'),
  details: jsonb('details'),
});

// EHR Integration Metrics
export const ehrIntegrationMetrics = pgTable('healthcare_ehr_integration_metrics', {
  id: serial('id').primaryKey(),
  integrationId: integer('integration_id').notNull().references(() => ehrIntegrations.id),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  uptime: decimal('uptime', { precision: 5, scale: 2 }).default('0'),
  responseTime: integer('response_time').default(0), // in milliseconds
  errorRate: decimal('error_rate', { precision: 5, scale: 2 }).default('0'),
  syncedRecords: integer('synced_records').default(0),
  requestCount: integer('request_count').default(0),
  averageRequestTime: integer('average_request_time').default(0),
  lastHealthCheck: timestamp('last_health_check'),
  healthCheckStatus: text('health_check_status'), // healthy, degraded, unhealthy
  metricsPeriod: text('metrics_period').notNull(), // daily, hourly, etc.
});

// Available EHR Integration templates
export const availableEhrIntegrations = pgTable('healthcare_available_ehr_integrations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type').notNull(), // FHIR, HL7, Proprietary
  version: text('version').notNull(),
  description: text('description').notNull(),
  setupComplexity: text('setup_complexity').notNull(), // Simple, Medium, Complex
  certifications: json('certifications').$type<string[]>(),
  dataAccess: json('data_access').$type<string[]>(),
  averageSetupTime: text('average_setup_time'),
  documentationUrl: text('documentation_url'),
  templateConfiguration: jsonb('template_configuration'),
  requiresCredentials: boolean('requires_credentials').default(true),
  supportedAuthMethods: json('supported_auth_methods').$type<string[]>(),
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
});

// Relations
export const ehrIntegrationsRelations = relations(ehrIntegrations, ({ many }) => ({
  syncLogs: many(ehrSyncLogs),
  metrics: many(ehrIntegrationMetrics),
}));

export const ehrSyncLogsRelations = relations(ehrSyncLogs, ({ one }) => ({
  integration: one(ehrIntegrations, {
    fields: [ehrSyncLogs.integrationId],
    references: [ehrIntegrations.id],
  }),
}));

export const ehrIntegrationMetricsRelations = relations(ehrIntegrationMetrics, ({ one }) => ({
  integration: one(ehrIntegrations, {
    fields: [ehrIntegrationMetrics.integrationId],
    references: [ehrIntegrations.id],
  }),
}));

// Zod schemas
export const ehrIntegrationsInsertSchema = createInsertSchema(ehrIntegrations, {
  name: (schema) => schema.min(3, "Name must be at least 3 characters"),
  type: (schema) => schema.refine(
    (val) => ['FHIR', 'HL7', 'Proprietary'].includes(val),
    "Type must be one of: FHIR, HL7, Proprietary"
  ),
  endpoint: (schema) => schema.url("Must be a valid URL"),
  status: (schema) => schema.refine(
    (val) => ['active', 'degraded', 'inactive'].includes(val),
    "Status must be one of: active, degraded, inactive"
  ),
});

export const ehrIntegrationsUpdateSchema = ehrIntegrationsInsertSchema.partial();

export const availableEhrIntegrationsInsertSchema = createInsertSchema(availableEhrIntegrations, {
  name: (schema) => schema.min(3, "Name must be at least 3 characters"),
  description: (schema) => schema.min(10, "Description must be at least 10 characters"),
  type: (schema) => schema.refine(
    (val) => ['FHIR', 'HL7', 'Proprietary'].includes(val),
    "Type must be one of: FHIR, HL7, Proprietary"
  ),
});

export const availableEhrIntegrationsUpdateSchema = availableEhrIntegrationsInsertSchema.partial();

// Create select schemas
const ehrIntegrationsSelectSchema = createSelectSchema(ehrIntegrations);
const ehrSyncLogsSelectSchema = createSelectSchema(ehrSyncLogs);
const ehrIntegrationMetricsSelectSchema = createSelectSchema(ehrIntegrationMetrics);
const availableEhrIntegrationsSelectSchema = createSelectSchema(availableEhrIntegrations);

// Export types
export type EhrIntegration = z.infer<typeof ehrIntegrationsSelectSchema>;
export type EhrIntegrationInsert = z.infer<typeof ehrIntegrationsInsertSchema>;
export type EhrIntegrationUpdate = z.infer<typeof ehrIntegrationsUpdateSchema>;

export type EhrSyncLog = z.infer<typeof ehrSyncLogsSelectSchema>;
export type EhrIntegrationMetric = z.infer<typeof ehrIntegrationMetricsSelectSchema>;

export type AvailableEhrIntegration = z.infer<typeof availableEhrIntegrationsSelectSchema>;
export type AvailableEhrIntegrationInsert = z.infer<typeof availableEhrIntegrationsInsertSchema>;
export type AvailableEhrIntegrationUpdate = z.infer<typeof availableEhrIntegrationsUpdateSchema>;