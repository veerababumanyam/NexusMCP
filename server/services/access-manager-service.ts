/**
 * Access Manager Service
 * Enterprise-grade OAuth2 authentication and authorization service
 * Provides client management, token issuance, and access control
 */

import { db } from '../../db';
import { eq, and, gt, desc } from 'drizzle-orm';
import { 
  oauthClients, 
  oauthAuthCodes, 
  oauthAccessTokens, 
  oauthRefreshTokens,
  clientRegistrations,
  mtlsCertificates,
  accessAuditLogs
} from '../../shared/schema_access';
import { createHash, randomBytes } from 'crypto';
import { Request } from 'express';
import { eventBus } from '../eventBus';

// OAuth2 supported grant types
export enum GrantType {
  AUTHORIZATION_CODE = 'authorization_code',
  CLIENT_CREDENTIALS = 'client_credentials',
  REFRESH_TOKEN = 'refresh_token',
  PASSWORD = 'password'
}

// OAuth2 standard scopes
export enum StandardScope {
  PROFILE = 'profile',
  EMAIL = 'email',
  OPENID = 'openid',
  OFFLINE_ACCESS = 'offline_access'
}

// MCP specific scopes
export enum McpScope {
  MCP_READ = 'mcp:read',
  MCP_WRITE = 'mcp:write',
  MCP_ADMIN = 'mcp:admin',
  MCP_SERVER_READ = 'mcp:server:read',
  MCP_SERVER_WRITE = 'mcp:server:write',
  MCP_SERVER_ADMIN = 'mcp:server:admin',
  MCP_TOOL_READ = 'mcp:tool:read',
  MCP_TOOL_WRITE = 'mcp:tool:write',
  MCP_TOOL_INVOKE = 'mcp:tool:invoke',
  AGENT_READ = 'agent:read',
  AGENT_WRITE = 'agent:write',
  AGENT_INVOKE = 'agent:invoke',
  AGENT_ADMIN = 'agent:admin',
  // Financial scopes
  FINANCIAL_READ = 'financial:read',
  FINANCIAL_WRITE = 'financial:write',
  FINANCIAL_ADMIN = 'financial:admin',
  // Healthcare scopes
  HEALTHCARE_READ = 'healthcare:read',
  HEALTHCARE_WRITE = 'healthcare:write',
  HEALTHCARE_PHI = 'healthcare:phi',
  HEALTHCARE_ADMIN = 'healthcare:admin'
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface ClientInfo {
  client_id: string;
  client_name: string;
  grant_types: string[];
  redirect_uris: string[];
  token_endpoint_auth_method: string;
  scope: string;
  client_uri?: string;
  logo_uri?: string;
}

export interface TokenMetadata {
  active: boolean;
  scope: string;
  client_id: string;
  username?: string;
  exp: number;
  iat: number;
  token_type: string;
}

export interface AuditOptions {
  complianceRelevant?: boolean;
  details?: any;
}

class AccessManagerService {
  // Token expiration settings (in seconds)
  private accessTokenLifetime = 3600; // 1 hour
  private refreshTokenLifetime = 2592000; // 30 days
  private authCodeLifetime = 600; // 10 minutes
  private registrationTokenLifetime = 86400; // 24 hours
  
  /**
   * Create a new OAuth client
   */
  async createClient(
    clientName: string, 
    redirectUris: string[], 
    grantTypes: string[], 
    scopes: string[],
    isConfidential: boolean,
    userId?: number,
    metadata?: any
  ) {
    try {
      // Generate secure client secret for confidential clients
      const clientSecret = isConfidential ? 
        randomBytes(32).toString('hex') : 
        'public-client'; // Public clients don't use a secret
      
      const [newClient] = await db.insert(oauthClients).values({
        clientName,
        clientSecret,
        redirectUris,
        grantTypes,
        scopes,
        isConfidential,
        userId,
        metadata,
        isEnabled: true,
        isAutoApprove: false,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      
      // Create audit log
      await this.createAuditLog('client.created', undefined, newClient.id, {
        complianceRelevant: true,
        details: {
          clientName,
          redirectUris,
          grantTypes,
          scopes,
          isConfidential
        }
      });
      
      // Emit event
      eventBus.emit('security.client.created', { 
        clientId: newClient.clientId,
        clientName: newClient.clientName
      });
      
      return newClient;
    } catch (error) {
      console.error('Error creating OAuth client:', error);
      throw error;
    }
  }
  
  /**
   * Register a new client dynamically (RFC 7591)
   */
  async registerClientDynamically(
    clientMetadata: {
      client_name: string;
      redirect_uris: string[];
      grant_types?: string[];
      scope?: string;
      token_endpoint_auth_method?: string;
    },
    requesterId?: number
  ) {
    try {
      // Default grant types if not provided
      const grantTypes = clientMetadata.grant_types || [GrantType.AUTHORIZATION_CODE];
      
      // Default scopes if not provided
      const scopes = clientMetadata.scope?.split(' ') || [
        StandardScope.PROFILE, 
        StandardScope.EMAIL
      ];
      
      // Determine if client is confidential based on auth method
      const isConfidential = clientMetadata.token_endpoint_auth_method !== 'none';
      
      // Create the client
      const client = await this.createClient(
        clientMetadata.client_name,
        clientMetadata.redirect_uris,
        grantTypes,
        scopes,
        isConfidential,
        requesterId
      );
      
      // Generate registration token
      const registrationToken = randomBytes(32).toString('hex');
      
      // Store registration token with expiration
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + this.registrationTokenLifetime);
      
      // Build registration URI
      const registrationUri = `/api/oauth/register/${client.clientId}`;
      
      // Create registration record
      await db.insert(clientRegistrations).values({
        registrationToken,
        clientId: client.id,
        registrationUri,
        expiresAt,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Return client information and registration access token
      return {
        client_id: client.clientId,
        client_secret: client.isConfidential ? client.clientSecret : undefined,
        client_id_issued_at: Math.floor(client.createdAt.getTime() / 1000),
        client_secret_expires_at: 0, // Doesn't expire
        registration_access_token: registrationToken,
        registration_client_uri: registrationUri,
        token_endpoint_auth_method: isConfidential ? 'client_secret_basic' : 'none',
        grant_types: client.grantTypes,
        redirect_uris: client.redirectUris,
        client_name: client.clientName,
        scope: scopes.join(' ')
      };
    } catch (error) {
      console.error('Error registering client dynamically:', error);
      throw error;
    }
  }
  
  /**
   * Get client by ID
   */
  async getClientById(clientId: string) {
    try {
      return await db.query.oauthClients.findFirst({
        where: (clients, { eq }) => eq(clients.clientId, clientId)
      });
    } catch (error) {
      console.error('Error fetching OAuth client:', error);
      throw error;
    }
  }
  
  /**
   * Issue an authorization code
   */
  async issueAuthCode(
    clientId: string, 
    userId: number, 
    redirectUri: string, 
    scopes: string[], 
    req: Request
  ) {
    try {
      const client = await this.getClientById(clientId);
      if (!client) throw new Error('Client not found');
      if (!client.isEnabled) throw new Error('Client is disabled');
      
      // Validate redirect URI
      if (!client.redirectUris.includes(redirectUri)) {
        throw new Error('Invalid redirect URI');
      }
      
      // Validate requested scopes against client allowed scopes
      const invalidScopes = scopes.filter(s => !client.scopes.includes(s));
      if (invalidScopes.length > 0) {
        throw new Error(`Invalid scopes requested: ${invalidScopes.join(', ')}`);
      }
      
      // Generate authorization code
      const code = randomBytes(32).toString('hex');
      
      // Set expiration time
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + this.authCodeLifetime);
      
      // Store authorization code
      const [authCode] = await db.insert(oauthAuthCodes).values({
        authCode: code,
        clientId: client.id,
        userId,
        scopes,
        redirectUri,
        expiresAt,
        createdAt: new Date()
      }).returning();
      
      // Create audit log
      await this.createAuditLog('auth.code.issued', userId, client.id, {
        details: {
          scopes,
          ip: req.ip,
          userAgent: req.headers['user-agent']
        }
      });
      
      return code;
    } catch (error) {
      console.error('Error issuing authorization code:', error);
      throw error;
    }
  }
  
  /**
   * Issue access token using authorization code grant
   */
  async issueTokenWithAuthCode(
    code: string, 
    clientId: string, 
    clientSecret: string, 
    redirectUri: string,
    req: Request
  ): Promise<TokenResponse> {
    try {
      // Find the authorization code
      const authCode = await db.query.oauthAuthCodes.findFirst({
        where: (codes, { eq }) => eq(codes.authCode, code)
      });
      
      if (!authCode) {
        await this.createAuditLog('auth.token.error', undefined, undefined, {
          details: { error: 'Invalid authorization code', code, clientId }
        });
        throw new Error('Invalid authorization code');
      }
      
      // Check if code has expired
      if (authCode.expiresAt < new Date()) {
        await this.createAuditLog('auth.token.error', undefined, undefined, {
          details: { error: 'Authorization code expired', code, clientId }
        });
        throw new Error('Authorization code has expired');
      }
      
      // Get the client for the code
      const client = await db.query.oauthClients.findFirst({
        where: (clients, { eq }) => eq(clients.id, authCode.clientId)
      });
      
      if (!client) throw new Error('Client not found');
      
      // Verify client ID matches
      if (client.clientId !== clientId) {
        await this.createAuditLog('auth.token.error', undefined, client.id, {
          details: { error: 'Client ID mismatch', expectedClientId: client.clientId, actualClientId: clientId }
        });
        throw new Error('Client ID mismatch');
      }
      
      // Verify client secret for confidential clients
      if (client.isConfidential && client.clientSecret !== clientSecret) {
        await this.createAuditLog('auth.token.error', undefined, client.id, {
          complianceRelevant: true,
          details: { error: 'Invalid client secret', clientId }
        });
        throw new Error('Invalid client secret');
      }
      
      // Verify redirect URI matches
      if (authCode.redirectUri !== redirectUri) {
        await this.createAuditLog('auth.token.error', undefined, client.id, {
          details: { error: 'Redirect URI mismatch', expectedUri: authCode.redirectUri, actualUri: redirectUri }
        });
        throw new Error('Redirect URI mismatch');
      }
      
      // Generate access token
      return await this.generateTokens(
        client.id, 
        authCode.userId, 
        authCode.scopes,
        req
      );
    } catch (error) {
      console.error('Error issuing token with auth code:', error);
      throw error;
    }
  }
  
  /**
   * Issue access token using client credentials grant
   */
  async issueTokenWithClientCredentials(
    clientId: string,
    clientSecret: string,
    scopes: string[],
    req: Request
  ): Promise<TokenResponse> {
    try {
      // Get the client
      const client = await this.getClientById(clientId);
      if (!client) {
        await this.createAuditLog('auth.token.error', undefined, undefined, {
          details: { error: 'Client not found', clientId }
        });
        throw new Error('Client not found');
      }
      
      // Verify client is confidential
      if (!client.isConfidential) {
        await this.createAuditLog('auth.token.error', undefined, client.id, {
          details: { error: 'Only confidential clients can use client credentials grant', clientId }
        });
        throw new Error('Only confidential clients can use client credentials grant');
      }
      
      // Verify client secret
      if (client.clientSecret !== clientSecret) {
        await this.createAuditLog('auth.token.error', undefined, client.id, {
          complianceRelevant: true, 
          details: { error: 'Invalid client secret', clientId }
        });
        throw new Error('Invalid client secret');
      }
      
      // Verify client supports client_credentials grant
      if (!client.grantTypes.includes(GrantType.CLIENT_CREDENTIALS)) {
        await this.createAuditLog('auth.token.error', undefined, client.id, {
          details: { 
            error: 'Client does not support client_credentials grant', 
            clientId, 
            supportedGrants: client.grantTypes 
          }
        });
        throw new Error('Client does not support client_credentials grant');
      }
      
      // Validate requested scopes against client allowed scopes
      const invalidScopes = scopes.filter(s => !client.scopes.includes(s));
      if (invalidScopes.length > 0) {
        await this.createAuditLog('auth.token.error', undefined, client.id, {
          details: { 
            error: 'Invalid scopes requested', 
            invalidScopes, 
            allowedScopes: client.scopes 
          }
        });
        throw new Error(`Invalid scopes requested: ${invalidScopes.join(', ')}`);
      }
      
      // Generate access token (no refresh token for client credentials)
      return await this.generateTokens(
        client.id,
        undefined,
        scopes,
        req,
        false // Don't include refresh token
      );
    } catch (error) {
      console.error('Error issuing token with client credentials:', error);
      throw error;
    }
  }
  
  /**
   * Issue new access token using refresh token
   */
  async issueTokenWithRefreshToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string,
    req: Request
  ): Promise<TokenResponse> {
    try {
      // Find the refresh token
      const token = await db.query.oauthRefreshTokens.findFirst({
        where: (tokens, { eq }) => eq(tokens.refreshToken, refreshToken),
        with: {
          accessToken: true,
          client: true
        }
      });
      
      if (!token) {
        await this.createAuditLog('auth.token.error', undefined, undefined, {
          details: { error: 'Invalid refresh token', clientId }
        });
        throw new Error('Invalid refresh token');
      }
      
      // Check if token has expired
      if (token.expiresAt < new Date()) {
        await this.createAuditLog('auth.token.error', token.userId || undefined, token.clientId, {
          details: { error: 'Refresh token expired', clientId }
        });
        throw new Error('Refresh token has expired');
      }
      
      // Verify client ID matches
      if (token.client.clientId !== clientId) {
        await this.createAuditLog('auth.token.error', token.userId || undefined, token.clientId, {
          complianceRelevant: true,
          details: { 
            error: 'Client ID mismatch', 
            expectedClientId: token.client.clientId, 
            actualClientId: clientId 
          }
        });
        throw new Error('Client ID mismatch');
      }
      
      // Verify client secret for confidential clients
      if (token.client.isConfidential && token.client.clientSecret !== clientSecret) {
        await this.createAuditLog('auth.token.error', token.userId || undefined, token.clientId, {
          complianceRelevant: true,
          details: { error: 'Invalid client secret', clientId }
        });
        throw new Error('Invalid client secret');
      }
      
      // Revoke old tokens
      await db.delete(oauthRefreshTokens).where(eq(oauthRefreshTokens.id, token.id));
      await db.delete(oauthAccessTokens).where(eq(oauthAccessTokens.id, token.accessTokenId));
      
      // Create audit log for token revocation
      await this.createAuditLog('auth.token.refreshed', token.userId || undefined, token.clientId, {
        details: { oldTokenId: token.accessTokenId }
      });
      
      // Generate new tokens with same scopes
      return await this.generateTokens(
        token.clientId,
        token.userId,
        token.accessToken.scopes,
        req
      );
    } catch (error) {
      console.error('Error issuing token with refresh token:', error);
      throw error;
    }
  }
  
  /**
   * Revoke token (access or refresh)
   */
  async revokeToken(token: string, clientId: string, clientSecret: string, tokenTypeHint?: 'access_token' | 'refresh_token') {
    try {
      // Get the client
      const client = await this.getClientById(clientId);
      if (!client) throw new Error('Client not found');
      
      // Verify client secret for confidential clients
      if (client.isConfidential && client.clientSecret !== clientSecret) {
        throw new Error('Invalid client secret');
      }
      
      let tokenFound = false;
      let userId: number | undefined;
      
      // Try to find and revoke token based on hint
      if (!tokenTypeHint || tokenTypeHint === 'access_token') {
        // Find access token
        const accessToken = await db.query.oauthAccessTokens.findFirst({
          where: (tokens, { eq }) => eq(tokens.accessToken, token)
        });
        
        if (accessToken) {
          // Verify token belongs to this client
          if (accessToken.clientId !== client.id) {
            throw new Error('Token does not belong to this client');
          }
          
          userId = accessToken.userId;
          
          // Delete the access token
          await db.delete(oauthAccessTokens).where(eq(oauthAccessTokens.id, accessToken.id));
          
          // Delete any refresh tokens associated with this access token
          await db.delete(oauthRefreshTokens).where(eq(oauthRefreshTokens.accessTokenId, accessToken.id));
          
          tokenFound = true;
          
          // Log token revocation
          await this.createAuditLog('auth.token.revoked', userId, client.id, {
            details: { tokenType: 'access_token', tokenId: accessToken.id }
          });
        }
      }
      
      if ((!tokenFound && !tokenTypeHint) || tokenTypeHint === 'refresh_token') {
        // Find refresh token
        const refreshToken = await db.query.oauthRefreshTokens.findFirst({
          where: (tokens, { eq }) => eq(tokens.refreshToken, token)
        });
        
        if (refreshToken) {
          // Verify token belongs to this client
          if (refreshToken.clientId !== client.id) {
            throw new Error('Token does not belong to this client');
          }
          
          userId = refreshToken.userId;
          
          // Delete the refresh token
          await db.delete(oauthRefreshTokens).where(eq(oauthRefreshTokens.id, refreshToken.id));
          
          // Delete the associated access token
          await db.delete(oauthAccessTokens).where(eq(oauthAccessTokens.id, refreshToken.accessTokenId));
          
          tokenFound = true;
          
          // Log token revocation
          await this.createAuditLog('auth.token.revoked', userId, client.id, {
            details: { tokenType: 'refresh_token', tokenId: refreshToken.id }
          });
        }
      }
      
      return { revoked: tokenFound };
    } catch (error) {
      console.error('Error revoking token:', error);
      throw error;
    }
  }
  
  /**
   * Validate access token and return token metadata
   */
  async validateToken(token: string): Promise<TokenMetadata> {
    try {
      // Find the access token
      const accessToken = await db.query.oauthAccessTokens.findFirst({
        where: (tokens, { eq }) => eq(tokens.accessToken, token),
        with: {
          client: true,
          user: true
        }
      });
      
      if (!accessToken) {
        return {
          active: false,
          scope: '',
          client_id: '',
          exp: 0,
          iat: 0,
          token_type: 'bearer'
        };
      }
      
      // Check if token has expired
      const isActive = accessToken.expiresAt > new Date();
      
      // Check if client is still enabled
      const isClientEnabled = accessToken.client.isEnabled;
      
      return {
        active: isActive && isClientEnabled,
        scope: accessToken.scopes.join(' '),
        client_id: accessToken.client.clientId,
        username: accessToken.user?.username,
        exp: Math.floor(accessToken.expiresAt.getTime() / 1000),
        iat: Math.floor(accessToken.createdAt.getTime() / 1000),
        token_type: 'bearer'
      };
    } catch (error) {
      console.error('Error validating access token:', error);
      throw error;
    }
  }
  
  /**
   * Register a client certificate for mTLS authentication
   */
  async registerClientCertificate(
    clientId: string,
    certInfo: {
      thumbprint: string;
      subject: string;
      issuer: string;
      serial: string;
      notBefore: Date;
      notAfter: Date;
    }
  ) {
    try {
      const client = await this.getClientById(clientId);
      if (!client) throw new Error('Client not found');
      
      // Check if certificate with this thumbprint already exists
      const existingCert = await db.query.mtlsCertificates.findFirst({
        where: (certs, { eq }) => eq(certs.certificateThumbprint, certInfo.thumbprint)
      });
      
      if (existingCert) {
        throw new Error('Certificate with this thumbprint already registered');
      }
      
      // Register the certificate
      const [certificate] = await db.insert(mtlsCertificates).values({
        clientId: client.id,
        certificateThumbprint: certInfo.thumbprint,
        certificateSubject: certInfo.subject,
        certificateIssuer: certInfo.issuer,
        certificateSerial: certInfo.serial,
        certificateNotBefore: certInfo.notBefore,
        certificateNotAfter: certInfo.notAfter,
        isEnabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }).returning();
      
      // Create audit log
      await this.createAuditLog('client.certificate.registered', undefined, client.id, {
        complianceRelevant: true,
        details: {
          thumbprint: certInfo.thumbprint,
          subject: certInfo.subject,
          issuer: certInfo.issuer,
          validUntil: certInfo.notAfter
        }
      });
      
      return certificate;
    } catch (error) {
      console.error('Error registering client certificate:', error);
      throw error;
    }
  }
  
  /**
   * Validate client by mTLS certificate thumbprint
   */
  async validateClientByCertificate(thumbprint: string) {
    try {
      const now = new Date();
      
      // Find certificate and associated client
      const cert = await db.query.mtlsCertificates.findFirst({
        where: (certs, { eq, and, gt, lt }) => and(
          eq(certs.certificateThumbprint, thumbprint),
          eq(certs.isEnabled, true),
          gt(certs.certificateNotAfter, now),
          lt(certs.certificateNotBefore, now)
        ),
        with: {
          client: true
        }
      });
      
      if (!cert || !cert.client) return null;
      
      return cert.client.isEnabled ? cert.client : null;
    } catch (error) {
      console.error('Error validating client by certificate:', error);
      throw error;
    }
  }
  
  /**
   * Get audit logs with filtering
   */
  async getAuditLogs({
    userId,
    clientId,
    eventType,
    startDate,
    endDate,
    complianceOnly = false,
    limit = 100,
    offset = 0
  }: {
    userId?: number;
    clientId?: number;
    eventType?: string;
    startDate?: Date;
    endDate?: Date;
    complianceOnly?: boolean;
    limit?: number;
    offset?: number;
  }) {
    try {
      // Build query conditions
      let conditions = [];
      
      if (userId !== undefined) {
        conditions.push(eq(accessAuditLogs.userId, userId));
      }
      
      if (clientId !== undefined) {
        conditions.push(eq(accessAuditLogs.clientId, clientId));
      }
      
      if (eventType) {
        conditions.push(eq(accessAuditLogs.eventType, eventType));
      }
      
      if (startDate) {
        conditions.push(gt(accessAuditLogs.eventTime, startDate));
      }
      
      if (endDate) {
        conditions.push(gt(endDate, accessAuditLogs.eventTime));
      }
      
      if (complianceOnly) {
        conditions.push(eq(accessAuditLogs.complianceRelevant, true));
      }
      
      // Execute query
      const whereClause = conditions.length > 0 
        ? and(...conditions) 
        : undefined;
      
      const logs = await db.select().from(accessAuditLogs)
        .where(whereClause)
        .orderBy(desc(accessAuditLogs.eventTime))
        .limit(limit)
        .offset(offset);
      
      // Get total count for pagination
      const countResult = await db.select({ count: sql<number>`count(*)` })
        .from(accessAuditLogs)
        .where(whereClause);
      
      const totalCount = countResult[0]?.count || 0;
      
      return {
        logs,
        totalCount,
        limit,
        offset,
        hasMore: offset + logs.length < totalCount
      };
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      throw error;
    }
  }
  
  /**
   * Export audit logs for compliance (GDPR, SOC 2, HIPAA)
   */
  async exportAuditLogs({
    startDate,
    endDate,
    format = 'json',
    complianceOnly = true
  }: {
    startDate: Date;
    endDate: Date;
    format?: 'json' | 'csv';
    complianceOnly?: boolean;
  }) {
    try {
      // Build query conditions
      const conditions = [
        gt(accessAuditLogs.eventTime, startDate),
        gt(endDate, accessAuditLogs.eventTime)
      ];
      
      if (complianceOnly) {
        conditions.push(eq(accessAuditLogs.complianceRelevant, true));
      }
      
      // Execute query
      const logs = await db.select().from(accessAuditLogs)
        .where(and(...conditions))
        .orderBy(accessAuditLogs.eventTime);
      
      // Create audit log for the export
      await this.createAuditLog('compliance.logs.exported', undefined, undefined, {
        complianceRelevant: true,
        details: {
          startDate,
          endDate,
          format,
          complianceOnly,
          count: logs.length
        }
      });
      
      // Format the logs according to requested format
      if (format === 'csv') {
        // Convert logs to CSV format
        const header = 'id,event_type,event_time,user_id,client_id,ip_address,request_path,request_method,status_code,error_code\n';
        const rows = logs.map(log => {
          return `${log.id},"${log.eventType}","${log.eventTime.toISOString()}",${log.userId || ''},${log.clientId || ''},"${log.ipAddress || ''}","${log.requestPath || ''}","${log.requestMethod || ''}",${log.statusCode || ''},"${log.errorCode || ''}"`;
        }).join('\n');
        
        return {
          format: 'csv',
          data: header + rows,
          count: logs.length
        };
      }
      
      return {
        format: 'json',
        data: logs,
        count: logs.length
      };
    } catch (error) {
      console.error('Error exporting audit logs:', error);
      throw error;
    }
  }
  
  /**
   * Create an audit log entry
   */
  async createAuditLog(
    eventType: string,
    userId?: number,
    clientId?: number,
    options: AuditOptions = {},
    req?: Request
  ) {
    try {
      const auditLog = {
        eventType,
        eventTime: new Date(),
        userId,
        clientId,
        ipAddress: req?.ip,
        userAgent: req?.headers['user-agent'] as string,
        requestPath: req?.path,
        requestMethod: req?.method,
        complianceRelevant: options.complianceRelevant || false,
        details: options.details
      };
      
      await db.insert(accessAuditLogs).values(auditLog);
      
      // Emit event for real-time monitoring
      if (options.complianceRelevant) {
        eventBus.emit('security.audit.compliance', { 
          eventType,
          userId,
          clientId,
          timestamp: auditLog.eventTime
        });
      }
      
      return auditLog;
    } catch (error) {
      console.error('Error creating audit log:', error);
      // Intentionally don't throw to avoid disrupting main operations
      return null;
    }
  }
  
  // INTERNAL HELPER METHODS
  
  /**
   * Generate access and refresh tokens
   */
  private async generateTokens(
    clientId: number,
    userId?: number,
    scopes: string[] = [],
    req?: Request,
    includeRefreshToken: boolean = true
  ): Promise<TokenResponse> {
    // Generate access token
    const accessToken = randomBytes(32).toString('hex');
    
    // Set expiration time
    const accessTokenExpiresAt = new Date();
    accessTokenExpiresAt.setSeconds(accessTokenExpiresAt.getSeconds() + this.accessTokenLifetime);
    
    // Store access token
    const [storedAccessToken] = await db.insert(oauthAccessTokens).values({
      accessToken,
      clientId,
      userId,
      scopes,
      expiresAt: accessTokenExpiresAt,
      createdAt: new Date()
    }).returning();
    
    // Prepare response
    const response: TokenResponse = {
      access_token: accessToken,
      token_type: 'bearer',
      expires_in: this.accessTokenLifetime,
      scope: scopes.join(' ')
    };
    
    // Generate refresh token if needed
    if (includeRefreshToken && (scopes.includes(StandardScope.OFFLINE_ACCESS) || userId)) {
      const refreshToken = randomBytes(32).toString('hex');
      
      // Set expiration time
      const refreshTokenExpiresAt = new Date();
      refreshTokenExpiresAt.setSeconds(refreshTokenExpiresAt.getSeconds() + this.refreshTokenLifetime);
      
      // Store refresh token
      await db.insert(oauthRefreshTokens).values({
        refreshToken,
        accessTokenId: storedAccessToken.id,
        clientId,
        userId,
        expiresAt: refreshTokenExpiresAt,
        createdAt: new Date()
      });
      
      response.refresh_token = refreshToken;
    }
    
    // Create audit log
    await this.createAuditLog('auth.token.issued', userId, clientId, {
      details: {
        scopes,
        tokenId: storedAccessToken.id,
        includesRefreshToken: !!response.refresh_token
      }
    }, req);
    
    return response;
  }
}

export const accessManagerService = new AccessManagerService();