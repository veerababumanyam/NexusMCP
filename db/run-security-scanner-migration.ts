/**
 * Security Scanner Migration
 * 
 * This migration adds tables for enterprise security scanning functionality:
 * - Security scanners configuration (vulnerability, malware, compliance, etc.)
 * - Scan targets (servers, endpoints, applications, etc.)
 * - Scan results and history
 * - Vulnerability tracking and management
 */

import { pool } from './index';

// Simple logger for migration
class Logger {
  private context: string;
  
  constructor(context: string) {
    this.context = context;
  }
  
  info(message: string): void {
    console.log(`${new Date().toISOString()} info: ${message} {"metadata":{"service":"${this.context}"}}`);
  }
  
  error(message: string, error?: any): void {
    console.error(`${new Date().toISOString()} error: ${message}`, error || '', `{"metadata":{"service":"${this.context}"}}`);
  }
}

const logger = new Logger('SecurityScannerMigration');

/**
 * Run the security scanner migration
 */
export async function runSecurityScannerMigration() {
  const client = await pool.connect();
  
  try {
    logger.info('Starting security scanner migration');
    
    // Begin transaction
    await client.query('BEGIN');
    
    // Create the security scanner tables
    await createSecurityScannerTables(client);
    
    // Seed default scanners for development (optional)
    await seedDefaultScanners(client);
    
    // Commit transaction
    await client.query('COMMIT');
    
    logger.info('Security scanner migration completed successfully');
    return true;
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    logger.error('Security scanner migration failed', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Create security scanner tables using SQL
 */
async function createSecurityScannerTables(client: any) {
  logger.info('Creating security scanner tables');
  
  // Create security scanners table
  await client.query(`
    CREATE TABLE IF NOT EXISTS security_scanners (
      id SERIAL PRIMARY KEY,
      workspace_id INTEGER,
      name TEXT NOT NULL,
      description TEXT,
      scanner_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      config JSONB,
      credentials JSONB,
      schedule_config JSONB,
      last_scan_time TIMESTAMP,
      created_by INTEGER,
      updated_by INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  
  // Create scan targets table
  await client.query(`
    CREATE TABLE IF NOT EXISTS scan_targets (
      id SERIAL PRIMARY KEY,
      workspace_id INTEGER,
      name TEXT NOT NULL,
      description TEXT,
      target_type TEXT NOT NULL,
      value TEXT NOT NULL,
      config JSONB,
      credentials JSONB,
      created_by INTEGER,
      updated_by INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  
  // Create scan results table
  await client.query(`
    CREATE TABLE IF NOT EXISTS scan_results (
      id SERIAL PRIMARY KEY,
      scanner_id INTEGER NOT NULL REFERENCES security_scanners(id) ON DELETE CASCADE,
      target_id INTEGER NOT NULL REFERENCES scan_targets(id) ON DELETE CASCADE,
      start_time TIMESTAMP NOT NULL,
      end_time TIMESTAMP,
      status TEXT NOT NULL DEFAULT 'running',
      summary JSONB,
      initiated_by INTEGER,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  
  // Create vulnerabilities table
  await client.query(`
    CREATE TABLE IF NOT EXISTS scan_vulnerabilities (
      id SERIAL PRIMARY KEY,
      scan_result_id INTEGER NOT NULL REFERENCES scan_results(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      severity TEXT NOT NULL,
      cvss_score DECIMAL(3,1),
      cve_id TEXT,
      location TEXT,
      remediation TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      details JSONB,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);
  
  // Create indices for performance
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_security_scanners_workspace ON security_scanners(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_scan_targets_workspace ON scan_targets(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_scan_results_scanner ON scan_results(scanner_id);
    CREATE INDEX IF NOT EXISTS idx_scan_results_target ON scan_results(target_id);
    CREATE INDEX IF NOT EXISTS idx_scan_vulnerabilities_result ON scan_vulnerabilities(scan_result_id);
    CREATE INDEX IF NOT EXISTS idx_scan_vulnerabilities_severity ON scan_vulnerabilities(severity);
    CREATE INDEX IF NOT EXISTS idx_scan_vulnerabilities_status ON scan_vulnerabilities(status);
  `);
  
  logger.info('Security scanner tables created successfully');
}

/**
 * Seed default scanners for development and testing
 */
async function seedDefaultScanners(client: any) {
  logger.info('Seeding default security scanners and targets');
  
  // Check if we already have scanners
  const existingScanners = await client.query(`
    SELECT COUNT(*) FROM security_scanners;
  `);
  
  if (parseInt(existingScanners.rows[0].count) > 0) {
    logger.info('Default scanners already exist, skipping seed');
    return;
  }
  
  // Seed default scanners
  await client.query(`
    INSERT INTO security_scanners (
      name, description, scanner_type, status, config, schedule_config
    ) VALUES 
    (
      'Network Vulnerability Scanner', 
      'Scans for network vulnerabilities and open ports', 
      'vulnerability',
      'active',
      '{"scan_ports": true, "scan_service_detection": true}',
      '{"frequency": "daily", "time": "02:00"}'
    ),
    (
      'Malware Detection System', 
      'Scans for malware and suspicious files', 
      'malware',
      'active',
      '{"scan_executables": true, "scan_documents": true, "heuristic_analysis": true}',
      NULL
    ),
    (
      'Container Security Scanner', 
      'Scans container images for vulnerabilities', 
      'container',
      'disabled',
      '{"scan_base_image": true, "scan_installed_packages": true, "scan_app_dependencies": true}',
      NULL
    ),
    (
      'Compliance Checker', 
      'Validates systems against compliance requirements', 
      'compliance',
      'active',
      '{"frameworks": ["SOC2", "HIPAA", "PCI-DSS"]}',
      '{"frequency": "weekly", "time": "01:00", "day": "Sunday"}'
    ),
    (
      'Static Code Analyzer', 
      'Analyzes source code for security issues', 
      'code',
      'active',
      '{"languages": ["JavaScript", "TypeScript", "Python"], "scan_dependencies": true}',
      '{"frequency": "daily", "time": "03:00"}'
    );
  `);
  
  // Seed default targets
  await client.query(`
    INSERT INTO scan_targets (
      name, description, target_type, value
    ) VALUES 
    (
      'Production API Server', 
      'Main production API server', 
      'server',
      '10.0.1.100'
    ),
    (
      'Database Server', 
      'Primary PostgreSQL database server', 
      'database',
      '10.0.1.101'
    ),
    (
      'Web Application', 
      'Customer-facing web portal', 
      'web',
      'https://example.com'
    ),
    (
      'Authentication Service', 
      'OAuth2 authentication service', 
      'api',
      'https://auth-api.example.com'
    ),
    (
      'Frontend Application Repo', 
      'GitHub repository for the frontend app', 
      'code',
      'https://github.com/example/frontend'
    );
  `);
  
  logger.info('Default scanners and targets seeded successfully');
}