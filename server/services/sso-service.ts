/**
 * SSO Service - Enterprise Authentication Provider Management
 * 
 * Manages authentication providers for single sign-on capabilities:
 * - OAuth 2.0 / OpenID Connect
 * - SAML 2.0
 * - LDAP
 * - Custom federation providers
 * 
 * Follows standards:
 * - RFC 6749 (OAuth 2.0)
 * - OpenID Connect Core 1.0
 * - SAML 2.0
 * - RFC 4510 (LDAP)
 */

import axios from 'axios';

import { db } from '@db';
import { eq } from 'drizzle-orm';
import { authProviders, AuthProvider, InsertAuthProvider } from '@shared/schema';
import { storage } from '../storage';

interface ConnectionResult {
  success: boolean;
  message: string;
  details: any;
}

class SsoService {
  /**
   * Get all authentication providers
   * 
   * @param onlyEnabled - If true, only return enabled providers
   * @returns Array of authentication providers
   */
  async getProviders(onlyEnabled: boolean = false): Promise<AuthProvider[]> {
    try {
      if (onlyEnabled) {
        return await db.select().from(authProviders).where(eq(authProviders.isEnabled, true));
      }
      return await db.select().from(authProviders);
    } catch (error) {
      console.error('Error getting auth providers:', error);
      throw new Error('Failed to retrieve authentication providers');
    }
  }

  /**
   * Get a specific authentication provider by ID
   * 
   * @param id - The provider ID
   * @returns The provider or undefined if not found
   */
  async getProviderById(id: number): Promise<AuthProvider | undefined> {
    try {
      const providers = await db.select().from(authProviders).where(eq(authProviders.id, id));
      return providers[0];
    } catch (error) {
      console.error(`Error getting auth provider with ID ${id}:`, error);
      throw new Error('Failed to retrieve authentication provider');
    }
  }

  /**
   * Create a new authentication provider
   * 
   * @param providerData - The provider data
   * @returns The newly created provider
   */
  async createProvider(providerData: InsertAuthProvider): Promise<AuthProvider> {
    try {
      // Set default values
      const provider = {
        ...providerData,
        isEnabled: providerData.isEnabled ?? true,
        createdAt: new Date()
      };

      const [newProvider] = await db.insert(authProviders).values(provider).returning();
      return newProvider;
    } catch (error) {
      console.error('Error creating auth provider:', error);
      throw new Error('Failed to create authentication provider');
    }
  }

  /**
   * Update an authentication provider
   * 
   * @param id - The provider ID
   * @param providerData - The updated provider data (partial)
   * @returns The updated provider or undefined if not found
   */
  async updateProvider(id: number, providerData: Partial<AuthProvider>): Promise<AuthProvider | undefined> {
    try {
      const [updatedProvider] = await db
        .update(authProviders)
        .set({ ...providerData, updatedAt: new Date() })
        .where(eq(authProviders.id, id))
        .returning();
      
      return updatedProvider;
    } catch (error) {
      console.error(`Error updating auth provider with ID ${id}:`, error);
      throw new Error('Failed to update authentication provider');
    }
  }

  /**
   * Delete an authentication provider
   * 
   * @param id - The provider ID
   */
  async deleteProvider(id: number): Promise<void> {
    try {
      await db.delete(authProviders).where(eq(authProviders.id, id));
    } catch (error) {
      console.error(`Error deleting auth provider with ID ${id}:`, error);
      throw new Error('Failed to delete authentication provider');
    }
  }

  /**
   * Toggle an authentication provider's enabled status
   * 
   * @param id - The provider ID
   * @returns The updated provider or undefined if not found
   */
  async toggleProviderStatus(id: number): Promise<AuthProvider | undefined> {
    try {
      // Get the current provider
      const provider = await this.getProviderById(id);
      
      if (!provider) {
        return undefined;
      }
      
      // Toggle the status
      return await this.updateProvider(id, {
        isEnabled: !provider.isEnabled
      });
    } catch (error) {
      console.error(`Error toggling auth provider status with ID ${id}:`, error);
      throw new Error('Failed to toggle authentication provider status');
    }
  }
  
  /**
   * Test connection to an OAuth or OIDC provider
   * @param provider The provider to test
   * @returns Test result with success status and details
   */
  async testOAuthConnection(provider: AuthProvider): Promise<ConnectionResult> {
    try {
      // For OAuth/OIDC providers, we'll test the token endpoint
      if (!provider.tokenUrl) {
        return {
          success: false,
          message: 'Token URL not configured',
          details: null
        };
      }
      
      // Try making a HEAD request to the token endpoint to see if it's reachable
      await axios.head(provider.tokenUrl, {
        timeout: 5000,
        validateStatus: () => true // Accept any status to check reachability
      });

      // For providers with client credentials, we can try a sample token request
      if (provider.clientId && provider.clientSecret) {
        try {
          // Attempt a minimal client credentials request
          const params = new URLSearchParams();
          params.append('grant_type', 'client_credentials');
          params.append('client_id', provider.clientId);
          params.append('client_secret', provider.clientSecret);
          
          if (provider.scope) {
            params.append('scope', provider.scope);
          }
          
          const response = await axios.post(provider.tokenUrl, params, {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded'
            },
            timeout: 10000,
            validateStatus: () => true // Accept any status code
          });
          
          if (response.status === 200 && response.data.access_token) {
            return {
              success: true,
              message: 'Successfully obtained access token from provider',
              details: {
                tokenType: response.data.token_type,
                expiresIn: response.data.expires_in
              }
            };
          } else if (response.status === 401 || response.status === 403) {
            return {
              success: false,
              message: 'Authentication failed - check client ID and secret',
              details: {
                status: response.status,
                error: response.data.error,
                error_description: response.data.error_description
              }
            };
          } else {
            return {
              success: false,
              message: `Received unexpected response (${response.status})`,
              details: {
                status: response.status,
                error: response.data.error,
                error_description: response.data.error_description
              }
            };
          }
        } catch (error) {
          // Token request failed but endpoint might be reachable
          return {
            success: false,
            message: 'Token endpoint is reachable but token request failed',
            details: error instanceof Error ? error.message : String(error)
          };
        }
      }
      
      // If we can't make a token request, at least confirm the URL is reachable
      return {
        success: true,
        message: 'Token endpoint is reachable',
        details: null
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to connect to provider',
        details: error instanceof Error ? error.message : String(error)
      };
    }
  }
}

// Export a singleton instance
export const ssoService = new SsoService();