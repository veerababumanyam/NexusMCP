import { pgTable, text, serial, integer, boolean, timestamp, jsonb, uuid, unique, foreignKey } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Import enhanced audit schema
import * as auditSchema from './schema_audit';
// Import collaboration schema
import * as collaborationSchema from './schema_collaboration';
// Import A2A schema for Agent-to-Agent orchestration
import * as a2aSchema from './schema_a2a';
// Import System Configuration schema
import * as systemConfigSchema from './schema_system_config';
// Import System Branding schema
import * as systemBrandingSchema from './schema_system_config';
// Import Marketplace schema
import * as marketplaceSchema from './schema_marketplace';
// Import Financial Services schema
import * as financialSchema from './schema_financial';
// Import Geo-Redundancy schema
import * as geoRedundancySchema from './schema_geo_redundancy';
// Import Directory Services schema for LDAP/AD integration
// Import Healthcare schema
import * as healthcareSchema from './schema_healthcare';
// Import MCP Schema
import * as mcpSchema from './schema_mcp';
import * as directorySchema from './schema_directory';
// Import UI Personalization schema
import * as uiPersonalizationSchema from './schema_ui_personalization';
// Import Connection Settings schema
import * as connectionSchema from './schema_connection';
// Import JWT Settings schema
import * as jwtSchema from './schema_jwt';

// Auth Providers Table
export const authProviders = pgTable("auth_providers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  type: text("type").notNull(), // local, ldap, saml, oidc, oauth2, google, microsoft, github, facebook, etc.
  clientId: text("client_id"), // OAuth/OIDC client ID
  clientSecret: text("client_secret"), // OAuth/OIDC client secret
  authorizationUrl: text("authorization_url"), // OAuth/OIDC authorization endpoint
  tokenUrl: text("token_url"), // OAuth/OIDC token endpoint
  userInfoUrl: text("user_info_url"), // OAuth/OIDC userinfo endpoint
  scope: text("scope"), // Default scopes for this provider
  callbackUrl: text("callback_url"), // OAuth callback URL
  issuer: text("issuer"), // OIDC issuer
  jwksUri: text("jwks_uri"), // OIDC jwks_uri for verifying tokens
  logoUrl: text("logo_url"), // URL to provider logo
  config: jsonb("config"), // Additional provider-specific configuration
  isEnabled: boolean("is_enabled").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Users Table with enhanced fields for auth
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  uuid: uuid("uuid").defaultRandom().notNull().unique(),
  username: text("username").notNull().unique(),
  password: text("password"), // can be null for SSO users
  fullName: text("full_name"),
  email: text("email").unique(),
  isActive: boolean("is_active").default(true).notNull(),
  isEmailVerified: boolean("is_email_verified").default(false),
  mfaEnabled: boolean("mfa_enabled").default(false),
  mfaSecret: text("mfa_secret"),
  preferredMfaMethod: text("preferred_mfa_method"), // totp, sms, email, etc.
  phoneNumber: text("phone_number"),
  avatarUrl: text("avatar_url"),
  lastLogin: timestamp("last_login"),
  failedLoginAttempts: integer("failed_login_attempts").default(0),
  lockedUntil: timestamp("locked_until"),
  passwordChangedAt: timestamp("password_changed_at"),
  metadata: jsonb("metadata"), // additional user metadata
  externalIds: jsonb("external_ids"), // ids from external systems
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// User Identities (for SSO and external identity providers)
export const userIdentities = pgTable("user_identities", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  providerId: integer("provider_id").references(() => authProviders.id).notNull(),
  externalId: text("external_id").notNull(), // ID in the external system
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  tokenExpiresAt: timestamp("token_expires_at"),
  profileData: jsonb("profile_data"), // profile data from provider
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    userProviderIdx: unique().on(table.userId, table.providerId),
    providerExternalIdIdx: unique().on(table.providerId, table.externalId)
  };
});

// Workspaces Table (also serves as tenants/organizations)
export const workspaces = pgTable("workspaces", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  status: text("status").default("active").notNull(),
  // Workspace isolation settings
  isolationLevel: text("isolation_level").default("standard").notNull(), // standard, high, maximum
  isPrivate: boolean("is_private").default(false).notNull(), // Whether workspace is only visible to members
  // Custom domain for this workspace/tenant
  customDomain: text("custom_domain").unique(),
  // Branding
  logoUrl: text("logo_url"),
  logoSquareUrl: text("logo_square_url"),
  favicon: text("favicon"),
  primaryColor: text("primary_color"),
  secondaryColor: text("secondary_color"),
  accentColor: text("accent_color"),
  loginBackgroundUrl: text("login_background_url"),
  footerText: text("footer_text"),
  welcomeMessage: text("welcome_message"),
  // Contact info
  contactEmail: text("contact_email"),
  supportEmail: text("support_email"),
  // Advanced settings
  allowAutoProvisioning: boolean("allow_auto_provisioning").default(false),
  allowExternalUsers: boolean("allow_external_users").default(false),
  enforceIpRestrictions: boolean("enforce_ip_restrictions").default(false),
  enforceContextualMfa: boolean("enforce_contextual_mfa").default(false),
  dataEncryptionEnabled: boolean("data_encryption_enabled").default(false),
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// MCP Servers Table
export const mcpServers = pgTable("mcp_servers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  apiKey: text("api_key"),
  status: text("status").default("inactive").notNull(),
  version: text("version"),
  type: text("type").default("primary").notNull(),
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  config: jsonb("config"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastSync: timestamp("last_sync")
});

// Tools Table
export const tools = pgTable("tools", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  serverId: integer("server_id").references(() => mcpServers.id).notNull(),
  status: text("status").default("active").notNull(),
  toolType: text("tool_type"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Audit Logs Table
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  // Note: chain_id doesn't exist in the DB yet, will be added by migration
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  details: jsonb("details"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Define relations for auditLogs
export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id]
  })
  // chain relation will be added after migration adds the column
  // chain: one(auditChain, {
  //   fields: [auditLogs.chainId],
  //   references: [auditChain.id]
  // })
}));

// Audit Chain for blockchain-based tamper-evident storage
export const auditChain = pgTable("audit_chain", {
  id: serial("id").primaryKey(),
  sequenceId: integer("sequence_id").notNull().unique(),
  previousHash: text("previous_hash").notNull(),
  eventsHash: text("events_hash").notNull(),
  nonce: integer("nonce").notNull(),
  difficulty: integer("difficulty").notNull().default(2),
  signature: text("signature"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Define relations for auditChain
export const auditChainRelations = relations(auditChain, ({ many }) => ({
  logs: many(auditLogs)
}));

// Policies Table - for centralized policy management
export const policies = pgTable("policies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  type: text("policy_type").notNull(), // authorization, data_governance, compliance, security, system
  description: text("description"),
  enabled: boolean("status").default(true).notNull(), // this is called 'status' in the DB
  version: integer("version").default(1),
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  isSystem: boolean("is_system").default(false),
  content: text("content"),
  requiresApproval: boolean("requires_approval").default(false),
  appliesTo: jsonb("applies_to"),
  tags: jsonb("tags"),
  lastEvaluatedAt: timestamp("last_evaluated_at"),
  createdBy: integer("created_by").references(() => users.id),
  approvedBy: integer("approved_by").references(() => users.id),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Policy Versions Table - for policy versioning
export const policyVersions = pgTable("policy_versions", {
  id: serial("id").primaryKey(),
  policyId: integer("policy_id").references(() => policies.id).notNull(),
  versionNumber: integer("version").notNull(),
  policyCode: text("content").notNull(),
  changelog: text("diff_summary"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => users.id),
  description: text("description"),
});

// Policy Assignments Table - for policy assignments to resources
export const policyAssignments = pgTable("policy_assignments", {
  id: serial("id").primaryKey(),
  policyId: integer("policy_id").references(() => policies.id).notNull(),
  resourceType: text("resource_type").notNull(), // workspace, user, role, etc.
  resourceId: integer("resource_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => users.id),
  expiresAt: timestamp("expires_at"),
});

// Define relations for policies
export const policiesRelations = relations(policies, ({ many }) => ({
  versions: many(policyVersions),
  assignments: many(policyAssignments)
}));

// Define relations for policyVersions
export const policyVersionsRelations = relations(policyVersions, ({ one }) => ({
  policy: one(policies, {
    fields: [policyVersions.policyId],
    references: [policies.id]
  }),
  creator: one(users, {
    fields: [policyVersions.createdBy],
    references: [users.id]
  })
}));

// Define relations for policyAssignments
export const policyAssignmentsRelations = relations(policyAssignments, ({ one }) => ({
  policy: one(policies, {
    fields: [policyAssignments.policyId],
    references: [policies.id]
  }),
  creator: one(users, {
    fields: [policyAssignments.createdBy],
    references: [users.id]
  })
}));

// Roles Table
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").default(false), // system roles cannot be modified
  workspaceId: integer("workspace_id").references(() => workspaces.id), // null for global roles
  permissions: jsonb("permissions"), // JSON array of permission strings
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    nameWorkspaceIdx: unique().on(table.name, table.workspaceId || "null")
  };
});

// User Roles Table (many-to-many)
export const userRoles = pgTable("user_roles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  roleId: integer("role_id").references(() => roles.id).notNull(),
  workspaceId: integer("workspace_id").references(() => workspaces.id), // scope role to workspace
  createdAt: timestamp("created_at").defaultNow().notNull(),
  assignedById: integer("assigned_by_id").references(() => users.id)
}, (table) => {
  return {
    userRoleWorkspaceIdx: unique().on(table.userId, table.roleId, table.workspaceId || "null")
  };
});

// Role Permissions Table (many-to-many)
export const rolePermissions = pgTable("role_permissions", {
  id: serial("id").primaryKey(),
  roleId: integer("role_id").references(() => roles.id).notNull(),
  permissionId: integer("permission_id").references(() => permissions.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => {
  return {
    rolePermissionIdx: unique().on(table.roleId, table.permissionId)
  };
});

// Permission Groups
export const permissionGroups = pgTable("permission_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Permissions
export const permissions = pgTable("permissions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  groupId: integer("group_id").references(() => permissionGroups.id),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Permission Sets for OAuth and RBAC/ABAC
export const permissionSets = pgTable("permission_sets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // auth, data, tool, system, admin
  permissions: jsonb("permissions").notNull().default([]), // Array of permission codes
  oauthScopes: jsonb("oauth_scopes").default([]), // Array of OAuth scope strings
  abacConditions: text("abac_conditions"), // ABAC policy expression
  attributes: jsonb("attributes").default({}), // Additional attributes for ABAC
  workspaceId: integer("workspace_id").references(() => workspaces.id), // Add workspace association
  isGlobal: boolean("is_global").default(false).notNull(), // Flag for cross-workspace availability
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// MFA Recovery Codes
export const mfaRecoveryCodes = pgTable("mfa_recovery_codes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  code: text("code").notNull(), // hashed code
  isUsed: boolean("is_used").default(false),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// FIDO2 Credentials
export const fido2Credentials = pgTable("fido2_credentials", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  credentialId: text("credential_id").notNull().unique(),
  publicKey: text("public_key").notNull(),
  counter: integer("counter").notNull(),
  deviceType: text("device_type"), // usb, ble, nfc, internal
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsed: timestamp("last_used")
});

// User Sessions for better session management
export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  sessionId: text("session_id").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastActive: timestamp("last_active")
});

// System Integrations Table - For ITSM, CI/CD, and other enterprise system connections
export const systemIntegrations = pgTable("system_integrations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // itsm, cicd, ticketing, monitoring, etc.
  status: text("status").default("inactive").notNull(),
  config: jsonb("config"), // connection details, authentication, etc.
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastSyncAt: timestamp("last_sync_at")
});

// API Keys for external access
export const apiKeys = pgTable("api_keys", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  key: text("key").notNull().unique(),
  hash: text("hash").notNull(), // store hashed version for security
  userId: integer("user_id").references(() => users.id).notNull(),
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  scopes: jsonb("scopes").notNull().default([]), // array of permission scopes
  expiresAt: timestamp("expires_at"),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull()
});

// Define relations for apiKeys
export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id]
  }),
  workspace: one(workspaces, {
    fields: [apiKeys.workspaceId],
    references: [workspaces.id]
  })
}));

// API Key schemas for validation
export const apiKeyInsertSchema = createInsertSchema(apiKeys, {
  name: (schema) => schema.min(3, "Name must be at least 3 characters"),
  scopes: (schema) => schema.array().min(1, "At least one scope is required"),
});

export const apiKeySelectSchema = createSelectSchema(apiKeys);

// Export types
export type ApiKey = z.infer<typeof apiKeySelectSchema>;
export type InsertApiKey = z.infer<typeof apiKeyInsertSchema>;

// Plugin Marketplace
export const plugins = pgTable("plugins", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  version: text("version").notNull(),
  author: text("author"),
  authorUrl: text("author_url"),
  license: text("license"),
  homepage: text("homepage"),
  repository: text("repository"),
  tags: jsonb("tags"), // Array of tags
  category: text("category").notNull(),
  installCount: integer("install_count").default(0),
  rating: integer("rating").default(0),
  status: text("status").default("pending").notNull(), // pending, approved, rejected, deprecated
  isVerified: boolean("is_verified").default(false),
  publishedAt: timestamp("published_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => users.id),
  mainFile: text("main_file").notNull(), // Entry point file
  config: jsonb("config"), // Plugin configuration schema
  permissions: jsonb("permissions"), // Required permissions
  resources: jsonb("resources") // Associated resources (docs, images, etc.)
});

// Plugin Versions - Track version history
export const pluginVersions = pgTable("plugin_versions", {
  id: serial("id").primaryKey(),
  pluginId: integer("plugin_id").references(() => plugins.id).notNull(),
  version: text("version").notNull(),
  changelog: text("changelog"),
  downloadUrl: text("download_url"),
  sha256: text("sha256"), // Integrity hash
  size: integer("size"), // Size in bytes
  releaseNotes: text("release_notes"),
  isLatest: boolean("is_latest").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  publishedAt: timestamp("published_at")
}, (table) => {
  return {
    pluginVersionIdx: unique().on(table.pluginId, table.version)
  };
});

// Plugin Installations - Track where plugins are installed
export const pluginInstallations = pgTable("plugin_installations", {
  id: serial("id").primaryKey(),
  pluginId: integer("plugin_id").references(() => plugins.id).notNull(),
  versionId: integer("version_id").references(() => pluginVersions.id).notNull(),
  workspaceId: integer("workspace_id").references(() => workspaces.id).notNull(),
  status: text("status").default("active").notNull(), // active, disabled, uninstalled
  config: jsonb("config"), // Instance configuration
  installedBy: integer("installed_by").references(() => users.id),
  installedAt: timestamp("installed_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at")
});

// IP Access Rules (for allowlisting/blocklisting)
export const ipAccessRules = pgTable("ip_access_rules", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  type: text("type").notNull(), // allow, deny
  ipValue: text("ip_value").notNull(), // Can be single IP, CIDR range, or country code
  valueType: text("value_type").notNull(), // ip, range, country
  description: text("description"),
  isActive: boolean("is_active").default(true),
  expiresAt: timestamp("expires_at"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    workspaceIpIdx: unique().on(table.workspaceId || "null", table.ipValue)
  };
});

// LDAP Directory Configuration
export const ldapDirectories = pgTable("ldap_directories", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id).notNull(),
  name: text("name").notNull(),
  host: text("host").notNull(),
  port: integer("port").notNull().default(389),
  bindDn: text("bind_dn").notNull(),
  bindCredential: text("bind_credential"), // Stored encrypted
  searchBase: text("search_base").notNull(),
  userDnPattern: text("user_dn_pattern"), // Pattern for binding directly
  useSsl: boolean("use_ssl").default(false),
  useTls: boolean("use_tls").default(true),
  connectionTimeout: integer("connection_timeout").default(5000),
  isActive: boolean("is_active").default(true),
  // Attribute mappings
  userIdAttribute: text("user_id_attribute").default("uid"),
  usernameAttribute: text("username_attribute").default("uid"),
  emailAttribute: text("email_attribute").default("mail"),
  fullNameAttribute: text("full_name_attribute").default("cn"),
  groupMemberAttribute: text("group_member_attribute").default("memberOf"),
  // Synchronization settings
  syncGroups: boolean("sync_groups").default(true),
  groupSearchBase: text("group_search_base"),
  groupObjectClass: text("group_object_class").default("groupOfNames"),
  groupNameAttribute: text("group_name_attribute").default("cn"),
  roleMapping: jsonb("role_mapping"), // JSON mapping of LDAP groups to internal roles
  lastSyncAt: timestamp("last_sync_at"),
  syncStatus: text("sync_status"),
  syncError: text("sync_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Workspace Members Table - for explicit workspace membership
export const workspaceMembers = pgTable("workspace_members", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  workspaceId: integer("workspace_id").references(() => workspaces.id).notNull(),
  status: text("status").default("active").notNull(), // active, invited, suspended
  invitedBy: integer("invited_by").references(() => users.id),
  invitedAt: timestamp("invited_at").defaultNow(),
  acceptedAt: timestamp("accepted_at"),
  expiresAt: timestamp("expires_at"), // For temporary memberships
  isDefault: boolean("is_default").default(false), // User's default workspace when logging in
  lastAccessed: timestamp("last_accessed"),
  metadata: jsonb("metadata"), // Additional membership metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    userWorkspaceIdx: unique().on(table.userId, table.workspaceId)
  };
});

// Workspace Policies Table - for workspace-specific configuration
export const workspacePolicies = pgTable("workspace_policies", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id).notNull(),
  // Access control policies
  allowPublicAccess: boolean("allow_public_access").default(false),
  allowGuestAccess: boolean("allow_guest_access").default(false),
  memberInvitePolicy: text("member_invite_policy").default("admin_only"), // admin_only, members_can_invite
  enforceRoleHierarchy: boolean("enforce_role_hierarchy").default(true),
  // Tool and service policies
  allowedToolScopes: jsonb("allowed_tool_scopes"), // Scopes allowed for this workspace
  restrictedTools: jsonb("restricted_tools"), // List of tool IDs that are restricted
  maxTools: integer("max_tools"), // Maximum number of tools allowed
  maxServers: integer("max_servers"), // Maximum number of servers allowed
  // Resource policies
  maxStorage: integer("max_storage"), // Storage quota in MB
  maxRequests: integer("max_requests"), // Request quota per hour
  costCenter: text("cost_center"), // For internal billing/chargeback
  // Security policies
  dataRetentionDays: integer("data_retention_days"), // How long to keep data
  auditLogRetentionDays: integer("audit_log_retention_days").default(90),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    workspaceIdx: unique().on(table.workspaceId)
  };
});

// Security Policies - configurable security settings per workspace
export const securityPolicies = pgTable("security_policies", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id),
  // Password policies
  passwordMinLength: integer("password_min_length").default(8),
  passwordRequireUppercase: boolean("password_require_uppercase").default(true),
  passwordRequireLowercase: boolean("password_require_lowercase").default(true),
  passwordRequireNumbers: boolean("password_require_numbers").default(true),
  passwordRequireSymbols: boolean("password_require_symbols").default(false),
  passwordExpiryDays: integer("password_expiry_days").default(90), // 0 means never expire
  passwordHistory: integer("password_history").default(3), // How many previous passwords to remember
  // Authentication policies
  maxLoginAttempts: integer("max_login_attempts").default(5),
  loginLockoutMinutes: integer("login_lockout_minutes").default(15),
  mfaRequired: boolean("mfa_required").default(false),
  mfaRememberDays: integer("mfa_remember_days").default(30),
  mfaAllowedMethods: jsonb("mfa_allowed_methods").default(['totp', 'webauthn']),
  // Session policies
  sessionTimeoutMinutes: integer("session_timeout_minutes").default(60),
  sessionMaxConcurrent: integer("session_max_concurrent").default(5), // 0 means unlimited
  // Contextual policies
  forceReauthHighRisk: boolean("force_reauth_high_risk").default(true),
  alertOnLocationChange: boolean("alert_on_location_change").default(true),
  alertOnNewDevice: boolean("alert_on_new_device").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Developer Portal Resources
export const developerResources = pgTable("developer_resources", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  content: text("content").notNull(),
  type: text("type").notNull(), // documentation, tutorial, guide, api, sdk
  category: text("category").notNull(),
  tags: jsonb("tags"), // Array of tags
  version: text("version").default("1.0.0").notNull(),
  author: integer("author").references(() => users.id),
  viewCount: integer("view_count").default(0),
  isPublished: boolean("is_published").default(false),
  publishedAt: timestamp("published_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});

// Workflow Builder Templates
export const workflowTemplates = pgTable("workflow_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  category: text("category").notNull(),
  template: jsonb("template").notNull(), // Workflow JSON definition
  isSystem: boolean("is_system").default(false),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// User Workflows - Workflow instances created by users
export const workflows = pgTable("workflows", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  definition: jsonb("definition").notNull(), // Workflow JSON definition
  status: text("status").default("draft").notNull(), // draft, active, inactive, archived
  workspaceId: integer("workspace_id").references(() => workspaces.id).notNull(),
  templateId: integer("template_id").references(() => workflowTemplates.id),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  lastRunAt: timestamp("last_run_at"),
  stats: jsonb("stats") // Execution statistics
});

// Workflow Runs - Track workflow executions
export const workflowRuns = pgTable("workflow_runs", {
  id: serial("id").primaryKey(),
  workflowId: integer("workflow_id").references(() => workflows.id).notNull(),
  status: text("status").notNull(), // queued, running, completed, failed, canceled
  startedAt: timestamp("started_at").defaultNow().notNull(),
  finishedAt: timestamp("finished_at"),
  result: jsonb("result"),
  error: text("error"),
  triggeredBy: integer("triggered_by").references(() => users.id),
  executionTime: integer("execution_time"), // in milliseconds
  nodes: jsonb("nodes") // Execution results for each node
});

// Localization - UI translations
export const localizations = pgTable("localizations", {
  id: serial("id").primaryKey(),
  locale: text("locale").notNull(), // e.g., en-US, es-ES, etc.
  namespace: text("namespace").notNull(), // e.g., common, errors, dashboard
  key: text("key").notNull(),
  value: text("value").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    localeKeyIdx: unique().on(table.locale, table.namespace, table.key)
  };
});

// User preferences (including language, accessibility, etc.)
export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  language: text("language").default("en-US").notNull(),
  theme: text("theme").default("system").notNull(), // light, dark, system
  timezone: text("timezone").default("UTC").notNull(),
  dateFormat: text("date_format").default("YYYY-MM-DD").notNull(),
  timeFormat: text("time_format").default("HH:mm:ss").notNull(),
  accessibility: jsonb("accessibility"), // Accessibility settings
  notifications: jsonb("notifications"), // Notification preferences
  dashboardLayout: jsonb("dashboard_layout"), // Saved dashboard configuration
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  auditLogs: many(auditLogs),
  identities: many(userIdentities),
  userRoles: many(userRoles),
  recoveryCodes: many(mfaRecoveryCodes),
  fido2Credentials: many(fido2Credentials),
  sessions: many(userSessions),
  // New relations for enterprise features
  apiKeys: many(apiKeys),
  createdPlugins: many(plugins, { relationName: "createdBy" }),
  developerResources: many(developerResources, { relationName: "author" }),
  createdWorkflowTemplates: many(workflowTemplates, { relationName: "createdBy" }),
  workflows: many(workflows, { relationName: "createdBy" }),
  workflowRuns: many(workflowRuns, { relationName: "triggeredBy" }),
  systemIntegrations: many(systemIntegrations, { relationName: "createdBy" }),
  pluginInstallations: many(pluginInstallations, { relationName: "installedBy" }),
  preferences: one(userPreferences, {
    fields: [users.id],
    references: [userPreferences.userId]
  })
}));

export const authProvidersRelations = relations(authProviders, ({ many }) => ({
  userIdentities: many(userIdentities)
}));

export const userIdentitiesRelations = relations(userIdentities, ({ one }) => ({
  user: one(users, {
    fields: [userIdentities.userId],
    references: [users.id]
  }),
  provider: one(authProviders, {
    fields: [userIdentities.providerId],
    references: [authProviders.id]
  })
}));

export const rolesRelations = relations(roles, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [roles.workspaceId],
    references: [workspaces.id]
  }),
  userRoles: many(userRoles),
  rolePermissions: many(rolePermissions)
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id]
  }),
  role: one(roles, {
    fields: [userRoles.roleId],
    references: [roles.id]
  }),
  workspace: one(workspaces, {
    fields: [userRoles.workspaceId],
    references: [workspaces.id]
  }),
  assignedBy: one(users, {
    fields: [userRoles.assignedById],
    references: [users.id]
  })
}));

export const permissionGroupsRelations = relations(permissionGroups, ({ many }) => ({
  permissions: many(permissions)
}));

export const permissionsRelations = relations(permissions, ({ one, many }) => ({
  group: one(permissionGroups, {
    fields: [permissions.groupId],
    references: [permissionGroups.id]
  }),
  rolePermissions: many(rolePermissions)
}));

export const permissionSetsRelations = relations(permissionSets, ({ one, many }) => ({
  // Permission sets can be associated with roles or used directly in policy evaluation
  workspace: one(workspaces, {
    fields: [permissionSets.workspaceId],
    references: [workspaces.id]
  })
}));

export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, {
    fields: [rolePermissions.roleId],
    references: [roles.id]
  }),
  permission: one(permissions, {
    fields: [rolePermissions.permissionId],
    references: [permissions.id]
  })
}));

// Workspace Isolation Settings Table
export const workspaceIsolationSettings = pgTable("workspace_isolation_settings", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id).notNull().unique(),
  networkIsolation: boolean("network_isolation").default(false).notNull(),
  resourceIsolation: boolean("resource_isolation").default(false).notNull(),
  dataSegregation: boolean("data_segregation").default(false).notNull(),
  enforceZeroTrust: boolean("enforce_zero_trust").default(false).notNull(),
  allowedIpRanges: text("allowed_ip_ranges").array().default([]),
  allowedDomains: text("allowed_domains").array().default([]),
  isolationLevel: text("isolation_level").default("none").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Workspace Resource Access Control Table
export const workspaceResourceAccess = pgTable("workspace_resource_access", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id).notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  allowedActions: text("allowed_actions").array().default([]),
  deniedActions: text("denied_actions").array().default([]),
  accessLevel: text("access_level").default("read").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => {
  return {
    uniqWorkspaceResource: unique().on(table.workspaceId, table.resourceType, table.resourceId)
  };
});

// Workspace Network Access Rules Table
export const workspaceNetworkAccess = pgTable("workspace_network_access", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => workspaces.id).notNull(),
  ruleType: text("rule_type").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id"),
  ipRange: text("ip_range"),
  domain: text("domain"),
  allow: boolean("allow").default(true).notNull(),
  priority: integer("priority").default(100).notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});

// Workspace Isolation Settings Relations
export const workspaceIsolationSettingsRelations = relations(workspaceIsolationSettings, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceIsolationSettings.workspaceId],
    references: [workspaces.id]
  })
}));

// Workspace Resource Access Relations
export const workspaceResourceAccessRelations = relations(workspaceResourceAccess, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceResourceAccess.workspaceId],
    references: [workspaces.id]
  })
}));

// Workspace Network Access Relations
export const workspaceNetworkAccessRelations = relations(workspaceNetworkAccess, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspaceNetworkAccess.workspaceId],
    references: [workspaces.id]
  })
}));

export const mfaRecoveryCodesRelations = relations(mfaRecoveryCodes, ({ one }) => ({
  user: one(users, {
    fields: [mfaRecoveryCodes.userId],
    references: [users.id]
  })
}));

export const fido2CredentialsRelations = relations(fido2Credentials, ({ one }) => ({
  user: one(users, {
    fields: [fido2Credentials.userId],
    references: [users.id]
  })
}));

export const userSessionsRelations = relations(userSessions, ({ one }) => ({
  user: one(users, {
    fields: [userSessions.userId],
    references: [users.id]
  })
}));

export const workspacesRelations = relations(workspaces, ({ many, one }) => ({
  mcpServers: many(mcpServers),
  roles: many(roles),
  // Workspace management
  members: many(workspaceMembers),
  policy: one(workspacePolicies, {
    fields: [workspaces.id],
    references: [workspacePolicies.workspaceId]
  }),
  // Workspace isolation and security
  isolationSettings: one(workspaceIsolationSettings, {
    fields: [workspaces.id],
    references: [workspaceIsolationSettings.workspaceId]
  }),
  resourceAccess: many(workspaceResourceAccess),
  networkAccess: many(workspaceNetworkAccess),
  // New relations for enterprise features
  systemIntegrations: many(systemIntegrations),
  apiKeys: many(apiKeys),
  pluginInstallations: many(pluginInstallations),
  workflows: many(workflows),
  // Admin dashboard features
  ldapDirectories: many(ldapDirectories),
  ipAccessRules: many(ipAccessRules),
  securityPolicy: one(securityPolicies, {
    fields: [workspaces.id],
    references: [securityPolicies.workspaceId]
  })
}));

export const mcpServersRelations = relations(mcpServers, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [mcpServers.workspaceId],
    references: [workspaces.id]
  }),
  tools: many(tools)
}));

export const toolsRelations = relations(tools, ({ one }) => ({
  server: one(mcpServers, {
    fields: [tools.serverId],
    references: [mcpServers.id]
  })
}));

// New relations for enterprise features
export const systemIntegrationsRelations = relations(systemIntegrations, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [systemIntegrations.workspaceId],
    references: [workspaces.id]
  }),
  creator: one(users, {
    fields: [systemIntegrations.createdBy],
    references: [users.id]
  })
}));

// API keys relations already defined earlier
  
export const pluginsRelations = relations(plugins, ({ one, many }) => ({
  author: one(users, {
    fields: [plugins.createdBy],
    references: [users.id]
  }),
  versions: many(pluginVersions),
  installations: many(pluginInstallations)
}));

export const pluginVersionsRelations = relations(pluginVersions, ({ one, many }) => ({
  plugin: one(plugins, {
    fields: [pluginVersions.pluginId],
    references: [plugins.id]
  }),
  installations: many(pluginInstallations)
}));

export const pluginInstallationsRelations = relations(pluginInstallations, ({ one }) => ({
  plugin: one(plugins, {
    fields: [pluginInstallations.pluginId],
    references: [plugins.id]
  }),
  version: one(pluginVersions, {
    fields: [pluginInstallations.versionId],
    references: [pluginVersions.id]
  }),
  workspace: one(workspaces, {
    fields: [pluginInstallations.workspaceId],
    references: [workspaces.id]
  }),
  installedByUser: one(users, {
    fields: [pluginInstallations.installedBy],
    references: [users.id]
  })
}));

export const developerResourcesRelations = relations(developerResources, ({ one }) => ({
  authorUser: one(users, {
    fields: [developerResources.author],
    references: [users.id]
  })
}));

export const workflowTemplatesRelations = relations(workflowTemplates, ({ one, many }) => ({
  creator: one(users, {
    fields: [workflowTemplates.createdBy],
    references: [users.id]
  }),
  workflows: many(workflows)
}));

export const workflowsRelations = relations(workflows, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [workflows.workspaceId],
    references: [workspaces.id]
  }),
  template: one(workflowTemplates, {
    fields: [workflows.templateId],
    references: [workflowTemplates.id]
  }),
  creator: one(users, {
    fields: [workflows.createdBy],
    references: [users.id]
  }),
  runs: many(workflowRuns)
}));

export const workflowRunsRelations = relations(workflowRuns, ({ one }) => ({
  workflow: one(workflows, {
    fields: [workflowRuns.workflowId],
    references: [workflows.id]
  }),
  triggeredByUser: one(users, {
    fields: [workflowRuns.triggeredBy],
    references: [users.id]
  })
}));

export const localizationsRelations = relations(localizations, () => ({}));

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.id]
  })
}));

// Relations for new tables for admin dashboard
export const workspaceMembersRelations = relations(workspaceMembers, ({ one }) => ({
  user: one(users, {
    fields: [workspaceMembers.userId],
    references: [users.id]
  }),
  workspace: one(workspaces, {
    fields: [workspaceMembers.workspaceId],
    references: [workspaces.id]
  }),
  inviter: one(users, {
    fields: [workspaceMembers.invitedBy],
    references: [users.id]
  })
}));

export const workspacePoliciesRelations = relations(workspacePolicies, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [workspacePolicies.workspaceId],
    references: [workspaces.id]
  })
}));

export const ldapDirectoriesRelations = relations(ldapDirectories, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [ldapDirectories.workspaceId],
    references: [workspaces.id]
  })
}));

export const ipAccessRulesRelations = relations(ipAccessRules, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [ipAccessRules.workspaceId],
    references: [workspaces.id]
  }),
  createdByUser: one(users, {
    fields: [ipAccessRules.createdBy],
    references: [users.id]
  })
}));

export const securityPoliciesRelations = relations(securityPolicies, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [securityPolicies.workspaceId],
    references: [workspaces.id]
  })
}));

// Schemas for validation
// User schemas
export const insertUserSchema = createInsertSchema(users, {
  username: (schema) => schema.min(3, "Username must be at least 3 characters"),
  password: (schema) => schema.min(8, "Password must be at least 8 characters"),
  email: (schema) => schema.email("Please enter a valid email").optional()
}).omit({ 
  id: true, uuid: true, createdAt: true, updatedAt: true, lastLogin: true, 
  passwordChangedAt: true, failedLoginAttempts: true, lockedUntil: true,
  mfaSecret: true
});

// Basic local authentication
export const localLoginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().optional().default(false)
});

// LDAP authentication
export const ldapLoginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  domain: z.string().optional(),
  rememberMe: z.boolean().optional().default(false)
});

// SAML authentication schema (typically just initiates the SAML flow)
export const samlLoginSchema = z.object({
  provider: z.string().min(1, "Provider is required"),
  relayState: z.string().optional() // for preserving state
});

// OIDC authentication schema (typically just initiates the OIDC flow)
export const oidcLoginSchema = z.object({
  provider: z.string().min(1, "Provider is required"),
  redirectUri: z.string().url("Invalid redirect URI").optional()
});

// OAuth2 authentication schema
export const oauth2LoginSchema = z.object({
  provider: z.string().min(1, "Provider is required"),
  redirectUri: z.string().url("Invalid redirect URI").optional(),
  state: z.string().optional(),
  responseType: z.enum(["code", "token"]).optional().default("code"),
  scope: z.string().optional(),
  customParams: z.record(z.string()).optional()
});

// MFA verification
export const mfaVerificationSchema = z.object({
  method: z.enum(["totp", "sms", "email", "recovery", "webauthn"]),
  userId: z.number().int().positive(),
  code: z.string().optional(), // for TOTP, SMS, email
  recoveryCode: z.string().optional(), // for recovery codes
  credential: z.record(z.any()).optional() // for WebAuthn
});

// FIDO2/WebAuthn registration
export const webAuthnRegistrationSchema = z.object({
  userId: z.number().int().positive(),
  credential: z.record(z.any()), // credential from browser API
  deviceName: z.string().optional()
});

// Auth provider schema
export const insertAuthProviderSchema = createInsertSchema(authProviders, {
  name: (schema) => schema.min(2, "Name must be at least 2 characters"),
  type: (schema) => schema.refine(
    (val) => ["local", "ldap", "saml", "oidc", "oauth2", "google", "microsoft", "github", "facebook", "twitter", "linkedin", "apple", "custom"].includes(val),
    "Invalid provider type"
  ),
  clientId: (schema) => schema.optional(),
  clientSecret: (schema) => schema.optional(),
  authorizationUrl: (schema) => schema.url("Authorization URL must be a valid URL").optional(),
  tokenUrl: (schema) => schema.url("Token URL must be a valid URL").optional(),
  userInfoUrl: (schema) => schema.url("User Info URL must be a valid URL").optional(),
  callbackUrl: (schema) => schema.url("Callback URL must be a valid URL").optional(),
  scope: (schema) => schema.optional(),
  issuer: (schema) => schema.optional(),
  jwksUri: (schema) => schema.url("JWKS URI must be a valid URL").optional(),
  logoUrl: (schema) => schema.url("Logo URL must be a valid URL").optional()
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertWorkspaceSchema = createInsertSchema(workspaces).omit({ 
  id: true, createdAt: true, updatedAt: true 
});

export const insertMcpServerSchema = createInsertSchema(mcpServers).omit({ 
  id: true, createdAt: true, updatedAt: true, lastSync: true 
});

export const insertToolSchema = createInsertSchema(tools).omit({ 
  id: true, createdAt: true, updatedAt: true 
});

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ 
  id: true, createdAt: true 
});

// Role and permission schemas
export const insertRoleSchema = createInsertSchema(roles, {
  name: (schema) => schema.min(2, "Name must be at least 2 characters"),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertUserRoleSchema = createInsertSchema(userRoles).omit({
  id: true, createdAt: true
});

export const insertPermissionGroupSchema = createInsertSchema(permissionGroups, {
  name: (schema) => schema.min(2, "Name must be at least 2 characters"),
}).omit({ id: true, createdAt: true, updatedAt: true });

// Permission Set schemas for OAuth and RBAC/ABAC
export const insertPermissionSetSchema = createInsertSchema(permissionSets, {
  name: (schema) => schema.min(3, "Name must be at least 3 characters"),
  description: (schema) => schema.min(10, "Description must be at least 10 characters"),
  category: (schema) => schema.refine(
    (val) => ["auth", "data", "tool", "system", "admin"].includes(val),
    { message: "Category must be one of: auth, data, tool, system, admin" }
  )
}).omit({ id: true, createdAt: true, updatedAt: true });

export type PermissionSetInsert = z.infer<typeof insertPermissionSetSchema>;
export const selectPermissionSetSchema = createSelectSchema(permissionSets);
export type PermissionSet = z.infer<typeof selectPermissionSetSchema>;

export const insertPermissionSchema = createInsertSchema(permissions, {
  name: (schema) => schema.min(2, "Name must be at least 2 characters"),
}).omit({ id: true, createdAt: true });

// Policy schemas
export const insertPolicySchema = createInsertSchema(policies, {
  name: (schema) => schema.min(3, "Name must be at least 3 characters"),
  type: (schema) => schema.refine(
    (val) => ['authorization', 'data_governance', 'compliance', 'security', 'system'].includes(val),
    "Policy type must be one of: authorization, data_governance, compliance, security, system"
  )
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertPolicyVersionSchema = createInsertSchema(policyVersions, {
  policyCode: (schema) => schema.min(10, "Policy code must be at least 10 characters")
}).omit({ id: true, createdAt: true });

export const insertPolicyAssignmentSchema = createInsertSchema(policyAssignments, {
  resourceType: (schema) => schema.refine(
    (val) => ['workspace', 'user', 'role', 'system', 'tool', 'server'].includes(val),
    "Resource type must be one of: workspace, user, role, system, tool, server"
  )
}).omit({ id: true, createdAt: true });

// MFA and security schemas
export const insertMfaRecoveryCodeSchema = createInsertSchema(mfaRecoveryCodes).omit({
  id: true, createdAt: true, usedAt: true, isUsed: true
});

export const insertFido2CredentialSchema = createInsertSchema(fido2Credentials).omit({
  id: true, createdAt: true, lastUsed: true
});

export const insertUserSessionSchema = createInsertSchema(userSessions).omit({
  id: true, createdAt: true, lastActive: true
});

export const insertUserIdentitySchema = createInsertSchema(userIdentities).omit({
  id: true, createdAt: true, updatedAt: true
});

// Enterprise feature schemas
export const insertSystemIntegrationSchema = createInsertSchema(systemIntegrations, {
  name: (schema) => schema.min(2, "Name must be at least 2 characters"),
  type: (schema) => schema.refine(
    (val) => ["itsm", "cicd", "ticketing", "monitoring", "alerting", "logging", "analytics", "other"].includes(val),
    "Invalid integration type"
  )
}).omit({ id: true, createdAt: true, updatedAt: true, lastSyncAt: true });

// API Key insert schema defined earlier as apiKeyInsertSchema

export const insertPluginSchema = createInsertSchema(plugins, {
  name: (schema) => schema.min(2, "Name must be at least 2 characters"),
  version: (schema) => schema.regex(/^\d+\.\d+\.\d+$/, "Version must follow semantic versioning (e.g., 1.0.0)")
}).omit({ id: true, createdAt: true, updatedAt: true, publishedAt: true, installCount: true, rating: true });

export const insertPluginVersionSchema = createInsertSchema(pluginVersions, {
  version: (schema) => schema.regex(/^\d+\.\d+\.\d+$/, "Version must follow semantic versioning (e.g., 1.0.0)")
}).omit({ id: true, createdAt: true, publishedAt: true });

export const insertPluginInstallationSchema = createInsertSchema(pluginInstallations).omit({
  id: true, installedAt: true, updatedAt: true, lastUsedAt: true 
});

export const insertDeveloperResourceSchema = createInsertSchema(developerResources, {
  title: (schema) => schema.min(3, "Title must be at least 3 characters"),
  slug: (schema) => schema.regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  content: (schema) => schema.min(10, "Content must be at least 10 characters"),
  type: (schema) => schema.refine(
    (val) => ["documentation", "tutorial", "guide", "api", "sdk", "example", "reference"].includes(val),
    "Invalid resource type"
  )
}).omit({ id: true, createdAt: true, updatedAt: true, publishedAt: true, viewCount: true });

export const insertWorkflowTemplateSchema = createInsertSchema(workflowTemplates, {
  name: (schema) => schema.min(2, "Name must be at least 2 characters")
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertWorkflowSchema = createInsertSchema(workflows, {
  name: (schema) => schema.min(2, "Name must be at least 2 characters")
}).omit({ id: true, createdAt: true, updatedAt: true, lastRunAt: true, stats: true });

export const insertWorkflowRunSchema = createInsertSchema(workflowRuns).omit({
  id: true, startedAt: true, finishedAt: true, executionTime: true
});

export const insertLocalizationSchema = createInsertSchema(localizations, {
  key: (schema) => schema.min(1, "Key cannot be empty"),
  value: (schema) => schema.min(1, "Value cannot be empty")
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({
  id: true, updatedAt: true
});

// Admin dashboard schemas
export const insertLdapDirectorySchema = createInsertSchema(ldapDirectories, {
  name: (schema) => schema.min(2, "Name must be at least 2 characters"),
  host: (schema) => schema.min(2, "Host must be at least 2 characters"),
  bindDn: (schema) => schema.min(2, "Bind DN must be at least 2 characters"),
  searchBase: (schema) => schema.min(2, "Search base must be at least 2 characters"),
}).omit({ id: true, createdAt: true, updatedAt: true, lastSyncAt: true, syncStatus: true, syncError: true });

export const insertIpAccessRuleSchema = createInsertSchema(ipAccessRules, {
  type: (schema) => schema.refine(
    (val) => ["allow", "deny"].includes(val),
    "Type must be either 'allow' or 'deny'"
  ),
  valueType: (schema) => schema.refine(
    (val) => ["ip", "range", "country"].includes(val),
    "Value type must be 'ip', 'range', or 'country'"
  ),
  ipValue: (schema) => schema.min(2, "IP value must be at least 2 characters"),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const insertWorkspaceMemberSchema = createInsertSchema(workspaceMembers, {
  status: (schema) => schema.refine(
    (val) => ["active", "invited", "suspended"].includes(val),
    "Status must be 'active', 'invited', or 'suspended'"
  )
}).omit({
  id: true, createdAt: true, updatedAt: true, invitedAt: true, acceptedAt: true, lastAccessed: true
});

export const insertWorkspacePolicySchema = createInsertSchema(workspacePolicies, {
  memberInvitePolicy: (schema) => schema.refine(
    (val) => ["admin_only", "members_can_invite"].includes(val),
    "Member invite policy must be 'admin_only' or 'members_can_invite'"
  )
}).omit({
  id: true, createdAt: true, updatedAt: true
});

export const insertSecurityPolicySchema = createInsertSchema(securityPolicies).omit({
  id: true, createdAt: true, updatedAt: true
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type LoginCredentials = z.infer<typeof localLoginSchema>; // Standard login credentials (backward compatibility)
export type LocalLoginCredentials = z.infer<typeof localLoginSchema>;
export type LdapLoginCredentials = z.infer<typeof ldapLoginSchema>;
export type SamlLoginCredentials = z.infer<typeof samlLoginSchema>;
export type OidcLoginCredentials = z.infer<typeof oidcLoginSchema>;
export type OAuth2LoginCredentials = z.infer<typeof oauth2LoginSchema>;
export type MfaVerification = z.infer<typeof mfaVerificationSchema>;
export type WebAuthnRegistration = z.infer<typeof webAuthnRegistrationSchema>;
export type InsertAuthProvider = z.infer<typeof insertAuthProviderSchema>;
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type InsertUserRole = z.infer<typeof insertUserRoleSchema>;
export type InsertPermissionGroup = z.infer<typeof insertPermissionGroupSchema>;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type InsertMfaRecoveryCode = z.infer<typeof insertMfaRecoveryCodeSchema>;
export type InsertFido2Credential = z.infer<typeof insertFido2CredentialSchema>;
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;
export type InsertUserIdentity = z.infer<typeof insertUserIdentitySchema>;

// Enterprise feature types
export type InsertSystemIntegration = z.infer<typeof insertSystemIntegrationSchema>;
// API Key insert type defined earlier
export type InsertPlugin = z.infer<typeof insertPluginSchema>;
export type InsertPluginVersion = z.infer<typeof insertPluginVersionSchema>;
export type InsertPluginInstallation = z.infer<typeof insertPluginInstallationSchema>;
export type InsertDeveloperResource = z.infer<typeof insertDeveloperResourceSchema>;
export type InsertWorkflowTemplate = z.infer<typeof insertWorkflowTemplateSchema>;
export type InsertWorkflow = z.infer<typeof insertWorkflowSchema>;
export type InsertWorkflowRun = z.infer<typeof insertWorkflowRunSchema>;
export type InsertLocalization = z.infer<typeof insertLocalizationSchema>;
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;

export type User = typeof users.$inferSelect;
export type AuthProvider = typeof authProviders.$inferSelect;
export type UserIdentity = typeof userIdentities.$inferSelect;
export type Role = typeof roles.$inferSelect;
export type UserRole = typeof userRoles.$inferSelect;
export type PermissionGroup = typeof permissionGroups.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
export type MfaRecoveryCode = typeof mfaRecoveryCodes.$inferSelect;
export type Fido2Credential = typeof fido2Credentials.$inferSelect;
export type UserSession = typeof userSessions.$inferSelect;
export type Workspace = typeof workspaces.$inferSelect;
export type McpServer = typeof mcpServers.$inferSelect;
export type Tool = typeof tools.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;

// Enterprise feature select types
export type SystemIntegration = typeof systemIntegrations.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type Plugin = typeof plugins.$inferSelect;
export type PluginVersion = typeof pluginVersions.$inferSelect;
export type PluginInstallation = typeof pluginInstallations.$inferSelect;
export type DeveloperResource = typeof developerResources.$inferSelect;
export type WorkflowTemplate = typeof workflowTemplates.$inferSelect;
export type Workflow = typeof workflows.$inferSelect;
export type WorkflowRun = typeof workflowRuns.$inferSelect;
export type Localization = typeof localizations.$inferSelect;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type Policy = typeof policies.$inferSelect;
export type PolicyVersion = typeof policyVersions.$inferSelect;
export type PolicyAssignment = typeof policyAssignments.$inferSelect;
export type AuditChain = typeof auditChain.$inferSelect;

// Export A2A Orchestration types
export const { 
  agents, 
  a2aFlows, 
  a2aExecutions, 
  agentStatusEnum, 
  flowStatusEnum, 
  executionStatusEnum 
} = a2aSchema;

export type Agent = typeof a2aSchema.agents.$inferSelect;
export type InsertAgent = z.infer<typeof a2aSchema.insertAgentSchema>;
export type A2AFlow = typeof a2aSchema.a2aFlows.$inferSelect;
export type InsertA2AFlow = z.infer<typeof a2aSchema.insertA2AFlowSchema>;
export type A2AExecution = typeof a2aSchema.a2aExecutions.$inferSelect;
export type InsertA2AExecution = z.infer<typeof a2aSchema.insertA2AExecutionSchema>;

/**
 * Cluster node schema for tracking distributed system nodes
 */
export const nodes = pgTable('nodes', {
  id: text('id').primaryKey(),
  host: text('host').notNull(),
  port: integer('port').notNull(),
  status: text('status').notNull().default('offline'),
  role: text('role').notNull().default('worker'),
  region: text('region').notNull().default('default-region'),
  zone: text('zone').notNull().default('default-zone'),
  cpu: integer('cpu'),
  memory: integer('memory'),
  startTime: timestamp('start_time').defaultNow().notNull(),
  lastHeartbeat: timestamp('last_heartbeat').defaultNow().notNull(),
  metadata: jsonb('metadata'),
});

export type Node = typeof nodes.$inferSelect;
export type InsertNode = typeof nodes.$inferInsert;
export const insertNodeSchema = createInsertSchema(nodes);

/**
 * Compliance Frameworks Table
 * Defines various compliance frameworks like SOC2, HIPAA, ISO27001, etc.
 */
export const complianceFrameworks = pgTable("compliance_frameworks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  version: text("version").notNull(),
  description: text("description"),
  category: text("category").notNull(), // e.g., 'security', 'data_privacy', 'industry'
  isActive: boolean("is_active").default(true).notNull(),
  requirements: jsonb("requirements"), // JSON array of requirement objects with ids and descriptions
  controls: jsonb("controls"), // JSON array of control objects
  metadata: jsonb("metadata"), // Additional metadata about the framework
  documentationUrl: text("documentation_url"),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => users.id),
  workspaceId: integer("workspace_id").references(() => workspaces.id).notNull(),
});

/**
 * Compliance Controls Table
 * Defines specific controls within a compliance framework
 */
export const complianceControls = pgTable("compliance_controls", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(), // e.g., 'ACC-01', 'SEC-12'
  name: text("name").notNull(),
  description: text("description").notNull(),
  frameworkId: integer("framework_id").references(() => complianceFrameworks.id).notNull(),
  category: text("category").notNull(), // e.g., 'access_control', 'encryption', 'audit'
  severity: text("severity").notNull(), // e.g., 'high', 'medium', 'low'
  implementationStatus: text("implementation_status").default('not_implemented').notNull(), // 'not_implemented', 'in_progress', 'implemented', 'not_applicable'
  verificationMethod: text("verification_method"), // e.g., 'automated', 'manual'
  evidenceRequired: boolean("evidence_required").default(true).notNull(),
  automationScript: text("automation_script"), // Optional script for automated testing
  remediationGuidance: text("remediation_guidance"),
  metadata: jsonb("metadata"),
  lastTestedAt: timestamp("last_tested_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  workspaceId: integer("workspace_id").references(() => workspaces.id).notNull(),
});

/**
 * Compliance Evidence Table
 * Stores evidence for compliance controls
 */
export const complianceEvidence = pgTable("compliance_evidence", {
  id: serial("id").primaryKey(),
  controlId: integer("control_id").references(() => complianceControls.id).notNull(),
  evidenceType: text("evidence_type").notNull(), // e.g., 'document', 'screenshot', 'api_response', 'audit_log'
  name: text("name").notNull(),
  description: text("description"),
  fileUrl: text("file_url"), // For uploaded evidence files
  textContent: text("text_content"), // For text-based evidence
  metadata: jsonb("metadata"),
  verifiedAt: timestamp("verified_at"),
  verifiedBy: integer("verified_by").references(() => users.id),
  validUntil: timestamp("valid_until"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  workspaceId: integer("workspace_id").references(() => workspaces.id).notNull(),
});

/**
 * Compliance Assessments Table
 * Tracks assessment processes for compliance frameworks
 */
export const complianceAssessments = pgTable("compliance_assessments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  frameworkId: integer("framework_id").references(() => complianceFrameworks.id).notNull(),
  status: text("status").default('in_progress').notNull(), // 'not_started', 'in_progress', 'completed', 'archived'
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  assignedTo: integer("assigned_to").references(() => users.id),
  progress: integer("progress").default(0), // Percentage of completed controls
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  workspaceId: integer("workspace_id").references(() => workspaces.id).notNull(),
});

/**
 * Compliance Assessment Results Table
 * Stores results of individual control assessments
 */
export const complianceAssessmentResults = pgTable("compliance_assessment_results", {
  id: serial("id").primaryKey(),
  assessmentId: integer("assessment_id").references(() => complianceAssessments.id).notNull(),
  controlId: integer("control_id").references(() => complianceControls.id).notNull(),
  status: text("status").notNull(), // 'pass', 'fail', 'na', 'remediation_required'
  notes: text("notes"),
  evidenceIds: jsonb("evidence_ids"), // Array of evidence IDs
  remediationPlan: text("remediation_plan"),
  remediationDeadline: timestamp("remediation_deadline"),
  remediatedAt: timestamp("remediated_at"),
  remediatedBy: integer("remediated_by").references(() => users.id),
  assessedBy: integer("assessed_by").references(() => users.id).notNull(),
  assessedAt: timestamp("assessed_at").defaultNow().notNull(),
  metadata: jsonb("metadata"),
  workspaceId: integer("workspace_id").references(() => workspaces.id).notNull(),
});

/**
 * Compliance Reports Table
 * Defines generated compliance reports
 */
export const complianceReports = pgTable("compliance_reports", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // 'framework_assessment', 'gap_analysis', 'executive_summary', 'audit_ready'
  assessmentId: integer("assessment_id").references(() => complianceAssessments.id),
  frameworkIds: jsonb("framework_ids"), // Array of framework IDs
  format: text("format").default('pdf').notNull(), // 'pdf', 'html', 'docx', 'json'
  status: text("status").default('draft').notNull(), // 'draft', 'generated', 'approved', 'archived'
  generatedUrl: text("generated_url"), // URL to the generated report
  generatedAt: timestamp("generated_at"),
  generatedBy: integer("generated_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  approvedBy: integer("approved_by").references(() => users.id),
  metadata: jsonb("metadata"),
  scheduledGeneration: boolean("scheduled_generation").default(false),
  generationSchedule: text("generation_schedule"), // cron expression for scheduled reports
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  workspaceId: integer("workspace_id").references(() => workspaces.id).notNull(),
});

/**
 * Compliance Report Templates Table
 * Defines templates for compliance reports
 */
export const complianceReportTemplates = pgTable("compliance_report_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull(), // 'framework_assessment', 'gap_analysis', 'executive_summary'
  format: text("format").default('html').notNull(), // 'html', 'markdown', 'handlebars'
  content: text("content").notNull(), // Template content
  sections: jsonb("sections"), // JSON definition of template sections
  variables: jsonb("variables"), // Variables used in the template
  isDefault: boolean("is_default").default(false),
  isCustom: boolean("is_custom").default(true),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  workspaceId: integer("workspace_id").references(() => workspaces.id).notNull(),
});

// Add relations for compliance tables
export const complianceFrameworksRelations = relations(complianceFrameworks, ({ many, one }) => ({
  controls: many(complianceControls),
  assessments: many(complianceAssessments),
  workspace: one(workspaces, { fields: [complianceFrameworks.workspaceId], references: [workspaces.id] }),
  creator: one(users, { fields: [complianceFrameworks.createdBy], references: [users.id] }),
}));

export const complianceControlsRelations = relations(complianceControls, ({ many, one }) => ({
  framework: one(complianceFrameworks, { fields: [complianceControls.frameworkId], references: [complianceFrameworks.id] }),
  evidence: many(complianceEvidence),
  assessmentResults: many(complianceAssessmentResults),
  workspace: one(workspaces, { fields: [complianceControls.workspaceId], references: [workspaces.id] }),
}));

export const complianceEvidenceRelations = relations(complianceEvidence, ({ one }) => ({
  control: one(complianceControls, { fields: [complianceEvidence.controlId], references: [complianceControls.id] }),
  creator: one(users, { fields: [complianceEvidence.createdBy], references: [users.id] }),
  verifier: one(users, { fields: [complianceEvidence.verifiedBy], references: [users.id] }),
  workspace: one(workspaces, { fields: [complianceEvidence.workspaceId], references: [workspaces.id] }),
}));

export const complianceAssessmentsRelations = relations(complianceAssessments, ({ many, one }) => ({
  framework: one(complianceFrameworks, { fields: [complianceAssessments.frameworkId], references: [complianceFrameworks.id] }),
  results: many(complianceAssessmentResults),
  reports: many(complianceReports),
  assignee: one(users, { fields: [complianceAssessments.assignedTo], references: [users.id] }),
  creator: one(users, { fields: [complianceAssessments.createdBy], references: [users.id] }),
  workspace: one(workspaces, { fields: [complianceAssessments.workspaceId], references: [workspaces.id] }),
}));

export const complianceAssessmentResultsRelations = relations(complianceAssessmentResults, ({ one }) => ({
  assessment: one(complianceAssessments, { fields: [complianceAssessmentResults.assessmentId], references: [complianceAssessments.id] }),
  control: one(complianceControls, { fields: [complianceAssessmentResults.controlId], references: [complianceControls.id] }),
  assessor: one(users, { fields: [complianceAssessmentResults.assessedBy], references: [users.id] }),
  remediator: one(users, { fields: [complianceAssessmentResults.remediatedBy], references: [users.id] }),
  workspace: one(workspaces, { fields: [complianceAssessmentResults.workspaceId], references: [workspaces.id] }),
}));

export const complianceReportsRelations = relations(complianceReports, ({ one }) => ({
  assessment: one(complianceAssessments, { fields: [complianceReports.assessmentId], references: [complianceAssessments.id] }),
  generator: one(users, { fields: [complianceReports.generatedBy], references: [users.id] }),
  approver: one(users, { fields: [complianceReports.approvedBy], references: [users.id] }),
  creator: one(users, { fields: [complianceReports.createdBy], references: [users.id] }),
  workspace: one(workspaces, { fields: [complianceReports.workspaceId], references: [workspaces.id] }),
}));

export const complianceReportTemplatesRelations = relations(complianceReportTemplates, ({ one }) => ({
  creator: one(users, { fields: [complianceReportTemplates.createdBy], references: [users.id] }),
  workspace: one(workspaces, { fields: [complianceReportTemplates.workspaceId], references: [workspaces.id] }),
}));

// Create Zod validation schemas for compliance tables
export const insertComplianceFrameworkSchema = createInsertSchema(complianceFrameworks, {
  name: (schema) => schema.min(2, "Name must be at least 2 characters"),
  version: (schema) => schema.min(1, "Version is required"),
  description: (schema) => schema.optional(),
});
export type ComplianceFrameworkInsert = z.infer<typeof insertComplianceFrameworkSchema>;
export const selectComplianceFrameworkSchema = createSelectSchema(complianceFrameworks);
export type ComplianceFramework = z.infer<typeof selectComplianceFrameworkSchema>;

export const insertComplianceControlSchema = createInsertSchema(complianceControls, {
  code: (schema) => schema.min(2, "Code must be at least 2 characters"),
  name: (schema) => schema.min(2, "Name must be at least 2 characters"),
  description: (schema) => schema.min(5, "Description must be at least 5 characters"),
});
export type ComplianceControlInsert = z.infer<typeof insertComplianceControlSchema>;
export const selectComplianceControlSchema = createSelectSchema(complianceControls);
export type ComplianceControl = z.infer<typeof selectComplianceControlSchema>;

export const insertComplianceEvidenceSchema = createInsertSchema(complianceEvidence, {
  name: (schema) => schema.min(2, "Name must be at least 2 characters"),
  evidenceType: (schema) => schema.min(2, "Evidence type must be at least 2 characters"),
});
export type ComplianceEvidenceInsert = z.infer<typeof insertComplianceEvidenceSchema>;
export const selectComplianceEvidenceSchema = createSelectSchema(complianceEvidence);
export type ComplianceEvidence = z.infer<typeof selectComplianceEvidenceSchema>;

export const insertComplianceAssessmentSchema = createInsertSchema(complianceAssessments, {
  name: (schema) => schema.min(2, "Name must be at least 2 characters"),
});
export type ComplianceAssessmentInsert = z.infer<typeof insertComplianceAssessmentSchema>;
export const selectComplianceAssessmentSchema = createSelectSchema(complianceAssessments);
export type ComplianceAssessment = z.infer<typeof selectComplianceAssessmentSchema>;

export const insertComplianceAssessmentResultSchema = createInsertSchema(complianceAssessmentResults);
export type ComplianceAssessmentResultInsert = z.infer<typeof insertComplianceAssessmentResultSchema>;
export const selectComplianceAssessmentResultSchema = createSelectSchema(complianceAssessmentResults);
export type ComplianceAssessmentResult = z.infer<typeof selectComplianceAssessmentResultSchema>;

export const insertComplianceReportSchema = createInsertSchema(complianceReports, {
  name: (schema) => schema.min(2, "Name must be at least 2 characters"),
});
export type ComplianceReportInsert = z.infer<typeof insertComplianceReportSchema>;
export const selectComplianceReportSchema = createSelectSchema(complianceReports);
export type ComplianceReport = z.infer<typeof selectComplianceReportSchema>;

export const insertComplianceReportTemplateSchema = createInsertSchema(complianceReportTemplates, {
  name: (schema) => schema.min(2, "Name must be at least 2 characters"),
  content: (schema) => schema.min(10, "Template content must be at least 10 characters"),
});
export type ComplianceReportTemplateInsert = z.infer<typeof insertComplianceReportTemplateSchema>;
export const selectComplianceReportTemplateSchema = createSelectSchema(complianceReportTemplates);
export type ComplianceReportTemplate = z.infer<typeof selectComplianceReportTemplateSchema>;
