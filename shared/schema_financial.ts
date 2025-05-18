/**
 * Financial Services Schema Extension
 * 
 * This schema defines tables and relationships for financial services functionality:
 * - Financial data feeds and sources
 * - Regulatory compliance (SEC, FINRA, MiFID II)
 * - Financial role-based access control
 * - Financial audit trails and anomaly detection
 * - LLM output validation for regulatory compliance
 */

import { pgTable, text, serial, integer, boolean, timestamp, jsonb, uuid, unique, date, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { z } from "zod";
import { users, workspaces } from "./schema";

// Financial Data Sources - Track external financial data providers
export const financialDataSources = pgTable("financial_data_sources", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  provider: text("provider").notNull(), // Bloomberg, Reuters, S&P, Moody's, etc.
  sourceType: text("source_type").notNull(), // market_data, pricing, news, filings, ratings, etc.
  connectionDetails: jsonb("connection_details"), // API endpoints, auth methods, etc.
  status: text("status").default("inactive").notNull(),
  refreshFrequency: text("refresh_frequency"), // real-time, daily, hourly, etc.
  refreshSchedule: jsonb("refresh_schedule"), // Cron expression or schedule details
  dataFormat: text("data_format"), // JSON, XML, CSV, etc.
  requiresAuthentication: boolean("requires_authentication").default(true),
  authMethod: text("auth_method"), // API key, OAuth, etc.
  credentials: jsonb("credentials"), // encrypted credentials
  validatedAt: timestamp("validated_at"),
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Financial Data Feed Access Permissions - Control client-specific data access
export const financialDataPermissions = pgTable("financial_data_permissions", {
  id: serial("id").primaryKey(),
  sourceId: integer("source_id").references(() => financialDataSources.id).notNull(),
  userId: integer("user_id").references(() => users.id),
  roleId: integer("role_id"), // References roles table
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  permissionLevel: text("permission_level").notNull(), // read, write, admin
  dataFilters: jsonb("data_filters"), // Field-level filters for data segregation
  accessRestrictions: jsonb("access_restrictions"), // Time-based, geo-based, etc.
  dataClassification: text("data_classification"), // public, confidential, restricted
  auditRequirement: text("audit_requirement"), // none, log-access, full-capture
  expiresAt: timestamp("expires_at"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Financial Instruments - Reference data for financial instruments
export const financialInstruments = pgTable("financial_instruments", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // equity, bond, option, future, etc.
  exchange: text("exchange"),
  currency: text("currency"),
  isin: text("isin"), // International Securities Identification Number
  cusip: text("cusip"), // Committee on Uniform Security Identification Procedures
  sedol: text("sedol"), // Stock Exchange Daily Official List
  bloomberg: text("bloomberg"), // Bloomberg Identifier
  reuters: text("reuters"), // Reuters Instrument Code
  isActive: boolean("is_active").default(true),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Regulatory Frameworks for SEC, FINRA, MiFID II compliance
export const regulatoryFrameworks = pgTable("regulatory_frameworks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(), // SEC, FINRA, MiFID-II, etc.
  description: text("description"),
  version: text("version"),
  jurisdiction: text("jurisdiction"), // US, EU, UK, Global, etc.
  category: text("category"), // securities, banking, insurance, etc.
  effectiveDate: date("effective_date"),
  documentationUrl: text("documentation_url"),
  status: text("status").default("active").notNull(),
  isDefault: boolean("is_default").default(false),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Regulatory Rules - Specific rules within regulatory frameworks
export const regulatoryRules = pgTable("regulatory_rules", {
  id: serial("id").primaryKey(),
  frameworkId: integer("framework_id").references(() => regulatoryFrameworks.id).notNull(),
  ruleId: text("rule_id").notNull(), // Rule identifier within the framework (e.g., "10b-5")
  title: text("title").notNull(),
  description: text("description"),
  ruleText: text("rule_text"), // The actual text of the rule
  category: text("category"), // disclosure, trading, reporting, etc.
  severity: text("severity").default("medium"), // high, medium, low
  validationLogic: jsonb("validation_logic"), // Logic for validating compliance
  examples: jsonb("examples"), // Examples of compliant and non-compliant scenarios
  remediation: text("remediation"), // Suggested remediation steps
  status: text("status").default("active").notNull(),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// LLM Regulatory Validators - Validate LLM outputs against regulations
export const llmRegulationValidators = pgTable("llm_regulation_validators", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  frameworkIds: jsonb("framework_ids"), // Array of regulatory framework IDs
  validatorType: text("validator_type").notNull(), // prompt_injection, regex, semantic, etc.
  validationLogic: jsonb("validation_logic").notNull(), // Rules, patterns, thresholds, etc.
  blockSeverity: text("block_severity"), // minimum severity to block responses: none, low, medium, high, critical
  flagSeverity: text("flag_severity"), // minimum severity to flag responses: none, low, medium, high, critical
  isEnabled: boolean("is_enabled").default(true),
  isSystem: boolean("is_system").default(false),
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// LLM Regulatory Validation Results - Store validation results for audit
export const llmValidationResults = pgTable("llm_validation_results", {
  id: serial("id").primaryKey(),
  validatorId: integer("validator_id").references(() => llmRegulationValidators.id).notNull(),
  sessionId: text("session_id"), // User session ID
  requestId: text("request_id"), // Unique ID for the request
  inputText: text("input_text"), // User input
  outputText: text("output_text"), // LLM response
  validationPassed: boolean("validation_passed").notNull(),
  severity: text("severity"), // none, low, medium, high, critical
  ruleMatches: jsonb("rule_matches"), // Array of matched rule IDs
  actionTaken: text("action_taken"), // none, flagged, modified, blocked
  modifiedOutput: text("modified_output"), // Modified output if changed
  userId: integer("user_id").references(() => users.id),
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  mcpServerId: integer("mcp_server_id"), // Reference to MCP server
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  metadata: jsonb("metadata")
});

// Financial Access Roles - Specialized roles for financial users
export const financialRoles = pgTable("financial_roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull(), // ANALYST, ADVISOR, TRADER, COMPLIANCE, etc.
  description: text("description"),
  baseRoleId: integer("base_role_id"), // Reference to standard roles table if extending
  permissions: jsonb("permissions"), // Financial-specific permissions
  dataScopeRestrictions: jsonb("data_scope_restrictions"), // Limits on viewable data
  tradingLimits: jsonb("trading_limits"), // Limits on trading capabilities
  approvalRequirements: jsonb("approval_requirements"), // Actions requiring approval
  regulatoryFrameworks: jsonb("regulatory_frameworks"), // Applicable regulations
  isSystem: boolean("is_system").default(false),
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Financial User Assignments - Map users to financial roles
export const financialUserRoles = pgTable("financial_user_roles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  roleId: integer("role_id").references(() => financialRoles.id).notNull(),
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  certifications: jsonb("certifications"), // User certifications for this role
  restrictions: jsonb("restrictions"), // User-specific restrictions
  expiresAt: timestamp("expires_at"),
  assignedBy: integer("assigned_by").references(() => users.id),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
  revokedBy: integer("revoked_by").references(() => users.id),
  status: text("status").default("active").notNull()
});

// Financial Transactions - Record financial transactions for audit
export const financialTransactions = pgTable("financial_transactions", {
  id: serial("id").primaryKey(),
  transactionId: uuid("transaction_id").defaultRandom().notNull().unique(),
  type: text("type").notNull(), // trade, transfer, withdrawal, deposit, etc.
  instrumentId: integer("instrument_id").references(() => financialInstruments.id),
  quantity: decimal("quantity", { precision: 18, scale: 8 }),
  price: decimal("price", { precision: 18, scale: 8 }),
  currency: text("currency"),
  amount: decimal("amount", { precision: 18, scale: 8 }),
  direction: text("direction"), // buy, sell, in, out, etc.
  status: text("status").notNull(), // pending, completed, rejected, etc.
  executedAt: timestamp("executed_at"),
  settledAt: timestamp("settled_at"),
  counterparty: text("counterparty"),
  notes: text("notes"),
  metadata: jsonb("metadata"),
  requestedBy: integer("requested_by").references(() => users.id),
  approvedBy: integer("approved_by").references(() => users.id),
  executedBy: integer("executed_by").references(() => users.id),
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Financial Anomaly Rules - Define rules for detecting anomalies
export const financialAnomalyRules = pgTable("financial_anomaly_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  ruleType: text("rule_type").notNull(), // pattern, threshold, ml, etc.
  ruleLogic: jsonb("rule_logic").notNull(), // Conditions for triggering
  severity: text("severity").default("medium").notNull(), // low, medium, high, critical
  category: text("category").notNull(), // suspicious_activity, fraud, operational_risk, etc.
  detectionPhase: text("detection_phase"), // pre-execution, post-execution, etc.
  notificationTargets: jsonb("notification_targets"), // Who to notify
  isEnabled: boolean("is_enabled").default(true),
  isSystem: boolean("is_system").default(false),
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Financial Anomaly Detections - Record detected anomalies
export const financialAnomalyDetections = pgTable("financial_anomaly_detections", {
  id: serial("id").primaryKey(),
  ruleId: integer("rule_id").references(() => financialAnomalyRules.id).notNull(),
  transactionId: uuid("transaction_id").references(() => financialTransactions.transactionId),
  sessionId: text("session_id"),
  userId: integer("user_id").references(() => users.id),
  severity: text("severity").notNull(),
  status: text("status").default("new").notNull(), // new, investigating, resolved, false_positive
  description: text("description").notNull(),
  evidenceData: jsonb("evidence_data"), // Data that triggered the anomaly
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
  assignedTo: integer("assigned_to").references(() => users.id),
  resolvedBy: integer("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  resolutionNotes: text("resolution_notes"),
  workspaceId: integer("workspace_id").references(() => workspaces.id)
});

// Financial Audit Traceability - Track data points used in decisions
export const financialAuditTraces = pgTable("financial_audit_traces", {
  id: serial("id").primaryKey(),
  traceId: uuid("trace_id").defaultRandom().notNull().unique(),
  sessionId: text("session_id"),
  requestId: text("request_id"),
  userId: integer("user_id").references(() => users.id),
  transactionId: uuid("transaction_id").references(() => financialTransactions.transactionId),
  sourceDataPoints: jsonb("source_data_points"), // Data points used in decision
  reasoning: text("reasoning"), // Explanation of decision
  outcome: text("outcome"), // Result of the decision
  evidenceReferences: jsonb("evidence_references"), // Links to supporting evidence
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  metadata: jsonb("metadata")
});

// Define relations

export const financialDataSourcesRelations = relations(financialDataSources, ({ many, one }) => ({
  permissions: many(financialDataPermissions),
  workspace: one(workspaces, { fields: [financialDataSources.workspaceId], references: [workspaces.id] }),
  creator: one(users, { fields: [financialDataSources.createdBy], references: [users.id] })
}));

export const financialDataPermissionsRelations = relations(financialDataPermissions, ({ one }) => ({
  source: one(financialDataSources, { fields: [financialDataPermissions.sourceId], references: [financialDataSources.id] }),
  user: one(users, { fields: [financialDataPermissions.userId], references: [users.id] }),
  workspace: one(workspaces, { fields: [financialDataPermissions.workspaceId], references: [workspaces.id] }),
  creator: one(users, { fields: [financialDataPermissions.createdBy], references: [users.id] })
}));

export const regulatoryFrameworksRelations = relations(regulatoryFrameworks, ({ many }) => ({
  rules: many(regulatoryRules)
}));

export const regulatoryRulesRelations = relations(regulatoryRules, ({ one }) => ({
  framework: one(regulatoryFrameworks, { fields: [regulatoryRules.frameworkId], references: [regulatoryFrameworks.id] })
}));

export const llmRegulationValidatorsRelations = relations(llmRegulationValidators, ({ many, one }) => ({
  validationResults: many(llmValidationResults),
  workspace: one(workspaces, { fields: [llmRegulationValidators.workspaceId], references: [workspaces.id] }),
  creator: one(users, { fields: [llmRegulationValidators.createdBy], references: [users.id] })
}));

export const llmValidationResultsRelations = relations(llmValidationResults, ({ one }) => ({
  validator: one(llmRegulationValidators, { fields: [llmValidationResults.validatorId], references: [llmRegulationValidators.id] }),
  user: one(users, { fields: [llmValidationResults.userId], references: [users.id] }),
  workspace: one(workspaces, { fields: [llmValidationResults.workspaceId], references: [workspaces.id] })
}));

export const financialRolesRelations = relations(financialRoles, ({ many, one }) => ({
  userAssignments: many(financialUserRoles),
  workspace: one(workspaces, { fields: [financialRoles.workspaceId], references: [workspaces.id] })
}));

export const financialUserRolesRelations = relations(financialUserRoles, ({ one }) => ({
  user: one(users, { fields: [financialUserRoles.userId], references: [users.id] }),
  role: one(financialRoles, { fields: [financialUserRoles.roleId], references: [financialRoles.id] }),
  workspace: one(workspaces, { fields: [financialUserRoles.workspaceId], references: [workspaces.id] }),
  assigner: one(users, { fields: [financialUserRoles.assignedBy], references: [users.id] }),
  revoker: one(users, { fields: [financialUserRoles.revokedBy], references: [users.id] })
}));

export const financialTransactionsRelations = relations(financialTransactions, ({ one, many }) => ({
  instrument: one(financialInstruments, { fields: [financialTransactions.instrumentId], references: [financialInstruments.id] }),
  requester: one(users, { fields: [financialTransactions.requestedBy], references: [users.id] }),
  approver: one(users, { fields: [financialTransactions.approvedBy], references: [users.id] }),
  executor: one(users, { fields: [financialTransactions.executedBy], references: [users.id] }),
  workspace: one(workspaces, { fields: [financialTransactions.workspaceId], references: [workspaces.id] }),
  anomalyDetections: many(financialAnomalyDetections),
  auditTraces: many(financialAuditTraces)
}));

export const financialAnomalyRulesRelations = relations(financialAnomalyRules, ({ many, one }) => ({
  detections: many(financialAnomalyDetections),
  workspace: one(workspaces, { fields: [financialAnomalyRules.workspaceId], references: [workspaces.id] }),
  creator: one(users, { fields: [financialAnomalyRules.createdBy], references: [users.id] })
}));

export const financialAnomalyDetectionsRelations = relations(financialAnomalyDetections, ({ one }) => ({
  rule: one(financialAnomalyRules, { fields: [financialAnomalyDetections.ruleId], references: [financialAnomalyRules.id] }),
  transaction: one(financialTransactions, { fields: [financialAnomalyDetections.transactionId], references: [financialTransactions.transactionId] }),
  user: one(users, { fields: [financialAnomalyDetections.userId], references: [users.id] }),
  assignee: one(users, { fields: [financialAnomalyDetections.assignedTo], references: [users.id] }),
  resolver: one(users, { fields: [financialAnomalyDetections.resolvedBy], references: [users.id] }),
  workspace: one(workspaces, { fields: [financialAnomalyDetections.workspaceId], references: [workspaces.id] })
}));

export const financialAuditTracesRelations = relations(financialAuditTraces, ({ one }) => ({
  user: one(users, { fields: [financialAuditTraces.userId], references: [users.id] }),
  transaction: one(financialTransactions, { fields: [financialAuditTraces.transactionId], references: [financialTransactions.transactionId] }),
  workspace: one(workspaces, { fields: [financialAuditTraces.workspaceId], references: [workspaces.id] })
}));

// Create Zod schemas
export const insertFinancialDataSourceSchema = createInsertSchema(financialDataSources, {
  name: (schema) => schema.min(2, "Name must be at least 2 characters"),
  provider: (schema) => schema.min(2, "Provider must be at least 2 characters")
});
export type InsertFinancialDataSource = z.infer<typeof insertFinancialDataSourceSchema>;
export const selectFinancialDataSourceSchema = createSelectSchema(financialDataSources);
export type FinancialDataSource = z.infer<typeof selectFinancialDataSourceSchema>;

export const insertFinancialDataPermissionSchema = createInsertSchema(financialDataPermissions);
export type InsertFinancialDataPermission = z.infer<typeof insertFinancialDataPermissionSchema>;
export const selectFinancialDataPermissionSchema = createSelectSchema(financialDataPermissions);
export type FinancialDataPermission = z.infer<typeof selectFinancialDataPermissionSchema>;

export const insertFinancialInstrumentSchema = createInsertSchema(financialInstruments, {
  symbol: (schema) => schema.min(1, "Symbol is required"),
  name: (schema) => schema.min(2, "Name must be at least 2 characters"),
  type: (schema) => schema.min(2, "Type must be at least 2 characters")
});
export type InsertFinancialInstrument = z.infer<typeof insertFinancialInstrumentSchema>;
export const selectFinancialInstrumentSchema = createSelectSchema(financialInstruments);
export type FinancialInstrument = z.infer<typeof selectFinancialInstrumentSchema>;

export const insertRegulatoryFrameworkSchema = createInsertSchema(regulatoryFrameworks, {
  name: (schema) => schema.min(2, "Name must be at least 2 characters"),
  code: (schema) => schema.min(2, "Code must be at least 2 characters")
});
export type InsertRegulatoryFramework = z.infer<typeof insertRegulatoryFrameworkSchema>;
export const selectRegulatoryFrameworkSchema = createSelectSchema(regulatoryFrameworks);
export type RegulatoryFramework = z.infer<typeof selectRegulatoryFrameworkSchema>;

export const insertRegulatoryRuleSchema = createInsertSchema(regulatoryRules, {
  ruleId: (schema) => schema.min(1, "Rule ID is required"),
  title: (schema) => schema.min(2, "Title must be at least 2 characters")
});
export type InsertRegulatoryRule = z.infer<typeof insertRegulatoryRuleSchema>;
export const selectRegulatoryRuleSchema = createSelectSchema(regulatoryRules);
export type RegulatoryRule = z.infer<typeof selectRegulatoryRuleSchema>;

export const insertLLMRegulationValidatorSchema = createInsertSchema(llmRegulationValidators, {
  name: (schema) => schema.min(2, "Name must be at least 2 characters")
});
export type InsertLLMRegulationValidator = z.infer<typeof insertLLMRegulationValidatorSchema>;
export const selectLLMRegulationValidatorSchema = createSelectSchema(llmRegulationValidators);
export type LLMRegulationValidator = z.infer<typeof selectLLMRegulationValidatorSchema>;

export const insertLLMValidationResultSchema = createInsertSchema(llmValidationResults);
export type InsertLLMValidationResult = z.infer<typeof insertLLMValidationResultSchema>;
export const selectLLMValidationResultSchema = createSelectSchema(llmValidationResults);
export type LLMValidationResult = z.infer<typeof selectLLMValidationResultSchema>;

export const insertFinancialRoleSchema = createInsertSchema(financialRoles, {
  name: (schema) => schema.min(2, "Name must be at least 2 characters"),
  code: (schema) => schema.min(2, "Code must be at least 2 characters")
});
export type InsertFinancialRole = z.infer<typeof insertFinancialRoleSchema>;
export const selectFinancialRoleSchema = createSelectSchema(financialRoles);
export type FinancialRole = z.infer<typeof selectFinancialRoleSchema>;

export const insertFinancialUserRoleSchema = createInsertSchema(financialUserRoles);
export type InsertFinancialUserRole = z.infer<typeof insertFinancialUserRoleSchema>;
export const selectFinancialUserRoleSchema = createSelectSchema(financialUserRoles);
export type FinancialUserRole = z.infer<typeof selectFinancialUserRoleSchema>;

export const insertFinancialTransactionSchema = createInsertSchema(financialTransactions, {
  type: (schema) => schema.min(2, "Type must be at least 2 characters")
});
export type InsertFinancialTransaction = z.infer<typeof insertFinancialTransactionSchema>;
export const selectFinancialTransactionSchema = createSelectSchema(financialTransactions);
export type FinancialTransaction = z.infer<typeof selectFinancialTransactionSchema>;

export const insertFinancialAnomalyRuleSchema = createInsertSchema(financialAnomalyRules, {
  name: (schema) => schema.min(2, "Name must be at least 2 characters"),
  category: (schema) => schema.min(2, "Category must be at least 2 characters")
});
export type InsertFinancialAnomalyRule = z.infer<typeof insertFinancialAnomalyRuleSchema>;
export const selectFinancialAnomalyRuleSchema = createSelectSchema(financialAnomalyRules);
export type FinancialAnomalyRule = z.infer<typeof selectFinancialAnomalyRuleSchema>;

export const insertFinancialAnomalyDetectionSchema = createInsertSchema(financialAnomalyDetections, {
  description: (schema) => schema.min(2, "Description must be at least 2 characters")
});
export type InsertFinancialAnomalyDetection = z.infer<typeof insertFinancialAnomalyDetectionSchema>;
export const selectFinancialAnomalyDetectionSchema = createSelectSchema(financialAnomalyDetections);
export type FinancialAnomalyDetection = z.infer<typeof selectFinancialAnomalyDetectionSchema>;

export const insertFinancialAuditTraceSchema = createInsertSchema(financialAuditTraces);
export type InsertFinancialAuditTrace = z.infer<typeof insertFinancialAuditTraceSchema>;
export const selectFinancialAuditTraceSchema = createSelectSchema(financialAuditTraces);
export type FinancialAuditTrace = z.infer<typeof selectFinancialAuditTraceSchema>;