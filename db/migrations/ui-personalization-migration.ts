import { pool, db } from '../index.js';
import { 
  uiPersonalization, 
  uiWizardProgress, 
  uiFeatureUsage 
} from '@shared/schema_ui_personalization';
import { sql } from 'drizzle-orm';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

/**
 * Creates UI personalization tables if they don't exist.
 */
export async function runUiPersonalizationMigration() {
  console.log('Starting UI Personalization migration...');
  
  try {
    const client = await pool.connect();
    
    try {
      // Begin transaction
      await client.query('BEGIN');
      
      // Create uiPersonalization table if it doesn't exist
      console.log('Creating ui_personalization table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS "ui_personalization" (
          "id" SERIAL PRIMARY KEY,
          "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
          "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL,
          "layout_preferences" JSONB DEFAULT '{}' NOT NULL,
          "dashboard_widgets" JSONB DEFAULT '[]' NOT NULL,
          "sidebar_config" JSONB DEFAULT '{}' NOT NULL,
          "theme" TEXT DEFAULT 'system',
          "font_scale" TEXT DEFAULT 'medium',
          "accessibility_options" JSONB DEFAULT '{}' NOT NULL,
          "last_modified_by" INTEGER,
          "analytics_enabled" BOOLEAN DEFAULT TRUE
        );
        
        CREATE INDEX IF NOT EXISTS "ui_personalization_user_id_idx" ON "ui_personalization"("user_id");
      `);
      
      // Create uiWizardProgress table if it doesn't exist
      console.log('Creating ui_wizard_progress table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS "ui_wizard_progress" (
          "id" SERIAL PRIMARY KEY,
          "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "wizard_type" TEXT NOT NULL,
          "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
          "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL,
          "completed" BOOLEAN DEFAULT FALSE NOT NULL,
          "current_step" INTEGER DEFAULT 0 NOT NULL,
          "steps_completed" JSONB DEFAULT '[]' NOT NULL,
          "data" JSONB DEFAULT '{}' NOT NULL,
          "last_interaction_at" TIMESTAMP DEFAULT NOW() NOT NULL
        );
        
        CREATE INDEX IF NOT EXISTS "ui_wizard_progress_user_id_idx" ON "ui_wizard_progress"("user_id");
        CREATE INDEX IF NOT EXISTS "ui_wizard_progress_wizard_type_idx" ON "ui_wizard_progress"("wizard_type");
        CREATE INDEX IF NOT EXISTS "ui_wizard_progress_user_wizard_type_idx" ON "ui_wizard_progress"("user_id", "wizard_type");
      `);
      
      // Create uiFeatureUsage table if it doesn't exist
      console.log('Creating ui_feature_usage table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS "ui_feature_usage" (
          "id" SERIAL PRIMARY KEY,
          "user_id" INTEGER NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "feature_id" TEXT NOT NULL,
          "created_at" TIMESTAMP DEFAULT NOW() NOT NULL,
          "updated_at" TIMESTAMP DEFAULT NOW() NOT NULL,
          "usage_count" INTEGER DEFAULT 0 NOT NULL,
          "last_used_at" TIMESTAMP DEFAULT NOW() NOT NULL,
          "metadata" JSONB DEFAULT '{}' NOT NULL
        );
        
        CREATE INDEX IF NOT EXISTS "ui_feature_usage_user_id_idx" ON "ui_feature_usage"("user_id");
        CREATE INDEX IF NOT EXISTS "ui_feature_usage_feature_id_idx" ON "ui_feature_usage"("feature_id");
        CREATE INDEX IF NOT EXISTS "ui_feature_usage_user_feature_idx" ON "ui_feature_usage"("user_id", "feature_id");
      `);
      
      // Commit transaction
      await client.query('COMMIT');
      console.log('UI Personalization migration completed successfully');
      
    } catch (error) {
      // Rollback transaction in case of error
      await client.query('ROLLBACK');
      console.error('UI Personalization migration failed:', error);
      throw error;
    } finally {
      // Release client back to pool
      client.release();
    }
    
  } catch (error) {
    console.error('Failed to connect to database:', error);
    throw error;
  }
}

// Modern ES modules version of "if this is main module"
const isMainModule = import.meta.url === `file://${process.argv[1]}`;

// Run the migration if this file is executed directly
if (isMainModule) {
  runUiPersonalizationMigration()
    .then(() => {
      console.log('UI Personalization migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('UI Personalization migration failed:', error);
      process.exit(1);
    });
}