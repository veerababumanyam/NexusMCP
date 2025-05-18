/**
 * OAuth Schema Definitions
 * 
 * Defines schemas for:
 * - OAuth2 clients
 * - OAuth2 access tokens
 * - OAuth2 client metadata
 */

import { pgTable, serial, text, timestamp, boolean, integer, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';

// OAuth Clients table schema
export const oauthClients = pgTable('oauth_clients', {
  id: serial('id').primaryKey(),
  clientId: text('client_id').notNull().unique(),
  clientSecret: text('client_secret').notNull(),
  clientName: text('client_name').notNull(),
  description: text('description'),
  clientUri: text('client_uri'),
  logoUri: text('logo_uri'),
  redirectUris: jsonb('redirect_uris').$type<string[]>().notNull().default([]),
  grantTypes: jsonb('grant_types').$type<string[]>().notNull(),
  scopes: jsonb('scopes').$type<string[]>().notNull(),
  tokenEndpointAuthMethod: text('token_endpoint_auth_method').notNull().default('client_secret_basic'),
  contacts: jsonb('contacts').$type<string[]>(),
  workspaceId: integer('workspace_id'),
  createdBy: integer('created_by'),
  isConfidential: boolean('is_confidential').notNull().default(true),
  isEnabled: boolean('is_enabled').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// OAuth Access Tokens table schema
export const oauthAccessTokens = pgTable('oauth_access_tokens', {
  id: serial('id').primaryKey(),
  accessToken: text('access_token').notNull().unique(),
  clientId: integer('client_id').notNull().references(() => oauthClients.id, { onDelete: 'cascade' }),
  userId: integer('user_id'),  // Optional: can be null for client credentials
  scopes: jsonb('scopes').$type<string[]>().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  issuedAt: timestamp('issued_at').notNull().defaultNow(),
  refreshToken: text('refresh_token'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  isRevoked: boolean('is_revoked').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// OAuth Client Metadata table schema
export const oauthClientMetadata = pgTable('oauth_client_metadata', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').notNull().references(() => oauthClients.id, { onDelete: 'cascade' }),
  key: text('key').notNull(),
  value: jsonb('value'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

// Define relations
export const oauthClientsRelations = relations(oauthClients, ({ many }) => ({
  accessTokens: many(oauthAccessTokens),
  metadata: many(oauthClientMetadata)
}));

export const oauthAccessTokensRelations = relations(oauthAccessTokens, ({ one }) => ({
  client: one(oauthClients, {
    fields: [oauthAccessTokens.clientId],
    references: [oauthClients.id]
  })
}));

export const oauthClientMetadataRelations = relations(oauthClientMetadata, ({ one }) => ({
  client: one(oauthClients, {
    fields: [oauthClientMetadata.clientId],
    references: [oauthClients.id]
  })
}));

// Define schemas for validation with Zod
export const oauthClientSchema = z.object({
  clientName: z.string().min(3, "Client name must be at least 3 characters"),
  description: z.string().optional(),
  clientUri: z.string().optional(),
  logoUri: z.string().optional(),
  redirectUris: z.array(z.string()).optional(),
  grantTypes: z.array(
    z.enum(["authorization_code", "client_credentials", "refresh_token", "password"])
  ),
  scopes: z.array(z.string().min(1, "Scope cannot be empty")),
  workspaceId: z.number().optional(),
  createdBy: z.number().optional()
});

// Schema for creating a new OAuth client
export type OAuthClientCreate = z.infer<typeof oauthClientSchema>;

// Generated Drizzle schemas
export const oauthClientsInsertSchema = createInsertSchema(oauthClients);
export type OAuthClientInsert = z.infer<typeof oauthClientsInsertSchema>;
export const oauthClientsSelectSchema = createSelectSchema(oauthClients);
export type OAuthClient = z.infer<typeof oauthClientsSelectSchema>;

export const oauthAccessTokensInsertSchema = createInsertSchema(oauthAccessTokens);
export type OAuthAccessTokenInsert = z.infer<typeof oauthAccessTokensInsertSchema>;
export const oauthAccessTokensSelectSchema = createSelectSchema(oauthAccessTokens);
export type OAuthAccessToken = z.infer<typeof oauthAccessTokensSelectSchema>;

export const oauthClientMetadataInsertSchema = createInsertSchema(oauthClientMetadata);
export type OAuthClientMetadataInsert = z.infer<typeof oauthClientMetadataInsertSchema>;
export const oauthClientMetadataSelectSchema = createSelectSchema(oauthClientMetadata);
export type OAuthClientMetadata = z.infer<typeof oauthClientMetadataSelectSchema>;

// Create a separate type for OAuth client without the secret
export type OAuthClientPublic = Omit<OAuthClient, 'clientSecret'>;

// Schema for token request validation
export const tokenRequestSchema = z.object({
  grant_type: z.literal('client_credentials'),
  client_id: z.string(),
  client_secret: z.string(),
  scope: z.string().optional()
});

export type TokenRequest = z.infer<typeof tokenRequestSchema>;

// Schema for token response
export const tokenResponseSchema = z.object({
  access_token: z.string(),
  token_type: z.literal('bearer'),
  expires_in: z.number(),
  scope: z.string()
});

export type TokenResponse = z.infer<typeof tokenResponseSchema>;