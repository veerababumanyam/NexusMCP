/**
 * Schema definitions for OAuth2 Advanced Monitoring & Analytics
 */
import { pgTable, serial, text, timestamp, integer, boolean, jsonb, date, varchar, real } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { oauthClients, oauthAccessTokens } from './schema_oauth';
import { users } from './schema';

/**
 * OAuth Monitoring Metrics Table
 * Stores time-series metrics for dashboard visualizations
 */
export const oauthMonitoringMetrics = pgTable('oauth_monitoring_metrics', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').references(() => oauthClients.id),
  metricName: varchar('metric_name', { length: 100 }).notNull(),
  metricType: varchar('metric_type', { length: 50 }).notNull(), // 'counter', 'gauge', 'histogram'
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  timeInterval: varchar('time_interval', { length: 20 }).notNull(), // 'minute', 'hour', 'day', 'week', 'month'
  value: real('value').notNull(),
  dimensions: jsonb('dimensions'), // Additional dimensions (tags) for the metric
  source: varchar('source', { length: 100 }) // Source of the metric (service name)
});

// Create schema for inserting monitoring metrics
export const oauthMonitoringMetricsInsertSchema = createInsertSchema(oauthMonitoringMetrics, {
  metricType: (schema) => schema.refine(
    value => ['counter', 'gauge', 'histogram'].includes(value),
    { message: 'Metric type must be "counter", "gauge", or "histogram"' }
  ),
  timeInterval: (schema) => schema.refine(
    value => ['minute', 'hour', 'day', 'week', 'month'].includes(value),
    { message: 'Time interval must be "minute", "hour", "day", "week", or "month"' }
  )
});
export type OAuthMonitoringMetricInsert = z.infer<typeof oauthMonitoringMetricsInsertSchema>;

// Create schema for selecting monitoring metrics
export const oauthMonitoringMetricsSelectSchema = createSelectSchema(oauthMonitoringMetrics);
export type OAuthMonitoringMetric = z.infer<typeof oauthMonitoringMetricsSelectSchema>;

/**
 * OAuth Monitoring Dashboards Table
 * Defines customizable monitoring dashboards
 */
export const oauthMonitoringDashboards = pgTable('oauth_monitoring_dashboards', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  layout: jsonb('layout').notNull(), // Dashboard layout configuration
  isSystem: boolean('is_system').default(false), // Whether this is a system-defined dashboard
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  isPublic: boolean('is_public').default(false), // Whether this dashboard is visible to all users
  config: jsonb('config') // Additional configuration options
});

// Create schema for inserting monitoring dashboards
export const oauthMonitoringDashboardsInsertSchema = createInsertSchema(oauthMonitoringDashboards);
export type OAuthMonitoringDashboardInsert = z.infer<typeof oauthMonitoringDashboardsInsertSchema>;

// Create schema for selecting monitoring dashboards
export const oauthMonitoringDashboardsSelectSchema = createSelectSchema(oauthMonitoringDashboards);
export type OAuthMonitoringDashboard = z.infer<typeof oauthMonitoringDashboardsSelectSchema>;

/**
 * OAuth Monitoring Visualization Widgets Table
 * Defines visualization widgets for dashboards
 */
export const oauthMonitoringWidgets = pgTable('oauth_monitoring_widgets', {
  id: serial('id').primaryKey(),
  dashboardId: integer('dashboard_id').references(() => oauthMonitoringDashboards.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 100 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(), // 'line_chart', 'bar_chart', 'pie_chart', 'table', 'gauge', 'stat'
  query: text('query'), // Query to generate the visualization data
  refreshInterval: integer('refresh_interval').default(300), // In seconds
  position: jsonb('position').notNull(), // Position in the dashboard grid
  size: jsonb('size').notNull(), // Size in the dashboard grid
  config: jsonb('config'), // Widget-specific configuration
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// Create schema for inserting monitoring widgets
export const oauthMonitoringWidgetsInsertSchema = createInsertSchema(oauthMonitoringWidgets, {
  type: (schema) => schema.refine(
    value => ['line_chart', 'bar_chart', 'pie_chart', 'table', 'gauge', 'stat', 'heatmap', 'alert_list'].includes(value),
    { message: 'Widget type not supported' }
  )
});
export type OAuthMonitoringWidgetInsert = z.infer<typeof oauthMonitoringWidgetsInsertSchema>;

// Create schema for selecting monitoring widgets
export const oauthMonitoringWidgetsSelectSchema = createSelectSchema(oauthMonitoringWidgets);
export type OAuthMonitoringWidget = z.infer<typeof oauthMonitoringWidgetsSelectSchema>;

/**
 * OAuth Monitoring Alerts Table
 * Defines monitoring alerts based on metrics thresholds
 */
export const oauthMonitoringAlerts = pgTable('oauth_monitoring_alerts', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  metricName: varchar('metric_name', { length: 100 }).notNull(),
  condition: varchar('condition', { length: 50 }).notNull(), // '>', '<', '>=', '<=', '==', '!='
  threshold: real('threshold').notNull(),
  duration: integer('duration').default(0), // Duration in seconds the condition must be true
  severity: varchar('severity', { length: 20 }).notNull().default('warning'), // 'info', 'warning', 'critical'
  isEnabled: boolean('is_enabled').default(true),
  notifyChannels: jsonb('notify_channels'), // Channels to notify (email, webhook, sms, etc.)
  notifyUsers: jsonb('notify_users'), // User IDs to notify
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  lastTriggeredAt: timestamp('last_triggered_at', { withTimezone: true }),
  silencedUntil: timestamp('silenced_until', { withTimezone: true }),
  dimensions: jsonb('dimensions'), // Filter dimensions (e.g., specific client_id)
  labels: jsonb('labels') // Labels for categorizing alerts
});

// Create schema for inserting monitoring alerts
export const oauthMonitoringAlertsInsertSchema = createInsertSchema(oauthMonitoringAlerts, {
  condition: (schema) => schema.refine(
    value => ['>', '<', '>=', '<=', '==', '!='].includes(value),
    { message: 'Condition must be one of: >, <, >=, <=, ==, !=' }
  ),
  severity: (schema) => schema.refine(
    value => ['info', 'warning', 'critical'].includes(value),
    { message: 'Severity must be "info", "warning", or "critical"' }
  )
});
export type OAuthMonitoringAlertInsert = z.infer<typeof oauthMonitoringAlertsInsertSchema>;

// Create schema for selecting monitoring alerts
export const oauthMonitoringAlertsSelectSchema = createSelectSchema(oauthMonitoringAlerts);
export type OAuthMonitoringAlert = z.infer<typeof oauthMonitoringAlertsSelectSchema>;

/**
 * OAuth Monitoring Alert History Table
 * Tracks alert trigger history
 */
export const oauthMonitoringAlertHistory = pgTable('oauth_monitoring_alert_history', {
  id: serial('id').primaryKey(),
  alertId: integer('alert_id').references(() => oauthMonitoringAlerts.id, { onDelete: 'cascade' }),
  triggeredAt: timestamp('triggered_at', { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  value: real('value').notNull(), // The value that triggered the alert
  message: text('message'), // Alert message
  notificationsSent: jsonb('notifications_sent'), // Record of notifications sent
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  acknowledgedBy: integer('acknowledged_by').references(() => users.id),
  notes: text('notes') // Notes added by the acknowledging user
});

// Create schema for inserting alert history
export const oauthMonitoringAlertHistoryInsertSchema = createInsertSchema(oauthMonitoringAlertHistory);
export type OAuthMonitoringAlertHistoryInsert = z.infer<typeof oauthMonitoringAlertHistoryInsertSchema>;

// Create schema for selecting alert history
export const oauthMonitoringAlertHistorySelectSchema = createSelectSchema(oauthMonitoringAlertHistory);
export type OAuthMonitoringAlertHistory = z.infer<typeof oauthMonitoringAlertHistorySelectSchema>;

/**
 * OAuth Monitoring User Preferences Table
 * Stores user preferences for monitoring
 */
export const oauthMonitoringUserPreferences = pgTable('oauth_monitoring_user_preferences', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }),
  defaultDashboardId: integer('default_dashboard_id').references(() => oauthMonitoringDashboards.id),
  refreshInterval: integer('refresh_interval').default(60), // In seconds
  theme: varchar('theme', { length: 20 }).default('light'), // 'light', 'dark', 'system'
  dateFormat: varchar('date_format', { length: 20 }).default('YYYY-MM-DD'),
  timeFormat: varchar('time_format', { length: 20 }).default('HH:mm:ss'),
  timezone: varchar('timezone', { length: 50 }).default('UTC'),
  notificationPreferences: jsonb('notification_preferences'), // Notification preferences
  dashboardLayouts: jsonb('dashboard_layouts'), // User-specific layouts for dashboards
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// Create schema for inserting user preferences
export const oauthMonitoringUserPreferencesInsertSchema = createInsertSchema(oauthMonitoringUserPreferences, {
  theme: (schema) => schema.refine(
    value => ['light', 'dark', 'system'].includes(value),
    { message: 'Theme must be "light", "dark", or "system"' }
  )
});
export type OAuthMonitoringUserPreferenceInsert = z.infer<typeof oauthMonitoringUserPreferencesInsertSchema>;

// Create schema for selecting user preferences
export const oauthMonitoringUserPreferencesSelectSchema = createSelectSchema(oauthMonitoringUserPreferences);
export type OAuthMonitoringUserPreference = z.infer<typeof oauthMonitoringUserPreferencesSelectSchema>;

/**
 * OAuth Monitoring Anomaly Detection Table
 * Stores anomaly detection settings and results
 */
export const oauthMonitoringAnomalyDetection = pgTable('oauth_monitoring_anomaly_detection', {
  id: serial('id').primaryKey(),
  metricName: varchar('metric_name', { length: 100 }).notNull(),
  clientId: integer('client_id').references(() => oauthClients.id),
  algorithm: varchar('algorithm', { length: 50 }).notNull(), // 'mad', 'z_score', 'iqr', 'lstm', etc.
  sensitivity: real('sensitivity').default(1.0), // Higher is more sensitive
  trainingPeriod: integer('training_period').default(14), // Days of data to use for training
  dimensions: jsonb('dimensions'), // Additional dimensions (tags) for the anomaly detection
  isEnabled: boolean('is_enabled').default(true),
  lastTrainedAt: timestamp('last_trained_at', { withTimezone: true }),
  modelParameters: jsonb('model_parameters'), // Algorithm-specific parameters
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// Create schema for inserting anomaly detection
export const oauthMonitoringAnomalyDetectionInsertSchema = createInsertSchema(oauthMonitoringAnomalyDetection, {
  algorithm: (schema) => schema.refine(
    value => ['mad', 'z_score', 'iqr', 'lstm', 'prophet', 'arima', 'ewma'].includes(value),
    { message: 'Algorithm must be one of the supported anomaly detection algorithms' }
  )
});
export type OAuthMonitoringAnomalyDetectionInsert = z.infer<typeof oauthMonitoringAnomalyDetectionInsertSchema>;

// Create schema for selecting anomaly detection
export const oauthMonitoringAnomalyDetectionSelectSchema = createSelectSchema(oauthMonitoringAnomalyDetection);
export type OAuthMonitoringAnomalyDetection = z.infer<typeof oauthMonitoringAnomalyDetectionSelectSchema>;

/**
 * OAuth Monitoring Anomaly Detections Table
 * Stores detected anomalies
 */
export const oauthMonitoringAnomalies = pgTable('oauth_monitoring_anomalies', {
  id: serial('id').primaryKey(),
  detectionConfigId: integer('detection_config_id').references(() => oauthMonitoringAnomalyDetection.id, { onDelete: 'cascade' }),
  metricName: varchar('metric_name', { length: 100 }).notNull(),
  clientId: integer('client_id').references(() => oauthClients.id),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  value: real('value').notNull(),
  expectedValue: real('expected_value'),
  deviation: real('deviation'),
  score: real('score').notNull(), // Anomaly score (higher is more anomalous)
  severity: varchar('severity', { length: 20 }).notNull(), // 'low', 'medium', 'high'
  dimensions: jsonb('dimensions'), // Additional dimensions (tags) for the anomaly
  status: varchar('status', { length: 20 }).default('open'), // 'open', 'acknowledged', 'resolved', 'false_positive'
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  acknowledgedBy: integer('acknowledged_by').references(() => users.id),
  notes: text('notes'), // Notes about the anomaly
  relatedSecurityEvents: jsonb('related_security_events') // IDs of related security events
});

// Create schema for inserting anomalies
export const oauthMonitoringAnomaliesInsertSchema = createInsertSchema(oauthMonitoringAnomalies, {
  severity: (schema) => schema.refine(
    value => ['low', 'medium', 'high'].includes(value),
    { message: 'Severity must be "low", "medium", or "high"' }
  ),
  status: (schema) => schema.refine(
    value => ['open', 'acknowledged', 'resolved', 'false_positive'].includes(value),
    { message: 'Status must be "open", "acknowledged", "resolved", or "false_positive"' }
  )
});
export type OAuthMonitoringAnomalyInsert = z.infer<typeof oauthMonitoringAnomaliesInsertSchema>;

// Create schema for selecting anomalies
export const oauthMonitoringAnomaliesSelectSchema = createSelectSchema(oauthMonitoringAnomalies);
export type OAuthMonitoringAnomaly = z.infer<typeof oauthMonitoringAnomaliesSelectSchema>;

/**
 * OAuth Monitoring Health Checks Table
 * Defines health checks for components
 */
export const oauthMonitoringHealthChecks = pgTable('oauth_monitoring_health_checks', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  type: varchar('type', { length: 50 }).notNull(), // 'http', 'tcp', 'script', 'database'
  target: text('target').notNull(), // URL, host:port, script path, etc.
  interval: integer('interval').default(60), // In seconds
  timeout: integer('timeout').default(5), // In seconds
  expectedStatus: varchar('expected_status', { length: 50 }), // Expected HTTP status, response content, etc.
  headers: jsonb('headers'), // HTTP headers for HTTP checks
  method: varchar('method', { length: 10 }).default('GET'), // HTTP method for HTTP checks
  body: text('body'), // Request body for HTTP checks
  script: text('script'), // Script for script-based checks
  isEnabled: boolean('is_enabled').default(true),
  alertThreshold: integer('alert_threshold').default(3), // Number of failures before alerting
  alertSeverity: varchar('alert_severity', { length: 20 }).default('warning'), // 'info', 'warning', 'critical'
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull()
});

// Create schema for inserting health checks
export const oauthMonitoringHealthChecksInsertSchema = createInsertSchema(oauthMonitoringHealthChecks, {
  type: (schema) => schema.refine(
    value => ['http', 'tcp', 'script', 'database'].includes(value),
    { message: 'Type must be "http", "tcp", "script", or "database"' }
  ),
  method: (schema) => schema.refine(
    value => value === null || ['GET', 'POST', 'PUT', 'DELETE', 'HEAD', 'OPTIONS', 'PATCH'].includes(value),
    { message: 'Method must be a valid HTTP method' }
  ),
  alertSeverity: (schema) => schema.refine(
    value => ['info', 'warning', 'critical'].includes(value),
    { message: 'Alert severity must be "info", "warning", or "critical"' }
  )
});
export type OAuthMonitoringHealthCheckInsert = z.infer<typeof oauthMonitoringHealthChecksInsertSchema>;

// Create schema for selecting health checks
export const oauthMonitoringHealthChecksSelectSchema = createSelectSchema(oauthMonitoringHealthChecks);
export type OAuthMonitoringHealthCheck = z.infer<typeof oauthMonitoringHealthChecksSelectSchema>;

/**
 * OAuth Monitoring Health Check Results Table
 * Stores health check execution results
 */
export const oauthMonitoringHealthCheckResults = pgTable('oauth_monitoring_health_check_results', {
  id: serial('id').primaryKey(),
  healthCheckId: integer('health_check_id').references(() => oauthMonitoringHealthChecks.id, { onDelete: 'cascade' }),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  status: varchar('status', { length: 20 }).notNull(), // 'success', 'failure', 'timeout'
  responseTime: integer('response_time'), // In milliseconds
  statusCode: integer('status_code'), // HTTP status code for HTTP checks
  responseBody: text('response_body'), // Response body or output
  errorMessage: text('error_message'), // Error message if failed
  metadata: jsonb('metadata') // Additional metadata about the health check
});

// Create schema for inserting health check results
export const oauthMonitoringHealthCheckResultsInsertSchema = createInsertSchema(oauthMonitoringHealthCheckResults, {
  status: (schema) => schema.refine(
    value => ['success', 'failure', 'timeout'].includes(value),
    { message: 'Status must be "success", "failure", or "timeout"' }
  )
});
export type OAuthMonitoringHealthCheckResultInsert = z.infer<typeof oauthMonitoringHealthCheckResultsInsertSchema>;

// Create schema for selecting health check results
export const oauthMonitoringHealthCheckResultsSelectSchema = createSelectSchema(oauthMonitoringHealthCheckResults);
export type OAuthMonitoringHealthCheckResult = z.infer<typeof oauthMonitoringHealthCheckResultsSelectSchema>;