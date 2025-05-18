/**
 * Migration script to update workspace table schema
 * 
 * This migration adds missing columns to the workspaces table:
 * - isolation_level
 * - custom_domain
 */

import { pool } from './index';

export async function updateWorkspaceSchema() {
  console.log('Running workspace schema update migration...');
  const client = await pool.connect();

  try {
    // Begin transaction
    await client.query('BEGIN');

    // Check if columns exist before adding them
    const checkIsolationLevelQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'workspaces' AND column_name = 'isolation_level'
    `;
    
    const checkCustomDomainQuery = `
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'workspaces' AND column_name = 'custom_domain'
    `;

    const isolationLevelExists = await client.query(checkIsolationLevelQuery);
    const customDomainExists = await client.query(checkCustomDomainQuery);

    // Add isolation_level column if it doesn't exist
    if (isolationLevelExists.rowCount === 0) {
      console.log('Adding isolation_level column to workspaces table...');
      await client.query(`
        ALTER TABLE workspaces 
        ADD COLUMN isolation_level TEXT DEFAULT 'standard' NOT NULL
      `);
    } else {
      console.log('isolation_level column already exists in workspaces table');
    }

    // Add custom_domain column if it doesn't exist
    if (customDomainExists.rowCount === 0) {
      console.log('Adding custom_domain column to workspaces table...');
      await client.query(`
        ALTER TABLE workspaces 
        ADD COLUMN custom_domain TEXT UNIQUE
      `);
    } else {
      console.log('custom_domain column already exists in workspaces table');
    }

    // Commit transaction
    await client.query('COMMIT');
    console.log('Workspace schema update completed successfully');
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('Error updating workspace schema:', error);
    throw error;
  } finally {
    // Release client
    client.release();
  }
}

// Run migration if executed directly
if (require.main === module) {
  updateWorkspaceSchema()
    .then(() => {
      console.log('Workspace schema update migration completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('Workspace schema update migration failed:', error);
      process.exit(1);
    });
}