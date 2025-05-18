/**
 * OAuth Provider Helper - Client Side Utilities
 * 
 * This file contains helper functions to manage and connect identity providers
 * with the OAuth 2.1 Client Credentials flow in the NexusMCP platform.
 */

import { apiRequest } from "./queryClient";

export interface OAuthToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  refresh_token?: string;
}

export interface ProviderConfig {
  id: number;
  name: string;
  type: string;
  clientId: string;
  authorizationUrl?: string;
  tokenUrl?: string;
  userInfoUrl?: string;
  scope?: string;
  callbackUrl?: string;
  issuer?: string;
  jwksUri?: string;
  isEnabled: boolean;
}

/**
 * Request a client credentials flow token from the specified identity provider
 * @param providerId The ID of the identity provider to use
 * @param scopes Optional scopes to request
 * @returns OAuth token response
 */
export async function requestClientCredentialsToken(
  providerId: number,
  scopes?: string[]
): Promise<OAuthToken> {
  const scopeStr = scopes ? scopes.join(" ") : undefined;
  
  const response = await apiRequest("POST", "/api/oauth/token", {
    grant_type: "client_credentials",
    providerId,
    scope: scopeStr
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || "Failed to get token");
  }
  
  return await response.json();
}

/**
 * Validate an OAuth token
 * @param token The token to validate
 * @returns Whether the token is valid
 */
export async function validateToken(token: string): Promise<boolean> {
  try {
    const response = await apiRequest("POST", "/api/oauth/introspect", {
      token
    });
    
    if (!response.ok) {
      return false;
    }
    
    const data = await response.json();
    return data.active === true;
  } catch (error) {
    console.error("Token validation error:", error);
    return false;
  }
}

/**
 * Revoke an OAuth token
 * @param token The token to revoke
 * @returns Whether the token was successfully revoked
 */
export async function revokeToken(token: string): Promise<boolean> {
  try {
    const response = await apiRequest("POST", "/api/oauth/revoke", {
      token
    });
    
    return response.ok;
  } catch (error) {
    console.error("Token revocation error:", error);
    return false;
  }
}

/**
 * Get information about available scopes for the selected identity provider
 * @param providerId The ID of the identity provider
 * @returns Array of available scopes with descriptions
 */
export async function getProviderScopes(providerId: number): Promise<{name: string, description: string}[]> {
  const response = await apiRequest("GET", `/api/oauth/providers/${providerId}/scopes`);
  
  if (!response.ok) {
    return [];
  }
  
  return await response.json();
}

/**
 * Map identity provider type to supported grant types
 * @param type Provider type
 * @returns Array of supported grant types
 */
export function getSupportedGrantTypes(type: string): string[] {
  const lowerType = type.toLowerCase();
  
  if (lowerType === 'oauth2' || lowerType === 'oidc') {
    return ["authorization_code", "refresh_token", "client_credentials"];
  }
  
  if (lowerType === 'saml') {
    return ["saml2_bearer"];
  }
  
  if (lowerType === 'ldap') {
    return ["password"];
  }
  
  return ["authorization_code"];
}

/**
 * Check if the provider supports client credentials flow
 * @param type Provider type
 * @returns True if client credentials flow is supported
 */
export function supportsClientCredentials(type: string): boolean {
  return getSupportedGrantTypes(type).includes("client_credentials");
}

/**
 * Generate the correct PKCE code challenge for a code verifier
 * @param codeVerifier The code verifier string
 * @returns The code challenge
 */
export async function generateCodeChallenge(codeVerifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const digest = await window.crypto.subtle.digest('SHA-256', data);
  
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generate a random string for use as a code verifier
 * @param length Length of the string
 * @returns Random string
 */
export function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  let text = '';
  
  for (let i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  
  return text;
}