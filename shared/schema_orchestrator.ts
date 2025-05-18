import { 
  pgTable, 
  serial, 
  text, 
  timestamp, 
  jsonb, 
  boolean, 
  integer, 
  uuid,
  unique
} from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';

// Workflow Templates Table
export const workflowTemplates = pgTable('workflow_templates', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  version: text('version').notNull().default('1.0.0'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  createdBy: integer('created_by'),
  category: text('category'),
  tags: jsonb('tags'),
  status: text('status').notNull().default('draft'),
  isPublic: boolean('is_public').notNull().default(false),
  workspaceId: integer('workspace_id'),
  metadata: jsonb('metadata'),
  config: jsonb('config')
});

// Workflow Nodes Table
export const workflowNodes = pgTable('workflow_nodes', {
  id: serial('id').primaryKey(),
  templateId: integer('template_id')
    .notNull()
    .references(() => workflowTemplates.id, { onDelete: 'cascade' }),
  nodeId: text('node_id').notNull(),
  type: text('type').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  position: jsonb('position'),
  config: jsonb('config'),
  toolId: integer('tool_id'),
  serverId: integer('server_id'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
}, (table) => {
  return {
    uniqueNodeInTemplate: unique().on(table.templateId, table.nodeId)
  };
});

// Workflow Connections Table
export const workflowConnections = pgTable('workflow_connections', {
  id: serial('id').primaryKey(),
  templateId: integer('template_id')
    .notNull()
    .references(() => workflowTemplates.id, { onDelete: 'cascade' }),
  sourceNodeId: text('source_node_id').notNull(),
  targetNodeId: text('target_node_id').notNull(),
  sourcePort: text('source_port'),
  targetPort: text('target_port'),
  label: text('label'),
  condition: jsonb('condition'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Workflow Instances Table
export const workflowInstances = pgTable('workflow_instances', {
  id: serial('id').primaryKey(),
  templateId: integer('template_id')
    .notNull()
    .references(() => workflowTemplates.id),
  instanceId: uuid('instance_id').notNull().defaultRandom(),
  status: text('status').notNull().default('pending'),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdBy: integer('created_by'),
  workspaceId: integer('workspace_id'),
  input: jsonb('input'),
  output: jsonb('output'),
  error: jsonb('error'),
  executionContext: jsonb('execution_context'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Workflow Node Executions Table
export const workflowNodeExecutions = pgTable('workflow_node_executions', {
  id: serial('id').primaryKey(),
  instanceId: integer('instance_id')
    .notNull()
    .references(() => workflowInstances.id, { onDelete: 'cascade' }),
  nodeId: text('node_id').notNull(),
  status: text('status').notNull(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  input: jsonb('input'),
  output: jsonb('output'),
  error: jsonb('error'),
  executionOrder: integer('execution_order'),
  duration: integer('duration'),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// Workflow Approvals Table
export const workflowApprovals = pgTable('workflow_approvals', {
  id: serial('id').primaryKey(),
  templateId: integer('template_id')
    .notNull()
    .references(() => workflowTemplates.id),
  requestedBy: integer('requested_by').notNull(),
  approvedBy: integer('approved_by'),
  status: text('status').notNull().default('pending'),
  environment: text('environment').notNull(),
  comments: text('comments'),
  requestedAt: timestamp('requested_at').notNull().defaultNow(),
  respondedAt: timestamp('responded_at'),
  expiresAt: timestamp('expires_at'),
  changes: jsonb('changes'),
  notificationsSent: jsonb('notifications_sent')
});

// Workflow Deployments Table
export const workflowDeployments = pgTable('workflow_deployments', {
  id: serial('id').primaryKey(),
  templateId: integer('template_id')
    .notNull()
    .references(() => workflowTemplates.id),
  environment: text('environment').notNull(),
  version: text('version').notNull(),
  deployedBy: integer('deployed_by'),
  approvalId: integer('approval_id')
    .references(() => workflowApprovals.id),
  status: text('status').notNull(),
  deployedAt: timestamp('deployed_at').notNull().defaultNow(),
  rollbackTo: integer('rollback_to'),
  isRollback: boolean('is_rollback').notNull().default(false),
  logs: jsonb('logs')
});

// Workflow Variables Table
export const workflowVariables = pgTable('workflow_variables', {
  id: serial('id').primaryKey(),
  templateId: integer('template_id')
    .notNull()
    .references(() => workflowTemplates.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(),
  defaultValue: jsonb('default_value'),
  description: text('description'),
  isSecret: boolean('is_secret').notNull().default(false),
  scope: text('scope').notNull().default('workflow'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Tool Manifests Table
export const toolManifests = pgTable('tool_manifests', {
  id: serial('id').primaryKey(),
  serverId: integer('server_id').notNull(),
  toolId: text('tool_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  version: text('version').notNull(),
  schema: jsonb('schema').notNull(),
  maintainer: text('maintainer'),
  maintainerEmail: text('maintainer_email'),
  lastChecked: timestamp('last_checked').notNull().defaultNow(),
  status: text('status').notNull().default('active'),
  versionHistory: jsonb('version_history'),
  features: jsonb('features'),
  tags: jsonb('tags'),
  category: text('category'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
}, (table) => {
  return {
    uniqueToolVersion: unique().on(table.serverId, table.toolId, table.version)
  };
});

// Relations

export const workflowTemplatesRelations = relations(workflowTemplates, ({ many }) => ({
  nodes: many(workflowNodes),
  connections: many(workflowConnections),
  variables: many(workflowVariables),
  instances: many(workflowInstances),
  approvals: many(workflowApprovals),
  deployments: many(workflowDeployments)
}));

export const workflowInstancesRelations = relations(workflowInstances, ({ one, many }) => ({
  template: one(workflowTemplates, {
    fields: [workflowInstances.templateId],
    references: [workflowTemplates.id]
  }),
  nodeExecutions: many(workflowNodeExecutions)
}));

export const workflowNodesRelations = relations(workflowNodes, ({ one }) => ({
  template: one(workflowTemplates, {
    fields: [workflowNodes.templateId],
    references: [workflowTemplates.id]
  })
}));

export const workflowConnectionsRelations = relations(workflowConnections, ({ one }) => ({
  template: one(workflowTemplates, {
    fields: [workflowConnections.templateId],
    references: [workflowTemplates.id]
  })
}));

// Type definitions

export type WorkflowConfig = {
  description?: string;
  version?: string;
  timeout?: number; // milliseconds
  maxRetries?: number;
  environment?: Record<string, string>;
  tags?: string[];
  inputSchema?: any;
  outputSchema?: any;
};

export type NodeConfig = {
  inputs?: Record<string, any>;
  outputs?: Record<string, any>;
  params?: Record<string, any>;
  description?: string;
  timeout?: number; // milliseconds
  retries?: number;
  condition?: string | object;
  transform?: string | object;
  schema?: any;
};

export type ConnectionCondition = {
  type?: 'expression' | 'javascript' | 'rule';
  value?: string | object;
  description?: string;
};

// Zod schemas for validation

export const workflowTemplateInsertSchema = createInsertSchema(workflowTemplates, {
  name: (schema) => schema.min(1, "Name is required"),
  description: (schema) => schema.optional(),
  config: z.any().optional()
});
export type WorkflowTemplateInsert = z.infer<typeof workflowTemplateInsertSchema>;
export const workflowTemplateSelectSchema = createSelectSchema(workflowTemplates);
export type WorkflowTemplate = z.infer<typeof workflowTemplateSelectSchema>;

// Update schema for workflow templates
export const workflowTemplateUpdateSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  description: z.string().optional().nullable(),
  version: z.string().optional(),
  category: z.string().optional(),
  tags: z.any().optional(),
  status: z.string().optional(),
  isPublic: z.boolean().optional(),
  workspaceId: z.number().optional(),
  metadata: z.any().optional(),
  config: z.any().optional()
});
export type WorkflowTemplateUpdate = z.infer<typeof workflowTemplateUpdateSchema> & { id: string | number };

export const workflowNodeInsertSchema = createInsertSchema(workflowNodes, {
  nodeId: (schema) => schema.min(1, "Node ID is required"),
  name: (schema) => schema.min(1, "Name is required"),
  type: (schema) => schema.min(1, "Type is required"),
  config: z.any().optional()
});
export type WorkflowNodeInsert = z.infer<typeof workflowNodeInsertSchema>;
export const workflowNodeSelectSchema = createSelectSchema(workflowNodes);
export type WorkflowNode = z.infer<typeof workflowNodeSelectSchema>;

// Update schema for workflow nodes
export const workflowNodeUpdateSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  type: z.string().min(1, "Type is required").optional(),
  description: z.string().optional().nullable(),
  position: z.any().optional(),
  config: z.any().optional(),
  toolId: z.number().optional(),
  serverId: z.number().optional()
});
export type WorkflowNodeUpdate = z.infer<typeof workflowNodeUpdateSchema> & { id: string | number };

export const workflowConnectionInsertSchema = createInsertSchema(workflowConnections, {
  sourceNodeId: (schema) => schema.min(1, "Source node ID is required"),
  targetNodeId: (schema) => schema.min(1, "Target node ID is required"),
  condition: z.any().optional()
});
export type WorkflowConnectionInsert = z.infer<typeof workflowConnectionInsertSchema>;
export const workflowConnectionSelectSchema = createSelectSchema(workflowConnections);
export type WorkflowConnection = z.infer<typeof workflowConnectionSelectSchema>;

// Update schema for workflow connections
export const workflowConnectionUpdateSchema = z.object({
  sourceNodeId: z.string().min(1, "Source node ID is required").optional(),
  targetNodeId: z.string().min(1, "Target node ID is required").optional(),
  sourcePort: z.string().optional(),
  targetPort: z.string().optional(),
  label: z.string().optional(),
  condition: z.any().optional()
});
export type WorkflowConnectionUpdate = z.infer<typeof workflowConnectionUpdateSchema> & { id: string | number };

export const workflowInstanceInsertSchema = createInsertSchema(workflowInstances, {
  input: z.any().optional(),
  executionContext: z.any().optional()
});
export type WorkflowInstanceInsert = z.infer<typeof workflowInstanceInsertSchema>;
export const workflowInstanceSelectSchema = createSelectSchema(workflowInstances);
export type WorkflowInstance = z.infer<typeof workflowInstanceSelectSchema>;

export const workflowNodeExecutionInsertSchema = createInsertSchema(workflowNodeExecutions, {
  nodeId: (schema) => schema.min(1, "Node ID is required"),
  status: (schema) => schema.min(1, "Status is required"),
  input: z.any().optional(),
  output: z.any().optional(),
  error: z.any().optional()
});
export type WorkflowNodeExecutionInsert = z.infer<typeof workflowNodeExecutionInsertSchema>;
export const workflowNodeExecutionSelectSchema = createSelectSchema(workflowNodeExecutions);
export type WorkflowNodeExecution = z.infer<typeof workflowNodeExecutionSelectSchema>;

export const toolManifestInsertSchema = createInsertSchema(toolManifests, {
  serverId: (schema) => schema.int("Server ID must be an integer"),
  toolId: (schema) => schema.min(1, "Tool ID is required"),
  name: (schema) => schema.min(1, "Name is required"),
  version: (schema) => schema.min(1, "Version is required"),
  schema: z.any().optional()
});
export type ToolManifestInsert = z.infer<typeof toolManifestInsertSchema>;
export const toolManifestSelectSchema = createSelectSchema(toolManifests);
export type ToolManifest = z.infer<typeof toolManifestSelectSchema>;

// Schema for executing workflows
export const workflowExecuteSchema = z.object({
  templateId: z.number(),
  input: z.any().optional(),
  executionContext: z.any().optional(),
  workspaceId: z.number().optional()
});
export type WorkflowExecuteInput = z.infer<typeof workflowExecuteSchema>;