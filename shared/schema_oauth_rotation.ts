/**
 * Schema definitions for OAuth2 Token Rotation and Monitoring
 */
import { pgTable, serial, text, timestamp, integer, boolean, jsonb, date } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { oauthClients, oauthAccessTokens } from './schema_oauth';
import { users } from './schema';

/**
 * OAuth Client Secret History Table
 * Tracks history of client secret rotations
 */
export const oauthClientSecretHistory = pgTable('oauth_client_secret_history', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').notNull().references(() => oauthClients.id, { onDelete: 'cascade' }),
  clientSecretHash: text('client_secret_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiredAt: timestamp('expired_at', { withTimezone: true }),
  createdBy: integer('created_by').references(() => users.id),
  rotationReason: text('rotation_reason')
});

// Create schema for inserting secret history entries
export const oauthClientSecretHistoryInsertSchema = createInsertSchema(oauthClientSecretHistory);
export type OAuthClientSecretHistoryInsert = z.infer<typeof oauthClientSecretHistoryInsertSchema>;

// Create schema for selecting secret history entries
export const oauthClientSecretHistorySelectSchema = createSelectSchema(oauthClientSecretHistory);
export type OAuthClientSecretHistory = z.infer<typeof oauthClientSecretHistorySelectSchema>;

/**
 * OAuth Token Usage Statistics Table
 * Tracks usage patterns for monitoring and alerting
 */
export const oauthTokenUsageStats = pgTable('oauth_token_usage_stats', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').notNull().references(() => oauthClients.id, { onDelete: 'cascade' }),
  date: date('date').notNull(),
  tokenRequests: integer('token_requests').default(0),
  tokenDenials: integer('token_denials').default(0),
  apiRequests: integer('api_requests').default(0),
  uniqueIps: integer('unique_ips').default(0)
});

// Create schema for inserting token usage stats
export const oauthTokenUsageStatsInsertSchema = createInsertSchema(oauthTokenUsageStats);
export type OAuthTokenUsageStatsInsert = z.infer<typeof oauthTokenUsageStatsInsertSchema>;

// Create schema for selecting token usage stats
export const oauthTokenUsageStatsSelectSchema = createSelectSchema(oauthTokenUsageStats);
export type OAuthTokenUsageStats = z.infer<typeof oauthTokenUsageStatsSelectSchema>;

/**
 * OAuth Security Events Table
 * Tracks security-related events for clients and tokens
 */
export const oauthSecurityEvents = pgTable('oauth_security_events', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').references(() => oauthClients.id, { onDelete: 'cascade' }),
  tokenId: integer('token_id').references(() => oauthAccessTokens.id, { onDelete: 'set null' }),
  eventType: text('event_type').notNull(), // 'suspicious_ip', 'excessive_requests', 'rotation_reminder', etc.
  eventTime: timestamp('event_time', { withTimezone: true }).defaultNow().notNull(),
  severity: text('severity').notNull(), // 'info', 'warning', 'critical'
  description: text('description').notNull(),
  details: jsonb('details'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedBy: integer('resolved_by').references(() => users.id),
  resolutionNotes: text('resolution_notes')
});

// Create schema for inserting security events
export const oauthSecurityEventsInsertSchema = createInsertSchema(oauthSecurityEvents, {
  eventType: (schema) => schema.refine(
    value => ['suspicious_ip', 'excessive_requests', 'rotation_reminder', 'failed_auth', 'client_disabled', 'token_revoked'].includes(value),
    { message: 'Invalid event type' }
  ),
  severity: (schema) => schema.refine(
    value => ['info', 'warning', 'critical'].includes(value),
    { message: 'Severity must be "info", "warning", or "critical"' }
  )
});
export type OAuthSecurityEventsInsert = z.infer<typeof oauthSecurityEventsInsertSchema>;

// Create schema for selecting security events
export const oauthSecurityEventsSelectSchema = createSelectSchema(oauthSecurityEvents);
export type OAuthSecurityEvents = z.infer<typeof oauthSecurityEventsSelectSchema>;

/**
 * OAuth Notification Settings Table
 * Configures notification preferences for OAuth security events
 */
export const oauthNotificationSettings = pgTable('oauth_notification_settings', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  notifyCredentialExpiry: boolean('notify_credential_expiry').default(true),
  notifySuspiciousActivity: boolean('notify_suspicious_activity').default(true),
  notifyClientDisabled: boolean('notify_client_disabled').default(true),
  emailNotifications: boolean('email_notifications').default(true),
  dashboardNotifications: boolean('dashboard_notifications').default(true),
  webhookUrl: text('webhook_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// Create schema for inserting notification settings
export const oauthNotificationSettingsInsertSchema = createInsertSchema(oauthNotificationSettings, {
  webhookUrl: (schema) => schema.url().optional().nullable().or(z.literal(''))
});
export type OAuthNotificationSettingsInsert = z.infer<typeof oauthNotificationSettingsInsertSchema>;

// Create schema for selecting notification settings
export const oauthNotificationSettingsSelectSchema = createSelectSchema(oauthNotificationSettings);
export type OAuthNotificationSettings = z.infer<typeof oauthNotificationSettingsSelectSchema>;

// Extended OAuth Client schema with rotation fields
export const extendedOAuthClientRotationSchema = z.object({
  secretExpiresAt: z.date().optional().nullable(),
  secretLastRotatedAt: z.date().optional().nullable(),
  requireRotation: z.boolean().optional(),
  rotationPeriodDays: z.number().int().min(1).optional(),
  rotationNotificationDays: z.number().int().min(1).optional()
});