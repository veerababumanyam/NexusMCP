/**
 * OAuth2 Client Credentials Service
 * 
 * Implements the OAuth 2.0 Client Credentials grant flow for machine-to-machine communication.
 * This service enables secure API access between services using the OAuth 2.0 Client Credentials flow.
 */

import crypto from 'crypto';
import { db } from '../../../db';
import { and, eq } from 'drizzle-orm';
import * as schema from '@shared/schema_oauth';
import { eventBus } from '../../infrastructure/events/EventBus';
import { sql } from 'drizzle-orm';

export class OAuth2ClientCredentialsService {
  /**
   * Default token expiration time in seconds (1 hour)
   */
  private readonly DEFAULT_TOKEN_EXPIRY_SECONDS = 3600;

  /**
   * Register a new OAuth client for machine-to-machine communication
   */
  public async registerClient(clientData: schema.OAuthClientCreate): Promise<schema.OAuthClientPublic> {
    try {
      const clientId = this.generateClientId();
      const clientSecret = this.generateClientSecret();

      const insertData = {
        clientId,
        clientSecret,
        clientName: clientData.clientName,
        description: clientData.description || null,
        clientUri: clientData.clientUri || null,
        logoUri: clientData.logoUri || null,
        redirectUris: clientData.redirectUris || [],
        grantTypes: clientData.grantTypes,
        scopes: clientData.scopes,
        workspaceId: clientData.workspaceId || null,
        createdBy: clientData.createdBy || null,
        isConfidential: true,
        isEnabled: true
      };

      const insertResult = await db.insert(schema.oauthClients).values(insertData).returning();
      
      if (!insertResult || insertResult.length === 0) {
        throw new Error('Failed to insert client');
      }
      
      const client = insertResult[0];
      
      console.log(`OAuth client registered: ${clientId}`);
      
      // Emit event
      eventBus.publish('oauth.client.created', {
        clientId: client.clientId,
        clientName: client.clientName,
        scopes: client.scopes,
        workspaceId: client.workspaceId
      });
      
      // Return client without secret
      const { clientSecret: _, ...safeClient } = client;
      return safeClient;
    } catch (error) {
      console.error('Failed to register OAuth client:', error);
      throw new Error('Failed to register OAuth client');
    }
  }

  /**
   * Get a client by ID
   */
  public async getClientById(id: number): Promise<schema.OAuthClientPublic | null> {
    try {
      const clients = await db.select().from(schema.oauthClients).where(eq(schema.oauthClients.id, id));
      
      if (!clients || clients.length === 0) {
        return null;
      }
      
      // Remove client secret from response
      const { clientSecret, ...safeClient } = clients[0];
      return safeClient;
    } catch (error) {
      console.error(`Failed to get client with ID ${id}:`, error);
      throw new Error('Failed to get client');
    }
  }

  /**
   * Get a client by client ID string
   */
  public async getClientByClientId(clientId: string): Promise<schema.OAuthClient | null> {
    try {
      const clients = await db.select().from(schema.oauthClients).where(eq(schema.oauthClients.clientId, clientId));
      
      if (!clients || clients.length === 0) {
        return null;
      }
      
      return clients[0];
    } catch (error) {
      console.error(`Failed to get client with client ID ${clientId}:`, error);
      throw new Error('Failed to get client');
    }
  }

  /**
   * List all clients with optional workspace filter
   */
  public async listClients(workspaceId?: number): Promise<schema.OAuthClientPublic[]> {
    try {
      let query = db.select().from(schema.oauthClients);
      
      if (workspaceId !== undefined) {
        query = query.where(eq(schema.oauthClients.workspaceId, workspaceId));
      }
      
      const clients = await query;
      
      // Remove client secrets from the response
      return clients.map(client => {
        const { clientSecret, ...safeClient } = client;
        return safeClient;
      });
    } catch (error) {
      console.error('Failed to list OAuth clients:', error);
      throw new Error('Failed to list OAuth clients');
    }
  }

  /**
   * Update an existing client
   */
  public async updateClient(
    clientId: number,
    updates: Partial<schema.OAuthClientCreate>
  ): Promise<schema.OAuthClientPublic | null> {
    try {
      // Build update object
      const updateData: Record<string, any> = {
        updatedAt: new Date()
      };
      
      // Add valid update fields
      if (updates.clientName) updateData.clientName = updates.clientName;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.clientUri !== undefined) updateData.clientUri = updates.clientUri;
      if (updates.logoUri !== undefined) updateData.logoUri = updates.logoUri;
      if (updates.redirectUris) updateData.redirectUris = updates.redirectUris;
      if (updates.scopes) updateData.scopes = updates.scopes;
      
      // Don't allow changing grant types directly as it could break functionality
      
      const result = await db.update(schema.oauthClients)
        .set(updateData)
        .where(eq(schema.oauthClients.id, clientId))
        .returning();
      
      if (!result || result.length === 0) {
        return null;
      }
      
      // Remove client secret
      const { clientSecret, ...safeClient } = result[0];
      return safeClient;
    } catch (error) {
      console.error(`Failed to update client ${clientId}:`, error);
      throw new Error('Failed to update OAuth client');
    }
  }

  /**
   * Enable or disable a client
   */
  public async setClientStatus(clientId: number, isEnabled: boolean): Promise<boolean> {
    try {
      const result = await db.update(schema.oauthClients)
        .set({
          isEnabled,
          updatedAt: new Date()
        })
        .where(eq(schema.oauthClients.id, clientId))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error(`Failed to ${isEnabled ? 'enable' : 'disable'} client ${clientId}:`, error);
      throw new Error(`Failed to ${isEnabled ? 'enable' : 'disable'} OAuth client`);
    }
  }

  /**
   * Delete a client and all its tokens
   */
  public async deleteClient(clientId: number): Promise<boolean> {
    try {
      // Cascade will delete related tokens and metadata
      const result = await db.delete(schema.oauthClients)
        .where(eq(schema.oauthClients.id, clientId))
        .returning();
      
      return result.length > 0;
    } catch (error) {
      console.error(`Failed to delete client ${clientId}:`, error);
      throw new Error('Failed to delete OAuth client');
    }
  }

  /**
   * Issue a new access token for a client using the client credentials flow
   */
  public async issueToken(
    clientId: string,
    clientSecret: string,
    requestedScopes?: string
  ): Promise<schema.TokenResponse | null> {
    try {
      // Find the client
      const client = await this.getClientByClientId(clientId);
      
      if (!client) {
        console.warn(`Client ID not found: ${clientId}`);
        return null;
      }
      
      if (client.clientSecret !== clientSecret) {
        console.warn(`Invalid client secret for client ID: ${clientId}`);
        return null;
      }
      
      if (!client.isEnabled) {
        console.warn(`Attempted to issue token for disabled client: ${clientId}`);
        return null;
      }
      
      // Only allow client_credentials grant type
      if (!client.grantTypes.includes('client_credentials')) {
        console.warn(`Client ${clientId} is not authorized for client_credentials grant`);
        return null;
      }
      
      // Determine which scopes to grant based on the client's allowed scopes
      let grantedScopes = client.scopes;
      if (requestedScopes) {
        const requestedScopeArray = requestedScopes.split(' ');
        grantedScopes = requestedScopeArray.filter(scope => 
          client.scopes.includes(scope)
        );
        
        if (grantedScopes.length === 0) {
          console.warn(`No valid scopes requested for client ${clientId}`);
          return null;
        }
      }
      
      // Generate a secure access token
      const accessToken = this.generateAccessToken();
      const expiresIn = this.DEFAULT_TOKEN_EXPIRY_SECONDS;
      const expiresAt = new Date(Date.now() + expiresIn * 1000);
      
      // Store the token
      await db.insert(schema.oauthAccessTokens).values({
        accessToken,
        clientId: client.id,
        scopes: grantedScopes,
        expiresAt,
        issuedAt: new Date()
      });
      
      console.log(`Issued access token for client ${clientId}`);
      
      // Emit event
      eventBus.publish('oauth.token.issued', {
        clientId: client.clientId,
        scopes: grantedScopes,
        expiresAt
      });
      
      return {
        access_token: accessToken,
        token_type: 'bearer',
        expires_in: expiresIn,
        scope: grantedScopes.join(' ')
      };
    } catch (error) {
      console.error(`Failed to issue token for client ${clientId}:`, error);
      throw new Error('Failed to issue access token');
    }
  }

  /**
   * Validate an access token and return its associated client and scopes
   */
  public async validateToken(token: string): Promise<{
    clientId: string;
    scopes: string[];
    client: schema.OAuthClientPublic;
  } | null> {
    try {
      const tokens = await db.select()
        .from(schema.oauthAccessTokens)
        .where(eq(schema.oauthAccessTokens.accessToken, token));
      
      if (!tokens || tokens.length === 0) {
        console.warn('Token not found');
        return null;
      }
      
      const tokenRecord = tokens[0];
      
      if (tokenRecord.isRevoked) {
        console.warn('Token has been revoked');
        return null;
      }
      
      if (new Date() > tokenRecord.expiresAt) {
        console.warn('Token has expired');
        return null;
      }
      
      // Get the client
      const client = await this.getClientById(tokenRecord.clientId);
      if (!client) {
        console.warn(`Client for token not found (ID: ${tokenRecord.clientId})`);
        return null;
      }
      
      // Get full client to check enabled status
      const fullClient = await this.getClientByClientId(client.clientId);
      if (!fullClient || !fullClient.isEnabled) {
        console.warn(`Client ${client.clientId} is disabled`);
        return null;
      }
      
      return {
        clientId: client.clientId,
        scopes: tokenRecord.scopes,
        client
      };
    } catch (error) {
      console.error('Failed to validate token:', error);
      throw new Error('Failed to validate access token');
    }
  }

  /**
   * Revoke an access token
   */
  public async revokeToken(token: string): Promise<boolean> {
    try {
      const result = await db.update(schema.oauthAccessTokens)
        .set({
          isRevoked: true
        })
        .where(eq(schema.oauthAccessTokens.accessToken, token))
        .returning();
      
      const success = result.length > 0;
      
      if (success) {
        eventBus.publish('oauth.token.revoked', {
          token: token.substring(0, 8) + '...' // Only log part of the token for security
        });
      }
      
      return success;
    } catch (error) {
      console.error('Failed to revoke token:', error);
      throw new Error('Failed to revoke access token');
    }
  }

  /**
   * Revoke all tokens for a client
   */
  public async revokeClientTokens(clientId: number): Promise<number> {
    try {
      const result = await db.update(schema.oauthAccessTokens)
        .set({
          isRevoked: true
        })
        .where(eq(schema.oauthAccessTokens.clientId, clientId))
        .returning();
      
      const count = result.length;
      
      eventBus.publish('oauth.tokens.bulk_revoked', {
        clientId,
        count
      });
      
      return count;
    } catch (error) {
      console.error(`Failed to revoke tokens for client ${clientId}:`, error);
      throw new Error('Failed to revoke client tokens');
    }
  }

  /**
   * Check if a token has a required scope
   */
  public hasScope(tokenInfo: { scopes: string[] }, requiredScope: string): boolean {
    return tokenInfo.scopes.includes(requiredScope);
  }

  /**
   * Clean up expired tokens to maintain database performance
   * This should be run periodically (e.g., with a cron job)
   */
  public async cleanupExpiredTokens(): Promise<number> {
    try {
      const now = new Date();
      const result = await db.delete(schema.oauthAccessTokens)
        .where(and(
          eq(schema.oauthAccessTokens.isRevoked, false),
          sql`${schema.oauthAccessTokens.expiresAt} < ${now}`
        ))
        .returning();
      
      const count = result.length;
      
      console.log(`Cleaned up ${count} expired tokens`);
      return count;
    } catch (error) {
      console.error('Failed to clean up expired tokens:', error);
      throw new Error('Failed to clean up expired tokens');
    }
  }

  /**
   * Generate a unique client ID
   */
  private generateClientId(): string {
    // Format: prefix-random-timestamp
    return `mcp-${crypto.randomBytes(8).toString('hex')}-${Date.now()}`;
  }

  /**
   * Generate a secure client secret
   */
  private generateClientSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate a secure access token
   */
  private generateAccessToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}