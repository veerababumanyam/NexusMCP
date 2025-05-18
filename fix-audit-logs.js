// Script to run the audit logs schema fix
import { fixAuditLogs } from './db/fix-audit-logs.js';

async function runFix() {
  try {
    console.log('Starting audit logs schema fix...');
    await fixAuditLogs();
    console.log('Audit logs schema fix completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing audit logs schema:', error);
    process.exit(1);
  }
}

runFix();