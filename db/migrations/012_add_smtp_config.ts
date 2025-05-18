import { db } from '../index';
import { sql } from 'drizzle-orm';

/**
 * Migration to add SMTP configuration table
 */
export async function addSmtpConfigurationTable() {
  console.log('Running SMTP configuration table migration...');
  
  try {
    // Check if table exists
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'smtp_configurations'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('Creating smtp_configurations table...');
      
      // Create table
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS "smtp_configurations" (
          "id" SERIAL PRIMARY KEY,
          "workspace_id" INTEGER REFERENCES "workspaces"("id"),
          "name" TEXT NOT NULL,
          "host" TEXT NOT NULL,
          "port" INTEGER NOT NULL,
          "username" TEXT NOT NULL,
          "encrypted_password" TEXT NOT NULL,
          "from_email" TEXT NOT NULL,
          "from_name" TEXT,
          "require_tls" BOOLEAN DEFAULT TRUE,
          "reject_unauthorized" BOOLEAN DEFAULT TRUE,
          "environment" TEXT DEFAULT 'production',
          "is_default" BOOLEAN DEFAULT FALSE,
          "is_active" BOOLEAN DEFAULT TRUE,
          "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
          "last_tested_at" TIMESTAMP,
          "test_status" TEXT,
          "max_retries" INTEGER DEFAULT 3,
          "retry_interval" INTEGER DEFAULT 60
        );
      `);
      
      console.log('smtp_configurations table created successfully');
      
      // Seed default SMTP configuration
      await db.execute(sql`
        INSERT INTO "smtp_configurations" (
          "name", "host", "port", "username", "encrypted_password", 
          "from_email", "from_name", "is_default", "is_active"
        ) VALUES (
          'Default SMTP', 'smtp.example.com', 587, 'mail@example.com', 'password',
          'notifications@example.com', 'NexusMCP Notifications', TRUE, FALSE
        );
      `);
      
      console.log('Default SMTP configuration created');
    } else {
      console.log('smtp_configurations table already exists, checking for column updates...');
      
      // Check if specific columns exist and add them if missing
      const columnQueries = [
        {
          name: 'max_retries',
          query: sql`
            ALTER TABLE "smtp_configurations" 
            ADD COLUMN IF NOT EXISTS "max_retries" INTEGER DEFAULT 3;
          `
        },
        {
          name: 'retry_interval',
          query: sql`
            ALTER TABLE "smtp_configurations" 
            ADD COLUMN IF NOT EXISTS "retry_interval" INTEGER DEFAULT 60;
          `
        },
        {
          name: 'test_status',
          query: sql`
            ALTER TABLE "smtp_configurations" 
            ADD COLUMN IF NOT EXISTS "test_status" TEXT;
          `
        },
        {
          name: 'last_tested_at',
          query: sql`
            ALTER TABLE "smtp_configurations" 
            ADD COLUMN IF NOT EXISTS "last_tested_at" TIMESTAMP;
          `
        },
        {
          name: 'reject_unauthorized',
          query: sql`
            ALTER TABLE "smtp_configurations" 
            ADD COLUMN IF NOT EXISTS "reject_unauthorized" BOOLEAN DEFAULT TRUE;
          `
        }
      ];
      
      for (const column of columnQueries) {
        await db.execute(column.query);
        console.log(`Added column ${column.name} if it didn't exist already`);
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error creating SMTP configuration table:', error);
    return { success: false, error };
  }
}