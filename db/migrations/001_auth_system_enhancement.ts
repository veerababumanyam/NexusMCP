import { Pool } from 'pg';
import { db } from '../index';
import * as schema from '@shared/schema';

/**
 * Migration script to enhance authentication system
 * 
 * This script handles the database migration for the enhanced authentication system
 * with SSO, LDAP, MFA, and RBAC capabilities.
 */
async function migrateAuthSystem() {
  try {
    console.log('Starting auth system migration...');
    
    // Array of SQL statements to execute
    const sqlStatements = [
      // Auth Providers table
      `
      CREATE TABLE IF NOT EXISTS auth_providers (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        config JSONB,
        is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
      `,
      
      // Add new columns to the users table
      `
      ALTER TABLE users 
      ADD COLUMN IF NOT EXISTS uuid UUID DEFAULT gen_random_uuid() NOT NULL UNIQUE,
      ALTER COLUMN password DROP NOT NULL,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE NOT NULL,
      ADD COLUMN IF NOT EXISTS is_email_verified BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS mfa_secret TEXT,
      ADD COLUMN IF NOT EXISTS preferred_mfa_method TEXT,
      ADD COLUMN IF NOT EXISTS phone_number TEXT,
      ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0,
      ADD COLUMN IF NOT EXISTS locked_until TIMESTAMP,
      ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP,
      ADD COLUMN IF NOT EXISTS metadata JSONB,
      ADD COLUMN IF NOT EXISTS external_ids JSONB
      `,
      
      // User Identities table
      `
      CREATE TABLE IF NOT EXISTS user_identities (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider_id INTEGER NOT NULL REFERENCES auth_providers(id) ON DELETE CASCADE,
        external_id TEXT NOT NULL,
        access_token TEXT,
        refresh_token TEXT,
        token_expires_at TIMESTAMP,
        profile_data JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(user_id, provider_id),
        UNIQUE(provider_id, external_id)
      )
      `,
      
      // Roles table
      `
      CREATE TABLE IF NOT EXISTS roles (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        is_system BOOLEAN DEFAULT FALSE,
        workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
        permissions JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(name, workspace_id)
      )
      `,
      
      // User Roles table
      `
      CREATE TABLE IF NOT EXISTS user_roles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        workspace_id INTEGER REFERENCES workspaces(id) ON DELETE CASCADE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        assigned_by_id INTEGER REFERENCES users(id),
        UNIQUE(user_id, role_id, workspace_id)
      )
      `,
      
      // Permission Groups table
      `
      CREATE TABLE IF NOT EXISTS permission_groups (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
      `,
      
      // Permissions table
      `
      CREATE TABLE IF NOT EXISTS permissions (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        group_id INTEGER REFERENCES permission_groups(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
      `,
      
      // MFA Recovery Codes table
      `
      CREATE TABLE IF NOT EXISTS mfa_recovery_codes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        code TEXT NOT NULL,
        is_used BOOLEAN DEFAULT FALSE,
        used_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
      `,
      
      // FIDO2 Credentials table
      `
      CREATE TABLE IF NOT EXISTS fido2_credentials (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        credential_id TEXT NOT NULL UNIQUE,
        public_key TEXT NOT NULL,
        counter INTEGER NOT NULL,
        device_type TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_used TIMESTAMP
      )
      `,
      
      // User Sessions table
      `
      CREATE TABLE IF NOT EXISTS user_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        session_id TEXT NOT NULL UNIQUE,
        ip_address TEXT,
        user_agent TEXT,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        last_active TIMESTAMP
      )
      `,
      
      // Add default roles
      `
      INSERT INTO roles (name, description, is_system, permissions)
      VALUES 
        ('admin', 'System administrator with full access', TRUE, '["*:*"]'),
        ('user', 'Standard user with limited access', TRUE, '["read:self", "update:self"]'),
        ('workspace_admin', 'Workspace administrator', TRUE, '["*:workspace"]')
      ON CONFLICT (name, workspace_id) DO NOTHING
      `
    ];
    
    // Execute SQL statements in a transaction
    await db.transaction(async (tx) => {
      for (const sql of sqlStatements) {
        await tx.execute(sql);
      }
    });
    
    console.log('Auth system migration completed successfully.');
    return true;
  } catch (error) {
    console.error('Migration failed:', error);
    return false;
  }
}

export async function migrate() {
  const success = await migrateAuthSystem();
  if (success) {
    console.log('Migration completed successfully.');
  } else {
    console.error('Migration failed. See the error logs for details.');
    process.exit(1);
  }
}

// ESM modules don't have require.main === module
// Main execution will be handled by the migrate.ts file