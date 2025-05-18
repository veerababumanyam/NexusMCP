import { pgTable, serial, text, integer, timestamp, boolean, json, foreignKey, varchar, jsonb, smallint } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';
import { workspaces, users } from './schema';

/**
 * SMTP Configurations Table
 * Stores SMTP server configurations for sending email notifications
 */
export const smtpConfigurations = pgTable("smtp_configurations", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  name: text("name").notNull(),
  host: text("host").notNull(),
  port: integer("port").notNull(),
  username: text("username").notNull(),
  // Password is encrypted at rest
  encryptedPassword: text("encrypted_password").notNull(),
  fromEmail: text("from_email").notNull(),
  fromName: text("from_name"),
  requireTls: boolean("require_tls").default(true),
  rejectUnauthorized: boolean("reject_unauthorized").default(true),
  environment: text("environment").default("production"), // production, staging, development
  isDefault: boolean("is_default").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastTestedAt: timestamp("last_tested_at"),
  testStatus: text("test_status"),
  maxRetries: integer("max_retries").default(3),
  retryInterval: integer("retry_interval").default(60), // seconds
});

/**
 * Notification Templates Table
 * Defines templates for various types of notifications
 */
export const notificationTemplates = pgTable("notification_templates", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // email, slack, teams, webhook, in-app, sms
  subject: text("subject"), // For email templates
  htmlBody: text("html_body"), // For email templates
  textBody: text("text_body"),
  variables: jsonb("variables").default({}), // Schema of available variables
  isSystem: boolean("is_system").default(false),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => users.id),
  lastModifiedBy: integer("last_modified_by").references(() => users.id),
  locale: text("locale").default("en"),
  brandingId: integer("branding_id"),
});

/**
 * Notification Channels Table
 * Configured notification delivery channels
 */
export const notificationChannels = pgTable("notification_channels", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  name: text("name").notNull(),
  type: text("type").notNull(), // email, slack, teams, webhook, in-app, sms
  configuration: jsonb("configuration").notNull(), // Channel-specific config
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  throttleLimit: integer("throttle_limit"), // Max notifications per interval
  throttleInterval: integer("throttle_interval"), // Interval in minutes
  defaultPriority: text("default_priority").default("normal"), // critical, high, normal, low
  createdBy: integer("created_by").references(() => users.id),
  testStatus: text("test_status"),
  lastTestedAt: timestamp("last_tested_at"),
});

/**
 * Alert Rules Table
 * Defines conditions for triggering alerts
 */
export const alertRules = pgTable("alert_rules", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  name: text("name").notNull(),
  description: text("description"),
  eventType: text("event_type"), // For event-based rules
  conditions: jsonb("conditions").notNull(), // JSON Logic conditions
  priority: text("priority").default("normal").notNull(), // critical, high, normal, low
  templateId: integer("template_id").references(() => notificationTemplates.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => users.id),
  cooldownPeriod: integer("cooldown_period").default(0), // minutes
  lastTriggeredAt: timestamp("last_triggered_at"),
  throttleCount: integer("throttle_count").default(0),
});

/**
 * Alert Rule Channels
 * Maps alert rules to notification channels
 */
export const alertRuleChannels = pgTable("alert_rule_channels", {
  id: serial("id").primaryKey(),
  ruleId: integer("rule_id").references(() => alertRules.id).notNull(),
  channelId: integer("channel_id").references(() => notificationChannels.id).notNull(),
  isActive: boolean("is_active").default(true),
  overridePriority: text("override_priority"), // Override the rule's priority for this channel
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Alert Rule Recipients 
 * Maps alert rules to specific recipients (users/groups)
 */
export const alertRuleRecipients = pgTable("alert_rule_recipients", {
  id: serial("id").primaryKey(),
  ruleId: integer("rule_id").references(() => alertRules.id).notNull(),
  type: text("type").notNull(), // user, role, email, group
  recipientId: integer("recipient_id"), // ID of user or role
  email: text("email"), // Direct email if type is 'email'
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * Notification Events
 * Records of triggered notifications
 */
export const notificationEvents = pgTable("notification_events", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  type: text("type").notNull(), // alert, system, user
  priority: text("priority").notNull(), // critical, high, normal, low
  title: text("title").notNull(),
  message: text("message").notNull(),
  source: text("source"), // The source system that generated this notification
  sourceId: text("source_id"), // ID in the source system
  metadata: jsonb("metadata").default({}), // Additional data
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  isRead: boolean("is_read").default(false),
  readAt: timestamp("read_at"),
  userId: integer("user_id").references(() => users.id), // The user this notification is for
  alertRuleId: integer("alert_rule_id").references(() => alertRules.id),
  relatedResourceType: text("related_resource_type"), // Type of resource this notification is about
  relatedResourceId: text("related_resource_id"), // ID of related resource
  actionUrl: text("action_url"), // URL to view more details
  iconName: text("icon_name"), // Icon to display with notification
});

/**
 * Notification Deliveries 
 * Records of actual notification sends across various channels
 */
export const notificationDeliveries = pgTable("notification_deliveries", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => notificationEvents.id).notNull(),
  channelId: integer("channel_id").references(() => notificationChannels.id),
  recipientId: integer("recipient_id"), // User ID or other recipient reference
  recipientAddress: text("recipient_address"), // Email, webhook URL, etc.
  status: text("status").notNull(), // pending, sent, delivered, failed, etc.
  statusDetails: text("status_details"),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  error: text("error"),
  retryCount: integer("retry_count").default(0),
  nextRetryAt: timestamp("next_retry_at"),
  metricsSent: boolean("metrics_sent").default(false),
  batchId: text("batch_id"), // For grouping related deliveries
  externalId: text("external_id"), // ID from external service
});

/**
 * User Notification Preferences
 * User-specific settings for notifications
 */
export const userNotificationPreferences = pgTable("user_notification_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  notificationType: text("notification_type").notNull(), // alert_type or category
  channels: jsonb("channels").default({}), // Enabled channels for this type
  isEnabled: boolean("is_enabled").default(true),
  quietHoursStart: smallint("quiet_hours_start"), // 0-23 hour of day
  quietHoursEnd: smallint("quiet_hours_end"), // 0-23 hour of day
  quietHoursDays: jsonb("quiet_hours_days").default([]), // Array of days 0-6 (Sunday-Saturday)
  digestEnabled: boolean("digest_enabled").default(false),
  digestFrequency: text("digest_frequency"), // daily, weekly
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Define Relations
 */
export const smtpConfigurationsRelations = relations(smtpConfigurations, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [smtpConfigurations.workspaceId],
    references: [workspaces.id],
  }),
}));

export const notificationTemplatesRelations = relations(notificationTemplates, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [notificationTemplates.workspaceId],
    references: [workspaces.id],
  }),
  createdByUser: one(users, {
    fields: [notificationTemplates.createdBy],
    references: [users.id],
  }),
  modifiedByUser: one(users, {
    fields: [notificationTemplates.lastModifiedBy],
    references: [users.id],
  }),
}));

export const notificationChannelsRelations = relations(notificationChannels, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [notificationChannels.workspaceId],
    references: [workspaces.id],
  }),
  createdByUser: one(users, {
    fields: [notificationChannels.createdBy],
    references: [users.id],
  }),
}));

export const alertRulesRelations = relations(alertRules, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [alertRules.workspaceId],
    references: [workspaces.id],
  }),
  createdByUser: one(users, {
    fields: [alertRules.createdBy],
    references: [users.id],
  }),
  template: one(notificationTemplates, {
    fields: [alertRules.templateId],
    references: [notificationTemplates.id],
  }),
  channels: many(alertRuleChannels),
  recipients: many(alertRuleRecipients),
}));

export const alertRuleChannelsRelations = relations(alertRuleChannels, ({ one }) => ({
  rule: one(alertRules, {
    fields: [alertRuleChannels.ruleId],
    references: [alertRules.id],
  }),
  channel: one(notificationChannels, {
    fields: [alertRuleChannels.channelId],
    references: [notificationChannels.id],
  }),
}));

export const alertRuleRecipientsRelations = relations(alertRuleRecipients, ({ one }) => ({
  rule: one(alertRules, {
    fields: [alertRuleRecipients.ruleId],
    references: [alertRules.id],
  }),
}));

export const notificationEventsRelations = relations(notificationEvents, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [notificationEvents.workspaceId],
    references: [workspaces.id],
  }),
  user: one(users, {
    fields: [notificationEvents.userId],
    references: [users.id],
  }),
  alertRule: one(alertRules, {
    fields: [notificationEvents.alertRuleId],
    references: [alertRules.id],
  }),
  deliveries: many(notificationDeliveries),
}));

export const notificationDeliveriesRelations = relations(notificationDeliveries, ({ one }) => ({
  event: one(notificationEvents, {
    fields: [notificationDeliveries.eventId],
    references: [notificationEvents.id],
  }),
  channel: one(notificationChannels, {
    fields: [notificationDeliveries.channelId],
    references: [notificationChannels.id],
  }),
}));

export const userNotificationPreferencesRelations = relations(userNotificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userNotificationPreferences.userId],
    references: [users.id],
  }),
  workspace: one(workspaces, {
    fields: [userNotificationPreferences.workspaceId],
    references: [workspaces.id],
  }),
}));

// Zod Schemas for API validation

export const smtpConfigurationSchema = createInsertSchema(smtpConfigurations, {
  name: (schema) => schema.min(1, "Name is required"),
  host: (schema) => schema.min(1, "SMTP host is required"),
  port: (schema) => schema.min(1, "Port is required"),
  username: (schema) => schema.min(1, "Username is required"),
  fromEmail: (schema) => schema.email("Must be a valid email address"),
});

// Schema without the encrypted password for client-side validation
export const createSmtpConfigSchema = z.object({
  name: z.string().min(1, "Name is required"),
  host: z.string().min(1, "SMTP host is required"),
  port: z.number().min(1, "Port is required"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  fromEmail: z.string().email("Must be a valid email address"),
  fromName: z.string().optional(),
  requireTls: z.boolean().default(true),
  rejectUnauthorized: z.boolean().default(true),
  environment: z.enum(["production", "staging", "development"]).default("production"),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
  workspaceId: z.number().optional(),
  maxRetries: z.number().min(0).max(10).default(3),
  retryInterval: z.number().min(10).max(3600).default(60),
});

export const notificationTemplateSchema = createInsertSchema(notificationTemplates, {
  name: (schema) => schema.min(1, "Name is required"),
  type: (schema) => schema.min(1, "Template type is required"),
});

export const notificationChannelSchema = createInsertSchema(notificationChannels, {
  name: (schema) => schema.min(1, "Name is required"),
  type: (schema) => schema.min(1, "Channel type is required"),
});

export const alertRuleSchema = createInsertSchema(alertRules, {
  name: (schema) => schema.min(1, "Name is required"),
});

export const userNotificationPreferencesSchema = createInsertSchema(userNotificationPreferences);

// Types
export type SmtpConfiguration = typeof smtpConfigurations.$inferSelect;
export type InsertSmtpConfiguration = typeof smtpConfigurations.$inferInsert;
export type CreateSmtpConfigInput = z.infer<typeof createSmtpConfigSchema>;

export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type InsertNotificationTemplate = typeof notificationTemplates.$inferInsert;

export type NotificationChannel = typeof notificationChannels.$inferSelect;
export type InsertNotificationChannel = typeof notificationChannels.$inferInsert;

export type AlertRule = typeof alertRules.$inferSelect;
export type InsertAlertRule = typeof alertRules.$inferInsert;

export type AlertRuleChannel = typeof alertRuleChannels.$inferSelect;
export type InsertAlertRuleChannel = typeof alertRuleChannels.$inferInsert;

export type AlertRuleRecipient = typeof alertRuleRecipients.$inferSelect;
export type InsertAlertRuleRecipient = typeof alertRuleRecipients.$inferInsert;

export type NotificationEvent = typeof notificationEvents.$inferSelect;
export type InsertNotificationEvent = typeof notificationEvents.$inferInsert;

export type NotificationDelivery = typeof notificationDeliveries.$inferSelect;
export type InsertNotificationDelivery = typeof notificationDeliveries.$inferInsert;

export type UserNotificationPreference = typeof userNotificationPreferences.$inferSelect;
export type InsertUserNotificationPreference = typeof userNotificationPreferences.$inferInsert;

// Test SMTP connection schema
export const testSmtpConnectionSchema = z.object({
  host: z.string().min(1, "SMTP host is required"),
  port: z.number().min(1, "Port is required"),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  fromEmail: z.string().email("Must be a valid email address"),
  requireTls: z.boolean().default(true),
  rejectUnauthorized: z.boolean().default(true),
  testRecipient: z.string().email("Must provide a valid test recipient email"),
});