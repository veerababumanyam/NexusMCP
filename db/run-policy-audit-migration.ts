import { migrate as policyAuditTablesMigration } from './migrations/050_policy_audit_tables';

async function runMigration() {
  try {
    console.log('Running Policy and Audit Tables migration...');
    await policyAuditTablesMigration();
    console.log('Policy and Audit Tables migration completed successfully!');
  } catch (error) {
    console.error('Error running Policy and Audit Tables migration:', error);
    process.exit(1);
  }
}

runMigration();