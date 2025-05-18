import { runModuleConfigMigration } from './run-module-config-migration';

// Run the migration
(async () => {
  try {
    await runModuleConfigMigration();
    console.log('System module configuration migration completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error running system module migration:', error);
    process.exit(1);
  }
})();