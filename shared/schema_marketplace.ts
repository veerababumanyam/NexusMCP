import { pgTable, serial, text, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';
import { users, workspaces } from './schema';

// Connector categories
export const connectorCategories = pgTable('connector_categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  parentId: integer('parent_id').references(() => connectorCategories.id),
  iconUrl: text('icon_url'),
  position: integer('position').default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Connector publishers
export const connectorPublishers = pgTable('connector_publishers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  websiteUrl: text('website_url'),
  logoUrl: text('logo_url'),
  email: text('email'),
  isVerified: boolean('is_verified').default(false),
  isOfficial: boolean('is_official').default(false),
  isActive: boolean('is_active').default(true),
  ownerId: integer('owner_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Connectors
export const connectors = pgTable('connectors', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  shortDescription: text('short_description'),
  categoryId: integer('category_id').references(() => connectorCategories.id).notNull(),
  publisherId: integer('publisher_id').references(() => connectorPublishers.id).notNull(),
  version: text('version').notNull().default('1.0.0'),
  iconUrl: text('icon_url'),
  bannerUrl: text('banner_url'),
  websiteUrl: text('website_url'),
  repositoryUrl: text('repository_url'),
  documentationUrl: text('documentation_url'),
  supportUrl: text('support_url'),
  licenseName: text('license_name'),
  licenseUrl: text('license_url'),
  downloadCount: integer('download_count').default(0),
  rating: integer('rating').default(0),
  reviewCount: integer('review_count').default(0),
  isFeatured: boolean('is_featured').default(false),
  isVerified: boolean('is_verified').default(false),
  isOfficial: boolean('is_official').default(false),
  isApproved: boolean('is_approved').default(false),
  isActive: boolean('is_active').default(true),
  approvedAt: timestamp('approved_at'),
  approvedById: integer('approved_by_id').references(() => users.id),
  configSchema: jsonb('config_schema'),
  packageType: text('package_type').notNull().default('npm'),
  packageName: text('package_name'),
  packageVersion: text('package_version'),
  requiredPermissions: jsonb('required_permissions'),
  capabilities: jsonb('capabilities'),
  createdById: integer('created_by_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Connector versions
export const connectorVersions = pgTable('connector_versions', {
  id: serial('id').primaryKey(),
  connectorId: integer('connector_id').references(() => connectors.id).notNull(),
  version: text('version').notNull(),
  changelog: text('changelog'),
  isActive: boolean('is_active').default(true),
  isLatest: boolean('is_latest').default(false),
  packageVersion: text('package_version'),
  configSchema: jsonb('config_schema'),
  downloadUrl: text('download_url'),
  checksumSha256: text('checksum_sha256'),
  requiredPermissions: jsonb('required_permissions'),
  capabilities: jsonb('capabilities'),
  minSystemVersion: text('min_system_version'),
  maxSystemVersion: text('max_system_version'),
  releaseNotes: text('release_notes'),
  createdById: integer('created_by_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Connector installations
export const connectorInstallations = pgTable('connector_installations', {
  id: serial('id').primaryKey(),
  connectorId: integer('connector_id').references(() => connectors.id).notNull(),
  versionId: integer('version_id').references(() => connectorVersions.id).notNull(),
  workspaceId: integer('workspace_id').references(() => workspaces.id),
  userId: integer('user_id').references(() => users.id).notNull(),
  isActive: boolean('is_active').default(true),
  settings: jsonb('settings'),
  status: text('status').notNull().default('installed'),
  lastUsedAt: timestamp('last_used_at'),
  installedAt: timestamp('installed_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Connector reviews
export const connectorReviews = pgTable('connector_reviews', {
  id: serial('id').primaryKey(),
  connectorId: integer('connector_id').references(() => connectors.id).notNull(),
  userId: integer('user_id').references(() => users.id).notNull(),
  rating: integer('rating').notNull(),
  title: text('title'),
  content: text('content'),
  isVisible: boolean('is_visible').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Connector tags
export const connectorTags = pgTable('connector_tags', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Connector tag relations (many-to-many)
export const connectorTagRelations = pgTable('connector_tag_relations', {
  id: serial('id').primaryKey(),
  connectorId: integer('connector_id').references(() => connectors.id).notNull(),
  tagId: integer('tag_id').references(() => connectorTags.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

// Define relationships

export const connectorCategoriesRelations = relations(connectorCategories, ({ one, many }) => ({
  parent: one(connectorCategories, {
    fields: [connectorCategories.parentId],
    references: [connectorCategories.id]
  }),
  subcategories: many(connectorCategories, {
    relationName: 'parent'
  }),
  connectors: many(connectors)
}));

export const connectorPublishersRelations = relations(connectorPublishers, ({ one, many }) => ({
  owner: one(users, {
    fields: [connectorPublishers.ownerId],
    references: [users.id]
  }),
  connectors: many(connectors)
}));

export const connectorsRelations = relations(connectors, ({ one, many }) => ({
  category: one(connectorCategories, {
    fields: [connectors.categoryId],
    references: [connectorCategories.id]
  }),
  publisher: one(connectorPublishers, {
    fields: [connectors.publisherId],
    references: [connectorPublishers.id]
  }),
  versions: many(connectorVersions),
  installations: many(connectorInstallations),
  reviews: many(connectorReviews),
  tagRelations: many(connectorTagRelations),
  createdBy: one(users, {
    fields: [connectors.createdById],
    references: [users.id]
  }),
  approvedBy: one(users, {
    fields: [connectors.approvedById],
    references: [users.id]
  })
}));

export const connectorVersionsRelations = relations(connectorVersions, ({ one, many }) => ({
  connector: one(connectors, {
    fields: [connectorVersions.connectorId],
    references: [connectors.id]
  }),
  installations: many(connectorInstallations),
  createdBy: one(users, {
    fields: [connectorVersions.createdById],
    references: [users.id]
  })
}));

export const connectorInstallationsRelations = relations(connectorInstallations, ({ one }) => ({
  connector: one(connectors, {
    fields: [connectorInstallations.connectorId],
    references: [connectors.id]
  }),
  version: one(connectorVersions, {
    fields: [connectorInstallations.versionId],
    references: [connectorVersions.id]
  }),
  user: one(users, {
    fields: [connectorInstallations.userId],
    references: [users.id]
  }),
  workspace: one(workspaces, {
    fields: [connectorInstallations.workspaceId],
    references: [workspaces.id]
  })
}));

export const connectorReviewsRelations = relations(connectorReviews, ({ one }) => ({
  connector: one(connectors, {
    fields: [connectorReviews.connectorId],
    references: [connectors.id]
  }),
  user: one(users, {
    fields: [connectorReviews.userId],
    references: [users.id]
  })
}));

export const connectorTagRelationsRelations = relations(connectorTagRelations, ({ one }) => ({
  connector: one(connectors, {
    fields: [connectorTagRelations.connectorId],
    references: [connectors.id]
  }),
  tag: one(connectorTags, {
    fields: [connectorTagRelations.tagId],
    references: [connectorTags.id]
  })
}));

// Zod validation schemas

export const connectorCategoryInsertSchema = createInsertSchema(connectorCategories, {
  name: (schema) => schema.min(2, "Category name must be at least 2 characters"),
  slug: (schema) => schema.min(2, "Slug must be at least 2 characters").regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")
});
export type ConnectorCategoryInsert = z.infer<typeof connectorCategoryInsertSchema>;
export const connectorCategorySelectSchema = createSelectSchema(connectorCategories);
export type ConnectorCategory = z.infer<typeof connectorCategorySelectSchema>;

export const connectorPublisherInsertSchema = createInsertSchema(connectorPublishers, {
  name: (schema) => schema.min(2, "Publisher name must be at least 2 characters"),
  slug: (schema) => schema.min(2, "Slug must be at least 2 characters").regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  email: (schema) => schema.email("Must provide a valid email").optional()
});
export type ConnectorPublisherInsert = z.infer<typeof connectorPublisherInsertSchema>;
export const connectorPublisherSelectSchema = createSelectSchema(connectorPublishers);
export type ConnectorPublisher = z.infer<typeof connectorPublisherSelectSchema>;

export const connectorInsertSchema = createInsertSchema(connectors, {
  name: (schema) => schema.min(2, "Connector name must be at least 2 characters"),
  slug: (schema) => schema.min(2, "Slug must be at least 2 characters").regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens"),
  version: (schema) => schema.regex(/^\d+\.\d+\.\d+$/, "Version must be in format x.y.z (semver)")
});
export type ConnectorInsert = z.infer<typeof connectorInsertSchema>;
export const connectorSelectSchema = createSelectSchema(connectors);
export type Connector = z.infer<typeof connectorSelectSchema>;

export const connectorVersionInsertSchema = createInsertSchema(connectorVersions, {
  version: (schema) => schema.regex(/^\d+\.\d+\.\d+$/, "Version must be in format x.y.z (semver)")
});
export type ConnectorVersionInsert = z.infer<typeof connectorVersionInsertSchema>;
export const connectorVersionSelectSchema = createSelectSchema(connectorVersions);
export type ConnectorVersion = z.infer<typeof connectorVersionSelectSchema>;

export const connectorInstallationInsertSchema = createInsertSchema(connectorInstallations);
export type ConnectorInstallationInsert = z.infer<typeof connectorInstallationInsertSchema>;
export const connectorInstallationSelectSchema = createSelectSchema(connectorInstallations);
export type ConnectorInstallation = z.infer<typeof connectorInstallationSelectSchema>;

export const connectorReviewInsertSchema = createInsertSchema(connectorReviews, {
  rating: (schema) => schema.min(1, "Rating must be at least 1").max(5, "Rating cannot be more than 5")
});
export type ConnectorReviewInsert = z.infer<typeof connectorReviewInsertSchema>;
export const connectorReviewSelectSchema = createSelectSchema(connectorReviews);
export type ConnectorReview = z.infer<typeof connectorReviewSelectSchema>;

export const connectorTagInsertSchema = createInsertSchema(connectorTags, {
  name: (schema) => schema.min(2, "Tag name must be at least 2 characters"),
  slug: (schema) => schema.min(2, "Slug must be at least 2 characters").regex(/^[a-z0-9-]+$/, "Slug must contain only lowercase letters, numbers, and hyphens")
});
export type ConnectorTagInsert = z.infer<typeof connectorTagInsertSchema>;
export const connectorTagSelectSchema = createSelectSchema(connectorTags);
export type ConnectorTag = z.infer<typeof connectorTagSelectSchema>;

export const connectorTagRelationInsertSchema = createInsertSchema(connectorTagRelations);
export type ConnectorTagRelationInsert = z.infer<typeof connectorTagRelationInsertSchema>;
export const connectorTagRelationSelectSchema = createSelectSchema(connectorTagRelations);
export type ConnectorTagRelation = z.infer<typeof connectorTagRelationSelectSchema>;