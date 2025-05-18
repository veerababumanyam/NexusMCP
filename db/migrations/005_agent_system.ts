import { sql } from "drizzle-orm";
import { db, pool } from "../index";
import * as schemaAgents from "@shared/schema_agents";

/**
 * Migration to add Agent Support System tables
 */
export async function migrate() {
  console.log("Running migration: 005_agent_system");

  try {
    await db.transaction(async (tx) => {
      // Create MCP Agents table
      await tx.execute(sql`
        CREATE TABLE IF NOT EXISTS mcp_agents (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          agent_type TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'registered',
          version TEXT NOT NULL,
          api_key TEXT,
          api_key_hash TEXT,
          implements_a2a BOOLEAN DEFAULT FALSE,
          capabilities JSONB,
          metadata JSONB,
          config JSONB,
          workspace_id INTEGER REFERENCES workspaces(id),
          server_id INTEGER REFERENCES mcp_servers(id),
          created_by_id INTEGER REFERENCES users(id),
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          last_active_at TIMESTAMP,
          registration_expires_at TIMESTAMP
        );
      `);

      // Create Agent Tools table
      await tx.execute(sql`
        CREATE TABLE IF NOT EXISTS agent_tools (
          id SERIAL PRIMARY KEY,
          agent_id INTEGER NOT NULL REFERENCES mcp_agents(id),
          tool_id INTEGER NOT NULL REFERENCES tools(id),
          is_default BOOLEAN DEFAULT FALSE,
          config JSONB,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE(agent_id, tool_id)
        );
      `);

      // Create Agent Workflows table
      await tx.execute(sql`
        CREATE TABLE IF NOT EXISTS agent_workflows (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          status TEXT NOT NULL DEFAULT 'draft',
          definition JSONB NOT NULL,
          workspace_id INTEGER REFERENCES workspaces(id),
          created_by_id INTEGER REFERENCES users(id),
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
          last_executed_at TIMESTAMP,
          is_template BOOLEAN DEFAULT FALSE
        );
      `);

      // Create Agent Workflow Steps table
      await tx.execute(sql`
        CREATE TABLE IF NOT EXISTS agent_workflow_steps (
          id SERIAL PRIMARY KEY,
          workflow_id INTEGER NOT NULL REFERENCES agent_workflows(id),
          agent_id INTEGER REFERENCES mcp_agents(id),
          step_type TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          config JSONB NOT NULL,
          position JSONB NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // Create Agent Workflow Connections table
      await tx.execute(sql`
        CREATE TABLE IF NOT EXISTS agent_workflow_connections (
          id SERIAL PRIMARY KEY,
          workflow_id INTEGER NOT NULL REFERENCES agent_workflows(id),
          source_step_id INTEGER NOT NULL REFERENCES agent_workflow_steps(id),
          target_step_id INTEGER NOT NULL REFERENCES agent_workflow_steps(id),
          source_handle TEXT,
          target_handle TEXT,
          connection_type TEXT NOT NULL DEFAULT 'data',
          config JSONB,
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // Create Agent Templates table
      await tx.execute(sql`
        CREATE TABLE IF NOT EXISTS agent_templates (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          agent_type TEXT NOT NULL,
          version TEXT NOT NULL,
          definition JSONB NOT NULL,
          default_config JSONB,
          tags JSONB,
          category TEXT,
          author TEXT,
          author_url TEXT,
          is_system BOOLEAN DEFAULT FALSE,
          is_public BOOLEAN DEFAULT TRUE,
          workspace_id INTEGER REFERENCES workspaces(id),
          created_by_id INTEGER REFERENCES users(id),
          created_at TIMESTAMP NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMP NOT NULL DEFAULT NOW()
        );
      `);

      // Create Agent Execution Logs table
      await tx.execute(sql`
        CREATE TABLE IF NOT EXISTS agent_execution_logs (
          id SERIAL PRIMARY KEY,
          agent_id INTEGER NOT NULL REFERENCES mcp_agents(id),
          workflow_id INTEGER REFERENCES agent_workflows(id),
          execution_id TEXT NOT NULL,
          started_at TIMESTAMP NOT NULL,
          completed_at TIMESTAMP,
          status TEXT NOT NULL,
          request_data JSONB,
          response_data JSONB,
          error TEXT,
          metadata JSONB,
          workspace_id INTEGER REFERENCES workspaces(id),
          user_id INTEGER REFERENCES users(id),
          trace_id TEXT,
          tags JSONB
        );
      `);

      // Create Agent Communication Logs table
      await tx.execute(sql`
        CREATE TABLE IF NOT EXISTS agent_communication_logs (
          id SERIAL PRIMARY KEY,
          source_agent_id INTEGER NOT NULL REFERENCES mcp_agents(id),
          target_agent_id INTEGER NOT NULL REFERENCES mcp_agents(id),
          message_id TEXT NOT NULL,
          message_type TEXT NOT NULL,
          content JSONB NOT NULL,
          sent_at TIMESTAMP NOT NULL,
          received_at TIMESTAMP,
          status TEXT NOT NULL,
          workspace_id INTEGER REFERENCES workspaces(id),
          execution_id TEXT,
          trace_id TEXT,
          metadata JSONB
        );
      `);

      console.log("Successfully created agent tables");
    });

    console.log("Migration 005_agent_system completed successfully");
    return { success: true };
  } catch (error: any) {
    console.error("Migration 005_agent_system failed:", error.message);
    throw error;
  } finally {
    // Release the pool
    await pool.end();
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  migrate()
    .then(() => {
      console.log("Migration completed");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}