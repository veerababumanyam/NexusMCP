import { pool } from '../index';
import { logger } from '../../server/utils/logger';

/**
 * MCP Orchestrator Migration
 * 
 * Creates database tables for the MCP Orchestrator feature:
 * - Workflow templates and their components
 * - Workflow instances and execution tracking
 * - Tool manifests for governance
 * - Approval workflows and deployment tracking
 */
export async function runMcpOrchestratorMigration() {
  const client = await pool.connect();
  
  try {
    logger.info('Starting MCP Orchestrator migration');
    
    // Start transaction
    await client.query('BEGIN');
    
    // Create workflow_templates table
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_templates (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        version TEXT NOT NULL DEFAULT '1.0.0',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        created_by INTEGER,
        category TEXT,
        tags JSONB,
        status TEXT NOT NULL DEFAULT 'draft',
        is_public BOOLEAN NOT NULL DEFAULT false,
        workspace_id INTEGER,
        metadata JSONB,
        config JSONB
      );
    `);
    
    // Create workflow_nodes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_nodes (
        id SERIAL PRIMARY KEY,
        template_id INTEGER NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
        node_id TEXT NOT NULL,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        position JSONB,
        config JSONB,
        tool_id INTEGER,
        server_id INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(template_id, node_id)
      );
    `);
    
    // Create workflow_connections table
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_connections (
        id SERIAL PRIMARY KEY,
        template_id INTEGER NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
        source_node_id TEXT NOT NULL,
        target_node_id TEXT NOT NULL,
        source_port TEXT,
        target_port TEXT,
        label TEXT,
        condition JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    // Create workflow_instances table
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_instances (
        id SERIAL PRIMARY KEY,
        template_id INTEGER NOT NULL REFERENCES workflow_templates(id),
        instance_id UUID NOT NULL DEFAULT gen_random_uuid(),
        status TEXT NOT NULL DEFAULT 'pending',
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_by INTEGER,
        workspace_id INTEGER,
        input JSONB,
        output JSONB,
        error JSONB,
        execution_context JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    // Create workflow_node_executions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_node_executions (
        id SERIAL PRIMARY KEY,
        instance_id INTEGER NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
        node_id TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        input JSONB,
        output JSONB,
        error JSONB,
        execution_order INTEGER,
        duration INTEGER,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    // Create workflow_approvals table
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_approvals (
        id SERIAL PRIMARY KEY,
        template_id INTEGER NOT NULL REFERENCES workflow_templates(id),
        requested_by INTEGER NOT NULL,
        approved_by INTEGER,
        status TEXT NOT NULL DEFAULT 'pending',
        environment TEXT NOT NULL,
        comments TEXT,
        requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
        responded_at TIMESTAMP,
        expires_at TIMESTAMP,
        changes JSONB,
        notifications_sent JSONB
      );
    `);
    
    // Create workflow_deployments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_deployments (
        id SERIAL PRIMARY KEY,
        template_id INTEGER NOT NULL REFERENCES workflow_templates(id),
        environment TEXT NOT NULL,
        version TEXT NOT NULL,
        deployed_by INTEGER,
        approval_id INTEGER REFERENCES workflow_approvals(id),
        status TEXT NOT NULL,
        deployed_at TIMESTAMP NOT NULL DEFAULT NOW(),
        rollback_to INTEGER,
        is_rollback BOOLEAN NOT NULL DEFAULT false,
        logs JSONB
      );
    `);
    
    // Create workflow_variables table
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_variables (
        id SERIAL PRIMARY KEY,
        template_id INTEGER NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        default_value JSONB,
        description TEXT,
        is_secret BOOLEAN NOT NULL DEFAULT false,
        scope TEXT NOT NULL DEFAULT 'workflow',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);
    
    // Create tool_manifests table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tool_manifests (
        id SERIAL PRIMARY KEY,
        server_id INTEGER NOT NULL,
        tool_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        version TEXT NOT NULL,
        schema JSONB NOT NULL,
        maintainer TEXT,
        maintainer_email TEXT,
        last_checked TIMESTAMP NOT NULL DEFAULT NOW(),
        status TEXT NOT NULL DEFAULT 'active',
        version_history JSONB,
        features JSONB,
        tags JSONB,
        category TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE(server_id, tool_id, version)
      );
    `);
    
    // Create indexes for better performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_workflow_templates_workspace_id ON workflow_templates(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_templates_status ON workflow_templates(status);
      CREATE INDEX IF NOT EXISTS idx_workflow_nodes_template_id ON workflow_nodes(template_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_connections_template_id ON workflow_connections(template_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_instances_template_id ON workflow_instances(template_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_instances_instance_id ON workflow_instances(instance_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_instances_status ON workflow_instances(status);
      CREATE INDEX IF NOT EXISTS idx_workflow_node_executions_instance_id ON workflow_node_executions(instance_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_approvals_template_id ON workflow_approvals(template_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_approvals_status ON workflow_approvals(status);
      CREATE INDEX IF NOT EXISTS idx_workflow_deployments_template_id ON workflow_deployments(template_id);
      CREATE INDEX IF NOT EXISTS idx_workflow_variables_template_id ON workflow_variables(template_id);
      CREATE INDEX IF NOT EXISTS idx_tool_manifests_server_id ON tool_manifests(server_id);
      CREATE INDEX IF NOT EXISTS idx_tool_manifests_tool_id ON tool_manifests(tool_id);
    `);
    
    // Add foreign key relationships to existing tables if needed
    
    // Commit transaction
    await client.query('COMMIT');
    
    logger.info('MCP Orchestrator migration completed successfully');
    return true;
  } catch (error) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    logger.error('MCP Orchestrator migration failed', error);
    throw error;
  } finally {
    // Release client back to pool
    client.release();
  }
}