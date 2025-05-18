import { pgTable, serial, varchar, text, timestamp, integer, json, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';
import { users, workspaces } from './schema';

/**
 * Agent status enum
 */
export const agentStatusEnum = pgEnum('agent_status', [
  'active',
  'inactive',
  'error',
  'maintenance'
]);

/**
 * Flow status enum
 */
export const flowStatusEnum = pgEnum('flow_status', [
  'draft',
  'active',
  'inactive',
  'archived'
]);

/**
 * Execution status enum
 */
export const executionStatusEnum = pgEnum('execution_status', [
  'queued',
  'running',
  'processing',
  'completed',
  'failed',
  'cancelled'
]);

/**
 * Agents table - stores information about available agents
 */
export const agents = pgTable('agents', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 50 }).notNull(),
  description: text('description'),
  capabilities: json('capabilities').$type<string[]>().default([]).notNull(),
  status: varchar('status', { length: 50 }).default('inactive').notNull(),
  workspaceId: integer('workspace_id').references(() => workspaces.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

/**
 * A2A flows table - stores agent flow definitions
 */
export const a2aFlows = pgTable('a2a_flows', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description'),
  definition: json('definition').notNull().$type<any>(),
  status: varchar('status', { length: 50 }).default('draft').notNull(),
  workspaceId: integer('workspace_id').references(() => workspaces.id),
  createdBy: integer('created_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

/**
 * A2A executions table - stores flow execution records
 */
export const a2aExecutions = pgTable('a2a_executions', {
  id: serial('id').primaryKey(),
  flowId: integer('flow_id').references(() => a2aFlows.id).notNull(),
  status: varchar('status', { length: 50 }).default('queued').notNull(),
  startedAt: timestamp('started_at').notNull(),
  completedAt: timestamp('completed_at'),
  result: json('result').$type<any>(),
  error: text('error'),
  initiatedBy: integer('initiated_by').references(() => users.id),
  workspaceId: integer('workspace_id').references(() => workspaces.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull()
});

/**
 * Define relations
 */
export const agentsRelations = relations(agents, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [agents.workspaceId],
    references: [workspaces.id]
  })
}));

export const a2aFlowsRelations = relations(a2aFlows, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [a2aFlows.workspaceId],
    references: [workspaces.id]
  }),
  creator: one(users, {
    fields: [a2aFlows.createdBy],
    references: [users.id]
  }),
  executions: many(a2aExecutions)
}));

export const a2aExecutionsRelations = relations(a2aExecutions, ({ one }) => ({
  flow: one(a2aFlows, {
    fields: [a2aExecutions.flowId],
    references: [a2aFlows.id]
  }),
  initiator: one(users, {
    fields: [a2aExecutions.initiatedBy],
    references: [users.id]
  }),
  workspace: one(workspaces, {
    fields: [a2aExecutions.workspaceId],
    references: [workspaces.id]
  })
}));

/**
 * Create Zod schemas for validation
 */
export const insertAgentSchema = createInsertSchema(agents, {
  name: (schema) => schema.min(3, "Agent name must be at least 3 characters"),
  type: (schema) => schema.min(1, "Agent type is required"),
  capabilities: (schema) => schema.optional().default([])
});

export const selectAgentSchema = createSelectSchema(agents);

export const insertA2AFlowSchema = createInsertSchema(a2aFlows, {
  name: (schema) => schema.min(3, "Flow name must be at least 3 characters"),
  definition: (schema) => schema.refine(
    (data) => data && typeof data === 'object',
    "Flow definition must be an object"
  )
});

export const selectA2AFlowSchema = createSelectSchema(a2aFlows);

export const insertA2AExecutionSchema = createInsertSchema(a2aExecutions, {
  flowId: (schema) => schema.positive("Flow ID must be a positive number"),
  startedAt: (schema) => schema.optional().default(new Date())
});

export const selectA2AExecutionSchema = createSelectSchema(a2aExecutions);

/**
 * Export TypeScript types
 */
export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;

export type A2AFlow = typeof a2aFlows.$inferSelect;
export type InsertA2AFlow = z.infer<typeof insertA2AFlowSchema>;

export type A2AExecution = typeof a2aExecutions.$inferSelect;
export type InsertA2AExecution = z.infer<typeof insertA2AExecutionSchema>;