/**
 * OAuth2 SSO Integration Service
 * 
 * Provides functionality for:
 * 1. SAML 2.0 integration with enterprise identity providers
 * 2. OIDC integration for modern authentication flows
 * 3. JWT token issuance and validation
 * 4. Federation across multiple identity providers
 * 5. Comprehensive audit logging of all authentication events
 */

import { db } from '@db';
import {
  ssoIdentityProviders,
  ssoServiceProviders,
  ssoSessions,
  ssoUserIdentities,
  ssoSamlArtifacts,
  ssoOidcClients,
  ssoJwtKeys,
  ssoAudits
} from '@shared/schema_oauth_sso';
import { users } from '@shared/schema';
import { eq, and, or, not, sql, gte, lte, desc, isNull } from 'drizzle-orm';
import { eventBus } from '../../infrastructure/events/EventBus';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';
import { promisify } from 'util';

// SSO Events
export const SSO_EVENTS = {
  IDP_CREATED: 'oauth.sso.idp_created',
  IDP_UPDATED: 'oauth.sso.idp_updated',
  IDP_DELETED: 'oauth.sso.idp_deleted',
  SP_CREATED: 'oauth.sso.sp_created',
  SP_UPDATED: 'oauth.sso.sp_updated',
  SP_DELETED: 'oauth.sso.sp_deleted',
  SESSION_CREATED: 'oauth.sso.session_created',
  SESSION_ENDED: 'oauth.sso.session_ended',
  LOGIN_SUCCESS: 'oauth.sso.login_success',
  LOGIN_FAILURE: 'oauth.sso.login_failure',
  LOGOUT_SUCCESS: 'oauth.sso.logout_success',
  JWT_ISSUED: 'oauth.sso.jwt_issued',
  JWT_VALIDATED: 'oauth.sso.jwt_validated',
  JWT_REJECTED: 'oauth.sso.jwt_rejected'
};

// JWT utilities
const jwtVerify = promisify(jwt.verify);
const jwtSign = promisify(jwt.sign);

export class OAuthSsoService {
  private static instance: OAuthSsoService;
  private keyCache: Map<string, { publicKey: string, privateKey: string, algorithm: string }> = new Map();
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): OAuthSsoService {
    if (!OAuthSsoService.instance) {
      OAuthSsoService.instance = new OAuthSsoService();
    }
    return OAuthSsoService.instance;
  }
  
  constructor() {
    console.log('OAuth SSO Service initialized');
    this.initializeKeyCache();
  }
  
  /**
   * Initialize the key cache with all active keys
   */
  private async initializeKeyCache(): Promise<void> {
    try {
      const keys = await db.query.ssoJwtKeys.findMany({
        where: eq(ssoJwtKeys.isActive, true)
      });
      
      for (const key of keys) {
        this.keyCache.set(key.kid, {
          publicKey: key.publicKey,
          privateKey: key.privateKey,
          algorithm: key.algorithm
        });
      }
      
      console.log(`Initialized key cache with ${keys.length} keys`);
    } catch (error) {
      console.error('Error initializing key cache:', error);
    }
  }
  
  /**
   * Create or update an identity provider
   */
  async createOrUpdateIdentityProvider(data: {
    id?: number;
    name: string;
    description?: string;
    providerType: 'saml' | 'oidc' | 'oauth2';
    entityId?: string;
    metadataUrl?: string;
    metadataXml?: string;
    singleSignOnUrl?: string;
    singleLogoutUrl?: string;
    x509Certificate?: string;
    clientId?: string;
    clientSecret?: string;
    tokenEndpoint?: string;
    authorizationEndpoint?: string;
    userInfoEndpoint?: string;
    jwksUri?: string;
    issuer?: string;
    scope?: string;
    attributeMapping?: Record<string, string>;
    isActive?: boolean;
    logoUrl?: string;
    configJson?: Record<string, any>;
    userId: number;
  }): Promise<any> {
    try {
      // Validate required fields based on provider type
      this.validateIdentityProviderData(data);
      
      if (data.id) {
        // Update existing provider
        const [updated] = await db.update(ssoIdentityProviders)
          .set({
            name: data.name,
            description: data.description,
            providerType: data.providerType,
            entityId: data.entityId,
            metadataUrl: data.metadataUrl,
            metadataXml: data.metadataXml,
            singleSignOnUrl: data.singleSignOnUrl,
            singleLogoutUrl: data.singleLogoutUrl,
            x509Certificate: data.x509Certificate,
            clientId: data.clientId,
            clientSecret: data.clientSecret,
            tokenEndpoint: data.tokenEndpoint,
            authorizationEndpoint: data.authorizationEndpoint,
            userInfoEndpoint: data.userInfoEndpoint,
            jwksUri: data.jwksUri,
            issuer: data.issuer,
            scope: data.scope,
            attributeMapping: data.attributeMapping ? JSON.stringify(data.attributeMapping) : null,
            isActive: data.isActive ?? true,
            logoUrl: data.logoUrl,
            configJson: data.configJson ? JSON.stringify(data.configJson) : null,
            updatedAt: new Date(),
            updatedBy: data.userId
          })
          .where(eq(ssoIdentityProviders.id, data.id))
          .returning();
          
        // Emit event
        eventBus.emit(SSO_EVENTS.IDP_UPDATED, {
          id: updated.id,
          name: updated.name,
          providerType: updated.providerType,
          userId: data.userId
        });
        
        // Audit the update
        await this.createAuditEntry({
          eventType: 'idp_updated',
          userId: data.userId,
          identityProviderId: updated.id,
          ipAddress: null, // Not available in this context
          status: 'success',
          details: {
            idpName: updated.name,
            providerType: updated.providerType,
            changes: this.getChangesFromPrevious(updated, await this.getIdentityProvider(data.id))
          }
        });
        
        return updated;
      } else {
        // Create new provider
        const [created] = await db.insert(ssoIdentityProviders)
          .values({
            name: data.name,
            description: data.description,
            providerType: data.providerType,
            entityId: data.entityId,
            metadataUrl: data.metadataUrl,
            metadataXml: data.metadataXml,
            singleSignOnUrl: data.singleSignOnUrl,
            singleLogoutUrl: data.singleLogoutUrl,
            x509Certificate: data.x509Certificate,
            clientId: data.clientId,
            clientSecret: data.clientSecret,
            tokenEndpoint: data.tokenEndpoint,
            authorizationEndpoint: data.authorizationEndpoint,
            userInfoEndpoint: data.userInfoEndpoint,
            jwksUri: data.jwksUri,
            issuer: data.issuer,
            scope: data.scope,
            attributeMapping: data.attributeMapping ? JSON.stringify(data.attributeMapping) : null,
            isActive: data.isActive ?? true,
            logoUrl: data.logoUrl,
            configJson: data.configJson ? JSON.stringify(data.configJson) : null,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: data.userId,
            updatedBy: data.userId
          })
          .returning();
          
        // Emit event
        eventBus.emit(SSO_EVENTS.IDP_CREATED, {
          id: created.id,
          name: created.name,
          providerType: created.providerType,
          userId: data.userId
        });
        
        // Audit the creation
        await this.createAuditEntry({
          eventType: 'idp_created',
          userId: data.userId,
          identityProviderId: created.id,
          ipAddress: null, // Not available in this context
          status: 'success',
          details: {
            idpName: created.name,
            providerType: created.providerType
          }
        });
        
        return created;
      }
    } catch (error) {
      console.error('Error creating/updating identity provider:', error);
      
      // Audit the failure
      await this.createAuditEntry({
        eventType: data.id ? 'idp_updated' : 'idp_created',
        userId: data.userId,
        identityProviderId: data.id,
        ipAddress: null, // Not available in this context
        status: 'failure',
        errorMessage: error.message,
        details: {
          idpName: data.name,
          providerType: data.providerType,
          error: error.message
        }
      });
      
      throw new Error(`Failed to ${data.id ? 'update' : 'create'} identity provider: ${error.message}`);
    }
  }
  
  /**
   * Validate identity provider data
   */
  private validateIdentityProviderData(data: any): void {
    // Common validation
    if (!data.name) {
      throw new Error('Identity provider name is required');
    }
    
    if (!data.providerType) {
      throw new Error('Identity provider type is required');
    }
    
    // Type-specific validation
    switch (data.providerType) {
      case 'saml':
        // For SAML, we need either metadata URL/XML or SSO URL + certificate
        if (!data.metadataUrl && !data.metadataXml && (!data.singleSignOnUrl || !data.x509Certificate)) {
          throw new Error('SAML provider requires either metadata (URL or XML) or SSO URL + certificate');
        }
        break;
        
      case 'oidc':
        // For OIDC, we need clientId, authorizationEndpoint, tokenEndpoint
        if (!data.clientId) {
          throw new Error('OIDC provider requires client ID');
        }
        
        if (!data.authorizationEndpoint) {
          throw new Error('OIDC provider requires authorization endpoint');
        }
        
        if (!data.tokenEndpoint) {
          throw new Error('OIDC provider requires token endpoint');
        }
        break;
        
      case 'oauth2':
        // For OAuth2, we need clientId, authorizationEndpoint, tokenEndpoint
        if (!data.clientId) {
          throw new Error('OAuth2 provider requires client ID');
        }
        
        if (!data.authorizationEndpoint) {
          throw new Error('OAuth2 provider requires authorization endpoint');
        }
        
        if (!data.tokenEndpoint) {
          throw new Error('OAuth2 provider requires token endpoint');
        }
        break;
        
      default:
        throw new Error(`Unsupported identity provider type: ${data.providerType}`);
    }
  }
  
  /**
   * Get an identity provider by ID
   */
  async getIdentityProvider(id: number): Promise<any> {
    try {
      const provider = await db.query.ssoIdentityProviders.findFirst({
        where: eq(ssoIdentityProviders.id, id)
      });
      
      if (!provider) {
        throw new Error(`Identity provider with ID ${id} not found`);
      }
      
      // Parse JSON fields
      return {
        ...provider,
        attributeMapping: provider.attributeMapping ? JSON.parse(provider.attributeMapping) : null,
        configJson: provider.configJson ? JSON.parse(provider.configJson) : null
      };
    } catch (error) {
      console.error(`Error getting identity provider ${id}:`, error);
      throw new Error(`Failed to get identity provider: ${error.message}`);
    }
  }
  
  /**
   * Delete an identity provider
   */
  async deleteIdentityProvider(id: number, userId: number): Promise<void> {
    try {
      // Get the provider first for audit purposes
      const provider = await this.getIdentityProvider(id);
      
      if (!provider) {
        throw new Error(`Identity provider with ID ${id} not found`);
      }
      
      // Check if there are any user identities linked to this provider
      const linkedIdentities = await db.query.ssoUserIdentities.findMany({
        where: eq(ssoUserIdentities.identityProviderId, id),
        limit: 1
      });
      
      if (linkedIdentities.length > 0) {
        throw new Error('Cannot delete identity provider with linked user identities');
      }
      
      // Delete the provider
      await db.delete(ssoIdentityProviders)
        .where(eq(ssoIdentityProviders.id, id));
      
      // Emit event
      eventBus.emit(SSO_EVENTS.IDP_DELETED, {
        id,
        name: provider.name,
        providerType: provider.providerType,
        userId
      });
      
      // Audit the deletion
      await this.createAuditEntry({
        eventType: 'idp_deleted',
        userId,
        identityProviderId: id,
        ipAddress: null, // Not available in this context
        status: 'success',
        details: {
          idpName: provider.name,
          providerType: provider.providerType
        }
      });
    } catch (error) {
      console.error(`Error deleting identity provider ${id}:`, error);
      
      // Audit the failure
      await this.createAuditEntry({
        eventType: 'idp_deleted',
        userId,
        identityProviderId: id,
        ipAddress: null, // Not available in this context
        status: 'failure',
        errorMessage: error.message,
        details: {
          error: error.message
        }
      });
      
      throw new Error(`Failed to delete identity provider: ${error.message}`);
    }
  }
  
  /**
   * Create or update a service provider
   */
  async createOrUpdateServiceProvider(data: {
    id?: number;
    name: string;
    description?: string;
    entityId: string;
    acsUrl: string;
    metadataUrl?: string;
    metadataXml?: string;
    sloUrl?: string;
    x509Certificate?: string;
    privateKey?: string;
    nameIdFormat?: string;
    wantAssertionsSigned?: boolean;
    validUntil?: Date;
    isActive?: boolean;
    configJson?: Record<string, any>;
    userId: number;
  }): Promise<any> {
    try {
      // Validate required fields
      if (!data.name) {
        throw new Error('Service provider name is required');
      }
      
      if (!data.entityId) {
        throw new Error('Service provider entity ID is required');
      }
      
      if (!data.acsUrl) {
        throw new Error('Service provider ACS URL is required');
      }
      
      if (data.id) {
        // Update existing provider
        const [updated] = await db.update(ssoServiceProviders)
          .set({
            name: data.name,
            description: data.description,
            entityId: data.entityId,
            acsUrl: data.acsUrl,
            metadataUrl: data.metadataUrl,
            metadataXml: data.metadataXml,
            sloUrl: data.sloUrl,
            x509Certificate: data.x509Certificate,
            privateKey: data.privateKey,
            nameIdFormat: data.nameIdFormat,
            wantAssertionsSigned: data.wantAssertionsSigned,
            validUntil: data.validUntil,
            isActive: data.isActive ?? true,
            configJson: data.configJson ? JSON.stringify(data.configJson) : null,
            updatedAt: new Date(),
            updatedBy: data.userId
          })
          .where(eq(ssoServiceProviders.id, data.id))
          .returning();
          
        // Emit event
        eventBus.emit(SSO_EVENTS.SP_UPDATED, {
          id: updated.id,
          name: updated.name,
          entityId: updated.entityId,
          userId: data.userId
        });
        
        // Audit the update
        await this.createAuditEntry({
          eventType: 'sp_updated',
          userId: data.userId,
          serviceProviderId: updated.id,
          ipAddress: null, // Not available in this context
          status: 'success',
          details: {
            spName: updated.name,
            entityId: updated.entityId,
            changes: this.getChangesFromPrevious(updated, await this.getServiceProvider(data.id))
          }
        });
        
        return updated;
      } else {
        // Create new provider
        const [created] = await db.insert(ssoServiceProviders)
          .values({
            name: data.name,
            description: data.description,
            entityId: data.entityId,
            acsUrl: data.acsUrl,
            metadataUrl: data.metadataUrl,
            metadataXml: data.metadataXml,
            sloUrl: data.sloUrl,
            x509Certificate: data.x509Certificate,
            privateKey: data.privateKey,
            nameIdFormat: data.nameIdFormat,
            wantAssertionsSigned: data.wantAssertionsSigned ?? true,
            validUntil: data.validUntil,
            isActive: data.isActive ?? true,
            configJson: data.configJson ? JSON.stringify(data.configJson) : null,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: data.userId,
            updatedBy: data.userId
          })
          .returning();
          
        // Emit event
        eventBus.emit(SSO_EVENTS.SP_CREATED, {
          id: created.id,
          name: created.name,
          entityId: created.entityId,
          userId: data.userId
        });
        
        // Audit the creation
        await this.createAuditEntry({
          eventType: 'sp_created',
          userId: data.userId,
          serviceProviderId: created.id,
          ipAddress: null, // Not available in this context
          status: 'success',
          details: {
            spName: created.name,
            entityId: created.entityId
          }
        });
        
        return created;
      }
    } catch (error) {
      console.error('Error creating/updating service provider:', error);
      
      // Audit the failure
      await this.createAuditEntry({
        eventType: data.id ? 'sp_updated' : 'sp_created',
        userId: data.userId,
        serviceProviderId: data.id,
        ipAddress: null, // Not available in this context
        status: 'failure',
        errorMessage: error.message,
        details: {
          spName: data.name,
          entityId: data.entityId,
          error: error.message
        }
      });
      
      throw new Error(`Failed to ${data.id ? 'update' : 'create'} service provider: ${error.message}`);
    }
  }
  
  /**
   * Get a service provider by ID
   */
  async getServiceProvider(id: number): Promise<any> {
    try {
      const provider = await db.query.ssoServiceProviders.findFirst({
        where: eq(ssoServiceProviders.id, id)
      });
      
      if (!provider) {
        throw new Error(`Service provider with ID ${id} not found`);
      }
      
      // Parse JSON fields
      return {
        ...provider,
        configJson: provider.configJson ? JSON.parse(provider.configJson) : null
      };
    } catch (error) {
      console.error(`Error getting service provider ${id}:`, error);
      throw new Error(`Failed to get service provider: ${error.message}`);
    }
  }
  
  /**
   * Delete a service provider
   */
  async deleteServiceProvider(id: number, userId: number): Promise<void> {
    try {
      // Get the provider first for audit purposes
      const provider = await this.getServiceProvider(id);
      
      if (!provider) {
        throw new Error(`Service provider with ID ${id} not found`);
      }
      
      // Check if there are any sessions linked to this provider
      const linkedSessions = await db.query.ssoSessions.findMany({
        where: eq(ssoSessions.serviceProviderId, id),
        limit: 1
      });
      
      if (linkedSessions.length > 0) {
        throw new Error('Cannot delete service provider with active sessions');
      }
      
      // Delete the provider
      await db.delete(ssoServiceProviders)
        .where(eq(ssoServiceProviders.id, id));
      
      // Emit event
      eventBus.emit(SSO_EVENTS.SP_DELETED, {
        id,
        name: provider.name,
        entityId: provider.entityId,
        userId
      });
      
      // Audit the deletion
      await this.createAuditEntry({
        eventType: 'sp_deleted',
        userId,
        serviceProviderId: id,
        ipAddress: null, // Not available in this context
        status: 'success',
        details: {
          spName: provider.name,
          entityId: provider.entityId
        }
      });
    } catch (error) {
      console.error(`Error deleting service provider ${id}:`, error);
      
      // Audit the failure
      await this.createAuditEntry({
        eventType: 'sp_deleted',
        userId,
        serviceProviderId: id,
        ipAddress: null, // Not available in this context
        status: 'failure',
        errorMessage: error.message,
        details: {
          error: error.message
        }
      });
      
      throw new Error(`Failed to delete service provider: ${error.message}`);
    }
  }
  
  /**
   * Create an SSO session
   */
  async createSession(data: {
    userId: number;
    identityProviderId: number;
    serviceProviderId?: number;
    nameId?: string;
    sessionIndex?: string;
    authenticationContext?: string;
    ipAddress?: string;
    userAgent?: string;
    attributes?: Record<string, any>;
    expiresIn?: number; // In seconds
  }): Promise<any> {
    try {
      // Generate a unique session ID
      const sessionId = uuidv4();
      
      // Calculate expiration time
      const expiresAt = data.expiresIn ? 
        new Date(Date.now() + data.expiresIn * 1000) : 
        new Date(Date.now() + 8 * 60 * 60 * 1000); // Default: 8 hours
      
      // Create the session
      const [session] = await db.insert(ssoSessions)
        .values({
          userId: data.userId,
          identityProviderId: data.identityProviderId,
          serviceProviderId: data.serviceProviderId,
          sessionId,
          nameId: data.nameId,
          sessionIndex: data.sessionIndex,
          authenticationContext: data.authenticationContext,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          createdAt: new Date(),
          expiresAt,
          isActive: true,
          attributes: data.attributes ? JSON.stringify(data.attributes) : null
        })
        .returning();
      
      // Emit event
      eventBus.emit(SSO_EVENTS.SESSION_CREATED, {
        sessionId,
        userId: data.userId,
        identityProviderId: data.identityProviderId,
        serviceProviderId: data.serviceProviderId,
        expiresAt
      });
      
      // Audit the session creation
      await this.createAuditEntry({
        eventType: 'session_created',
        userId: data.userId,
        identityProviderId: data.identityProviderId,
        serviceProviderId: data.serviceProviderId,
        sessionId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        status: 'success',
        details: {
          nameId: data.nameId,
          sessionIndex: data.sessionIndex,
          expiresAt
        }
      });
      
      return {
        ...session,
        attributes: data.attributes
      };
    } catch (error) {
      console.error('Error creating SSO session:', error);
      
      // Audit the failure
      await this.createAuditEntry({
        eventType: 'session_created',
        userId: data.userId,
        identityProviderId: data.identityProviderId,
        serviceProviderId: data.serviceProviderId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        status: 'failure',
        errorMessage: error.message,
        details: {
          error: error.message
        }
      });
      
      throw new Error(`Failed to create SSO session: ${error.message}`);
    }
  }
  
  /**
   * End an SSO session
   */
  async endSession(data: {
    sessionId?: string;
    userId?: number;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      let session;
      
      // Find the session
      if (data.sessionId) {
        session = await db.query.ssoSessions.findFirst({
          where: and(
            eq(ssoSessions.sessionId, data.sessionId),
            eq(ssoSessions.isActive, true)
          )
        });
      } else if (data.userId) {
        session = await db.query.ssoSessions.findFirst({
          where: and(
            eq(ssoSessions.userId, data.userId),
            eq(ssoSessions.isActive, true)
          ),
          orderBy: [desc(ssoSessions.createdAt)]
        });
      }
      
      if (!session) {
        throw new Error('Active session not found');
      }
      
      // End the session
      await db.update(ssoSessions)
        .set({
          isActive: false,
          logoutAt: new Date()
        })
        .where(eq(ssoSessions.id, session.id));
      
      // Emit event
      eventBus.emit(SSO_EVENTS.SESSION_ENDED, {
        sessionId: session.sessionId,
        userId: session.userId,
        identityProviderId: session.identityProviderId,
        serviceProviderId: session.serviceProviderId
      });
      
      // Audit the session end
      await this.createAuditEntry({
        eventType: 'session_ended',
        userId: session.userId,
        identityProviderId: session.identityProviderId,
        serviceProviderId: session.serviceProviderId,
        sessionId: session.sessionId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        status: 'success',
        details: {
          logoutAt: new Date()
        }
      });
    } catch (error) {
      console.error('Error ending SSO session:', error);
      
      // Audit the failure
      await this.createAuditEntry({
        eventType: 'session_ended',
        userId: data.userId,
        sessionId: data.sessionId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        status: 'failure',
        errorMessage: error.message,
        details: {
          error: error.message
        }
      });
      
      throw new Error(`Failed to end SSO session: ${error.message}`);
    }
  }
  
  /**
   * Create or update a user identity
   */
  async createOrUpdateUserIdentity(data: {
    userId: number;
    identityProviderId: number;
    externalId: string;
    externalEmail?: string;
    externalUsername?: string;
    externalDisplayName?: string;
    attributes?: Record<string, any>;
    isActive?: boolean;
  }): Promise<any> {
    try {
      // Check if the identity already exists
      const existingIdentity = await db.query.ssoUserIdentities.findFirst({
        where: and(
          eq(ssoUserIdentities.userId, data.userId),
          eq(ssoUserIdentities.identityProviderId, data.identityProviderId)
        )
      });
      
      if (existingIdentity) {
        // Update existing identity
        const [updated] = await db.update(ssoUserIdentities)
          .set({
            externalEmail: data.externalEmail,
            externalUsername: data.externalUsername,
            externalDisplayName: data.externalDisplayName,
            lastLoginAt: new Date(),
            updatedAt: new Date(),
            attributes: data.attributes ? JSON.stringify(data.attributes) : null,
            isActive: data.isActive ?? true
          })
          .where(eq(ssoUserIdentities.id, existingIdentity.id))
          .returning();
          
        return {
          ...updated,
          attributes: data.attributes
        };
      } else {
        // Create new identity
        const [created] = await db.insert(ssoUserIdentities)
          .values({
            userId: data.userId,
            identityProviderId: data.identityProviderId,
            externalId: data.externalId,
            externalEmail: data.externalEmail,
            externalUsername: data.externalUsername,
            externalDisplayName: data.externalDisplayName,
            lastLoginAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            attributes: data.attributes ? JSON.stringify(data.attributes) : null,
            isActive: data.isActive ?? true
          })
          .returning();
          
        return {
          ...created,
          attributes: data.attributes
        };
      }
    } catch (error) {
      console.error('Error creating/updating user identity:', error);
      throw new Error(`Failed to ${existingIdentity ? 'update' : 'create'} user identity: ${error.message}`);
    }
  }
  
  /**
   * Create an OIDC client
   */
  async createOrUpdateOidcClient(data: {
    id?: number;
    clientId?: string; // If not provided, a new ID will be generated
    name: string;
    description?: string;
    redirectUris: string[];
    allowedScopes: string[];
    allowedGrantTypes: string[];
    accessTokenLifetime?: number;
    refreshTokenLifetime?: number;
    idTokenLifetime?: number;
    isActive?: boolean;
    logoUrl?: string;
    configJson?: Record<string, any>;
    userId: number;
  }): Promise<any> {
    try {
      // Generate a client ID if not provided
      const clientId = data.clientId || `mcp-oidc-${uuidv4()}`;
      
      // Generate a client secret only for new clients
      const clientSecret = data.id ? undefined : crypto.randomBytes(32).toString('hex');
      
      if (data.id) {
        // Update existing client
        const [updated] = await db.update(ssoOidcClients)
          .set({
            name: data.name,
            description: data.description,
            redirectUris: JSON.stringify(data.redirectUris),
            allowedScopes: JSON.stringify(data.allowedScopes),
            allowedGrantTypes: JSON.stringify(data.allowedGrantTypes),
            accessTokenLifetime: data.accessTokenLifetime,
            refreshTokenLifetime: data.refreshTokenLifetime,
            idTokenLifetime: data.idTokenLifetime,
            isActive: data.isActive ?? true,
            logoUrl: data.logoUrl,
            configJson: data.configJson ? JSON.stringify(data.configJson) : null,
            updatedAt: new Date(),
            updatedBy: data.userId
          })
          .where(eq(ssoOidcClients.id, data.id))
          .returning();
          
        return {
          ...updated,
          redirectUris: data.redirectUris,
          allowedScopes: data.allowedScopes,
          allowedGrantTypes: data.allowedGrantTypes,
          configJson: data.configJson
        };
      } else {
        // Create new client
        const [created] = await db.insert(ssoOidcClients)
          .values({
            clientId,
            clientSecret: await this.hashSecret(clientSecret),
            name: data.name,
            description: data.description,
            redirectUris: JSON.stringify(data.redirectUris),
            allowedScopes: JSON.stringify(data.allowedScopes),
            allowedGrantTypes: JSON.stringify(data.allowedGrantTypes),
            accessTokenLifetime: data.accessTokenLifetime,
            refreshTokenLifetime: data.refreshTokenLifetime,
            idTokenLifetime: data.idTokenLifetime,
            isActive: data.isActive ?? true,
            logoUrl: data.logoUrl,
            configJson: data.configJson ? JSON.stringify(data.configJson) : null,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: data.userId,
            updatedBy: data.userId
          })
          .returning();
          
        return {
          ...created,
          redirectUris: data.redirectUris,
          allowedScopes: data.allowedScopes,
          allowedGrantTypes: data.allowedGrantTypes,
          configJson: data.configJson,
          clientSecret // Return the plaintext secret only once
        };
      }
    } catch (error) {
      console.error('Error creating/updating OIDC client:', error);
      throw new Error(`Failed to ${data.id ? 'update' : 'create'} OIDC client: ${error.message}`);
    }
  }
  
  /**
   * Hash a secret
   */
  private async hashSecret(secret: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString('hex');
    const derivedKey = await promisify(scrypt)(secret, salt, 64) as Buffer;
    return `${derivedKey.toString('hex')}.${salt}`;
  }
  
  /**
   * Verify a secret
   */
  private async verifySecret(secret: string, hash: string): Promise<boolean> {
    const [derivedKey, salt] = hash.split('.');
    const keyBuffer = Buffer.from(derivedKey, 'hex');
    const derivedKeyCompare = await promisify(scrypt)(secret, salt, 64) as Buffer;
    return crypto.timingSafeEqual(keyBuffer, derivedKeyCompare);
  }
  
  /**
   * Create a JWT key pair
   */
  async createJwtKeyPair(data: {
    algorithm?: string;
    expiresAt?: Date;
    userId: number;
  }): Promise<any> {
    try {
      const algorithm = data.algorithm || 'RS256';
      const kid = uuidv4();
      
      // Generate key pair
      const { publicKey, privateKey } = await this.generateKeyPair(algorithm);
      
      // Calculate expiry date (default: 1 year)
      const expiresAt = data.expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
      
      // Store the key pair
      const [created] = await db.insert(ssoJwtKeys)
        .values({
          kid,
          publicKey,
          privateKey,
          algorithm,
          createdAt: new Date(),
          expiresAt,
          isActive: true
        })
        .returning();
      
      // Add to key cache
      this.keyCache.set(kid, {
        publicKey,
        privateKey,
        algorithm
      });
      
      return {
        id: created.id,
        kid: created.kid,
        algorithm: created.algorithm,
        createdAt: created.createdAt,
        expiresAt: created.expiresAt,
        isActive: created.isActive,
        publicKey: created.publicKey
      };
    } catch (error) {
      console.error('Error creating JWT key pair:', error);
      throw new Error(`Failed to create JWT key pair: ${error.message}`);
    }
  }
  
  /**
   * Generate a key pair
   */
  private async generateKeyPair(algorithm: string): Promise<{ publicKey: string, privateKey: string }> {
    const keyOptions = {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    };
    
    return new Promise((resolve, reject) => {
      crypto.generateKeyPair('rsa', keyOptions, (err, publicKey, privateKey) => {
        if (err) {
          return reject(err);
        }
        resolve({ publicKey, privateKey });
      });
    });
  }
  
  /**
   * Get active JWT keys
   */
  async getActiveJwtKeys(): Promise<any[]> {
    try {
      const keys = await db.query.ssoJwtKeys.findMany({
        where: and(
          eq(ssoJwtKeys.isActive, true),
          or(
            isNull(ssoJwtKeys.expiresAt),
            gt(ssoJwtKeys.expiresAt, new Date())
          )
        )
      });
      
      // Only return public key information
      return keys.map(key => ({
        kid: key.kid,
        algorithm: key.algorithm,
        publicKey: key.publicKey,
        createdAt: key.createdAt,
        expiresAt: key.expiresAt
      }));
    } catch (error) {
      console.error('Error getting active JWT keys:', error);
      throw new Error(`Failed to get active JWT keys: ${error.message}`);
    }
  }
  
  /**
   * Issue a JWT token
   */
  async issueJwt(data: {
    subject: string;
    audience: string;
    claims?: Record<string, any>;
    expiresIn?: number;
    kid?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<string> {
    try {
      // Get a key to use
      let kid = data.kid;
      let keyData;
      
      if (kid) {
        // Use the specified key
        keyData = this.keyCache.get(kid);
        if (!keyData) {
          // Key not in cache, try to load it
          const key = await db.query.ssoJwtKeys.findFirst({
            where: and(
              eq(ssoJwtKeys.kid, kid),
              eq(ssoJwtKeys.isActive, true)
            )
          });
          
          if (!key) {
            throw new Error(`JWT key with ID ${kid} not found or not active`);
          }
          
          keyData = {
            publicKey: key.publicKey,
            privateKey: key.privateKey,
            algorithm: key.algorithm
          };
          
          // Add to cache
          this.keyCache.set(kid, keyData);
        }
      } else {
        // Get the latest active key
        const keys = await db.query.ssoJwtKeys.findMany({
          where: and(
            eq(ssoJwtKeys.isActive, true),
            or(
              isNull(ssoJwtKeys.expiresAt),
              gt(ssoJwtKeys.expiresAt, new Date())
            )
          ),
          orderBy: [desc(ssoJwtKeys.createdAt)],
          limit: 1
        });
        
        if (keys.length === 0) {
          throw new Error('No active JWT keys found');
        }
        
        kid = keys[0].kid;
        keyData = {
          publicKey: keys[0].publicKey,
          privateKey: keys[0].privateKey,
          algorithm: keys[0].algorithm
        };
        
        // Add to cache if not already there
        if (!this.keyCache.has(kid)) {
          this.keyCache.set(kid, keyData);
        }
      }
      
      // Prepare the token payload
      const now = Math.floor(Date.now() / 1000);
      const expiresIn = data.expiresIn || 3600; // Default: 1 hour
      
      const payload = {
        sub: data.subject,
        aud: data.audience,
        iat: now,
        exp: now + expiresIn,
        ...data.claims
      };
      
      // Sign the token
      const token = await jwtSign(payload, keyData.privateKey, {
        algorithm: keyData.algorithm,
        keyid: kid
      });
      
      // Create audit entry
      await this.createAuditEntry({
        eventType: 'jwt_issued',
        userId: parseInt(data.subject) || null,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        status: 'success',
        details: {
          kid,
          subject: data.subject,
          audience: data.audience,
          expiresIn,
          claims: data.claims
        }
      });
      
      // Emit event
      eventBus.emit(SSO_EVENTS.JWT_ISSUED, {
        kid,
        subject: data.subject,
        audience: data.audience,
        expiresIn,
        issuedAt: new Date()
      });
      
      return token;
    } catch (error) {
      console.error('Error issuing JWT:', error);
      
      // Create audit entry for failure
      await this.createAuditEntry({
        eventType: 'jwt_issued',
        userId: parseInt(data.subject) || null,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        status: 'failure',
        errorMessage: error.message,
        details: {
          subject: data.subject,
          audience: data.audience,
          error: error.message
        }
      });
      
      throw new Error(`Failed to issue JWT: ${error.message}`);
    }
  }
  
  /**
   * Verify a JWT token
   */
  async verifyJwt(token: string, audience?: string): Promise<any> {
    try {
      // Decode the token header to get the key ID
      const decodedHeader = jwt.decode(token, { complete: true });
      
      if (!decodedHeader || typeof decodedHeader === 'string' || !decodedHeader.header.kid) {
        throw new Error('Invalid token format or missing key ID');
      }
      
      const kid = decodedHeader.header.kid;
      
      // Get the key
      let keyData = this.keyCache.get(kid);
      
      if (!keyData) {
        // Key not in cache, try to load it
        const key = await db.query.ssoJwtKeys.findFirst({
          where: eq(ssoJwtKeys.kid, kid)
        });
        
        if (!key) {
          throw new Error(`JWT key with ID ${kid} not found`);
        }
        
        keyData = {
          publicKey: key.publicKey,
          privateKey: key.privateKey,
          algorithm: key.algorithm
        };
        
        // Add to cache
        this.keyCache.set(kid, keyData);
      }
      
      // Verify the token
      const verifyOptions: jwt.VerifyOptions = {
        algorithms: [keyData.algorithm]
      };
      
      if (audience) {
        verifyOptions.audience = audience;
      }
      
      const payload = await jwtVerify(token, keyData.publicKey, verifyOptions);
      
      // Create audit entry
      await this.createAuditEntry({
        eventType: 'jwt_validated',
        userId: typeof payload.sub === 'string' ? parseInt(payload.sub) || null : null,
        status: 'success',
        details: {
          kid,
          subject: payload.sub,
          audience: payload.aud
        }
      });
      
      // Emit event
      eventBus.emit(SSO_EVENTS.JWT_VALIDATED, {
        kid,
        subject: payload.sub,
        audience: payload.aud
      });
      
      return payload;
    } catch (error) {
      console.error('Error verifying JWT:', error);
      
      // Create audit entry for failure
      await this.createAuditEntry({
        eventType: 'jwt_validated',
        status: 'failure',
        errorMessage: error.message,
        details: {
          error: error.message
        }
      });
      
      // Emit event
      eventBus.emit(SSO_EVENTS.JWT_REJECTED, {
        error: error.message
      });
      
      throw new Error(`Failed to verify JWT: ${error.message}`);
    }
  }
  
  /**
   * Create an audit entry
   */
  async createAuditEntry(data: {
    eventType: string;
    userId?: number;
    identityProviderId?: number;
    serviceProviderId?: number;
    oidcClientId?: number;
    sessionId?: string;
    ipAddress?: string;
    userAgent?: string;
    status: 'success' | 'failure' | 'error';
    errorMessage?: string;
    details?: Record<string, any>;
  }): Promise<any> {
    try {
      const [audit] = await db.insert(ssoAudits)
        .values({
          eventType: data.eventType,
          userId: data.userId,
          identityProviderId: data.identityProviderId,
          serviceProviderId: data.serviceProviderId,
          oidcClientId: data.oidcClientId,
          sessionId: data.sessionId,
          ipAddress: data.ipAddress,
          userAgent: data.userAgent,
          timestamp: new Date(),
          status: data.status,
          errorMessage: data.errorMessage,
          details: data.details ? JSON.stringify(data.details) : null
        })
        .returning();
        
      return audit;
    } catch (error) {
      console.error('Error creating audit entry:', error);
      // Don't throw here to avoid cascading failures
      return null;
    }
  }
  
  /**
   * Get changes between old and new objects
   */
  private getChangesFromPrevious(newObj: any, oldObj: any): Record<string, any> {
    const changes: Record<string, any> = {};
    
    // Compare the objects and identify changed fields
    for (const [key, value] of Object.entries(newObj)) {
      // Skip sensitive fields
      if (['clientSecret', 'privateKey'].includes(key)) {
        continue;
      }
      
      // Check if the value has changed
      if (oldObj && JSON.stringify(value) !== JSON.stringify(oldObj[key])) {
        changes[key] = {
          from: oldObj[key],
          to: value
        };
      }
    }
    
    return changes;
  }
}