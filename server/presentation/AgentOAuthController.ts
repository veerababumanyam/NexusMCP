/**
 * Agent OAuth 2.1 Controller - Presentation Layer
 * 
 * Implements OAuth 2.1 for AI agent authentication:
 * - Dynamic client registration (RFC 7591)
 * - Token issuance & refresh (RFC 6749 with OAuth 2.1 updates)
 * - Token introspection (RFC 7662)
 * - Token revocation (RFC 7009)
 * - Scoped access control
 * 
 * @see https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1-09
 */

import { BaseController } from './BaseController';
import { Request, Response } from 'express';
import { z } from 'zod';
import { eventBus } from '../infrastructure/events/EventBus';
import { oauthAgentService } from '../services/oauth/OAuthAgentService';
import { createAuditLogFromRequest } from '../services/enhancedAuditService';

// Schema for dynamic client registration
const clientRegistrationSchema = z.object({
  agentId: z.number().int().positive(),
  client_name: z.string().min(3),
  client_uri: z.string().url().optional(),
  redirect_uris: z.array(z.string().url()).min(1),
  scope: z.string().optional(),
  contacts: z.array(z.string().email()).optional(),
  logo_uri: z.string().url().optional(),
  grant_types: z.array(z.enum(['authorization_code', 'refresh_token', 'client_credentials'])).optional(),
  token_endpoint_auth_method: z.enum(['client_secret_basic', 'client_secret_post']).optional()
});

// Schema for token request
const tokenRequestSchema = z.object({
  grant_type: z.enum(['authorization_code', 'refresh_token', 'client_credentials']),
  client_id: z.string(),
  client_secret: z.string(),
  code: z.string().optional(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
  redirect_uri: z.string().url().optional()
});

// Schema for token introspection
const tokenIntrospectionSchema = z.object({
  token: z.string(),
  token_type_hint: z.enum(['access_token', 'refresh_token']).optional()
});

// Schema for token revocation
const tokenRevocationSchema = z.object({
  token: z.string(),
  token_type_hint: z.enum(['access_token', 'refresh_token']).optional()
});

/**
 * Controller for Agent OAuth 2.1 operations
 */
export class AgentOAuthController extends BaseController {
  /**
   * Register a new OAuth client for an AI agent
   * Implements RFC 7591 - OAuth 2.0 Dynamic Client Registration
   */
  public registerClient = this.createValidatedHandler(clientRegistrationSchema, async (req, res, data) => {
    try {
      // Register the client
      const clientInfo = await oauthAgentService.registerClient(
        data.agentId,
        {
          client_name: data.client_name,
          client_uri: data.client_uri,
          redirect_uris: data.redirect_uris,
          scope: data.scope,
          contacts: data.contacts,
          logo_uri: data.logo_uri,
          grant_types: data.grant_types,
          token_endpoint_auth_method: data.token_endpoint_auth_method
        }
      );

      // Create audit log
      await createAuditLogFromRequest({
        req,
        action: 'create',
        resourceType: 'oauth_client',
        resourceId: clientInfo.client_id,
        details: {
          agentId: data.agentId,
          client_name: data.client_name
        }
      });

      return this.sendSuccess(res, clientInfo, 201);
    } catch (error) {
      return this.sendError(res, 'Failed to register OAuth client', 400, error);
    }
  });

  /**
   * Issue an OAuth token (implements OAuth 2.1 token endpoint)
   */
  public issueToken = this.createValidatedHandler(tokenRequestSchema, async (req, res, data) => {
    try {
      let scopes = data.scope ? data.scope.split(' ') : [];
      
      // Issue token based on grant type
      const tokenResponse = await oauthAgentService.issueToken(
        data.client_id,
        scopes,
        data.grant_type,
        data.grant_type === 'refresh_token' ? data.refresh_token : 
          data.grant_type === 'authorization_code' ? data.code : undefined
      );

      // Create audit log
      await createAuditLogFromRequest({
        req,
        action: 'create',
        resourceType: 'oauth_token',
        resourceId: data.client_id,
        details: {
          grant_type: data.grant_type,
          scopes
        }
      });

      return this.sendSuccess(res, tokenResponse);
    } catch (error) {
      return this.sendError(res, 'Token issuance failed', 400, error);
    }
  });

  /**
   * Introspect a token (implements RFC 7662)
   */
  public introspectToken = this.createValidatedHandler(tokenIntrospectionSchema, async (req, res, data) => {
    try {
      const introspection = await oauthAgentService.validateToken(data.token);
      
      return this.sendSuccess(res, {
        active: true,
        ...introspection
      });
    } catch (error) {
      // If token validation fails, return active=false
      return this.sendSuccess(res, {
        active: false
      });
    }
  });

  /**
   * Revoke a token (implements RFC 7009)
   */
  public revokeToken = this.createValidatedHandler(tokenRevocationSchema, async (req, res, data) => {
    try {
      const revoked = await oauthAgentService.revokeToken(
        data.token,
        data.token_type_hint
      );

      // Create audit log
      await createAuditLogFromRequest({
        req,
        action: 'revoke',
        resourceType: 'oauth_token',
        resourceId: data.token.substring(0, 8) + '...',
        details: {
          token_type_hint: data.token_type_hint
        }
      });

      return this.sendSuccess(res, { revoked });
    } catch (error) {
      // Per RFC 7009, we should return 200 OK even if token doesn't exist
      return this.sendSuccess(res, { revoked: false });
    }
  });

  /**
   * Get OAuth client information (required for OAuth 2.1 registration management)
   */
  public getClientInfo = this.createHandler(async (req: Request, res: Response) => {
    const clientId = req.params.clientId;
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!clientId) {
      return this.sendError(res, 'Client ID is required', 400);
    }
    
    if (!token) {
      return this.sendError(res, 'Registration access token is required', 401);
    }
    
    try {
      // Get client information - would need to implement this in the service
      // This is a placeholder for future implementation
      return this.sendError(res, 'Not implemented', 501);
    } catch (error) {
      return this.sendError(res, 'Failed to get client information', 400, error);
    }
  });
}

// Export singleton instance
export const agentOAuthController = new AgentOAuthController();