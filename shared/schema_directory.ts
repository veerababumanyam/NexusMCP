/**
 * Directory Service Integration Schema
 * 
 * This schema defines the tables and relationships for directory service integration:
 * - LDAP/Active Directory connections
 * - Directory user/group synchronization
 * - Directory sync configuration and audit
 */

import { pgTable, serial, text, timestamp, integer, boolean, jsonb } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { relations } from 'drizzle-orm';
import { z } from 'zod';
import { roles } from './schema';

/**
 * LDAP Directory Configuration
 */
export const ldapDirectories = pgTable('ldap_directories', {
  id: serial('id').primaryKey(),
  workspaceId: integer('workspace_id').notNull(),
  name: text('name').notNull(),
  host: text('host').notNull(),
  port: integer('port').default(389).notNull(),
  bindDn: text('bind_dn').notNull(),
  bindCredential: text('bind_credential'),
  searchBase: text('search_base').notNull(),
  userDnPattern: text('user_dn_pattern'),
  useSsl: boolean('use_ssl').default(false).notNull(),
  useTls: boolean('use_tls').default(true).notNull(),
  connectionTimeout: integer('connection_timeout').default(5000).notNull(),
  userIdAttribute: text('user_id_attribute').default('uid').notNull(),
  usernameAttribute: text('username_attribute').default('uid').notNull(),
  emailAttribute: text('email_attribute').default('mail').notNull(),
  fullNameAttribute: text('full_name_attribute').default('cn').notNull(),
  groupMemberAttribute: text('group_member_attribute').default('memberOf').notNull(),
  syncGroups: boolean('sync_groups').default(true).notNull(),
  groupSearchBase: text('group_search_base'),
  groupObjectClass: text('group_object_class').default('groupOfNames').notNull(),
  groupNameAttribute: text('group_name_attribute').default('cn').notNull(),
  lastSyncAt: timestamp('last_sync_at'),
  syncStatus: text('sync_status'),
  syncError: text('sync_error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

/**
 * Directory Groups (synced from directory service)
 */
export const directoryGroups = pgTable('directory_groups', {
  id: serial('id').primaryKey(),
  directoryId: integer('directory_id').notNull(),
  workspaceId: integer('workspace_id').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  externalId: text('external_id').notNull(),
  memberCount: integer('member_count').default(0),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

/**
 * Directory Group Role Mappings
 * Maps directory groups to local roles (for automatic role assignment)
 */
export const directoryGroupRoleMappings = pgTable('directory_group_role_mappings', {
  id: serial('id').primaryKey(),
  directoryGroupId: integer('directory_group_id').notNull(),
  roleId: integer('role_id').notNull(),
  workspaceId: integer('workspace_id'),
  isAutoProvisioned: boolean('is_auto_provisioned').default(false).notNull(),
  createdById: integer('created_by_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
});

// Define relationships
export const ldapDirectoriesRelations = relations(ldapDirectories, ({ one, many }) => ({
  groups: many(directoryGroups)
}));

export const directoryGroupsRelations = relations(directoryGroups, ({ one, many }) => ({
  directory: one(ldapDirectories, {
    fields: [directoryGroups.directoryId],
    references: [ldapDirectories.id]
  }),
  roleMappings: many(directoryGroupRoleMappings)
}));

export const directoryGroupRoleMappingsRelations = relations(directoryGroupRoleMappings, ({ one }) => ({
  directoryGroup: one(directoryGroups, {
    fields: [directoryGroupRoleMappings.directoryGroupId],
    references: [directoryGroups.id]
  }),
  role: one(roles, {
    fields: [directoryGroupRoleMappings.roleId],
    references: [roles.id]
  })
}));

// Export schema for validation
export const ldapDirectoryInsertSchema = createInsertSchema(ldapDirectories);
export type LdapDirectoryInsert = z.infer<typeof ldapDirectoryInsertSchema>;
export const ldapDirectorySelectSchema = createSelectSchema(ldapDirectories);
export type LdapDirectory = z.infer<typeof ldapDirectorySelectSchema>;

export const directoryGroupInsertSchema = createInsertSchema(directoryGroups);
export type DirectoryGroupInsert = z.infer<typeof directoryGroupInsertSchema>;
export const directoryGroupSelectSchema = createSelectSchema(directoryGroups);
export type DirectoryGroup = z.infer<typeof directoryGroupSelectSchema>;

export const directoryGroupRoleMappingInsertSchema = createInsertSchema(directoryGroupRoleMappings);
export type DirectoryGroupRoleMappingInsert = z.infer<typeof directoryGroupRoleMappingInsertSchema>;
export const directoryGroupRoleMappingSelectSchema = createSelectSchema(directoryGroupRoleMappings);
export type DirectoryGroupRoleMapping = z.infer<typeof directoryGroupRoleMappingSelectSchema>;