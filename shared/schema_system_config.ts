import { pgTable, serial, text, boolean, timestamp, integer } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';
import { workspaces, users } from './schema';

/**
 * System Branding Configuration
 */
export const systemBranding = pgTable('system_branding', {
  id: serial('id').primaryKey(),
  organizationName: text('organization_name').notNull(),
  logo: text('logo'),
  favicon: text('favicon'),
  primaryColor: text('primary_color').notNull(),
  secondaryColor: text('secondary_color').notNull(),
  accentColor: text('accent_color').notNull(),
  enableDarkMode: boolean('enable_dark_mode').default(true).notNull(),
  defaultTheme: text('default_theme').default('system').notNull(), // 'light', 'dark', 'system'
  primaryFontFamily: text('primary_font_family').notNull(),
  secondaryFontFamily: text('secondary_font_family').notNull(),
  copyrightText: text('copyright_text'),
  customCss: text('custom_css'),
  customJs: text('custom_js'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  updatedBy: integer('updated_by'),
});

// Validation schemas
export const systemBrandingInsertSchema = createInsertSchema(systemBranding, {
  organizationName: (schema) => schema.min(1, "Organization name is required"),
  primaryColor: (schema) => schema.min(1, "Primary color is required"),
  secondaryColor: (schema) => schema.min(1, "Secondary color is required"),
  accentColor: (schema) => schema.min(1, "Accent color is required"),
  primaryFontFamily: (schema) => schema.min(1, "Primary font family is required"),
  secondaryFontFamily: (schema) => schema.min(1, "Secondary font family is required"),
});

export const systemBrandingSelectSchema = createSelectSchema(systemBranding);

export type SystemBrandingInsert = z.infer<typeof systemBrandingInsertSchema>;
export type SystemBranding = z.infer<typeof systemBrandingSelectSchema>;

/**
 * SMTP Configuration
 */
export const smtpConfig = pgTable("smtp_config", {
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
  retryInterval: integer("retry_interval").default(60),
});

// Add SMTP config validation schema
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

export type CreateSmtpConfigInput = z.infer<typeof createSmtpConfigSchema>;