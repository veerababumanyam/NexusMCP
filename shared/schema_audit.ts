import { 
  pgTable, 
  serial, 
  text, 
  integer, 
  timestamp, 
  boolean, 
  json, 
  primaryKey,
  varchar,
  pgEnum
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';

// Enhanced Audit Logs
export const enhancedAuditLogs = pgTable('enhanced_audit_logs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id'),
  action: text('action').notNull(),
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id'),
  status: text('status').default('info').notNull(), // success, failure, warning, info
  severity: text('severity').default('info').notNull(), // critical, high, medium, low, info
  workspaceId: integer('workspace_id'),
  serverId: integer('server_id'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  deviceId: text('device_id'),
  sessionId: text('session_id'),
  geoLocation: json('geo_location'),
  details: json('details'),
  requestPayload: json('request_payload'),
  responsePayload: json('response_payload'),
  parentEventId: integer('parent_event_id'),
  correlationId: text('correlation_id'),
  traceId: text('trace_id'),
  complianceCategory: text('compliance_category'),
  tags: text('tags'),
  hashedPayload: text('hashed_payload'),
  isEncrypted: boolean('is_encrypted').default(false),
  integrityChecksum: text('integrity_checksum'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Audit Settings
export const auditSettings = pgTable('audit_settings', {
  id: serial('id').primaryKey(),
  workspaceId: integer('workspace_id').unique(),
  retentionPeriodDays: integer('retention_period_days').default(90).notNull(),
  encryptionEnabled: boolean('encryption_enabled').default(true).notNull(),
  maskPii: boolean('mask_pii').default(true).notNull(),
  logLevel: text('log_level').default('info').notNull(), // debug, info, warning, error, critical
  alertingEnabled: boolean('alerting_enabled').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Encryption Keys
export const encryptionKeys = pgTable('encryption_keys', {
  id: serial('id').primaryKey(),
  keyIdentifier: text('key_identifier').notNull().unique(),
  keyType: text('key_type').notNull(), // aes, hmac, etc.
  status: text('status').default('active').notNull(), // active, archived, revoked
  keyData: text('key_data').notNull(),
  effectiveFrom: timestamp('effective_from').defaultNow().notNull(),
  effectiveUntil: timestamp('effective_until'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Alert Events
export const alertEvents = pgTable('alert_events', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  severity: text('severity').default('medium').notNull(), // critical, high, medium, low, info
  status: text('status').default('new').notNull(), // new, acknowledged, resolved, false_positive
  workspaceId: integer('workspace_id'),
  logIds: json('log_ids'), // array of audit log IDs
  resolutionNotes: text('resolution_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  acknowledgedAt: timestamp('acknowledged_at'),
  resolvedAt: timestamp('resolved_at'),
  updatedAt: timestamp('updated_at'),
});

// Audit Log Archives
export const auditLogArchives = pgTable('audit_log_archives', {
  id: serial('id').primaryKey(),
  batchId: text('batch_id').notNull().unique(),
  fromTimestamp: timestamp('from_timestamp').notNull(),
  toTimestamp: timestamp('to_timestamp').notNull(),
  workspaceId: integer('workspace_id'),
  recordCount: integer('record_count').notNull(),
  storageLocation: text('storage_location'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Audit Integrity Checks
export const auditIntegrityChecks = pgTable('audit_integrity_checks', {
  id: serial('id').primaryKey(),
  workspaceId: integer('workspace_id'),
  logsChecked: integer('logs_checked').notNull(),
  issuesFound: integer('issues_found').default(0).notNull(),
  issueDetails: json('issue_details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  userId: integer('user_id'), // user who initiated the check
});

// Define relations
export const enhancedAuditLogsRelations = relations(enhancedAuditLogs, ({ one }) => ({
  parent: one(enhancedAuditLogs, {
    fields: [enhancedAuditLogs.parentEventId],
    references: [enhancedAuditLogs.id],
  }),
}));

export const auditSettingsRelations = relations(auditSettings, ({ many }) => ({
  logs: many(enhancedAuditLogs),
  alerts: many(alertEvents),
  archives: many(auditLogArchives),
  integrityChecks: many(auditIntegrityChecks),
}));

// Define validation schemas
export const enhancedAuditLogInsertSchema = createInsertSchema(enhancedAuditLogs);
export type InsertEnhancedAuditLog = z.infer<typeof enhancedAuditLogInsertSchema>;

export const enhancedAuditLogSelectSchema = createSelectSchema(enhancedAuditLogs);
export type EnhancedAuditLog = z.infer<typeof enhancedAuditLogSelectSchema>;

export const auditSettingsInsertSchema = createInsertSchema(auditSettings);
export type InsertAuditSettings = z.infer<typeof auditSettingsInsertSchema>;

export const auditSettingsSelectSchema = createSelectSchema(auditSettings);
export type AuditSettings = z.infer<typeof auditSettingsSelectSchema>;

export const alertEventInsertSchema = createInsertSchema(alertEvents);
export type InsertAlertEvent = z.infer<typeof alertEventInsertSchema>;

export const alertEventSelectSchema = createSelectSchema(alertEvents);
export type AlertEvent = z.infer<typeof alertEventSelectSchema>;

export const auditLogArchiveInsertSchema = createInsertSchema(auditLogArchives);
export type InsertAuditLogArchive = z.infer<typeof auditLogArchiveInsertSchema>;

export const auditLogArchiveSelectSchema = createSelectSchema(auditLogArchives);
export type AuditLogArchive = z.infer<typeof auditLogArchiveSelectSchema>;

export const auditIntegrityCheckInsertSchema = createInsertSchema(auditIntegrityChecks);
export type InsertAuditIntegrityCheck = z.infer<typeof auditIntegrityCheckInsertSchema>;

export const auditIntegrityCheckSelectSchema = createSelectSchema(auditIntegrityChecks);
export type AuditIntegrityCheck = z.infer<typeof auditIntegrityCheckSelectSchema>;

// Export custom combined schema
export const combinedAuditSchema = {
  enhancedAuditLogs,
  auditSettings,
  encryptionKeys,
  alertEvents,
  auditLogArchives,
  auditIntegrityChecks,
};