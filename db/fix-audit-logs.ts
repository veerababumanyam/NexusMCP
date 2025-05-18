import { pool, db } from "./index";
import { sql } from "drizzle-orm";
import { logger } from "../server/utils/logger";

/**
 * Script to fix audit logs table structure
 * This adds missing columns to the audit_settings and alert_events tables
 */
export async function fixAuditLogs() {
  try {
    logger.info("Starting audit logs database schema fix");

    // Connect to the database
    const client = await pool.connect();
    
    try {
      // Check if mask_pii column exists in audit_settings
      const maskPiiExists = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'audit_settings' AND column_name = 'mask_pii'
      `);

      if (maskPiiExists.rowCount === 0) {
        logger.info("Adding mask_pii column to audit_settings table");
        await client.query(`
          ALTER TABLE audit_settings
          ADD COLUMN mask_pii BOOLEAN DEFAULT TRUE NOT NULL
        `);
      } else {
        logger.info("mask_pii column already exists in audit_settings table");
      }

      // Check if log_ids column exists in alert_events
      const logIdsExists = await client.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'alert_events' AND column_name = 'log_ids'
      `);

      if (logIdsExists.rowCount === 0) {
        logger.info("Adding log_ids column to alert_events table");
        await client.query(`
          ALTER TABLE alert_events
          ADD COLUMN log_ids JSONB DEFAULT '[]'::jsonb
        `);
      } else {
        logger.info("log_ids column already exists in alert_events table");
      }

      // Create default audit settings if they don't exist
      const settingsExist = await client.query(`
        SELECT id FROM audit_settings WHERE workspace_id IS NULL LIMIT 1
      `);

      if (settingsExist.rowCount === 0) {
        logger.info("Creating default audit settings");
        await client.query(`
          INSERT INTO audit_settings (
            workspace_id, retention_period_days, encryption_enabled, 
            mask_pii, log_level, alerting_enabled
          ) VALUES (
            NULL, 90, TRUE, TRUE, 'info', TRUE
          )
        `);
      }

      logger.info("Audit logs database schema fix completed successfully");
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error("Error fixing audit logs schema", error);
    throw error;
  }
}