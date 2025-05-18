import { db, pool } from './index';
import { migrate as enhancedAuditMigration } from './migrations/006_enhanced_audit_system';
import { migrate as notificationSystemMigration } from './migrations/007_notification_system';
import { addSmtpConfigurationTable } from './migrations/012_add_smtp_config';
import { runMcpOrchestratorMigration } from './migrations/010_mcp_orchestrator';
import { runMigration as runSecureSessionLoggingMigration } from './migrations/020_secure_session_logging';
import { runTamperProofStorageMigration } from './migrations/040_tamper_proof_storage';
import { migrate as policyAuditTablesMigration } from './migrations/050_policy_audit_tables';
import { migrate as accessManagerMigration } from './migrations/060_access_manager_tables';
import { runHealthcareMigration } from './run-healthcare-migration';
import { runModuleConfigMigration } from './run-module-config-migration';
import { runMessagingSystemMigration as importedRunMessagingSystemMigration } from './run-messaging-migration';
import { runMonitoringSystemMigration } from './run-monitoring-migration';
import { setupBreachDetection } from './create-breach-detection-tables';

/**
 * Run the enhanced audit system migration
 */
async function runEnhancedAuditMigration() {
  console.log('Running Enhanced Audit System migration...');
  
  try {
    await enhancedAuditMigration(db);
    console.log('Enhanced Audit System migration completed successfully!');
  } catch (error) {
    console.error('Error running Enhanced Audit System migration:', error);
    throw error;
  }
}

/**
 * Run the notification system migration
 */
async function runNotificationSystemMigration() {
  console.log('Running Notification System migration...');
  
  try {
    await notificationSystemMigration(db);
    console.log('Notification System migration completed successfully!');
  } catch (error) {
    console.error('Error running Notification System migration:', error);
    throw error;
  }
}

/**
 * Run the SMTP configuration migration
 */
async function runSmtpConfigMigration() {
  console.log('Running SMTP Configuration migration...');
  
  try {
    const result = await addSmtpConfigurationTable();
    if (result.success) {
      console.log('SMTP Configuration migration completed successfully!');
    } else {
      console.error('SMTP Configuration migration failed:', result.error);
      throw result.error;
    }
  } catch (error) {
    console.error('Error running SMTP Configuration migration:', error);
    throw error;
  }
}

/**
 * Run the MCP Orchestrator migration
 */
async function runMcpOrchestratorSystemMigration() {
  console.log('Running MCP Orchestrator migration...');
  
  try {
    await runMcpOrchestratorMigration();
    console.log('MCP Orchestrator migration completed successfully!');
  } catch (error) {
    console.error('Error running MCP Orchestrator migration:', error);
    throw error;
  }
}

/**
 * Run the Secure Session Logging migration
 */
async function runSecureSessionLoggingSystemMigration() {
  console.log('Running Secure Session Logging migration...');
  
  try {
    await runSecureSessionLoggingMigration(pool);
    console.log('Secure Session Logging migration completed successfully!');
  } catch (error) {
    console.error('Error running Secure Session Logging migration:', error);
    throw error;
  }
}

/**
 * Run the Policy and Audit Tables migration
 */
async function runPolicyAuditTablesMigration() {
  console.log('Running Policy and Audit Tables migration...');
  
  try {
    await policyAuditTablesMigration();
    console.log('Policy and Audit Tables migration completed successfully!');
  } catch (error) {
    console.error('Error running Policy and Audit Tables migration:', error);
    throw error;
  }
}

/**
 * Run the Healthcare System migration
 */
async function runHealthcareSystemMigration() {
  console.log('Running Healthcare System migration...');
  
  try {
    await runHealthcareMigration();
    console.log('Healthcare System migration completed successfully!');
  } catch (error) {
    console.error('Error running Healthcare System migration:', error);
    throw error;
  }
}

/**
 * Run the Module Configuration migration
 */
async function runModuleConfigSystemMigration() {
  console.log('Running Module Configuration migration...');
  
  try {
    await runModuleConfigMigration();
    console.log('Module Configuration migration completed successfully!');
  } catch (error) {
    console.error('Error running Module Configuration migration:', error);
    throw error;
  }
}

/**
 * Run the Access Manager migration
 */
async function runAccessManagerMigration() {
  console.log('Running Access Manager migration...');
  
  try {
    await accessManagerMigration();
    console.log('Access Manager migration completed successfully!');
  } catch (error) {
    console.error('Error running Access Manager migration:', error);
    throw error;
  }
}

/**
 * Run the Messaging System migration
 */
async function runMessagingMigration() {
  console.log('Running Messaging System migration...');
  
  try {
    await importedRunMessagingSystemMigration();
    console.log('Messaging System migration completed successfully!');
  } catch (error) {
    console.error('Error running Messaging System migration:', error);
    throw error;
  }
}

/**
 * Run the Monitoring System migration
 */
async function runMonitoringMigration() {
  console.log('Running Monitoring System migration...');
  
  try {
    await runMonitoringSystemMigration();
    console.log('Monitoring System migration completed successfully!');
  } catch (error) {
    console.error('Error running Monitoring System migration:', error);
    throw error;
  }
}

/**
 * Run the Breach Detection System migration
 */
async function runBreachDetectionMigration() {
  console.log('Running Breach Detection System migration...');
  
  try {
    await setupBreachDetection();
    console.log('Breach Detection System migration completed successfully!');
  } catch (error) {
    console.error('Error running Breach Detection System migration:', error);
    throw error;
  }
}

/**
 * Main function to run migrations
 */
async function runMigrations() {
  try {
    console.log('Starting migrations...');
    
    // Run enhanced audit system migration
    await runEnhancedAuditMigration();
    
    // Run notification system migration
    await runNotificationSystemMigration();
    
    // Run SMTP configuration migration
    await runSmtpConfigMigration();
    
    // Run MCP Orchestrator migration
    await runMcpOrchestratorSystemMigration();
    
    // Run Secure Session Logging migration
    await runSecureSessionLoggingSystemMigration();
    
    // Run Policy and Audit Tables migration
    await runPolicyAuditTablesMigration();
    
    // Run Healthcare System migration
    await runHealthcareSystemMigration();
    
    // Run Module Configuration migration
    await runModuleConfigSystemMigration();
    
    // Run Access Manager migration
    await runAccessManagerMigration();
    
    // Run Messaging System migration
    await runMessagingMigration();
    
    // Run Monitoring System migration
    await runMonitoringMigration();
    
    // Run Breach Detection System migration
    await runBreachDetectionMigration();
    
    console.log('All migrations completed successfully!');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    // Close the database connection
    await pool.end();
  }
}

// Run the migrations
runMigrations();