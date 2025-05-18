/**
 * Script to create healthcare tables using Drizzle ORM
 */
import { db } from "./index";
import { 
  ehrSystems,
  phiAccessControls,
  phiConsents,
  phiRedactionRules,
  phiAuditLogs,
  clinicalPlugins,
  clinicalPluginInstances
} from "../shared/schema_healthcare";
import { sql } from "drizzle-orm";

/**
 * Create all healthcare tables using SQL
 */
async function createHealthcareTables() {
  console.log("Creating healthcare tables...");

  // Create EHR Systems table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "ehr_systems" (
      "id" SERIAL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "type" TEXT NOT NULL,
      "url" TEXT NOT NULL,
      "api_key" TEXT,
      "workspace_id" INTEGER NOT NULL,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "configuration" JSONB,
      "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);
  console.log("Created EHR Systems table");

  // Create PHI Access Controls table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "phi_access_controls" (
      "id" SERIAL PRIMARY KEY,
      "user_id" INTEGER NOT NULL,
      "workspace_id" INTEGER NOT NULL,
      "phi_level" INTEGER NOT NULL DEFAULT 0,
      "access_expires_at" TIMESTAMP,
      "reason" TEXT NOT NULL,
      "approved_by" INTEGER NOT NULL,
      "approved_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      "revoked_at" TIMESTAMP,
      "revoked_by" INTEGER,
      "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);
  console.log("Created PHI Access Controls table");

  // Create PHI Consents table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "phi_consents" (
      "id" SERIAL PRIMARY KEY,
      "patient_id" TEXT NOT NULL,
      "consent_type" TEXT NOT NULL,
      "consented_at" TIMESTAMP NOT NULL,
      "expires_at" TIMESTAMP,
      "consent_document" TEXT,
      "workspace_id" INTEGER NOT NULL,
      "status" TEXT NOT NULL,
      "phi_level" INTEGER NOT NULL DEFAULT 1,
      "revoked_at" TIMESTAMP,
      "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);
  console.log("Created PHI Consents table");

  // Create PHI Redaction Rules table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "phi_redaction_rules" (
      "id" SERIAL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "pattern" TEXT NOT NULL,
      "replacement" TEXT NOT NULL,
      "phi_level" INTEGER NOT NULL DEFAULT 1,
      "workspace_id" INTEGER NOT NULL,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);
  console.log("Created PHI Redaction Rules table");

  // Create PHI Audit Logs table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "phi_audit_logs" (
      "id" SERIAL PRIMARY KEY,
      "transaction_id" UUID DEFAULT gen_random_uuid() NOT NULL,
      "ehr_system_id" INTEGER,
      "user_id" INTEGER NOT NULL,
      "patient_identifier" TEXT NOT NULL,
      "phi_category" TEXT NOT NULL,
      "action" TEXT NOT NULL,
      "resource_type" TEXT NOT NULL,
      "resource_id" TEXT NOT NULL,
      "access_method" TEXT NOT NULL,
      "access_reason" TEXT NOT NULL,
      "ip_address" TEXT NOT NULL,
      "user_agent" TEXT,
      "has_consent" BOOLEAN,
      "consent_id" INTEGER,
      "was_redacted" BOOLEAN DEFAULT FALSE,
      "applied_redactions" JSONB,
      "hash_value" TEXT NOT NULL,
      "previous_hash_value" TEXT,
      "approved_by" INTEGER,
      "approved_at" TIMESTAMP,
      "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);
  console.log("Created PHI Audit Logs table");

  // Create Clinical Plugins table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "clinical_plugins" (
      "id" SERIAL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "plugin_type" TEXT NOT NULL,
      "version" TEXT NOT NULL,
      "vendor_name" TEXT,
      "is_verified" BOOLEAN DEFAULT FALSE,
      "api_endpoint" TEXT,
      "auth_type" TEXT,
      "required_credentials" JSONB,
      "scope" TEXT,
      "feature_flags" JSONB,
      "integration_points" JSONB,
      "phi_categories" JSONB,
      "min_access_level" INTEGER DEFAULT 1,
      "risk_level" INTEGER DEFAULT 1,
      "performance_metrics" JSONB,
      "is_enabled" BOOLEAN DEFAULT TRUE,
      "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);
  console.log("Created Clinical Plugins table");

  // Create Clinical Plugin Instances table
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "clinical_plugin_instances" (
      "id" SERIAL PRIMARY KEY,
      "plugin_id" INTEGER NOT NULL,
      "workspace_id" INTEGER NOT NULL,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "configuration" JSONB,
      "credentials" JSONB,
      "status" TEXT DEFAULT 'inactive',
      "last_used_at" TIMESTAMP,
      "usage_metrics" JSONB,
      "is_enabled" BOOLEAN DEFAULT TRUE,
      "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
      "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
    )
  `);
  console.log("Created Clinical Plugin Instances table");

  console.log("All healthcare tables created successfully!");
}

// Run the script
createHealthcareTables()
  .then(() => {
    console.log("Healthcare tables creation completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Error creating healthcare tables:", error);
    process.exit(1);
  });