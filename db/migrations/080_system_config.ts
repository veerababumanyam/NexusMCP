import { pool } from '../index';
import { sql } from 'drizzle-orm';

/**
 * Migration to create the system_config table
 */
export async function migrate() {
  const client = await pool.connect();

  try {
    // Begin transaction
    await client.query('BEGIN');

    console.log('Creating system_config table...');
    
    // Create system_config table
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_config (
        id SERIAL PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        value TEXT,
        description TEXT,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        is_required BOOLEAN DEFAULT false,
        is_sensitive BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Commit transaction
    await client.query('COMMIT');
    console.log('System config migration completed successfully');
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('Error in system config migration:', error);
    throw error;
  } finally {
    // Release client back to pool
    client.release();
  }
}