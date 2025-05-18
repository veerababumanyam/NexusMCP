/**
 * Permission Sets Migration Script
 * 
 * This script updates the permission_sets table to add:
 * 1. workspace_id column to associate sets with specific workspaces
 * 2. is_global flag to indicate sets that are available across workspaces
 */

import { db, pool } from '.';
import { sql } from 'drizzle-orm';

/**
 * Run the permission sets migration
 */
export async function migratePermissionSets() {
  const client = await pool.connect();
  
  try {
    // Start a transaction
    await client.query('BEGIN');
    
    console.log('Starting permission sets migration...');
    
    // Check if the columns already exist
    const columnCheckQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'permission_sets' 
      AND column_name IN ('workspace_id', 'is_global')
    `;
    
    const { rows: existingColumns } = await client.query(columnCheckQuery);
    const existingColumnNames = existingColumns.map(col => col.column_name);
    
    // Add workspace_id column if it doesn't exist
    if (!existingColumnNames.includes('workspace_id')) {
      console.log('Adding workspace_id column to permission_sets table...');
      await client.query(`
        ALTER TABLE permission_sets 
        ADD COLUMN workspace_id INTEGER REFERENCES workspaces(id) ON DELETE SET NULL
      `);
    }
    
    // Add is_global column if it doesn't exist
    if (!existingColumnNames.includes('is_global')) {
      console.log('Adding is_global column to permission_sets table...');
      await client.query(`
        ALTER TABLE permission_sets 
        ADD COLUMN is_global BOOLEAN NOT NULL DEFAULT FALSE
      `);
      
      // Set existing permission sets as global by default for backward compatibility
      await client.query(`
        UPDATE permission_sets
        SET is_global = TRUE
        WHERE workspace_id IS NULL
      `);
    }
    
    // Create an index for faster lookups
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_permission_sets_workspace
      ON permission_sets(workspace_id)
    `);
    
    await client.query('COMMIT');
    console.log('Permission sets migration completed successfully.');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error during permission sets migration:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run this directly if this script is executed directly
if (require.main === module) {
  migratePermissionSets()
    .then(() => {
      console.log('Migration complete');
      process.exit(0);
    })
    .catch(err => {
      console.error('Migration failed:', err);
      process.exit(1);
    });
}