import { migrate as migrateAuthSystem } from './migrations/001_auth_system_enhancement';
import { migrate as migrateOAuthEnhancement } from './migrations/002_oauth_enhancement';
import { migrate as migrateWorkspacePolicySystem } from './migrations/003_workspace_policy_system';
import { up as migrateCollaborationSystem } from './migrations/006_collaboration_system';
import { migrate as migrateOAuthAgentIntegration } from './migrations/009_oauth_agent_integration';
import { migrate as migrateJwtImplementation } from './migrations/010_jwt_implementation';
import { runSecurityToolingMigration } from './migrations/create-security-tooling';
import { runFileStorageMigration } from './migrations/create-file-storage';
import { updateWorkspaceSchema } from './update-workspace-schema';
import { migratePermissionSets } from './migrate-permission-sets';
import { createPolicyAuditTables } from './migrations/050_policy_audit_tables';
import { fixAuditLogs } from './fix-audit-logs';
import { runSecurityScannerMigration } from './run-security-scanner-migration';

/**
 * Main migration script that runs all migrations in order
 */
async function runMigrations() {
  console.log('Starting database migrations...');
  
  try {
    // Run auth system migration
    await migrateAuthSystem();
    
    // Run OAuth enhancement migration
    await migrateOAuthEnhancement();
    
    // Run workspace and policy system migration
    await migrateWorkspacePolicySystem();
    
    // Run collaboration system migration
    await migrateCollaborationSystem();
    
    // Run OAuth Agent Integration migration
    await migrateOAuthAgentIntegration();
    
    // Run JWT Implementation migration
    await migrateJwtImplementation();
    console.log('Created JWT authentication tables');
    
    // Run Security Tooling tables migration
    await runSecurityToolingMigration();
    console.log('Created security tooling tables');
    
    // Run File Storage tables migration
    await runFileStorageMigration();
    console.log('Created file storage tables');
    
    // Run Workspace Schema Update
    await updateWorkspaceSchema();
    console.log('Updated workspace schema with missing columns');
    
    // Run Permission Sets Schema Update with Workspace Integration
    await migratePermissionSets();
    console.log('Updated permission sets with workspace integration');
    
    // Run Enhanced Audit Log tables migration
    await createPolicyAuditTables();
    console.log('Created enhanced audit log tables');
    
    // Run Audit Logs fix to add missing columns
    await fixAuditLogs();
    console.log('Fixed audit logs schema with missing columns');
    
    // Run Security Scanner Migration
    await runSecurityScannerMigration();
    console.log('Created security scanner tables');
    
    console.log('All migrations completed successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Migration process failed:', error);
    process.exit(1);
  }
}

// Run migrations
runMigrations();