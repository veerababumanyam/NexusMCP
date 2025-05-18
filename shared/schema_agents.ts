/**
 * Agent and OAuth Schema Definitions
 * 
 * Defines schema for:
 * - MCP agents
 * - Agent OAuth clients (for OAuth 2.1 dynamic client registration)
 * - Agent OAuth tokens
 * - Agent execution history
 */

import { pgTable, serial, text, timestamp, boolean, integer, json, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';

// =============================================
// MCP Agent schemas
// =============================================

export const mcpAgents = pgTable('mcp_agents', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  agentType: text('agent_type').notNull().default('standard'),
  apiKey: text('api_key'),
  status: text('status').notNull().default('active'),
  capabilities: jsonb('capabilities').$type<string[]>(),
  workspaceId: integer('workspace_id'),
  serverId: integer('server_id'),
  config: jsonb('config'),
  metadata: jsonb('metadata'),
  allowedTools: jsonb('allowed_tools').$type<string[]>(),
  lastActiveAt: timestamp('last_active_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const mcpAgentsRelations = relations(mcpAgents, ({ many }) => ({
  oauthClients: many(agentOAuthClients)
}));

export const mcpAgentInsertSchema = createInsertSchema(mcpAgents, {
  name: (schema) => schema.min(3, "Name must be at least 3 characters"),
  description: (schema) => schema.min(5, "Description must be at least 5 characters").optional()
});
export type McpAgentInsert = z.infer<typeof mcpAgentInsertSchema>;
// Alias for backward compatibility
export const insertMcpAgentSchema = mcpAgentInsertSchema;

export const mcpAgentSelectSchema = createSelectSchema(mcpAgents);
export type McpAgent = z.infer<typeof mcpAgentSelectSchema>;

// =============================================
// Agent-to-Agent (A2A) schemas
// =============================================

export const a2aFlows = pgTable('a2a_flows', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  status: text('status').notNull().default('active'),
  workspaceId: integer('workspace_id'),
  config: jsonb('config'),
  sourceAgentId: integer('source_agent_id'),
  targetAgentId: integer('target_agent_id'),
  triggerConditions: jsonb('trigger_conditions'),
  transformationConfig: jsonb('transformation_config'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const a2aExecutions = pgTable('a2a_executions', {
  id: serial('id').primaryKey(),
  flowId: integer('flow_id').notNull(),
  status: text('status').notNull().default('pending'),
  sourceAgentId: integer('source_agent_id').notNull(),
  targetAgentId: integer('target_agent_id').notNull(),
  requestPayload: jsonb('request_payload'),
  responsePayload: jsonb('response_payload'),
  error: text('error'),
  duration: integer('duration'), // in milliseconds
  correlationId: text('correlation_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at')
});

// =============================================
// OAuth Client Registration schemas
// =============================================

export const agentOAuthClients = pgTable('agent_oauth_clients', {
  id: serial('id').primaryKey(),
  agentId: integer('agent_id').notNull(),
  clientId: text('client_id').notNull().unique(),
  clientSecret: text('client_secret').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  redirectUris: jsonb('redirect_uris').$type<string[]>().notNull(),
  scopes: jsonb('scopes').$type<string[]>().notNull(),
  grantTypes: jsonb('grant_types').$type<string[]>().notNull(),
  tokenEndpointAuthMethod: text('token_endpoint_auth_method').notNull().default('client_secret_basic'),
  clientUri: text('client_uri'),
  logoUri: text('logo_uri'),
  contacts: jsonb('contacts').$type<string[]>(),
  registrationAccessToken: text('registration_access_token').notNull(),
  issuedAt: timestamp('issued_at').notNull(),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const agentOAuthClientsRelations = relations(agentOAuthClients, ({ one, many }) => ({
  agent: one(mcpAgents, {
    fields: [agentOAuthClients.agentId],
    references: [mcpAgents.id]
  }),
  tokens: many(agentOAuthTokens)
}));

// =============================================
// OAuth Token schemas
// =============================================

export const agentOAuthTokens = pgTable('agent_oauth_tokens', {
  id: serial('id').primaryKey(),
  agentId: integer('agent_id').notNull(),
  clientId: text('client_id').notNull(),
  accessToken: text('access_token').notNull().unique(),
  refreshToken: text('refresh_token').notNull().unique(),
  scopes: jsonb('scopes').$type<string[]>().notNull(),
  grantType: text('grant_type').notNull(),
  issuedAt: timestamp('issued_at').notNull(),
  accessTokenExpiresAt: timestamp('access_token_expires_at').notNull(),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const agentOAuthTokensRelations = relations(agentOAuthTokens, ({ one }) => ({
  client: one(agentOAuthClients, {
    fields: [agentOAuthTokens.clientId],
    references: [agentOAuthClients.clientId]
  }),
  agent: one(mcpAgents, {
    fields: [agentOAuthTokens.agentId],
    references: [mcpAgents.id]
  })
}));

// =============================================
// Agent Execution History schemas
// =============================================

export const agentExecutions = pgTable('agent_executions', {
  id: serial('id').primaryKey(),
  agentId: integer('agent_id').notNull(),
  status: text('status').notNull().default('running'),
  toolName: text('tool_name').notNull(),
  requestPayload: jsonb('request_payload'),
  responsePayload: jsonb('response_payload'),
  executionTime: integer('execution_time'), // in milliseconds
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  error: text('error'),
  metadata: jsonb('metadata'),
  environment: text('environment'),
  serverId: integer('server_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at')
});

// =============================================
// Agent Stateful Session schemas 
// =============================================

export const agentSessions = pgTable('agent_sessions', {
  id: serial('id').primaryKey(),
  agentId: integer('agent_id').notNull(),
  sessionId: text('session_id').notNull().unique(),
  status: text('status').notNull().default('active'),
  contextData: jsonb('context_data'), // Persisted conversation/session context
  lastActiveAt: timestamp('last_active_at').notNull(),
  expiresAt: timestamp('expires_at'),
  messageCount: integer('message_count').default(0),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// =============================================
// Validation Schemas
// =============================================

export const agentOAuthClientInsertSchema = createInsertSchema(agentOAuthClients, {
  name: (schema) => schema.min(3, "Name must be at least 3 characters"),
  redirectUris: (schema) => schema.array().min(1, "At least one redirect URI is required")
});
export type AgentOAuthClientInsert = z.infer<typeof agentOAuthClientInsertSchema>;

export const agentOAuthClientSelectSchema = createSelectSchema(agentOAuthClients);
export type AgentOAuthClient = z.infer<typeof agentOAuthClientSelectSchema>;

export const agentOAuthTokenInsertSchema = createInsertSchema(agentOAuthTokens);
export type AgentOAuthTokenInsert = z.infer<typeof agentOAuthTokenInsertSchema>;

export const agentOAuthTokenSelectSchema = createSelectSchema(agentOAuthTokens);
export type AgentOAuthToken = z.infer<typeof agentOAuthTokenSelectSchema>;

export const a2aFlowInsertSchema = createInsertSchema(a2aFlows, {
  name: (schema) => schema.min(3, "Name must be at least 3 characters")
});
export type A2aFlowInsert = z.infer<typeof a2aFlowInsertSchema>;
export type InsertAgentWorkflow = A2aFlowInsert; // Alias for backward compatibility

export const a2aFlowSelectSchema = createSelectSchema(a2aFlows);
export type A2aFlow = z.infer<typeof a2aFlowSelectSchema>;
export type AgentWorkflow = A2aFlow; // Alias for backward compatibility

// Table aliases for backward compatibility
export const agentWorkflows = a2aFlows;

export const a2aExecutionInsertSchema = createInsertSchema(a2aExecutions);
export type A2aExecutionInsert = z.infer<typeof a2aExecutionInsertSchema>;

export const a2aExecutionSelectSchema = createSelectSchema(a2aExecutions);
export type A2aExecution = z.infer<typeof a2aExecutionSelectSchema>;

export const agentExecutionInsertSchema = createInsertSchema(agentExecutions);
export type AgentExecutionInsert = z.infer<typeof agentExecutionInsertSchema>;
export type InsertAgentExecutionLog = AgentExecutionInsert; // Alias for backward compatibility

export const agentExecutionSelectSchema = createSelectSchema(agentExecutions);
export type AgentExecution = z.infer<typeof agentExecutionSelectSchema>;

// Alias for backward compatibility
export const agentExecutionLogs = agentExecutions;

export const agentSessionInsertSchema = createInsertSchema(agentSessions);
export type AgentSessionInsert = z.infer<typeof agentSessionInsertSchema>;

export const agentSessionSelectSchema = createSelectSchema(agentSessions);
export type AgentSession = z.infer<typeof agentSessionSelectSchema>;

// =============================================
// Agent Communication Logs schemas
// =============================================

export const agentCommunicationLogs = pgTable('agent_communication_logs', {
  id: serial('id').primaryKey(),
  agentId: integer('agent_id').notNull().references(() => mcpAgents.id, { onDelete: 'cascade' }),
  targetAgentId: integer('target_agent_id').references(() => mcpAgents.id, { onDelete: 'set null' }),
  messageType: text('message_type').notNull(),
  messageId: text('message_id'),
  direction: text('direction').notNull(), // 'inbound' or 'outbound'
  content: jsonb('content'),
  metadata: jsonb('metadata'),
  correlationId: text('correlation_id'),
  channelId: text('channel_id'),
  status: text('status').notNull().default('sent'),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

export const agentCommunicationLogInsertSchema = createInsertSchema(agentCommunicationLogs);
export type AgentCommunicationLogInsert = z.infer<typeof agentCommunicationLogInsertSchema>;
export type InsertAgentCommunicationLog = AgentCommunicationLogInsert; // Alias for backward compatibility

export const agentCommunicationLogSelectSchema = createSelectSchema(agentCommunicationLogs);
export type AgentCommunicationLog = z.infer<typeof agentCommunicationLogSelectSchema>;

// =============================================
// Agent Tools, Workflow Steps and Templates schemas
// =============================================

export const agentTools = pgTable('agent_tools', {
  id: serial('id').primaryKey(),
  agentId: integer('agent_id').notNull().references(() => mcpAgents.id, { onDelete: 'cascade' }),
  toolId: integer('tool_id').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const agentWorkflowSteps = pgTable('agent_workflow_steps', {
  id: serial('id').primaryKey(),
  workflowId: integer('workflow_id').notNull(),
  agentId: integer('agent_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  position: integer('position').notNull(),
  config: jsonb('config'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const agentWorkflowConnections = pgTable('agent_workflow_connections', {
  id: serial('id').primaryKey(),
  workflowId: integer('workflow_id').notNull(),
  sourceStepId: integer('source_step_id').notNull(),
  targetStepId: integer('target_step_id').notNull(),
  condition: jsonb('condition'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

export const agentTemplates = pgTable('agent_templates', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  agentType: text('agent_type').notNull(),
  config: jsonb('config').notNull(),
  isDefault: boolean('is_default').default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Add insert and select schemas and types for the new tables
export const agentToolsInsertSchema = createInsertSchema(agentTools);
export type AgentToolsInsert = z.infer<typeof agentToolsInsertSchema>;
export type InsertAgentTool = AgentToolsInsert; // Alias for backward compatibility

export const agentToolsSelectSchema = createSelectSchema(agentTools);
export type AgentTools = z.infer<typeof agentToolsSelectSchema>;

export const agentWorkflowStepsInsertSchema = createInsertSchema(agentWorkflowSteps);
export type AgentWorkflowStepsInsert = z.infer<typeof agentWorkflowStepsInsertSchema>;
export type InsertAgentWorkflowStep = AgentWorkflowStepsInsert; // Alias for backward compatibility

export const agentWorkflowStepsSelectSchema = createSelectSchema(agentWorkflowSteps);
export type AgentWorkflowSteps = z.infer<typeof agentWorkflowStepsSelectSchema>;

export const agentWorkflowConnectionsInsertSchema = createInsertSchema(agentWorkflowConnections);
export type AgentWorkflowConnectionsInsert = z.infer<typeof agentWorkflowConnectionsInsertSchema>;
export type InsertAgentWorkflowConnection = AgentWorkflowConnectionsInsert; // Alias for backward compatibility

export const agentWorkflowConnectionsSelectSchema = createSelectSchema(agentWorkflowConnections);
export type AgentWorkflowConnections = z.infer<typeof agentWorkflowConnectionsSelectSchema>;

export const agentTemplatesInsertSchema = createInsertSchema(agentTemplates);
export type AgentTemplatesInsert = z.infer<typeof agentTemplatesInsertSchema>;

export const agentTemplatesSelectSchema = createSelectSchema(agentTemplates);
export type AgentTemplates = z.infer<typeof agentTemplatesSelectSchema>;