/**
 * File Storage Migration
 * 
 * This migration creates tables for enterprise file storage integrations:
 * - SharePoint (Microsoft 365)
 * - Box
 * - Dropbox Business
 * - Google Drive (Google Workspace) 
 * - OneDrive for Business
 */

import { pool } from '@db';
import { logger } from '../../server/utils/logger';

/**
 * Run the file storage migration
 */
export async function runFileStorageMigration() {
  const client = await pool.connect();
  const migrationLogger = logger.child({ component: 'Migration', migration: 'FileStorage' });
  
  try {
    migrationLogger.info('Starting file storage migration');
    await client.query('BEGIN');
    
    // Create file_storage_integrations table
    await createFileStorageIntegrationsTable(client);
    
    // Create file_references table
    await createFileReferencesTable(client);
    
    // Create file_operations_log table
    await createFileOperationsLogTable(client);
    
    // Create necessary indexes
    await createIndexes(client);
    
    // Commit transaction
    await client.query('COMMIT');
    migrationLogger.info('File storage migration completed successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    migrationLogger.error('File storage migration failed', { error });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Create the file_storage_integrations table
 */
async function createFileStorageIntegrationsTable(client: any) {
  const sql = `
    CREATE TABLE IF NOT EXISTS file_storage_integrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      provider TEXT NOT NULL,
      tenant_id TEXT,
      drive_id TEXT,
      site_id TEXT,
      root_folder_id TEXT,
      auth_type TEXT NOT NULL,
      auth_config JSONB NOT NULL DEFAULT '{}',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      default_integration BOOLEAN DEFAULT FALSE,
      connection_status TEXT DEFAULT 'pending',
      last_synced_at TIMESTAMP,
      refresh_token TEXT,
      access_token TEXT,
      token_expires_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      created_by INTEGER,
      updated_by INTEGER
    );
  `;
  
  await client.query(sql);
  logger.info('Created file_storage_integrations table');
}

/**
 * Create the file_references table
 */
async function createFileReferencesTable(client: any) {
  const sql = `
    CREATE TABLE IF NOT EXISTS file_references (
      id SERIAL PRIMARY KEY,
      integration_id INTEGER NOT NULL REFERENCES file_storage_integrations(id) ON DELETE CASCADE,
      external_id TEXT NOT NULL,
      name TEXT NOT NULL,
      mime_type TEXT,
      path TEXT NOT NULL,
      size INTEGER,
      parent_folder_id TEXT,
      web_url TEXT,
      download_url TEXT,
      thumbnail_url TEXT,
      is_folder BOOLEAN NOT NULL DEFAULT FALSE,
      metadata JSONB DEFAULT '{}',
      last_synced_at TIMESTAMP NOT NULL DEFAULT NOW(),
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE(integration_id, external_id)
    );
  `;
  
  await client.query(sql);
  logger.info('Created file_references table');
}

/**
 * Create the file_operations_log table
 */
async function createFileOperationsLogTable(client: any) {
  const sql = `
    CREATE TABLE IF NOT EXISTS file_operations_log (
      id SERIAL PRIMARY KEY,
      integration_id INTEGER NOT NULL REFERENCES file_storage_integrations(id) ON DELETE CASCADE,
      file_id INTEGER REFERENCES file_references(id) ON DELETE SET NULL,
      operation TEXT NOT NULL,
      status TEXT NOT NULL,
      user_id INTEGER,
      error_message TEXT,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `;
  
  await client.query(sql);
  logger.info('Created file_operations_log table');
}

/**
 * Create indexes for better query performance
 */
async function createIndexes(client: any) {
  // Indexes for file_storage_integrations table
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_file_storage_integrations_provider ON file_storage_integrations(provider);
    CREATE INDEX IF NOT EXISTS idx_file_storage_integrations_status ON file_storage_integrations(connection_status);
    CREATE INDEX IF NOT EXISTS idx_file_storage_integrations_active ON file_storage_integrations(is_active);
  `);
  
  // Indexes for file_references table
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_file_references_integration_id ON file_references(integration_id);
    CREATE INDEX IF NOT EXISTS idx_file_references_parent_folder_id ON file_references(parent_folder_id);
    CREATE INDEX IF NOT EXISTS idx_file_references_is_folder ON file_references(is_folder);
    CREATE INDEX IF NOT EXISTS idx_file_references_name ON file_references(name);
  `);
  
  // Indexes for file_operations_log table
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_file_operations_log_integration_id ON file_operations_log(integration_id);
    CREATE INDEX IF NOT EXISTS idx_file_operations_log_operation ON file_operations_log(operation);
    CREATE INDEX IF NOT EXISTS idx_file_operations_log_status ON file_operations_log(status);
    CREATE INDEX IF NOT EXISTS idx_file_operations_log_created_at ON file_operations_log(created_at);
  `);
  
  logger.info('Created indexes for file storage tables');
}