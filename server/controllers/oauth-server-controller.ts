/**
 * OAuth Server Controller
 * 
 * Handles OAuth flows for MCP server registration and authentication
 * Implements the Authorization Code flow for server authentication
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../../db';
import { mcpProxyService } from '../services/mcp-proxy-service';
import { mcpServers } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { createAuditLog } from '../services/auditLogService';
import { randomBytes, createHash } from 'crypto';
import { eventBus } from '../eventBus';

// Schema for server registration
const serverRegistrationSchema = z.object({
  name: z.string().min(3).max(100),
  url: z.string().url(),
  description: z.string().optional(),
  clientId: z.string(),
  clientSecret: z.string(),
  authorizationUrl: z.string().url(),
  tokenUrl: z.string().url(),
  scope: z.string().optional(),
  tags: z.array(z.string()).optional()
});

// Schema for OAuth authorization
const oauthAuthorizeSchema = z.object({
  serverId: z.coerce.number().int().positive(),
  redirectUri: z.string().url()
});

// Schema for OAuth callback
const oauthCallbackSchema = z.object({
  serverId: z.coerce.number().int().positive(),
  code: z.string(),
  state: z.string().optional(),
  redirectUri: z.string().url()
});

export class OAuthServerController {
  /**
   * Register a new MCP server
   */
  public async registerServer(req: Request, res: Response) {
    try {
      // Validate request body
      const validation = serverRegistrationSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid server registration data',
          details: validation.error.format()
        });
      }
      
      const { 
        name, 
        url, 
        description, 
        clientId, 
        clientSecret, 
        authorizationUrl, 
        tokenUrl, 
        scope, 
        tags 
      } = validation.data;
      
      // Check if server with same URL already exists
      const existingServer = await db.query.mcpServers.findFirst({
        where: eq(mcpServers.url, url)
      });
      
      if (existingServer) {
        return res.status(409).json({
          error: 'A server with this URL is already registered'
        });
      }
      
      // Create a state value for CSRF protection
      const state = this.generateRandomString(32);
      
      // Insert new server
      const [server] = await db.insert(mcpServers)
        .values({
          name,
          url,
          description: description || '',
          clientId,
          clientSecret,
          authorizationUrl,
          tokenUrl,
          scope: scope || '',
          status: 'pending',
          createdAt: new Date(),
          lastUpdated: new Date(),
          oauth2State: state,
          tags: tags || []
        })
        .returning();
      
      // Create audit log
      await createAuditLog({
        userId: req.user?.id,
        action: 'server_registered',
        resourceType: 'mcp_server',
        resourceId: server.id.toString(),
        details: {
          name,
          url
        }
      });
      
      // Emit event
      eventBus.emit('mcp.server.registered', {
        serverId: server.id,
        name,
        url
      });
      
      return res.status(201).json({
        id: server.id,
        name: server.name,
        url: server.url,
        status: server.status,
        message: 'Server registered successfully'
      });
    } catch (error) {
      console.error('Error registering server:', error);
      return res.status(500).json({
        error: 'Failed to register server'
      });
    }
  }
  
  /**
   * Generate OAuth authorization URL for server
   */
  public async authorizeServer(req: Request, res: Response) {
    try {
      // Validate request body
      const validation = oauthAuthorizeSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid authorization request',
          details: validation.error.format()
        });
      }
      
      const { serverId, redirectUri } = validation.data;
      
      // Get server details
      const server = await db.query.mcpServers.findFirst({
        where: eq(mcpServers.id, serverId)
      });
      
      if (!server) {
        return res.status(404).json({
          error: 'Server not found'
        });
      }
      
      // Generate a state parameter for CSRF protection
      const state = this.generateRandomString(32);
      
      // Update the server with the state
      await db.update(mcpServers)
        .set({
          oauth2State: state,
          lastUpdated: new Date()
        })
        .where(eq(mcpServers.id, serverId));
      
      // Build authorization URL
      const authUrl = new URL(server.authorizationUrl);
      
      // Add required OAuth parameters
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('client_id', server.clientId);
      authUrl.searchParams.append('redirect_uri', redirectUri);
      authUrl.searchParams.append('state', state);
      
      // Add scope if provided
      if (server.scope) {
        authUrl.searchParams.append('scope', server.scope);
      }
      
      // Create audit log
      await createAuditLog({
        userId: req.user?.id,
        action: 'server_authorization_initiated',
        resourceType: 'mcp_server',
        resourceId: server.id.toString(),
        details: {
          redirectUri
        }
      });
      
      return res.json({
        authorizationUrl: authUrl.toString()
      });
    } catch (error) {
      console.error('Error generating authorization URL:', error);
      return res.status(500).json({
        error: 'Failed to generate authorization URL'
      });
    }
  }
  
  /**
   * Handle OAuth callback and exchange code for token
   */
  public async handleCallback(req: Request, res: Response) {
    try {
      // Validate request body
      const validation = oauthCallbackSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid callback request',
          details: validation.error.format()
        });
      }
      
      const { serverId, code, state, redirectUri } = validation.data;
      
      // Get server details
      const server = await db.query.mcpServers.findFirst({
        where: eq(mcpServers.id, serverId)
      });
      
      if (!server) {
        return res.status(404).json({
          error: 'Server not found'
        });
      }
      
      // Verify state parameter to prevent CSRF
      if (state && server.oauth2State !== state) {
        return res.status(400).json({
          error: 'Invalid state parameter'
        });
      }
      
      // Exchange code for token
      const tokenResponse = await this.exchangeCodeForToken(
        code,
        server.clientId,
        server.clientSecret,
        redirectUri,
        server.tokenUrl
      );
      
      // Update server with token
      await db.update(mcpServers)
        .set({
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token || null,
          tokenExpiresAt: tokenResponse.expires_in
            ? new Date(Date.now() + tokenResponse.expires_in * 1000)
            : null,
          status: 'connected',
          lastUpdated: new Date(),
          lastConnected: new Date()
        })
        .where(eq(mcpServers.id, serverId));
      
      // Update proxy service with new token
      await mcpProxyService.updateServerOAuthCredentials(
        serverId,
        tokenResponse.access_token,
        tokenResponse.refresh_token,
        tokenResponse.expires_in
          ? new Date(Date.now() + tokenResponse.expires_in * 1000)
          : undefined
      );
      
      // Create audit log
      await createAuditLog({
        userId: req.user?.id,
        action: 'server_authenticated',
        resourceType: 'mcp_server',
        resourceId: server.id.toString(),
        details: {
          status: 'success'
        }
      });
      
      // Emit event
      eventBus.emit('mcp.server.authenticated', {
        serverId,
        serverName: server.name
      });
      
      return res.json({
        success: true,
        serverId,
        status: 'connected',
        message: 'Server authenticated successfully'
      });
    } catch (error) {
      console.error('Error handling OAuth callback:', error);
      return res.status(500).json({
        error: 'Failed to authenticate server'
      });
    }
  }
  
  /**
   * Exchange authorization code for access token
   */
  private async exchangeCodeForToken(
    code: string,
    clientId: string,
    clientSecret: string,
    redirectUri: string,
    tokenUrl: string
  ): Promise<any> {
    // Create token request body
    const body = new URLSearchParams();
    body.append('grant_type', 'authorization_code');
    body.append('code', code);
    body.append('client_id', clientId);
    body.append('client_secret', clientSecret);
    body.append('redirect_uri', redirectUri);
    
    // Make token request
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: body.toString()
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token request failed: ${response.status} ${errorText}`);
    }
    
    // Parse token response
    const tokenData = await response.json();
    
    return {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type,
      scope: tokenData.scope
    };
  }
  
  /**
   * Generate a random string for CSRF protection
   */
  private generateRandomString(length: number): string {
    return randomBytes(Math.ceil(length / 2))
      .toString('hex')
      .slice(0, length);
  }
  
  /**
   * Refresh access token using refresh token
   */
  public async refreshToken(req: Request, res: Response) {
    try {
      const serverId = parseInt(req.params.serverId);
      
      if (isNaN(serverId)) {
        return res.status(400).json({
          error: 'Invalid server ID'
        });
      }
      
      // Get server details
      const server = await db.query.mcpServers.findFirst({
        where: eq(mcpServers.id, serverId)
      });
      
      if (!server) {
        return res.status(404).json({
          error: 'Server not found'
        });
      }
      
      if (!server.refreshToken) {
        return res.status(400).json({
          error: 'No refresh token available'
        });
      }
      
      // Refresh the token
      const tokenResponse = await this.refreshAccessToken(
        server.refreshToken,
        server.clientId,
        server.clientSecret,
        server.tokenUrl
      );
      
      // Update server with new token
      await db.update(mcpServers)
        .set({
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token || server.refreshToken,
          tokenExpiresAt: tokenResponse.expires_in
            ? new Date(Date.now() + tokenResponse.expires_in * 1000)
            : null,
          status: 'connected',
          lastUpdated: new Date()
        })
        .where(eq(mcpServers.id, serverId));
      
      // Update proxy service with new token
      await mcpProxyService.updateServerOAuthCredentials(
        serverId,
        tokenResponse.access_token,
        tokenResponse.refresh_token || server.refreshToken,
        tokenResponse.expires_in
          ? new Date(Date.now() + tokenResponse.expires_in * 1000)
          : undefined
      );
      
      // Create audit log
      await createAuditLog({
        userId: req.user?.id,
        action: 'server_token_refreshed',
        resourceType: 'mcp_server',
        resourceId: server.id.toString()
      });
      
      return res.json({
        success: true,
        message: 'Token refreshed successfully'
      });
    } catch (error) {
      console.error('Error refreshing token:', error);
      return res.status(500).json({
        error: 'Failed to refresh token'
      });
    }
  }
  
  /**
   * Refresh an access token using a refresh token
   */
  private async refreshAccessToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string,
    tokenUrl: string
  ): Promise<any> {
    // Create token request body
    const body = new URLSearchParams();
    body.append('grant_type', 'refresh_token');
    body.append('refresh_token', refreshToken);
    body.append('client_id', clientId);
    body.append('client_secret', clientSecret);
    
    // Make token request
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: body.toString()
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
    }
    
    // Parse token response
    const tokenData = await response.json();
    
    return {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token, // May not be returned
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type,
      scope: tokenData.scope
    };
  }
}

// Export singleton instance
export const oauthServerController = new OAuthServerController();