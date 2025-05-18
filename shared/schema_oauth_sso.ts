/**
 * Schema definitions for OAuth2 SSO Integration
 */
import { pgTable, serial, text, timestamp, integer, boolean, jsonb, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { users } from './schema';

/**
 * SSO Identity Providers Table
 * Defines various identity providers (IdPs) that can be used for SSO
 */
export const ssoIdentityProviders = pgTable('sso_identity_providers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  providerType: varchar('provider_type', { length: 50 }).notNull(), // 'saml', 'oidc', 'oauth2'
  entityId: varchar('entity_id', { length: 255 }), // For SAML providers
  metadataUrl: text('metadata_url'),
  metadataXml: text('metadata_xml'),
  singleSignOnUrl: text('single_sign_on_url'), // For SAML and OIDC providers
  singleLogoutUrl: text('single_logout_url'),
  x509Certificate: text('x509_certificate'), // For SAML providers
  clientId: varchar('client_id', { length: 255 }), // For OIDC and OAuth2 providers
  clientSecret: text('client_secret'), // For OIDC and OAuth2 providers
  tokenEndpoint: text('token_endpoint'), // For OIDC and OAuth2 providers
  authorizationEndpoint: text('authorization_endpoint'), // For OIDC and OAuth2 providers
  userInfoEndpoint: text('user_info_endpoint'), // For OIDC providers
  jwksUri: text('jwks_uri'), // For OIDC providers with JWTs
  issuer: varchar('issuer', { length: 255 }), // For OIDC providers
  scope: text('scope'), // For OIDC and OAuth2 providers
  attributeMapping: jsonb('attribute_mapping'), // How IdP attributes map to user properties
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: integer('created_by').references(() => users.id),
  updatedBy: integer('updated_by').references(() => users.id),
  isActive: boolean('is_active').default(true),
  logoUrl: text('logo_url'),
  configJson: jsonb('config_json') // Additional provider-specific configurations
});

// Create schema for inserting SSO identity providers
export const ssoIdentityProvidersInsertSchema = createInsertSchema(ssoIdentityProviders, {
  providerType: (schema) => schema.refine(
    value => ['saml', 'oidc', 'oauth2'].includes(value),
    { message: 'Provider type must be "saml", "oidc", or "oauth2"' }
  )
});
export type SsoIdentityProviderInsert = z.infer<typeof ssoIdentityProvidersInsertSchema>;

// Create schema for selecting SSO identity providers
export const ssoIdentityProvidersSelectSchema = createSelectSchema(ssoIdentityProviders);
export type SsoIdentityProvider = z.infer<typeof ssoIdentityProvidersSelectSchema>;

/**
 * SSO Service Providers Table
 * Defines the service provider (SP) configurations
 */
export const ssoServiceProviders = pgTable('sso_service_providers', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  entityId: varchar('entity_id', { length: 255 }).notNull(), // For SAML SPs
  acsUrl: text('acs_url').notNull(), // Assertion Consumer Service URL
  metadataUrl: text('metadata_url'),
  metadataXml: text('metadata_xml'),
  sloUrl: text('slo_url'), // Single Logout URL
  x509Certificate: text('x509_certificate'), // SP certificate for signing SAML requests
  privateKey: text('private_key'), // SP private key for signing SAML requests
  nameIdFormat: varchar('name_id_format', { length: 255 }).default('urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified'),
  wantAssertionsSigned: boolean('want_assertions_signed').default(true),
  validUntil: timestamp('valid_until', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: integer('created_by').references(() => users.id),
  updatedBy: integer('updated_by').references(() => users.id),
  isActive: boolean('is_active').default(true),
  configJson: jsonb('config_json') // Additional SP-specific configurations
});

// Create schema for inserting SSO service providers
export const ssoServiceProvidersInsertSchema = createInsertSchema(ssoServiceProviders);
export type SsoServiceProviderInsert = z.infer<typeof ssoServiceProvidersInsertSchema>;

// Create schema for selecting SSO service providers
export const ssoServiceProvidersSelectSchema = createSelectSchema(ssoServiceProviders);
export type SsoServiceProvider = z.infer<typeof ssoServiceProvidersSelectSchema>;

/**
 * SSO Sessions Table
 * Tracks SSO sessions for auditing and security
 */
export const ssoSessions = pgTable('sso_sessions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  identityProviderId: integer('identity_provider_id').references(() => ssoIdentityProviders.id),
  serviceProviderId: integer('service_provider_id').references(() => ssoServiceProviders.id),
  sessionId: varchar('session_id', { length: 255 }).notNull(),
  nameId: varchar('name_id', { length: 255 }), // The NameID from the SAML assertion
  sessionIndex: varchar('session_index', { length: 255 }), // The SessionIndex from the SAML assertion
  authenticationContext: varchar('authentication_context', { length: 255 }), // The AuthnContextClassRef
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  logoutAt: timestamp('logout_at', { withTimezone: true }),
  isActive: boolean('is_active').default(true),
  attributes: jsonb('attributes') // User attributes from the IdP
});

// Create schema for inserting SSO sessions
export const ssoSessionsInsertSchema = createInsertSchema(ssoSessions);
export type SsoSessionInsert = z.infer<typeof ssoSessionsInsertSchema>;

// Create schema for selecting SSO sessions
export const ssoSessionsSelectSchema = createSelectSchema(ssoSessions);
export type SsoSession = z.infer<typeof ssoSessionsSelectSchema>;

/**
 * SSO User Identities Table
 * Maps external user identities to internal users
 */
export const ssoUserIdentities = pgTable('sso_user_identities', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id),
  identityProviderId: integer('identity_provider_id').references(() => ssoIdentityProviders.id),
  externalId: varchar('external_id', { length: 255 }).notNull(), // The user's ID in the external system
  externalEmail: varchar('external_email', { length: 255 }),
  externalUsername: varchar('external_username', { length: 255 }),
  externalDisplayName: varchar('external_display_name', { length: 255 }),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  attributes: jsonb('attributes'), // Additional user attributes from the IdP
  isActive: boolean('is_active').default(true)
});

// Create schema for inserting SSO user identities
export const ssoUserIdentitiesInsertSchema = createInsertSchema(ssoUserIdentities);
export type SsoUserIdentityInsert = z.infer<typeof ssoUserIdentitiesInsertSchema>;

// Create schema for selecting SSO user identities
export const ssoUserIdentitiesSelectSchema = createSelectSchema(ssoUserIdentities);
export type SsoUserIdentity = z.infer<typeof ssoUserIdentitiesSelectSchema>;

/**
 * SSO SAML Artifacts Table
 * Stores SAML artifacts for the artifact binding
 */
export const ssoSamlArtifacts = pgTable('sso_saml_artifacts', {
  id: serial('id').primaryKey(),
  artifact: varchar('artifact', { length: 255 }).notNull().unique(),
  message: text('message').notNull(), // The base64-encoded SAML message
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  isResolved: boolean('is_resolved').default(false)
});

// Create schema for inserting SAML artifacts
export const ssoSamlArtifactsInsertSchema = createInsertSchema(ssoSamlArtifacts);
export type SsoSamlArtifactInsert = z.infer<typeof ssoSamlArtifactsInsertSchema>;

// Create schema for selecting SAML artifacts
export const ssoSamlArtifactsSelectSchema = createSelectSchema(ssoSamlArtifacts);
export type SsoSamlArtifact = z.infer<typeof ssoSamlArtifactsSelectSchema>;

/**
 * SSO OIDC Clients Table
 * Stores OIDC client configurations for internal applications
 */
export const ssoOidcClients = pgTable('sso_oidc_clients', {
  id: serial('id').primaryKey(),
  clientId: varchar('client_id', { length: 255 }).notNull().unique(),
  clientSecret: text('client_secret'),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  redirectUris: jsonb('redirect_uris').notNull(), // Array of allowed redirect URIs
  allowedScopes: jsonb('allowed_scopes').notNull(), // Array of allowed scopes
  allowedGrantTypes: jsonb('allowed_grant_types').notNull(), // Array of allowed grant types
  accessTokenLifetime: integer('access_token_lifetime').default(3600), // In seconds
  refreshTokenLifetime: integer('refresh_token_lifetime').default(86400 * 30), // In seconds
  idTokenLifetime: integer('id_token_lifetime').default(3600), // In seconds
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  createdBy: integer('created_by').references(() => users.id),
  updatedBy: integer('updated_by').references(() => users.id),
  isActive: boolean('is_active').default(true),
  logoUrl: text('logo_url'),
  configJson: jsonb('config_json') // Additional client-specific configurations
});

// Create schema for inserting OIDC clients
export const ssoOidcClientsInsertSchema = createInsertSchema(ssoOidcClients);
export type SsoOidcClientInsert = z.infer<typeof ssoOidcClientsInsertSchema>;

// Create schema for selecting OIDC clients
export const ssoOidcClientsSelectSchema = createSelectSchema(ssoOidcClients);
export type SsoOidcClient = z.infer<typeof ssoOidcClientsSelectSchema>;

/**
 * SSO JWT Keys Table
 * Stores public and private keys for JWT signing
 */
export const ssoJwtKeys = pgTable('sso_jwt_keys', {
  id: serial('id').primaryKey(),
  kid: varchar('kid', { length: 255 }).notNull().unique(), // Key ID
  publicKey: text('public_key').notNull(),
  privateKey: text('private_key'),
  algorithm: varchar('algorithm', { length: 50 }).notNull().default('RS256'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  isActive: boolean('is_active').default(true)
});

// Create schema for inserting JWT keys
export const ssoJwtKeysInsertSchema = createInsertSchema(ssoJwtKeys, {
  algorithm: (schema) => schema.refine(
    value => ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512'].includes(value),
    { message: 'Algorithm must be one of: RS256, RS384, RS512, ES256, ES384, ES512' }
  )
});
export type SsoJwtKeyInsert = z.infer<typeof ssoJwtKeysInsertSchema>;

// Create schema for selecting JWT keys
export const ssoJwtKeysSelectSchema = createSelectSchema(ssoJwtKeys);
export type SsoJwtKey = z.infer<typeof ssoJwtKeysSelectSchema>;

/**
 * SSO Integration Audits Table
 * Tracks SSO-related events for auditing and security
 */
export const ssoAudits = pgTable('sso_audits', {
  id: serial('id').primaryKey(),
  eventType: varchar('event_type', { length: 100 }).notNull(), // 'login', 'logout', 'assertion', 'jwt_issued', etc.
  userId: integer('user_id').references(() => users.id),
  identityProviderId: integer('identity_provider_id').references(() => ssoIdentityProviders.id),
  serviceProviderId: integer('service_provider_id').references(() => ssoServiceProviders.id),
  oidcClientId: integer('oidc_client_id').references(() => ssoOidcClients.id),
  sessionId: varchar('session_id', { length: 255 }),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  details: jsonb('details'), // Event-specific details
  status: varchar('status', { length: 50 }), // 'success', 'failure', 'error'
  errorMessage: text('error_message')
});

// Create schema for inserting SSO audits
export const ssoAuditsInsertSchema = createInsertSchema(ssoAudits, {
  eventType: (schema) => schema.refine(
    value => [
      'login_initiated', 'login_success', 'login_failure', 
      'logout_initiated', 'logout_success', 'logout_failure',
      'saml_assertion_received', 'saml_response_generated',
      'oidc_auth_request', 'oidc_token_issued', 'oidc_token_validation',
      'jwt_issued', 'jwt_validated', 'jwt_expired', 'jwt_revoked'
    ].includes(value),
    { message: 'Invalid event type' }
  ),
  status: (schema) => schema.refine(
    value => value === null || ['success', 'failure', 'error'].includes(value),
    { message: 'Status must be "success", "failure", or "error"' }
  )
});
export type SsoAuditInsert = z.infer<typeof ssoAuditsInsertSchema>;

// Create schema for selecting SSO audits
export const ssoAuditsSelectSchema = createSelectSchema(ssoAudits);
export type SsoAudit = z.infer<typeof ssoAuditsSelectSchema>;