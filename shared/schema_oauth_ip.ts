/**
 * Schema definitions for OAuth2 IP Access Control
 */
import { pgTable, serial, text, timestamp, integer, boolean, time } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { oauthClients, oauthAccessTokens } from './schema_oauth';
import { users } from './schema';

/**
 * OAuth IP Allowlist Table
 * Tracks allowed IP addresses for each OAuth client
 */
export const oauthIpAllowlist = pgTable('oauth_ip_allowlist', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').notNull().references(() => oauthClients.id, { onDelete: 'cascade' }),
  ipAddress: text('ip_address').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: integer('created_by').references(() => users.id),
  updatedBy: integer('updated_by').references(() => users.id),
  enabled: boolean('enabled').default(true).notNull()
});

// Create schema for inserting IP allowlist entries
export const oauthIpAllowlistInsertSchema = createInsertSchema(oauthIpAllowlist, {
  ipAddress: (schema) => schema.regex(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}(\/[0-9]{1,2})?$/, 'Must be a valid IPv4 address or CIDR notation')
});
export type OAuthIpAllowlistInsert = z.infer<typeof oauthIpAllowlistInsertSchema>;

// Create schema for selecting IP allowlist entries
export const oauthIpAllowlistSelectSchema = createSelectSchema(oauthIpAllowlist);
export type OAuthIpAllowlist = z.infer<typeof oauthIpAllowlistSelectSchema>;

/**
 * OAuth IP Access Logs Table
 * Tracks all access attempts with IP information
 */
export const oauthIpAccessLogs = pgTable('oauth_ip_access_logs', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').notNull().references(() => oauthClients.id, { onDelete: 'cascade' }),
  tokenId: integer('token_id').references(() => oauthAccessTokens.id, { onDelete: 'set null' }),
  ipAddress: text('ip_address').notNull(),
  userAgent: text('user_agent'),
  requestPath: text('request_path').notNull(),
  accessStatus: text('access_status').notNull(), // 'allowed', 'denied', 'invalid_token', etc.
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  details: text('details').$type<Record<string, any>>()
});

// Create schema for inserting IP access logs
export const oauthIpAccessLogsInsertSchema = createInsertSchema(oauthIpAccessLogs);
export type OAuthIpAccessLogsInsert = z.infer<typeof oauthIpAccessLogsInsertSchema>;

// Create schema for selecting IP access logs
export const oauthIpAccessLogsSelectSchema = createSelectSchema(oauthIpAccessLogs);
export type OAuthIpAccessLogs = z.infer<typeof oauthIpAccessLogsSelectSchema>;

/**
 * OAuth Client Activation Windows Table
 * Defines time windows when OAuth clients are allowed to access
 */
export const oauthClientActivationWindows = pgTable('oauth_client_activation_windows', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').notNull().references(() => oauthClients.id, { onDelete: 'cascade' }),
  dayOfWeek: integer('day_of_week').notNull(), // 0-6 (Sunday to Saturday)
  startTime: time('start_time').notNull(),
  endTime: time('end_time').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: integer('created_by').references(() => users.id),
  updatedBy: integer('updated_by').references(() => users.id),
  enabled: boolean('enabled').default(true).notNull()
});

// Create schema for inserting client activation windows
export const oauthClientActivationWindowsInsertSchema = createInsertSchema(oauthClientActivationWindows, {
  dayOfWeek: (schema) => schema.min(0, 'Day of week must be 0-6').max(6, 'Day of week must be 0-6')
});
export type OAuthClientActivationWindowsInsert = z.infer<typeof oauthClientActivationWindowsInsertSchema>;

// Create schema for selecting client activation windows
export const oauthClientActivationWindowsSelectSchema = createSelectSchema(oauthClientActivationWindows);
export type OAuthClientActivationWindows = z.infer<typeof oauthClientActivationWindowsSelectSchema>;

// Extended OAuth Client schema with IP restrictions
export const extendedOAuthClientSchema = z.object({
  enforceIpAllowlist: z.boolean().optional(),
  enforceTimeRestrictions: z.boolean().optional(),
  autoRevokeOnViolation: z.boolean().optional(),
  maxViolations: z.number().int().min(1).optional(),
  violationCount: z.number().int().min(0).optional(),
  lastViolationAt: z.date().optional().nullable()
});