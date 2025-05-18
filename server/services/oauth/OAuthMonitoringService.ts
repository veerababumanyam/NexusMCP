/**
 * OAuth2 Enhanced Monitoring Service
 * 
 * Provides functionality for:
 * 1. Real-time metrics collection and visualization
 * 2. Anomaly detection using statistical models
 * 3. Interactive dashboard configuration
 * 4. Proactive alerting for security events
 * 5. Health monitoring of OAuth components
 */

import { db } from '@db';
import { 
  oauthMonitoringMetrics, 
  oauthMonitoringDashboards, 
  oauthMonitoringWidgets,
  oauthMonitoringAlerts,
  oauthMonitoringAlertHistory,
  oauthMonitoringAnomalyDetection,
  oauthMonitoringAnomalies,
  oauthMonitoringHealthChecks,
  oauthMonitoringHealthCheckResults,
  oauthMonitoringUserPreferences
} from '@shared/schema_oauth_monitoring';
import { oauthClients, oauthAccessTokens } from '@shared/schema_oauth';
import { oauthSecurityEvents } from '@shared/schema_oauth_rotation';
import { eq, and, or, sql, gte, lte, between, lt, desc, count, sum, avg } from 'drizzle-orm';
import { eventBus } from '../../infrastructure/events/EventBus';
import { format } from 'date-fns';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

// Monitoring Constants
const DEFAULT_TIME_RANGE = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const METRIC_INTERVALS = {
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000
};

// Monitoring Events
export const MONITORING_EVENTS = {
  METRIC_RECORDED: 'oauth.monitoring.metric_recorded',
  ALERT_TRIGGERED: 'oauth.monitoring.alert_triggered',
  ANOMALY_DETECTED: 'oauth.monitoring.anomaly_detected',
  DASHBOARD_UPDATED: 'oauth.monitoring.dashboard_updated',
  HEALTH_CHECK_STATUS_CHANGED: 'oauth.monitoring.health_check_status_changed'
};

export class OAuthMonitoringService {
  private static instance: OAuthMonitoringService;
  private healthCheckIntervals: Map<number, NodeJS.Timeout> = new Map();
  private anomalyDetectionModels: Map<number, any> = new Map();
  private lastAlertEvaluation: Date = new Date();
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): OAuthMonitoringService {
    if (!OAuthMonitoringService.instance) {
      OAuthMonitoringService.instance = new OAuthMonitoringService();
    }
    return OAuthMonitoringService.instance;
  }
  
  constructor() {
    console.log('OAuth Monitoring Service initialized');
    
    // Register event listeners
    this.registerEventListeners();
    
    // Initialize tasks
    this.initializeScheduledTasks();
  }
  
  /**
   * Register event listeners for various OAuth events
   */
  private registerEventListeners(): void {
    // Listen for token creation events
    eventBus.on('oauth.token.created', async (data) => {
      await this.recordMetric({
        clientId: data.clientId,
        metricName: 'token_creations',
        metricType: 'counter',
        value: 1,
        timeInterval: 'hour',
        dimensions: {
          ip_address: data.ipAddress
        }
      });
    });
    
    // Listen for token denial events
    eventBus.on('oauth.token.denied', async (data) => {
      await this.recordMetric({
        clientId: data.clientId,
        metricName: 'token_denials',
        metricType: 'counter',
        value: 1,
        timeInterval: 'hour',
        dimensions: {
          reason: data.reason,
          ip_address: data.ipAddress
        }
      });
    });
    
    // Listen for token usage events
    eventBus.on('oauth.token.used', async (data) => {
      await this.recordMetric({
        clientId: data.clientId,
        metricName: 'api_requests',
        metricType: 'counter',
        value: 1,
        timeInterval: 'hour',
        dimensions: {
          ip_address: data.ipAddress,
          endpoint: data.endpoint
        }
      });
    });
    
    // Listen for IP access violation events
    eventBus.on('oauth.ip_access.violation', async (data) => {
      await this.recordMetric({
        clientId: data.clientId,
        metricName: 'ip_violations',
        metricType: 'counter',
        value: 1,
        timeInterval: 'hour',
        dimensions: {
          ip_address: data.ipAddress,
          reason: data.reason
        }
      });
    });
    
    // Listen for security events
    eventBus.on('oauth.token_rotation.security_event', async (data) => {
      await this.recordMetric({
        clientId: data.clientId,
        metricName: 'security_events',
        metricType: 'counter',
        value: 1,
        timeInterval: 'hour',
        dimensions: {
          event_type: data.eventType,
          severity: data.severity
        }
      });
      
      // Check if this event should trigger an alert
      await this.evaluateAlertsForEvent(data);
    });
  }
  
  /**
   * Initialize scheduled tasks
   */
  private initializeScheduledTasks(): void {
    // Schedule health checks
    setTimeout(async () => {
      await this.initializeHealthChecks();
    }, 5000);
    
    // Run anomaly detection every hour
    setInterval(async () => {
      await this.runAnomalyDetection();
    }, 60 * 60 * 1000);
    
    // Evaluate all alerts every 5 minutes
    setInterval(async () => {
      await this.evaluateAllAlerts();
    }, 5 * 60 * 1000);
  }

  /**
   * Record a metric
   */
  async recordMetric(data: {
    clientId?: number;
    metricName: string;
    metricType: 'counter' | 'gauge' | 'histogram';
    value: number;
    timeInterval: 'minute' | 'hour' | 'day' | 'week' | 'month';
    dimensions?: Record<string, any>;
    source?: string;
  }): Promise<void> {
    try {
      const timestamp = new Date();
      
      // Insert the metric into the database
      await db.insert(oauthMonitoringMetrics).values({
        clientId: data.clientId,
        metricName: data.metricName,
        metricType: data.metricType,
        timestamp,
        timeInterval: data.timeInterval,
        value: data.value,
        dimensions: data.dimensions ? JSON.stringify(data.dimensions) : null,
        source: data.source
      });
      
      // Emit event
      eventBus.emit(MONITORING_EVENTS.METRIC_RECORDED, {
        ...data,
        timestamp
      });
      
      // Check if this metric should trigger any alerts
      await this.evaluateAlertsForMetric(data);
      
    } catch (error) {
      console.error('Error recording metric:', error);
      // Don't throw - we don't want to disrupt normal operations
    }
  }
  
  /**
   * Get metrics for a specific client and metric name
   */
  async getMetrics(params: {
    clientId?: number;
    metricName: string;
    startDate?: Date;
    endDate?: Date;
    interval?: 'minute' | 'hour' | 'day' | 'week' | 'month';
    dimensions?: Record<string, any>;
    aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';
  }): Promise<any[]> {
    try {
      const {
        clientId,
        metricName,
        startDate = new Date(Date.now() - DEFAULT_TIME_RANGE),
        endDate = new Date(),
        interval = 'hour',
        dimensions,
        aggregation = 'sum'
      } = params;
      
      // Build query conditions
      const conditions = [
        eq(oauthMonitoringMetrics.metricName, metricName),
        eq(oauthMonitoringMetrics.timeInterval, interval),
        between(oauthMonitoringMetrics.timestamp, startDate, endDate)
      ];
      
      if (clientId) {
        conditions.push(eq(oauthMonitoringMetrics.clientId, clientId));
      }
      
      // If dimensions are provided, add them to the query
      if (dimensions) {
        for (const [key, value] of Object.entries(dimensions)) {
          conditions.push(
            sql`${oauthMonitoringMetrics.dimensions}->>'${key}' = ${value}`
          );
        }
      }
      
      // Query for metrics
      const metrics = await db.query.oauthMonitoringMetrics.findMany({
        where: and(...conditions),
        orderBy: [oauthMonitoringMetrics.timestamp]
      });
      
      // Group metrics by time intervals for visualization
      return this.groupMetricsByTime(metrics, interval, aggregation);
      
    } catch (error) {
      console.error('Error getting metrics:', error);
      throw new Error('Failed to get metrics');
    }
  }
  
  /**
   * Group metrics by time intervals
   */
  private groupMetricsByTime(
    metrics: any[],
    interval: 'minute' | 'hour' | 'day' | 'week' | 'month',
    aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count'
  ): any[] {
    // Define time format based on interval
    let timeFormat = 'yyyy-MM-dd HH:mm';
    switch (interval) {
      case 'minute':
        timeFormat = 'yyyy-MM-dd HH:mm';
        break;
      case 'hour':
        timeFormat = 'yyyy-MM-dd HH';
        break;
      case 'day':
        timeFormat = 'yyyy-MM-dd';
        break;
      case 'week':
        timeFormat = 'yyyy-[W]ww';
        break;
      case 'month':
        timeFormat = 'yyyy-MM';
        break;
    }
    
    // Group metrics by time
    const groupedMetrics: Record<string, any[]> = {};
    metrics.forEach(metric => {
      const timeKey = format(new Date(metric.timestamp), timeFormat);
      if (!groupedMetrics[timeKey]) {
        groupedMetrics[timeKey] = [];
      }
      groupedMetrics[timeKey].push(metric);
    });
    
    // Apply aggregation function
    return Object.entries(groupedMetrics).map(([timeKey, metricsInGroup]) => {
      let value = 0;
      switch (aggregation) {
        case 'sum':
          value = metricsInGroup.reduce((sum, metric) => sum + metric.value, 0);
          break;
        case 'avg':
          value = metricsInGroup.reduce((sum, metric) => sum + metric.value, 0) / metricsInGroup.length;
          break;
        case 'min':
          value = Math.min(...metricsInGroup.map(metric => metric.value));
          break;
        case 'max':
          value = Math.max(...metricsInGroup.map(metric => metric.value));
          break;
        case 'count':
          value = metricsInGroup.length;
          break;
      }
      
      return {
        timestamp: timeKey,
        value,
        count: metricsInGroup.length
      };
    }).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }
  
  /**
   * Create or update a dashboard
   */
  async createOrUpdateDashboard(data: {
    id?: number;
    name: string;
    description?: string;
    layout: any;
    isPublic?: boolean;
    config?: any;
    createdBy: number;
  }): Promise<any> {
    try {
      if (data.id) {
        // Update existing dashboard
        const [updated] = await db.update(oauthMonitoringDashboards)
          .set({
            name: data.name,
            description: data.description,
            layout: JSON.stringify(data.layout),
            isPublic: data.isPublic,
            config: data.config ? JSON.stringify(data.config) : null,
            updatedAt: new Date()
          })
          .where(eq(oauthMonitoringDashboards.id, data.id))
          .returning();
        
        eventBus.emit(MONITORING_EVENTS.DASHBOARD_UPDATED, {
          id: updated.id,
          action: 'updated',
          userId: data.createdBy
        });
        
        return updated;
      } else {
        // Create new dashboard
        const [created] = await db.insert(oauthMonitoringDashboards)
          .values({
            name: data.name,
            description: data.description,
            layout: JSON.stringify(data.layout),
            isPublic: data.isPublic,
            config: data.config ? JSON.stringify(data.config) : null,
            createdBy: data.createdBy,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();
        
        eventBus.emit(MONITORING_EVENTS.DASHBOARD_UPDATED, {
          id: created.id,
          action: 'created',
          userId: data.createdBy
        });
        
        return created;
      }
    } catch (error) {
      console.error('Error creating/updating dashboard:', error);
      throw new Error('Failed to create/update dashboard');
    }
  }
  
  /**
   * Create or update a dashboard widget
   */
  async createOrUpdateWidget(data: {
    id?: number;
    dashboardId: number;
    title: string;
    type: string;
    query?: string;
    refreshInterval?: number;
    position: any;
    size: any;
    config?: any;
  }): Promise<any> {
    try {
      if (data.id) {
        // Update existing widget
        const [updated] = await db.update(oauthMonitoringWidgets)
          .set({
            dashboardId: data.dashboardId,
            title: data.title,
            type: data.type,
            query: data.query,
            refreshInterval: data.refreshInterval,
            position: JSON.stringify(data.position),
            size: JSON.stringify(data.size),
            config: data.config ? JSON.stringify(data.config) : null,
            updatedAt: new Date()
          })
          .where(eq(oauthMonitoringWidgets.id, data.id))
          .returning();
        
        return updated;
      } else {
        // Create new widget
        const [created] = await db.insert(oauthMonitoringWidgets)
          .values({
            dashboardId: data.dashboardId,
            title: data.title,
            type: data.type,
            query: data.query,
            refreshInterval: data.refreshInterval,
            position: JSON.stringify(data.position),
            size: JSON.stringify(data.size),
            config: data.config ? JSON.stringify(data.config) : null,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();
        
        return created;
      }
    } catch (error) {
      console.error('Error creating/updating widget:', error);
      throw new Error('Failed to create/update widget');
    }
  }
  
  /**
   * Create or update an alert
   */
  async createOrUpdateAlert(data: {
    id?: number;
    name: string;
    description?: string;
    metricName: string;
    condition: string;
    threshold: number;
    duration?: number;
    severity: 'info' | 'warning' | 'critical';
    isEnabled?: boolean;
    notifyChannels?: string[];
    notifyUsers?: number[];
    createdBy: number;
    dimensions?: Record<string, any>;
    labels?: Record<string, string>;
  }): Promise<any> {
    try {
      if (data.id) {
        // Update existing alert
        const [updated] = await db.update(oauthMonitoringAlerts)
          .set({
            name: data.name,
            description: data.description,
            metricName: data.metricName,
            condition: data.condition,
            threshold: data.threshold,
            duration: data.duration,
            severity: data.severity,
            isEnabled: data.isEnabled ?? true,
            notifyChannels: data.notifyChannels ? JSON.stringify(data.notifyChannels) : null,
            notifyUsers: data.notifyUsers ? JSON.stringify(data.notifyUsers) : null,
            dimensions: data.dimensions ? JSON.stringify(data.dimensions) : null,
            labels: data.labels ? JSON.stringify(data.labels) : null,
            updatedAt: new Date()
          })
          .where(eq(oauthMonitoringAlerts.id, data.id))
          .returning();
        
        return updated;
      } else {
        // Create new alert
        const [created] = await db.insert(oauthMonitoringAlerts)
          .values({
            name: data.name,
            description: data.description,
            metricName: data.metricName,
            condition: data.condition,
            threshold: data.threshold,
            duration: data.duration,
            severity: data.severity,
            isEnabled: data.isEnabled ?? true,
            notifyChannels: data.notifyChannels ? JSON.stringify(data.notifyChannels) : null,
            notifyUsers: data.notifyUsers ? JSON.stringify(data.notifyUsers) : null,
            dimensions: data.dimensions ? JSON.stringify(data.dimensions) : null,
            labels: data.labels ? JSON.stringify(data.labels) : null,
            createdBy: data.createdBy,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();
        
        return created;
      }
    } catch (error) {
      console.error('Error creating/updating alert:', error);
      throw new Error('Failed to create/update alert');
    }
  }
  
  /**
   * Evaluate all alerts
   */
  async evaluateAllAlerts(): Promise<void> {
    try {
      // Record last evaluation time
      const evaluationTime = new Date();
      this.lastAlertEvaluation = evaluationTime;
      
      // Get all enabled alerts
      const alerts = await db.query.oauthMonitoringAlerts.findMany({
        where: eq(oauthMonitoringAlerts.isEnabled, true)
      });
      
      // Evaluate each alert
      for (const alert of alerts) {
        try {
          await this.evaluateAlert(alert);
        } catch (error) {
          console.error(`Error evaluating alert ${alert.id}:`, error);
          // Continue with the next alert
        }
      }
    } catch (error) {
      console.error('Error evaluating alerts:', error);
    }
  }
  
  /**
   * Evaluate a specific alert
   */
  private async evaluateAlert(alert: any): Promise<void> {
    // Get the metric data for the alert
    const startDate = new Date(Date.now() - (alert.duration || 300) * 1000);
    const metricData = await this.getMetrics({
      metricName: alert.metricName,
      startDate,
      endDate: new Date(),
      interval: 'minute',
      dimensions: alert.dimensions ? JSON.parse(alert.dimensions) : undefined
    });
    
    if (metricData.length === 0) {
      return; // No data to evaluate
    }
    
    // Calculate the aggregate value
    const aggregateValue = metricData.reduce((sum, item) => sum + item.value, 0);
    
    // Check if the alert condition is met
    let isTriggered = false;
    switch (alert.condition) {
      case '>':
        isTriggered = aggregateValue > alert.threshold;
        break;
      case '<':
        isTriggered = aggregateValue < alert.threshold;
        break;
      case '>=':
        isTriggered = aggregateValue >= alert.threshold;
        break;
      case '<=':
        isTriggered = aggregateValue <= alert.threshold;
        break;
      case '==':
        isTriggered = aggregateValue === alert.threshold;
        break;
      case '!=':
        isTriggered = aggregateValue !== alert.threshold;
        break;
    }
    
    if (isTriggered) {
      await this.triggerAlert(alert, aggregateValue);
    }
  }
  
  /**
   * Trigger an alert
   */
  private async triggerAlert(alert: any, value: number): Promise<void> {
    try {
      // Check if the alert was already triggered recently
      const recentAlerts = await db.query.oauthMonitoringAlertHistory.findMany({
        where: and(
          eq(oauthMonitoringAlertHistory.alertId, alert.id),
          gte(oauthMonitoringAlertHistory.triggeredAt, new Date(Date.now() - 15 * 60 * 1000)), // Last 15 minutes
          eq(oauthMonitoringAlertHistory.resolvedAt, null)
        )
      });
      
      if (recentAlerts.length > 0) {
        return; // Alert already triggered recently
      }
      
      // Create alert history record
      const message = `Alert "${alert.name}" triggered: ${alert.metricName} ${alert.condition} ${alert.threshold} (actual value: ${value})`;
      
      const [alertHistory] = await db.insert(oauthMonitoringAlertHistory)
        .values({
          alertId: alert.id,
          triggeredAt: new Date(),
          value,
          message
        })
        .returning();
      
      // Update the alert's last triggered time
      await db.update(oauthMonitoringAlerts)
        .set({ lastTriggeredAt: new Date() })
        .where(eq(oauthMonitoringAlerts.id, alert.id));
      
      // Emit alert triggered event
      eventBus.emit(MONITORING_EVENTS.ALERT_TRIGGERED, {
        alertId: alert.id,
        alertName: alert.name,
        severity: alert.severity,
        metricName: alert.metricName,
        condition: alert.condition,
        threshold: alert.threshold,
        value,
        message,
        historyId: alertHistory.id
      });
      
      // Send notifications
      await this.sendAlertNotifications(alert, alertHistory);
      
    } catch (error) {
      console.error(`Error triggering alert ${alert.id}:`, error);
    }
  }
  
  /**
   * Send alert notifications
   */
  private async sendAlertNotifications(alert: any, alertHistory: any): Promise<void> {
    try {
      const notifyChannels = alert.notifyChannels ? JSON.parse(alert.notifyChannels) : [];
      const notifyUsers = alert.notifyUsers ? JSON.parse(alert.notifyUsers) : [];
      
      // Send email notifications
      if (notifyChannels.includes('email') && notifyUsers.length > 0) {
        eventBus.emit('notification.email.queue', {
          userIds: notifyUsers,
          subject: `MCP Alert: ${alert.name} (${alert.severity.toUpperCase()})`,
          body: `
            <h2>OAuth Monitoring Alert</h2>
            <p><strong>Alert:</strong> ${alert.name}</p>
            <p><strong>Severity:</strong> ${alert.severity}</p>
            <p><strong>Condition:</strong> ${alert.metricName} ${alert.condition} ${alert.threshold}</p>
            <p><strong>Current Value:</strong> ${alertHistory.value}</p>
            <p><strong>Triggered At:</strong> ${alertHistory.triggeredAt.toISOString()}</p>
            ${alert.description ? `<p><strong>Description:</strong> ${alert.description}</p>` : ''}
            <p>Please review this alert in the MCP management console.</p>
          `,
          alertId: alert.id,
          alertHistoryId: alertHistory.id
        });
      }
      
      // Send webhook notifications
      if (notifyChannels.includes('webhook') && alert.webhookUrl) {
        const webhookPayload = {
          alert_id: alert.id,
          alert_name: alert.name,
          severity: alert.severity,
          metric_name: alert.metricName,
          condition: alert.condition,
          threshold: alert.threshold,
          value: alertHistory.value,
          triggered_at: alertHistory.triggeredAt.toISOString(),
          message: alertHistory.message,
          history_id: alertHistory.id
        };
        
        eventBus.emit('notification.webhook.queue', {
          url: alert.webhookUrl,
          payload: webhookPayload,
          alertId: alert.id,
          alertHistoryId: alertHistory.id
        });
      }
      
      // Send in-app notifications
      if (notifyChannels.includes('dashboard') && notifyUsers.length > 0) {
        eventBus.emit('notification.dashboard.queue', {
          userIds: notifyUsers,
          title: `Alert: ${alert.name}`,
          message: alertHistory.message,
          severity: alert.severity,
          alertId: alert.id,
          alertHistoryId: alertHistory.id
        });
      }
    } catch (error) {
      console.error(`Error sending alert notifications for alert ${alert.id}:`, error);
    }
  }
  
  /**
   * Evaluate alerts for a specific metric
   */
  private async evaluateAlertsForMetric(metricData: any): Promise<void> {
    try {
      // Get all alerts for this metric
      const alerts = await db.query.oauthMonitoringAlerts.findMany({
        where: and(
          eq(oauthMonitoringAlerts.metricName, metricData.metricName),
          eq(oauthMonitoringAlerts.isEnabled, true)
        )
      });
      
      // Evaluate each matching alert
      for (const alert of alerts) {
        // Check dimensions if specified
        if (alert.dimensions) {
          const alertDimensions = JSON.parse(alert.dimensions);
          const metricDimensions = metricData.dimensions || {};
          
          // Skip if dimensions don't match
          let dimensionsMatch = true;
          for (const [key, value] of Object.entries(alertDimensions)) {
            if (metricDimensions[key] !== value) {
              dimensionsMatch = false;
              break;
            }
          }
          
          if (!dimensionsMatch) {
            continue;
          }
        }
        
        // Check for client ID match if specified
        if (alert.clientId && metricData.clientId && alert.clientId !== metricData.clientId) {
          continue;
        }
        
        // If we're here, the alert applies to this metric
        // For instant alerts (duration = 0), check the condition directly
        if (!alert.duration || alert.duration === 0) {
          let isTriggered = false;
          switch (alert.condition) {
            case '>':
              isTriggered = metricData.value > alert.threshold;
              break;
            case '<':
              isTriggered = metricData.value < alert.threshold;
              break;
            case '>=':
              isTriggered = metricData.value >= alert.threshold;
              break;
            case '<=':
              isTriggered = metricData.value <= alert.threshold;
              break;
            case '==':
              isTriggered = metricData.value === alert.threshold;
              break;
            case '!=':
              isTriggered = metricData.value !== alert.threshold;
              break;
          }
          
          if (isTriggered) {
            await this.triggerAlert(alert, metricData.value);
          }
        }
        // For sustained alerts (duration > 0), the full evaluation happens in evaluateAllAlerts()
      }
    } catch (error) {
      console.error('Error evaluating alerts for metric:', error);
    }
  }
  
  /**
   * Evaluate alerts for a security event
   */
  private async evaluateAlertsForEvent(eventData: any): Promise<void> {
    try {
      // For now, we'll just record a security event metric
      // In a real implementation, you might want to have special alert types for security events
    } catch (error) {
      console.error('Error evaluating alerts for event:', error);
    }
  }
  
  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(params: {
    alertHistoryId: number;
    userId: number;
    notes?: string;
  }): Promise<any> {
    try {
      const { alertHistoryId, userId, notes } = params;
      
      const [acknowledged] = await db.update(oauthMonitoringAlertHistory)
        .set({
          acknowledgedAt: new Date(),
          acknowledgedBy: userId,
          notes: notes
        })
        .where(eq(oauthMonitoringAlertHistory.id, alertHistoryId))
        .returning();
      
      if (!acknowledged) {
        throw new Error(`Alert history with ID ${alertHistoryId} not found`);
      }
      
      return acknowledged;
    } catch (error) {
      console.error('Error acknowledging alert:', error);
      throw new Error('Failed to acknowledge alert');
    }
  }
  
  /**
   * Resolve an alert
   */
  async resolveAlert(params: {
    alertHistoryId: number;
    userId: number;
    notes?: string;
  }): Promise<any> {
    try {
      const { alertHistoryId, userId, notes } = params;
      
      const [resolved] = await db.update(oauthMonitoringAlertHistory)
        .set({
          resolvedAt: new Date(),
          acknowledgedAt: new Date(),
          acknowledgedBy: userId,
          notes: notes
        })
        .where(eq(oauthMonitoringAlertHistory.id, alertHistoryId))
        .returning();
      
      if (!resolved) {
        throw new Error(`Alert history with ID ${alertHistoryId} not found`);
      }
      
      return resolved;
    } catch (error) {
      console.error('Error resolving alert:', error);
      throw new Error('Failed to resolve alert');
    }
  }
  
  /**
   * Create or update an anomaly detection configuration
   */
  async createOrUpdateAnomalyDetection(data: {
    id?: number;
    metricName: string;
    clientId?: number;
    algorithm: string;
    sensitivity?: number;
    trainingPeriod?: number;
    dimensions?: Record<string, any>;
    isEnabled?: boolean;
    modelParameters?: Record<string, any>;
    createdBy: number;
  }): Promise<any> {
    try {
      if (data.id) {
        // Update existing configuration
        const [updated] = await db.update(oauthMonitoringAnomalyDetection)
          .set({
            metricName: data.metricName,
            clientId: data.clientId,
            algorithm: data.algorithm,
            sensitivity: data.sensitivity,
            trainingPeriod: data.trainingPeriod,
            dimensions: data.dimensions ? JSON.stringify(data.dimensions) : null,
            isEnabled: data.isEnabled ?? true,
            modelParameters: data.modelParameters ? JSON.stringify(data.modelParameters) : null,
            updatedAt: new Date()
          })
          .where(eq(oauthMonitoringAnomalyDetection.id, data.id))
          .returning();
        
        return updated;
      } else {
        // Create new configuration
        const [created] = await db.insert(oauthMonitoringAnomalyDetection)
          .values({
            metricName: data.metricName,
            clientId: data.clientId,
            algorithm: data.algorithm,
            sensitivity: data.sensitivity,
            trainingPeriod: data.trainingPeriod,
            dimensions: data.dimensions ? JSON.stringify(data.dimensions) : null,
            isEnabled: data.isEnabled ?? true,
            modelParameters: data.modelParameters ? JSON.stringify(data.modelParameters) : null,
            createdBy: data.createdBy,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();
        
        return created;
      }
    } catch (error) {
      console.error('Error creating/updating anomaly detection:', error);
      throw new Error('Failed to create/update anomaly detection');
    }
  }
  
  /**
   * Run anomaly detection for all configured metrics
   */
  async runAnomalyDetection(): Promise<void> {
    try {
      // Get all enabled anomaly detection configurations
      const configs = await db.query.oauthMonitoringAnomalyDetection.findMany({
        where: eq(oauthMonitoringAnomalyDetection.isEnabled, true)
      });
      
      // Run anomaly detection for each configuration
      for (const config of configs) {
        try {
          await this.detectAnomalies(config);
        } catch (error) {
          console.error(`Error detecting anomalies for config ${config.id}:`, error);
          // Continue with the next configuration
        }
      }
    } catch (error) {
      console.error('Error running anomaly detection:', error);
    }
  }
  
  /**
   * Detect anomalies for a specific configuration
   */
  private async detectAnomalies(config: any): Promise<void> {
    // Calculate the training period end date
    const now = new Date();
    const trainingPeriodEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000); // One day before now
    
    // Calculate the training period start date
    const trainingDays = config.trainingPeriod || 14;
    const trainingPeriodStart = new Date(trainingPeriodEnd.getTime() - trainingDays * 24 * 60 * 60 * 1000);
    
    // Get training data
    const trainingData = await this.getMetrics({
      clientId: config.clientId,
      metricName: config.metricName,
      startDate: trainingPeriodStart,
      endDate: trainingPeriodEnd,
      interval: 'hour',
      dimensions: config.dimensions ? JSON.parse(config.dimensions) : undefined
    });
    
    // Get current data (last 24 hours)
    const currentData = await this.getMetrics({
      clientId: config.clientId,
      metricName: config.metricName,
      startDate: trainingPeriodEnd,
      endDate: now,
      interval: 'hour',
      dimensions: config.dimensions ? JSON.parse(config.dimensions) : undefined
    });
    
    if (trainingData.length === 0 || currentData.length === 0) {
      return; // Not enough data
    }
    
    // Apply the selected algorithm
    switch (config.algorithm) {
      case 'mad':
        await this.detectAnomaliesWithMAD(config, trainingData, currentData);
        break;
      case 'z_score':
        await this.detectAnomaliesWithZScore(config, trainingData, currentData);
        break;
      case 'iqr':
        await this.detectAnomaliesWithIQR(config, trainingData, currentData);
        break;
      // Add more algorithms as needed
    }
    
    // Update the last trained date
    await db.update(oauthMonitoringAnomalyDetection)
      .set({ lastTrainedAt: now })
      .where(eq(oauthMonitoringAnomalyDetection.id, config.id));
  }
  
  /**
   * Detect anomalies using Median Absolute Deviation (MAD)
   */
  private async detectAnomaliesWithMAD(config: any, trainingData: any[], currentData: any[]): Promise<void> {
    // Extract values
    const trainingValues = trainingData.map(item => item.value);
    
    // Calculate median
    const median = this.calculateMedian(trainingValues);
    
    // Calculate absolute deviations
    const absoluteDeviations = trainingValues.map(value => Math.abs(value - median));
    
    // Calculate MAD
    const mad = this.calculateMedian(absoluteDeviations);
    
    // Set threshold based on sensitivity
    const sensitivity = config.sensitivity || 1.0;
    const threshold = mad * 3.0 * sensitivity; // 3 is a common MAD multiplier
    
    // Detect anomalies in current data
    for (const dataPoint of currentData) {
      const deviation = Math.abs(dataPoint.value - median);
      const score = deviation / mad;
      
      // If the deviation is above the threshold, it's an anomaly
      if (deviation > threshold) {
        await this.recordAnomaly({
          detectionConfigId: config.id,
          metricName: config.metricName,
          clientId: config.clientId,
          timestamp: new Date(dataPoint.timestamp),
          value: dataPoint.value,
          expectedValue: median,
          deviation,
          score,
          severity: score > 5 ? 'high' : score > 3 ? 'medium' : 'low',
          dimensions: config.dimensions ? JSON.parse(config.dimensions) : null
        });
      }
    }
  }
  
  /**
   * Calculate the median of an array of numbers
   */
  private calculateMedian(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    } else {
      return sorted[mid];
    }
  }
  
  /**
   * Detect anomalies using Z-Score
   */
  private async detectAnomaliesWithZScore(config: any, trainingData: any[], currentData: any[]): Promise<void> {
    // Extract values
    const trainingValues = trainingData.map(item => item.value);
    
    // Calculate mean
    const mean = trainingValues.reduce((sum, value) => sum + value, 0) / trainingValues.length;
    
    // Calculate standard deviation
    const squaredDiffs = trainingValues.map(value => Math.pow(value - mean, 2));
    const variance = squaredDiffs.reduce((sum, value) => sum + value, 0) / squaredDiffs.length;
    const stdDev = Math.sqrt(variance);
    
    // Set threshold based on sensitivity
    const sensitivity = config.sensitivity || 1.0;
    const threshold = 3.0 * sensitivity; // 3 is a common Z-score threshold
    
    // Detect anomalies in current data
    for (const dataPoint of currentData) {
      const zScore = Math.abs((dataPoint.value - mean) / stdDev);
      
      // If the Z-score is above the threshold, it's an anomaly
      if (zScore > threshold) {
        await this.recordAnomaly({
          detectionConfigId: config.id,
          metricName: config.metricName,
          clientId: config.clientId,
          timestamp: new Date(dataPoint.timestamp),
          value: dataPoint.value,
          expectedValue: mean,
          deviation: dataPoint.value - mean,
          score: zScore,
          severity: zScore > 5 ? 'high' : zScore > 3 ? 'medium' : 'low',
          dimensions: config.dimensions ? JSON.parse(config.dimensions) : null
        });
      }
    }
  }
  
  /**
   * Detect anomalies using Interquartile Range (IQR)
   */
  private async detectAnomaliesWithIQR(config: any, trainingData: any[], currentData: any[]): Promise<void> {
    // Extract values
    const trainingValues = trainingData.map(item => item.value).sort((a, b) => a - b);
    
    // Calculate quartiles
    const q1Index = Math.floor(trainingValues.length * 0.25);
    const q3Index = Math.floor(trainingValues.length * 0.75);
    const q1 = trainingValues[q1Index];
    const q3 = trainingValues[q3Index];
    
    // Calculate IQR
    const iqr = q3 - q1;
    
    // Set thresholds based on sensitivity
    const sensitivity = config.sensitivity || 1.0;
    const lowerThreshold = q1 - 1.5 * iqr * sensitivity;
    const upperThreshold = q3 + 1.5 * iqr * sensitivity;
    
    // Detect anomalies in current data
    for (const dataPoint of currentData) {
      const value = dataPoint.value;
      
      // If the value is outside the thresholds, it's an anomaly
      if (value < lowerThreshold || value > upperThreshold) {
        const expectedValue = (value < lowerThreshold) ? q1 : q3;
        const deviation = Math.abs(value - expectedValue);
        const score = deviation / iqr;
        
        await this.recordAnomaly({
          detectionConfigId: config.id,
          metricName: config.metricName,
          clientId: config.clientId,
          timestamp: new Date(dataPoint.timestamp),
          value,
          expectedValue,
          deviation,
          score,
          severity: score > 3 ? 'high' : score > 2 ? 'medium' : 'low',
          dimensions: config.dimensions ? JSON.parse(config.dimensions) : null
        });
      }
    }
  }
  
  /**
   * Record an anomaly
   */
  private async recordAnomaly(data: {
    detectionConfigId: number;
    metricName: string;
    clientId?: number;
    timestamp: Date;
    value: number;
    expectedValue?: number;
    deviation?: number;
    score: number;
    severity: 'low' | 'medium' | 'high';
    dimensions?: Record<string, any>;
  }): Promise<void> {
    try {
      // Check if a similar anomaly was already recorded recently
      const recentAnomalies = await db.query.oauthMonitoringAnomalies.findMany({
        where: and(
          eq(oauthMonitoringAnomalies.detectionConfigId, data.detectionConfigId),
          eq(oauthMonitoringAnomalies.metricName, data.metricName),
          gte(oauthMonitoringAnomalies.timestamp, new Date(data.timestamp.getTime() - 60 * 60 * 1000)) // Last hour
        )
      });
      
      if (recentAnomalies.length > 0) {
        return; // Similar anomaly already recorded
      }
      
      // Record the anomaly
      const [anomaly] = await db.insert(oauthMonitoringAnomalies)
        .values({
          detectionConfigId: data.detectionConfigId,
          metricName: data.metricName,
          clientId: data.clientId,
          timestamp: data.timestamp,
          value: data.value,
          expectedValue: data.expectedValue,
          deviation: data.deviation,
          score: data.score,
          severity: data.severity,
          dimensions: data.dimensions ? JSON.stringify(data.dimensions) : null,
          status: 'open'
        })
        .returning();
      
      // Emit anomaly detected event
      eventBus.emit(MONITORING_EVENTS.ANOMALY_DETECTED, {
        anomalyId: anomaly.id,
        detectionConfigId: data.detectionConfigId,
        metricName: data.metricName,
        clientId: data.clientId,
        timestamp: data.timestamp,
        value: data.value,
        expectedValue: data.expectedValue,
        deviation: data.deviation,
        score: data.score,
        severity: data.severity
      });
      
      // Find related security events
      if (data.clientId) {
        const relatedEvents = await db.query.oauthSecurityEvents.findMany({
          where: and(
            eq(oauthSecurityEvents.clientId, data.clientId),
            gte(oauthSecurityEvents.eventTime, new Date(data.timestamp.getTime() - 15 * 60 * 1000)), // 15 minutes before
            lte(oauthSecurityEvents.eventTime, new Date(data.timestamp.getTime() + 15 * 60 * 1000))  // 15 minutes after
          ),
          limit: 10
        });
        
        if (relatedEvents.length > 0) {
          // Update anomaly with related security events
          await db.update(oauthMonitoringAnomalies)
            .set({
              relatedSecurityEvents: JSON.stringify(relatedEvents.map(e => e.id))
            })
            .where(eq(oauthMonitoringAnomalies.id, anomaly.id));
        }
      }
    } catch (error) {
      console.error('Error recording anomaly:', error);
    }
  }
  
  /**
   * Create or update a health check
   */
  async createOrUpdateHealthCheck(data: {
    id?: number;
    name: string;
    description?: string;
    type: 'http' | 'tcp' | 'script' | 'database';
    target: string;
    interval?: number;
    timeout?: number;
    expectedStatus?: string;
    headers?: Record<string, string>;
    method?: string;
    body?: string;
    script?: string;
    isEnabled?: boolean;
    alertThreshold?: number;
    alertSeverity?: 'info' | 'warning' | 'critical';
    createdBy: number;
  }): Promise<any> {
    try {
      if (data.id) {
        // Update existing health check
        const [updated] = await db.update(oauthMonitoringHealthChecks)
          .set({
            name: data.name,
            description: data.description,
            type: data.type,
            target: data.target,
            interval: data.interval,
            timeout: data.timeout,
            expectedStatus: data.expectedStatus,
            headers: data.headers ? JSON.stringify(data.headers) : null,
            method: data.method,
            body: data.body,
            script: data.script,
            isEnabled: data.isEnabled ?? true,
            alertThreshold: data.alertThreshold,
            alertSeverity: data.alertSeverity,
            updatedAt: new Date()
          })
          .where(eq(oauthMonitoringHealthChecks.id, data.id))
          .returning();
        
        // Reset the health check schedule if it changed
        this.resetHealthCheckSchedule(updated);
        
        return updated;
      } else {
        // Create new health check
        const [created] = await db.insert(oauthMonitoringHealthChecks)
          .values({
            name: data.name,
            description: data.description,
            type: data.type,
            target: data.target,
            interval: data.interval,
            timeout: data.timeout,
            expectedStatus: data.expectedStatus,
            headers: data.headers ? JSON.stringify(data.headers) : null,
            method: data.method,
            body: data.body,
            script: data.script,
            isEnabled: data.isEnabled ?? true,
            alertThreshold: data.alertThreshold,
            alertSeverity: data.alertSeverity,
            createdBy: data.createdBy,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();
        
        // Schedule the health check
        this.scheduleHealthCheck(created);
        
        return created;
      }
    } catch (error) {
      console.error('Error creating/updating health check:', error);
      throw new Error('Failed to create/update health check');
    }
  }
  
  /**
   * Initialize health checks
   */
  private async initializeHealthChecks(): Promise<void> {
    try {
      // Get all enabled health checks
      const healthChecks = await db.query.oauthMonitoringHealthChecks.findMany({
        where: eq(oauthMonitoringHealthChecks.isEnabled, true)
      });
      
      // Schedule each health check
      for (const healthCheck of healthChecks) {
        this.scheduleHealthCheck(healthCheck);
      }
    } catch (error) {
      console.error('Error initializing health checks:', error);
    }
  }
  
  /**
   * Schedule a health check
   */
  private scheduleHealthCheck(healthCheck: any): void {
    // Clear any existing interval
    this.clearHealthCheckSchedule(healthCheck.id);
    
    // Schedule the health check
    const interval = healthCheck.interval || 60; // Default to 60 seconds
    const intervalId = setInterval(() => this.runHealthCheck(healthCheck), interval * 1000);
    
    // Store the interval ID
    this.healthCheckIntervals.set(healthCheck.id, intervalId);
    
    // Run the health check immediately
    this.runHealthCheck(healthCheck);
  }
  
  /**
   * Clear a health check schedule
   */
  private clearHealthCheckSchedule(healthCheckId: number): void {
    const intervalId = this.healthCheckIntervals.get(healthCheckId);
    if (intervalId) {
      clearInterval(intervalId);
      this.healthCheckIntervals.delete(healthCheckId);
    }
  }
  
  /**
   * Reset a health check schedule
   */
  private resetHealthCheckSchedule(healthCheck: any): void {
    if (healthCheck.isEnabled) {
      this.scheduleHealthCheck(healthCheck);
    } else {
      this.clearHealthCheckSchedule(healthCheck.id);
    }
  }
  
  /**
   * Run a health check
   */
  private async runHealthCheck(healthCheck: any): Promise<void> {
    try {
      let status: 'success' | 'failure' | 'timeout' = 'failure';
      let responseTime = 0;
      let statusCode: number | undefined;
      let responseBody: string | undefined;
      let errorMessage: string | undefined;
      
      const startTime = Date.now();
      
      // Run the health check based on its type
      switch (healthCheck.type) {
        case 'http':
          try {
            const timeout = healthCheck.timeout || 5; // Default to 5 seconds
            const method = healthCheck.method || 'GET';
            const headers = healthCheck.headers ? JSON.parse(healthCheck.headers) : {};
            
            const response = await axios({
              method,
              url: healthCheck.target,
              timeout: timeout * 1000,
              headers,
              data: healthCheck.body,
              validateStatus: () => true // Don't throw on any status code
            });
            
            statusCode = response.status;
            responseBody = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
            
            // Check if the status code matches the expected status
            if (healthCheck.expectedStatus) {
              if (healthCheck.expectedStatus.startsWith('2')) {
                status = response.status >= 200 && response.status < 300 ? 'success' : 'failure';
              } else {
                status = response.status.toString().startsWith(healthCheck.expectedStatus) ? 'success' : 'failure';
              }
            } else {
              status = response.status >= 200 && response.status < 300 ? 'success' : 'failure';
            }
          } catch (error) {
            status = error.code === 'ECONNABORTED' ? 'timeout' : 'failure';
            errorMessage = error.message;
          }
          break;
          
        case 'tcp':
          // TCP health check implementation would go here
          break;
          
        case 'script':
          // Script health check implementation would go here
          break;
          
        case 'database':
          try {
            const timeout = healthCheck.timeout || 5; // Default to 5 seconds
            
            // Run a simple query to check if the database is responsive
            const result = await Promise.race([
              db.execute(sql`SELECT 1`),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout * 1000))
            ]);
            
            status = 'success';
            responseBody = JSON.stringify(result);
          } catch (error) {
            status = error.message === 'Timeout' ? 'timeout' : 'failure';
            errorMessage = error.message;
          }
          break;
      }
      
      // Calculate response time
      responseTime = Date.now() - startTime;
      
      // Record health check result
      const result = await db.insert(oauthMonitoringHealthCheckResults)
        .values({
          healthCheckId: healthCheck.id,
          timestamp: new Date(),
          status,
          responseTime,
          statusCode,
          responseBody,
          errorMessage,
          metadata: JSON.stringify({
            executedAt: new Date().toISOString()
          })
        })
        .returning();
      
      // Check for status changes
      const recentResults = await db.query.oauthMonitoringHealthCheckResults.findMany({
        where: eq(oauthMonitoringHealthCheckResults.healthCheckId, healthCheck.id),
        orderBy: [desc(oauthMonitoringHealthCheckResults.timestamp)],
        limit: healthCheck.alertThreshold + 1
      });
      
      // If we have enough results to check for a status change
      if (recentResults.length > 1) {
        const currentStatus = recentResults[0].status;
        const prevStatus = recentResults[1].status;
        
        // If the status changed from success to failure/timeout
        if (prevStatus === 'success' && (currentStatus === 'failure' || currentStatus === 'timeout')) {
          await this.handleHealthCheckFailure(healthCheck, recentResults);
        }
        
        // If the status changed from failure/timeout to success
        else if ((prevStatus === 'failure' || prevStatus === 'timeout') && currentStatus === 'success') {
          await this.handleHealthCheckRecovery(healthCheck, recentResults);
        }
      }
      
    } catch (error) {
      console.error(`Error running health check ${healthCheck.id}:`, error);
    }
  }
  
  /**
   * Handle a health check failure
   */
  private async handleHealthCheckFailure(healthCheck: any, recentResults: any[]): Promise<void> {
    // Count the number of consecutive failures
    let consecutiveFailures = 0;
    for (const result of recentResults) {
      if (result.status === 'failure' || result.status === 'timeout') {
        consecutiveFailures++;
      } else {
        break;
      }
    }
    
    // If we've reached the alert threshold, emit an event
    if (consecutiveFailures >= healthCheck.alertThreshold) {
      eventBus.emit(MONITORING_EVENTS.HEALTH_CHECK_STATUS_CHANGED, {
        healthCheckId: healthCheck.id,
        healthCheckName: healthCheck.name,
        status: recentResults[0].status,
        previousStatus: 'success',
        consecutiveFailures,
        severity: healthCheck.alertSeverity || 'warning',
        timestamp: new Date(),
        message: `Health check "${healthCheck.name}" has failed ${consecutiveFailures} times in a row`,
        details: {
          type: healthCheck.type,
          target: healthCheck.target,
          lastResponseTime: recentResults[0].responseTime,
          lastStatusCode: recentResults[0].statusCode,
          lastErrorMessage: recentResults[0].errorMessage
        }
      });
      
      // Record a metric for the health check failure
      await this.recordMetric({
        metricName: 'health_check_failures',
        metricType: 'counter',
        value: 1,
        timeInterval: 'hour',
        dimensions: {
          health_check_id: healthCheck.id,
          health_check_name: healthCheck.name,
          health_check_type: healthCheck.type,
          status: recentResults[0].status
        }
      });
    }
  }
  
  /**
   * Handle a health check recovery
   */
  private async handleHealthCheckRecovery(healthCheck: any, recentResults: any[]): Promise<void> {
    // Find how many failures we had before recovery
    let previousFailures = 0;
    for (let i = 1; i < recentResults.length; i++) {
      if (recentResults[i].status === 'failure' || recentResults[i].status === 'timeout') {
        previousFailures++;
      } else {
        break;
      }
    }
    
    // If we had enough failures to trigger an alert, emit a recovery event
    if (previousFailures >= healthCheck.alertThreshold) {
      eventBus.emit(MONITORING_EVENTS.HEALTH_CHECK_STATUS_CHANGED, {
        healthCheckId: healthCheck.id,
        healthCheckName: healthCheck.name,
        status: 'success',
        previousStatus: recentResults[1].status,
        previousFailures,
        severity: 'info',
        timestamp: new Date(),
        message: `Health check "${healthCheck.name}" has recovered after ${previousFailures} failures`,
        details: {
          type: healthCheck.type,
          target: healthCheck.target,
          downtime: recentResults[0].timestamp.getTime() - recentResults[previousFailures].timestamp.getTime(),
          responseTime: recentResults[0].responseTime
        }
      });
      
      // Record a metric for the health check recovery
      await this.recordMetric({
        metricName: 'health_check_recoveries',
        metricType: 'counter',
        value: 1,
        timeInterval: 'hour',
        dimensions: {
          health_check_id: healthCheck.id,
          health_check_name: healthCheck.name,
          health_check_type: healthCheck.type,
          previous_failures: previousFailures
        }
      });
    }
  }
  
  /**
   * Get health check status summary
   */
  async getHealthCheckSummary(): Promise<any> {
    try {
      // Get all health checks
      const healthChecks = await db.query.oauthMonitoringHealthChecks.findMany();
      
      // Get the latest result for each health check
      const summary = await Promise.all(healthChecks.map(async (healthCheck) => {
        const latestResult = await db.query.oauthMonitoringHealthCheckResults.findFirst({
          where: eq(oauthMonitoringHealthCheckResults.healthCheckId, healthCheck.id),
          orderBy: [desc(oauthMonitoringHealthCheckResults.timestamp)]
        });
        
        // Get health check statistics
        const lastDay = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        const [stats] = await db
          .select({
            total: count(),
            successes: count(
              eq(oauthMonitoringHealthCheckResults.status, 'success')
            ),
            failures: count(
              eq(oauthMonitoringHealthCheckResults.status, 'failure')
            ),
            timeouts: count(
              eq(oauthMonitoringHealthCheckResults.status, 'timeout')
            ),
            avgResponseTime: avg(oauthMonitoringHealthCheckResults.responseTime)
          })
          .from(oauthMonitoringHealthCheckResults)
          .where(
            and(
              eq(oauthMonitoringHealthCheckResults.healthCheckId, healthCheck.id),
              gte(oauthMonitoringHealthCheckResults.timestamp, lastDay)
            )
          );
        
        return {
          id: healthCheck.id,
          name: healthCheck.name,
          type: healthCheck.type,
          target: healthCheck.target,
          isEnabled: healthCheck.isEnabled,
          interval: healthCheck.interval,
          currentStatus: latestResult?.status || 'unknown',
          lastChecked: latestResult?.timestamp || null,
          lastResponseTime: latestResult?.responseTime || null,
          lastStatusCode: latestResult?.statusCode || null,
          lastErrorMessage: latestResult?.errorMessage || null,
          stats: {
            total: stats.total || 0,
            successes: stats.successes || 0,
            failures: stats.failures || 0,
            timeouts: stats.timeouts || 0,
            avgResponseTime: stats.avgResponseTime || 0,
            uptime: stats.total ? (stats.successes / stats.total) * 100 : 0
          }
        };
      }));
      
      return {
        healthChecks: summary,
        overall: {
          total: summary.length,
          healthy: summary.filter(hc => hc.currentStatus === 'success').length,
          unhealthy: summary.filter(hc => hc.currentStatus === 'failure' || hc.currentStatus === 'timeout').length,
          unknown: summary.filter(hc => hc.currentStatus === 'unknown').length,
          disabled: summary.filter(hc => !hc.isEnabled).length,
          overallUptime: summary.reduce((sum, hc) => sum + hc.stats.uptime, 0) / (summary.length || 1)
        }
      };
    } catch (error) {
      console.error('Error getting health check summary:', error);
      throw new Error('Failed to get health check summary');
    }
  }
}