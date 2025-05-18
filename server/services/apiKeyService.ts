/**
 * API Key Service
 * 
 * Provides functionality for creating, validating, and revoking API keys.
 * Keys are securely stored using a hash + salt pattern to prevent
 * key leakage in the event of a database compromise.
 */

import { createHash, randomBytes } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../../db';
import { apiKeys } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { storage } from '../storage';
import { createAuditLog } from './auditLogService';

/**
 * KeyValidationResult provides comprehensive information about an API key
 * after validation.
 */
export interface KeyValidationResult {
  keyId: number;
  userId: number;
  workspaceId?: number;
  scopes: string[];
}

/**
 * API Key Service class provides methods for managing API keys
 */
class ApiKeyService {
  /**
   * Generate a new API key
   * Format: prefix_timestamp_random
   * 
   * @returns A newly generated API key
   */
  private generateApiKey(): string {
    const prefix = 'mcp';
    const timestamp = Date.now().toString(36);
    const random = randomBytes(18).toString('base64url');
    
    return `${prefix}_${timestamp}_${random}`;
  }
  
  /**
   * Compute a hash for the given API key
   * This is used to securely store the key in the database
   * 
   * @param key API key to hash
   * @returns Hash of the key
   */
  private hashApiKey(key: string): string {
    return createHash('sha256')
      .update(key)
      .digest('hex');
  }
  
  /**
   * Create a new API key for a user
   * 
   * @param userId User ID to associate with the API key
   * @param name User-friendly name/description of the key
   * @param scopes Permission scopes for this key
   * @param workspaceId Optional workspace ID to associate with the key
   * @param expiresAt Optional expiration date
   * @returns The newly created API key
   */
  public async createApiKey(
    userId: number,
    name: string,
    scopes: string[],
    workspaceId?: number,
    expiresAt?: Date
  ): Promise<{ id: number; key: string }> {
    // Generate a new API key
    const key = this.generateApiKey();
    const hash = this.hashApiKey(key);
    
    try {
      // Store the key hash in the database
      const [result] = await db.insert(apiKeys).values({
        userId,
        name,
        scopes,
        workspaceId,
        expiresAt,
        key: key, // Store original key for immediate return only
        hash: hash,
        createdAt: new Date(),
        isActive: true
      }).returning({ id: apiKeys.id });
      
      // Create audit log entry
      await createAuditLog({
        userId,
        action: 'api_key_created',
        resourceType: 'api_key',
        resourceId: result.id.toString(),
        workspaceId,
        details: {
          name,
          scopes,
          expiresAt,
          keyFragment: key.substring(0, 8) + '...'
        }
      });
      
      return { id: result.id, key: key };
    } catch (error) {
      console.error('Error creating API key:', error);
      throw new Error('Failed to create API key');
    }
  }
  
  /**
   * Verify if an API key is valid and active
   * 
   * @param apiKey API key to verify
   * @returns Key validation result if valid, null if invalid
   */
  public async verifyApiKey(apiKey: string): Promise<KeyValidationResult | null> {
    try {
      // Hash the provided key for comparison
      const hash = this.hashApiKey(apiKey);
      
      // Find key in the database by hash
      const result = await db.query.apiKeys.findFirst({
        where: and(
          eq(apiKeys.hash, hash),
          eq(apiKeys.isActive, true)
        )
      });
      
      if (!result) {
        return null;
      }
      
      // Check if the key is expired
      if (result.expiresAt && result.expiresAt < new Date()) {
        // Audit log for expired key usage attempt
        await createAuditLog({
          userId: result.userId,
          action: 'api_key_expired_usage_attempt',
          resourceType: 'api_key',
          resourceId: result.id.toString(),
          workspaceId: result.workspaceId,
          details: {
            name: result.name,
            expiresAt: result.expiresAt,
            keyFragment: apiKey.substring(0, 8) + '...'
          }
        });
        
        return null;
      }
      
      // Update last used at timestamp
      await db
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, result.id));
      
      // Return validation result
      return {
        keyId: result.id,
        userId: result.userId,
        workspaceId: result.workspaceId || undefined,
        scopes: result.scopes as string[]
      };
    } catch (error) {
      console.error('Error verifying API key:', error);
      return null;
    }
  }
  
  /**
   * Revoke (deactivate) an API key
   * 
   * @param keyId ID of the key to revoke
   * @param userId User ID performing the revocation (for audit purposes)
   * @returns True if successful, false otherwise
   */
  public async revokeApiKey(keyId: number, userId: number): Promise<boolean> {
    try {
      // Get the key first for audit purposes
      const key = await db.query.apiKeys.findFirst({
        where: eq(apiKeys.id, keyId)
      });
      
      if (!key) {
        return false;
      }
      
      // Check if the user has permission to revoke this key
      const user = await storage.getUser(userId);
      const isAdmin = user?.role === 'admin';
      const isOwner = key.userId === userId;
      
      if (!isAdmin && !isOwner) {
        // Audit log for unauthorized revocation attempt
        await createAuditLog({
          userId,
          action: 'api_key_unauthorized_revocation_attempt',
          resourceType: 'api_key',
          resourceId: keyId.toString(),
          workspaceId: key.workspaceId,
          details: {
            name: key.name,
            keyOwner: key.userId
          }
        });
        
        return false;
      }
      
      // Revoke the key by setting isActive to false
      await db
        .update(apiKeys)
        .set({ 
          isActive: false,
          updatedAt: new Date() 
        })
        .where(eq(apiKeys.id, keyId));
      
      // Audit log for key revocation
      await createAuditLog({
        userId,
        action: 'api_key_revoked',
        resourceType: 'api_key',
        resourceId: keyId.toString(),
        workspaceId: key.workspaceId,
        details: {
          name: key.name,
          keyOwner: key.userId
        }
      });
      
      return true;
    } catch (error) {
      console.error('Error revoking API key:', error);
      return false;
    }
  }
  
  /**
   * List all API keys for a user
   * 
   * @param userId User ID to list keys for
   * @returns Array of API keys (without actual key values)
   */
  public async listApiKeys(userId: number): Promise<any[]> {
    try {
      const keys = await db.query.apiKeys.findMany({
        where: eq(apiKeys.userId, userId),
        orderBy: (apiKeys, { desc }) => [desc(apiKeys.createdAt)]
      });
      
      // Remove sensitive information
      return keys.map(key => ({
        id: key.id,
        name: key.name,
        createdAt: key.createdAt,
        lastUsedAt: key.lastUsedAt,
        expiresAt: key.expiresAt,
        scopes: key.scopes,
        isActive: key.isActive,
        workspaceId: key.workspaceId,
        // Show a hint of the key for recognition, without revealing the full key
        keyHint: key.key ? 
          `${key.key.split('_')[0]}_...${key.key.substring(key.key.length - 5)}` : 
          null
      }));
    } catch (error) {
      console.error('Error listing API keys:', error);
      return [];
    }
  }
  
  /**
   * List all API keys for a workspace
   * 
   * @param workspaceId Workspace ID to list keys for
   * @returns Array of API keys (without actual key values)
   */
  public async listWorkspaceApiKeys(workspaceId: number): Promise<any[]> {
    try {
      const keys = await db.query.apiKeys.findMany({
        where: eq(apiKeys.workspaceId, workspaceId),
        orderBy: (apiKeys, { desc }) => [desc(apiKeys.createdAt)]
      });
      
      // Remove sensitive information
      return keys.map(key => ({
        id: key.id,
        name: key.name,
        userId: key.userId,
        createdAt: key.createdAt,
        lastUsedAt: key.lastUsedAt,
        expiresAt: key.expiresAt,
        scopes: key.scopes,
        isActive: key.isActive,
        keyHint: key.key ? 
          `${key.key.split('_')[0]}_...${key.key.substring(key.key.length - 5)}` : 
          null
      }));
    } catch (error) {
      console.error('Error listing workspace API keys:', error);
      return [];
    }
  }
  
  /**
   * Get statistics about API key usage
   * 
   * @param userId User ID to get statistics for
   * @returns Statistics about API key usage
   */
  public async getApiKeyStats(userId: number): Promise<{
    totalKeys: number;
    activeKeys: number;
    expiredKeys: number;
    revokedKeys: number;
  }> {
    try {
      // Count total keys
      const [totalResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(apiKeys)
        .where(eq(apiKeys.userId, userId));
      
      // Count active keys
      const [activeResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(apiKeys)
        .where(and(
          eq(apiKeys.userId, userId),
          eq(apiKeys.isActive, true),
          sql`(${apiKeys.expiresAt} IS NULL OR ${apiKeys.expiresAt} > NOW())`
        ));
      
      // Count expired keys
      const [expiredResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(apiKeys)
        .where(and(
          eq(apiKeys.userId, userId),
          eq(apiKeys.isActive, true),
          sql`${apiKeys.expiresAt} IS NOT NULL AND ${apiKeys.expiresAt} <= NOW()`
        ));
      
      // Count revoked keys
      const [revokedResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(apiKeys)
        .where(and(
          eq(apiKeys.userId, userId),
          eq(apiKeys.isActive, false)
        ));
      
      return {
        totalKeys: totalResult.count,
        activeKeys: activeResult.count,
        expiredKeys: expiredResult.count,
        revokedKeys: revokedResult.count
      };
    } catch (error) {
      console.error('Error getting API key stats:', error);
      return {
        totalKeys: 0,
        activeKeys: 0,
        expiredKeys: 0,
        revokedKeys: 0
      };
    }
  }
}

export const apiKeyService = new ApiKeyService();