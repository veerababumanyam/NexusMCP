import { pgTable, serial, text, timestamp, boolean, integer, date, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';

/**
 * Security Certificates table
 */
export const securityCertificates = pgTable('security_certificates', {
  id: serial('id').primaryKey(),
  workspaceId: integer('workspace_id'),
  name: text('name').notNull(),
  type: text('type').notNull(), // ssl, client, ca, signing
  status: text('status').notNull().default('active'), // active, expired, revoked
  domains: jsonb('domains').$type<string[]>(), // For SSL certificates
  certificate: text('certificate').notNull(), // PEM encoded certificate
  privateKey: text('private_key'), // PEM encoded private key
  passphrase: text('passphrase'), // Optional passphrase for private key
  issuer: text('issuer'),
  subject: text('subject'),
  serialNumber: text('serial_number'),
  validFrom: date('valid_from'),
  validTo: date('valid_to'),
  fingerprint: text('fingerprint'),
  keyUsage: jsonb('key_usage').$type<string[]>(),
  autoRenew: boolean('auto_renew').default(false),
  renewalDate: timestamp('renewal_date'),
  renewedBy: integer('renewed_by'),
  revocationDate: timestamp('revocation_date'),
  revocationReason: text('revocation_reason'),
  revokedBy: integer('revoked_by'),
  tags: jsonb('tags').$type<string[]>(),
  createdBy: integer('created_by'),
  updatedBy: integer('updated_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

/**
 * Certificate History table
 */
export const securityCertificateHistory = pgTable('security_certificate_history', {
  id: serial('id').primaryKey(),
  certificateId: integer('certificate_id').notNull(),
  action: text('action').notNull(), // created, updated, revoked, renewed, deleted
  details: jsonb('details').notNull(),
  userId: integer('user_id'),
  timestamp: timestamp('timestamp').notNull().defaultNow()
});

// Define relations
export const securityCertificatesRelations = relations(securityCertificates, ({ many }) => ({
  history: many(securityCertificateHistory)
}));

export const securityCertificateHistoryRelations = relations(securityCertificateHistory, ({ one }) => ({
  certificate: one(securityCertificates, {
    fields: [securityCertificateHistory.certificateId],
    references: [securityCertificates.id]
  })
}));

// Define schemas for validation
export const createSecurityCertificatesSchema = createInsertSchema(securityCertificates, {
  name: (schema) => schema.min(1, "Certificate name is required"),
  certificate: (schema) => schema.min(1, "Certificate data is required"),
  type: (schema) => schema.refine(type => 
    ['ssl', 'client', 'ca', 'signing'].includes(type), 
    "Invalid certificate type"
  )
});

export const createCertificateHistorySchema = createInsertSchema(securityCertificateHistory, {
  action: (schema) => schema.refine(action => 
    ['created', 'updated', 'revoked', 'renewed', 'deleted'].includes(action), 
    "Invalid action type"
  )
});

export const securityCertificatesSelectSchema = createSelectSchema(securityCertificates);
export const securityCertificateHistorySelectSchema = createSelectSchema(securityCertificateHistory);

// Export types
export type SecurityCertificate = z.infer<typeof securityCertificatesSelectSchema>;
export type SecurityCertificateInsert = z.infer<typeof createSecurityCertificatesSchema>;
export type CertificateHistory = z.infer<typeof securityCertificateHistorySelectSchema>;
export type CertificateHistoryInsert = z.infer<typeof createCertificateHistorySchema>;