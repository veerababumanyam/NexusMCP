/**
 * Migration script for OAuth2/OIDC capabilities with custom provider support
 * 
 * This script adds the necessary fields to the auth_providers table to support:
 * - OAuth2 and OpenID Connect providers
 * - Custom OAuth providers
 * - Well-known providers like Google, Microsoft, GitHub, etc.
 */

import { pool } from '../index';

export async function migrate() {
  console.log('Running OAuth Enhancement migration...');
  
  try {
    // Start a transaction
    await pool.query('BEGIN');
    
    // Add OAuth/OIDC related fields to auth_providers table
    await pool.query(`
      ALTER TABLE auth_providers
      ADD COLUMN IF NOT EXISTS client_id TEXT,
      ADD COLUMN IF NOT EXISTS client_secret TEXT,
      ADD COLUMN IF NOT EXISTS authorization_url TEXT,
      ADD COLUMN IF NOT EXISTS token_url TEXT,
      ADD COLUMN IF NOT EXISTS user_info_url TEXT,
      ADD COLUMN IF NOT EXISTS scope TEXT,
      ADD COLUMN IF NOT EXISTS callback_url TEXT,
      ADD COLUMN IF NOT EXISTS issuer TEXT,
      ADD COLUMN IF NOT EXISTS jwks_uri TEXT,
      ADD COLUMN IF NOT EXISTS logo_url TEXT
    `);
    
    // Create index for faster lookups by type
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_auth_providers_type ON auth_providers (type);
    `);
    
    // Commit transaction
    await pool.query('COMMIT');
    
    console.log('OAuth Enhancement migration completed successfully.');
  } catch (error) {
    // Rollback on error
    await pool.query('ROLLBACK');
    console.error('OAuth Enhancement migration failed:', error);
    throw error;
  }
}