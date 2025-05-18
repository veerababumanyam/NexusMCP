import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { unique } from "drizzle-orm/pg-core";
import { users, workspaces, mcpServers } from "./schema";

// Policy Tables for OPA-based Policy Management
export const policies = pgTable("policies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  version: integer("version").notNull().default(1),
  policyType: text("policy_type").notNull(), // 'rego', 'json', 'yaml'
  content: text("content").notNull(), // The actual policy code
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  status: text("status").default("draft").notNull(), // 'draft', 'published', 'archived', 'deprecated'
  isSystem: boolean("is_system").default(false), // System policies cannot be modified
  appliesTo: jsonb("applies_to"), // Resource types this policy applies to
  tags: jsonb("tags"), // Array of tags for categorization
  requiresApproval: boolean("requires_approval").default(false), // Whether changes require approval
  lastEvaluatedAt: timestamp("last_evaluated_at"),
  createdBy: integer("created_by").references(() => users.id),
  approvedBy: integer("approved_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  publishedAt: timestamp("published_at")
}, (table) => {
  return {
    nameWorkspaceVersionIdx: unique().on(table.name, table.workspaceId || "null", table.version)
  };
});

// Policy Versions for versioning history
export const policyVersions = pgTable("policy_versions", {
  id: serial("id").primaryKey(),
  policyId: integer("policy_id").references(() => policies.id).notNull(),
  version: integer("version").notNull(),
  content: text("content").notNull(),
  description: text("description"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  diffSummary: text("diff_summary") // Summary of changes from previous version
}, (table) => {
  return {
    policyVersionIdx: unique().on(table.policyId, table.version)
  };
});

// Policy Approval Requests
export const policyApprovalRequests = pgTable("policy_approval_requests", {
  id: serial("id").primaryKey(),
  policyId: integer("policy_id").references(() => policies.id).notNull(),
  requestedBy: integer("requested_by").references(() => users.id).notNull(),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  status: text("status").default("pending").notNull(), // 'pending', 'approved', 'rejected'
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectedBy: integer("rejected_by").references(() => users.id),
  rejectedAt: timestamp("rejected_at"),
  rejectionReason: text("rejection_reason"),
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  comments: text("comments")
});

// Policy Approval Workflow for multi-level approvals
export const policyApprovalWorkflow = pgTable("policy_approval_workflow", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  steps: jsonb("steps").notNull(), // Array of approval steps with roles/users
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Policy Evaluation Logs
export const policyEvaluationLogs = pgTable("policy_evaluation_logs", {
  id: serial("id").primaryKey(),
  policyId: integer("policy_id").references(() => policies.id),
  userId: integer("user_id").references(() => users.id),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  action: text("action").notNull(),
  decision: text("decision").notNull(), // 'allow', 'deny'
  decisionReason: text("decision_reason"),
  requestContext: jsonb("request_context"), // The context of the request
  evaluationTime: integer("evaluation_time"), // Time in ms for evaluation
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  serverId: integer("server_id").references(() => mcpServers.id),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Policy Templates
export const policyTemplates = pgTable("policy_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  content: text("content").notNull(),
  policyType: text("policy_type").notNull(), // 'rego', 'json', 'yaml'
  category: text("category").notNull(),
  tags: jsonb("tags"),
  createdBy: integer("created_by").references(() => users.id),
  isPublic: boolean("is_public").default(true), // Whether template is available to all workspaces
  workspaceId: integer("workspace_id").references(() => workspaces.id), // For workspace-specific templates
  variables: jsonb("variables"), // Variables that can be replaced when using template
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Create Zod Schemas for policies
export const insertPolicySchema = createInsertSchema(policies, {
  name: (schema) => schema.min(2, "Name must be at least 2 characters"),
  policyType: (schema) => schema.refine(
    (val) => ["rego", "json", "yaml"].includes(val),
    "Policy type must be one of: rego, json, yaml"
  ),
  status: (schema) => schema.refine(
    (val) => ["draft", "published", "archived", "deprecated"].includes(val),
    "Status must be one of: draft, published, archived, deprecated"
  )
}).omit({ id: true, createdAt: true, updatedAt: true, publishedAt: true, lastEvaluatedAt: true });

export type InsertPolicy = z.infer<typeof insertPolicySchema>;
export const selectPolicySchema = createSelectSchema(policies);
export type Policy = z.infer<typeof selectPolicySchema>;

export const insertPolicyVersionSchema = createInsertSchema(policyVersions, {
  content: (schema) => schema.min(1, "Content cannot be empty")
}).omit({ id: true, createdAt: true });

export type InsertPolicyVersion = z.infer<typeof insertPolicyVersionSchema>;
export const selectPolicyVersionSchema = createSelectSchema(policyVersions);
export type PolicyVersion = z.infer<typeof selectPolicyVersionSchema>;

export const insertPolicyTemplateSchema = createInsertSchema(policyTemplates, {
  name: (schema) => schema.min(2, "Name must be at least 2 characters"),
  content: (schema) => schema.min(1, "Content cannot be empty"),
  policyType: (schema) => schema.refine(
    (val) => ["rego", "json", "yaml"].includes(val),
    "Policy type must be one of: rego, json, yaml"
  ),
  category: (schema) => schema.min(2, "Category must be at least 2 characters")
}).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertPolicyTemplate = z.infer<typeof insertPolicyTemplateSchema>;
export const selectPolicyTemplateSchema = createSelectSchema(policyTemplates);
export type PolicyTemplate = z.infer<typeof selectPolicyTemplateSchema>;