/**
 * Healthcare migration script
 * 
 * Creates all tables for HIPAA-compliant healthcare functionality:
 * - EHR system integrations
 * - PHI access controls
 * - PHI data consent
 * - PHI redaction rules
 * - PHI audit logs
 * - Clinical tool plugins
 */
import { db, pool } from "./index";
import { sql } from "drizzle-orm";
import { 
  ehrSystems,
  phiAccessControls,
  phiConsents,
  phiRedactionRules,
  phiAuditLogs,
  clinicalPlugins,
  clinicalPluginInstances
} from "../shared/schema_healthcare";

/**
 * Run the healthcare system migration
 */
export async function runHealthcareMigration() {
  try {
    console.log("Starting healthcare system migration...");
    
    // Begin transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Create EHR systems table
      console.log("Creating ehr_systems table...");
      await client.query(`
        CREATE TABLE IF NOT EXISTS ehr_systems (
          id SERIAL PRIMARY KEY,
          workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          description TEXT,
          system_type TEXT NOT NULL,
          base_url TEXT NOT NULL,
          client_id TEXT,
          client_secret TEXT,
          token_url TEXT,
          auth_type TEXT NOT NULL DEFAULT 'oauth2',
          api_version TEXT,
          settings JSONB DEFAULT '{}'::jsonb,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          last_connected TIMESTAMP WITH TIME ZONE,
          created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
        );
        
        CREATE INDEX IF NOT EXISTS idx_ehr_systems_workspace ON ehr_systems(workspace_id);
      `);
      
      // Create PHI access controls table
      console.log("Creating phi_access_controls table...");
      await client.query(`
        CREATE TABLE IF NOT EXISTS phi_access_controls (
          id SERIAL PRIMARY KEY,
          ehr_system_id INTEGER NOT NULL REFERENCES ehr_systems(id) ON DELETE CASCADE,
          role_id INTEGER NOT NULL,
          phi_category TEXT NOT NULL,
          can_view BOOLEAN DEFAULT FALSE,
          can_edit BOOLEAN DEFAULT FALSE,
          can_export BOOLEAN DEFAULT FALSE,
          requires_approval BOOLEAN DEFAULT TRUE,
          can_redact BOOLEAN DEFAULT FALSE,
          can_delegate BOOLEAN DEFAULT FALSE,
          expires_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          
          UNIQUE(ehr_system_id, role_id, phi_category)
        );
        
        CREATE INDEX IF NOT EXISTS idx_phi_access_ehr_system ON phi_access_controls(ehr_system_id);
        CREATE INDEX IF NOT EXISTS idx_phi_access_role ON phi_access_controls(role_id);
      `);
      
      // Create PHI consents table
      console.log("Creating phi_consents table...");
      await client.query(`
        CREATE TABLE IF NOT EXISTS phi_consents (
          id SERIAL PRIMARY KEY,
          patient_identifier TEXT NOT NULL,
          ehr_system_id INTEGER NOT NULL REFERENCES ehr_systems(id) ON DELETE CASCADE,
          consent_type TEXT NOT NULL,
          consent_scope TEXT NOT NULL,
          consent_start TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          consent_end TIMESTAMP WITH TIME ZONE,
          verification_method TEXT,
          verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          verified_at TIMESTAMP WITH TIME ZONE,
          consent_proof_id TEXT,
          is_revoked BOOLEAN DEFAULT FALSE,
          revoked_at TIMESTAMP WITH TIME ZONE,
          revoked_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          notes TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );
        
        CREATE INDEX IF NOT EXISTS idx_phi_consents_patient ON phi_consents(patient_identifier);
        CREATE INDEX IF NOT EXISTS idx_phi_consents_ehr_system ON phi_consents(ehr_system_id);
        CREATE INDEX IF NOT EXISTS idx_phi_consents_active ON phi_consents(is_revoked) WHERE is_revoked = FALSE;
      `);
      
      // Create PHI redaction rules table
      console.log("Creating phi_redaction_rules table...");
      await client.query(`
        CREATE TABLE IF NOT EXISTS phi_redaction_rules (
          id SERIAL PRIMARY KEY,
          workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          description TEXT,
          pattern TEXT NOT NULL,
          phi_category TEXT NOT NULL,
          replacement_text TEXT DEFAULT '[REDACTED]',
          is_regex BOOLEAN DEFAULT FALSE,
          is_case_sensitive BOOLEAN DEFAULT FALSE,
          is_enabled BOOLEAN DEFAULT TRUE,
          priority INTEGER DEFAULT 100,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
        );
        
        CREATE INDEX IF NOT EXISTS idx_phi_redaction_workspace ON phi_redaction_rules(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_phi_redaction_enabled ON phi_redaction_rules(is_enabled) WHERE is_enabled = TRUE;
      `);
      
      // Create PHI audit logs table
      console.log("Creating phi_audit_logs table...");
      await client.query(`
        CREATE TABLE IF NOT EXISTS phi_audit_logs (
          id SERIAL PRIMARY KEY,
          transaction_id UUID NOT NULL,
          ehr_system_id INTEGER REFERENCES ehr_systems(id) ON DELETE SET NULL,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          patient_identifier TEXT NOT NULL,
          phi_category TEXT NOT NULL,
          action TEXT NOT NULL,
          resource_type TEXT NOT NULL,
          resource_id TEXT NOT NULL,
          access_method TEXT NOT NULL,
          access_reason TEXT NOT NULL,
          ip_address TEXT NOT NULL,
          user_agent TEXT,
          has_consent BOOLEAN,
          consent_id INTEGER REFERENCES phi_consents(id) ON DELETE SET NULL,
          was_redacted BOOLEAN DEFAULT FALSE,
          applied_redactions JSONB,
          hash_value TEXT NOT NULL,
          previous_hash_value TEXT,
          approved_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          approved_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
        );
        
        CREATE INDEX IF NOT EXISTS idx_phi_audit_transaction ON phi_audit_logs(transaction_id);
        CREATE INDEX IF NOT EXISTS idx_phi_audit_user ON phi_audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_phi_audit_patient ON phi_audit_logs(patient_identifier);
        CREATE INDEX IF NOT EXISTS idx_phi_audit_category ON phi_audit_logs(phi_category);
        CREATE INDEX IF NOT EXISTS idx_phi_audit_approved ON phi_audit_logs(approved_by) WHERE approved_by IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_phi_audit_created ON phi_audit_logs(created_at);
      `);
      
      // Create clinical plugins table
      console.log("Creating clinical_plugins table...");
      await client.query(`
        CREATE TABLE IF NOT EXISTS clinical_plugins (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          plugin_type TEXT NOT NULL,
          version TEXT NOT NULL,
          vendor_name TEXT,
          is_verified BOOLEAN DEFAULT FALSE,
          ehr_system_id INTEGER REFERENCES ehr_systems(id) ON DELETE SET NULL,
          config_schema JSONB,
          entry_point TEXT NOT NULL,
          permissions JSONB DEFAULT '[]'::jsonb,
          api_spec JSONB,
          installation_url TEXT,
          icon_url TEXT,
          documentation_url TEXT,
          is_enabled BOOLEAN DEFAULT TRUE,
          install_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          installed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          
          UNIQUE(name, version)
        );
        
        CREATE INDEX IF NOT EXISTS idx_clinical_plugins_enabled ON clinical_plugins(is_enabled) WHERE is_enabled = TRUE;
        CREATE INDEX IF NOT EXISTS idx_clinical_plugins_ehr ON clinical_plugins(ehr_system_id) WHERE ehr_system_id IS NOT NULL;
      `);
      
      // Create clinical plugin instances table
      console.log("Creating clinical_plugin_instances table...");
      await client.query(`
        CREATE TABLE IF NOT EXISTS clinical_plugin_instances (
          id SERIAL PRIMARY KEY,
          plugin_id INTEGER NOT NULL REFERENCES clinical_plugins(id) ON DELETE CASCADE,
          workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          configuration JSONB DEFAULT '{}'::jsonb,
          is_active BOOLEAN DEFAULT TRUE,
          last_used TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
          created_by INTEGER REFERENCES users(id) ON DELETE SET NULL
        );
        
        CREATE INDEX IF NOT EXISTS idx_clinical_plugin_instances_workspace ON clinical_plugin_instances(workspace_id);
        CREATE INDEX IF NOT EXISTS idx_clinical_plugin_instances_plugin ON clinical_plugin_instances(plugin_id);
        CREATE INDEX IF NOT EXISTS idx_clinical_plugin_instances_active ON clinical_plugin_instances(is_active) WHERE is_active = TRUE;
      `);
      
      // Commit transaction
      await client.query('COMMIT');
      
      console.log("Healthcare migration completed successfully!");
    } catch (error) {
      await client.query('ROLLBACK');
      console.error("Error in healthcare migration:", error);
      throw error;
    } finally {
      client.release();
    }
    
    // Create example default PHI redaction rules
    await createDefaultRedactionRules();
    
  } catch (error) {
    console.error("Failed to run healthcare migration:", error);
    throw error;
  }
}

/**
 * Create default PHI redaction rules for common PHI patterns
 */
async function createDefaultRedactionRules() {
  try {
    // Check if admin user exists
    const adminUser = await db.query.users.findFirst({
      where: sql`username = 'admin'`
    });
    
    if (!adminUser) {
      console.log("No admin user found, skipping default redaction rules creation");
      return;
    }
    
    // Check if we already have workspaces
    const workspaces = await db.query.workspaces.findMany({
      limit: 1
    });
    
    if (workspaces.length === 0) {
      console.log("No workspaces found, skipping default redaction rules creation");
      return;
    }
    
    const workspaceId = workspaces[0].id;
    
    // Check if we already have redaction rules
    const existingRules = await db.query.phiRedactionRules.findMany({
      where: sql`workspace_id = ${workspaceId}`,
      limit: 1
    });
    
    if (existingRules.length > 0) {
      console.log("Redaction rules already exist, skipping default rule creation");
      return;
    }
    
    console.log("Creating default PHI redaction rules...");
    
    // Common PHI patterns
    const defaultRules = [
      // SSN patterns
      {
        name: "Social Security Number (with dashes)",
        pattern: "\\d{3}-\\d{2}-\\d{4}",
        phiCategory: "DEMOGRAPHICS",
        replacementText: "[SSN REDACTED]",
        isRegex: true,
        priority: 200,
        description: "Matches SSN in XXX-XX-XXXX format"
      },
      {
        name: "Social Security Number (no dashes)",
        pattern: "\\b\\d{9}\\b",
        phiCategory: "DEMOGRAPHICS",
        replacementText: "[SSN REDACTED]",
        isRegex: true,
        priority: 190,
        description: "Matches 9-digit SSN"
      },
      
      // Names - these are just examples and would need more sophisticated rules in production
      {
        name: "Patient Name Pattern",
        pattern: "Patient Name:?\\s*[A-Z][a-z]+ [A-Z][a-z]+",
        phiCategory: "DEMOGRAPHICS",
        replacementText: "Patient Name: [REDACTED]",
        isRegex: true,
        priority: 180,
        description: "Matches 'Patient Name: FirstName LastName' patterns"
      },
      
      // Date of Birth
      {
        name: "Date of Birth (MM/DD/YYYY)",
        pattern: "\\b(0[1-9]|1[0-2])/(0[1-9]|[12]\\d|3[01])/(19|20)\\d{2}\\b",
        phiCategory: "DEMOGRAPHICS",
        replacementText: "[DOB REDACTED]",
        isRegex: true,
        priority: 170,
        description: "Matches DOB in MM/DD/YYYY format"
      },
      
      // Medical Record Numbers
      {
        name: "Medical Record Number",
        pattern: "\\b(MRN|Medical Record Number):?\\s*\\d{5,10}\\b",
        phiCategory: "DEMOGRAPHICS",
        replacementText: "[MRN REDACTED]",
        isRegex: true,
        priority: 160,
        description: "Matches Medical Record Numbers"
      },
      
      // Phone numbers
      {
        name: "Phone Number",
        pattern: "\\b(\\+\\d{1,2}\\s)?\\(?\\d{3}\\)?[-.\\s]?\\d{3}[-.\\s]?\\d{4}\\b",
        phiCategory: "DEMOGRAPHICS",
        replacementText: "[PHONE REDACTED]",
        isRegex: true,
        priority: 150,
        description: "Matches various phone number formats"
      },
      
      // Email addresses
      {
        name: "Email Address",
        pattern: "\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}\\b",
        phiCategory: "DEMOGRAPHICS",
        replacementText: "[EMAIL REDACTED]",
        isRegex: true,
        priority: 140,
        description: "Matches email addresses"
      }
    ];
    
    // Insert the default rules
    for (const rule of defaultRules) {
      await db.insert(phiRedactionRules).values({
        workspaceId,
        name: rule.name,
        description: rule.description,
        pattern: rule.pattern,
        phiCategory: rule.phiCategory as any,
        replacementText: rule.replacementText,
        isRegex: rule.isRegex,
        isCaseSensitive: false,
        isEnabled: true,
        priority: rule.priority,
        createdBy: adminUser.id
      });
    }
    
    console.log(`Created ${defaultRules.length} default PHI redaction rules`);
    
  } catch (error) {
    console.error("Error creating default redaction rules:", error);
  }
}

// This script can be run directly or imported by other migration scripts
if (require.main === module) {
  // Run migration directly
  runHealthcareMigration().then(() => {
    console.log("Healthcare migration process completed");
    process.exit(0);
  }).catch(error => {
    console.error("Healthcare migration failed:", error);
    process.exit(1);
  });
}