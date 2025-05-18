import { db } from './index';

async function createSystemTables() {
  try {
    console.log("Creating necessary system configuration tables...");

    // Create system branding table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS system_branding (
        id SERIAL PRIMARY KEY,
        organization_name TEXT NOT NULL,
        organization_logo TEXT,
        footer_text TEXT,
        address TEXT,
        primary_color TEXT,
        secondary_color TEXT,
        favicon_url TEXT,
        custom_css TEXT,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_by INTEGER REFERENCES users(id)
      )
    `);
    console.log("Created system_branding table");

    // Create database_config table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS database_config (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        host TEXT NOT NULL,
        port INTEGER,
        database TEXT NOT NULL,
        username TEXT,
        password TEXT,
        ssl BOOLEAN DEFAULT false,
        options JSONB,
        is_default BOOLEAN DEFAULT false,
        is_enabled BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_by INTEGER REFERENCES users(id)
      )
    `);
    console.log("Created database_config table");

    // Create monitoring_config table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS monitoring_config (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        url TEXT NOT NULL,
        api_key TEXT,
        auth_token TEXT,
        refresh_interval INTEGER DEFAULT 60,
        is_enabled BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
        updated_by INTEGER REFERENCES users(id)
      )
    `);
    console.log("Created monitoring_config table");

    console.log("All system configuration tables created successfully");
  } catch (error) {
    console.error("Error creating system tables:", error);
  }
}

createSystemTables();