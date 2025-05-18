import { pgTable, serial, text, timestamp, integer, jsonb, boolean, index } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';
import { users } from '@shared/schema';

/**
 * User Interface Personalization Table
 * Stores user preferences for UI customization
 */
export const uiPersonalization = pgTable('ui_personalization', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  layoutPreferences: jsonb('layout_preferences').default({}).notNull(),
  dashboardWidgets: jsonb('dashboard_widgets').default([]).notNull(),
  sidebarConfig: jsonb('sidebar_config').default({}).notNull(), 
  theme: text('theme').default('system'),
  fontScale: text('font_scale').default('medium'),
  accessibilityOptions: jsonb('accessibility_options').default({}).notNull(),
  lastModifiedBy: integer('last_modified_by'),
  analyticsEnabled: boolean('analytics_enabled').default(true),
}, (table) => {
  return {
    userIdIdx: index('ui_personalization_user_id_idx').on(table.userId),
  };
});

/**
 * UI Wizard Progress Table
 * Tracks user progress through onboarding and configuration wizards
 */
export const uiWizardProgress = pgTable('ui_wizard_progress', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  wizardType: text('wizard_type').notNull(), // e.g., 'onboarding', 'feature-config', 'workspace-setup'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  completed: boolean('completed').default(false).notNull(),
  currentStep: integer('current_step').default(0).notNull(),
  stepsCompleted: jsonb('steps_completed').default([]).notNull(), // array of completed step IDs
  data: jsonb('data').default({}).notNull(), // stores wizard-specific data and user selections
  lastInteractionAt: timestamp('last_interaction_at').defaultNow().notNull(),
}, (table) => {
  return {
    userIdIdx: index('ui_wizard_progress_user_id_idx').on(table.userId),
    wizardTypeIdx: index('ui_wizard_progress_wizard_type_idx').on(table.wizardType),
    userWizardTypeIdx: index('ui_wizard_progress_user_wizard_type_idx').on(table.userId, table.wizardType),
  };
});

/**
 * UI Feature Usage Table
 * Tracks which UI features a user frequently uses for personalization recommendations
 */
export const uiFeatureUsage = pgTable('ui_feature_usage', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  featureId: text('feature_id').notNull(), // Unique identifier for a UI feature
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  usageCount: integer('usage_count').default(0).notNull(),
  lastUsedAt: timestamp('last_used_at').defaultNow().notNull(),
  metadata: jsonb('metadata').default({}).notNull(),
}, (table) => {
  return {
    userIdIdx: index('ui_feature_usage_user_id_idx').on(table.userId),
    featureIdIdx: index('ui_feature_usage_feature_id_idx').on(table.featureId),
    userFeatureIdx: index('ui_feature_usage_user_feature_idx').on(table.userId, table.featureId),
  };
});

/**
 * Define table relations
 */
export const uiPersonalizationRelations = relations(uiPersonalization, ({ one }) => ({
  user: one(users, { fields: [uiPersonalization.userId], references: [users.id] }),
}));

export const uiWizardProgressRelations = relations(uiWizardProgress, ({ one }) => ({
  user: one(users, { fields: [uiWizardProgress.userId], references: [users.id] }),
}));

export const uiFeatureUsageRelations = relations(uiFeatureUsage, ({ one }) => ({
  user: one(users, { fields: [uiFeatureUsage.userId], references: [users.id] }),
}));

/**
 * Define validation schemas
 */
export const uiPersonalizationInsertSchema = createInsertSchema(uiPersonalization);
export type UiPersonalizationInsert = z.infer<typeof uiPersonalizationInsertSchema>;
export const uiPersonalizationSelectSchema = createSelectSchema(uiPersonalization);
export type UiPersonalization = z.infer<typeof uiPersonalizationSelectSchema>;

export const uiWizardProgressInsertSchema = createInsertSchema(uiWizardProgress);
export type UiWizardProgressInsert = z.infer<typeof uiWizardProgressInsertSchema>;
export const uiWizardProgressSelectSchema = createSelectSchema(uiWizardProgress);
export type UiWizardProgress = z.infer<typeof uiWizardProgressSelectSchema>;

export const uiFeatureUsageInsertSchema = createInsertSchema(uiFeatureUsage);
export type UiFeatureUsageInsert = z.infer<typeof uiFeatureUsageInsertSchema>;
export const uiFeatureUsageSelectSchema = createSelectSchema(uiFeatureUsage);
export type UiFeatureUsage = z.infer<typeof uiFeatureUsageSelectSchema>;