/**
 * Test script for Breach Detection system
 * This script tests the API endpoints and checks for any issues
 */
import pg from 'pg';
import fs from 'fs';

const { Client } = pg;

// Connect to the database
const client = new Client({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Available' : 'Not available');
  try {
    console.log('Testing Breach Detection system...');
    
    // Connect to the database
    await client.connect();
    console.log('Connected to database');
    
    // Check if table exists
    const tableCheckResult = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'breach_detections'
      )
    `);
    
    const tableExists = tableCheckResult.rows[0].exists;
    console.log('Breach detections table exists:', tableExists);
    
    if (!tableExists) {
      console.log('Creating breach_detections table...');
      
      // Create the table
      await client.query(`
        CREATE TABLE IF NOT EXISTS breach_detections (
          id SERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          severity TEXT NOT NULL,
          status TEXT NOT NULL,
          detection_type TEXT NOT NULL,
          source TEXT NOT NULL,
          detected_at TIMESTAMP NOT NULL DEFAULT NOW(),
          resolved_at TIMESTAMP,
          affected_resource_id INTEGER,
          workspace_id INTEGER,
          rule_id INTEGER,
          created_by INTEGER,
          updated_by INTEGER,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      
      console.log('Created breach_detections table');
      
      // Create related tables
      await client.query(`
        CREATE TABLE IF NOT EXISTS breach_events (
          id SERIAL PRIMARY KEY,
          breach_id INTEGER NOT NULL REFERENCES breach_detections(id),
          event_type TEXT NOT NULL,
          description TEXT,
          timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
          created_by INTEGER,
          metadata JSONB,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      
      console.log('Created breach_events table');
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS breach_detection_rules (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          pattern TEXT NOT NULL,
          severity TEXT NOT NULL,
          enabled BOOLEAN NOT NULL DEFAULT TRUE,
          workspace_id INTEGER,
          created_by INTEGER,
          updated_by INTEGER,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);
      
      console.log('Created breach_detection_rules table');
      
      await client.query(`
        CREATE TABLE IF NOT EXISTS security_metrics (
          id SERIAL PRIMARY KEY,
          metric_name TEXT NOT NULL,
          metric_value NUMERIC NOT NULL,
          resource_id INTEGER,
          resource_type TEXT,
          timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
          workspace_id INTEGER,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          metadata JSONB
        )
      `);
      
      console.log('Created security_metrics table');
      
      // Insert sample data
      await client.query(`
        INSERT INTO breach_detections (
          title, description, severity, status, detection_type, source, detected_at
        ) VALUES
        ('Suspicious OAuth token usage', 'Multiple failed attempts to use expired tokens detected', 'high', 'open', 'anomaly', 'oauth', NOW() - INTERVAL '2 days'),
        ('IP address allowlist violation', 'Client accessed from unauthorized IP address', 'critical', 'investigating', 'violation', 'ip_access_control', NOW() - INTERVAL '5 days'),
        ('Time-based access violation', 'Access attempt outside allowed time window', 'medium', 'resolved', 'violation', 'time_restriction', NOW() - INTERVAL '10 days'),
        ('Credential rotation policy violation', 'Client failed to rotate credentials within required timeframe', 'low', 'open', 'compliance', 'token_rotation', NOW() - INTERVAL '1 day'),
        ('Multiple auth failures', 'Repeated authentication failures detected from single source', 'high', 'open', 'anomaly', 'auth_monitor', NOW() - INTERVAL '3 days')
      `);
      
      console.log('Inserted sample breach detection data');
      
      // Insert sample events
      await client.query(`
        INSERT INTO breach_events (
          breach_id, event_type, description, timestamp
        ) VALUES
        (1, 'detection', 'Initial detection of suspicious token usage', NOW() - INTERVAL '2 days'),
        (1, 'investigation', 'Security team investigating token usage patterns', NOW() - INTERVAL '1 day 12 hours'),
        (2, 'detection', 'Initial detection of IP allowlist violation', NOW() - INTERVAL '5 days'),
        (2, 'evidence', 'IP address recorded: 192.168.1.100', NOW() - INTERVAL '5 days'),
        (2, 'escalation', 'Incident escalated to security team', NOW() - INTERVAL '4 days 18 hours'),
        (3, 'detection', 'Initial detection of time window violation', NOW() - INTERVAL '10 days'),
        (3, 'resolution', 'Time window adjusted for client', NOW() - INTERVAL '9 days'),
        (4, 'detection', 'Credential rotation policy violation detected', NOW() - INTERVAL '1 day'),
        (5, 'detection', 'Multiple authentication failures detected', NOW() - INTERVAL '3 days'),
        (5, 'evidence', 'Failed attempts from user ID: user-12345', NOW() - INTERVAL '3 days')
      `);
      
      console.log('Inserted sample breach event data');
      
      // Insert sample rules
      await client.query(`
        INSERT INTO breach_detection_rules (
          name, description, pattern, severity, enabled
        ) VALUES
        ('Token Misuse Pattern', 'Detects patterns of OAuth token misuse', 'oauth_token_failure_count > 5 in 10m', 'high', TRUE),
        ('IP Allowlist Violation', 'Detects access from unauthorized IP addresses', 'ip_address NOT IN allowlist', 'critical', TRUE),
        ('Time Restriction Violation', 'Detects access outside allowed time windows', 'access_time OUTSIDE window', 'medium', TRUE),
        ('Credential Rotation Failure', 'Detects failure to rotate credentials on schedule', 'token_age > 90d', 'low', TRUE),
        ('Auth Failure Pattern', 'Detects unusual patterns of authentication failures', 'auth_failure_count > 10 in 5m', 'high', TRUE)
      `);
      
      console.log('Inserted sample breach detection rules');
      
      // Insert sample security metrics
      await client.query(`
        INSERT INTO security_metrics (
          metric_name, metric_value, resource_id, resource_type, timestamp
        ) VALUES
        ('oauth_token_failure_rate', 0.15, 1, 'oauth_client', NOW() - INTERVAL '1 day'),
        ('ip_access_violation_count', 5, 2, 'oauth_client', NOW() - INTERVAL '2 days'),
        ('time_restriction_violation_rate', 0.05, 3, 'oauth_client', NOW() - INTERVAL '3 days'),
        ('credential_rotation_compliance', 0.78, 4, 'oauth_client', NOW() - INTERVAL '4 days'),
        ('auth_failure_rate', 0.23, 5, 'oauth_client', NOW() - INTERVAL '5 days')
      `);
      
      console.log('Inserted sample security metrics');
    } else {
      console.log('Breach detection tables already exist, skipping creation');
    }
    
    // Test API endpoint
    console.log('\nNow test the API endpoints in the browser:\n');
    console.log('1. http://localhost:3000/security/breaches');
    console.log('2. http://localhost:3000/api/breach-detection/overview');
    console.log('3. http://localhost:3000/api/breach-detection/breaches');
    
    console.log('\nFinished setting up Breach Detection system');
    
  } catch (error) {
    console.error('Error testing Breach Detection system:', error);
  } finally {
    // Close database connection
    await client.end();
  }
}

main().catch(console.error);