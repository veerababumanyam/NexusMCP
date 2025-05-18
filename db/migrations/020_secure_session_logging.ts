import { sql } from 'drizzle-orm';
import { Pool } from 'pg';

/**
 * Secure Session Logging Migration
 * 
 * Implements enterprise-grade MCP session logging with:
 * - Tamper-proof logging
 * - Full session tracking
 * - Compliance reporting
 * - Usage analytics
 * - Real-time alerting
 */
export async function runMigration(pool: Pool) {
  console.log('Running secure session logging migration...');
  
  try {
    // Create extension for UUID generation if not exists
    await pool.query(`
      CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    `);

    // Create MCP Session Logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mcp_session_logs (
        id SERIAL PRIMARY KEY,
        session_id UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
        user_id INTEGER REFERENCES users(id),
        agent_id TEXT,
        workspace_id INTEGER REFERENCES workspaces(id),
        server_id INTEGER REFERENCES mcp_servers(id),
        
        -- Session metadata
        client_ip TEXT,
        user_agent TEXT,
        client_type TEXT NOT NULL,
        client_version TEXT,
        device_id TEXT,
        
        -- Geo-location data
        geo_location JSONB,
        
        -- Session timing
        started_at TIMESTAMP NOT NULL DEFAULT NOW(),
        ended_at TIMESTAMP,
        duration_ms INTEGER,
        time_zone TEXT,
        
        -- Session properties
        status TEXT NOT NULL DEFAULT 'active',
        termination_reason TEXT,
        is_system_generated BOOLEAN DEFAULT FALSE,
        
        -- Compliance info
        classification TEXT DEFAULT 'standard',
        data_sharing_consent BOOLEAN DEFAULT TRUE,
        compliance_context JSONB,
        
        -- Security
        encryption_key_id TEXT,
        is_encrypted BOOLEAN DEFAULT FALSE,
        integrity_hash TEXT,
        
        -- Metrics
        total_requests INTEGER DEFAULT 0,
        total_errors INTEGER DEFAULT 0,
        total_prompt_tokens INTEGER DEFAULT 0,
        total_completion_tokens INTEGER DEFAULT 0,
        estimated_cost JSONB,
        
        -- Analytics tags
        tags JSONB,
        app_context JSONB,
        
        -- Retention and archiving
        retention_expiry TIMESTAMP,
        archive_reference TEXT,
        
        -- Chain info
        correlation_id TEXT,
        parent_session_id TEXT
      );
      
      -- Add indexes for performance
      CREATE INDEX IF NOT EXISTS idx_mcp_session_logs_user_id ON mcp_session_logs(user_id);
      CREATE INDEX IF NOT EXISTS idx_mcp_session_logs_workspace_id ON mcp_session_logs(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_mcp_session_logs_server_id ON mcp_session_logs(server_id);
      CREATE INDEX IF NOT EXISTS idx_mcp_session_logs_status ON mcp_session_logs(status);
      CREATE INDEX IF NOT EXISTS idx_mcp_session_logs_started_at ON mcp_session_logs(started_at);
      CREATE INDEX IF NOT EXISTS idx_mcp_session_logs_correlation_id ON mcp_session_logs(correlation_id);
    `);

    // Create MCP Session Interactions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mcp_session_interactions (
        id SERIAL PRIMARY KEY,
        session_id UUID REFERENCES mcp_session_logs(session_id),
        interaction_id UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
        
        -- Interaction metadata
        type TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        tool_id INTEGER REFERENCES tools(id),
        tool_name TEXT,
        
        -- Timestamps
        timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
        duration_ms INTEGER,
        
        -- Content
        prompt JSONB,
        tool_input JSONB,
        tool_output JSONB,
        response JSONB,
        error_details JSONB,
        
        -- Metrics
        prompt_tokens INTEGER,
        completion_tokens INTEGER,
        
        -- Security & Compliance
        is_encrypted BOOLEAN DEFAULT FALSE,
        encryption_key_id TEXT,
        integrity_hash TEXT,
        classification TEXT DEFAULT 'standard',
        
        -- Resources accessed
        resources_accessed JSONB,
        
        -- PII handling
        contained_pii BOOLEAN DEFAULT FALSE,
        pii_types JSONB,
        pii_action_taken TEXT,
        
        -- Context tracking
        correlation_id TEXT,
        parent_interaction_id TEXT
      );
      
      -- Add indexes for performance
      CREATE INDEX IF NOT EXISTS idx_mcp_session_interactions_session_id ON mcp_session_interactions(session_id);
      CREATE INDEX IF NOT EXISTS idx_mcp_session_interactions_timestamp ON mcp_session_interactions(timestamp);
      CREATE INDEX IF NOT EXISTS idx_mcp_session_interactions_type ON mcp_session_interactions(type);
      CREATE INDEX IF NOT EXISTS idx_mcp_session_interactions_tool_id ON mcp_session_interactions(tool_id);
    `);

    // Create MCP Compliance Reports table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mcp_compliance_reports (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER REFERENCES workspaces(id),
        report_id UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
        
        -- Report metadata
        report_type TEXT NOT NULL,
        report_name TEXT NOT NULL,
        description TEXT,
        
        -- Time period
        from_date TIMESTAMP NOT NULL,
        to_date TIMESTAMP NOT NULL,
        generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        
        -- Report status
        status TEXT NOT NULL DEFAULT 'generating',
        completed_at TIMESTAMP,
        
        -- Report content
        report_format TEXT NOT NULL DEFAULT 'json',
        report_data JSONB,
        file_path TEXT,
        file_hash TEXT,
        
        -- Statistics
        session_count INTEGER,
        interaction_count INTEGER,
        violation_count INTEGER,
        
        -- Access control
        created_by INTEGER REFERENCES users(id),
        access_list JSONB,
        is_public BOOLEAN DEFAULT FALSE,
        
        -- Security
        is_encrypted BOOLEAN DEFAULT TRUE,
        encryption_key_id TEXT,
        signature_hash TEXT,
        
        expires_at TIMESTAMP,
        tags JSONB
      );
      
      -- Add indexes for performance
      CREATE INDEX IF NOT EXISTS idx_mcp_compliance_reports_workspace_id ON mcp_compliance_reports(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_mcp_compliance_reports_report_type ON mcp_compliance_reports(report_type);
      CREATE INDEX IF NOT EXISTS idx_mcp_compliance_reports_status ON mcp_compliance_reports(status);
      CREATE INDEX IF NOT EXISTS idx_mcp_compliance_reports_generated_at ON mcp_compliance_reports(generated_at);
    `);

    // Create MCP Compliance Detections table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mcp_compliance_detections (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER REFERENCES workspaces(id),
        detection_id UUID NOT NULL UNIQUE DEFAULT uuid_generate_v4(),
        
        -- What triggered the detection
        source TEXT NOT NULL,
        source_id TEXT,
        
        -- Detection details
        detection_type TEXT NOT NULL,
        severity TEXT NOT NULL DEFAULT 'medium',
        confidence JSONB,
        
        -- Rule that triggered
        rule_id TEXT,
        rule_name TEXT,
        rule_category TEXT,
        
        -- Description
        title TEXT NOT NULL,
        description TEXT,
        detection_details JSONB,
        
        -- Time information
        detected_at TIMESTAMP NOT NULL DEFAULT NOW(),
        
        -- State
        status TEXT NOT NULL DEFAULT 'new',
        is_authentic_violation BOOLEAN DEFAULT TRUE,
        remediation_details JSONB,
        remediated_at TIMESTAMP,
        remediated_by INTEGER REFERENCES users(id),
        
        -- Related compliance frameworks
        compliance_frameworks JSONB,
        
        -- Alerting
        alert_sent BOOLEAN DEFAULT FALSE,
        alert_id TEXT,
        
        tags JSONB
      );
      
      -- Add indexes for performance
      CREATE INDEX IF NOT EXISTS idx_mcp_compliance_detections_workspace_id ON mcp_compliance_detections(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_mcp_compliance_detections_detection_type ON mcp_compliance_detections(detection_type);
      CREATE INDEX IF NOT EXISTS idx_mcp_compliance_detections_severity ON mcp_compliance_detections(severity);
      CREATE INDEX IF NOT EXISTS idx_mcp_compliance_detections_status ON mcp_compliance_detections(status);
      CREATE INDEX IF NOT EXISTS idx_mcp_compliance_detections_detected_at ON mcp_compliance_detections(detected_at);
    `);

    // Create MCP Usage Analytics table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS mcp_usage_analytics (
        id SERIAL PRIMARY KEY,
        workspace_id INTEGER REFERENCES workspaces(id),
        
        -- Time period
        period_type TEXT NOT NULL,
        period_start TIMESTAMP NOT NULL,
        period_end TIMESTAMP NOT NULL,
        
        -- Usage metrics
        total_sessions INTEGER DEFAULT 0,
        total_interactions INTEGER DEFAULT 0,
        total_unique_users INTEGER DEFAULT 0,
        total_unique_agents INTEGER DEFAULT 0,
        
        -- Token usage
        total_prompt_tokens INTEGER DEFAULT 0,
        total_completion_tokens INTEGER DEFAULT 0,
        
        -- Tool usage
        tool_usage JSONB,
        top_tools JSONB,
        
        -- Performance
        avg_response_time INTEGER,
        p95_response_time INTEGER,
        error_rate JSONB,
        
        -- User/Agent patterns
        top_users JSONB,
        top_agents JSONB,
        user_agent_breakdown JSONB,
        
        -- Data access patterns
        top_accessed_resources JSONB,
        data_categories JSONB,
        
        -- Anomalies
        detected_anomalies JSONB,
        
        -- Cost analytics
        total_cost JSONB,
        cost_by_model JSONB,
        cost_by_user JSONB,
        
        -- When this was computed
        computed_at TIMESTAMP NOT NULL DEFAULT NOW(),
        is_complete BOOLEAN DEFAULT TRUE,
        
        -- Add unique constraint on workspace and time period
        CONSTRAINT mcp_usage_analytics_unique_period UNIQUE (workspace_id, period_type, period_start, period_end)
      );
      
      -- Add indexes for performance
      CREATE INDEX IF NOT EXISTS idx_mcp_usage_analytics_workspace_id ON mcp_usage_analytics(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_mcp_usage_analytics_period_type ON mcp_usage_analytics(period_type);
      CREATE INDEX IF NOT EXISTS idx_mcp_usage_analytics_period_start ON mcp_usage_analytics(period_start);
      CREATE INDEX IF NOT EXISTS idx_mcp_usage_analytics_period_end ON mcp_usage_analytics(period_end);
    `);

    console.log('Secure session logging migration completed successfully.');
    return true;
  } catch (error) {
    console.error('Error running secure session logging migration:', error);
    throw error;
  }
}