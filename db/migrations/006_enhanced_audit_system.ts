import { sql } from 'drizzle-orm';
import { pgTable, serial, text, integer, timestamp, jsonb, boolean } from 'drizzle-orm/pg-core';

export async function migrate(db: any) {
  console.log('Running migration: 006_enhanced_audit_system');

  // Create enhanced audit logs table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "enhanced_audit_logs" (
      "id" SERIAL PRIMARY KEY,
      "user_id" INTEGER REFERENCES "users"("id"),
      "action" TEXT NOT NULL,
      "resource_type" TEXT NOT NULL,
      "resource_id" TEXT,
      "status" TEXT NOT NULL DEFAULT 'success',
      "severity" TEXT NOT NULL DEFAULT 'info',
      "workspace_id" INTEGER REFERENCES "workspaces"("id"),
      "server_id" INTEGER REFERENCES "mcp_servers"("id"),
      "ip_address" TEXT,
      "user_agent" TEXT,
      "device_id" TEXT,
      "session_id" TEXT,
      "geo_location" JSONB,
      "details" JSONB,
      "request_payload" JSONB,
      "response_payload" JSONB,
      "hashed_payload" TEXT,
      "is_encrypted" BOOLEAN DEFAULT FALSE,
      "encryption_key_id" TEXT,
      "parent_event_id" INTEGER,
      "correlation_id" TEXT,
      "trace_id" TEXT,
      "compliance_category" TEXT,
      "tags" JSONB,
      "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
      "retention_expiry" TIMESTAMP,
      "integrity_checksum" TEXT
    );
  `);
  
  // Create audit log archives table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "audit_log_archives" (
      "id" SERIAL PRIMARY KEY,
      "batch_id" TEXT NOT NULL,
      "from_timestamp" TIMESTAMP NOT NULL,
      "to_timestamp" TIMESTAMP NOT NULL,
      "workspace_id" INTEGER REFERENCES "workspaces"("id"),
      "record_count" INTEGER NOT NULL,
      "file_path" TEXT,
      "file_checksum" TEXT,
      "file_size" INTEGER,
      "is_encrypted" BOOLEAN DEFAULT TRUE,
      "encryption_key_id" TEXT,
      "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
      "expiry_date" TIMESTAMP,
      "status" TEXT NOT NULL DEFAULT 'active'
    );
  `);
  
  // Create audit settings table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "audit_settings" (
      "id" SERIAL PRIMARY KEY,
      "workspace_id" INTEGER REFERENCES "workspaces"("id") NOT NULL UNIQUE,
      "retention_period_days" INTEGER NOT NULL DEFAULT 365,
      "archive_after_days" INTEGER NOT NULL DEFAULT 90,
      "mask_pii_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
      "pii_masking_rules" JSONB,
      "encryption_enabled" BOOLEAN NOT NULL DEFAULT TRUE,
      "encryption_algorithm" TEXT DEFAULT 'AES-256-CBC',
      "siem_integration_enabled" BOOLEAN DEFAULT FALSE,
      "siem_endpoint" TEXT,
      "siem_auth_config" JSONB,
      "alerting_enabled" BOOLEAN DEFAULT TRUE,
      "alert_rules" JSONB,
      "log_forwarding_enabled" BOOLEAN DEFAULT FALSE,
      "log_forwarding_configs" JSONB,
      "integrity_check_enabled" BOOLEAN DEFAULT TRUE,
      "integrity_check_frequency" TEXT DEFAULT 'daily',
      "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updated_at" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updated_by" INTEGER REFERENCES "users"("id")
    );
  `);
  
  // Create encryption keys table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "encryption_keys" (
      "id" SERIAL PRIMARY KEY,
      "key_id" TEXT NOT NULL UNIQUE,
      "workspace_id" INTEGER REFERENCES "workspaces"("id"),
      "algorithm" TEXT NOT NULL DEFAULT 'AES-256-CBC',
      "status" TEXT NOT NULL DEFAULT 'active',
      "version" INTEGER NOT NULL DEFAULT 1,
      "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
      "expires_at" TIMESTAMP,
      "last_rotated_at" TIMESTAMP,
      "metadata" JSONB
    );
  `);
  
  // Create audit integrity checks table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "audit_integrity_checks" (
      "id" SERIAL PRIMARY KEY,
      "workspace_id" INTEGER REFERENCES "workspaces"("id"),
      "from_timestamp" TIMESTAMP NOT NULL,
      "to_timestamp" TIMESTAMP NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "records_checked" INTEGER,
      "integrity_issues" INTEGER DEFAULT 0,
      "details" JSONB,
      "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
      "completed_at" TIMESTAMP,
      "performed_by" INTEGER REFERENCES "users"("id")
    );
  `);
  
  // Create alert events table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "alert_events" (
      "id" SERIAL PRIMARY KEY,
      "workspace_id" INTEGER REFERENCES "workspaces"("id"),
      "alert_type" TEXT NOT NULL,
      "severity" TEXT NOT NULL DEFAULT 'medium',
      "title" TEXT NOT NULL,
      "description" TEXT,
      "source_event_id" INTEGER REFERENCES "enhanced_audit_logs"("id"),
      "details" JSONB,
      "status" TEXT NOT NULL DEFAULT 'new',
      "created_at" TIMESTAMP NOT NULL DEFAULT NOW(),
      "acknowledged_at" TIMESTAMP,
      "acknowledged_by" INTEGER REFERENCES "users"("id"),
      "resolved_at" TIMESTAMP,
      "resolved_by" INTEGER REFERENCES "users"("id"),
      "resolution_notes" TEXT
    );
  `);
  
  // Create indexes for better query performance
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "enhanced_audit_logs_user_id_idx" ON "enhanced_audit_logs"("user_id");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "enhanced_audit_logs_workspace_id_idx" ON "enhanced_audit_logs"("workspace_id");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "enhanced_audit_logs_resource_type_idx" ON "enhanced_audit_logs"("resource_type");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "enhanced_audit_logs_created_at_idx" ON "enhanced_audit_logs"("created_at");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "enhanced_audit_logs_status_idx" ON "enhanced_audit_logs"("status");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "enhanced_audit_logs_severity_idx" ON "enhanced_audit_logs"("severity");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "enhanced_audit_logs_correlation_id_idx" ON "enhanced_audit_logs"("correlation_id");`);
  
  // Create index for archive table
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "audit_log_archives_workspace_id_idx" ON "audit_log_archives"("workspace_id");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "audit_log_archives_batch_id_idx" ON "audit_log_archives"("batch_id");`);
  
  // Create index for alert events
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "alert_events_workspace_id_idx" ON "alert_events"("workspace_id");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "alert_events_status_idx" ON "alert_events"("status");`);
  await db.execute(sql`CREATE INDEX IF NOT EXISTS "alert_events_severity_idx" ON "alert_events"("severity");`);
  
  console.log('Migration completed: 006_enhanced_audit_system');
}