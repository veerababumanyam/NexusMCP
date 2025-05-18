/**
 * Enterprise File Storage Service
 * 
 * Provides unified access to various enterprise file storage solutions with support for:
 * - SharePoint (Microsoft 365)
 * - Box
 * - Dropbox Business
 * - Google Drive (Google Workspace)
 * - OneDrive for Business
 * 
 * Features:
 * - File upload/download
 * - Directory browsing
 * - Search
 * - Access controls
 * - Metadata management
 * - Versioning
 * - OAuth2 authentication flow
 */

import { db } from '@db';
import { logger, getChildLogger } from '../../utils/logger';
import { EventBus } from '../eventBusService';
import { 
  fileStorageIntegrations, 
  fileReferences, 
  fileOperationsLog,
  FileStorageIntegration, 
  FileReference,
  FileOperationLogInsert
} from '@shared/schema_file_storage';
import { eq, and, desc } from 'drizzle-orm';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import { Readable } from 'stream';

// Service logger for file operations
const serviceLogger = getChildLogger(logger, { component: 'FileStorageService' });

/**
 * File metadata interface - common across all providers
 */
export interface FileMetadata {
  id: string;
  name: string;
  mimeType?: string;
  size?: number;
  folder?: boolean;
  path: string;
  parentId?: string;
  downloadUrl?: string;
  webViewUrl?: string;
  thumbnailUrl?: string;
  createdTime?: Date;
  modifiedTime?: Date;
  createdBy?: string;
  modifiedBy?: string;
}

/**
 * File storage provider interface - implemented by specific provider classes
 */
export interface FileStorageProvider {
  getIntegrationId(): number;
  authenticate(): Promise<boolean>;
  refreshAuth(): Promise<boolean>;
  listFiles(folderId?: string): Promise<FileMetadata[]>;
  getFile(fileId: string): Promise<FileMetadata>;
  downloadFile(fileId: string, destinationPath: string): Promise<string>;
  uploadFile(folderPath: string, filePath: string, metadata?: Record<string, any>): Promise<FileMetadata>;
  createFolder(parentFolderId: string, folderName: string): Promise<FileMetadata>;
  deleteFile(fileId: string): Promise<boolean>;
  moveFile(fileId: string, newParentFolderId: string): Promise<FileMetadata>;
  searchFiles(query: string): Promise<FileMetadata[]>;
}

/**
 * Base class with common functionality for file storage providers
 */
abstract class BaseFileStorageProvider implements FileStorageProvider {
  protected integration: FileStorageIntegration;
  protected logger: typeof serviceLogger;
  protected eventBus: EventBus;

  constructor(integration: FileStorageIntegration) {
    this.integration = integration;
    this.logger = getChildLogger(serviceLogger, { provider: integration.provider, integrationId: integration.id });
    this.eventBus = EventBus.getInstance();
  }

  /**
   * Get the integration ID
   */
  getIntegrationId(): number {
    return this.integration.id;
  }

  /**
   * Log a file operation
   */
  protected async logOperation(operation: string, fileId?: number, status = 'success', errorMessage?: string): Promise<void> {
    try {
      const logEntry: FileOperationLogInsert = {
        integrationId: this.integration.id,
        fileId,
        operation,
        status,
        errorMessage,
        createdAt: new Date(),
      };

      // Insert log entry
      await db.insert(fileOperationsLog).values(logEntry);

      // Publish event
      this.eventBus.publish('file.operation', {
        integrationId: this.integration.id,
        fileId,
        operation,
        status,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error(`Failed to log operation ${operation}`, error);
    }
  }

  /**
   * Update a file reference or create if not exists
   */
  protected async upsertFileReference(fileData: FileMetadata): Promise<FileReference> {
    try {
      // Check if file reference exists
      const existingFile = await db
        .select()
        .from(fileReferences)
        .where(
          and(
            eq(fileReferences.integrationId, this.integration.id),
            eq(fileReferences.externalId, fileData.id)
          )
        )
        .limit(1);

      const fileRef = {
        integrationId: this.integration.id,
        externalId: fileData.id,
        name: fileData.name,
        mimeType: fileData.mimeType || null,
        path: fileData.path,
        size: fileData.size || null,
        parentFolderId: fileData.parentId || null,
        webUrl: fileData.webViewUrl || null,
        downloadUrl: fileData.downloadUrl || null,
        thumbnailUrl: fileData.thumbnailUrl || null,
        isFolder: fileData.folder || false,
        metadata: {
          createdTime: fileData.createdTime,
          modifiedTime: fileData.modifiedTime,
          createdBy: fileData.createdBy,
          modifiedBy: fileData.modifiedBy
        },
        lastSyncedAt: new Date(),
        updatedAt: new Date()
      };

      let result;

      if (existingFile && existingFile.length > 0) {
        // Update existing reference
        [result] = await db
          .update(fileReferences)
          .set(fileRef)
          .where(eq(fileReferences.id, existingFile[0].id))
          .returning();
      } else {
        // Create new reference
        [result] = await db
          .insert(fileReferences)
          .values({
            ...fileRef,
            createdAt: new Date()
          })
          .returning();
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to upsert file reference for ${fileData.id}`, error);
      throw error;
    }
  }

  // The following methods must be implemented by provider-specific classes
  abstract authenticate(): Promise<boolean>;
  abstract refreshAuth(): Promise<boolean>;
  abstract listFiles(folderId?: string): Promise<FileMetadata[]>;
  abstract getFile(fileId: string): Promise<FileMetadata>;
  abstract downloadFile(fileId: string, destinationPath: string): Promise<string>;
  abstract uploadFile(folderPath: string, filePath: string, metadata?: Record<string, any>): Promise<FileMetadata>;
  abstract createFolder(parentFolderId: string, folderName: string): Promise<FileMetadata>;
  abstract deleteFile(fileId: string): Promise<boolean>;
  abstract moveFile(fileId: string, newParentFolderId: string): Promise<FileMetadata>;
  abstract searchFiles(query: string): Promise<FileMetadata[]>;
}

/**
 * SharePoint (Microsoft 365) implementation
 */
class SharePointProvider extends BaseFileStorageProvider {
  private accessToken: string | null = null;
  private tokenExpiresAt: Date | null = null;

  constructor(integration: FileStorageIntegration) {
    super(integration);
  }

  async authenticate(): Promise<boolean> {
    try {
      this.logger.info('Authenticating with SharePoint');
      
      const authConfig = this.integration.authConfig as Record<string, any>;
      const tenantId = this.integration.tenantId;
      
      if (!tenantId || !authConfig.clientId || !authConfig.clientSecret) {
        throw new Error('Missing required configuration for SharePoint authentication');
      }

      // For Microsoft Graph API OAuth2 client credentials flow
      const tokenEndpoint = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
      
      const params = new URLSearchParams();
      params.append('client_id', authConfig.clientId);
      params.append('client_secret', authConfig.clientSecret);
      params.append('grant_type', 'client_credentials');
      params.append('scope', 'https://graph.microsoft.com/.default');

      const response = await axios.post(tokenEndpoint, params.toString(), {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });

      if (response.data && response.data.access_token) {
        this.accessToken = response.data.access_token;
        // Set token expiration (typically 1 hour)
        const expiresIn = response.data.expires_in || 3600;
        this.tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);
        
        // Update integration with new token
        await db
          .update(fileStorageIntegrations)
          .set({
            accessToken: this.accessToken,
            tokenExpiresAt: this.tokenExpiresAt,
            connectionStatus: 'connected',
            lastSyncedAt: new Date()
          })
          .where(eq(fileStorageIntegrations.id, this.integration.id));
        
        return true;
      }
      
      throw new Error('Failed to get access token from Microsoft Graph API');
    } catch (error) {
      this.logger.error('SharePoint authentication failed', error);
      
      // Update connection status
      await db
        .update(fileStorageIntegrations)
        .set({
          connectionStatus: 'failed',
          lastSyncedAt: new Date()
        })
        .where(eq(fileStorageIntegrations.id, this.integration.id));
      
      return false;
    }
  }

  async refreshAuth(): Promise<boolean> {
    // For client credentials flow, just re-authenticate
    return this.authenticate();
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken || !this.tokenExpiresAt || new Date() >= this.tokenExpiresAt) {
      const success = await this.authenticate();
      if (!success) {
        throw new Error('Failed to authenticate with SharePoint');
      }
    }
  }

  async listFiles(folderId?: string): Promise<FileMetadata[]> {
    try {
      await this.ensureAuthenticated();
      
      const siteId = this.integration.siteId;
      const driveId = this.integration.driveId;
      
      if (!siteId || !driveId) {
        throw new Error('Missing site ID or drive ID for SharePoint integration');
      }
      
      let endpoint: string;
      
      if (folderId) {
        // List files in specific folder
        endpoint = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/items/${folderId}/children`;
      } else {
        // List files in root folder
        endpoint = `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/root/children`;
      }
      
      const response = await axios.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });
      
      if (!response.data || !response.data.value) {
        return [];
      }
      
      // Map SharePoint files to common metadata format
      const files: FileMetadata[] = response.data.value.map((item: any) => {
        const isFolder = !!item.folder;
        const parentPath = folderId ? `/drives/${driveId}/items/${folderId}` : `/drives/${driveId}/root`;
        
        return {
          id: item.id,
          name: item.name,
          mimeType: item.file ? item.file.mimeType : (isFolder ? 'folder' : 'unknown'),
          size: item.size || 0,
          folder: isFolder,
          path: `${parentPath}/${item.name}`,
          parentId: folderId || 'root',
          downloadUrl: item['@microsoft.graph.downloadUrl'] || null,
          webViewUrl: item.webUrl || null,
          thumbnailUrl: null, // Would need separate call to fetch thumbnails
          createdTime: item.createdDateTime ? new Date(item.createdDateTime) : undefined,
          modifiedTime: item.lastModifiedDateTime ? new Date(item.lastModifiedDateTime) : undefined,
          createdBy: item.createdBy?.user?.displayName,
          modifiedBy: item.lastModifiedBy?.user?.displayName
        };
      });
      
      // Update file references in database
      await Promise.all(
        files.map(file => this.upsertFileReference(file))
      );
      
      await this.logOperation('list_files', undefined, 'success');
      
      return files;
    } catch (error) {
      this.logger.error(`Failed to list files in SharePoint folder: ${folderId || 'root'}`, error);
      await this.logOperation('list_files', undefined, 'failed', error.message);
      throw error;
    }
  }

  // Implementation for remaining methods would go here...
  // For brevity, we'll provide full implementation for other providers in future updates

  async getFile(fileId: string): Promise<FileMetadata> {
    // Implementation would go here
    throw new Error('Method not implemented.');
  }

  async downloadFile(fileId: string, destinationPath: string): Promise<string> {
    // Implementation would go here
    throw new Error('Method not implemented.');
  }

  async uploadFile(folderPath: string, filePath: string, metadata?: Record<string, any>): Promise<FileMetadata> {
    // Implementation would go here
    throw new Error('Method not implemented.');
  }

  async createFolder(parentFolderId: string, folderName: string): Promise<FileMetadata> {
    // Implementation would go here
    throw new Error('Method not implemented.');
  }

  async deleteFile(fileId: string): Promise<boolean> {
    // Implementation would go here
    throw new Error('Method not implemented.');
  }

  async moveFile(fileId: string, newParentFolderId: string): Promise<FileMetadata> {
    // Implementation would go here
    throw new Error('Method not implemented.');
  }

  async searchFiles(query: string): Promise<FileMetadata[]> {
    // Implementation would go here
    throw new Error('Method not implemented.');
  }
}

/**
 * Box implementation
 */
class BoxProvider extends BaseFileStorageProvider {
  // Box implementation details would go here
  async authenticate(): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  
  async refreshAuth(): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  
  async listFiles(folderId?: string): Promise<FileMetadata[]> {
    throw new Error('Method not implemented.');
  }
  
  async getFile(fileId: string): Promise<FileMetadata> {
    throw new Error('Method not implemented.');
  }
  
  async downloadFile(fileId: string, destinationPath: string): Promise<string> {
    throw new Error('Method not implemented.');
  }
  
  async uploadFile(folderPath: string, filePath: string, metadata?: Record<string, any>): Promise<FileMetadata> {
    throw new Error('Method not implemented.');
  }
  
  async createFolder(parentFolderId: string, folderName: string): Promise<FileMetadata> {
    throw new Error('Method not implemented.');
  }
  
  async deleteFile(fileId: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  
  async moveFile(fileId: string, newParentFolderId: string): Promise<FileMetadata> {
    throw new Error('Method not implemented.');
  }
  
  async searchFiles(query: string): Promise<FileMetadata[]> {
    throw new Error('Method not implemented.');
  }
}

/**
 * Dropbox Business implementation
 */
class DropboxProvider extends BaseFileStorageProvider {
  // Dropbox implementation details would go here
  async authenticate(): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  
  async refreshAuth(): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  
  async listFiles(folderId?: string): Promise<FileMetadata[]> {
    throw new Error('Method not implemented.');
  }
  
  async getFile(fileId: string): Promise<FileMetadata> {
    throw new Error('Method not implemented.');
  }
  
  async downloadFile(fileId: string, destinationPath: string): Promise<string> {
    throw new Error('Method not implemented.');
  }
  
  async uploadFile(folderPath: string, filePath: string, metadata?: Record<string, any>): Promise<FileMetadata> {
    throw new Error('Method not implemented.');
  }
  
  async createFolder(parentFolderId: string, folderName: string): Promise<FileMetadata> {
    throw new Error('Method not implemented.');
  }
  
  async deleteFile(fileId: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  
  async moveFile(fileId: string, newParentFolderId: string): Promise<FileMetadata> {
    throw new Error('Method not implemented.');
  }
  
  async searchFiles(query: string): Promise<FileMetadata[]> {
    throw new Error('Method not implemented.');
  }
}

/**
 * Google Drive (Google Workspace) implementation
 */
class GoogleDriveProvider extends BaseFileStorageProvider {
  // Google Drive implementation details would go here
  async authenticate(): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  
  async refreshAuth(): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  
  async listFiles(folderId?: string): Promise<FileMetadata[]> {
    throw new Error('Method not implemented.');
  }
  
  async getFile(fileId: string): Promise<FileMetadata> {
    throw new Error('Method not implemented.');
  }
  
  async downloadFile(fileId: string, destinationPath: string): Promise<string> {
    throw new Error('Method not implemented.');
  }
  
  async uploadFile(folderPath: string, filePath: string, metadata?: Record<string, any>): Promise<FileMetadata> {
    throw new Error('Method not implemented.');
  }
  
  async createFolder(parentFolderId: string, folderName: string): Promise<FileMetadata> {
    throw new Error('Method not implemented.');
  }
  
  async deleteFile(fileId: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  
  async moveFile(fileId: string, newParentFolderId: string): Promise<FileMetadata> {
    throw new Error('Method not implemented.');
  }
  
  async searchFiles(query: string): Promise<FileMetadata[]> {
    throw new Error('Method not implemented.');
  }
}

/**
 * OneDrive for Business implementation
 */
class OneDriveProvider extends BaseFileStorageProvider {
  // OneDrive implementation details would go here - similar to SharePoint but focused on personal/business drives
  async authenticate(): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  
  async refreshAuth(): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  
  async listFiles(folderId?: string): Promise<FileMetadata[]> {
    throw new Error('Method not implemented.');
  }
  
  async getFile(fileId: string): Promise<FileMetadata> {
    throw new Error('Method not implemented.');
  }
  
  async downloadFile(fileId: string, destinationPath: string): Promise<string> {
    throw new Error('Method not implemented.');
  }
  
  async uploadFile(folderPath: string, filePath: string, metadata?: Record<string, any>): Promise<FileMetadata> {
    throw new Error('Method not implemented.');
  }
  
  async createFolder(parentFolderId: string, folderName: string): Promise<FileMetadata> {
    throw new Error('Method not implemented.');
  }
  
  async deleteFile(fileId: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  
  async moveFile(fileId: string, newParentFolderId: string): Promise<FileMetadata> {
    throw new Error('Method not implemented.');
  }
  
  async searchFiles(query: string): Promise<FileMetadata[]> {
    throw new Error('Method not implemented.');
  }
}

/**
 * Main File Storage Service that provides a unified interface for all providers
 */
class FileStorageService {
  private static instance: FileStorageService;
  private providers: Map<number, FileStorageProvider> = new Map();
  private logger = getChildLogger(logger, { component: 'FileStorageService' });
  private eventBus: EventBus;

  private constructor() {
    this.eventBus = EventBus.getInstance();
    this.logger.info('File Storage Service initialized');
  }

  public static getInstance(): FileStorageService {
    if (!FileStorageService.instance) {
      FileStorageService.instance = new FileStorageService();
    }
    return FileStorageService.instance;
  }

  /**
   * Get a provider instance for the given integration ID
   */
  private async getProviderForIntegration(integrationId: number): Promise<FileStorageProvider> {
    // Check if provider is already instantiated
    if (this.providers.has(integrationId)) {
      return this.providers.get(integrationId)!;
    }

    // Load integration from database
    const integrations = await db
      .select()
      .from(fileStorageIntegrations)
      .where(eq(fileStorageIntegrations.id, integrationId))
      .limit(1);

    if (!integrations || integrations.length === 0) {
      throw new Error(`Integration with ID ${integrationId} not found`);
    }

    const integration = integrations[0];

    // Create provider instance based on integration type
    let provider: FileStorageProvider;

    switch (integration.provider) {
      case 'sharepoint':
        provider = new SharePointProvider(integration);
        break;
      case 'box':
        provider = new BoxProvider(integration);
        break;
      case 'dropbox':
        provider = new DropboxProvider(integration);
        break;
      case 'google_drive':
        provider = new GoogleDriveProvider(integration);
        break;
      case 'onedrive':
        provider = new OneDriveProvider(integration);
        break;
      default:
        throw new Error(`Unsupported provider: ${integration.provider}`);
    }

    // Store provider for reuse
    this.providers.set(integrationId, provider);
    return provider;
  }

  /**
   * Get default provider if set or the first active integration
   */
  private async getDefaultProvider(): Promise<FileStorageProvider> {
    try {
      // Try to get default integration
      let integrations = await db
        .select()
        .from(fileStorageIntegrations)
        .where(and(
          eq(fileStorageIntegrations.isActive, true),
          eq(fileStorageIntegrations.defaultIntegration, true)
        ))
        .limit(1);

      // If no default, get first active integration
      if (!integrations || integrations.length === 0) {
        integrations = await db
          .select()
          .from(fileStorageIntegrations)
          .where(eq(fileStorageIntegrations.isActive, true))
          .limit(1);
      }

      if (!integrations || integrations.length === 0) {
        throw new Error('No active file storage integrations found');
      }

      return this.getProviderForIntegration(integrations[0].id);
    } catch (error) {
      this.logger.error('Failed to get default provider', error);
      throw error;
    }
  }

  /**
   * List all active integrations
   */
  public async listIntegrations(): Promise<FileStorageIntegration[]> {
    try {
      return await db
        .select()
        .from(fileStorageIntegrations)
        .orderBy(desc(fileStorageIntegrations.updatedAt));
    } catch (error) {
      this.logger.error('Failed to list integrations', error);
      throw error;
    }
  }

  /**
   * Get an integration by ID
   */
  public async getIntegration(id: number): Promise<FileStorageIntegration> {
    try {
      const integrations = await db
        .select()
        .from(fileStorageIntegrations)
        .where(eq(fileStorageIntegrations.id, id))
        .limit(1);

      if (!integrations || integrations.length === 0) {
        throw new Error(`Integration with ID ${id} not found`);
      }

      return integrations[0];
    } catch (error) {
      this.logger.error(`Failed to get integration ${id}`, error);
      throw error;
    }
  }

  /**
   * Create a new integration
   */
  public async createIntegration(data: Omit<FileStorageIntegration, 'id' | 'createdAt' | 'updatedAt'>): Promise<FileStorageIntegration> {
    try {
      // If set as default, unset others
      if (data.defaultIntegration) {
        await db
          .update(fileStorageIntegrations)
          .set({ defaultIntegration: false })
          .where(eq(fileStorageIntegrations.defaultIntegration, true));
      }

      const [integration] = await db
        .insert(fileStorageIntegrations)
        .values({
          ...data,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();

      this.eventBus.publish('file_storage.integration.created', {
        integrationId: integration.id,
        provider: integration.provider
      });

      return integration;
    } catch (error) {
      this.logger.error('Failed to create integration', error);
      throw error;
    }
  }

  /**
   * Update an integration
   */
  public async updateIntegration(id: number, data: Partial<Omit<FileStorageIntegration, 'id' | 'createdAt' | 'updatedAt'>>): Promise<FileStorageIntegration> {
    try {
      // If set as default, unset others
      if (data.defaultIntegration) {
        await db
          .update(fileStorageIntegrations)
          .set({ defaultIntegration: false })
          .where(and(
            eq(fileStorageIntegrations.defaultIntegration, true),
            sql`${fileStorageIntegrations.id} != ${id}`
          ));
      }

      const [integration] = await db
        .update(fileStorageIntegrations)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(fileStorageIntegrations.id, id))
        .returning();

      // Clear provider from cache if provider type changed
      if (data.provider && this.providers.has(id)) {
        this.providers.delete(id);
      }

      this.eventBus.publish('file_storage.integration.updated', {
        integrationId: integration.id,
        provider: integration.provider
      });

      return integration;
    } catch (error) {
      this.logger.error(`Failed to update integration ${id}`, error);
      throw error;
    }
  }

  /**
   * Delete an integration
   */
  public async deleteIntegration(id: number): Promise<boolean> {
    try {
      // Check for file references
      const fileCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(fileReferences)
        .where(eq(fileReferences.integrationId, id));

      if (fileCount[0].count > 0) {
        throw new Error(`Cannot delete integration with ${fileCount[0].count} file references`);
      }

      // Delete integration
      await db
        .delete(fileStorageIntegrations)
        .where(eq(fileStorageIntegrations.id, id));

      // Remove from provider cache
      if (this.providers.has(id)) {
        this.providers.delete(id);
      }

      this.eventBus.publish('file_storage.integration.deleted', {
        integrationId: id
      });

      return true;
    } catch (error) {
      this.logger.error(`Failed to delete integration ${id}`, error);
      throw error;
    }
  }

  /**
   * Test a connection to a file storage provider
   */
  public async testConnection(id: number): Promise<{ success: boolean; message: string }> {
    try {
      const provider = await this.getProviderForIntegration(id);
      const authenticated = await provider.authenticate();

      if (authenticated) {
        // Try listing files to verify connection
        await provider.listFiles();
        return { success: true, message: 'Connection successful' };
      } else {
        return { success: false, message: 'Authentication failed' };
      }
    } catch (error) {
      this.logger.error(`Connection test failed for integration ${id}`, error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * List files in a folder
   */
  public async listFiles(integrationId: number, folderId?: string): Promise<FileMetadata[]> {
    try {
      const provider = await this.getProviderForIntegration(integrationId);
      return await provider.listFiles(folderId);
    } catch (error) {
      this.logger.error(`Failed to list files for integration ${integrationId}`, error);
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  public async getFile(integrationId: number, fileId: string): Promise<FileMetadata> {
    try {
      const provider = await this.getProviderForIntegration(integrationId);
      return await provider.getFile(fileId);
    } catch (error) {
      this.logger.error(`Failed to get file ${fileId} for integration ${integrationId}`, error);
      throw error;
    }
  }

  /**
   * Download a file
   */
  public async downloadFile(integrationId: number, fileId: string, destinationPath: string): Promise<string> {
    try {
      const provider = await this.getProviderForIntegration(integrationId);
      return await provider.downloadFile(fileId, destinationPath);
    } catch (error) {
      this.logger.error(`Failed to download file ${fileId} for integration ${integrationId}`, error);
      throw error;
    }
  }

  /**
   * Upload a file
   */
  public async uploadFile(integrationId: number, folderPath: string, filePath: string, metadata?: Record<string, any>): Promise<FileMetadata> {
    try {
      const provider = await this.getProviderForIntegration(integrationId);
      return await provider.uploadFile(folderPath, filePath, metadata);
    } catch (error) {
      this.logger.error(`Failed to upload file to ${folderPath} for integration ${integrationId}`, error);
      throw error;
    }
  }

  /**
   * Create a folder
   */
  public async createFolder(integrationId: number, parentFolderId: string, folderName: string): Promise<FileMetadata> {
    try {
      const provider = await this.getProviderForIntegration(integrationId);
      return await provider.createFolder(parentFolderId, folderName);
    } catch (error) {
      this.logger.error(`Failed to create folder ${folderName} for integration ${integrationId}`, error);
      throw error;
    }
  }

  /**
   * Delete a file or folder
   */
  public async deleteFile(integrationId: number, fileId: string): Promise<boolean> {
    try {
      const provider = await this.getProviderForIntegration(integrationId);
      return await provider.deleteFile(fileId);
    } catch (error) {
      this.logger.error(`Failed to delete file ${fileId} for integration ${integrationId}`, error);
      throw error;
    }
  }

  /**
   * Move a file or folder
   */
  public async moveFile(integrationId: number, fileId: string, newParentFolderId: string): Promise<FileMetadata> {
    try {
      const provider = await this.getProviderForIntegration(integrationId);
      return await provider.moveFile(fileId, newParentFolderId);
    } catch (error) {
      this.logger.error(`Failed to move file ${fileId} for integration ${integrationId}`, error);
      throw error;
    }
  }

  /**
   * Search for files
   */
  public async searchFiles(integrationId: number, query: string): Promise<FileMetadata[]> {
    try {
      const provider = await this.getProviderForIntegration(integrationId);
      return await provider.searchFiles(query);
    } catch (error) {
      this.logger.error(`Failed to search files with query "${query}" for integration ${integrationId}`, error);
      throw error;
    }
  }

  /**
   * Get file operations log
   */
  public async getOperationsLog(integrationId: number, limit = 100): Promise<any[]> {
    try {
      return await db
        .select()
        .from(fileOperationsLog)
        .where(eq(fileOperationsLog.integrationId, integrationId))
        .orderBy(desc(fileOperationsLog.createdAt))
        .limit(limit);
    } catch (error) {
      this.logger.error(`Failed to get operations log for integration ${integrationId}`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const fileStorageService = FileStorageService.getInstance();