/**
 * McpOAuthService - Main service for OAuth 2.1 Client Credentials Flow
 * 
 * This service integrates the TokenManager, OAuthClientMiddleware, and TokenValidator
 * to provide a complete solution for service-to-service authentication between
 * MCP Gateway and MCP Servers.
 */

import { eventBus } from '../../infrastructure/events/EventBus';
import { TokenManager, TokenRequest, TokenInfo } from './TokenManager';
import { OAuthClientMiddleware } from './OAuthClientMiddleware';
import { TokenValidator, TokenValidationOptions } from './TokenValidator';
import axios, { AxiosInstance } from 'axios';
import { storage } from '../../storage';
import { McpServer } from '@shared/schema';

export interface McpOAuthConfig {
  // Enable OAuth for MCP server communication
  enabled: boolean;
  
  // Default auth server configuration (used if server-specific config not available)
  defaultAuthServer?: {
    discoveryUrl?: string;
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
    jwksUri?: string;
  };
  
  // Default scopes to request
  defaultScopes?: string[];
  
  // Validation requirements for incoming tokens
  tokenValidation?: {
    enabled: boolean;
    requiredScopes?: string[];
    audience?: string;
  };
}

/**
 * OAuth Service for MCP Gateway ↔ MCP Server secure communication
 */
export class McpOAuthService {
  private static instance: McpOAuthService;
  private tokenManager: TokenManager;
  private middleware: OAuthClientMiddleware;
  private tokenValidator: TokenValidator;
  private config: McpOAuthConfig;
  
  // Axios instance with OAuth middleware applied
  private axiosInstance: AxiosInstance;
  
  private constructor(config: McpOAuthConfig) {
    // Initialize configurations with defaults
    this.config = {
      enabled: config.enabled || false,
      defaultScopes: config.defaultScopes || ['mcp.read', 'mcp.call'],
      ...config
    };
    
    // Initialize Token Manager
    this.tokenManager = TokenManager.getInstance(eventBus, {
      defaultScopes: this.config.defaultScopes,
      refreshBuffer: 60, // refresh 60 seconds before expiry
      cache: {
        enabled: true,
        ttlBuffer: 300 // 5 minutes buffer beyond token expiry
      }
    });
    
    // Initialize OAuth Middleware
    this.middleware = OAuthClientMiddleware.getInstance(
      this.tokenManager,
      {
        enabled: this.config.enabled,
        defaultAuthServer: this.config.defaultAuthServer ? {
          url: this.config.defaultAuthServer.tokenUrl,
          clientId: this.config.defaultAuthServer.clientId,
          clientSecret: this.config.defaultAuthServer.clientSecret
        } : undefined,
        defaultScopes: this.config.defaultScopes
      }
    );
    
    // Initialize Token Validator
    this.tokenValidator = TokenValidator.getInstance({
      authServerDiscoveryUrl: this.config.defaultAuthServer?.discoveryUrl,
      jwks: this.config.defaultAuthServer?.jwksUri ? {
        jwksUri: this.config.defaultAuthServer.jwksUri
      } : undefined,
      defaultValidationOptions: {
        requiredScopes: this.config.tokenValidation?.requiredScopes,
        audience: this.config.tokenValidation?.audience,
        mode: 'auto'
      },
      cache: {
        enabled: true,
        maxSize: 1000,
        ttl: 300 // 5 minutes
      }
    });
    
    // Create Axios instance with OAuth middleware
    this.axiosInstance = axios.create();
    
    // Apply interceptors
    const interceptors = this.middleware.createInterceptor();
    this.axiosInstance.interceptors.request.use(interceptors.request);
    this.axiosInstance.interceptors.response.use(
      response => response,
      interceptors.responseError
    );
    
    // Log initialization
    eventBus.publish('oauth.mcp.initialized', {
      enabled: this.config.enabled,
      timestamp: new Date().toISOString()
    }, {
      source: 'McpOAuthService'
    });
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(config: McpOAuthConfig): McpOAuthService {
    if (!McpOAuthService.instance) {
      McpOAuthService.instance = new McpOAuthService(config);
    }
    return McpOAuthService.instance;
  }
  
  /**
   * Configure the service
   */
  public configure(config: Partial<McpOAuthConfig>): void {
    // Update configuration
    this.config = {
      ...this.config,
      ...config,
      // Ensure default scopes are always set
      defaultScopes: config.defaultScopes || this.config.defaultScopes
    };
    
    // Update middleware configuration
    this.middleware.configure({
      enabled: this.config.enabled,
      defaultAuthServer: this.config.defaultAuthServer ? {
        url: this.config.defaultAuthServer.tokenUrl,
        clientId: this.config.defaultAuthServer.clientId,
        clientSecret: this.config.defaultAuthServer.clientSecret
      } : undefined,
      defaultScopes: this.config.defaultScopes
    });
    
    // Log configuration update
    eventBus.publish('oauth.mcp.configured', {
      enabled: this.config.enabled,
      timestamp: new Date().toISOString()
    }, {
      source: 'McpOAuthService'
    });
  }
  
  /**
   * Get OAuth-enabled Axios instance
   */
  public getAxiosInstance(): AxiosInstance {
    return this.axiosInstance;
  }
  
  /**
   * Get a client credentials token directly
   */
  public async getToken(serverId?: number): Promise<TokenInfo> {
    try {
      // If serverId is provided, get server-specific configuration
      if (serverId !== undefined) {
        const serverConfig = await this.getServerAuthConfig(serverId);
        if (serverConfig) {
          return await this.tokenManager.getToken({
            authServerUrl: serverConfig.tokenUrl,
            clientId: serverConfig.clientId,
            clientSecret: serverConfig.clientSecret,
            scope: serverConfig.scopes?.join(' ')
          });
        }
      }
      
      // Use default configuration if server-specific not available or serverId not provided
      if (!this.config.defaultAuthServer) {
        throw new Error('No default auth server configured');
      }
      
      return await this.tokenManager.getToken({
        authServerUrl: this.config.defaultAuthServer.tokenUrl,
        clientId: this.config.defaultAuthServer.clientId,
        clientSecret: this.config.defaultAuthServer.clientSecret,
        scope: this.config.defaultScopes?.join(' ')
      });
    } catch (error) {
      // Log error
      eventBus.publish('oauth.mcp.token.error', {
        serverId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }, {
        source: 'McpOAuthService'
      });
      
      throw error;
    }
  }
  
  /**
   * Validate a token (for incoming requests)
   */
  public async validateToken(
    token: string,
    options?: TokenValidationOptions
  ): Promise<TokenInfo> {
    return await this.tokenValidator.validateToken(token, options);
  }
  
  /**
   * Get OAuth configuration for a specific MCP server
   */
  private async getServerAuthConfig(serverId: number): Promise<{
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
    scopes?: string[];
  } | null> {
    try {
      // Get server from storage
      const server = await storage.getMcpServer(serverId);
      if (!server) {
        return null;
      }
      
      // Check if server has OAuth configuration
      const config = this.extractServerOAuthConfig(server);
      if (config) {
        return config;
      }
      
      // Use default configuration if available
      if (this.config.defaultAuthServer) {
        return {
          tokenUrl: this.config.defaultAuthServer.tokenUrl,
          clientId: this.config.defaultAuthServer.clientId,
          clientSecret: this.config.defaultAuthServer.clientSecret,
          scopes: this.config.defaultScopes
        };
      }
      
      return null;
    } catch (error) {
      // Log error
      eventBus.publish('oauth.mcp.config.error', {
        serverId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }, {
        source: 'McpOAuthService'
      });
      
      return null;
    }
  }
  
  /**
   * Extract OAuth configuration from server object
   */
  private extractServerOAuthConfig(server: McpServer): {
    tokenUrl: string;
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
        metadata.oauth.tokenUrl && 
        metadata.oauth.clientId && 
        metadata.oauth.clientSecret) {
      return {
        tokenUrl: metadata.oauth.tokenUrl,
        clientId: metadata.oauth.clientId,
        clientSecret: metadata.oauth.clientSecret,
        scopes: metadata.oauth.scopes || this.config.defaultScopes
      };
    }
    
    return null;
  }
  
  /**
   * Update OAuth configuration for an MCP server
   */
  public async updateServerOAuthConfig(
    serverId: number,
    config: {
      tokenUrl: string;
      clientId: string;
      clientSecret: string;
      scopes?: string[];
    }
  ): Promise<boolean> {
    try {
      // Get server from storage
      const server = await storage.getMcpServer(serverId);
      if (!server) {
        return false;
      }
      
      // Parse metadata
      const metadata = typeof server.metadata === 'string' 
        ? JSON.parse(server.metadata || '{}') 
        : server.metadata || {};
      
      // Update OAuth configuration
      metadata.oauth = {
        ...(metadata.oauth || {}),
        tokenUrl: config.tokenUrl,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        scopes: config.scopes || this.config.defaultScopes
      };
      
      // Update server in storage
      await storage.updateMcpServer(serverId, {
        ...server,
        metadata: metadata
      });
      
      // Clear token cache for this server
      this.middleware.clearCache();
      
      // Log configuration update
      eventBus.publish('oauth.mcp.server.configured', {
        serverId,
        timestamp: new Date().toISOString()
      }, {
        source: 'McpOAuthService'
      });
      
      return true;
    } catch (error) {
      // Log error
      eventBus.publish('oauth.mcp.server.config.error', {
        serverId,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }, {
        source: 'McpOAuthService'
      });
      
      return false;
    }
  }
  
  /**
   * Clear all token caches
   */
  public clearCaches(): void {
    this.tokenManager.clearTokenCache();
    this.middleware.clearCache();
    this.tokenValidator.clearCache();
    
    // Log cache clear
    eventBus.publish('oauth.mcp.cache.cleared', {
      timestamp: new Date().toISOString()
    }, {
      source: 'McpOAuthService'
    });
  }
  
  /**
   * Register AuthServer configurations from discovery
   */
  public async discoverAndConfigureAuthServer(discoveryUrl: string): Promise<boolean> {
    try {
      // Log discovery attempt
      eventBus.publish('oauth.mcp.discovery.attempt', {
        url: discoveryUrl,
        timestamp: new Date().toISOString()
      }, {
        source: 'McpOAuthService'
      });
      
      // Fetch discovery document
      const response = await axios.get(discoveryUrl);
      const discoveryData = response.data;
      
      // Check required fields
      if (!discoveryData.token_endpoint || !discoveryData.jwks_uri) {
        throw new Error('Discovery document missing required fields');
      }
      
      // Update configuration with discovered data
      this.configure({
        defaultAuthServer: {
          ...this.config.defaultAuthServer,
          discoveryUrl: discoveryUrl,
          tokenUrl: discoveryData.token_endpoint,
          jwksUri: discoveryData.jwks_uri
        }
      });
      
      // Reconfigure token validator
      await this.tokenValidator.configure({
        authServerDiscoveryUrl: discoveryUrl,
        jwks: {
          jwksUri: discoveryData.jwks_uri
        }
      });
      
      // Log discovery success
      eventBus.publish('oauth.mcp.discovery.success', {
        url: discoveryUrl,
        configuration: {
          tokenUrl: discoveryData.token_endpoint,
          jwksUri: discoveryData.jwks_uri,
          issuer: discoveryData.issuer
        },
        timestamp: new Date().toISOString()
      }, {
        source: 'McpOAuthService'
      });
      
      return true;
    } catch (error) {
      // Log discovery failure
      eventBus.publish('oauth.mcp.discovery.failed', {
        url: discoveryUrl,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }, {
        source: 'McpOAuthService'
      });
      
      return false;
    }
  }
}

// Export singleton instance with default configuration
const defaultConfig: McpOAuthConfig = {
  enabled: false, // Disabled by default until configured
  defaultScopes: ['mcp.read', 'mcp.call'],
  tokenValidation: {
    enabled: true,
    requiredScopes: ['mcp.call']
  }
};

export const mcpOAuthService = McpOAuthService.getInstance(defaultConfig);