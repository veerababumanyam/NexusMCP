/**
 * McpOAuthController - Presentation Layer
 * 
 * This controller provides REST API endpoints for managing OAuth 2.1 Client Credentials
 * configurations for MCP Server communication.
 */

import { BaseController } from './BaseController';
import { Request, Response } from 'express';
import { z } from 'zod';
import { eventBus } from '../infrastructure/events/EventBus';
import { mcpOAuthService } from '../services/oauth/McpOAuthService';
import { createAuditLogFromRequest } from '../services/enhancedAuditService';
import { storage } from '../storage';

// Schema for global OAuth configuration
const globalOAuthConfigSchema = z.object({
  enabled: z.boolean(),
  defaultScopes: z.array(z.string()).optional(),
  defaultAuthServer: z.object({
    discoveryUrl: z.string().url().optional(),
    tokenUrl: z.string().url(),
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
    jwksUri: z.string().url().optional()
  }).optional(),
  tokenValidation: z.object({
    enabled: z.boolean(),
    requiredScopes: z.array(z.string()).optional(),
    audience: z.string().optional()
  }).optional()
});

// Schema for server-specific OAuth configuration
const serverOAuthConfigSchema = z.object({
  tokenUrl: z.string().url(),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  scopes: z.array(z.string()).optional()
});

// Schema for OAuth discovery
const oauthDiscoverySchema = z.object({
  discoveryUrl: z.string().url()
});

// Schema for token request
const tokenRequestSchema = z.object({
  serverId: z.number().int().positive().optional()
});

/**
 * Controller for MCP OAuth 2.1 operations
 */
export class McpOAuthController extends BaseController {
  /**
   * Get the global OAuth configuration (sanitized)
   */
  public getOAuthConfig = this.createHandler(async (req: Request, res: Response) => {
    try {
      // Get current configuration from settings table in database
      const settings = await storage.getSystemSettings('mcpOAuth');
      
      // If no configuration found, return default empty config
      if (!settings || !settings.value) {
        return this.sendSuccess(res, {
          enabled: false,
          defaultScopes: ['mcp.read', 'mcp.call'],
          tokenValidation: {
            enabled: true,
            requiredScopes: ['mcp.call']
          }
        });
      }
      
      // Parse the configuration
      const config = JSON.parse(settings.value);
      
      // Sanitize configuration (remove secrets)
      const sanitizedConfig = {
        ...config,
        defaultAuthServer: config.defaultAuthServer ? {
          discoveryUrl: config.defaultAuthServer.discoveryUrl,
          tokenUrl: config.defaultAuthServer.tokenUrl,
          clientId: config.defaultAuthServer.clientId,
          clientSecret: '******', // Mask the secret
          jwksUri: config.defaultAuthServer.jwksUri
        } : undefined
      };
      
      return this.sendSuccess(res, sanitizedConfig);
    } catch (error) {
      return this.sendError(res, 'Failed to get OAuth configuration', 500, error);
    }
  });
  
  /**
   * Update the global OAuth configuration
   */
  public updateOAuthConfig = this.createValidatedHandler(globalOAuthConfigSchema, async (req, res, data) => {
    try {
      // Store configuration in database
      await storage.setSystemSettings('mcpOAuth', JSON.stringify(data));
      
      // Update the service configuration
      mcpOAuthService.configure(data);
      
      // Create audit log
      await createAuditLogFromRequest({
        req,
        action: 'update',
        resourceType: 'oauth_config',
        resourceId: 'global',
        details: {
          enabled: data.enabled,
          defaultScopes: data.defaultScopes,
          // Do not log secrets in audit logs
          hasDefaultAuthServer: !!data.defaultAuthServer
        }
      });
      
      return this.sendSuccess(res, {
        message: 'OAuth configuration updated successfully',
        enabled: data.enabled
      });
    } catch (error) {
      return this.sendError(res, 'Failed to update OAuth configuration', 500, error);
    }
  });
  
  /**
   * Get OAuth configuration for a specific MCP server
   */
  public getServerOAuthConfig = this.createHandler(async (req: Request, res: Response) => {
    const serverId = parseInt(req.params.serverId, 10);
    
    if (isNaN(serverId)) {
      return this.sendError(res, 'Invalid server ID', 400);
    }
    
    try {
      // Get the server from database
      const server = await storage.getMcpServer(serverId);
      if (!server) {
        return this.sendError(res, 'Server not found', 404);
      }
      
      // Extract OAuth configuration
      let oauthConfig = null;
      
      if (server.metadata) {
        // Parse metadata
        const metadata = typeof server.metadata === 'string'
          ? JSON.parse(server.metadata)
          : server.metadata;
        
        // Extract OAuth configuration if available
        if (metadata.oauth) {
          oauthConfig = {
            tokenUrl: metadata.oauth.tokenUrl,
            clientId: metadata.oauth.clientId,
            clientSecret: '******', // Mask the secret
            scopes: metadata.oauth.scopes || []
          };
        }
      }
      
      return this.sendSuccess(res, {
        serverId,
        serverName: server.name,
        oauthConfig
      });
    } catch (error) {
      return this.sendError(res, 'Failed to get server OAuth configuration', 500, error);
    }
  });
  
  /**
   * Update OAuth configuration for a specific MCP server
   */
  public updateServerOAuthConfig = this.createValidatedHandler(serverOAuthConfigSchema, async (req, res, data) => {
    const serverId = parseInt(req.params.serverId, 10);
    
    if (isNaN(serverId)) {
      return this.sendError(res, 'Invalid server ID', 400);
    }
    
    try {
      // Update the configuration
      const success = await mcpOAuthService.updateServerOAuthConfig(serverId, data);
      
      if (!success) {
        return this.sendError(res, 'Server not found or configuration update failed', 404);
      }
      
      // Create audit log
      await createAuditLogFromRequest({
        req,
        action: 'update',
        resourceType: 'oauth_config',
        resourceId: `server:${serverId}`,
        details: {
          serverId,
          tokenUrl: data.tokenUrl,
          clientId: data.clientId,
          // Do not log secrets in audit logs
          scopes: data.scopes
        }
      });
      
      return this.sendSuccess(res, {
        message: 'Server OAuth configuration updated successfully',
        serverId
      });
    } catch (error) {
      return this.sendError(res, 'Failed to update server OAuth configuration', 500, error);
    }
  });
  
  /**
   * Discover and configure OAuth provider from discovery URL
   */
  public discoverOAuthProvider = this.createValidatedHandler(oauthDiscoverySchema, async (req, res, data) => {
    try {
      // Discover and configure OAuth provider
      const success = await mcpOAuthService.discoverAndConfigureAuthServer(data.discoveryUrl);
      
      if (!success) {
        return this.sendError(res, 'Failed to discover OAuth provider', 400);
      }
      
      // Get current configuration from service
      const settings = await storage.getSystemSettings('mcpOAuth');
      const currentConfig = settings?.value ? JSON.parse(settings.value) : {};
      
      // Get the updated configuration
      // Note: This would be better with a getter on the service, but we'll work with the storage
      const updatedSettings = await storage.getSystemSettings('mcpOAuth');
      const updatedConfig = updatedSettings?.value ? JSON.parse(updatedSettings.value) : currentConfig;
      
      // Create audit log
      await createAuditLogFromRequest({
        req,
        action: 'discover',
        resourceType: 'oauth_provider',
        resourceId: data.discoveryUrl,
        details: {
          discoveryUrl: data.discoveryUrl
        }
      });
      
      return this.sendSuccess(res, {
        message: 'OAuth provider discovered and configured successfully',
        config: {
          ...updatedConfig,
          defaultAuthServer: updatedConfig.defaultAuthServer ? {
            ...updatedConfig.defaultAuthServer,
            clientSecret: '******' // Mask the secret
          } : undefined
        }
      });
    } catch (error) {
      return this.sendError(res, 'Failed to discover OAuth provider', 500, error);
    }
  });
  
  /**
   * Get an access token for testing/verification
   */
  public getAccessToken = this.createValidatedHandler(tokenRequestSchema, async (req, res, data) => {
    try {
      // Get a token
      const token = await mcpOAuthService.getToken(data.serverId);
      
      // Create audit log
      await createAuditLogFromRequest({
        req,
        action: 'generate',
        resourceType: 'oauth_token',
        resourceId: data.serverId ? `server:${data.serverId}` : 'default',
        details: {
          serverId: data.serverId,
          tokenType: token.tokenType,
          expiresAt: token.expiresAt,
          scopes: token.scopes
        }
      });
      
      // Return token info (but mask the actual token for security)
      return this.sendSuccess(res, {
        tokenType: token.tokenType,
        expiresAt: token.expiresAt,
        scopes: token.scopes,
        accessToken: `${token.accessToken.substring(0, 5)}...${token.accessToken.substring(token.accessToken.length - 5)}`
      });
    } catch (error) {
      return this.sendError(res, 'Failed to get access token', 500, error);
    }
  });
  
  /**
   * Clear all token caches
   */
  public clearTokenCaches = this.createHandler(async (req: Request, res: Response) => {
    try {
      // Clear caches
      mcpOAuthService.clearCaches();
      
      // Create audit log
      await createAuditLogFromRequest({
        req,
        action: 'clear',
        resourceType: 'oauth_cache',
        resourceId: 'all',
        details: {}
      });
      
      return this.sendSuccess(res, {
        message: 'Token caches cleared successfully'
      });
    } catch (error) {
      return this.sendError(res, 'Failed to clear token caches', 500, error);
    }
  });
}

// Export singleton instance
export const mcpOAuthController = new McpOAuthController();