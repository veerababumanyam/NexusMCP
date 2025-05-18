/**
 * Script to create breach detection tables using Drizzle ORM
 */
import { db } from "./index";
import { 
  breachDetectionRules, 
  breachDetections, 
  breachEvents, 
  breachIndicators,
  breachIndicatorLinks,
  securityMetrics,
  securityNotifications
} from "../shared/schema_breach_detection";
import { sql } from "drizzle-orm";

/**
 * Create all breach detection tables
 */
export async function createBreachDetectionTables() {
  try {
    console.log("Creating breach detection tables...");
    
    // Create tables using SQL to ensure proper order and constraints
    // Create tables using direct SQL execution
    await db.execute(sql`
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

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS breach_events (
        id SERIAL PRIMARY KEY,
        breach_id INTEGER NOT NULL REFERENCES breach_detections(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        user_id INTEGER,
        details JSONB
      )
    `);

    await db.execute(sql`
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

    await db.execute(sql`
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

    await db.execute(sql`
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

    // Create additional tables for indicators and links
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS breach_indicators (
        id SERIAL PRIMARY KEY,
        type TEXT NOT NULL,
        value TEXT NOT NULL,
        confidence FLOAT NOT NULL DEFAULT 0.5,
        source TEXT NOT NULL,
        first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS breach_indicator_links (
        id SERIAL PRIMARY KEY,
        breach_id INTEGER NOT NULL REFERENCES breach_detections(id) ON DELETE CASCADE,
        indicator_id INTEGER NOT NULL REFERENCES breach_indicators(id) ON DELETE CASCADE,
        relationship TEXT NOT NULL DEFAULT 'associated',
        notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    console.log("Breach detection tables created successfully");
    return true;
  } catch (error) {
    console.error("Error creating breach detection tables:", error);
    return false;
  }
}

// Create sample breach detection data for testing
async function seedBreachDetectionData() {
  try {
    console.log("Seeding breach detection data...");
    
    // Check if data already exists
    const existingBreaches = await db.select().from(breachDetections).limit(1);
    if (existingBreaches.length > 0) {
      console.log("Breach detection data already exists, skipping seed");
      return true;
    }
    
    // Insert sample rules
    const ruleIds = await db.insert(breachDetectionRules).values([
      {
        name: "Suspicious Token Usage",
        description: "Detects suspicious token usage patterns such as high request rates or unusual access patterns",
        type: "behavior",
        definition: JSON.stringify({
          timeWindow: 60, // minutes
          metrics: [
            { name: "token_requests_per_minute", aggregation: "avg" },
            { name: "unique_ips_per_token", aggregation: "max" }
          ],
          threshold: 10,
          condition: {
            type: "expression",
            expression: "{token_requests_per_minute} > 100 || {unique_ips_per_token} > 5"
          },
          evaluationIntervalMinutes: 15
        }),
        category: "suspicious_activity",
        severity: "high",
        isGlobal: true,
        metadata: {}
      },
      {
        name: "Repeated Authentication Failures",
        description: "Detects multiple failed authentication attempts which may indicate brute force attacks",
        type: "signature",
        definition: JSON.stringify({
          timeWindow: 30, // minutes
          signatures: [
            {
              type: "security_event",
              pattern: {
                eventType: "authentication_failure",
                severity: "high"
              },
              threshold: 5
            }
          ]
        }),
        category: "access_control",
        severity: "critical",
        isGlobal: true,
        metadata: {}
      },
      {
        name: "IP Access Violations",
        description: "Detects access attempts from unauthorized IP addresses",
        type: "signature",
        definition: JSON.stringify({
          timeWindow: 60, // minutes
          signatures: [
            {
              type: "ip_violation",
              pattern: {},
              threshold: 3
            }
          ]
        }),
        category: "access_control",
        severity: "medium",
        isGlobal: true,
        metadata: {}
      }
    ]).returning({ id: breachDetectionRules.id });
    
    // Insert sample breach detections
    const breachIds = await db.insert(breachDetections).values([
      {
        title: "Repeated Failed Access Attempts",
        detectionType: "signature",
        description: "Multiple failed authentication attempts detected from multiple IP addresses",
        severity: "high",
        status: "open",
        source: "oauth_event",
        ruleId: ruleIds[1]?.id,
        affectedResources: ["client-id-123", "workspace-1"],
        evidence: JSON.stringify({
          failedAttempts: 12,
          ipAddresses: ["192.168.1.100", "192.168.1.101", "192.168.1.102"],
          timeframe: "Last 30 minutes"
        })
      },
      {
        title: "Unusual Token Usage Pattern",
        detectionType: "behavior",
        description: "Token used at abnormal rate and from unusual locations",
        severity: "medium",
        status: "in_progress",
        source: "token_usage",
        ruleId: ruleIds[0]?.id,
        affectedResources: ["token-456", "client-id-456"],
        evidence: JSON.stringify({
          normalRate: "10 req/min",
          actualRate: "150 req/min",
          locations: ["US", "Russia", "China"]
        })
      },
      {
        title: "Unauthorized IP Access",
        detectionType: "signature",
        description: "Multiple access attempts from IPs outside the allowlist",
        severity: "medium",
        status: "resolved",
        resolvedAt: new Date(),
        resolution: "mitigated",
        resolutionNotes: "Updated IP allowlist to include new office locations",
        source: "ip_access",
        ruleId: ruleIds[2]?.id,
        affectedResources: ["client-id-789"],
        evidence: JSON.stringify({
          ipAddresses: ["203.0.113.1", "203.0.113.2"],
          attempts: 5
        })
      },
      {
        title: "Suspicious Data Access Pattern",
        detectionType: "anomaly",
        description: "Unusual pattern of data access detected",
        severity: "critical",
        status: "open",
        source: "anomaly_detection",
        affectedResources: ["database-1", "table-users"],
        evidence: JSON.stringify({
          normalAccess: "50 records/hour",
          actualAccess: "5000 records/hour",
          timeframe: "2023-01-15T12:00:00Z to 2023-01-15T13:00:00Z"
        })
      }
    ]).returning({ id: breachDetections.id });
    
    // Insert sample breach events
    await db.insert(breachEvents).values([
      {
        breachId: breachIds[0]?.id,
        eventType: "detection",
        details: JSON.stringify({
          message: "Breach initially detected",
          severity: "high",
          detectedBy: "system"
        })
      },
      {
        breachId: breachIds[0]?.id,
        eventType: "update",
        details: JSON.stringify({
          message: "Additional failed attempts detected",
          newEvidenceCount: 5
        })
      },
      {
        breachId: breachIds[1]?.id,
        eventType: "detection",
        details: JSON.stringify({
          message: "Breach initially detected",
          severity: "medium",
          detectedBy: "system"
        })
      },
      {
        breachId: breachIds[1]?.id,
        eventType: "investigation",
        details: JSON.stringify({
          message: "Investigation started",
          assignedTo: "admin"
        })
      },
      {
        breachId: breachIds[2]?.id,
        eventType: "detection",
        details: JSON.stringify({
          message: "Breach initially detected",
          severity: "medium",
          detectedBy: "system"
        })
      },
      {
        breachId: breachIds[2]?.id,
        eventType: "resolution",
        details: JSON.stringify({
          message: "IP allowlist updated",
          action: "Updated allowed IP ranges",
          resolvedBy: "admin"
        })
      },
      {
        breachId: breachIds[3]?.id,
        eventType: "detection",
        details: JSON.stringify({
          message: "Breach initially detected",
          severity: "critical",
          detectedBy: "system"
        })
      }
    ]);
    
    // Insert sample security metrics
    await db.insert(securityMetrics).values([
      {
        name: "token_requests_per_minute",
        value: "125",
        metricType: "gauge",
        category: "usage"
      },
      {
        name: "unique_ips_per_token",
        value: "7",
        metricType: "gauge",
        category: "access"
      },
      {
        name: "authentication_failures",
        value: "23",
        metricType: "counter",
        category: "authentication"
      },
      {
        name: "ip_violations",
        value: "12",
        metricType: "counter",
        category: "access"
      }
    ]);
    
    console.log("Breach detection data seeded successfully");
    return true;
  } catch (error) {
    console.error("Error seeding breach detection data:", error);
    return false;
  }
}

// Main function to create tables and seed data
export async function setupBreachDetection() {
  const tablesCreated = await createBreachDetectionTables();
  if (tablesCreated) {
    await seedBreachDetectionData();
  }
}