/**
 * Direct SQL script to create and seed the breach detection tables
 */
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function setupBreachDetectionTables() {
  const client = await pool.connect();
  
  try {
    console.log("Creating breach detection tables...");
    
    // Start transaction
    await client.query('BEGIN');
    
    // Create breach_detections table
    await client.query(`
      CREATE TABLE IF NOT EXISTS breach_detections (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        detection_type TEXT NOT NULL,
        description TEXT,
        detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        severity TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'open',
        workspace_id INTEGER,
        affected_resources JSONB,
        evidence JSONB,
        source TEXT NOT NULL,
        rule_id INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by INTEGER,
        updated_by INTEGER,
        resolved_at TIMESTAMPTZ,
        resolved_by INTEGER,
        resolution_notes TEXT,
        resolution TEXT
      )
    `);

    // Create breach_events table
    await client.query(`
      CREATE TABLE IF NOT EXISTS breach_events (
        id SERIAL PRIMARY KEY,
        breach_id INTEGER NOT NULL REFERENCES breach_detections(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        user_id INTEGER,
        details JSONB
      )
    `);

    // Create breach_detection_rules table
    await client.query(`
      CREATE TABLE IF NOT EXISTS breach_detection_rules (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        type TEXT NOT NULL,
        definition JSONB NOT NULL,
        workspace_id INTEGER,
        category TEXT,
        severity TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'enabled',
        is_global BOOLEAN DEFAULT FALSE,
        thresholds JSONB,
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by INTEGER,
        updated_by INTEGER,
        last_triggered_at TIMESTAMPTZ
      )
    `);

    // Create security_metrics table
    await client.query(`
      CREATE TABLE IF NOT EXISTS security_metrics (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        value TEXT NOT NULL,
        metric_type TEXT NOT NULL,
        category TEXT NOT NULL,
        workspace_id INTEGER,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        metadata JSONB
      )
    `);

    // Create security_notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS security_notifications (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        event_types TEXT[] NOT NULL,
        channels TEXT[] NOT NULL,
        workspace_id INTEGER,
        filters JSONB,
        recipients JSONB,
        is_enabled BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_by INTEGER,
        updated_by INTEGER
      )
    `);

    // Create breach_indicators table
    await client.query(`
      CREATE TABLE IF NOT EXISTS breach_indicators (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        value TEXT NOT NULL,
        confidence REAL NOT NULL DEFAULT 0.5,
        source TEXT NOT NULL,
        first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Create breach_indicator_links table
    await client.query(`
      CREATE TABLE IF NOT EXISTS breach_indicator_links (
        id SERIAL PRIMARY KEY,
        breach_id INTEGER NOT NULL REFERENCES breach_detections(id) ON DELETE CASCADE,
        indicator_id INTEGER NOT NULL REFERENCES breach_indicators(id) ON DELETE CASCADE,
        relationship TEXT NOT NULL DEFAULT 'associated',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    console.log("Checking if sample data already exists");
    const { rows } = await client.query("SELECT COUNT(*) FROM breach_detections");
    
    if (parseInt(rows[0].count) === 0) {
      console.log("Seeding sample breach detection data");
      
      // Insert sample breach detection rules
      const ruleInsertResult = await client.query(`
        INSERT INTO breach_detection_rules (name, description, type, definition, category, severity, is_global, metadata)
        VALUES 
          ('Suspicious Token Usage', 'Detects suspicious token usage patterns such as high request rates or unusual access patterns', 'behavior', 
           '{"timeWindow": 60, "metrics": [{"name": "token_requests_per_minute", "aggregation": "avg"}, {"name": "unique_ips_per_token", "aggregation": "max"}], "threshold": 10, "condition": {"type": "expression", "expression": "{token_requests_per_minute} > 100 || {unique_ips_per_token} > 5"}, "evaluationIntervalMinutes": 15}',
           'suspicious_activity', 'high', true, '{}'),
          ('Repeated Authentication Failures', 'Detects multiple failed authentication attempts which may indicate brute force attacks', 'signature',
           '{"timeWindow": 30, "signatures": [{"type": "security_event", "pattern": {"eventType": "authentication_failure", "severity": "high"}, "threshold": 5}]}',
           'access_control', 'critical', true, '{}'),
          ('IP Access Violations', 'Detects access attempts from unauthorized IP addresses', 'signature',
           '{"timeWindow": 60, "signatures": [{"type": "ip_violation", "pattern": {}, "threshold": 3}]}',
           'access_control', 'medium', true, '{}')
        RETURNING id
      `);
      
      const ruleIds = ruleInsertResult.rows.map(row => row.id);
      
      // Insert sample breach detections
      const breachInsertResult = await client.query(`
        INSERT INTO breach_detections (title, detection_type, description, severity, status, source, rule_id, affected_resources, evidence)
        VALUES 
          ('Repeated Failed Access Attempts', 'signature', 'Multiple failed authentication attempts detected from multiple IP addresses',
           'high', 'open', 'oauth_event', $1, '["client-id-123", "workspace-1"]', 
           '{"failedAttempts": 12, "ipAddresses": ["192.168.1.100", "192.168.1.101", "192.168.1.102"], "timeframe": "Last 30 minutes"}'),
          ('Unusual Token Usage Pattern', 'behavior', 'Token used at abnormal rate and from unusual locations',
           'medium', 'in_progress', 'token_usage', $2, '["token-456", "client-id-456"]', 
           '{"normalRate": "10 req/min", "actualRate": "150 req/min", "locations": ["US", "Russia", "China"]}'),
          ('Unauthorized IP Access', 'signature', 'Multiple access attempts from IPs outside the allowlist',
           'medium', 'resolved', 'ip_access', $3, '["client-id-789"]', 
           '{"ipAddresses": ["203.0.113.1", "203.0.113.2"], "attempts": 5}'),
          ('Suspicious Data Access Pattern', 'anomaly', 'Unusual pattern of data access detected',
           'critical', 'open', 'anomaly_detection', null, '["database-1", "table-users"]', 
           '{"normalAccess": "50 records/hour", "actualAccess": "5000 records/hour", "timeframe": "2023-01-15T12:00:00Z to 2023-01-15T13:00:00Z"}')
        RETURNING id
      `, [ruleIds[1], ruleIds[0], ruleIds[2]]);
      
      const breachIds = breachInsertResult.rows.map(row => row.id);
      
      // Insert sample breach events
      await client.query(`
        INSERT INTO breach_events (breach_id, event_type, details)
        VALUES 
          ($1, 'detection', '{"message": "Breach initially detected", "severity": "high", "detectedBy": "system"}'),
          ($1, 'update', '{"message": "Additional failed attempts detected", "newEvidenceCount": 5}'),
          ($2, 'detection', '{"message": "Breach initially detected", "severity": "medium", "detectedBy": "system"}'),
          ($2, 'investigation', '{"message": "Investigation started", "assignedTo": "admin"}'),
          ($3, 'detection', '{"message": "Breach initially detected", "severity": "medium", "detectedBy": "system"}'),
          ($3, 'resolution', '{"message": "IP allowlist updated", "action": "Updated allowed IP ranges", "resolvedBy": "admin"}'),
          ($4, 'detection', '{"message": "Breach initially detected", "severity": "critical", "detectedBy": "system"}')
      `, [breachIds[0], breachIds[1], breachIds[2], breachIds[3]]);
      
      // Insert sample security metrics
      await client.query(`
        INSERT INTO security_metrics (name, value, metric_type, category)
        VALUES 
          ('token_requests_per_minute', '125', 'gauge', 'usage'),
          ('unique_ips_per_token', '7', 'gauge', 'access'),
          ('authentication_failures', '23', 'counter', 'authentication'),
          ('ip_violations', '12', 'counter', 'access')
      `);
    } else {
      console.log("Sample data already exists, skipping seed");
    }
    
    // Commit transaction
    await client.query('COMMIT');
    
    console.log("Breach detection tables created and populated successfully");
    return true;
  } catch (error) {
    // Rollback on error
    await client.query('ROLLBACK');
    console.error("Error creating breach detection tables:", error);
    return false;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the setup
setupBreachDetectionTables().then(success => {
  if (success) {
    console.log("Setup completed successfully");
    process.exit(0);
  } else {
    console.error("Setup failed");
    process.exit(1);
  }
});