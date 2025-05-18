/**
 * Schema definitions for the Enhanced Breach Detection System
 * 
 * The breach detection system tracks security events and anomalies, 
 * correlating them with detection rules to identify potential security breaches.
 */
import { pgTable, serial, text, integer, timestamp, jsonb, boolean, real, foreignKey } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations, InferModel } from 'drizzle-orm';
import { z } from 'zod';

/**
 * Breach Detections - Record of detected security breaches
 */
export const breachDetections = pgTable('breach_detections', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  detectionType: text('detection_type').notNull(), // 'signature', 'behavior', 'anomaly', 'correlation', 'intelligence'
  description: text('description'),
  severity: text('severity').notNull().default('medium'), // 'low', 'medium', 'high', 'critical'
  status: text('status').notNull().default('open'), // 'open', 'in_progress', 'resolved', 'false_positive'
  source: text('source').notNull(), // 'oauth_event', 'ip_access', 'anomaly_detection', etc.
  ruleId: integer('rule_id').references(() => breachDetectionRules.id),
  workspaceId: integer('workspace_id'),
  affectedResources: jsonb('affected_resources'),
  evidence: jsonb('evidence'),
  detectedAt: timestamp('detected_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: integer('resolved_by'),
  resolution: text('resolution'), // 'fixed', 'mitigated', 'accepted', 'obsolete'
  resolutionNotes: text('resolution_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdBy: integer('created_by'),
  updatedBy: integer('updated_by')
});

/**
 * Breach Events - Timeline of events related to a breach
 */
export const breachEvents = pgTable('breach_events', {
  id: serial('id').primaryKey(),
  breachId: integer('breach_id').notNull().references(() => breachDetections.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(), // 'detection', 'update', 'investigation', 'resolution', etc.
  userId: integer('user_id'),
  details: jsonb('details'),
  timestamp: timestamp('timestamp').defaultNow().notNull()
});

/**
 * Breach Detection Rules - Rules used to identify breaches
 */
export const breachDetectionRules = pgTable('breach_detection_rules', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  type: text('type').notNull(), // 'signature', 'behavior', 'anomaly'
  definition: jsonb('definition').notNull(),
  workspaceId: integer('workspace_id'),
  category: text('category').notNull(), // 'access_control', 'data_security', etc.
  severity: text('severity').notNull().default('medium'), // 'low', 'medium', 'high', 'critical'
  status: text('status').notNull().default('enabled'), // 'enabled', 'disabled', 'draft'
  thresholds: jsonb('thresholds'), // Specific thresholds for triggers
  isGlobal: boolean('is_global').default(false),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdBy: integer('created_by'),
  updatedBy: integer('updated_by')
});

/**
 * Security Metrics - Metrics used for breach detection
 */
export const securityMetrics = pgTable('security_metrics', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  value: text('value').notNull(),
  metricType: text('metric_type').notNull(), // 'counter', 'gauge', 'histogram'
  category: text('category').notNull(), // 'authentication', 'authorization', etc.
  workspaceId: integer('workspace_id'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  metadata: jsonb('metadata')
});

/**
 * Security Notifications - Configuration for breach notifications
 */
export const securityNotifications = pgTable('security_notifications', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  eventTypes: text('event_types').array().notNull(), // ['breach_detected', 'status_changed', etc.]
  channels: text('channels').array().notNull(), // ['email', 'slack', 'sms', etc.]
  workspaceId: integer('workspace_id'),
  filters: jsonb('filters'), // Filtering criteria
  recipients: jsonb('recipients'), // Who to notify
  isEnabled: boolean('is_enabled').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  createdBy: integer('created_by'),
  updatedBy: integer('updated_by')
});

/**
 * Breach Indicators - Indicators of compromise
 */
export const breachIndicators = pgTable('breach_indicators', {
  id: serial('id').primaryKey(),
  type: text('type').notNull(), // 'ip', 'hash', 'domain', 'pattern', 'signature'
  value: text('value').notNull(),
  confidence: real('confidence').notNull().default(0.5),
  source: text('source').notNull(), // 'internal', 'threat_intel', 'community'
  firstSeen: timestamp('first_seen').defaultNow().notNull(),
  lastSeen: timestamp('last_seen').defaultNow().notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

/**
 * Breach Indicator Links - Links between breaches and indicators
 */
export const breachIndicatorLinks = pgTable('breach_indicator_links', {
  id: serial('id').primaryKey(),
  breachId: integer('breach_id').notNull().references(() => breachDetections.id, { onDelete: 'cascade' }),
  indicatorId: integer('indicator_id').notNull().references(() => breachIndicators.id, { onDelete: 'cascade' }),
  relationship: text('relationship').notNull().default('associated'), // 'source', 'associated', 'confirmed'
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

/**
 * Define relations between tables
 */
export const breachDetectionsRelations = relations(breachDetections, ({ many, one }) => ({
  events: many(breachEvents),
  rule: one(breachDetectionRules, {
    fields: [breachDetections.ruleId],
    references: [breachDetectionRules.id]
  }),
  indicators: many(breachIndicatorLinks)
}));

export const breachEventsRelations = relations(breachEvents, ({ one }) => ({
  breach: one(breachDetections, {
    fields: [breachEvents.breachId],
    references: [breachDetections.id]
  })
}));

export const breachDetectionRulesRelations = relations(breachDetectionRules, ({ many }) => ({
  detections: many(breachDetections)
}));

export const breachIndicatorsRelations = relations(breachIndicators, ({ many }) => ({
  breaches: many(breachIndicatorLinks)
}));

export const breachIndicatorLinksRelations = relations(breachIndicatorLinks, ({ one }) => ({
  breach: one(breachDetections, {
    fields: [breachIndicatorLinks.breachId],
    references: [breachDetections.id]
  }),
  indicator: one(breachIndicators, {
    fields: [breachIndicatorLinks.indicatorId],
    references: [breachIndicators.id]
  })
}));

/**
 * Zod schemas for validation
 */
export const breachDetectionInsertSchema = createInsertSchema(breachDetections);
export const breachDetectionSelectSchema = createSelectSchema(breachDetections);

export const breachEventInsertSchema = createInsertSchema(breachEvents);
export const breachEventSelectSchema = createSelectSchema(breachEvents);

export const breachDetectionRuleInsertSchema = createInsertSchema(breachDetectionRules);
export const breachDetectionRuleSelectSchema = createSelectSchema(breachDetectionRules);

export const securityMetricInsertSchema = createInsertSchema(securityMetrics);
export const securityMetricSelectSchema = createSelectSchema(securityMetrics);

export const securityNotificationInsertSchema = createInsertSchema(securityNotifications);
export const securityNotificationSelectSchema = createSelectSchema(securityNotifications);

export const breachIndicatorInsertSchema = createInsertSchema(breachIndicators);
export const breachIndicatorSelectSchema = createSelectSchema(breachIndicators);

export const breachIndicatorLinkInsertSchema = createInsertSchema(breachIndicatorLinks);
export const breachIndicatorLinkSelectSchema = createSelectSchema(breachIndicatorLinks);

/**
 * Type definitions
 */
export type BreachDetection = InferModel<typeof breachDetections, 'select'>;
export type NewBreachDetection = InferModel<typeof breachDetections, 'insert'>;

export type BreachEvent = InferModel<typeof breachEvents, 'select'>;
export type NewBreachEvent = InferModel<typeof breachEvents, 'insert'>;

export type BreachDetectionRule = InferModel<typeof breachDetectionRules, 'select'>;
export type NewBreachDetectionRule = InferModel<typeof breachDetectionRules, 'insert'>;

export type SecurityMetric = InferModel<typeof securityMetrics, 'select'>;
export type NewSecurityMetric = InferModel<typeof securityMetrics, 'insert'>;

export type SecurityNotification = InferModel<typeof securityNotifications, 'select'>;
export type NewSecurityNotification = InferModel<typeof securityNotifications, 'insert'>;

export type BreachIndicator = InferModel<typeof breachIndicators, 'select'>;
export type NewBreachIndicator = InferModel<typeof breachIndicators, 'insert'>;

export type BreachIndicatorLink = InferModel<typeof breachIndicatorLinks, 'select'>;
export type NewBreachIndicatorLink = InferModel<typeof breachIndicatorLinks, 'insert'>;

/**
 * Additional custom schemas for specific validation scenarios
 */
export const breachStatusSchema = z.enum(['open', 'in_progress', 'resolved', 'false_positive']);
export const breachSeveritySchema = z.enum(['low', 'medium', 'high', 'critical']);
export const breachResolutionSchema = z.enum(['fixed', 'mitigated', 'accepted', 'obsolete']);
export const breachDetectionTypeSchema = z.enum(['signature', 'behavior', 'anomaly', 'correlation', 'intelligence']);

// Schema for filtering breach detections in overview
export const breachOverviewFilterSchema = z.object({
  status: z.string().optional(),
  severity: z.string().optional(),
  type: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  source: z.string().optional(),
  workspaceId: z.string().optional()
});

// Schema for rule definitions 
export const ruleDefinitionSchema = z.object({
  timeWindow: z.number().optional(),
  signatures: z.array(z.object({
    type: z.string(),
    pattern: z.record(z.any()),
    threshold: z.number().optional()
  })).optional(),
  metrics: z.array(z.object({
    name: z.string(),
    aggregation: z.string()
  })).optional(),
  threshold: z.number().optional(),
  condition: z.object({
    type: z.string(),
    expression: z.string().optional()
  }).optional(),
  evaluationIntervalMinutes: z.number().optional()
});

// Schema for evidence data in breaches
export const breachEvidenceSchema = z.record(z.any());