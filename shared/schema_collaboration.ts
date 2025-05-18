/**
 * Collaboration System Schema
 * 
 * This file defines the database schema for the real-time collaboration 
 * annotation system.
 */

import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';

/**
 * Annotations Table
 * Stores user annotations/comments on different resources in the system
 */
export const annotations = pgTable('collaboration_annotations', {
  id: serial('id').primaryKey(),
  content: text('content').notNull(),
  targetType: text('target_type').notNull(), // Type of resource (policy, tool, agent, etc.)
  targetId: text('target_id').notNull(), // ID of the target resource
  position: jsonb('position'), // Visual position data (x,y coordinates, selection range, etc.)
  style: jsonb('style'), // Visual styling data (color, etc.)
  workspaceId: integer('workspace_id'),
  creatorId: integer('creator_id').notNull(),
  isPrivate: boolean('is_private').default(false),
  isResolved: boolean('is_resolved').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

/**
 * Annotation Replies Table
 * Stores replies to annotations
 */
export const annotationReplies = pgTable('collaboration_annotation_replies', {
  id: serial('id').primaryKey(),
  annotationId: integer('annotation_id')
    .notNull()
    .references(() => annotations.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  userId: integer('user_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

/**
 * Annotation Mentions Table
 * Stores mentions of users in annotations or replies
 */
export const annotationMentions = pgTable('collaboration_annotation_mentions', {
  id: serial('id').primaryKey(),
  annotationId: integer('annotation_id').references(() => annotations.id, { onDelete: 'cascade' }),
  replyId: integer('reply_id').references(() => annotationReplies.id, { onDelete: 'cascade' }),
  userId: integer('user_id').notNull().references(() => import('./schema').users.id),
  createdAt: timestamp('created_at').defaultNow().notNull()
});

/**
 * Annotations Relations
 */
export const annotationsRelations = relations(annotations, ({ many, one }) => ({
  replies: many(annotationReplies),
  mentions: many(annotationMentions),
  creator: one(import('./schema').users, {
    fields: [annotations.creatorId],
    references: [import('./schema').users.id]
  }),
  workspace: one(import('./schema').workspaces, {
    fields: [annotations.workspaceId],
    references: [import('./schema').workspaces.id]
  })
}));

/**
 * Annotation Replies Relations
 */
export const annotationRepliesRelations = relations(annotationReplies, ({ one, many }) => ({
  annotation: one(annotations, {
    fields: [annotationReplies.annotationId],
    references: [annotations.id]
  }),
  user: one(import('./schema').users, {
    fields: [annotationReplies.userId],
    references: [import('./schema').users.id]
  }),
  mentions: many(annotationMentions)
}));

/**
 * Annotation Mentions Relations
 */
export const annotationMentionsRelations = relations(annotationMentions, ({ one }) => ({
  annotation: one(annotations, {
    fields: [annotationMentions.annotationId],
    references: [annotations.id]
  }),
  reply: one(annotationReplies, {
    fields: [annotationMentions.replyId],
    references: [annotationReplies.id]
  }),
  user: one(import('./schema').users, {
    fields: [annotationMentions.userId],
    references: [import('./schema').users.id]
  })
}));

/**
 * Zod Schemas for Validation
 */

// Schema for inserting annotations
export const annotationsInsertSchema = createInsertSchema(annotations, {
  content: (schema) => schema.min(1, "Annotation content cannot be empty"),
  targetType: (schema) => schema.min(1, "Target type cannot be empty"),
  targetId: (schema) => schema.min(1, "Target ID cannot be empty")
});

// Schema for inserting annotation replies
export const annotationRepliesInsertSchema = createInsertSchema(annotationReplies, {
  content: (schema) => schema.min(1, "Reply content cannot be empty")
});

// Schema for inserting annotation mentions
export const annotationMentionsInsertSchema = createInsertSchema(annotationMentions);

// TypeScript types based on schemas
export type Annotation = typeof annotations.$inferSelect;
export type AnnotationInsert = z.infer<typeof annotationsInsertSchema>;
export type AnnotationReply = typeof annotationReplies.$inferSelect;
export type AnnotationReplyInsert = z.infer<typeof annotationRepliesInsertSchema>;
export type AnnotationMention = typeof annotationMentions.$inferSelect;
export type AnnotationMentionInsert = z.infer<typeof annotationMentionsInsertSchema>;