/**
 * Security Tooling Migration
 * 
 * This migration creates tables for security tooling integrations:
 * - SIEM (Security Information and Event Management) systems
 * - Secrets Management solutions
 * - CASB (Cloud Access Security Broker) platforms
 */

import { pool } from '@db';
import { logger } from '../../server/utils/logger';

/**
 * Run the security tooling migration
 */
export async function runSecurityToolingMigration() {
  const client = await pool.connect();
  const migrationLogger = logger.child({ component: 'Migration', migration: 'SecurityTooling' });
  
  try {
    migrationLogger.info('Starting security tooling migration');
    await client.query('BEGIN');
    
    // Create security_tooling table
    await createSecurityToolingTable(client);
    
    // Create security_tooling_events table
    await createSecurityEventLogsTable(client);
    
    // Create necessary indexes
    await createIndexes(client);
    
    // Commit transaction
    await client.query('COMMIT');
    migrationLogger.info('Security tooling migration completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    migrationLogger.error('Security tooling migration failed', { error });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Create the security_tooling table
 */
async function createSecurityToolingTable(client: any) {
  const sql = `
    CREATE TABLE IF NOT EXISTS security_tooling (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL, -- 'siem', 'secrets', 'casb'
      system TEXT NOT NULL,
      auth_type TEXT NOT NULL,
      enabled BOOLEAN DEFAULT TRUE,
      status TEXT DEFAULT 'configured',
      config JSONB DEFAULT '{}',
      
      -- Connection details
      host TEXT,
      port INTEGER,
      api_key TEXT,
      username TEXT,
      password TEXT,
      oauth_client_id TEXT,
      oauth_client_secret TEXT,
      oauth_redirect_uri TEXT,
      oauth_token_url TEXT,
      oauth_auth_url TEXT,
      oauth_scope TEXT,
      certificate_path TEXT,
      private_key_path TEXT,
      
      -- SIEM-specific configurations
      log_format TEXT,
      log_level TEXT,
      buffer_size INTEGER,
      retry_count INTEGER,
      max_batch_size INTEGER,
      log_source_identifier TEXT,
      
      -- Secrets-specific configurations
      vault_path TEXT,
      mount_point TEXT,
      namespace_id TEXT,
      
      -- CASB-specific configurations
      tenant_id TEXT,
      instance_id TEXT,
      
      -- Audit tracking
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      created_by INTEGER,
      updated_by INTEGER,
      last_successful_connection TIMESTAMP,
      error_message TEXT
    );
  `;
  
  await client.query(sql);
  logger.info('Created security_tooling table');
}

/**
 * Create the security_tooling_events table for logging security events
 */
async function createSecurityEventLogsTable(client: any) {
  const sql = `
    CREATE TABLE IF NOT EXISTS security_tooling_events (
      id SERIAL PRIMARY KEY,
      integration_id INTEGER REFERENCES security_tooling(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL,
      event_severity TEXT NOT NULL,
      event_source TEXT NOT NULL,
      event_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
      event_data JSONB DEFAULT '{}',
      user_id INTEGER,
      ip_address TEXT,
      session_id TEXT,
      status TEXT DEFAULT 'pending', -- 'pending', 'processing', 'sent', 'failed'
      retry_count INTEGER DEFAULT 0,
      error_message TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;
  
  await client.query(sql);
  logger.info('Created security_tooling_events table');
}

/**
 * Create indexes for better query performance
 */
async function createIndexes(client: any) {
  // Indexes for security_tooling table
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_security_tooling_type ON security_tooling(type);
    CREATE INDEX IF NOT EXISTS idx_security_tooling_system ON security_tooling(system);
    CREATE INDEX IF NOT EXISTS idx_security_tooling_status ON security_tooling(status);
  `);
  
  // Indexes for security_tooling_events table
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_security_events_integration_id ON security_tooling_events(integration_id);
    CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON security_tooling_events(event_timestamp);
    CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_tooling_events(event_type);
    CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_tooling_events(event_severity);
    CREATE INDEX IF NOT EXISTS idx_security_events_status ON security_tooling_events(status);
  `);
  
  logger.info('Created indexes for security tooling tables');
}