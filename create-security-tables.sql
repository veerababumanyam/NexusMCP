-- Security Scanner Tables

-- Create security scanners table
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

-- Create scan targets table
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

-- Create scan results table
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

-- Create vulnerabilities table
CREATE TABLE IF NOT EXISTS scan_vulnerabilities (
  id SERIAL PRIMARY KEY,
  scan_result_id INTEGER NOT NULL REFERENCES scan_results(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  severity TEXT NOT NULL,
  cvss_score TEXT,
  cve_id TEXT,
  location TEXT,
  remediation TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  details JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indices for performance
CREATE INDEX IF NOT EXISTS idx_security_scanners_workspace ON security_scanners(workspace_id);
CREATE INDEX IF NOT EXISTS idx_scan_targets_workspace ON scan_targets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_scan_results_scanner ON scan_results(scanner_id);
CREATE INDEX IF NOT EXISTS idx_scan_results_target ON scan_results(target_id);
CREATE INDEX IF NOT EXISTS idx_scan_vulnerabilities_result ON scan_vulnerabilities(scan_result_id);
CREATE INDEX IF NOT EXISTS idx_scan_vulnerabilities_severity ON scan_vulnerabilities(severity);
CREATE INDEX IF NOT EXISTS idx_scan_vulnerabilities_status ON scan_vulnerabilities(status);

-- Seed default scanners
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

-- Seed default targets
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