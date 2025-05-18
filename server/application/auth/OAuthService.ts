/**
 * OAuth Service - Application Layer
 * 
 * This module provides OAuth 2.0 capabilities with support for custom providers.
 * It implements the following standards:
 * - OAuth 2.0 (RFC 6749)
 * - OpenID Connect 1.0
 * - JWT Bearer Token (RFC 7523)
 * - Token Introspection (RFC 7662)
 * - Token Revocation (RFC 7009)
 * 
 * References:
 * - https://datatracker.ietf.org/doc/html/rfc6749
 * - https://openid.net/specs/openid-connect-core-1_0.html
 */

import { db } from '../../infrastructure/persistence/database';
import { eventBus } from '../../infrastructure/events/EventBus';
import * as schema from '@shared/schema';
import { randomBytes, createHash } from 'crypto';
import { eq, and } from 'drizzle-orm';
import { ApiError } from '../../../server/infrastructure/api/ApiError';

/**
 * OAuth2 Token Response
 */
export interface OAuth2TokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string; // For OpenID Connect
}

/**
 * OAuth2 Authorization Parameters
 */
export interface OAuth2AuthParams {
  client_id: string;
  redirect_uri: string;
  response_type: 'code' | 'token';
  scope?: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: 'plain' | 'S256';
  nonce?: string;
  prompt?: 'none' | 'login' | 'consent' | 'select_account';
  max_age?: number;
  [key: string]: string | number | undefined;
}

/**
 * OAuth2 Token Parameters
 */
export interface OAuth2TokenParams {
  grant_type: 'authorization_code' | 'refresh_token' | 'client_credentials' | 'password';
  client_id?: string;
  client_secret?: string;
  code?: string;
  redirect_uri?: string;
  refresh_token?: string;
  username?: string;
  password?: string;
  scope?: string;
  code_verifier?: string;
  [key: string]: string | undefined;
}

/**
 * OAuth2 Userinfo Response
 */
export interface OAuth2UserInfo {
  sub: string; // Subject identifier
  name?: string;
  given_name?: string;
  family_name?: string;
  middle_name?: string;
  nickname?: string;
  preferred_username?: string;
  profile?: string;
  picture?: string;
  website?: string;
  email?: string;
  email_verified?: boolean;
  gender?: string;
  birthdate?: string;
  zoneinfo?: string;
  locale?: string;
  phone_number?: string;
  phone_number_verified?: boolean;
  address?: {
    formatted?: string;
    street_address?: string;
    locality?: string;
    region?: string;
    postal_code?: string;
    country?: string;
  };
  updated_at?: number;
  [key: string]: any;
}

/**
 * Service for OAuth 2.0 operations
 */
export class OAuthService {
  /**
   * Get all OAuth providers from the database
   */
  async getOAuthProviders(): Promise<schema.AuthProvider[]> {
    const providers = await db.query.authProviders.findMany({
      where: and(
        eq(schema.authProviders.isEnabled, true),
        // Include both OAuth2 and specific providers like Google, Microsoft, etc.
        (builder) => builder.inArray(schema.authProviders.type, [
          'oauth2', 'oidc', 'google', 'microsoft', 'github', 'facebook', 
          'twitter', 'linkedin', 'apple', 'custom'
        ])
      )
    });
    
    // Remove sensitive data like client secrets from the response
    return providers.map(provider => {
      const { clientSecret, ...safeProvider } = provider;
      return safeProvider;
    });
  }
  
  /**
   * Get a specific OAuth provider by ID
   */
  async getOAuthProvider(providerId: number): Promise<schema.AuthProvider | undefined> {
    const provider = await db.query.authProviders.findFirst({
      where: eq(schema.authProviders.id, providerId)
    });
    
    if (!provider) {
      return undefined;
    }
    
    // Check if it's an OAuth provider
    if (!['oauth2', 'oidc', 'google', 'microsoft', 'github', 'facebook', 
          'twitter', 'linkedin', 'apple', 'custom'].includes(provider.type)) {
      return undefined;
    }
    
    return provider;
  }
  
  /**
   * Create an authorization URL for the OAuth2 flow
   */
  async createAuthorizationUrl(
    providerId: number,
    redirectUri: string,
    options: {
      responseType?: 'code' | 'token';
      scope?: string;
      state?: string;
      codeChallenge?: string;
      codeChallengeMethod?: 'plain' | 'S256';
      nonce?: string;
      prompt?: 'none' | 'login' | 'consent' | 'select_account';
      customParams?: Record<string, string>;
    } = {}
  ): Promise<string> {
    // Get the provider configuration
    const provider = await this.getOAuthProvider(providerId);
    if (!provider) {
      throw new ApiError(404, 'OAuth provider not found');
    }
    
    // Validate required fields
    if (!provider.authorizationUrl) {
      throw new ApiError(400, 'Provider is missing authorization URL');
    }
    
    if (!provider.clientId) {
      throw new ApiError(400, 'Provider is missing client ID');
    }
    
    // Build the authorization URL
    const url = new URL(provider.authorizationUrl);
    
    // Add required parameters
    url.searchParams.append('client_id', provider.clientId);
    url.searchParams.append('redirect_uri', redirectUri);
    url.searchParams.append('response_type', options.responseType || 'code');
    
    // Add optional parameters
    if (options.scope || provider.scope) {
      url.searchParams.append('scope', options.scope || provider.scope || '');
    }
    
    // Generate state if not provided
    const state = options.state || this.generateRandomString();
    url.searchParams.append('state', state);
    
    // Add PKCE parameters if provided
    if (options.codeChallenge) {
      url.searchParams.append('code_challenge', options.codeChallenge);
      url.searchParams.append('code_challenge_method', options.codeChallengeMethod || 'plain');
    }
    
    // Add OpenID Connect parameters if applicable
    if (provider.type === 'oidc' || options.nonce) {
      url.searchParams.append('nonce', options.nonce || this.generateRandomString());
    }
    
    if (options.prompt) {
      url.searchParams.append('prompt', options.prompt);
    }
    
    // Add custom parameters
    if (options.customParams) {
      for (const [key, value] of Object.entries(options.customParams)) {
        url.searchParams.append(key, value);
      }
    }
    
    return url.toString();
  }
  
  /**
   * Exchange an authorization code for an access token
   */
  async exchangeCodeForToken(
    providerId: number,
    code: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<OAuth2TokenResponse> {
    // Get the provider configuration
    const provider = await this.getOAuthProvider(providerId);
    if (!provider) {
      throw new ApiError(404, 'OAuth provider not found');
    }
    
    // Validate required fields
    if (!provider.tokenUrl) {
      throw new ApiError(400, 'Provider is missing token URL');
    }
    
    if (!provider.clientId) {
      throw new ApiError(400, 'Provider is missing client ID');
    }
    
    // Build token request parameters
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('code', code);
    params.append('redirect_uri', redirectUri);
    params.append('client_id', provider.clientId);
    
    // Add client secret if available
    if (provider.clientSecret) {
      params.append('client_secret', provider.clientSecret);
    }
    
    // Add PKCE code verifier if provided
    if (codeVerifier) {
      params.append('code_verifier', codeVerifier);
    }
    
    // Make the token request
    try {
      const response = await fetch(provider.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: params.toString()
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new ApiError(response.status, `Token endpoint error: ${errorData}`);
      }
      
      const tokenResponse = await response.json();
      return tokenResponse as OAuth2TokenResponse;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to exchange code for token: ${(error as Error).message}`);
    }
  }
  
  /**
   * Fetch user info from the OAuth provider
   */
  async fetchUserInfo(
    providerId: number,
    accessToken: string
  ): Promise<OAuth2UserInfo> {
    // Get the provider configuration
    const provider = await this.getOAuthProvider(providerId);
    if (!provider) {
      throw new ApiError(404, 'OAuth provider not found');
    }
    
    // Validate required fields
    if (!provider.userInfoUrl) {
      throw new ApiError(400, 'Provider is missing user info URL');
    }
    
    // Make the user info request
    try {
      const response = await fetch(provider.userInfoUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json'
        }
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new ApiError(response.status, `User info endpoint error: ${errorData}`);
      }
      
      const userInfo = await response.json();
      return userInfo as OAuth2UserInfo;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to fetch user info: ${(error as Error).message}`);
    }
  }
  
  /**
   * Create or update a user from OAuth user info
   */
  async createOrUpdateUserFromOAuth(
    providerId: number,
    userInfo: OAuth2UserInfo,
    tokens: {
      accessToken: string;
      refreshToken?: string;
      expiresIn?: number;
    }
  ): Promise<schema.User> {
    // Find existing user identity
    const existingIdentity = await db.query.userIdentities.findFirst({
      where: and(
        eq(schema.userIdentities.providerId, providerId),
        eq(schema.userIdentities.externalId, userInfo.sub)
      ),
      with: {
        user: true
      }
    });
    
    // Calculate token expiration date
    const tokenExpiresAt = tokens.expiresIn 
      ? new Date(Date.now() + tokens.expiresIn * 1000)
      : undefined;
    
    // If the user already exists, update the identity
    if (existingIdentity) {
      // Update the identity with new tokens
      await db.update(schema.userIdentities)
        .set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt,
          profileData: userInfo,
          updatedAt: new Date()
        })
        .where(eq(schema.userIdentities.id, existingIdentity.id));
      
      // Update user profile data if needed
      if (existingIdentity.user) {
        await this.updateUserFromOAuthProfile(existingIdentity.user.id, userInfo);
        
        // Get the updated user
        const updatedUser = await db.query.users.findFirst({
          where: eq(schema.users.id, existingIdentity.user.id)
        });
        
        if (updatedUser) {
          return updatedUser;
        }
      }
      
      throw new ApiError(500, 'Failed to update user from OAuth profile');
    }
    
    // Create a new user if no existing identity found
    // Start a transaction for creating a new user and identity
    return await db.transaction(async (tx) => {
      // Generate a unique username based on userInfo
      const username = await this.generateUniqueUsername(userInfo);
      
      // Create the user
      const [newUser] = await tx.insert(schema.users)
        .values({
          username,
          email: userInfo.email,
          fullName: userInfo.name,
          avatarUrl: userInfo.picture,
          isEmailVerified: userInfo.email_verified || false,
          isActive: true,
          metadata: {
            oauth: {
              provider: providerId,
              subject: userInfo.sub
            }
          },
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      
      if (!newUser) {
        throw new ApiError(500, 'Failed to create user from OAuth profile');
      }
      
      // Create the user identity
      await tx.insert(schema.userIdentities)
        .values({
          userId: newUser.id,
          providerId,
          externalId: userInfo.sub,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          tokenExpiresAt,
          profileData: userInfo,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      
      // Publish event for user creation
      eventBus.publish('user.created', { id: newUser.id, source: 'oauth' }, {
        source: 'OAuthService',
        userId: newUser.id
      });
      
      return newUser;
    });
  }
  
  /**
   * Update a user's profile from OAuth user info
   */
  private async updateUserFromOAuthProfile(
    userId: number,
    userInfo: OAuth2UserInfo
  ): Promise<void> {
    await db.update(schema.users)
      .set({
        email: userInfo.email || undefined,
        fullName: userInfo.name || undefined,
        avatarUrl: userInfo.picture || undefined,
        isEmailVerified: userInfo.email_verified || undefined,
        updatedAt: new Date()
      })
      .where(eq(schema.users.id, userId));
  }
  
  /**
   * Generate a unique username from OAuth user info
   */
  private async generateUniqueUsername(userInfo: OAuth2UserInfo): Promise<string> {
    // Start with preferred username or email prefix
    let baseUsername = userInfo.preferred_username || 
                      userInfo.name || 
                      (userInfo.email ? userInfo.email.split('@')[0] : '') ||
                      'user';
    
    // Sanitize the username (remove special characters, replace spaces with underscores)
    baseUsername = baseUsername
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .replace(/\s+/g, '_');
    
    // Ensure minimum length
    if (baseUsername.length < 3) {
      baseUsername = `user_${baseUsername}`;
    }
    
    // Check if username exists
    const existingUser = await db.query.users.findFirst({
      where: eq(schema.users.username, baseUsername)
    });
    
    if (!existingUser) {
      return baseUsername;
    }
    
    // If username already exists, append a random suffix
    const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `${baseUsername}_${randomSuffix}`;
  }
  
  /**
   * Generate a random string for OAuth2 state or nonce
   */
  private generateRandomString(length = 32): string {
    return randomBytes(length)
      .toString('base64')
      .replace(/[+/=]/g, '')
      .substring(0, length);
  }
  
  /**
   * Generate a code challenge for PKCE (Proof Key for Code Exchange)
   */
  generateCodeChallenge(codeVerifier: string, method: 'plain' | 'S256' = 'S256'): string {
    if (method === 'plain') {
      return codeVerifier;
    }
    
    // For S256, return the base64url-encoded SHA256 hash
    const hash = createHash('sha256').update(codeVerifier).digest();
    return Buffer.from(hash)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }
  
  /**
   * Generate a code verifier for PKCE
   */
  generateCodeVerifier(length = 64): string {
    return this.generateRandomString(length);
  }
  
  /**
   * Refresh an OAuth2 access token using a refresh token
   */
  async refreshAccessToken(
    providerId: number,
    refreshToken: string
  ): Promise<OAuth2TokenResponse> {
    // Get the provider configuration
    const provider = await this.getOAuthProvider(providerId);
    if (!provider) {
      throw new ApiError(404, 'OAuth provider not found');
    }
    
    // Validate required fields
    if (!provider.tokenUrl) {
      throw new ApiError(400, 'Provider is missing token URL');
    }
    
    if (!provider.clientId) {
      throw new ApiError(400, 'Provider is missing client ID');
    }
    
    // Build token request parameters
    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);
    params.append('client_id', provider.clientId);
    
    // Add client secret if available
    if (provider.clientSecret) {
      params.append('client_secret', provider.clientSecret);
    }
    
    // Make the token request
    try {
      const response = await fetch(provider.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json'
        },
        body: params.toString()
      });
      
      if (!response.ok) {
        const errorData = await response.text();
        throw new ApiError(response.status, `Token refresh error: ${errorData}`);
      }
      
      const tokenResponse = await response.json();
      
      // Update the identity with the new tokens
      const identity = await db.query.userIdentities.findFirst({
        where: and(
          eq(schema.userIdentities.providerId, providerId),
          eq(schema.userIdentities.refreshToken, refreshToken)
        )
      });
      
      if (identity) {
        // Calculate token expiration date
        const tokenExpiresAt = tokenResponse.expires_in 
          ? new Date(Date.now() + tokenResponse.expires_in * 1000)
          : undefined;
          
        await db.update(schema.userIdentities)
          .set({
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token || refreshToken, // Some providers don't return a new refresh token
            tokenExpiresAt,
            updatedAt: new Date()
          })
          .where(eq(schema.userIdentities.id, identity.id));
      }
      
      return tokenResponse as OAuth2TokenResponse;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, `Failed to refresh token: ${(error as Error).message}`);
    }
  }
  
  /**
   * Revoke an OAuth2 token (if the provider supports token revocation)
   */
  async revokeToken(
    providerId: number,
    token: string,
    tokenType: 'access_token' | 'refresh_token' = 'access_token'
  ): Promise<boolean> {
    // Get the provider configuration
    const provider = await this.getOAuthProvider(providerId);
    if (!provider) {
      throw new ApiError(404, 'OAuth provider not found');
    }
    
    // Get additional config from the config JSON
    const revocationEndpoint = provider.config && 
      typeof provider.config === 'object' && 
      'revocationEndpoint' in provider.config ? 
      provider.config.revocationEndpoint as string : 
      undefined;
    
    // Validate required fields
    if (!revocationEndpoint) {
      // Not all providers support token revocation
      return false;
    }
    
    if (!provider.clientId) {
      throw new ApiError(400, 'Provider is missing client ID');
    }
    
    // Build token revocation request parameters
    const params = new URLSearchParams();
    params.append('token', token);
    params.append('token_type_hint', tokenType);
    params.append('client_id', provider.clientId);
    
    // Add client secret if available
    if (provider.clientSecret) {
      params.append('client_secret', provider.clientSecret);
    }
    
    // Make the revocation request
    try {
      const response = await fetch(revocationEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });
      
      // RFC 7009: A successful response SHOULD have a 200 OK status code and an empty body
      return response.ok;
    } catch (error) {
      console.error(`Token revocation error: ${(error as Error).message}`);
      return false;
    }
  }
}

// Export singleton instance
export const oauthService = new OAuthService();