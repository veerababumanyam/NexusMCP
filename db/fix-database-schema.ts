import { pool, db } from './index';
import { sql } from 'drizzle-orm';

/**
 * This script is designed to fix database schema issues,
 * particularly creating the system_config table and other
 * essential tables that might be missing.
 */
async function fixDatabaseSchema() {
  const client = await pool.connect();

  try {
    // Begin transaction
    await client.query('BEGIN');

    console.log('Checking for and creating essential tables...');
    
    // Create system_config table if not exists
    console.log('Creating system_config table if not exists...');
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

    // Create systemBranding table if not exists
    console.log('Creating system_branding table if not exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_branding (
        id SERIAL PRIMARY KEY,
        organization_name TEXT NOT NULL,
        logo TEXT,
        favicon TEXT,
        primary_color TEXT NOT NULL,
        secondary_color TEXT NOT NULL,
        accent_color TEXT NOT NULL,
        enable_dark_mode BOOLEAN DEFAULT true NOT NULL,
        default_theme TEXT DEFAULT 'system' NOT NULL,
        primary_font_family TEXT NOT NULL,
        secondary_font_family TEXT NOT NULL,
        copyright_text TEXT,
        custom_css TEXT,
        custom_js TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_by INTEGER
      );
    `);

    // Create auth_providers table if not exists
    console.log('Creating auth_providers table if not exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS auth_providers (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        type TEXT NOT NULL,
        client_id TEXT,
        client_secret TEXT,
        authorization_url TEXT,
        token_url TEXT,
        user_info_url TEXT,
        scope TEXT,
        callback_url TEXT,
        issuer TEXT,
        jwks_uri TEXT,
        is_enabled BOOLEAN DEFAULT true NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Create smtp_config table if not exists
    console.log('Creating smtp_config table if not exists...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS smtp_config (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER,
        name TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER NOT NULL,
        username TEXT NOT NULL,
        encrypted_password TEXT NOT NULL,
        from_email TEXT NOT NULL,
        from_name TEXT,
        require_tls BOOLEAN DEFAULT true,
        reject_unauthorized BOOLEAN DEFAULT true,
        environment TEXT DEFAULT 'production',
        is_default BOOLEAN DEFAULT false,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
        last_tested_at TIMESTAMP WITH TIME ZONE,
        test_status TEXT,
        max_retries INTEGER DEFAULT 3,
        retry_interval INTEGER DEFAULT 60
      );
    `);

    // Seed default system branding if table is empty
    console.log('Checking if system_branding table needs default values...');
    const brandingCount = await client.query('SELECT COUNT(*) FROM system_branding');
    
    if (parseInt(brandingCount.rows[0].count) === 0) {
      console.log('Seeding default system branding...');
      await client.query(`
        INSERT INTO system_branding (
          organization_name, 
          primary_color, 
          secondary_color, 
          accent_color, 
          primary_font_family, 
          secondary_font_family
        ) VALUES (
          'NexusMCP Platform', 
          '#3B82F6', 
          '#1E40AF', 
          '#EC4899', 
          'Inter, sans-serif', 
          'Monospace, monospace'
        );
      `);
    }

    // Commit transaction
    await client.query('COMMIT');
    console.log('Database schema fix completed successfully');
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    console.error('Error fixing database schema:', error);
    throw error;
  } finally {
    // Release client back to pool
    client.release();
  }
}

// Run the script
fixDatabaseSchema()
  .then(() => {
    console.log('Database schema has been fixed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to fix database schema:', error);
    process.exit(1);
  });