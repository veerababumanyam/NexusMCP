import { pgTable, serial, text, boolean, timestamp, integer, jsonb, uuid, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { relations } from 'drizzle-orm';
import { users } from './schema';

/**
 * OAuth2 Clients Table
 * Stores registered clients that can request access to the system
 */
export const oauthClients = pgTable('oauth_clients', {
  id: serial('id').primaryKey(),
  clientId: uuid('client_id').defaultRandom().notNull().unique(),
  clientName: text('client_name').notNull(),
  clientSecret: text('client_secret').notNull(),
  redirectUris: jsonb('redirect_uris').$type<string[]>().notNull(),
  grantTypes: jsonb('grant_types').$type<string[]>().notNull(),
  scopes: jsonb('scopes').$type<string[]>().notNull(),
  isConfidential: boolean('is_confidential').default(true).notNull(),
  isAutoApprove: boolean('is_auto_approve').default(false).notNull(),
  isEnabled: boolean('is_enabled').default(true).notNull(),
  userId: integer('user_id').references(() => users.id),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * OAuth2 Authorization Codes Table
 * Stores temporary authorization codes used in OAuth flow
 */
export const oauthAuthCodes = pgTable('oauth_auth_codes', {
  id: serial('id').primaryKey(),
  authCode: text('auth_code').notNull().unique(),
  clientId: integer('client_id').references(() => oauthClients.id).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  scopes: jsonb('scopes').$type<string[]>().notNull(),
  redirectUri: text('redirect_uri').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    codeIdx: uniqueIndex('oauth_auth_codes_code_idx').on(table.authCode),
    clientUserIdx: index('oauth_auth_codes_client_user_idx').on(table.clientId, table.userId),
  };
});

/**
 * OAuth2 Access Tokens Table
 * Stores access tokens for API authorization
 */
export const oauthAccessTokens = pgTable('oauth_access_tokens', {
  id: serial('id').primaryKey(),
  accessToken: text('access_token').notNull().unique(),
  clientId: integer('client_id').references(() => oauthClients.id).notNull(),
  userId: integer('user_id').references(() => users.id),
  scopes: jsonb('scopes').$type<string[]>().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    tokenIdx: uniqueIndex('oauth_access_tokens_token_idx').on(table.accessToken),
    clientUserIdx: index('oauth_access_tokens_client_user_idx').on(table.clientId, table.userId),
  };
});

/**
 * OAuth2 Refresh Tokens Table
 * Stores refresh tokens to obtain new access tokens
 */
export const oauthRefreshTokens = pgTable('oauth_refresh_tokens', {
  id: serial('id').primaryKey(),
  refreshToken: text('refresh_token').notNull().unique(),
  accessTokenId: integer('access_token_id').references(() => oauthAccessTokens.id).notNull(),
  clientId: integer('client_id').references(() => oauthClients.id).notNull(),
  userId: integer('user_id').references(() => users.id),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    tokenIdx: uniqueIndex('oauth_refresh_tokens_token_idx').on(table.refreshToken),
  };
});

/**
 * Client Dynamic Registration Table
 * Stores registration tokens for dynamic client registration (RFC 7591)
 */
export const clientRegistrations = pgTable('client_registrations', {
  id: serial('id').primaryKey(),
  registrationToken: text('registration_token').notNull().unique(),
  clientId: integer('client_id').references(() => oauthClients.id).notNull(),
  registrationUri: text('registration_uri').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Mutual TLS Certificate Table
 * Stores certificate information for mTLS authentication
 */
export const mtlsCertificates = pgTable('mtls_certificates', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').references(() => oauthClients.id).notNull(),
  certificateThumbprint: text('certificate_thumbprint').notNull().unique(),
  certificateSubject: text('certificate_subject').notNull(),
  certificateIssuer: text('certificate_issuer').notNull(),
  certificateSerial: text('certificate_serial').notNull(),
  certificateNotBefore: timestamp('certificate_not_before').notNull(),
  certificateNotAfter: timestamp('certificate_not_after').notNull(),
  isEnabled: boolean('is_enabled').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Access Audit Log Table
 * Records detailed access events for security and compliance
 */
export const accessAuditLogs = pgTable('access_audit_logs', {
  id: serial('id').primaryKey(),
  eventType: text('event_type').notNull(), // token_issued, token_revoked, auth_success, auth_failure, etc.
  eventTime: timestamp('event_time').defaultNow().notNull(),
  userId: integer('user_id').references(() => users.id),
  clientId: integer('client_id').references(() => oauthClients.id),
  tokenId: integer('token_id'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  requestPath: text('request_path'),
  requestMethod: text('request_method'),
  scopes: jsonb('scopes').$type<string[]>(),
  statusCode: integer('status_code'),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  details: jsonb('details'),
  complianceRelevant: boolean('compliance_relevant').default(false),
});

// Define relations
export const oauthClientsRelations = relations(oauthClients, ({ one, many }) => ({
  user: one(users, {
    fields: [oauthClients.userId],
    references: [users.id],
  }),
  authCodes: many(oauthAuthCodes),
  accessTokens: many(oauthAccessTokens),
  refreshTokens: many(oauthRefreshTokens),
  mtlsCertificates: many(mtlsCertificates),
}));

export const oauthAuthCodesRelations = relations(oauthAuthCodes, ({ one }) => ({
  client: one(oauthClients, {
    fields: [oauthAuthCodes.clientId],
    references: [oauthClients.id],
  }),
  user: one(users, {
    fields: [oauthAuthCodes.userId],
    references: [users.id],
  }),
}));

export const oauthAccessTokensRelations = relations(oauthAccessTokens, ({ one, many }) => ({
  client: one(oauthClients, {
    fields: [oauthAccessTokens.clientId],
    references: [oauthClients.id],
  }),
  user: one(users, {
    fields: [oauthAccessTokens.userId],
    references: [users.id],
  }),
  refreshTokens: many(oauthRefreshTokens),
}));

export const oauthRefreshTokensRelations = relations(oauthRefreshTokens, ({ one }) => ({
  accessToken: one(oauthAccessTokens, {
    fields: [oauthRefreshTokens.accessTokenId],
    references: [oauthAccessTokens.id],
  }),
  client: one(oauthClients, {
    fields: [oauthRefreshTokens.clientId],
    references: [oauthClients.id],
  }),
  user: one(users, {
    fields: [oauthRefreshTokens.userId],
    references: [users.id],
  }),
}));

// Define schemas for validation
export const oauthClientsInsertSchema = createInsertSchema(oauthClients, {
  clientName: (schema) => schema.min(3, "Client name must be at least 3 characters"),
  redirectUris: (schema) => schema.array(z.string().url("Must be a valid URL")),
  grantTypes: (schema) => schema.array(
    z.enum(["authorization_code", "client_credentials", "refresh_token", "password"])
  ),
  scopes: (schema) => schema.array(z.string().min(1, "Scope cannot be empty")),
});

export type OAuthClientInsert = z.infer<typeof oauthClientsInsertSchema>;
export const oauthClientsSelectSchema = createSelectSchema(oauthClients);
export type OAuthClient = z.infer<typeof oauthClientsSelectSchema>;

export const oauthAccessTokensInsertSchema = createInsertSchema(oauthAccessTokens, {
  accessToken: (schema) => schema.min(16, "Access token must be at least 16 characters"),
  scopes: (schema) => schema.array(z.string().min(1, "Scope cannot be empty")),
});

export type OAuthAccessTokenInsert = z.infer<typeof oauthAccessTokensInsertSchema>;
export const oauthAccessTokensSelectSchema = createSelectSchema(oauthAccessTokens);
export type OAuthAccessToken = z.infer<typeof oauthAccessTokensSelectSchema>;

export const mtlsCertificatesInsertSchema = createInsertSchema(mtlsCertificates, {
  certificateThumbprint: (schema) => schema.min(8, "Certificate thumbprint must be at least 8 characters"),
});

export type MtlsCertificateInsert = z.infer<typeof mtlsCertificatesInsertSchema>;
export const mtlsCertificatesSelectSchema = createSelectSchema(mtlsCertificates);
export type MtlsCertificate = z.infer<typeof mtlsCertificatesSelectSchema>;

export const accessAuditLogsInsertSchema = createInsertSchema(accessAuditLogs);
export type AccessAuditLogInsert = z.infer<typeof accessAuditLogsInsertSchema>;
export const accessAuditLogsSelectSchema = createSelectSchema(accessAuditLogs);
export type AccessAuditLog = z.infer<typeof accessAuditLogsSelectSchema>;