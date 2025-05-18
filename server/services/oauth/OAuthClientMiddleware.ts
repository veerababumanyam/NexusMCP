/**
 * OAuthMiddleware - Middleware to attach OAuth tokens to outbound MCP requests
 * 
 * This module integrates with the TokenManager to:
 * - Intercept outbound requests to MCP servers
 * - Attach appropriate Bearer tokens
 * - Handle token errors and retries
 * - Support different auth providers per MCP server
 */

import { AxiosRequestConfig, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { TokenManager, TokenRequest } from './TokenManager';
import { eventBus } from '../../infrastructure/events/EventBus';
import { storage } from '../../storage';
import { McpServer } from '@shared/schema';

/**
 * Configuration for the OAuth Client Middleware
 */
export interface OAuthClientMiddlewareConfig {
  // Enable token injection for outbound requests
  enabled: boolean;
  
  // Default auth server to use if not specified for a server
  defaultAuthServer?: {
    url: string;
    clientId: string;
    clientSecret: string;
  };
  
  // Default scopes to request
  defaultScopes?: string[];
  
  // Cache configuration
  cache?: {
    enabled: boolean;
    ttlBuffer?: number;
  };
}

/**
 * OAuth Client Middleware for securing MCP server communication
 */
export class OAuthClientMiddleware {
  private static instance: OAuthClientMiddleware;
  private tokenManager: TokenManager;
  private config: OAuthClientMiddlewareConfig;
  private serverConfigCache: Map<number, {
    authServerUrl: string;
    clientId: string;
    clientSecret: string;
    scopes?: string[];
  }> = new Map();
  
  private constructor(tokenManager: TokenManager, config: OAuthClientMiddlewareConfig) {
    this.tokenManager = tokenManager;
    this.config = {
      ...config,
      defaultScopes: config.defaultScopes || ['mcp.read', 'mcp.call']
    };
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(
    tokenManager: TokenManager,
    config: OAuthClientMiddlewareConfig
  ): OAuthClientMiddleware {
    if (!OAuthClientMiddleware.instance) {
      OAuthClientMiddleware.instance = new OAuthClientMiddleware(tokenManager, config);
    }
    return OAuthClientMiddleware.instance;
  }
  
  /**
   * Configure the middleware
   */
  public configure(config: Partial<OAuthClientMiddlewareConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      // Ensure default scopes are always set
      defaultScopes: config.defaultScopes || this.config.defaultScopes
    };
    
    // Clear cache when config changes
    this.serverConfigCache.clear();
    
    // Log configuration change
    eventBus.publish('oauth.middleware.configured', {
      enabled: this.config.enabled,
      timestamp: new Date().toISOString()
    }, {
      source: 'OAuthClientMiddleware'
    });
  }
  
  /**
   * Create Axios request interceptor
   */
  public createInterceptor() {
    return {
      request: this.requestInterceptor.bind(this),
      responseError: this.responseErrorInterceptor.bind(this)
    };
  }
  
  /**
   * Request interceptor to add token to outbound requests
   */
  private async requestInterceptor(
    config: InternalAxiosRequestConfig
  ): Promise<InternalAxiosRequestConfig> {
    // Skip if middleware is disabled or the request already has an Authorization header
    if (!this.config.enabled || config.headers.Authorization) {
      return config;
    }
    
    // Check if this is a request to an MCP server
    const serverId = this.getServerIdFromConfig(config);
    if (!serverId) {
      return config;
    }
    
    try {
      // Get the server's auth configuration
      const serverConfig = await this.getServerAuthConfig(serverId);
      if (!serverConfig) {
        // No OAuth config for this server, continue without token
        return config;
      }
      
      // Create token request
      const tokenRequest: TokenRequest = {
        authServerUrl: serverConfig.authServerUrl,
        clientId: serverConfig.clientId,
        clientSecret: serverConfig.clientSecret,
        scope: serverConfig.scopes?.join(' ') || this.config.defaultScopes?.join(' ')
      };
      
      // Get token from token manager
      const token = await this.tokenManager.getToken(tokenRequest);
      
      // Add token to request headers
      config.headers.Authorization = `${token.tokenType} ${token.accessToken}`;
      
      // Log token usage (only log that it was used, not the token itself)
      eventBus.publish('oauth.token.used', {
        serverId,
        timestamp: new Date().toISOString(),
        tokenExpiresAt: token.expiresAt
      }, {
        source: 'OAuthClientMiddleware'
      });
      
      return config;
    } catch (error) {
      eventBus.publish('oauth.token.error', {
        serverId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }, {
        source: 'OAuthClientMiddleware'
      });
      
      // Continue without token
      return config;
    }
  }
  
  /**
   * Response error interceptor to handle token-related errors
   */
  private async responseErrorInterceptor(error: AxiosError): Promise<any> {
    // Only handle responses with status code
    if (!error.response || !error.config) {
      return Promise.reject(error);
    }
    
    // Check if this is an auth error (401 Unauthorized)
    if (error.response.status === 401) {
      const serverId = this.getServerIdFromConfig(error.config);
      if (!serverId) {
        return Promise.reject(error);
      }
      
      // Clear cached auth config to force a refresh
      this.serverConfigCache.delete(serverId);
      
      // Log auth failure
      eventBus.publish('oauth.auth.failed', {
        serverId,
        status: error.response.status,
        error: error.message,
        timestamp: new Date().toISOString()
      }, {
        source: 'OAuthClientMiddleware'
      });
    }
    
    return Promise.reject(error);
  }
  
  /**
   * Extract server ID from request config
   */
  private getServerIdFromConfig(config: AxiosRequestConfig): number | null {
    // Check for server ID in request metadata
    if (config.metadata && typeof config.metadata === 'object' && 'serverId' in config.metadata) {
      return Number(config.metadata.serverId) || null;
    }
    
    // Try to extract from URL patterns (implementation specific to MCP server URL patterns)
    // This is a basic example and should be adapted to your URL patterns
    const url = config.url || '';
    const serverIdMatch = url.match(/\/mcp-servers\/(\d+)/);
    if (serverIdMatch && serverIdMatch[1]) {
      return parseInt(serverIdMatch[1], 10);
    }
    
    return null;
  }
  
  /**
   * Get auth configuration for a server
   */
  private async getServerAuthConfig(serverId: number): Promise<{
    authServerUrl: string;
    clientId: string;
    clientSecret: string;
    scopes?: string[];
  } | null> {
    // Check cache first
    if (this.serverConfigCache.has(serverId)) {
      return this.serverConfigCache.get(serverId) || null;
    }
    
    try {
      // Get server from storage
      const server = await storage.getMcpServer(serverId);
      if (!server) {
        return null;
      }
      
      // Check if server has OAuth configuration
      const config = this.extractServerOAuthConfig(server);
      if (config) {
        // Cache the config
        this.serverConfigCache.set(serverId, config);
        return config;
      }
      
      // Use default configuration if available
      if (this.config.defaultAuthServer) {
        const defaultConfig = {
          authServerUrl: this.config.defaultAuthServer.url,
          clientId: this.config.defaultAuthServer.clientId,
          clientSecret: this.config.defaultAuthServer.clientSecret,
          scopes: this.config.defaultScopes
        };
        
        // Cache the config
        this.serverConfigCache.set(serverId, defaultConfig);
        return defaultConfig;
      }
      
      return null;
    } catch (error) {
      // Log error
      eventBus.publish('oauth.config.error', {
        serverId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }, {
        source: 'OAuthClientMiddleware'
      });
      
      return null;
    }
  }
  
  /**
   * Extract OAuth configuration from server object
   */
  private extractServerOAuthConfig(server: McpServer): {
    authServerUrl: string;
    clientId: string;
    clientSecret: string;
    scopes?: string[];
  } | null {
    // Check if server has OAuth settings
    if (!server.metadata) {
      return null;
    }
    
    // Parse metadata
    const metadata = typeof server.metadata === 'string' 
      ? JSON.parse(server.metadata) 
      : server.metadata;
    
    // Check for OAuth configuration
    if (metadata.oauth && 
        metadata.oauth.authServerUrl && 
        metadata.oauth.clientId && 
        metadata.oauth.clientSecret) {
      return {
        authServerUrl: metadata.oauth.authServerUrl,
        clientId: metadata.oauth.clientId,
        clientSecret: metadata.oauth.clientSecret,
        scopes: metadata.oauth.scopes || this.config.defaultScopes
      };
    }
    
    return null;
  }
  
  /**
   * Clear the server config cache
   */
  public clearCache(): void {
    this.serverConfigCache.clear();
  }
}