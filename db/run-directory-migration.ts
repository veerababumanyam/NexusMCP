/**
 * Directory Integration Migration
 * 
 * This migration adds tables for directory service integration:
 * - LDAP/Active Directory connections
 * - Directory user/group synchronization
 * - Directory sync configuration and audit
 */

import { db, pool } from "./index";
import { sql } from "drizzle-orm";

/**
 * Run the directory integration migration
 */
export async function runDirectoryIntegrationMigration() {
  console.log("Running directory integration migration...");

  const client = await pool.connect();
  try {
    // Start transaction
    await client.query("BEGIN");

    // Create directory tables
    await createDirectoryTables(client);

    // Seed default directory services
    await seedDefaultDirectoryServices(client);

    // Commit transaction
    await client.query("COMMIT");
    console.log("✅ Directory integration migration completed successfully");
  } catch (error) {
    // Rollback transaction on error
    await client.query("ROLLBACK");
    console.error("❌ Directory integration migration failed:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Create directory integration tables using SQL
 */
async function createDirectoryTables(client: any) {
  // LDAP Directories table
  await client.query(`
    CREATE TABLE IF NOT EXISTS ldap_directories (
      id SERIAL PRIMARY KEY,
      workspace_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      port INTEGER NOT NULL DEFAULT 389,
      bind_dn TEXT NOT NULL,
      bind_credential TEXT,
      search_base TEXT NOT NULL,
      user_dn_pattern TEXT,
      use_ssl BOOLEAN NOT NULL DEFAULT FALSE,
      use_tls BOOLEAN NOT NULL DEFAULT TRUE,
      connection_timeout INTEGER NOT NULL DEFAULT 5000,
      user_id_attribute TEXT NOT NULL DEFAULT 'uid',
      username_attribute TEXT NOT NULL DEFAULT 'uid',
      email_attribute TEXT NOT NULL DEFAULT 'mail',
      full_name_attribute TEXT NOT NULL DEFAULT 'cn',
      group_member_attribute TEXT NOT NULL DEFAULT 'memberOf',
      sync_groups BOOLEAN NOT NULL DEFAULT TRUE,
      group_search_base TEXT,
      group_object_class TEXT NOT NULL DEFAULT 'groupOfNames',
      group_name_attribute TEXT NOT NULL DEFAULT 'cn',
      last_sync_at TIMESTAMP WITH TIME ZONE,
      sync_status TEXT,
      sync_error TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )
  `);
  
  // Directory Groups table
  await client.query(`
    CREATE TABLE IF NOT EXISTS directory_groups (
      id SERIAL PRIMARY KEY,
      directory_id INTEGER NOT NULL,
      workspace_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      external_id TEXT NOT NULL,
      member_count INTEGER DEFAULT 0,
      metadata JSONB,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      CONSTRAINT fk_directory FOREIGN KEY (directory_id) REFERENCES ldap_directories(id) ON DELETE CASCADE
    )
  `);
  
  // Directory Group Role Mappings table
  await client.query(`
    CREATE TABLE IF NOT EXISTS directory_group_role_mappings (
      id SERIAL PRIMARY KEY,
      directory_group_id INTEGER NOT NULL,
      role_id INTEGER NOT NULL,
      workspace_id INTEGER,
      is_auto_provisioned BOOLEAN NOT NULL DEFAULT FALSE,
      created_by_id INTEGER,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      CONSTRAINT fk_directory_group FOREIGN KEY (directory_group_id) REFERENCES directory_groups(id) ON DELETE CASCADE,
      CONSTRAINT fk_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    )
  `);
  
  // Create indexes for better performance
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_ldap_directories_workspace_id ON ldap_directories(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_directory_groups_directory_id ON directory_groups(directory_id);
    CREATE INDEX IF NOT EXISTS idx_directory_groups_workspace_id ON directory_groups(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_directory_groups_external_id ON directory_groups(external_id);
    CREATE INDEX IF NOT EXISTS idx_directory_group_role_mappings_directory_group_id ON directory_group_role_mappings(directory_group_id);
    CREATE INDEX IF NOT EXISTS idx_directory_group_role_mappings_role_id ON directory_group_role_mappings(role_id);
    CREATE INDEX IF NOT EXISTS idx_directory_group_role_mappings_workspace_id ON directory_group_role_mappings(workspace_id);
  `);
}

/**
 * Seed default directory services (optional for production)
 */
async function seedDefaultDirectoryServices(client: any) {
  // Check if we already have directory services
  const result = await client.query(`SELECT COUNT(*) FROM ldap_directories`);
  const count = parseInt(result.rows[0].count);
  
  // Skip seeding if we already have directory services
  if (count > 0) {
    console.log(`Found ${count} existing directory services, skipping seeding.`);
    return;
  }
  
  // No seeding needed for now
  console.log(`No default directory services to seed.`);
}