import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';

/**
 * SMTP Configurations Table
 * Stores all SMTP server configurations for the platform
 */
export const smtpConfigurations = pgTable('smtp_configurations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  provider: text('provider').notNull(), // 'custom', 'sendgrid', 'microsoft365', 'postfix', etc.
  isDefault: boolean('is_default').default(false).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  hostname: text('hostname').notNull(),
  port: integer('port').notNull(),
  encryption: text('encryption').notNull(), // 'none', 'ssl', 'tls', 'starttls'
  authType: text('auth_type').notNull(), // 'none', 'plain', 'login', 'cram-md5', 'oauth2'
  username: text('username'),
  password: text('password'),
  senderName: text('sender_name'),
  senderEmail: text('sender_email'),
  replyToEmail: text('reply_to_email'),
  apiKey: text('api_key'),
  connectionTimeout: integer('connection_timeout').default(30),
  advanced: jsonb('advanced'),
  lastTested: timestamp('last_tested'),
  status: text('status').default('unknown'), // 'healthy', 'degraded', 'failed', 'unknown'
  statusMessage: text('status_message'),
  workspaceId: integer('workspace_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdBy: integer('created_by'),
  updatedBy: integer('updated_by')
});

/**
 * Email Templates Table
 * Stores reusable email templates
 */
export const emailTemplates = pgTable('email_templates', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').notNull(), // 'welcome', 'password_reset', 'account_verification', etc.
  subject: text('subject').notNull(),
  bodyHtml: text('body_html').notNull(),
  bodyText: text('body_text').notNull(),
  variables: jsonb('variables'),
  workspaceId: integer('workspace_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdBy: integer('created_by'),
  updatedBy: integer('updated_by')
});

/**
 * Email Delivery Logs Table
 * Records all email sending activity
 */
export const emailLogs = pgTable('email_logs', {
  id: serial('id').primaryKey(),
  recipient: text('recipient').notNull(),
  subject: text('subject').notNull(),
  status: text('status').notNull(), // 'delivered', 'bounced', 'delayed', 'pending'
  smtpConfigId: integer('smtp_config_id'),
  templateId: integer('template_id'),
  messageId: text('message_id'),
  sentAt: timestamp('sent_at').defaultNow().notNull(),
  deliveredAt: timestamp('delivered_at'),
  bounceReason: text('bounce_reason'),
  metadata: jsonb('metadata'),
  workspaceId: integer('workspace_id'),
  createdBy: integer('created_by')
});

// Relations between tables
export const smtpConfigurationsRelations = relations(smtpConfigurations, ({ many }) => ({
  logs: many(emailLogs)
}));

export const emailTemplatesRelations = relations(emailTemplates, ({ many }) => ({
  logs: many(emailLogs)
}));

export const emailLogsRelations = relations(emailLogs, ({ one }) => ({
  smtpConfig: one(smtpConfigurations, {
    fields: [emailLogs.smtpConfigId],
    references: [smtpConfigurations.id]
  }),
  template: one(emailTemplates, {
    fields: [emailLogs.templateId],
    references: [emailTemplates.id]
  })
}));

// Zod schemas for validation
export const smtpConfigurationInsertSchema = createInsertSchema(smtpConfigurations, {
  name: (schema) => schema.min(3, "Name must be at least 3 characters"),
  description: (schema) => schema.optional(),
  provider: () => z.enum([
    'custom', 'sendgrid', 'microsoft365', 'postfix', 'gmail', 'mailgun', 'amazon_ses', 'other'
  ]),
  encryption: () => z.enum(['none', 'ssl', 'tls', 'starttls']),
  authType: () => z.enum(['none', 'plain', 'login', 'cram-md5', 'oauth2']),
  senderEmail: (schema) => schema.optional().nullable().refine(
    (val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
    { message: "Invalid email address" }
  ),
  replyToEmail: (schema) => schema.optional().nullable().refine(
    (val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
    { message: "Invalid email address" }
  ),
  advanced: () => z.any().optional()
});

export type SmtpConfigurationInsert = z.infer<typeof smtpConfigurationInsertSchema>;
export const smtpConfigurationSelectSchema = createSelectSchema(smtpConfigurations);
export type SmtpConfiguration = z.infer<typeof smtpConfigurationSelectSchema>;

export const emailTemplateInsertSchema = createInsertSchema(emailTemplates, {
  name: (schema) => schema.min(3, "Template name must be at least 3 characters"),
  description: (schema) => schema.optional(),
  type: () => z.enum([
    "welcome", 
    "password_reset", 
    "account_verification", 
    "notification", 
    "alert", 
    "report", 
    "invitation",
    "custom"
  ]),
  subject: (schema) => schema.min(3, "Subject must be at least 3 characters"),
  bodyHtml: (schema) => schema.min(10, "HTML body must be at least 10 characters"),
  bodyText: (schema) => schema.min(10, "Text body must be at least 10 characters"),
  variables: () => z.any().optional()
});

export type EmailTemplateInsert = z.infer<typeof emailTemplateInsertSchema>;
export const emailTemplateSelectSchema = createSelectSchema(emailTemplates);
export type EmailTemplate = z.infer<typeof emailTemplateSelectSchema>;

export const emailLogInsertSchema = createInsertSchema(emailLogs, {
  recipient: (schema) => schema.refine(
    (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
    { message: "Invalid email address" }
  ),
  status: () => z.enum(['delivered', 'bounced', 'delayed', 'pending']),
  metadata: () => z.any().optional()
});

export type EmailLogInsert = z.infer<typeof emailLogInsertSchema>;
export const emailLogSelectSchema = createSelectSchema(emailLogs);
export type EmailLog = z.infer<typeof emailLogSelectSchema>;

// Test email schema
export const testEmailSchema = z.object({
  recipient: z.string().email("Must be a valid email"),
  subject: z.string().min(3, "Subject is required"),
  message: z.string().min(10, "Message is required"),
  smtpConfigId: z.number().int().positive("SMTP configuration is required")
});

export type TestEmail = z.infer<typeof testEmailSchema>;