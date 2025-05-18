/**
 * Workspace Isolation Migration
 * 
 * This migration adds tables for workspace isolation and zero-trust security:
 * - Network isolation policies
 * - Resource access controls
 * - Data segregation rules
 * - Zero-trust security enforcement
 */

import { db, pool } from "./index";
import { sql } from "drizzle-orm";

/**
 * Run the workspace isolation migration
 */
export async function runWorkspaceIsolationMigration() {
  console.log("Running workspace isolation migration...");

  const client = await pool.connect();
  try {
    // Start transaction
    await client.query("BEGIN");

    // Create workspace isolation tables
    await createWorkspaceIsolationTables(client);

    // Commit transaction
    await client.query("COMMIT");
    console.log("✅ Workspace isolation migration completed successfully");
  } catch (error) {
    // Rollback transaction on error
    await client.query("ROLLBACK");
    console.error("❌ Workspace isolation migration failed:", error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Create workspace isolation tables using SQL
 */
async function createWorkspaceIsolationTables(client: any) {
  // Workspace Isolation Settings table
  await client.query(`
    CREATE TABLE IF NOT EXISTS workspace_isolation_settings (
      id SERIAL PRIMARY KEY,
      workspace_id INTEGER NOT NULL UNIQUE,
      network_isolation BOOLEAN NOT NULL DEFAULT FALSE,
      resource_isolation BOOLEAN NOT NULL DEFAULT FALSE,
      data_segregation BOOLEAN NOT NULL DEFAULT FALSE,
      enforce_zero_trust BOOLEAN NOT NULL DEFAULT FALSE,
      allowed_ip_ranges TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      allowed_domains TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      isolation_level TEXT NOT NULL DEFAULT 'none',
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      CONSTRAINT fk_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    )
  `);
  
  // Workspace Resource Access Control table
  await client.query(`
    CREATE TABLE IF NOT EXISTS workspace_resource_access (
      id SERIAL PRIMARY KEY,
      workspace_id INTEGER NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT NOT NULL,
      allowed_actions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      denied_actions TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      access_level TEXT NOT NULL DEFAULT 'read',
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      CONSTRAINT fk_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE,
      CONSTRAINT unique_workspace_resource UNIQUE (workspace_id, resource_type, resource_id)
    )
  `);
  
  // Workspace Network Access Rules table
  await client.query(`
    CREATE TABLE IF NOT EXISTS workspace_network_access (
      id SERIAL PRIMARY KEY,
      workspace_id INTEGER NOT NULL,
      rule_type TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      ip_range TEXT,
      domain TEXT,
      allow BOOLEAN NOT NULL DEFAULT TRUE,
      priority INTEGER NOT NULL DEFAULT 100,
      description TEXT,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      CONSTRAINT fk_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    )
  `);
  
  // Create indexes for better performance
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_workspace_isolation_settings_workspace_id ON workspace_isolation_settings(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_workspace_resource_access_workspace_id ON workspace_resource_access(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_workspace_resource_access_resource_type ON workspace_resource_access(resource_type);
    CREATE INDEX IF NOT EXISTS idx_workspace_resource_access_resource_id ON workspace_resource_access(resource_id);
    CREATE INDEX IF NOT EXISTS idx_workspace_network_access_workspace_id ON workspace_network_access(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_workspace_network_access_rule_type ON workspace_network_access(rule_type);
    CREATE INDEX IF NOT EXISTS idx_workspace_network_access_resource_type ON workspace_network_access(resource_type);
  `);
}