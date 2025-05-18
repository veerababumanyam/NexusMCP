import { pgTable, serial, text, integer, timestamp, decimal, json, boolean } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';

// Define JSON type compatible with drizzle-orm
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

// Type assertion helper for JSON values
export function asJson<T>(value: T): Json {
  return value as unknown as Json;
}

/**
 * Security Scanner Tables
 * 
 * These tables store data related to the security scanning functionality:
 * - Security scanners configuration
 * - Scan targets
 * - Scan results
 * - Vulnerability findings
 */

// Security scanner types
export const scannerTypes = [
  'vulnerability',
  'malware',
  'compliance',
  'network',
  'container',
  'code'
] as const;

// Target types
export const targetTypes = [
  'server',
  'endpoint',
  'database',
  'web',
  'api',
  'container',
  'code'
] as const;

// Scan status types
export const scannerStatusTypes = [
  'active',
  'disabled',
  'error',
  'pending'
] as const;

// Scan result status types
export const scanResultStatusTypes = [
  'running',
  'completed',
  'failed',
  'pending',
  'canceled'
] as const;

// Vulnerability severity types
export const severityTypes = [
  'critical',
  'high',
  'medium',
  'low',
  'info'
] as const;

// Vulnerability status types
export const vulnerabilityStatusTypes = [
  'open',
  'in_progress',
  'resolved',
  'false_positive',
  'accepted_risk'
] as const;

// Security scanners table
export const securityScanners = pgTable('security_scanners', {
  id: serial('id').primaryKey(),
  workspaceId: integer('workspace_id'),
  name: text('name').notNull(),
  description: text('description'),
  scannerType: text('scanner_type').notNull().$type<typeof scannerTypes[number]>(),
  status: text('status').notNull().default('active').$type<typeof scannerStatusTypes[number]>(),
  config: json('config'),
  credentials: json('credentials'),
  scheduleConfig: json('schedule_config'),
  lastScanTime: timestamp('last_scan_time'),
  createdBy: integer('created_by'),
  updatedBy: integer('updated_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Scan targets table
export const scanTargets = pgTable('scan_targets', {
  id: serial('id').primaryKey(),
  workspaceId: integer('workspace_id'),
  name: text('name').notNull(),
  description: text('description'),
  targetType: text('target_type').notNull().$type<typeof targetTypes[number]>(),
  value: text('value').notNull(),
  config: json('config'),
  credentials: json('credentials'),
  createdBy: integer('created_by'),
  updatedBy: integer('updated_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Security scan results table
export const scanResults = pgTable('scan_results', {
  id: serial('id').primaryKey(),
  scannerId: integer('scanner_id').notNull().references(() => securityScanners.id),
  targetId: integer('target_id').notNull().references(() => scanTargets.id),
  startTime: timestamp('start_time').notNull(),
  endTime: timestamp('end_time'),
  status: text('status').notNull().default('running').$type<typeof scanResultStatusTypes[number]>(),
  summary: json('summary'),
  initiatedBy: integer('initiated_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Vulnerabilities table
export const scanVulnerabilities = pgTable('scan_vulnerabilities', {
  id: serial('id').primaryKey(),
  scanResultId: integer('scan_result_id').notNull().references(() => scanResults.id),
  title: text('title').notNull(),
  description: text('description'),
  severity: text('severity').notNull().$type<typeof severityTypes[number]>(),
  cvssScore: decimal('cvss_score', { precision: 3, scale: 1 }),
  cveId: text('cve_id'),
  location: text('location'),
  remediation: text('remediation'),
  status: text('status').notNull().default('open').$type<typeof vulnerabilityStatusTypes[number]>(),
  details: json('details'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Define relations
export const securityScannersRelations = relations(securityScanners, ({ many }) => ({
  scanResults: many(scanResults)
}));

export const scanTargetsRelations = relations(scanTargets, ({ many }) => ({
  scanResults: many(scanResults)
}));

export const scanResultsRelations = relations(scanResults, ({ one, many }) => ({
  scanner: one(securityScanners, {
    fields: [scanResults.scannerId],
    references: [securityScanners.id]
  }),
  target: one(scanTargets, {
    fields: [scanResults.targetId],
    references: [scanTargets.id]
  }),
  vulnerabilities: many(scanVulnerabilities)
}));

export const scanVulnerabilitiesRelations = relations(scanVulnerabilities, ({ one }) => ({
  scanResult: one(scanResults, {
    fields: [scanVulnerabilities.scanResultId],
    references: [scanResults.id]
  })
}));

// Create Zod schemas for validation
export const securityScannerInsertSchema = createInsertSchema(securityScanners);
export const securityScannerValidationSchema = securityScannerInsertSchema
  .extend({
    name: z.string().min(3, "Name must be at least 3 characters"),
    scannerType: z.enum(scannerTypes),
    status: z.enum(scannerStatusTypes).optional(),
    config: z.any().optional().transform(v => v as Json),
    credentials: z.any().optional().transform(v => v as Json),
    scheduleConfig: z.any().optional().transform(v => v as Json),
  });

export const scanTargetInsertSchema = createInsertSchema(scanTargets);
export const scanTargetValidationSchema = scanTargetInsertSchema
  .extend({
    name: z.string().min(3, "Name must be at least 3 characters"),
    targetType: z.enum(targetTypes),
    value: z.string().min(1, "Target value is required"),
    config: z.any().optional().transform(v => v as Json),
    credentials: z.any().optional().transform(v => v as Json),
  });

export const scanResultInsertSchema = createInsertSchema(scanResults);
export const scanResultValidationSchema = scanResultInsertSchema
  .extend({
    scannerId: z.number().positive("Scanner ID must be a positive number"),
    targetId: z.number().positive("Target ID must be a positive number"),
    status: z.enum(scanResultStatusTypes).optional(),
    summary: z.any().optional().transform(v => v as Json),
  });

export const scanVulnerabilityInsertSchema = createInsertSchema(scanVulnerabilities);
export const scanVulnerabilityValidationSchema = scanVulnerabilityInsertSchema
  .extend({
    scanResultId: z.number().positive("Scan result ID must be a positive number"),
    title: z.string().min(3, "Title must be at least 3 characters"),
    severity: z.enum(severityTypes),
    status: z.enum(vulnerabilityStatusTypes).optional(),
    details: z.any().optional().transform(v => v as Json),
  });

// Define select schemas for use in the application
export const securityScannerSelectSchema = createSelectSchema(securityScanners);
export const scanTargetSelectSchema = createSelectSchema(scanTargets);
export const scanResultSelectSchema = createSelectSchema(scanResults);
export const scanVulnerabilitySelectSchema = createSelectSchema(scanVulnerabilities);

// Define types for use in the application
export type SecurityScanner = z.infer<typeof securityScannerSelectSchema>;
export type SecurityScannerInsert = z.infer<typeof securityScannerInsertSchema>;

export type ScanTarget = z.infer<typeof scanTargetSelectSchema>;
export type ScanTargetInsert = z.infer<typeof scanTargetInsertSchema>;

export type ScanResult = z.infer<typeof scanResultSelectSchema>;
export type ScanResultInsert = z.infer<typeof scanResultInsertSchema>;

export type ScanVulnerability = z.infer<typeof scanVulnerabilitySelectSchema>;
export type ScanVulnerabilityInsert = z.infer<typeof scanVulnerabilityInsertSchema>;