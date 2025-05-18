/**
 * TokenValidator - Validates OAuth 2.1 tokens from MCP clients or other services
 * 
 * This module provides token validation using:
 * - JWT signature verification using JWKS
 * - Token introspection for opaque tokens
 * - Scope and claim validation
 * - Cached validation results
 */

import axios from 'axios';
import { createHash } from 'crypto';
import { eventBus } from '../../infrastructure/events/EventBus';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

// Type definitions
export interface TokenValidationOptions {
  // Required scopes for the token
  requiredScopes?: string[];
  
  // Expected audience value
  audience?: string;
  
  // Expected issuer value
  issuer?: string;
  
  // Cache validation results (default: true)
  cacheResults?: boolean;
  
  // Validation mode - choose verification method
  mode?: 'jwt' | 'introspection' | 'auto';
}

export interface TokenInfo {
  valid: boolean;
  active?: boolean;
  subject?: string;
  clientId?: string;
  scopes?: string[];
  expiresAt?: Date;
  issuedAt?: Date;
  issuer?: string;
  audience?: string | string[];
  jti?: string;
  error?: string;
  raw?: any;
}

export interface JwksConfig {
  jwksUri: string;
  cache?: boolean;
  cacheMaxAge?: number;
  rateLimit?: boolean;
  jwksRequestsPerMinute?: number;
}

export interface IntrospectionConfig {
  introspectionUrl: string;
  clientId: string;
  clientSecret: string;
}

export interface TokenValidatorConfig {
  // Auth server configuration
  authServerDiscoveryUrl?: string;
  jwks?: JwksConfig;
  introspection?: IntrospectionConfig;
  
  // Default validation options
  defaultValidationOptions?: TokenValidationOptions;
  
  // Cache configuration
  cache?: {
    enabled: boolean;
    maxSize?: number;
    ttl?: number; // in seconds
  };
}

/**
 * Token Validator for OAuth 2.1 tokens
 */
export class TokenValidator {
  private static instance: TokenValidator;
  private config: TokenValidatorConfig;
  private jwksClient: jwksClient.JwksClient | null = null;
  private discoveredConfig: any = null;
  private validationCache: Map<string, { result: TokenInfo, expiresAt: Date }> = new Map();
  
  private constructor(config: TokenValidatorConfig) {
    this.config = {
      ...config,
      cache: {
        enabled: config.cache?.enabled ?? true,
        maxSize: config.cache?.maxSize ?? 1000,
        ttl: config.cache?.ttl ?? 300 // 5 minutes
      },
      defaultValidationOptions: {
        mode: 'auto',
        cacheResults: true,
        ...(config.defaultValidationOptions || {})
      }
    };
    
    // Initialize JWKS client if configuration is provided
    if (config.jwks) {
      this.jwksClient = jwksClient({
        jwksUri: config.jwks.jwksUri,
        cache: config.jwks.cache ?? true,
        cacheMaxAge: config.jwks.cacheMaxAge ?? 86400000, // 24 hours
        rateLimit: config.jwks.rateLimit ?? true,
        jwksRequestsPerMinute: config.jwks.jwksRequestsPerMinute ?? 10
      });
    }
    
    // Start periodic cache cleanup
    setInterval(() => this.cleanupCache(), 60000); // Every minute
  }
  
  /**
   * Get singleton instance
   */
  public static getInstance(config: TokenValidatorConfig): TokenValidator {
    if (!TokenValidator.instance) {
      TokenValidator.instance = new TokenValidator(config);
    }
    return TokenValidator.instance;
  }
  
  /**
   * Configure the validator
   */
  public async configure(config: Partial<TokenValidatorConfig>): Promise<void> {
    this.config = {
      ...this.config,
      ...config,
      // Ensure cache config is merged properly
      cache: {
        ...this.config.cache,
        ...(config.cache || {})
      },
      // Ensure default options are merged properly
      defaultValidationOptions: {
        ...this.config.defaultValidationOptions,
        ...(config.defaultValidationOptions || {})
      }
    };
    
    // Re-initialize JWKS client if configuration changed
    if (config.jwks) {
      this.jwksClient = jwksClient({
        jwksUri: config.jwks.jwksUri,
        cache: config.jwks.cache ?? true,
        cacheMaxAge: config.jwks.cacheMaxAge ?? 86400000, // 24 hours
        rateLimit: config.jwks.rateLimit ?? true,
        jwksRequestsPerMinute: config.jwks.jwksRequestsPerMinute ?? 10
      });
    }
    
    // Clear cache when configuration changes
    this.validationCache.clear();
    
    // Discover configuration if discovery URL is provided
    if (config.authServerDiscoveryUrl) {
      await this.discoverConfiguration();
    }
  }
  
  /**
   * Discover auth server configuration
   */
  private async discoverConfiguration(): Promise<void> {
    if (!this.config.authServerDiscoveryUrl) {
      return;
    }
    
    try {
      // Log discovery attempt
      eventBus.publish('oauth.discovery.attempt', {
        url: this.config.authServerDiscoveryUrl,
        timestamp: new Date().toISOString()
      }, {
        source: 'TokenValidator'
      });
      
      // Fetch discovery document
      const response = await axios.get(this.config.authServerDiscoveryUrl);
      
      // Store discovery configuration
      this.discoveredConfig = response.data;
      
      // Update JWKS client if jwks_uri is provided
      if (this.discoveredConfig.jwks_uri) {
        this.jwksClient = jwksClient({
          jwksUri: this.discoveredConfig.jwks_uri,
          cache: true,
          cacheMaxAge: 86400000, // 24 hours
          rateLimit: true,
          jwksRequestsPerMinute: 10
        });
      }
      
      // Log discovery success
      eventBus.publish('oauth.discovery.success', {
        url: this.config.authServerDiscoveryUrl,
        configuration: {
          issuer: this.discoveredConfig.issuer,
          jwksUri: this.discoveredConfig.jwks_uri,
          tokenIntrospectionEndpoint: this.discoveredConfig.introspection_endpoint
        },
        timestamp: new Date().toISOString()
      }, {
        source: 'TokenValidator'
      });
    } catch (error) {
      // Log discovery failure
      eventBus.publish('oauth.discovery.failed', {
        url: this.config.authServerDiscoveryUrl,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }, {
        source: 'TokenValidator'
      });
    }
  }
  
  /**
   * Validate an OAuth token
   */
  public async validateToken(
    token: string,
    options?: TokenValidationOptions
  ): Promise<TokenInfo> {
    // Apply default options
    const validationOptions = {
      ...this.config.defaultValidationOptions,
      ...options
    };
    
    // Generate cache key
    const cacheKey = this.generateCacheKey(token, validationOptions);
    
    // Check cache first if enabled
    if (validationOptions.cacheResults !== false && this.config.cache?.enabled) {
      const cachedResult = this.validationCache.get(cacheKey);
      if (cachedResult && cachedResult.expiresAt > new Date()) {
        // Log cache hit
        eventBus.publish('oauth.validation.cache.hit', {
          timestamp: new Date().toISOString()
        }, {
          source: 'TokenValidator'
        });
        
        return cachedResult.result;
      }
    }
    
    // Determine validation mode
    const validationMode = validationOptions.mode || 'auto';
    
    // Validate token based on mode
    let result: TokenInfo;
    
    try {
      if (validationMode === 'jwt' || (validationMode === 'auto' && this.isJwtToken(token))) {
        result = await this.validateJwtToken(token, validationOptions);
      } else {
        result = await this.validateTokenIntrospection(token, validationOptions);
      }
      
      // Cache result if enabled
      if (validationOptions.cacheResults !== false && this.config.cache?.enabled && result.valid) {
        // Calculate expiry time for cache entry
        const now = new Date();
        const tokenExpiresAt = result.expiresAt || new Date(now.getTime() + 3600000); // Default 1 hour
        const cacheExpiresAt = new Date(
          Math.min(
            tokenExpiresAt.getTime(),
            now.getTime() + (this.config.cache.ttl || 300) * 1000
          )
        );
        
        // Store in cache
        this.validationCache.set(cacheKey, {
          result,
          expiresAt: cacheExpiresAt
        });
        
        // Enforce cache size limit
        if (this.validationCache.size > (this.config.cache.maxSize || 1000)) {
          // Remove oldest entry (first key in map)
          const firstKey = this.validationCache.keys().next().value;
          this.validationCache.delete(firstKey);
        }
      }
      
      return result;
    } catch (error) {
      // Log validation error
      eventBus.publish('oauth.validation.error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }, {
        source: 'TokenValidator'
      });
      
      // Return invalid token result
      const errorResult: TokenInfo = {
        valid: false,
        active: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      
      return errorResult;
    }
  }
  
  /**
   * Validate a JWT token by verifying signature and claims
   */
  private async validateJwtToken(
    token: string,
    options: TokenValidationOptions
  ): Promise<TokenInfo> {
    // Check if JWKS client is initialized
    if (!this.jwksClient) {
      throw new Error('JWKS client is not initialized');
    }
    
    try {
      // Decode token without verification first to get headers
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || typeof decoded !== 'object') {
        throw new Error('Invalid token format');
      }
      
      // Get key ID from token header
      const kid = decoded.header.kid;
      if (!kid) {
        throw new Error('Token header missing "kid" (Key ID)');
      }
      
      // Get signing key from JWKS
      const getSigningKey = (kid: string): Promise<jwksClient.SigningKey> => {
        return new Promise((resolve, reject) => {
          this.jwksClient!.getSigningKey(kid, (err, key) => {
            if (err) {
              reject(err);
            } else {
              resolve(key);
            }
          });
        });
      };
      
      const key = await getSigningKey(kid);
      const publicKey = key.getPublicKey();
      
      // Verify token signature and claims
      const verifyOptions: jwt.VerifyOptions = {
        algorithms: ['RS256', 'RS384', 'RS512', 'ES256', 'ES384', 'ES512']
      };
      
      // Add optional verifications
      if (options.audience) {
        verifyOptions.audience = options.audience;
      }
      
      if (options.issuer || this.discoveredConfig?.issuer) {
        verifyOptions.issuer = options.issuer || this.discoveredConfig.issuer;
      }
      
      // Verify token
      const verified = jwt.verify(token, publicKey, verifyOptions);
      
      // Check verified result
      if (!verified || typeof verified !== 'object') {
        throw new Error('Token verification failed');
      }
      
      // Check required scopes if specified
      if (options.requiredScopes && options.requiredScopes.length > 0) {
        const tokenScopes = this.extractScopes(verified);
        const hasRequiredScopes = this.hasRequiredScopes(tokenScopes, options.requiredScopes);
        
        if (!hasRequiredScopes) {
          return {
            valid: false,
            active: true,
            subject: verified.sub,
            clientId: verified.client_id || verified.azp,
            scopes: tokenScopes,
            expiresAt: verified.exp ? new Date(verified.exp * 1000) : undefined,
            issuedAt: verified.iat ? new Date(verified.iat * 1000) : undefined,
            issuer: verified.iss,
            audience: verified.aud,
            jti: verified.jti,
            error: 'Token is missing required scopes',
            raw: verified
          };
        }
      }
      
      // Token is valid
      return {
        valid: true,
        active: true,
        subject: verified.sub,
        clientId: verified.client_id || verified.azp,
        scopes: this.extractScopes(verified),
        expiresAt: verified.exp ? new Date(verified.exp * 1000) : undefined,
        issuedAt: verified.iat ? new Date(verified.iat * 1000) : undefined,
        issuer: verified.iss,
        audience: verified.aud,
        jti: verified.jti,
        raw: verified
      };
    } catch (error) {
      // Log jwt validation error
      eventBus.publish('oauth.jwt.validation.failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }, {
        source: 'TokenValidator'
      });
      
      return {
        valid: false,
        active: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Validate a token using the introspection endpoint
   */
  private async validateTokenIntrospection(
    token: string,
    options: TokenValidationOptions
  ): Promise<TokenInfo> {
    // Check if introspection is configured
    if (!this.config.introspection && !this.discoveredConfig?.introspection_endpoint) {
      throw new Error('Token introspection is not configured');
    }
    
    try {
      // Determine introspection endpoint
      const introspectionUrl = 
        this.config.introspection?.introspectionUrl || 
        this.discoveredConfig.introspection_endpoint;
      
      // Determine client credentials
      const clientId = this.config.introspection?.clientId;
      const clientSecret = this.config.introspection?.clientSecret;
      
      if (!clientId || !clientSecret) {
        throw new Error('Client credentials required for token introspection');
      }
      
      // Create request params
      const params = new URLSearchParams();
      params.append('token', token);
      params.append('token_type_hint', 'access_token');
      
      // Make introspection request
      const response = await axios.post(introspectionUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
        }
      });
      
      const introspectionResult = response.data;
      
      // Check if token is active
      if (!introspectionResult.active) {
        return {
          valid: false,
          active: false,
          error: 'Token is inactive',
          raw: introspectionResult
        };
      }
      
      // Check required scopes if specified
      if (options.requiredScopes && options.requiredScopes.length > 0) {
        const tokenScopes = this.extractScopesFromIntrospection(introspectionResult);
        const hasRequiredScopes = this.hasRequiredScopes(tokenScopes, options.requiredScopes);
        
        if (!hasRequiredScopes) {
          return {
            valid: false,
            active: true,
            subject: introspectionResult.sub,
            clientId: introspectionResult.client_id,
            scopes: tokenScopes,
            expiresAt: introspectionResult.exp ? new Date(introspectionResult.exp * 1000) : undefined,
            issuedAt: introspectionResult.iat ? new Date(introspectionResult.iat * 1000) : undefined,
            issuer: introspectionResult.iss,
            audience: introspectionResult.aud,
            jti: introspectionResult.jti,
            error: 'Token is missing required scopes',
            raw: introspectionResult
          };
        }
      }
      
      // Check audience if specified
      if (options.audience && 
          introspectionResult.aud && 
          !this.matchesAudience(introspectionResult.aud, options.audience)) {
        return {
          valid: false,
          active: true,
          subject: introspectionResult.sub,
          clientId: introspectionResult.client_id,
          scopes: this.extractScopesFromIntrospection(introspectionResult),
          expiresAt: introspectionResult.exp ? new Date(introspectionResult.exp * 1000) : undefined,
          issuedAt: introspectionResult.iat ? new Date(introspectionResult.iat * 1000) : undefined,
          issuer: introspectionResult.iss,
          audience: introspectionResult.aud,
          jti: introspectionResult.jti,
          error: 'Token audience does not match expected audience',
          raw: introspectionResult
        };
      }
      
      // Token is valid
      return {
        valid: true,
        active: true,
        subject: introspectionResult.sub,
        clientId: introspectionResult.client_id,
        scopes: this.extractScopesFromIntrospection(introspectionResult),
        expiresAt: introspectionResult.exp ? new Date(introspectionResult.exp * 1000) : undefined,
        issuedAt: introspectionResult.iat ? new Date(introspectionResult.iat * 1000) : undefined,
        issuer: introspectionResult.iss,
        audience: introspectionResult.aud,
        jti: introspectionResult.jti,
        raw: introspectionResult
      };
    } catch (error) {
      // Log introspection error
      eventBus.publish('oauth.introspection.failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }, {
        source: 'TokenValidator'
      });
      
      return {
        valid: false,
        active: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Extract scopes from a JWT token payload
   */
  private extractScopes(payload: any): string[] {
    // Check standard scope claim
    if (payload.scope) {
      return typeof payload.scope === 'string' 
        ? payload.scope.split(' ') 
        : Array.isArray(payload.scope) ? payload.scope : [];
    }
    
    // Check scp claim (used by some providers)
    if (payload.scp) {
      return typeof payload.scp === 'string'
        ? payload.scp.split(' ')
        : Array.isArray(payload.scp) ? payload.scp : [];
    }
    
    // Check scopes array (used by some providers)
    if (payload.scopes && Array.isArray(payload.scopes)) {
      return payload.scopes;
    }
    
    return [];
  }
  
  /**
   * Extract scopes from introspection result
   */
  private extractScopesFromIntrospection(introspection: any): string[] {
    // Similar to JWT scope extraction, but for introspection results
    return this.extractScopes(introspection);
  }
  
  /**
   * Check if token scopes include all required scopes
   */
  private hasRequiredScopes(tokenScopes: string[], requiredScopes: string[]): boolean {
    return requiredScopes.every(scope => tokenScopes.includes(scope));
  }
  
  /**
   * Check if token audience matches expected audience
   */
  private matchesAudience(tokenAudience: string | string[], expectedAudience: string): boolean {
    if (Array.isArray(tokenAudience)) {
      return tokenAudience.includes(expectedAudience);
    }
    return tokenAudience === expectedAudience;
  }
  
  /**
   * Check if a token is a JWT token
   */
  private isJwtToken(token: string): boolean {
    // Simple heuristic: JWT tokens typically have 2 dots (header.payload.signature)
    const parts = token.split('.');
    return parts.length === 3;
  }
  
  /**
   * Generate a cache key for token validation
   */
  private generateCacheKey(token: string, options: TokenValidationOptions): string {
    // Create a hash of the token and validation options
    const normalizedOptions = {
      requiredScopes: options.requiredScopes?.sort() || [],
      audience: options.audience || '',
      issuer: options.issuer || ''
    };
    
    // Only use first few and last few characters of token for the key
    // to avoid storing the full token in memory
    const tokenHash = this.hashString(token);
    const optionsHash = this.hashString(JSON.stringify(normalizedOptions));
    
    return `${tokenHash}:${optionsHash}`;
  }
  
  /**
   * Create a hash of a string value
   */
  private hashString(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
  
  /**
   * Clean up expired entries from the validation cache
   */
  private cleanupCache(): void {
    if (!this.config.cache?.enabled) {
      return;
    }
    
    const now = new Date();
    let expiredCount = 0;
    
    // Remove expired entries
    for (const [key, entry] of this.validationCache.entries()) {
      if (entry.expiresAt <= now) {
        this.validationCache.delete(key);
        expiredCount++;
      }
    }
    
    // Log cache cleanup if entries were removed
    if (expiredCount > 0) {
      eventBus.publish('oauth.validation.cache.cleanup', {
        removedEntries: expiredCount,
        remainingEntries: this.validationCache.size,
        timestamp: new Date().toISOString()
      }, {
        source: 'TokenValidator'
      });
    }
  }
  
  /**
   * Clear the validation cache
   */
  public clearCache(): void {
    this.validationCache.clear();
    
    eventBus.publish('oauth.validation.cache.cleared', {
      timestamp: new Date().toISOString()
    }, {
      source: 'TokenValidator'
    });
  }
}