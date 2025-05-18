/**
 * OAuth Controller - Presentation Layer
 * 
 * Handles OAuth authentication flows and provider management
 * Implements:
 * - OAuth 2.0 (RFC 6749)
 * - OpenID Connect 1.0
 * - PKCE (RFC 7636)
 */

import { BaseController } from './BaseController';
import { oauthService } from '../application/auth/OAuthService';
import { Request, Response } from 'express';
import { z } from 'zod';
import { eventBus } from '../infrastructure/events/EventBus';
import * as schema from '@shared/schema';

// Schema for OAuth authorization
const oauthAuthorizeSchema = z.object({
  providerId: z.coerce.number().int().positive(),
  redirectUri: z.string().url(),
  responseType: z.enum(['code', 'token']).default('code').optional(),
  scope: z.string().optional(),
  state: z.string().optional(),
  codeChallenge: z.string().optional(),
  codeChallengeMethod: z.enum(['plain', 'S256']).optional(),
  nonce: z.string().optional(),
  prompt: z.enum(['none', 'login', 'consent', 'select_account']).optional(),
  customParams: z.record(z.string()).optional()
});

// Schema for OAuth callback
const oauthCallbackSchema = z.object({
  providerId: z.coerce.number().int().positive(),
  code: z.string(),
  state: z.string().optional(),
  redirectUri: z.string().url(),
  codeVerifier: z.string().optional()
});

/**
 * Controller for OAuth operations
 */
export class OAuthController extends BaseController {
  /**
   * List available OAuth providers
   */
  public listProviders = this.createHandler(async (req: Request, res: Response) => {
    try {
      const providers = await oauthService.getOAuthProviders();
      return this.sendSuccess(res, { providers });
    } catch (error) {
      return this.sendError(res, 'Failed to list OAuth providers', 500, error);
    }
  });

  /**
   * Generate an OAuth authorization URL
   */
  public authorize = this.createValidatedHandler(oauthAuthorizeSchema, async (req, res, data) => {
    try {
      const authUrl = await oauthService.createAuthorizationUrl(
        data.providerId,
        data.redirectUri,
        {
          responseType: data.responseType,
          scope: data.scope,
          state: data.state,
          codeChallenge: data.codeChallenge,
          codeChallengeMethod: data.codeChallengeMethod,
          nonce: data.nonce,
          prompt: data.prompt,
          customParams: data.customParams
        }
      );
      
      // Log event for audit trail
      eventBus.publish('oauth.authorize', {
        providerId: data.providerId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      }, {
        source: 'OAuthController',
        userId: req.user?.id,
      });
      
      return this.sendSuccess(res, { authUrl });
    } catch (error) {
      return this.sendError(res, 'Failed to create authorization URL', 400, error);
    }
  });

  /**
   * Handle OAuth callback and exchange code for token
   */
  public callback = this.createValidatedHandler(oauthCallbackSchema, async (req, res, data) => {
    try {
      // Exchange the authorization code for tokens
      const tokens = await oauthService.exchangeCodeForToken(
        data.providerId,
        data.code,
        data.redirectUri,
        data.codeVerifier
      );
      
      // Fetch user info using the access token
      const userInfo = await oauthService.fetchUserInfo(
        data.providerId,
        tokens.access_token
      );
      
      // Create or update user in our system
      const user = await oauthService.createOrUpdateUserFromOAuth(
        data.providerId,
        userInfo,
        {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresIn: tokens.expires_in
        }
      );
      
      // Log the user in
      req.login(user, (err) => {
        if (err) {
          return this.sendError(res, 'Failed to log in user', 500, err);
        }
        
        // Log event for audit trail
        eventBus.publish('oauth.login', {
          providerId: data.providerId,
          externalId: userInfo.sub,
          ip: req.ip,
          userAgent: req.headers['user-agent']
        }, {
          source: 'OAuthController',
          userId: user.id
        });
        
        return this.sendSuccess(res, { user });
      });
    } catch (error) {
      return this.sendError(res, 'OAuth callback failed', 400, error);
    }
  });

  /**
   * Generate PKCE code verifier and challenge
   */
  public generatePkce = this.createHandler(async (req: Request, res: Response) => {
    const codeVerifier = oauthService.generateCodeVerifier();
    const codeChallenge = oauthService.generateCodeChallenge(codeVerifier);
    
    return this.sendSuccess(res, {
      codeVerifier,
      codeChallenge,
      codeChallengeMethod: 'S256'
    });
  });

  /**
   * Get information about a specific OAuth provider
   */
  public getProvider = this.createHandler(async (req: Request, res: Response) => {
    const providerId = parseInt(req.params.id);
    
    if (isNaN(providerId)) {
      return this.sendError(res, 'Invalid provider ID', 400);
    }
    
    try {
      const provider = await oauthService.getOAuthProvider(providerId);
      
      if (!provider) {
        return this.sendError(res, 'OAuth provider not found', 404);
      }
      
      // Remove sensitive data
      const { clientSecret, ...safeProvider } = provider;
      
      return this.sendSuccess(res, { provider: safeProvider });
    } catch (error) {
      return this.sendError(res, 'Failed to get OAuth provider', 500, error);
    }
  });
}

// Export singleton instance
export const oauthController = new OAuthController();