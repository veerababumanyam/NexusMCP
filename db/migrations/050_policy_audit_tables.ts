/**
 * Migration script to create Enhanced Audit Log tables and related schemas
 * 
 * This migration creates tables for:
 * - Enhanced audit logs with encryption and integrity verification
 * - Audit settings for workspaces
 * - Encryption key management
 * - Alert events triggered by audit logs
 * - Audit log archives for retention management
 * - Audit integrity checks
 */

import { pool } from '../index';
import { sql } from 'drizzle-orm';
import logger from '../../server/logger';

export async function createPolicyAuditTables() {
  try {
    logger.info('Starting audit log tables migration');

    const client = await pool.connect();
    
    try {
      // Begin transaction
      await client.query('BEGIN');
      
      logger.info('Creating enhanced_audit_logs table');
      // Create enhanced audit logs table
      await client.query(`
        CREATE TABLE IF NOT EXISTS enhanced_audit_logs (
          id SERIAL PRIMARY KEY,
          user_id INTEGER,
          action TEXT NOT NULL,
          resource_type TEXT NOT NULL,
          resource_id TEXT,
          status TEXT NOT NULL DEFAULT 'info',
          severity TEXT NOT NULL DEFAULT 'info',
          workspace_id INTEGER,
          server_id INTEGER,
          ip_address TEXT,
          user_agent TEXT,
          device_id TEXT,
          session_id TEXT,
          geo_location JSONB,
          details JSONB,
          request_payload JSONB,
          response_payload JSONB,
          parent_event_id INTEGER,
          correlation_id TEXT,
          trace_id TEXT,
          compliance_category TEXT,
          tags TEXT,
          hashed_payload TEXT,
          is_encrypted BOOLEAN DEFAULT FALSE,
          integrity_checksum TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
      `);
      
      logger.info('Creating audit_settings table');
      // Create audit settings table
      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_settings (
          id SERIAL PRIMARY KEY,
          workspace_id INTEGER UNIQUE,
          retention_period_days INTEGER NOT NULL DEFAULT 90,
          encryption_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          mask_pii BOOLEAN NOT NULL DEFAULT TRUE,
          log_level TEXT NOT NULL DEFAULT 'info',
          alerting_enabled BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
      `);
      
      logger.info('Creating encryption_keys table');
      // Create encryption keys table
      await client.query(`
        CREATE TABLE IF NOT EXISTS encryption_keys (
          id SERIAL PRIMARY KEY,
          key_identifier TEXT NOT NULL UNIQUE,
          key_type TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          key_data TEXT NOT NULL,
          effective_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
          effective_until TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
      `);
      
      logger.info('Creating alert_events table');
      // Create alert events table
      await client.query(`
        CREATE TABLE IF NOT EXISTS alert_events (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT NOT NULL,
          severity TEXT NOT NULL DEFAULT 'medium',
          status TEXT NOT NULL DEFAULT 'new',
          workspace_id INTEGER,
          log_ids JSONB,
          resolution_notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
          acknowledged_at TIMESTAMP WITH TIME ZONE,
          resolved_at TIMESTAMP WITH TIME ZONE,
          updated_at TIMESTAMP WITH TIME ZONE
        )
      `);
      
      logger.info('Creating audit_log_archives table');
      // Create audit log archives table
      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_log_archives (
          id SERIAL PRIMARY KEY,
          batch_id TEXT NOT NULL UNIQUE,
          from_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
          to_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
          workspace_id INTEGER,
          record_count INTEGER NOT NULL,
          storage_location TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL
        )
      `);
      
      logger.info('Creating audit_integrity_checks table');
      // Create audit integrity checks table
      await client.query(`
        CREATE TABLE IF NOT EXISTS audit_integrity_checks (
          id SERIAL PRIMARY KEY,
          workspace_id INTEGER,
          logs_checked INTEGER NOT NULL,
          issues_found INTEGER NOT NULL DEFAULT 0,
          issue_details JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
          user_id INTEGER
        )
      `);
      
      logger.info('Creating indexes for audit tables');
      // Create indexes for performance
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_enhanced_audit_logs_workspace_id ON enhanced_audit_logs(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_enhanced_audit_logs_user_id ON enhanced_audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_enhanced_audit_logs_action ON enhanced_audit_logs(action);
        CREATE INDEX IF NOT EXISTS idx_enhanced_audit_logs_resource_type ON enhanced_audit_logs(resource_type);
        CREATE INDEX IF NOT EXISTS idx_enhanced_audit_logs_severity ON enhanced_audit_logs(severity);
        CREATE INDEX IF NOT EXISTS idx_enhanced_audit_logs_created_at ON enhanced_audit_logs(created_at);
        CREATE INDEX IF NOT EXISTS idx_enhanced_audit_logs_correlation_id ON enhanced_audit_logs(correlation_id);
        
        CREATE INDEX IF NOT EXISTS idx_alert_events_workspace_id ON alert_events(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_alert_events_status ON alert_events(status);
        CREATE INDEX IF NOT EXISTS idx_alert_events_severity ON alert_events(severity);
        CREATE INDEX IF NOT EXISTS idx_alert_events_created_at ON alert_events(created_at);
        
        CREATE INDEX IF NOT EXISTS idx_audit_log_archives_workspace_id ON audit_log_archives(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_audit_log_archives_created_at ON audit_log_archives(created_at);
      `);
      
      logger.info('Creating foreign key constraints');
      // Add foreign key constraints
      await client.query(`
        ALTER TABLE enhanced_audit_logs
        ADD CONSTRAINT fk_enhanced_audit_logs_parent
        FOREIGN KEY (parent_event_id)
        REFERENCES enhanced_audit_logs(id)
        ON DELETE SET NULL;
      `);
      
      logger.info('Creating default audit settings');
      // Insert default audit settings
      await client.query(`
        INSERT INTO audit_settings (workspace_id, retention_period_days, encryption_enabled, mask_pii, log_level, alerting_enabled)
        VALUES (NULL, 90, TRUE, TRUE, 'info', TRUE)
        ON CONFLICT DO NOTHING;
      `);
      
      // Generate default encryption key if not exists
      logger.info('Creating default encryption key');
      await client.query(`
        INSERT INTO encryption_keys (key_identifier, key_type, status, key_data)
        VALUES (
          'default-aes-key-' || EXTRACT(EPOCH FROM CURRENT_TIMESTAMP)::TEXT,
          'aes',
          'active',
          encode(gen_random_bytes(32), 'hex')
        )
        ON CONFLICT DO NOTHING;
      `);
      
      // Commit transaction
      await client.query('COMMIT');
      
      logger.info('Successfully created audit log tables');
      return true;
    } catch (error) {
      // Rollback transaction on error
      await client.query('ROLLBACK');
      logger.error('Error creating audit log tables:', error);
      throw error;
    } finally {
      // Release client back to pool
      client.release();
    }
  } catch (error) {
    logger.error('Failed to create audit log tables:', error);
    throw error;
  }
}

// Execute if this script is run directly
if (require.main === module) {
  createPolicyAuditTables()
    .then(() => {
      console.log('Audit log tables migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Error in audit log tables migration:', error);
      process.exit(1);
    });
}