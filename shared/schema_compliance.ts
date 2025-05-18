import { pgTable, serial, text, integer, timestamp, boolean, json, jsonb, date } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';

// Data inventory
export const dataInventory = pgTable('compliance_data_inventory', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  dataType: text('data_type').notNull(), // Personal, Sensitive, Business, Financial, Health, etc.
  dataFormat: text('data_format').notNull(), // Structured, Unstructured
  sourceSystem: text('source_system').notNull(),
  storageLocation: text('storage_location').notNull(),
  retentionPeriod: text('retention_period'),
  dataOwner: text('data_owner'),
  classification: text('classification').notNull(), // Public, Internal, Confidential, Restricted
  piiElements: json('pii_elements').$type<string[]>(),
  securityControls: jsonb('security_controls'),
  regulatoryFrameworks: json('regulatory_frameworks').$type<string[]>(), // GDPR, CCPA, HIPAA, etc.
  dataSubjectTypes: json('data_subject_types').$type<string[]>(), // Customers, Employees, Patients, etc.
  dataFlowDiagram: text('data_flow_diagram'),
  lastReviewDate: timestamp('last_review_date'),
  reviewFrequency: text('review_frequency'),
  accessRestrictions: jsonb('access_restrictions'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Privacy request types
export const privacyRequestTypes = pgTable('compliance_privacy_request_types', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(), // Access, Deletion, Correction, Opt-out, etc.
  regulatoryBasis: json('regulatory_basis').$type<string[]>(), // GDPR Article 15, CCPA Section 1798.100, etc.
  requiredVerification: text('required_verification').notNull(), // None, Basic, Enhanced, etc.
  responseTimeFrame: integer('response_timeframe').notNull(), // in days
  applicableJurisdictions: json('applicable_jurisdictions').$type<string[]>(),
  defaultWorkflow: jsonb('default_workflow'),
  notificationTemplate: text('notification_template'),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Privacy requests
export const privacyRequests = pgTable('compliance_privacy_requests', {
  id: serial('id').primaryKey(),
  requestTypeId: integer('request_type_id').notNull().references(() => privacyRequestTypes.id),
  identifier: text('identifier').notNull(), // Unique reference number
  requestorName: text('requestor_name').notNull(),
  requestorEmail: text('requestor_email').notNull(),
  dataSubjectName: text('data_subject_name').notNull(),
  dataSubjectId: text('data_subject_id'), // User ID, Customer ID, etc.
  status: text('status').notNull().default('submitted'), // submitted, verification_needed, in_progress, completed, denied
  requestDetails: jsonb('request_details'),
  submittedAt: timestamp('submitted_at').defaultNow().notNull(),
  dueDate: date('due_date').notNull(),
  completedAt: timestamp('completed_at'),
  lastUpdatedAt: timestamp('last_updated_at').defaultNow().notNull(),
  lastUpdatedBy: integer('last_updated_by'),
  assignedTo: integer('assigned_to'),
  verificationStatus: text('verification_status').default('pending'), // pending, verified, failed
  verificationMethod: text('verification_method'),
  verificationDate: timestamp('verification_date'),
  notes: text('notes'),
  resolution: jsonb('resolution'),
  affectedSystems: json('affected_systems').$type<string[]>(),
});

// Privacy request events
export const privacyRequestEvents = pgTable('compliance_privacy_request_events', {
  id: serial('id').primaryKey(),
  requestId: integer('request_id').notNull().references(() => privacyRequests.id),
  eventType: text('event_type').notNull(), // status_change, note_added, assigned, verification, etc.
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  userId: integer('user_id'),
  details: jsonb('details'),
  systemGenerated: boolean('system_generated').default(false),
});

// Consent records
export const consentRecords = pgTable('compliance_consent_records', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  purposeId: integer('purpose_id').notNull().references(() => consentPurposes.id),
  status: text('status').notNull(), // granted, denied, withdrawn
  collectionMethod: text('collection_method').notNull(), // form, api, cookie banner, etc.
  collectionTimestamp: timestamp('collection_timestamp').defaultNow().notNull(),
  expiryDate: timestamp('expiry_date'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  consentVersion: text('consent_version').notNull(),
  dataCategories: json('data_categories').$type<string[]>(),
  proof: jsonb('proof'), // Stored proof of consent
  lastUpdated: timestamp('last_updated').defaultNow().notNull(),
  jurisdictionId: integer('jurisdiction_id'),
  identityVerification: jsonb('identity_verification'),
});

// Consent purposes
export const consentPurposes = pgTable('compliance_consent_purposes', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  legalBasis: text('legal_basis').notNull(), // Consent, Legitimate Interest, Contract, Legal Obligation, etc.
  dataCategories: json('data_categories').$type<string[]>(),
  retentionPeriod: text('retention_period'),
  isEssential: boolean('is_essential').default(false),
  isActive: boolean('is_active').default(true),
  consentVersion: text('consent_version').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  jurisdictionRules: jsonb('jurisdiction_rules'), // Different rules per jurisdiction
  requiresExplicitConsent: boolean('requires_explicit_consent').default(true),
  displayOrder: integer('display_order'),
});

// Data Processing Activities
export const dataProcessingActivities = pgTable('compliance_data_processing_activities', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  purposeId: integer('purpose_id').references(() => consentPurposes.id),
  processor: text('processor').notNull(), // Internal team or third-party processor
  processingType: text('processing_type').notNull(), // collection, storage, use, disclosure, etc.
  legalBasis: text('legal_basis').notNull(),
  dataCategories: json('data_categories').$type<string[]>(),
  dataSubjects: json('data_subjects').$type<string[]>(),
  crossBorderTransfers: boolean('cross_border_transfers').default(false),
  transferMechanisms: jsonb('transfer_mechanisms'),
  securityMeasures: jsonb('security_measures'),
  retentionPeriod: text('retention_period'),
  riskLevel: text('risk_level'), // low, medium, high
  dpiaRequired: boolean('dpia_required').default(false),
  dpiaCompleted: boolean('dpia_completed').default(false),
  lastReviewDate: timestamp('last_review_date'),
  reviewFrequency: text('review_frequency'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const privacyRequestsRelations = relations(privacyRequests, ({ one, many }) => ({
  requestType: one(privacyRequestTypes, {
    fields: [privacyRequests.requestTypeId],
    references: [privacyRequestTypes.id],
  }),
  events: many(privacyRequestEvents),
}));

export const privacyRequestEventsRelations = relations(privacyRequestEvents, ({ one }) => ({
  request: one(privacyRequests, {
    fields: [privacyRequestEvents.requestId],
    references: [privacyRequests.id],
  }),
}));

export const consentRecordsRelations = relations(consentRecords, ({ one }) => ({
  purpose: one(consentPurposes, {
    fields: [consentRecords.purposeId],
    references: [consentPurposes.id],
  }),
}));

export const consentPurposesRelations = relations(consentPurposes, ({ many }) => ({
  records: many(consentRecords),
  dataProcessingActivities: many(dataProcessingActivities),
}));

export const dataProcessingActivitiesRelations = relations(dataProcessingActivities, ({ one }) => ({
  purpose: one(consentPurposes, {
    fields: [dataProcessingActivities.purposeId],
    references: [consentPurposes.id],
  }),
}));

// Zod schemas
export const dataInventoryInsertSchema = createInsertSchema(dataInventory, {
  name: (schema) => schema.min(3, "Name must be at least 3 characters"),
  description: (schema) => schema.min(10, "Description must be at least 10 characters"),
  dataType: (schema) => schema.refine(
    (val) => ['Personal', 'Sensitive', 'Business', 'Financial', 'Health'].includes(val),
    "Data type must be one of: Personal, Sensitive, Business, Financial, Health"
  ),
  classification: (schema) => schema.refine(
    (val) => ['Public', 'Internal', 'Confidential', 'Restricted'].includes(val),
    "Classification must be one of: Public, Internal, Confidential, Restricted"
  ),
});

export const privacyRequestTypeInsertSchema = createInsertSchema(privacyRequestTypes, {
  name: (schema) => schema.min(3, "Name must be at least 3 characters"),
  description: (schema) => schema.min(10, "Description must be at least 10 characters"),
  category: (schema) => schema.refine(
    (val) => ['Access', 'Deletion', 'Correction', 'Opt-out', 'Portability'].includes(val),
    "Category must be one of: Access, Deletion, Correction, Opt-out, Portability"
  ),
});

export const privacyRequestInsertSchema = createInsertSchema(privacyRequests, {
  requestorName: (schema) => schema.min(3, "Requestor name must be at least 3 characters"),
  requestorEmail: (schema) => schema.email("Must be a valid email address"),
  dataSubjectName: (schema) => schema.min(3, "Data subject name must be at least 3 characters"),
  status: (schema) => schema.refine(
    (val) => ['submitted', 'verification_needed', 'in_progress', 'completed', 'denied'].includes(val),
    "Status must be one of: submitted, verification_needed, in_progress, completed, denied"
  ),
});

export const consentPurposeInsertSchema = createInsertSchema(consentPurposes, {
  name: (schema) => schema.min(3, "Name must be at least 3 characters"),
  description: (schema) => schema.min(10, "Description must be at least 10 characters"),
  legalBasis: (schema) => schema.refine(
    (val) => ['Consent', 'Legitimate Interest', 'Contract', 'Legal Obligation', 'Vital Interest', 'Public Task'].includes(val),
    "Legal basis must be one of: Consent, Legitimate Interest, Contract, Legal Obligation, Vital Interest, Public Task"
  ),
});

export const dataInventoryUpdateSchema = dataInventoryInsertSchema.partial();
export const privacyRequestTypeUpdateSchema = privacyRequestTypeInsertSchema.partial();
export const privacyRequestUpdateSchema = privacyRequestInsertSchema.partial();
export const consentPurposeUpdateSchema = consentPurposeInsertSchema.partial();

export type DataInventory = z.infer<typeof createSelectSchema(dataInventory)>;
export type DataInventoryInsert = z.infer<typeof dataInventoryInsertSchema>;
export type DataInventoryUpdate = z.infer<typeof dataInventoryUpdateSchema>;

export type PrivacyRequestType = z.infer<typeof createSelectSchema(privacyRequestTypes)>;
export type PrivacyRequestTypeInsert = z.infer<typeof privacyRequestTypeInsertSchema>;
export type PrivacyRequestTypeUpdate = z.infer<typeof privacyRequestTypeUpdateSchema>;

export type PrivacyRequest = z.infer<typeof createSelectSchema(privacyRequests)>;
export type PrivacyRequestInsert = z.infer<typeof privacyRequestInsertSchema>;
export type PrivacyRequestUpdate = z.infer<typeof privacyRequestUpdateSchema>;

export type ConsentPurpose = z.infer<typeof createSelectSchema(consentPurposes)>;
export type ConsentPurposeInsert = z.infer<typeof consentPurposeInsertSchema>;
export type ConsentPurposeUpdate = z.infer<typeof consentPurposeUpdateSchema>;

export type ConsentRecord = z.infer<typeof createSelectSchema(consentRecords)>;
export type DataProcessingActivity = z.infer<typeof createSelectSchema(dataProcessingActivities)>;
export type PrivacyRequestEvent = z.infer<typeof createSelectSchema(privacyRequestEvents)>;