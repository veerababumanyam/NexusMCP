import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';

/**
 * Messaging Configurations Table
 * Stores all messaging platform configurations for the application
 */
export const messagingConfigurations = pgTable('messaging_configurations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  platform: text('platform').notNull(), // 'slack', 'ms_teams', 'webhook', etc.
  isDefault: boolean('is_default').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  credentials: jsonb('credentials'), // API tokens, authentication details (encrypted)
  webhookUrl: text('webhook_url'),
  channelId: text('channel_id'),
  botToken: text('bot_token'),
  additionalConfig: jsonb('additional_config'), // Platform-specific configurations
  status: text('status').default('unknown'), // 'healthy', 'degraded', 'failed', 'unknown'
  statusMessage: text('status_message'),
  lastTested: timestamp('last_tested'),
  workspaceId: integer('workspace_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdBy: integer('created_by'),
  updatedBy: integer('updated_by')
});

/**
 * SMS Configurations Table
 * Stores all SMS provider configurations
 */
export const smsConfigurations = pgTable('sms_configurations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  provider: text('provider').notNull(), // 'twilio', 'vonage', 'plivo', etc.
  isDefault: boolean('is_default').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  accountSid: text('account_sid'), // Twilio Account SID or equivalent
  authToken: text('auth_token'), // Twilio Auth Token or equivalent
  fromNumber: text('from_number'), // Default sender phone number
  additionalConfig: jsonb('additional_config'), // Provider-specific configurations
  status: text('status').default('unknown'), // 'healthy', 'degraded', 'failed', 'unknown'
  statusMessage: text('status_message'),
  lastTested: timestamp('last_tested'),
  workspaceId: integer('workspace_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdBy: integer('created_by'),
  updatedBy: integer('updated_by')
});

/**
 * Message Templates Table
 * Stores reusable message templates for different platforms
 */
export const messageTemplates = pgTable('message_templates', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').notNull(), // 'alert', 'notification', 'status_update', etc.
  platform: text('platform').notNull(), // 'slack', 'ms_teams', 'sms', 'all'
  content: text('content').notNull(), // Message content with variable placeholders
  format: text('format').default('plain'), // 'plain', 'markdown', 'html', 'slack_blocks'
  variables: jsonb('variables'), // Defined variables that can be used in this template
  blocks: jsonb('blocks'), // For Slack Block Kit or MS Teams Adaptive Cards
  workspaceId: integer('workspace_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdBy: integer('created_by'),
  updatedBy: integer('updated_by')
});

/**
 * Message Delivery Logs Table
 * Records all message sending activity
 */
export const messageDeliveryLogs = pgTable('message_delivery_logs', {
  id: serial('id').primaryKey(),
  platform: text('platform').notNull(), // 'slack', 'ms_teams', 'sms', etc.
  recipient: text('recipient').notNull(), // Channel ID, phone number, etc.
  subject: text('subject'),
  messageContent: text('message_content'),
  status: text('status').notNull(), // 'delivered', 'failed', 'pending'
  configId: integer('config_id'), // Reference to either messaging_configurations or sms_configurations
  templateId: integer('template_id'),
  messageId: text('message_id'), // Platform's message ID
  sentAt: timestamp('sent_at').defaultNow().notNull(),
  deliveredAt: timestamp('delivered_at'),
  failureReason: text('failure_reason'),
  metadata: jsonb('metadata'),
  workspaceId: integer('workspace_id'),
  createdBy: integer('created_by')
});

// Relations between tables
export const messagingConfigurationsRelations = relations(messagingConfigurations, ({ many }) => ({
  logs: many(messageDeliveryLogs)
}));

export const smsConfigurationsRelations = relations(smsConfigurations, ({ many }) => ({
  logs: many(messageDeliveryLogs)
}));

export const messageTemplatesRelations = relations(messageTemplates, ({ many }) => ({
  logs: many(messageDeliveryLogs)
}));

export const messageDeliveryLogsRelations = relations(messageDeliveryLogs, ({ one }) => ({
  messagingConfig: one(messagingConfigurations, {
    fields: [messageDeliveryLogs.configId],
    references: [messagingConfigurations.id]
  }),
  smsConfig: one(smsConfigurations, {
    fields: [messageDeliveryLogs.configId],
    references: [smsConfigurations.id]
  }),
  template: one(messageTemplates, {
    fields: [messageDeliveryLogs.templateId],
    references: [messageTemplates.id]
  })
}));

// Zod schemas for validation
export const messagingConfigurationInsertSchema = createInsertSchema(messagingConfigurations, {
  name: (schema) => schema.min(3, "Name must be at least 3 characters"),
  description: (schema) => schema.optional(),
  platform: () => z.enum([
    'slack', 'ms_teams', 'webhook', 'generic_webhook', 'custom'
  ]),
  credentials: () => z.any().optional(),
  webhookUrl: (schema) => schema.optional().nullable().refine(
    (val) => !val || val.startsWith('https://'),
    { message: "Webhook URL must use HTTPS" }
  ),
  additionalConfig: () => z.any().optional()
});

export type MessagingConfigurationInsert = z.infer<typeof messagingConfigurationInsertSchema>;
export const messagingConfigurationSelectSchema = createSelectSchema(messagingConfigurations);
export type MessagingConfiguration = z.infer<typeof messagingConfigurationSelectSchema>;

export const smsConfigurationInsertSchema = createInsertSchema(smsConfigurations, {
  name: (schema) => schema.min(3, "Name must be at least 3 characters"),
  description: (schema) => schema.optional(),
  provider: () => z.enum([
    'twilio', 'vonage', 'plivo', 'aws_sns', 'custom'
  ]),
  fromNumber: (schema) => schema.optional().nullable().refine(
    (val) => !val || /^\+[1-9]\d{1,14}$/.test(val),
    { message: "Phone number must be in E.164 format (e.g. +12125551234)" }
  ),
  additionalConfig: () => z.any().optional()
});

export type SmsConfigurationInsert = z.infer<typeof smsConfigurationInsertSchema>;
export const smsConfigurationSelectSchema = createSelectSchema(smsConfigurations);
export type SmsConfiguration = z.infer<typeof smsConfigurationSelectSchema>;

export const messageTemplateInsertSchema = createInsertSchema(messageTemplates, {
  name: (schema) => schema.min(3, "Template name must be at least 3 characters"),
  description: (schema) => schema.optional(),
  type: () => z.enum([
    "alert", 
    "notification", 
    "status_update", 
    "incident", 
    "report", 
    "welcome",
    "custom"
  ]),
  platform: () => z.enum([
    "slack", 
    "ms_teams", 
    "sms", 
    "all"
  ]),
  content: (schema) => schema.min(5, "Content must be at least 5 characters"),
  format: () => z.enum([
    "plain", 
    "markdown", 
    "html", 
    "slack_blocks", 
    "adaptive_cards"
  ]),
  variables: () => z.any().optional(),
  blocks: () => z.any().optional()
});

export type MessageTemplateInsert = z.infer<typeof messageTemplateInsertSchema>;
export const messageTemplateSelectSchema = createSelectSchema(messageTemplates);
export type MessageTemplate = z.infer<typeof messageTemplateSelectSchema>;

export const messageDeliveryLogInsertSchema = createInsertSchema(messageDeliveryLogs, {
  platform: () => z.enum(['slack', 'ms_teams', 'sms', 'webhook']),
  recipient: (schema) => schema.min(1, "Recipient is required"),
  status: () => z.enum(['delivered', 'failed', 'pending']),
  metadata: () => z.any().optional()
});

export type MessageDeliveryLogInsert = z.infer<typeof messageDeliveryLogInsertSchema>;
export const messageDeliveryLogSelectSchema = createSelectSchema(messageDeliveryLogs);
export type MessageDeliveryLog = z.infer<typeof messageDeliveryLogSelectSchema>;

// Test message schema
export const testMessageSchema = z.object({
  recipient: z.string().min(1, "Recipient is required"),
  content: z.string().min(5, "Message content is required"),
  configId: z.number().int().positive("Configuration is required")
});

export type TestMessage = z.infer<typeof testMessageSchema>;

// Test SMS schema
export const testSmsSchema = z.object({
  phoneNumber: z.string().refine(
    (val) => /^\+[1-9]\d{1,14}$/.test(val),
    { message: "Phone number must be in E.164 format (e.g. +12125551234)" }
  ),
  message: z.string().min(1, "Message is required"),
  configId: z.number().int().positive("SMS configuration is required")
});

export type TestSms = z.infer<typeof testSmsSchema>;