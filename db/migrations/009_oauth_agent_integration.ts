/**
 * Migration for OAuth 2.1 Agent Integration
 * 
 * This migration adds tables for:
 * - Agent OAuth clients
 * - Agent OAuth tokens
 * - Agent sessions
 * - Agent execution history
 * - Agent communication logs
 */

import { pool } from '../index';
import { sql } from 'drizzle-orm';

export async function migrate() {
  console.log('Running OAuth Agent Integration migration...');
  
  try {
    // Start a transaction
    await pool.query('BEGIN');
    
    // Create agent_oauth_clients table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_oauth_clients (
        id SERIAL PRIMARY KEY,
        agent_id INTEGER NOT NULL REFERENCES mcp_agents(id) ON DELETE CASCADE,
        client_id TEXT NOT NULL UNIQUE,
        client_secret TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        redirect_uris JSONB NOT NULL,
        scopes JSONB NOT NULL,
        grant_types JSONB NOT NULL,
        token_endpoint_auth_method TEXT NOT NULL DEFAULT 'client_secret_basic',
        client_uri TEXT,
        logo_uri TEXT,
        contacts JSONB,
        registration_access_token TEXT NOT NULL,
        issued_at TIMESTAMP NOT NULL,
        expires_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_agent_oauth_clients_agent_id ON agent_oauth_clients(agent_id);
      CREATE INDEX IF NOT EXISTS idx_agent_oauth_clients_client_id ON agent_oauth_clients(client_id);
    `);
    
    // Create agent_oauth_tokens table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_oauth_tokens (
        id SERIAL PRIMARY KEY,
        agent_id INTEGER NOT NULL REFERENCES mcp_agents(id) ON DELETE CASCADE,
        client_id TEXT NOT NULL REFERENCES agent_oauth_clients(client_id) ON DELETE CASCADE,
        access_token TEXT NOT NULL UNIQUE,
        refresh_token TEXT NOT NULL UNIQUE,
        scopes JSONB NOT NULL,
        grant_type TEXT NOT NULL,
        issued_at TIMESTAMP NOT NULL,
        access_token_expires_at TIMESTAMP NOT NULL,
        refresh_token_expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_agent_oauth_tokens_agent_id ON agent_oauth_tokens(agent_id);
      CREATE INDEX IF NOT EXISTS idx_agent_oauth_tokens_client_id ON agent_oauth_tokens(client_id);
      CREATE INDEX IF NOT EXISTS idx_agent_oauth_tokens_access_token ON agent_oauth_tokens(access_token);
      CREATE INDEX IF NOT EXISTS idx_agent_oauth_tokens_refresh_token ON agent_oauth_tokens(refresh_token);
    `);
    
    // Create agent_sessions table for stateful management
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_sessions (
        id SERIAL PRIMARY KEY,
        agent_id INTEGER NOT NULL REFERENCES mcp_agents(id) ON DELETE CASCADE,
        session_id TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'active',
        context_data JSONB,
        last_active_at TIMESTAMP NOT NULL,
        expires_at TIMESTAMP,
        message_count INTEGER DEFAULT 0,
        metadata JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_agent_sessions_agent_id ON agent_sessions(agent_id);
      CREATE INDEX IF NOT EXISTS idx_agent_sessions_session_id ON agent_sessions(session_id);
      CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_agent_sessions_expires_at ON agent_sessions(expires_at);
    `);
    
    // Create agent_executions table for tool executions
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_executions (
        id SERIAL PRIMARY KEY,
        agent_id INTEGER NOT NULL REFERENCES mcp_agents(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'running',
        tool_name TEXT NOT NULL,
        request_payload JSONB,
        response_payload JSONB,
        execution_time INTEGER,
        input_tokens INTEGER,
        output_tokens INTEGER,
        error TEXT,
        metadata JSONB,
        environment TEXT,
        server_id INTEGER REFERENCES mcp_servers(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMP
      );
      
      CREATE INDEX IF NOT EXISTS idx_agent_executions_agent_id ON agent_executions(agent_id);
      CREATE INDEX IF NOT EXISTS idx_agent_executions_status ON agent_executions(status);
      CREATE INDEX IF NOT EXISTS idx_agent_executions_tool_name ON agent_executions(tool_name);
      CREATE INDEX IF NOT EXISTS idx_agent_executions_server_id ON agent_executions(server_id);
      CREATE INDEX IF NOT EXISTS idx_agent_executions_created_at ON agent_executions(created_at);
    `);
    
    // Create agent_communication_logs table for messaging and communication history
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_communication_logs (
        id SERIAL PRIMARY KEY,
        agent_id INTEGER NOT NULL REFERENCES mcp_agents(id) ON DELETE CASCADE,
        target_agent_id INTEGER REFERENCES mcp_agents(id) ON DELETE SET NULL,
        message_type TEXT NOT NULL,
        message_id TEXT,
        direction TEXT NOT NULL, 
        content JSONB,
        metadata JSONB,
        correlation_id TEXT,
        channel_id TEXT,
        status TEXT NOT NULL DEFAULT 'sent',
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_agent_communication_logs_agent_id ON agent_communication_logs(agent_id);
      CREATE INDEX IF NOT EXISTS idx_agent_communication_logs_target_agent_id ON agent_communication_logs(target_agent_id);
      CREATE INDEX IF NOT EXISTS idx_agent_communication_logs_message_type ON agent_communication_logs(message_type);
      CREATE INDEX IF NOT EXISTS idx_agent_communication_logs_correlation_id ON agent_communication_logs(correlation_id);
      CREATE INDEX IF NOT EXISTS idx_agent_communication_logs_created_at ON agent_communication_logs(created_at);
    `);
    
    // Commit the transaction
    await pool.query('COMMIT');
    
    console.log('OAuth Agent Integration migration completed successfully');
  } catch (error) {
    // Rollback the transaction on error
    await pool.query('ROLLBACK');
    console.error('OAuth Agent Integration migration failed:', error);
    throw error;
  }
}