import { pgTable, serial, text, integer, timestamp, json, boolean } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';

/**
 * Certificates table for managing X.509 certificates
 */
export const certificates = pgTable('security_certificates', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  domain: text('domain').notNull(),
  type: text('type').notNull(), // 'ssl', 'client', 'code-signing', etc.
  status: text('status').notNull().default('pending'), // 'pending', 'active', 'expired', 'revoked'
  issuedBy: text('issued_by'), 
  issuedAt: timestamp('issued_at'),
  expiresAt: timestamp('expires_at'),
  serialNumber: text('serial_number'),
  subject: text('subject'),
  issuer: text('issuer'),
  fingerprint: text('fingerprint'),
  publicKey: text('public_key'),
  privateKey: text('private_key'),
  certificate: text('certificate'),
  workspaceId: integer('workspace_id'),
  createdBy: integer('created_by'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});

/**
 * Certificate events table for tracking certificate lifecycle events
 */
export const certificateEvents = pgTable('security_certificate_events', {
  id: serial('id').primaryKey(),
  certificateId: integer('certificate_id').notNull().references(() => certificates.id),
  eventType: text('event_type').notNull(), // 'issued', 'renewed', 'revoked', etc.
  details: json('details'),
  userId: integer('user_id'),
  createdAt: timestamp('created_at').notNull().defaultNow()
});

// Define relations
export const certificatesRelations = relations(certificates, ({ many }) => ({
  events: many(certificateEvents),
}));

export const certificateEventsRelations = relations(certificateEvents, ({ one }) => ({
  certificate: one(certificates, {
    fields: [certificateEvents.certificateId],
    references: [certificates.id],
  }),
}));

// Define zod schemas
export const certificatesInsertSchema = createInsertSchema(certificates, {
  name: (schema) => schema.min(3, "Name must be at least 3 characters"),
  domain: (schema) => schema.min(3, "Domain must be at least 3 characters"),
  type: (schema) => schema.refine(
    (val) => ['ssl', 'client', 'server', 'code-signing', 'document-signing', 'root'].includes(val),
    "Type must be one of: ssl, client, server, code-signing, document-signing, root"
  ),
});

export const certificatesSelectSchema = createSelectSchema(certificates);
export const certificateEventsInsertSchema = createInsertSchema(certificateEvents);
export const certificateEventsSelectSchema = createSelectSchema(certificateEvents);

// Export types
export type Certificate = z.infer<typeof certificatesSelectSchema>;
export type CertificateInsert = z.infer<typeof certificatesInsertSchema>;
export type CertificateEvent = z.infer<typeof certificateEventsSelectSchema>;
export type CertificateEventInsert = z.infer<typeof certificateEventsInsertSchema>;