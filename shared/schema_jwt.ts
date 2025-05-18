import { pgTable, serial, text, boolean, timestamp, integer, json, foreignKey } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';
import { users, workspaces } from './schema';

/**
 * JWT Settings
 */
export const jwtSettings = pgTable('jwt_settings', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  workspaceId: integer('workspace_id').references(() => workspaces.id),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  
  // JWT fields
  audience: text('audience'),
  issuer: text('issuer').notNull(),
  tokenLifetime: integer('token_lifetime').notNull().default(3600), // 1 hour
  refreshTokenLifetime: integer('refresh_token_lifetime').notNull().default(604800), // 7 days
  signingAlgorithm: text('signing_algorithm').notNull().default('RS256'),
  signingKey: text('signing_key'),
  publicKey: text('public_key'),
  useJwks: boolean('use_jwks').notNull().default(false),
  jwksUrl: text('jwks_url'),
  rotationFrequency: integer('rotation_frequency').notNull().default(0), // days, 0 = no rotation
  lastRotated: timestamp('last_rotated'),
  defaultSettings: boolean('default_settings').notNull().default(false),
});

export const jwtSettingsRelations = relations(jwtSettings, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [jwtSettings.workspaceId],
    references: [workspaces.id]
  }),
  claims: many(jwtClaimMappings)
}));

/**
 * JWT Claim Mappings
 */
export const jwtClaimMappings = pgTable('jwt_claim_mappings', {
  id: serial('id').primaryKey(),
  settingsId: integer('settings_id')
    .notNull()
    .references(() => jwtSettings.id, { onDelete: 'cascade' }),
  claimName: text('claim_name').notNull(),
  sourceType: text('source_type').notNull(), // user_property, user_metadata, custom, function, constant
  sourcePath: text('source_path'),
  defaultValue: text('default_value'),
  transform: text('transform'),
  isRequired: boolean('is_required').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const jwtClaimMappingsRelations = relations(jwtClaimMappings, ({ one }) => ({
  settings: one(jwtSettings, {
    fields: [jwtClaimMappings.settingsId],
    references: [jwtSettings.id]
  })
}));

/**
 * JWT Token Audit
 */
export const jwtTokenAudit = pgTable('jwt_token_audit', {
  id: serial('id').primaryKey(),
  settingsId: integer('settings_id')
    .references(() => jwtSettings.id, { onDelete: 'set null' }),
  userId: integer('user_id')
    .references(() => users.id, { onDelete: 'set null' }),
  tokenId: text('token_id').notNull(), // jti claim
  issuedAt: timestamp('issued_at').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  clientIp: text('client_ip'),
  userAgent: text('user_agent'),
  isRevoked: boolean('is_revoked').notNull().default(false),
  revokedAt: timestamp('revoked_at'),
  revokedBy: integer('revoked_by')
    .references(() => users.id, { onDelete: 'set null' }),
  reason: text('reason'),
  purpose: text('purpose'),
  metadata: json('metadata'),
});

export const jwtTokenAuditRelations = relations(jwtTokenAudit, ({ one }) => ({
  settings: one(jwtSettings, {
    fields: [jwtTokenAudit.settingsId],
    references: [jwtSettings.id]
  }),
  user: one(users, {
    fields: [jwtTokenAudit.userId],
    references: [users.id]
  }),
  revokedByUser: one(users, {
    fields: [jwtTokenAudit.revokedBy],
    references: [users.id]
  })
}));

// Zod schemas
export const jwtSettingsSchema = createSelectSchema(jwtSettings);
export const jwtSettingsInsertSchema = createInsertSchema(jwtSettings, {
  name: (schema) => schema.min(3, "Name must be at least 3 characters"),
  issuer: (schema) => schema.min(1, "Issuer is required"),
  tokenLifetime: (schema) => schema.positive().min(60, "Token lifetime must be at least 60 seconds"),
  refreshTokenLifetime: (schema) => schema.positive().min(300, "Refresh token lifetime must be at least 300 seconds"),
  signingAlgorithm: (schema) => z.enum([
    "RS256", "RS384", "RS512", 
    "HS256", "HS384", "HS512", 
    "ES256", "ES384", "ES512"
  ], {
    required_error: "Signing algorithm is required",
    invalid_type_error: "Invalid signing algorithm",
  })
});

export const jwtClaimSchema = createSelectSchema(jwtClaimMappings);
export const jwtClaimInsertSchema = createInsertSchema(jwtClaimMappings, {
  claimName: (schema) => schema.min(1, "Claim name is required"),
  sourceType: (schema) => z.enum([
    "user_property", "user_metadata", "custom", "function", "constant"
  ], {
    required_error: "Source type is required",
    invalid_type_error: "Invalid source type",
  })
});

export const jwtTokenAuditSchema = createSelectSchema(jwtTokenAudit);
export const jwtTokenAuditInsertSchema = createInsertSchema(jwtTokenAudit);

// Export types
export type JwtSettings = z.infer<typeof jwtSettingsSchema>;
export type JwtSettingsInsert = z.infer<typeof jwtSettingsInsertSchema>;
export type JwtClaimMapping = z.infer<typeof jwtClaimSchema>;
export type JwtClaimMappingInsert = z.infer<typeof jwtClaimInsertSchema>;
export type JwtTokenAudit = z.infer<typeof jwtTokenAuditSchema>;
export type JwtTokenAuditInsert = z.infer<typeof jwtTokenAuditInsertSchema>;