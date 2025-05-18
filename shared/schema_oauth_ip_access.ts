/**
 * Schema definitions for OAuth2 IP Access Control
 */
import { pgTable, serial, text, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';
import { oauthClients } from './schema_oauth';

/**
 * OAuth IP Allowlist
 * Stores allowed IP addresses for OAuth clients
 */
export const oauthIpAllowlist = pgTable('oauth_ip_allowlist', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').notNull().references(() => oauthClients.id),
  ipAddress: text('ip_address').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: integer('created_by'),
  updatedBy: integer('updated_by'),
  isActive: boolean('is_active').default(true)
});

/**
 * OAuth IP Access Logs
 * Tracks access attempts and their allowed/denied status
 */
export const oauthIpAccessLogs = pgTable('oauth_ip_access_logs', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').notNull().references(() => oauthClients.id),
  ipAddress: text('ip_address').notNull(),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  allowed: boolean('allowed').notNull(),
  reason: text('reason'),
  details: jsonb('details')
});

/**
 * OAuth Client Activation Windows
 * Defines when clients can access the system
 */
export const oauthClientActivationWindows = pgTable('oauth_client_activation_windows', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').notNull().references(() => oauthClients.id),
  dayOfWeek: integer('day_of_week').notNull(), // 0-6 (Sunday to Saturday)
  startTime: text('start_time').notNull(), // 24-hour format, e.g. "09:00"
  endTime: text('end_time').notNull(), // 24-hour format, e.g. "17:00"
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: integer('created_by'),
  updatedBy: integer('updated_by'),
  isActive: boolean('is_active').default(true)
});

// Define relations
export const oauthIpAllowlistRelations = relations(oauthIpAllowlist, ({ one }) => ({
  client: one(oauthClients, {
    fields: [oauthIpAllowlist.clientId],
    references: [oauthClients.id]
  })
}));

export const oauthIpAccessLogsRelations = relations(oauthIpAccessLogs, ({ one }) => ({
  client: one(oauthClients, {
    fields: [oauthIpAccessLogs.clientId],
    references: [oauthClients.id]
  })
}));

export const oauthClientActivationWindowsRelations = relations(oauthClientActivationWindows, ({ one }) => ({
  client: one(oauthClients, {
    fields: [oauthClientActivationWindows.clientId],
    references: [oauthClients.id]
  })
}));

// Create schemas for validation
export const oauthIpAllowlistInsertSchema = createInsertSchema(oauthIpAllowlist, {
  ipAddress: (schema) => schema.min(1, "IP address is required")
});
export type OAuthIpAllowlistInsert = z.infer<typeof oauthIpAllowlistInsertSchema>;

export const oauthIpAllowlistSelectSchema = createSelectSchema(oauthIpAllowlist);
export type OAuthIpAllowlist = z.infer<typeof oauthIpAllowlistSelectSchema>;

export const oauthIpAccessLogsInsertSchema = createInsertSchema(oauthIpAccessLogs);
export type OAuthIpAccessLogInsert = z.infer<typeof oauthIpAccessLogsInsertSchema>;

export const oauthIpAccessLogsSelectSchema = createSelectSchema(oauthIpAccessLogs);
export type OAuthIpAccessLog = z.infer<typeof oauthIpAccessLogsSelectSchema>;

export const oauthClientActivationWindowsInsertSchema = createInsertSchema(oauthClientActivationWindows, {
  dayOfWeek: (schema) => schema.min(0, "Day of week must be between 0 and 6").max(6, "Day of week must be between 0 and 6"),
  startTime: (schema) => schema.min(1, "Start time is required"),
  endTime: (schema) => schema.min(1, "End time is required")
});
export type OAuthClientActivationWindowInsert = z.infer<typeof oauthClientActivationWindowsInsertSchema>;

export const oauthClientActivationWindowsSelectSchema = createSelectSchema(oauthClientActivationWindows);
export type OAuthClientActivationWindow = z.infer<typeof oauthClientActivationWindowsSelectSchema>;