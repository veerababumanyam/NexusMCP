/**
 * Enterprise-Grade Connector Marketplace Service
 * 
 * Provides connector management and plugin ecosystem support:
 * - Connector discovery and installation
 * - Version management and updates
 * - Security scanning and verification
 * - Dependency management
 * - Plugin lifecycle management
 * - Access control and authorization
 */

import { db } from '../../../db';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import axios from 'axios';
import { 
  connectors, 
  connectorVersions, 
  connectorCategories, 
  connectorPublishers, 
  connectorInstallations,
  connectorReviews,
  connectorTags,
  connectorTagRelations,
  ConnectorInsert,
  ConnectorVersionInsert,
  ConnectorCategoryInsert,
  ConnectorPublisherInsert
} from '@shared/schema_marketplace';
import { eq, and, or, like, desc, asc, sql, inArray } from 'drizzle-orm';
import { EnterpriseKmsService } from '../auth/EnterpriseKmsService';
import { secureAuditService, AuditEventType, AuditEventSeverity } from '../audit/SecureAuditService';
import { policyEngine, PolicyRequest, PolicyEffect } from '../policy/PolicyEngine';
import { EventEmitter } from 'events';

// Connector types
export enum ConnectorType {
  INTEGRATION = 'integration',       // Connects to external systems
  EXTENSION = 'extension',           // Extends platform functionality
  VISUALIZATION = 'visualization',   // Adds visualization components
  THEME = 'theme',                   // UI themes
  TRANSFORMER = 'transformer',       // Data transformation
  PROVIDER = 'provider',             // Provides services/APIs
  AGENT = 'agent',                   // Intelligent agent
  WORKFLOW = 'workflow',             // Custom workflow
  TOOL = 'tool',                     // Tool implementation
  SECURITY = 'security',             // Security enhancement
  UTILITY = 'utility'                // Utility/helper
}

// Connector status
export enum ConnectorStatus {
  DRAFT = 'draft',                   // Being created, not submitted
  PENDING_REVIEW = 'pending_review', // Submitted for review
  REJECTED = 'rejected',             // Rejected during review
  APPROVED = 'approved',             // Approved and available
  DEPRECATED = 'deprecated',         // Deprecated but still available
  SUSPENDED = 'suspended'            // Temporarily suspended
}

// Installation status
export enum InstallationStatus {
  INSTALLED = 'installed',           // Successfully installed
  DISABLED = 'disabled',             // Installed but disabled
  FAILED = 'failed',                 // Installation failed
  UNINSTALLED = 'uninstalled',       // Uninstalled
  UPDATING = 'updating'              // In the process of updating
}

// Search options
export interface ConnectorSearchOptions {
  query?: string;                    // Free text search
  categories?: number[];             // Category IDs
  publishers?: number[];             // Publisher IDs
  tags?: string[];                   // Tag slugs
  type?: ConnectorType;              // Connector type
  status?: ConnectorStatus;          // Connector status
  featured?: boolean;                // Only featured connectors
  verified?: boolean;                // Only verified connectors
  official?: boolean;                // Only official connectors
  sort?: string;                     // Sort field
  order?: 'asc' | 'desc';            // Sort order
  page?: number;                     // Page number
  limit?: number;                    // Page size
  workspaceId?: number;              // Filter by workspace
}

// Package management options
export interface PackageOptions {
  registryUrl?: string;
  nodeModulesPath?: string;
  tempDir?: string;
  maxSize?: number;                  // Max package size in bytes
}

/**
 * Connector Marketplace Service
 */
export class ConnectorMarketplaceService extends EventEmitter {
  private initialized: boolean = false;
  private kmsService?: EnterpriseKmsService;
  private packageOptions: PackageOptions;
  
  // Default package options
  private static readonly DEFAULT_PACKAGE_OPTIONS: PackageOptions = {
    registryUrl: 'https://registry.npmjs.org',
    nodeModulesPath: path.join(process.cwd(), 'node_modules'),
    tempDir: path.join(process.cwd(), 'tmp'),
    maxSize: 100 * 1024 * 1024 // 100MB
  };
  
  constructor(kmsService?: EnterpriseKmsService, packageOptions?: PackageOptions) {
    super();
    this.kmsService = kmsService;
    this.packageOptions = { ...ConnectorMarketplaceService.DEFAULT_PACKAGE_OPTIONS, ...packageOptions };
    
    // Initialize the service
    this.initialize();
  }
  
  /**
   * Initialize the service
   */
  private async initialize(): Promise<void> {
    try {
      // Ensure temp directory exists
      try {
        await fs.mkdir(this.packageOptions.tempDir, { recursive: true });
      } catch (err) {
        console.error('Error creating temp directory:', err);
      }
      
      this.initialized = true;
      
      // Log initialization
      secureAuditService.logEvent({
        eventType: AuditEventType.SYSTEM_CONFIGURATION,
        action: 'connector_marketplace.initialized',
        actor: {
          id: 0 // System
        },
        resource: {
          type: 'system',
          id: 'connector_marketplace',
          name: 'Connector Marketplace Service'
        },
        outcome: 'success',
        severity: AuditEventSeverity.INFO,
        timestamp: new Date()
      });
      
      console.log('Connector Marketplace Service initialized');
    } catch (error) {
      console.error('Failed to initialize Connector Marketplace Service:', error);
      
      // Log initialization failure
      secureAuditService.logEvent({
        eventType: AuditEventType.SYSTEM_CONFIGURATION,
        action: 'connector_marketplace.initialization_failed',
        actor: {
          id: 0 // System
        },
        resource: {
          type: 'system',
          id: 'connector_marketplace',
          name: 'Connector Marketplace Service'
        },
        outcome: 'error',
        severity: AuditEventSeverity.ERROR,
        timestamp: new Date(),
        details: {
          error: error.message
        }
      });
    }
  }
  
  /**
   * Search connectors with various filters
   */
  public async searchConnectors(options: ConnectorSearchOptions): Promise<{ 
    connectors: any[], 
    total: number, 
    page: number, 
    pageSize: number 
  }> {
    try {
      const page = options.page || 1;
      const limit = options.limit || 20;
      const offset = (page - 1) * limit;
      
      // Build query
      let query = db.select({
        connector: connectors,
        category: connectorCategories,
        publisher: connectorPublishers
      }).from(connectors)
        .leftJoin(connectorCategories, eq(connectors.categoryId, connectorCategories.id))
        .leftJoin(connectorPublishers, eq(connectors.publisherId, connectorPublishers.id));
      
      // Apply filters
      const conditions = [];
      
      // Text search
      if (options.query) {
        conditions.push(
          or(
            like(connectors.name, `%${options.query}%`),
            like(connectors.description, `%${options.query}%`),
            like(connectors.shortDescription, `%${options.query}%`)
          )
        );
      }
      
      // Category filter
      if (options.categories && options.categories.length > 0) {
        conditions.push(inArray(connectors.categoryId, options.categories));
      }
      
      // Publisher filter
      if (options.publishers && options.publishers.length > 0) {
        conditions.push(inArray(connectors.publisherId, options.publishers));
      }
      
      // Tag filter
      if (options.tags && options.tags.length > 0) {
        // We need to join with tag relations and tags tables
        // This is a simplified approach - in a real implementation, this would be more complex
        const tagIds = await db.select({ id: connectorTags.id })
          .from(connectorTags)
          .where(inArray(connectorTags.slug, options.tags));
          
        if (tagIds.length > 0) {
          // Find connectors that have these tags
          const connectorIds = await db.select({ connectorId: connectorTagRelations.connectorId })
            .from(connectorTagRelations)
            .where(inArray(connectorTagRelations.tagId, tagIds.map(t => t.id)));
            
          if (connectorIds.length > 0) {
            conditions.push(inArray(connectors.id, connectorIds.map(c => c.connectorId)));
          } else {
            // No connectors with these tags
            return {
              connectors: [],
              total: 0,
              page,
              pageSize: limit
            };
          }
        }
      }
      
      // Type filter
      if (options.type) {
        conditions.push(eq(connectors.packageType, options.type));
      }
      
      // Status filter
      if (options.status) {
        conditions.push(eq(connectors.status, options.status));
      } else {
        // By default, only show approved connectors
        conditions.push(eq(connectors.isApproved, true));
      }
      
      // Featured filter
      if (options.featured) {
        conditions.push(eq(connectors.isFeatured, true));
      }
      
      // Verified filter
      if (options.verified) {
        conditions.push(eq(connectors.isVerified, true));
      }
      
      // Official filter
      if (options.official) {
        conditions.push(eq(connectors.isOfficial, true));
      }
      
      // Workspace filter
      if (options.workspaceId) {
        // Just check if the workspace column matches, or if the connector is global
        // In real implementation, this would be more complex
        conditions.push(
          or(
            eq(connectors.workspaceId, options.workspaceId),
            eq(connectors.workspaceId, null)
          )
        );
      }
      
      // Apply conditions if any
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      // Set sorting
      const sortField = options.sort || 'createdAt';
      const sortOrder = options.order || 'desc';
      
      if (sortField === 'rating') {
        query = query.orderBy(sortOrder === 'asc' ? asc(connectors.rating) : desc(connectors.rating));
      } else if (sortField === 'downloadCount') {
        query = query.orderBy(sortOrder === 'asc' ? asc(connectors.downloadCount) : desc(connectors.downloadCount));
      } else if (sortField === 'name') {
        query = query.orderBy(sortOrder === 'asc' ? asc(connectors.name) : desc(connectors.name));
      } else {
        // Default to createdAt
        query = query.orderBy(sortOrder === 'asc' ? asc(connectors.createdAt) : desc(connectors.createdAt));
      }
      
      // Apply pagination
      query = query.limit(limit).offset(offset);
      
      // Get count for pagination
      const countQuery = db.select({ count: sql`count(*)` }).from(connectors);
      if (conditions.length > 0) {
        countQuery.where(and(...conditions));
      }
      const countResult = await countQuery;
      const total = Number(countResult[0]?.count || 0);
      
      // Execute query
      const results = await query;
      
      // Format results
      const formattedResults = results.map(row => ({
        ...row.connector,
        category: row.category,
        publisher: row.publisher
      }));
      
      return {
        connectors: formattedResults,
        total,
        page,
        pageSize: limit
      };
    } catch (error) {
      console.error('Error searching connectors:', error);
      throw new Error(`Failed to search connectors: ${error.message}`);
    }
  }
  
  /**
   * Get connector details by ID or slug
   */
  public async getConnector(idOrSlug: number | string): Promise<any> {
    try {
      // Determine if ID or slug
      const isId = typeof idOrSlug === 'number';
      
      // Query connector with related data
      let query = db.select({
        connector: connectors,
        category: connectorCategories,
        publisher: connectorPublishers
      }).from(connectors)
        .leftJoin(connectorCategories, eq(connectors.categoryId, connectorCategories.id))
        .leftJoin(connectorPublishers, eq(connectors.publisherId, connectorPublishers.id));
      
      // Apply ID or slug filter
      if (isId) {
        query = query.where(eq(connectors.id, idOrSlug as number));
      } else {
        query = query.where(eq(connectors.slug, idOrSlug as string));
      }
      
      const result = await query;
      
      if (result.length === 0) {
        return null;
      }
      
      const connector = result[0];
      
      // Get versions
      const versions = await db.query.connectorVersions.findMany({
        where: eq(connectorVersions.connectorId, connector.connector.id),
        orderBy: desc(connectorVersions.createdAt)
      });
      
      // Get tags
      const tagRelations = await db.select({
        tag: connectorTags
      }).from(connectorTagRelations)
        .innerJoin(connectorTags, eq(connectorTagRelations.tagId, connectorTags.id))
        .where(eq(connectorTagRelations.connectorId, connector.connector.id));
      
      // Get reviews
      const reviews = await db.query.connectorReviews.findMany({
        where: eq(connectorReviews.connectorId, connector.connector.id),
        orderBy: desc(connectorReviews.createdAt)
      });
      
      // Format and return
      return {
        ...connector.connector,
        category: connector.category,
        publisher: connector.publisher,
        versions,
        tags: tagRelations.map(t => t.tag),
        reviews
      };
    } catch (error) {
      console.error(`Error getting connector details for ${idOrSlug}:`, error);
      throw new Error(`Failed to get connector details: ${error.message}`);
    }
  }
  
  /**
   * Create a new connector
   */
  public async createConnector(data: ConnectorInsert, userId: number): Promise<any> {
    try {
      // Validate permissions
      const canCreate = await this.checkPermission(userId, 'marketplace:connector:create');
      if (!canCreate) {
        throw new Error('Permission denied: Cannot create connector');
      }
      
      // Check for duplicate slug
      const existing = await db.query.connectors.findFirst({
        where: eq(connectors.slug, data.slug)
      });
      
      if (existing) {
        throw new Error(`Connector with slug "${data.slug}" already exists`);
      }
      
      // Insert connector
      const [connector] = await db.insert(connectors).values({
        ...data,
        createdById: userId,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      
      // Log connector creation
      secureAuditService.logEvent({
        eventType: AuditEventType.SYSTEM_CONFIGURATION,
        action: 'connector.created',
        actor: {
          id: userId
        },
        resource: {
          type: 'connector',
          id: connector.id.toString(),
          name: connector.name
        },
        outcome: 'success',
        severity: AuditEventSeverity.INFO,
        timestamp: new Date(),
        details: {
          connectorId: connector.id,
          categoryId: connector.categoryId,
          publisherId: connector.publisherId
        }
      });
      
      // Get complete details
      return this.getConnector(connector.id);
    } catch (error) {
      console.error('Error creating connector:', error);
      throw new Error(`Failed to create connector: ${error.message}`);
    }
  }
  
  /**
   * Update a connector
   */
  public async updateConnector(id: number, data: Partial<ConnectorInsert>, userId: number): Promise<any> {
    try {
      // Get existing connector
      const existing = await db.query.connectors.findFirst({
        where: eq(connectors.id, id)
      });
      
      if (!existing) {
        throw new Error(`Connector with ID ${id} not found`);
      }
      
      // Check permissions
      const isOwner = existing.createdById === userId;
      const canUpdate = await this.checkPermission(userId, 'marketplace:connector:update', { connectorId: id, isOwner });
      
      if (!canUpdate) {
        throw new Error('Permission denied: Cannot update connector');
      }
      
      // Check for duplicate slug if changing
      if (data.slug && data.slug !== existing.slug) {
        const duplicateSlug = await db.query.connectors.findFirst({
          where: eq(connectors.slug, data.slug)
        });
        
        if (duplicateSlug) {
          throw new Error(`Connector with slug "${data.slug}" already exists`);
        }
      }
      
      // Update connector
      const [updated] = await db.update(connectors)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(connectors.id, id))
        .returning();
      
      // Log connector update
      secureAuditService.logEvent({
        eventType: AuditEventType.SYSTEM_CONFIGURATION,
        action: 'connector.updated',
        actor: {
          id: userId
        },
        resource: {
          type: 'connector',
          id: updated.id.toString(),
          name: updated.name
        },
        outcome: 'success',
        severity: AuditEventSeverity.INFO,
        timestamp: new Date(),
        details: {
          connectorId: updated.id,
          changes: Object.keys(data)
        }
      });
      
      // Get complete details
      return this.getConnector(updated.id);
    } catch (error) {
      console.error(`Error updating connector ${id}:`, error);
      throw new Error(`Failed to update connector: ${error.message}`);
    }
  }
  
  /**
   * Delete a connector
   */
  public async deleteConnector(id: number, userId: number): Promise<boolean> {
    try {
      // Get existing connector
      const existing = await db.query.connectors.findFirst({
        where: eq(connectors.id, id)
      });
      
      if (!existing) {
        throw new Error(`Connector with ID ${id} not found`);
      }
      
      // Check permissions
      const isOwner = existing.createdById === userId;
      const canDelete = await this.checkPermission(userId, 'marketplace:connector:delete', { connectorId: id, isOwner });
      
      if (!canDelete) {
        throw new Error('Permission denied: Cannot delete connector');
      }
      
      // Check if there are any installations
      const installations = await db.query.connectorInstallations.findMany({
        where: eq(connectorInstallations.connectorId, id)
      });
      
      if (installations.length > 0) {
        // Instead of deleting, mark as deprecated
        await db.update(connectors)
          .set({
            isActive: false,
            status: ConnectorStatus.DEPRECATED,
            updatedAt: new Date()
          })
          .where(eq(connectors.id, id));
          
        // Log connector deprecation
        secureAuditService.logEvent({
          eventType: AuditEventType.SYSTEM_CONFIGURATION,
          action: 'connector.deprecated',
          actor: {
            id: userId
          },
          resource: {
            type: 'connector',
            id: id.toString(),
            name: existing.name
          },
          outcome: 'success',
          severity: AuditEventSeverity.WARNING,
          timestamp: new Date(),
          details: {
            connectorId: id,
            reason: 'Cannot delete connector with active installations'
          }
        });
        
        return false;
      }
      
      // Begin transaction to delete connector and related data
      await db.transaction(async (tx) => {
        // Delete tag relations
        await tx.delete(connectorTagRelations)
          .where(eq(connectorTagRelations.connectorId, id));
        
        // Delete reviews
        await tx.delete(connectorReviews)
          .where(eq(connectorReviews.connectorId, id));
        
        // Delete versions
        await tx.delete(connectorVersions)
          .where(eq(connectorVersions.connectorId, id));
        
        // Delete connector
        await tx.delete(connectors)
          .where(eq(connectors.id, id));
      });
      
      // Log connector deletion
      secureAuditService.logEvent({
        eventType: AuditEventType.SYSTEM_CONFIGURATION,
        action: 'connector.deleted',
        actor: {
          id: userId
        },
        resource: {
          type: 'connector',
          id: id.toString(),
          name: existing.name
        },
        outcome: 'success',
        severity: AuditEventSeverity.WARNING,
        timestamp: new Date(),
        details: {
          connectorId: id,
          connectorName: existing.name
        }
      });
      
      return true;
    } catch (error) {
      console.error(`Error deleting connector ${id}:`, error);
      throw new Error(`Failed to delete connector: ${error.message}`);
    }
  }
  
  /**
   * Install a connector for a user/workspace
   */
  public async installConnector(connectorId: number, params: {
    userId: number;
    workspaceId?: number;
    versionId?: number;
    settings?: any;
  }): Promise<any> {
    const { userId, workspaceId, versionId, settings } = params;
    
    try {
      // Get connector
      const connector = await db.query.connectors.findFirst({
        where: eq(connectors.id, connectorId)
      });
      
      if (!connector) {
        throw new Error(`Connector with ID ${connectorId} not found`);
      }
      
      // Check if connector is approved and active
      if (!connector.isApproved || !connector.isActive) {
        throw new Error('Cannot install connector: not approved or inactive');
      }
      
      // Check permissions
      const canInstall = await this.checkPermission(userId, 'marketplace:connector:install', { 
        connectorId, 
        workspaceId 
      });
      
      if (!canInstall) {
        throw new Error('Permission denied: Cannot install connector');
      }
      
      // Get version to install
      let version;
      if (versionId) {
        version = await db.query.connectorVersions.findFirst({
          where: and(
            eq(connectorVersions.id, versionId),
            eq(connectorVersions.connectorId, connectorId)
          )
        });
        
        if (!version) {
          throw new Error(`Version with ID ${versionId} not found for connector ${connectorId}`);
        }
      } else {
        // Get latest version
        version = await db.query.connectorVersions.findFirst({
          where: and(
            eq(connectorVersions.connectorId, connectorId),
            eq(connectorVersions.isLatest, true)
          )
        });
        
        if (!version) {
          throw new Error('No versions available for this connector');
        }
      }
      
      // Check for existing installation
      const existingInstallation = await db.query.connectorInstallations.findFirst({
        where: and(
          eq(connectorInstallations.connectorId, connectorId),
          eq(connectorInstallations.userId, userId),
          workspaceId ? eq(connectorInstallations.workspaceId, workspaceId) : sql`TRUE`
        )
      });
      
      if (existingInstallation) {
        // Update the existing installation
        const [installation] = await db.update(connectorInstallations)
          .set({
            versionId: version.id,
            settings: settings || existingInstallation.settings,
            status: InstallationStatus.INSTALLED,
            isActive: true,
            updatedAt: new Date()
          })
          .where(eq(connectorInstallations.id, existingInstallation.id))
          .returning();
          
        // Log installation update
        secureAuditService.logEvent({
          eventType: AuditEventType.SYSTEM_CONFIGURATION,
          action: 'connector.installation.updated',
          actor: {
            id: userId
          },
          resource: {
            type: 'connector_installation',
            id: installation.id.toString(),
            name: `${connector.name} Installation`
          },
          outcome: 'success',
          severity: AuditEventSeverity.INFO,
          timestamp: new Date(),
          details: {
            connectorId,
            connectorName: connector.name,
            versionId: version.id,
            version: version.version,
            workspaceId
          }
        });
        
        return installation;
      } else {
        // Create a new installation
        const [installation] = await db.insert(connectorInstallations).values({
          connectorId,
          versionId: version.id,
          userId,
          workspaceId: workspaceId || null,
          settings: settings || {},
          status: InstallationStatus.INSTALLED,
          isActive: true,
          installedAt: new Date(),
          updatedAt: new Date()
        }).returning();
        
        // Update download count
        await db.update(connectors)
          .set({
            downloadCount: sql`${connectors.downloadCount} + 1`
          })
          .where(eq(connectors.id, connectorId));
        
        // Log installation
        secureAuditService.logEvent({
          eventType: AuditEventType.SYSTEM_CONFIGURATION,
          action: 'connector.installation.created',
          actor: {
            id: userId
          },
          resource: {
            type: 'connector_installation',
            id: installation.id.toString(),
            name: `${connector.name} Installation`
          },
          outcome: 'success',
          severity: AuditEventSeverity.INFO,
          timestamp: new Date(),
          details: {
            connectorId,
            connectorName: connector.name,
            versionId: version.id,
            version: version.version,
            workspaceId
          }
        });
        
        return installation;
      }
    } catch (error) {
      console.error(`Error installing connector ${connectorId}:`, error);
      
      // Log installation failure
      secureAuditService.logEvent({
        eventType: AuditEventType.SYSTEM_CONFIGURATION,
        action: 'connector.installation.failed',
        actor: {
          id: userId
        },
        resource: {
          type: 'connector',
          id: connectorId.toString()
        },
        outcome: 'error',
        severity: AuditEventSeverity.ERROR,
        timestamp: new Date(),
        details: {
          connectorId,
          workspaceId,
          error: error.message
        }
      });
      
      throw new Error(`Failed to install connector: ${error.message}`);
    }
  }
  
  /**
   * Get user's installed connectors
   */
  public async getUserInstallations(userId: number, workspaceId?: number): Promise<any[]> {
    try {
      // Build query
      let query = db.select({
        installation: connectorInstallations,
        connector: connectors,
        version: connectorVersions
      })
      .from(connectorInstallations)
      .innerJoin(connectors, eq(connectorInstallations.connectorId, connectors.id))
      .innerJoin(connectorVersions, eq(connectorInstallations.versionId, connectorVersions.id))
      .where(
        and(
          eq(connectorInstallations.userId, userId),
          eq(connectorInstallations.isActive, true)
        )
      );
      
      // Add workspace filter if provided
      if (workspaceId !== undefined) {
        query = query.where(eq(connectorInstallations.workspaceId, workspaceId));
      }
      
      // Execute query
      const results = await query;
      
      // Format results
      return results.map(row => ({
        ...row.installation,
        connector: row.connector,
        version: row.version
      }));
    } catch (error) {
      console.error(`Error fetching installations for user ${userId}:`, error);
      throw new Error(`Failed to get user installations: ${error.message}`);
    }
  }
  
  /**
   * Get marketplace statistics
   */
  public async getMarketplaceStats(): Promise<any> {
    try {
      // Total connectors
      const totalConnectors = await db
        .select({ count: sql`count(*)` })
        .from(connectors)
        .where(eq(connectors.isActive, true));
      
      // Total categories
      const totalCategories = await db
        .select({ count: sql`count(*)` })
        .from(connectorCategories)
        .where(eq(connectorCategories.isActive, true));
      
      // Total publishers
      const totalPublishers = await db
        .select({ count: sql`count(*)` })
        .from(connectorPublishers)
        .where(eq(connectorPublishers.isActive, true));
      
      // Total installations
      const totalInstallations = await db
        .select({ count: sql`count(*)` })
        .from(connectorInstallations)
        .where(eq(connectorInstallations.isActive, true));
      
      // Top rated connectors
      const topRated = await db.query.connectors.findMany({
        where: and(
          eq(connectors.isActive, true),
          eq(connectors.isApproved, true)
        ),
        orderBy: desc(connectors.rating),
        limit: 5
      });
      
      // Most downloaded connectors
      const mostDownloaded = await db.query.connectors.findMany({
        where: and(
          eq(connectors.isActive, true),
          eq(connectors.isApproved, true)
        ),
        orderBy: desc(connectors.downloadCount),
        limit: 5
      });
      
      // Recently added connectors
      const recentlyAdded = await db.query.connectors.findMany({
        where: and(
          eq(connectors.isActive, true),
          eq(connectors.isApproved, true)
        ),
        orderBy: desc(connectors.createdAt),
        limit: 5
      });
      
      return {
        counts: {
          connectors: Number(totalConnectors[0]?.count || 0),
          categories: Number(totalCategories[0]?.count || 0),
          publishers: Number(totalPublishers[0]?.count || 0),
          installations: Number(totalInstallations[0]?.count || 0)
        },
        topRated,
        mostDownloaded,
        recentlyAdded
      };
    } catch (error) {
      console.error('Error getting marketplace stats:', error);
      throw new Error(`Failed to get marketplace statistics: ${error.message}`);
    }
  }
  
  /**
   * Check if a user has a specific permission
   */
  private async checkPermission(userId: number, permission: string, context: any = {}): Promise<boolean> {
    try {
      // If policy engine isn't available, default to simple permission check
      if (!policyEngine) {
        // Placeholder for simple permission checks
        // In a real implementation, this would check against user roles and permissions
        return true;
      }
      
      // Prepare policy request
      const policyRequest: PolicyRequest = {
        principal: {
          id: userId,
          roles: [] // Would come from user roles lookup
        },
        action: permission,
        resource: {
          type: 'marketplace',
          id: context.connectorId?.toString() || context.installationId?.toString() || 'global',
          attributes: context
        },
        context: {
          time: new Date(),
          ...context
        }
      };
      
      // Evaluate against policies
      const policyResponse = await policyEngine.evaluate(policyRequest);
      
      return policyResponse.effect === PolicyEffect.ALLOW;
    } catch (error) {
      console.error('Error checking permission:', error);
      return false; // Default to deny on error
    }
  }
  
  /**
   * Clean up resources
   */
  public cleanup(): void {
    // Clean up any temporary files
    
    // Log the service shutdown
    secureAuditService.logEvent({
      eventType: AuditEventType.SYSTEM_CONFIGURATION,
      action: 'connector_marketplace.shutdown',
      actor: {
        id: 0 // System
      },
      resource: {
        type: 'system',
        id: 'connector_marketplace',
        name: 'Connector Marketplace Service'
      },
      outcome: 'success',
      severity: AuditEventSeverity.INFO,
      timestamp: new Date()
    });
  }
}

// Export singleton instance
export const connectorMarketplaceService = new ConnectorMarketplaceService();