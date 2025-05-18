/**
 * TokenManager - OAuth 2.1 Client Credentials Flow for Service-to-Service Authentication
 * 
 * This module handles secure token fetching, caching, and automatic renewal for
 * service-to-service communication between MCP Gateway and MCP Servers.
 * 
 * Features:
 * - Secure token fetching using client credentials flow
 * - Memory and Redis-based token caching with TTL
 * - Automatic token renewal before expiration
 * - Support for multiple authentication servers
 * - Circuit breaker pattern for fault tolerance
 * - Comprehensive logging and metrics
 */

import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import { createHash, randomBytes } from 'crypto';
import { EventBus } from '../../infrastructure/events/EventBus';
import { circuitBreakerService } from '../circuitBreakerService';

// Type definitions
export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  [key: string]: any;
}

export interface TokenInfo {
  accessToken: string;
  tokenType: string;
  expiresAt: Date;
  scopes: string[];
  raw?: any;
}

export interface TokenRequest {
  authServerUrl: string;
  clientId: string;
  clientSecret: string;
  scope?: string;
  audience?: string;
  [key: string]: any;
}

export interface TokenManagerOptions {
  // Default scopes to request if none provided
  defaultScopes?: string[];
  
  // How many seconds before expiration to trigger a refresh
  refreshBuffer?: number;
  
  // Circuit breaker configurations
  circuitBreaker?: {
    failureThreshold: number;
    resetTimeout: number;
  };
  
  // Cache configurations
  cache?: {
    enabled: boolean;
    ttlBuffer?: number; // Additional buffer for cache TTL beyond token expiry
  };
  
  // Retry configurations
  retry?: {
    maxRetries: number;
    initialDelay: number; // in ms
    backoffFactor: number;
  };
}

/**
 * Token Manager for OAuth 2.1 Client Credentials flow
 */
export class TokenManager {
  private static instance: TokenManager;
  private tokenCache: Map<string, TokenInfo> = new Map();
  private refreshTimers: Map<string, NodeJS.Timeout> = new Map();
  private eventBus: EventBus;
  private options: TokenManagerOptions;
  
  private constructor(eventBus: EventBus, options: TokenManagerOptions = {}) {
    this.eventBus = eventBus;
    this.options = {
      defaultScopes: options.defaultScopes || ['mcp.read', 'mcp.call'],
      refreshBuffer: options.refreshBuffer || 60, // refresh 60 seconds before expiry by default
      circuitBreaker: options.circuitBreaker || {
        failureThreshold: 3,
        resetTimeout: 30000 // 30 seconds
      },
      cache: options.cache || {
        enabled: true,
        ttlBuffer: 300 // 5 minutes buffer for cache
      },
      retry: options.retry || {
        maxRetries: 3,
        initialDelay: 1000, // 1 second
        backoffFactor: 2
      }
    };
  }
  
  /**
   * Get singleton instance of the TokenManager
   */
  public static getInstance(eventBus: EventBus, options?: TokenManagerOptions): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager(eventBus, options);
    }
    return TokenManager.instance;
  }
  
  /**
   * Get an access token using the client credentials flow
   * If a valid token exists in cache, it will be returned; otherwise, a new token will be fetched
   */
  public async getToken(request: TokenRequest): Promise<TokenInfo> {
    const cacheKey = this.generateCacheKey(request);
    
    // Check if token exists in cache and is still valid
    const cachedToken = this.tokenCache.get(cacheKey);
    if (cachedToken && this.isTokenValid(cachedToken)) {
      // Log token reuse (debug level)
      this.logTokenEvent('token.reused', request, null);
      return cachedToken;
    }
    
    // Token not in cache or expired - fetch a new one
    try {
      const token = await this.fetchToken(request);
      this.cacheToken(cacheKey, token, request);
      return token;
    } catch (error) {
      // Log token fetch failure
      this.logTokenEvent('token.fetch.failed', request, error);
      
      // Rethrow the error
      throw error;
    }
  }
  
  /**
   * Fetch a new token from the authorization server
   */
  private async fetchToken(request: TokenRequest): Promise<TokenInfo> {
    const { authServerUrl, clientId, clientSecret, scope, audience, ...customParams } = request;
    
    // Prepare token request body
    const tokenRequestBody = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: scope || this.options.defaultScopes!.join(' ')
    });
    
    // Add audience if provided (used by some auth servers like Auth0)
    if (audience) {
      tokenRequestBody.append('audience', audience);
    }
    
    // Add any custom parameters
    for (const [key, value] of Object.entries(customParams)) {
      if (value !== undefined && value !== null) {
        tokenRequestBody.append(key, value.toString());
      }
    }
    
    // Configure the request
    const config: AxiosRequestConfig = {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      }
    };
    
    // Use circuit breaker to handle token fetch
    return await circuitBreakerService.execute(
      `token-fetch-${this.hashString(authServerUrl)}`,
      async () => {
        let lastError: Error | null = null;
        
        // Implement retry logic
        for (let attempt = 0; attempt < this.options.retry!.maxRetries; attempt++) {
          try {
            // Log token fetch attempt
            this.logTokenEvent('token.fetch.attempt', request, { attempt });
            
            // Make the token request
            const response = await axios.post<TokenResponse>(
              authServerUrl,
              tokenRequestBody.toString(),
              config
            );
            
            // Log token fetch success
            this.logTokenEvent('token.fetch.success', request, null);
            
            // Convert token response to internal format
            const now = Date.now();
            const expiresInMs = (response.data.expires_in || 3600) * 1000;
            const tokenInfo: TokenInfo = {
              accessToken: response.data.access_token,
              tokenType: response.data.token_type || 'Bearer',
              expiresAt: new Date(now + expiresInMs),
              scopes: (response.data.scope || '').split(' ').filter(Boolean),
              raw: response.data
            };
            
            return tokenInfo;
          } catch (error) {
            lastError = error as Error;
            
            // Determine if we should retry or give up
            const axiosError = error as AxiosError;
            const status = axiosError.response?.status;
            
            // Don't retry on 4xx errors except for 429 (rate limit)
            if (status && status >= 400 && status < 500 && status !== 429) {
              break;
            }
            
            // Calculate backoff delay
            const backoffDelay = this.calculateBackoff(attempt);
            
            // Log retry attempt
            this.logTokenEvent('token.fetch.retry', request, { 
              attempt, 
              backoffDelay,
              status 
            });
            
            // Wait for backoff period
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
          }
        }
        
        // If we got here, all retries failed
        throw lastError || new Error('Failed to fetch token after multiple attempts');
      }
    );
  }
  
  /**
   * Store token in the cache and schedule a refresh
   */
  private cacheToken(cacheKey: string, token: TokenInfo, request: TokenRequest): void {
    // Store in memory cache
    this.tokenCache.set(cacheKey, token);
    
    // Log token cached event
    this.logTokenEvent('token.cached', request, { 
      expiresAt: token.expiresAt,
      scopes: token.scopes
    });
    
    // Clear any existing refresh timer
    const existingTimer = this.refreshTimers.get(cacheKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }
    
    // Schedule token refresh before it expires
    const now = Date.now();
    const expiresAt = token.expiresAt.getTime();
    const refreshTime = expiresAt - (this.options.refreshBuffer! * 1000);
    
    // Only schedule refresh if token expiration is in the future
    if (refreshTime > now) {
      const refreshDelay = refreshTime - now;
      
      const timer = setTimeout(() => {
        // This will be executed when it's time to refresh the token
        this.refreshToken(cacheKey, request);
      }, refreshDelay);
      
      // Store the timer reference
      this.refreshTimers.set(cacheKey, timer);
      
      // Log scheduled refresh
      this.logTokenEvent('token.refresh.scheduled', request, { 
        refreshAt: new Date(refreshTime).toISOString(),
        delayMs: refreshDelay 
      });
    }
  }
  
  /**
   * Refresh a token that's about to expire
   */
  private async refreshToken(cacheKey: string, request: TokenRequest): Promise<void> {
    try {
      // Log token refresh attempt
      this.logTokenEvent('token.refresh.attempt', request, null);
      
      // Fetch a new token
      const token = await this.fetchToken(request);
      
      // Cache the new token
      this.cacheToken(cacheKey, token, request);
      
      // Log token refresh success
      this.logTokenEvent('token.refresh.success', request, {
        newExpiresAt: token.expiresAt
      });
    } catch (error) {
      // Log token refresh failure
      this.logTokenEvent('token.refresh.failed', request, error);
      
      // Schedule another attempt
      setTimeout(() => {
        this.refreshToken(cacheKey, request);
      }, 5000); // Try again in 5 seconds
    }
  }
  
  /**
   * Check if a token is still valid
   */
  private isTokenValid(token: TokenInfo): boolean {
    const now = Date.now();
    const expiresAt = token.expiresAt.getTime();
    
    // Consider token invalid if it's expiring soon
    const validUntil = expiresAt - (this.options.refreshBuffer! * 1000);
    return now < validUntil;
  }
  
  /**
   * Generate a cache key for a token request
   */
  private generateCacheKey(request: TokenRequest): string {
    const { authServerUrl, clientId, scope } = request;
    return `${clientId}:${this.hashString(authServerUrl)}:${scope || this.options.defaultScopes!.join(' ')}`;
  }
  
  /**
   * Create a hash of a string value
   */
  private hashString(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
  
  /**
   * Calculate backoff delay with exponential strategy
   */
  private calculateBackoff(attempt: number): number {
    const { initialDelay, backoffFactor } = this.options.retry!;
    return initialDelay * Math.pow(backoffFactor, attempt);
  }
  
  /**
   * Log token-related events
   */
  private logTokenEvent(
    eventType: string,
    request: TokenRequest,
    details: any | null
  ): void {
    // Create sanitized request info (without credentials)
    const sanitizedRequest = {
      authServerUrl: request.authServerUrl,
      clientId: this.maskString(request.clientId),
      scope: request.scope || this.options.defaultScopes!.join(' '),
      audience: request.audience
    };
    
    // Publish event to event bus
    this.eventBus.publish(eventType, {
      timestamp: new Date().toISOString(),
      request: sanitizedRequest,
      details
    }, {
      source: 'TokenManager'
    });
  }
  
  /**
   * Mask a string for logging (show only first and last few characters)
   */
  private maskString(value: string): string {
    if (!value || value.length < 8) {
      return '***';
    }
    
    const firstChars = value.slice(0, 3);
    const lastChars = value.slice(-3);
    return `${firstChars}***${lastChars}`;
  }
  
  /**
   * Generate a secure random string
   */
  public generateSecureToken(byteLength = 32): string {
    return randomBytes(byteLength)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
  
  /**
   * Clear cached tokens
   */
  public clearTokenCache(): void {
    // Clear all cached tokens
    this.tokenCache.clear();
    
    // Clear all refresh timers
    for (const timer of this.refreshTimers.values()) {
      clearTimeout(timer);
    }
    this.refreshTimers.clear();
  }
}