// Fix Security Scanner Table Script
const { runSecurityScannerMigration } = require('./db/run-security-scanner-migration');

// Run the migration
runSecurityScannerMigration()
  .then(() => {
    console.log('Security scanner tables created successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error creating security scanner tables:', error);
    process.exit(1);
  });