import { db, pool } from '../index';
import * as schema from '../../shared/schema_collaboration';
import { jsonb, pgTable, text, integer, serial, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { migrate } from 'drizzle-orm/pg-core/migrations';
import { createAuditLog } from '../../server/services/auditLogService';

/**
 * Migration: Add Collaboration System
 * 
 * This migration adds the necessary tables for the real-time collaboration
 * annotation system, including annotations, replies, and mentions.
 */
// Add a main function to run the migration directly
async function main() {
  console.log('Starting Collaboration System migration...');
  const result = await up();
  console.log('Migration completed with result:', result);
}

// Call main function directly (for ES modules)
main().catch(console.error);

export async function up() {
  console.log('Running Collaboration System migration...');
  
  try {
    // Create annotations table
    await db.execute(/*sql*/`
      CREATE TABLE IF NOT EXISTS "collaboration_annotations" (
        "id" SERIAL PRIMARY KEY,
        "content" TEXT NOT NULL,
        "target_type" TEXT NOT NULL,
        "target_id" TEXT NOT NULL,
        "position" JSONB,
        "style" JSONB,
        "workspace_id" INTEGER REFERENCES "workspaces"("id"),
        "creator_id" INTEGER NOT NULL REFERENCES "users"("id"),
        "is_private" BOOLEAN DEFAULT false,
        "is_resolved" BOOLEAN DEFAULT false,
        "created_at" TIMESTAMP DEFAULT now() NOT NULL,
        "updated_at" TIMESTAMP DEFAULT now() NOT NULL
      );
    `);
    
    // Create annotation replies table
    await db.execute(/*sql*/`
      CREATE TABLE IF NOT EXISTS "collaboration_annotation_replies" (
        "id" SERIAL PRIMARY KEY,
        "annotation_id" INTEGER NOT NULL REFERENCES "collaboration_annotations"("id") ON DELETE CASCADE,
        "content" TEXT NOT NULL,
        "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
        "created_at" TIMESTAMP DEFAULT now() NOT NULL,
        "updated_at" TIMESTAMP DEFAULT now() NOT NULL
      );
    `);
    
    // Create annotation mentions table
    await db.execute(/*sql*/`
      CREATE TABLE IF NOT EXISTS "collaboration_annotation_mentions" (
        "id" SERIAL PRIMARY KEY,
        "annotation_id" INTEGER REFERENCES "collaboration_annotations"("id") ON DELETE CASCADE,
        "reply_id" INTEGER REFERENCES "collaboration_annotation_replies"("id") ON DELETE CASCADE,
        "user_id" INTEGER NOT NULL REFERENCES "users"("id"),
        "created_at" TIMESTAMP DEFAULT now() NOT NULL
      );
    `);
    
    // Create indexes for faster lookups
    await db.execute(/*sql*/`
      CREATE INDEX IF NOT EXISTS "annotations_workspace_id_idx" ON "collaboration_annotations"("workspace_id");
      CREATE INDEX IF NOT EXISTS "annotations_creator_id_idx" ON "collaboration_annotations"("creator_id");
      CREATE INDEX IF NOT EXISTS "annotations_target_idx" ON "collaboration_annotations"("target_type", "target_id");
      CREATE INDEX IF NOT EXISTS "annotation_replies_annotation_id_idx" ON "collaboration_annotation_replies"("annotation_id");
      CREATE INDEX IF NOT EXISTS "annotation_replies_user_id_idx" ON "collaboration_annotation_replies"("user_id");
      CREATE INDEX IF NOT EXISTS "annotation_mentions_user_id_idx" ON "collaboration_annotation_mentions"("user_id");
    `);

    console.log('Collaboration System tables created successfully');
    return true;
  } catch (error) {
    console.error('Error in Collaboration System migration:', error);
    return false;
  }
}

export async function down() {
  try {
    // Drop tables in reverse order to avoid constraint issues
    await db.execute(/*sql*/`
      DROP TABLE IF EXISTS "collaboration_annotation_mentions";
      DROP TABLE IF EXISTS "collaboration_annotation_replies";
      DROP TABLE IF EXISTS "collaboration_annotations";
    `);
    
    console.log('Collaboration System tables dropped successfully');
    return true;
  } catch (error) {
    console.error('Error rolling back Collaboration System migration:', error);
    return false;
  }
}