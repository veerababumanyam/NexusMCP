/**
 * Migration: Tamper-Proof Storage & Real-Time Alerting
 * 
 * Adds:
 * - Blockchain-based tamper-proof storage for immutable logs
 * - Real-time alerting system for compliance and policy violations
 * 
 * Enterprise-grade security features:
 * - Immutable, WORM-compliant storage
 * - Proof of authenticity via blockchain
 * - Cryptographic verification
 * - Multi-level alerting
 */

import { sql } from 'drizzle-orm';
import { db, pool } from '../index';

export async function runTamperProofStorageMigration() {
  try {
    console.log('Starting tamper-proof storage migration...');
    
    // Start a transaction
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Create immutable logs table for blockchain-based tamper-proof storage
      await client.query(`
        CREATE TABLE IF NOT EXISTS mcp_immutable_logs (
          id SERIAL PRIMARY KEY,
          block_index INTEGER NOT NULL,
          block_hash TEXT NOT NULL,
          previous_hash TEXT NOT NULL,
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          nonce INTEGER NOT NULL,
          data JSONB NOT NULL,
          validation_status TEXT DEFAULT 'pending' NOT NULL,
          last_validated_at TIMESTAMP WITH TIME ZONE,
          workspace_id INTEGER REFERENCES workspaces(id),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );
        
        CREATE INDEX IF NOT EXISTS block_hash_idx ON mcp_immutable_logs(block_hash);
        CREATE INDEX IF NOT EXISTS block_index_idx ON mcp_immutable_logs(block_index);
        CREATE INDEX IF NOT EXISTS mcp_immutable_logs_timestamp_idx ON mcp_immutable_logs(timestamp);
        CREATE INDEX IF NOT EXISTS mcp_immutable_logs_workspace_id_idx ON mcp_immutable_logs(workspace_id);
      `);
      
      console.log('Created mcp_immutable_logs table');
      
      // Create alerts table for real-time policy and compliance breach notifications
      await client.query(`
        CREATE TABLE IF NOT EXISTS mcp_alerts (
          id SERIAL PRIMARY KEY,
          alert_id UUID NOT NULL UNIQUE,
          workspace_id INTEGER REFERENCES workspaces(id),
          type TEXT NOT NULL,
          severity TEXT NOT NULL DEFAULT 'medium',
          title TEXT NOT NULL,
          message TEXT NOT NULL,
          details JSONB,
          source TEXT NOT NULL,
          source_id TEXT,
          status TEXT NOT NULL DEFAULT 'new',
          timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          acknowledged_at TIMESTAMP WITH TIME ZONE,
          acknowledged_by INTEGER REFERENCES users(id),
          resolved_at TIMESTAMP WITH TIME ZONE,
          resolved_by INTEGER REFERENCES users(id),
          resolution_notes TEXT,
          notification_sent BOOLEAN DEFAULT FALSE,
          notification_channels JSONB,
          webhook_responses JSONB,
          tags JSONB
        );
        
        CREATE INDEX IF NOT EXISTS mcp_alerts_workspace_id_idx ON mcp_alerts(workspace_id);
        CREATE INDEX IF NOT EXISTS mcp_alerts_type_idx ON mcp_alerts(type);
        CREATE INDEX IF NOT EXISTS mcp_alerts_severity_idx ON mcp_alerts(severity);
        CREATE INDEX IF NOT EXISTS mcp_alerts_status_idx ON mcp_alerts(status);
        CREATE INDEX IF NOT EXISTS mcp_alerts_timestamp_idx ON mcp_alerts(timestamp);
      `);
      
      console.log('Created mcp_alerts table');
      
      // Add related columns to existing tables if needed
      
      // Update session logs to support tamper-proof features
      await client.query(`
        ALTER TABLE mcp_session_logs
        ADD COLUMN IF NOT EXISTS is_archived_to_worm BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS worm_archive_path TEXT,
        ADD COLUMN IF NOT EXISTS worm_archive_checksum TEXT,
        ADD COLUMN IF NOT EXISTS blockchain_verification_status TEXT;
      `);
      
      console.log('Updated mcp_session_logs table with tamper-proof columns');
      
      // Update compliance reports to support enhanced features
      await client.query(`
        ALTER TABLE mcp_compliance_reports
        ADD COLUMN IF NOT EXISTS blockchain_verification_hash TEXT,
        ADD COLUMN IF NOT EXISTS verification_method TEXT,
        ADD COLUMN IF NOT EXISTS legal_hold_status TEXT DEFAULT 'none',
        ADD COLUMN IF NOT EXISTS evidence_chain JSONB;
      `);
      
      console.log('Updated mcp_compliance_reports table with verification columns');
      
      // Create system settings for tamper-proof configuration
      await client.query(`
        CREATE TABLE IF NOT EXISTS tamper_proof_settings (
          id SERIAL PRIMARY KEY,
          workspace_id INTEGER REFERENCES workspaces(id) UNIQUE,
          worm_storage_enabled BOOLEAN DEFAULT TRUE,
          blockchain_storage_enabled BOOLEAN DEFAULT TRUE,
          worm_storage_path TEXT,
          worm_retention_period_days INTEGER DEFAULT 365,
          blockchain_verification_frequency TEXT DEFAULT 'daily',
          last_integrity_check TIMESTAMP WITH TIME ZONE,
          integrity_check_status TEXT DEFAULT 'none',
          tamper_detected_actions JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_by INTEGER REFERENCES users(id)
        );
      `);
      
      console.log('Created tamper_proof_settings table');
      
      // Create alert notification settings
      await client.query(`
        CREATE TABLE IF NOT EXISTS alert_notification_settings (
          id SERIAL PRIMARY KEY,
          workspace_id INTEGER REFERENCES workspaces(id) UNIQUE,
          email_notifications_enabled BOOLEAN DEFAULT TRUE,
          webhook_notifications_enabled BOOLEAN DEFAULT FALSE,
          webhook_urls JSONB,
          webhook_secret TEXT,
          notification_throttling_seconds INTEGER DEFAULT 300,
          minimum_severity_for_notification TEXT DEFAULT 'high',
          user_notification_preferences JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_by INTEGER REFERENCES users(id)
        );
      `);
      
      console.log('Created alert_notification_settings table');
      
      await client.query('COMMIT');
      console.log('Tamper-proof storage and alerting migration completed successfully');
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error during tamper-proof storage migration:', error);
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}