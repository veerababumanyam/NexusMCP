import { pgTable, serial, text, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { relations } from 'drizzle-orm';

/**
 * System Module Configuration Table
 * Controls which enterprise modules are enabled/disabled
 */
export const systemModules = pgTable('system_modules', {
  id: serial('id').primaryKey(),
  moduleName: text('module_name').notNull().unique(),
  displayName: text('display_name').notNull(),
  description: text('description').notNull(),
  enabled: boolean('enabled').default(false).notNull(),
  requiredPermission: text('required_permission'),
  configPath: text('config_path'),
  iconName: text('icon_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * AI Provider Configuration Table
 * Allows configuration of different AI providers (OpenAI, Azure OpenAI, etc.)
 */
export const aiProviders = pgTable('ai_providers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  displayName: text('display_name').notNull(),
  description: text('description').notNull(),
  providerType: text('provider_type').notNull(), // 'openai', 'azure', 'huggingface', etc.
  enabled: boolean('enabled').default(false).notNull(),
  isDefault: boolean('is_default').default(false),
  configData: jsonb('config_data'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Define schemas for validation
export const systemModulesInsertSchema = createInsertSchema(systemModules, {
  moduleName: (schema) => schema.min(3, "Module name must be at least 3 characters"),
  displayName: (schema) => schema.min(3, "Display name must be at least 3 characters"),
  description: (schema) => schema.min(10, "Description must be at least 10 characters")
});
export type SystemModuleInsert = z.infer<typeof systemModulesInsertSchema>;
export const systemModulesSelectSchema = createSelectSchema(systemModules);
export type SystemModule = z.infer<typeof systemModulesSelectSchema>;

export const aiProvidersInsertSchema = createInsertSchema(aiProviders, {
  name: (schema) => schema.min(3, "Name must be at least 3 characters"),
  displayName: (schema) => schema.min(3, "Display name must be at least 3 characters"),
  description: (schema) => schema.min(10, "Description must be at least 10 characters"),
  providerType: (schema) => schema.refine(
    type => ['openai', 'azure_openai', 'anthropic', 'google', 'huggingface', 'local', 'other'].includes(type),
    { message: "Provider type must be one of the supported AI providers" }
  )
});
export type AiProviderInsert = z.infer<typeof aiProvidersInsertSchema>;
export const aiProvidersSelectSchema = createSelectSchema(aiProviders);
export type AiProvider = z.infer<typeof aiProvidersSelectSchema>;

// Configuration schema for OpenAI provider
export const openAiConfigSchema = z.object({
  apiKey: z.string().optional(),
  organization: z.string().optional(),
  defaultModel: z.string().default('gpt-4o'),
  timeout: z.number().default(30000),
  baseUrl: z.string().optional(),
});
export type OpenAiConfig = z.infer<typeof openAiConfigSchema>;

// Configuration schema for Azure OpenAI provider
export const azureOpenAiConfigSchema = z.object({
  apiKey: z.string().optional(),
  endpoint: z.string().optional(),
  deploymentName: z.string().optional(),
  apiVersion: z.string().default('2023-05-15'),
  defaultModel: z.string().default('gpt-4'),
  timeout: z.number().default(30000),
});
export type AzureOpenAiConfig = z.infer<typeof azureOpenAiConfigSchema>;