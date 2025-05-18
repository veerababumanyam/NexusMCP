import { db } from '../index';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { sql } from 'drizzle-orm';

/**
 * Migration for the workspace and policy management system
 * Creates tables for:
 * - workspace_members for explicit workspace membership
 * - policy tables for OPA-based policy management
 */
export async function migrate() {
  console.log('Running workspace and policy system migration...');
  
  try {
    // Ensure workspace_members table exists
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS workspace_members (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id),
        workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
        status TEXT NOT NULL DEFAULT 'active',
        invited_by INTEGER REFERENCES users(id),
        invited_at TIMESTAMP DEFAULT NOW(),
        accepted_at TIMESTAMP,
        expires_at TIMESTAMP,
        is_default BOOLEAN DEFAULT FALSE,
        last_accessed TIMESTAMP,
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, workspace_id)
      )
    `);
    
    // Create policies table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS policies (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        version INTEGER NOT NULL DEFAULT 1,
        policy_type TEXT NOT NULL, -- 'rego', 'json', 'yaml'
        content TEXT NOT NULL, -- The actual policy code
        workspace_id INTEGER REFERENCES workspaces(id),
        status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'published', 'archived', 'deprecated'
        is_system BOOLEAN DEFAULT FALSE, -- System policies cannot be modified
        applies_to JSONB, -- Resource types this policy applies to
        tags JSONB, -- Array of tags for categorization
        requires_approval BOOLEAN DEFAULT FALSE, -- Whether changes require approval
        last_evaluated_at TIMESTAMP,
        created_by INTEGER REFERENCES users(id),
        approved_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        published_at TIMESTAMP,
        UNIQUE (name, workspace_id, version)
      )
    `);
    
    // Create policy_versions table for versioning
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS policy_versions (
        id SERIAL PRIMARY KEY,
        policy_id INTEGER NOT NULL REFERENCES policies(id),
        version INTEGER NOT NULL,
        content TEXT NOT NULL,
        description TEXT,
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        diff_summary TEXT, -- Summary of changes from previous version
        UNIQUE (policy_id, version)
      )
    `);
    
    // Create policy_approval_requests table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS policy_approval_requests (
        id SERIAL PRIMARY KEY,
        policy_id INTEGER NOT NULL REFERENCES policies(id),
        requested_by INTEGER NOT NULL REFERENCES users(id),
        requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
        status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
        approved_by INTEGER REFERENCES users(id),
        approved_at TIMESTAMP,
        rejected_by INTEGER REFERENCES users(id),
        rejected_at TIMESTAMP,
        rejection_reason TEXT,
        workspace_id INTEGER REFERENCES workspaces(id),
        comments TEXT
      )
    `);
    
    // Create policy_approval_workflow table for multi-level approval
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS policy_approval_workflow (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        workspace_id INTEGER REFERENCES workspaces(id),
        steps JSONB NOT NULL, -- Array of approval steps with roles/users
        created_by INTEGER REFERENCES users(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    
    // Create policy_evaluation_logs table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS policy_evaluation_logs (
        id SERIAL PRIMARY KEY,
        policy_id INTEGER REFERENCES policies(id),
        user_id INTEGER REFERENCES users(id),
        resource_type TEXT NOT NULL,
        resource_id TEXT,
        action TEXT NOT NULL,
        decision TEXT NOT NULL, -- 'allow', 'deny'
        decision_reason TEXT,
        request_context JSONB, -- The context of the request
        evaluation_time INTEGER, -- Time in ms for evaluation
        workspace_id INTEGER REFERENCES workspaces(id),
        server_id INTEGER REFERENCES mcp_servers(id),
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    
    // Create policy_templates table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS policy_templates (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        content TEXT NOT NULL,
        policy_type TEXT NOT NULL, -- 'rego', 'json', 'yaml'
        category TEXT NOT NULL,
        tags JSONB,
        created_by INTEGER REFERENCES users(id),
        is_public BOOLEAN DEFAULT TRUE, -- Whether this template is available to all workspaces
        workspace_id INTEGER REFERENCES workspaces(id), -- For workspace-specific templates
        variables JSONB, -- Variables that can be replaced when using template
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    
    console.log('Workspace and policy system migration completed successfully.');
  } catch (error) {
    console.error('Workspace and policy system migration failed:', error);
    throw error;
  }
}