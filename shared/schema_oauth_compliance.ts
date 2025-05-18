/**
 * Schema definitions for OAuth2 Compliance Reporting
 */
import { pgTable, serial, text, timestamp, integer, boolean, jsonb, date, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { oauthClients, oauthAccessTokens } from './schema_oauth';
import { users } from './schema';

/**
 * Compliance Frameworks Table
 * Defines various compliance frameworks that can be tracked
 */
export const complianceFrameworks = pgTable('compliance_frameworks', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  description: text('description'),
  version: varchar('version', { length: 50 }),
  website: text('website'),
  requirementsJson: jsonb('requirements_json'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  isActive: boolean('is_active').default(true)
});

// Create schema for inserting compliance frameworks
export const complianceFrameworksInsertSchema = createInsertSchema(complianceFrameworks);
export type ComplianceFrameworkInsert = z.infer<typeof complianceFrameworksInsertSchema>;

// Create schema for selecting compliance frameworks
export const complianceFrameworksSelectSchema = createSelectSchema(complianceFrameworks);
export type ComplianceFramework = z.infer<typeof complianceFrameworksSelectSchema>;

/**
 * Compliance Reports Table
 * Stores generated compliance reports
 */
export const complianceReports = pgTable('compliance_reports', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  frameworkId: integer('framework_id').references(() => complianceFrameworks.id),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  generatedBy: integer('generated_by').references(() => users.id),
  generatedAt: timestamp('generated_at', { withTimezone: true }).defaultNow().notNull(),
  reportFormat: varchar('report_format', { length: 20 }).default('json'), // 'json', 'pdf', 'csv'
  reportData: jsonb('report_data'),
  summary: text('summary'),
  findings: jsonb('findings'),
  remediation: jsonb('remediation'),
  status: varchar('status', { length: 50 }).default('draft') // 'draft', 'final', 'archived'
});

// Create schema for inserting compliance reports
export const complianceReportsInsertSchema = createInsertSchema(complianceReports, {
  reportFormat: (schema) => schema.refine(
    value => ['json', 'pdf', 'csv'].includes(value),
    { message: 'Report format must be "json", "pdf", or "csv"' }
  ),
  status: (schema) => schema.refine(
    value => ['draft', 'final', 'archived'].includes(value),
    { message: 'Status must be "draft", "final", or "archived"' }
  )
});
export type ComplianceReportInsert = z.infer<typeof complianceReportsInsertSchema>;

// Create schema for selecting compliance reports
export const complianceReportsSelectSchema = createSelectSchema(complianceReports);
export type ComplianceReport = z.infer<typeof complianceReportsSelectSchema>;

/**
 * Compliance Evidence Table
 * Stores evidence of compliance activities
 */
export const complianceEvidence = pgTable('compliance_evidence', {
  id: serial('id').primaryKey(),
  reportId: integer('report_id').references(() => complianceReports.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  evidenceType: varchar('evidence_type', { length: 50 }).notNull(), // 'access_log', 'security_event', 'config_change', etc.
  evidenceData: jsonb('evidence_data'),
  collectedAt: timestamp('collected_at', { withTimezone: true }).defaultNow().notNull(),
  collectedBy: integer('collected_by').references(() => users.id),
  sourceSystem: varchar('source_system', { length: 100 }),
  requirementId: varchar('requirement_id', { length: 100 }), // References the compliance framework requirement
  status: varchar('status', { length: 50 }).default('unreviewed') // 'unreviewed', 'compliant', 'non_compliant', 'needs_action'
});

// Create schema for inserting compliance evidence
export const complianceEvidenceInsertSchema = createInsertSchema(complianceEvidence, {
  evidenceType: (schema) => schema.refine(
    value => ['access_log', 'security_event', 'config_change', 'audit_log', 'token_usage', 'ip_validation'].includes(value),
    { message: 'Invalid evidence type' }
  ),
  status: (schema) => schema.refine(
    value => ['unreviewed', 'compliant', 'non_compliant', 'needs_action'].includes(value),
    { message: 'Status must be "unreviewed", "compliant", "non_compliant", or "needs_action"' }
  )
});
export type ComplianceEvidenceInsert = z.infer<typeof complianceEvidenceInsertSchema>;

// Create schema for selecting compliance evidence
export const complianceEvidenceSelectSchema = createSelectSchema(complianceEvidence);
export type ComplianceEvidence = z.infer<typeof complianceEvidenceSelectSchema>;

/**
 * Compliance Client Controls Table
 * Maps clients to compliance controls
 */
export const complianceClientControls = pgTable('compliance_client_controls', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').references(() => oauthClients.id, { onDelete: 'cascade' }),
  frameworkId: integer('framework_id').references(() => complianceFrameworks.id),
  controlId: varchar('control_id', { length: 100 }).notNull(), // The control ID in the framework
  isImplemented: boolean('is_implemented').default(false),
  implementationDetails: text('implementation_details'),
  lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
  lastReviewedBy: integer('last_reviewed_by').references(() => users.id),
  evidenceIds: jsonb('evidence_ids')  // Array of evidence IDs that support this control
});

// Create schema for inserting compliance client controls
export const complianceClientControlsInsertSchema = createInsertSchema(complianceClientControls);
export type ComplianceClientControlInsert = z.infer<typeof complianceClientControlsInsertSchema>;

// Create schema for selecting compliance client controls
export const complianceClientControlsSelectSchema = createSelectSchema(complianceClientControls);
export type ComplianceClientControl = z.infer<typeof complianceClientControlsSelectSchema>;

/**
 * Compliance Remediation Tasks Table
 * Tracks remediation of compliance issues
 */
export const complianceRemediationTasks = pgTable('compliance_remediation_tasks', {
  id: serial('id').primaryKey(),
  reportId: integer('report_id').references(() => complianceReports.id),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  severity: varchar('severity', { length: 20 }).notNull().default('medium'), // 'critical', 'high', 'medium', 'low'
  status: varchar('status', { length: 20 }).notNull().default('open'), // 'open', 'in_progress', 'resolved', 'wontfix'
  assignedTo: integer('assigned_to').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  dueDate: date('due_date'),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  resolvedBy: integer('resolved_by').references(() => users.id),
  resolution: text('resolution'),
  requirementId: varchar('requirement_id', { length: 100 }), // References the compliance framework requirement
  evidenceIds: jsonb('evidence_ids')  // Array of evidence IDs related to this task
});

// Create schema for inserting compliance remediation tasks
export const complianceRemediationTasksInsertSchema = createInsertSchema(complianceRemediationTasks, {
  severity: (schema) => schema.refine(
    value => ['critical', 'high', 'medium', 'low'].includes(value),
    { message: 'Severity must be "critical", "high", "medium", or "low"' }
  ),
  status: (schema) => schema.refine(
    value => ['open', 'in_progress', 'resolved', 'wontfix'].includes(value),
    { message: 'Status must be "open", "in_progress", "resolved", or "wontfix"' }
  )
});
export type ComplianceRemediationTaskInsert = z.infer<typeof complianceRemediationTasksInsertSchema>;

// Create schema for selecting compliance remediation tasks
export const complianceRemediationTasksSelectSchema = createSelectSchema(complianceRemediationTasks);
export type ComplianceRemediationTask = z.infer<typeof complianceRemediationTasksSelectSchema>;

/**
 * Scheduled Compliance Reports Table
 * Configures automatic report generation
 */
export const scheduledComplianceReports = pgTable('scheduled_compliance_reports', {
  id: serial('id').primaryKey(),
  title: varchar('title', { length: 200 }).notNull(),
  frameworkId: integer('framework_id').references(() => complianceFrameworks.id),
  frequency: varchar('frequency', { length: 20 }).notNull(), // 'daily', 'weekly', 'monthly', 'quarterly', 'annually'
  dayOfWeek: integer('day_of_week'), // 0-6 for weekly
  dayOfMonth: integer('day_of_month'), // 1-31 for monthly
  monthOfYear: integer('month_of_year'), // 1-12 for annual
  time: varchar('time', { length: 8 }), // HH:MM:SS
  timezone: varchar('timezone', { length: 50 }).default('UTC'),
  recipients: jsonb('recipients'), // Array of recipient email addresses
  reportFormat: varchar('report_format', { length: 20 }).default('json'), // 'json', 'pdf', 'csv'
  isActive: boolean('is_active').default(true),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lastRunAt: timestamp('last_run_at', { withTimezone: true }),
  nextRunAt: timestamp('next_run_at', { withTimezone: true })
});

// Create schema for inserting scheduled compliance reports
export const scheduledComplianceReportsInsertSchema = createInsertSchema(scheduledComplianceReports, {
  frequency: (schema) => schema.refine(
    value => ['daily', 'weekly', 'monthly', 'quarterly', 'annually'].includes(value),
    { message: 'Frequency must be "daily", "weekly", "monthly", "quarterly", or "annually"' }
  ),
  dayOfWeek: (schema) => schema.refine(
    value => value === null || (typeof value === 'number' && value >= 0 && value <= 6),
    { message: 'Day of week must be between 0 and 6' }
  ),
  dayOfMonth: (schema) => schema.refine(
    value => value === null || (typeof value === 'number' && value >= 1 && value <= 31),
    { message: 'Day of month must be between 1 and 31' }
  ),
  monthOfYear: (schema) => schema.refine(
    value => value === null || (typeof value === 'number' && value >= 1 && value <= 12),
    { message: 'Month of year must be between 1 and 12' }
  ),
  reportFormat: (schema) => schema.refine(
    value => ['json', 'pdf', 'csv'].includes(value),
    { message: 'Report format must be "json", "pdf", or "csv"' }
  )
});
export type ScheduledComplianceReportInsert = z.infer<typeof scheduledComplianceReportsInsertSchema>;

// Create schema for selecting scheduled compliance reports
export const scheduledComplianceReportsSelectSchema = createSelectSchema(scheduledComplianceReports);
export type ScheduledComplianceReport = z.infer<typeof scheduledComplianceReportsSelectSchema>;