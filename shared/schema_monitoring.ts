/**
 * Monitoring & Observability Integration Schema
 * 
 * Unified schema for APM and Logging integrations, providing:
 * - Application performance monitoring systems
 * - Log aggregation systems
 * - Metrics collection and forwarding
 * - Alert management
 */

import { pgTable, serial, text, integer, timestamp, jsonb, boolean, uuid } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';
import { users, workspaces } from './schema';

// Enum values for integration types
export const MONITORING_TYPES = ['apm', 'logging'] as const;
export const MONITORING_SYSTEMS = [
  // APM & Infrastructure 
  'datadog', 'dynatrace', 'newrelic', 'grafana', 'prometheus', 'appdynamics', 'elastic_apm',
  // Log Aggregation
  'splunk', 'elastic_stack', 'graylog', 'datadog_logs', 'azure_monitor_logs', 'gcp_logging',
  'aws_cloudwatch', 'logstash', 'fluentd', 'loki'
] as const;

// Connection status values
export const CONNECTION_STATUS = ['connected', 'disconnected', 'error', 'pending', 'configured'] as const;

// Main monitoring integration table
export const monitoringIntegrations = pgTable('monitoring_integrations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  type: text('type', { enum: MONITORING_TYPES }).notNull(),
  system: text('system', { enum: MONITORING_SYSTEMS }).notNull(),
  description: text('description'),
  apiKey: text('api_key'),
  apiEndpoint: text('api_endpoint'),
  serviceName: text('service_name'),
  environmentName: text('environment_name'),
  enabled: boolean('enabled').default(false).notNull(),
  status: text('status', { enum: CONNECTION_STATUS }).default('configured').notNull(),
  lastConnected: timestamp('last_connected'),
  lastError: text('last_error'),
  
  // Configuration options
  config: jsonb('config').default({}).notNull(),
  
  // Universal Agent Support - allows direct agent integration
  agentIntegration: boolean('agent_integration').default(false),
  agentInstructions: text('agent_instructions'),
  agentConfigTemplate: jsonb('agent_config_template'),
  
  // Organization alignment
  workspaceId: integer('workspace_id').references(() => workspaces.id),
  createdBy: integer('created_by').references(() => users.id),
  
  // Monitoring
  lastHealthCheck: timestamp('last_health_check'),
  healthStatus: text('health_status'),
  
  // Timestamps
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Monitoring metrics table - collects usage data about the integration
export const monitoringMetrics = pgTable('monitoring_metrics', {
  id: serial('id').primaryKey(),
  integrationId: integer('integration_id').notNull().references(() => monitoringIntegrations.id),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  metricsCollected: integer('metrics_collected').default(0),
  logsForwarded: integer('logs_forwarded').default(0),
  bytesProcessed: integer('bytes_processed').default(0),
  errorCount: integer('error_count').default(0),
  latency: integer('latency').default(0), // milliseconds
  uptime: integer('uptime').default(0), // seconds
  status: text('status'),
  metrics: jsonb('metrics').default({}),
});

// Endpoint configuration for metric collection and forwarding
export const monitoringEndpoints = pgTable('monitoring_endpoints', {
  id: serial('id').primaryKey(),
  integrationId: integer('integration_id').notNull().references(() => monitoringIntegrations.id),
  name: text('name').notNull(),
  type: text('type').notNull(), // prometheus, opentelemetry, etc.
  path: text('path').notNull(), // URL path for the endpoint
  enabled: boolean('enabled').default(true).notNull(),
  authType: text('auth_type'), // none, basic, token, etc.
  authConfig: jsonb('auth_config').default({}),
  filters: jsonb('filters').default({}), // filter what metrics are exposed
  labels: jsonb('labels').default({}), // additional labels/tags
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Alert configuration for monitoring
export const monitoringAlerts = pgTable('monitoring_alerts', {
  id: serial('id').primaryKey(),
  integrationId: integer('integration_id').notNull().references(() => monitoringIntegrations.id),
  name: text('name').notNull(),
  description: text('description'),
  metricName: text('metric_name').notNull(),
  condition: text('condition').notNull(), // above, below, equal, etc.
  threshold: text('threshold').notNull(),
  duration: integer('duration'), // duration in seconds for condition to be true
  severity: text('severity').notNull(), // critical, error, warning, info
  enabled: boolean('enabled').default(true).notNull(),
  notificationChannels: jsonb('notification_channels').default([]),
  lastTriggered: timestamp('last_triggered'),
  cooldownPeriod: integer('cooldown_period').default(300), // seconds
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const monitoringIntegrationsRelations = relations(monitoringIntegrations, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [monitoringIntegrations.workspaceId],
    references: [workspaces.id]
  }),
  creator: one(users, {
    fields: [monitoringIntegrations.createdBy],
    references: [users.id]
  }),
  metrics: many(monitoringMetrics),
  endpoints: many(monitoringEndpoints),
  alerts: many(monitoringAlerts),
}));

export const monitoringMetricsRelations = relations(monitoringMetrics, ({ one }) => ({
  integration: one(monitoringIntegrations, {
    fields: [monitoringMetrics.integrationId],
    references: [monitoringIntegrations.id]
  }),
}));

export const monitoringEndpointsRelations = relations(monitoringEndpoints, ({ one }) => ({
  integration: one(monitoringIntegrations, {
    fields: [monitoringEndpoints.integrationId],
    references: [monitoringIntegrations.id]
  }),
}));

export const monitoringAlertsRelations = relations(monitoringAlerts, ({ one }) => ({
  integration: one(monitoringIntegrations, {
    fields: [monitoringAlerts.integrationId],
    references: [monitoringIntegrations.id]
  }),
  creator: one(users, {
    fields: [monitoringAlerts.createdBy],
    references: [users.id]
  }),
}));

// Zod schemas for validation
export const insertMonitoringIntegrationSchema = createInsertSchema(monitoringIntegrations, {
  name: (schema) => schema.min(1, "Name is required"),
  type: (schema) => schema.refine(val => MONITORING_TYPES.includes(val as any), {
    message: `Type must be one of: ${MONITORING_TYPES.join(', ')}`
  }),
  system: (schema) => schema.refine(val => MONITORING_SYSTEMS.includes(val as any), {
    message: `System must be one of: ${MONITORING_SYSTEMS.join(', ')}`
  }),
});

export const selectMonitoringIntegrationSchema = createSelectSchema(monitoringIntegrations);

export const insertMonitoringMetricsSchema = createInsertSchema(monitoringMetrics);
export const selectMonitoringMetricsSchema = createSelectSchema(monitoringMetrics);

export const insertMonitoringEndpointSchema = createInsertSchema(monitoringEndpoints, {
  name: (schema) => schema.min(1, "Name is required"),
  path: (schema) => schema.min(1, "Path is required"),
});
export const selectMonitoringEndpointSchema = createSelectSchema(monitoringEndpoints);

export const insertMonitoringAlertSchema = createInsertSchema(monitoringAlerts, {
  name: (schema) => schema.min(1, "Name is required"),
  metricName: (schema) => schema.min(1, "Metric name is required"),
  threshold: (schema) => schema.min(1, "Threshold is required"),
});
export const selectMonitoringAlertSchema = createSelectSchema(monitoringAlerts);

// Types
export type MonitoringIntegration = z.infer<typeof selectMonitoringIntegrationSchema>;
export type InsertMonitoringIntegration = z.infer<typeof insertMonitoringIntegrationSchema>;

export type MonitoringMetrics = z.infer<typeof selectMonitoringMetricsSchema>;
export type InsertMonitoringMetrics = z.infer<typeof insertMonitoringMetricsSchema>;

export type MonitoringEndpoint = z.infer<typeof selectMonitoringEndpointSchema>;
export type InsertMonitoringEndpoint = z.infer<typeof insertMonitoringEndpointSchema>;

export type MonitoringAlert = z.infer<typeof selectMonitoringAlertSchema>;
export type InsertMonitoringAlert = z.infer<typeof insertMonitoringAlertSchema>;