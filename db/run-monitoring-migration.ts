/**
 * Monitoring System Migration
 * 
 * This migration adds tables for unified monitoring functionality:
 * - APM (Application Performance Monitoring) integrations
 * - Log Aggregation systems
 * - Metrics collection and forwarding
 * - Alert configuration
 */

import { pool } from './index';
// Simple logger for the migration process
class Logger {
  private context: string;
  
  constructor(context: string) {
    this.context = context;
  }
  
  public info(message: string): void {
    console.log(`[${this.context}] ${message}`);
  }
  
  public error(message: string, error?: any): void {
    console.error(`[${this.context}] ERROR: ${message}`, error ? error : '');
  }
}
import {
  monitoringIntegrations,
  monitoringMetrics,
  monitoringEndpoints,
  monitoringAlerts,
} from '@shared/schema_monitoring';

// Set up logger
const logger = new Logger('MonitoringMigration');

/**
 * Run the monitoring system migration
 */
export async function runMonitoringSystemMigration() {
  const client = await pool.connect();
  
  try {
    logger.info('Starting monitoring system migration');
    
    // Start transaction
    await client.query('BEGIN');
    
    // Create the tables
    await createMonitoringTables(client);
    
    // Seed default monitoring systems
    await seedDefaultMonitoringSystems(client);
    
    // Commit the transaction
    await client.query('COMMIT');
    
    logger.info('Monitoring system migration completed successfully');
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    logger.error('Failed to run monitoring system migration', error);
    throw error;
  } finally {
    // Release the client
    client.release();
  }
}

/**
 * Create all monitoring tables using SQL
 */
async function createMonitoringTables(client: any) {
  logger.info('Creating monitoring tables');
  
  // Create the tables
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${monitoringIntegrations._.name} (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      system TEXT NOT NULL,
      description TEXT,
      api_key TEXT,
      api_endpoint TEXT,
      service_name TEXT,
      environment_name TEXT,
      enabled BOOLEAN DEFAULT FALSE NOT NULL,
      status TEXT DEFAULT 'configured' NOT NULL,
      last_connected TIMESTAMP,
      last_error TEXT,
      config JSONB DEFAULT '{}' NOT NULL,
      agent_integration BOOLEAN DEFAULT FALSE,
      agent_instructions TEXT,
      agent_config_template JSONB,
      workspace_id INTEGER REFERENCES workspaces(id),
      created_by INTEGER REFERENCES users(id),
      last_health_check TIMESTAMP,
      health_status TEXT,
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS ${monitoringMetrics._.name} (
      id SERIAL PRIMARY KEY,
      integration_id INTEGER NOT NULL REFERENCES ${monitoringIntegrations._.name}(id),
      timestamp TIMESTAMP DEFAULT NOW() NOT NULL,
      metrics_collected INTEGER DEFAULT 0,
      logs_forwarded INTEGER DEFAULT 0,
      bytes_processed INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0,
      latency INTEGER DEFAULT 0,
      uptime INTEGER DEFAULT 0,
      status TEXT,
      metrics JSONB DEFAULT '{}'
    );
    
    CREATE TABLE IF NOT EXISTS ${monitoringEndpoints._.name} (
      id SERIAL PRIMARY KEY,
      integration_id INTEGER NOT NULL REFERENCES ${monitoringIntegrations._.name}(id),
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      path TEXT NOT NULL,
      enabled BOOLEAN DEFAULT TRUE NOT NULL,
      auth_type TEXT,
      auth_config JSONB DEFAULT '{}',
      filters JSONB DEFAULT '{}',
      labels JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
    
    CREATE TABLE IF NOT EXISTS ${monitoringAlerts._.name} (
      id SERIAL PRIMARY KEY,
      integration_id INTEGER NOT NULL REFERENCES ${monitoringIntegrations._.name}(id),
      name TEXT NOT NULL,
      description TEXT,
      metric_name TEXT NOT NULL,
      condition TEXT NOT NULL,
      threshold TEXT NOT NULL,
      duration INTEGER,
      severity TEXT NOT NULL,
      enabled BOOLEAN DEFAULT TRUE NOT NULL,
      notification_channels JSONB DEFAULT '[]',
      last_triggered TIMESTAMP,
      cooldown_period INTEGER DEFAULT 300,
      created_by INTEGER REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW() NOT NULL,
      updated_at TIMESTAMP DEFAULT NOW() NOT NULL
    );
  `);
  
  // Create indexes for better performance
  await client.query(`
    CREATE INDEX IF NOT EXISTS monitoring_integrations_workspace_idx 
    ON ${monitoringIntegrations._.name}(workspace_id);
    
    CREATE INDEX IF NOT EXISTS monitoring_integrations_type_idx 
    ON ${monitoringIntegrations._.name}(type);
    
    CREATE INDEX IF NOT EXISTS monitoring_integrations_system_idx 
    ON ${monitoringIntegrations._.name}(system);
    
    CREATE INDEX IF NOT EXISTS monitoring_metrics_integration_idx 
    ON ${monitoringMetrics._.name}(integration_id);
    
    CREATE INDEX IF NOT EXISTS monitoring_metrics_timestamp_idx 
    ON ${monitoringMetrics._.name}(timestamp);
    
    CREATE INDEX IF NOT EXISTS monitoring_endpoints_integration_idx 
    ON ${monitoringEndpoints._.name}(integration_id);
    
    CREATE INDEX IF NOT EXISTS monitoring_alerts_integration_idx 
    ON ${monitoringAlerts._.name}(integration_id);
  `);
  
  logger.info('Monitoring tables created successfully');
}

/**
 * Seed default monitoring systems for development and testing
 */
async function seedDefaultMonitoringSystems(client: any) {
  logger.info('Seeding default monitoring systems');
  
  // Check if we already have systems
  const { rows } = await client.query(`
    SELECT COUNT(*) as count FROM ${monitoringIntegrations._.name}
  `);
  
  if (rows[0].count > 0) {
    logger.info('Monitoring systems already exist, skipping seed');
    return;
  }
  
  // Insert sample integrations for development
  await client.query(`
    -- Prometheus APM
    INSERT INTO ${monitoringIntegrations._.name} 
    (name, type, system, description, enabled, status, config, created_at, updated_at)
    VALUES 
    (
      'Prometheus Metrics', 
      'apm', 
      'prometheus', 
      'Prometheus metrics collection and alerting', 
      TRUE, 
      'configured',
      '{"scrapeInterval": "15s", "evaluationInterval": "15s", "scrapeTimeout": "10s"}',
      NOW(),
      NOW()
    );
    
    -- Example endpoint for Prometheus
    INSERT INTO ${monitoringEndpoints._.name}
    (integration_id, name, type, path, enabled, created_at, updated_at)
    VALUES
    (
      1,
      'HTTP API Metrics',
      'prometheus',
      '/metrics',
      TRUE,
      NOW(),
      NOW()
    );
    
    -- Datadog APM
    INSERT INTO ${monitoringIntegrations._.name} 
    (name, type, system, description, enabled, status, config, created_at, updated_at)
    VALUES 
    (
      'Datadog APM', 
      'apm', 
      'datadog', 
      'Datadog APM for application performance monitoring', 
      FALSE, 
      'configured',
      '{"ddUrl": "https://app.datadoghq.com", "env": "production"}',
      NOW(),
      NOW()
    );
    
    -- Splunk Logging
    INSERT INTO ${monitoringIntegrations._.name} 
    (name, type, system, description, enabled, status, config, created_at, updated_at)
    VALUES 
    (
      'Splunk Logging', 
      'logging', 
      'splunk', 
      'Splunk log aggregation for centralized logging', 
      FALSE, 
      'configured',
      '{"hec_endpoint": "https://http-inputs.splunk.example.com", "format": "json"}',
      NOW(),
      NOW()
    );
    
    -- ELK Stack
    INSERT INTO ${monitoringIntegrations._.name} 
    (name, type, system, description, enabled, status, config, created_at, updated_at)
    VALUES 
    (
      'ELK Stack', 
      'logging', 
      'elastic_stack', 
      'Elasticsearch, Logstash and Kibana for log management', 
      FALSE, 
      'configured',
      '{"elasticsearch_url": "https://es.example.com:9200", "index_pattern": "logs-*"}',
      NOW(),
      NOW()
    );
  `);
  
  logger.info('Default monitoring systems seeded successfully');
}