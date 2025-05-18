/**
 * OAuth2 API Routes
 * Implements OAuth 2.1 endpoints for authorization, token issuance, 
 * introspection, dynamic client registration, and token management
 */

import { Router, Request, Response, NextFunction } from 'express';
import { accessManagerService, TokenResponse } from '../services/access-manager-service';
import { rbacService } from '../services/rbac-service';
import { authService } from '../services/auth-service';
import { z } from 'zod';

const router = Router();

// Authentication middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

// Permission middleware
function requirePermission(permission: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    try {
      const hasPermission = await rbacService.hasPermission(req.user.id, permission);
      if (hasPermission) {
        return next();
      } else {
        return res.status(403).json({ error: `Missing required permission: ${permission}` });
      }
    } catch (error) {
      console.error('Permission check error:', error);
      return res.status(500).json({ error: 'Error checking permissions' });
    }
  };
}

// Validate client middleware using HTTP Basic Authentication
async function validateBasicAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return res.status(401).json({
      error: 'invalid_client',
      error_description: 'Client authentication required'
    });
  }
  
  try {
    // Extract and decode credentials
    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [clientId, clientSecret] = credentials.split(':');
    
    if (!clientId || !clientSecret) {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Invalid client credentials format'
      });
    }
    
    // Get client
    const client = await accessManagerService.getClientById(clientId);
    
    if (!client) {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Unknown client'
      });
    }
    
    if (!client.isEnabled) {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Client is disabled'
      });
    }
    
    if (client.isConfidential && client.clientSecret !== clientSecret) {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Invalid client secret'
      });
    }
    
    // Attach client to request
    req.oauthClient = client;
    next();
  } catch (error) {
    console.error('Client authentication error:', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: 'An error occurred during client authentication'
    });
  }
}

// Validate request schemas
const authorizationSchema = z.object({
  response_type: z.enum(['code']),
  client_id: z.string().uuid(),
  redirect_uri: z.string().url(),
  scope: z.string().optional(),
  state: z.string().optional()
});

const tokenSchemaAuthCode = z.object({
  grant_type: z.literal('authorization_code'),
  code: z.string(),
  redirect_uri: z.string().url(),
  client_id: z.string().optional() // Optional because it might be in basic auth
});

const tokenSchemaClientCredentials = z.object({
  grant_type: z.literal('client_credentials'),
  scope: z.string().optional(),
  client_id: z.string().optional() // Optional because it might be in basic auth
});

const tokenSchemaRefreshToken = z.object({
  grant_type: z.literal('refresh_token'),
  refresh_token: z.string(),
  client_id: z.string().optional() // Optional because it might be in basic auth
});

const clientRegistrationSchema = z.object({
  client_name: z.string().min(3),
  redirect_uris: z.array(z.string().url()).min(1),
  grant_types: z.array(z.enum(['authorization_code', 'client_credentials', 'refresh_token', 'password'])).optional(),
  scope: z.string().optional(),
  token_endpoint_auth_method: z.enum(['client_secret_basic', 'client_secret_post', 'none']).optional()
});

/**
 * OAuth2 authorization endpoint
 * Renders authorization page or redirects with auth code
 */
router.get('/authorize', requireAuth, async (req, res) => {
  try {
    // Validate request parameters
    const result = authorizationSchema.safeParse(req.query);
    
    if (!result.success) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: result.error.message
      });
    }
    
    const { response_type, client_id, redirect_uri, scope, state } = result.data;
    
    // Get the client
    const client = await accessManagerService.getClientById(client_id);
    
    if (!client) {
      return res.status(400).json({
        error: 'invalid_client',
        error_description: 'Unknown client'
      });
    }
    
    if (!client.isEnabled) {
      return res.status(400).json({
        error: 'unauthorized_client',
        error_description: 'Client is disabled'
      });
    }
    
    // Validate redirect URI
    if (!client.redirectUris.includes(redirect_uri)) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Invalid redirect URI'
      });
    }
    
    // Parse requested scopes
    const requestedScopes = scope ? scope.split(' ') : [];
    
    // Automatically approve if client is configured for auto-approval
    if (client.isAutoApprove) {
      // Generate auth code
      const code = await accessManagerService.issueAuthCode(
        client_id,
        req.user!.id,
        redirect_uri,
        requestedScopes,
        req
      );
      
      // Redirect to client with auth code
      const redirectUrl = new URL(redirect_uri);
      redirectUrl.searchParams.append('code', code);
      if (state) redirectUrl.searchParams.append('state', state);
      
      return res.redirect(redirectUrl.toString());
    }
    
    // Otherwise, render consent screen
    return res.render('oauth-consent', {
      client,
      scopes: requestedScopes,
      user: req.user,
      csrf: req.csrfToken(),
      redirectUri: redirect_uri,
      responseType: response_type,
      state
    });
  } catch (error) {
    console.error('Authorization error:', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: 'An error occurred during authorization'
    });
  }
});

/**
 * OAuth2 authorization decision endpoint (post consent)
 */
router.post('/authorize/decision', requireAuth, async (req, res) => {
  try {
    const { client_id, redirect_uri, scope, approved, state } = req.body;
    
    // Verify all required params are present
    if (!client_id || !redirect_uri) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing required parameters'
      });
    }
    
    // Redirect URI for error or success
    const redirectUrl = new URL(redirect_uri);
    
    // If user denied access
    if (approved !== 'true') {
      redirectUrl.searchParams.append('error', 'access_denied');
      redirectUrl.searchParams.append('error_description', 'The user denied the request');
      if (state) redirectUrl.searchParams.append('state', state);
      return res.redirect(redirectUrl.toString());
    }
    
    // Parse scopes
    const requestedScopes = scope ? scope.split(' ') : [];
    
    // Generate auth code
    try {
      const code = await accessManagerService.issueAuthCode(
        client_id,
        req.user!.id,
        redirect_uri,
        requestedScopes,
        req
      );
      
      // Redirect to client with auth code
      redirectUrl.searchParams.append('code', code);
      if (state) redirectUrl.searchParams.append('state', state);
      
      return res.redirect(redirectUrl.toString());
    } catch (error) {
      console.error('Error issuing auth code:', error);
      redirectUrl.searchParams.append('error', 'server_error');
      redirectUrl.searchParams.append('error_description', 'Error issuing authorization code');
      if (state) redirectUrl.searchParams.append('state', state);
      return res.redirect(redirectUrl.toString());
    }
  } catch (error) {
    console.error('Authorization decision error:', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: 'An error occurred processing the authorization decision'
    });
  }
});

/**
 * OAuth2 token endpoint
 * Issues tokens for various grant types
 */
router.post('/token', async (req, res) => {
  try {
    const grantType = req.body.grant_type;
    
    if (!grantType) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'grant_type is required'
      });
    }
    
    let tokenResponse: TokenResponse;
    
    // Extract client credentials from body if not in auth header
    let clientId = req.body.client_id;
    let clientSecret = req.body.client_secret;
    
    // Check for Basic auth header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Basic ')) {
      // Extract and decode credentials
      const base64Credentials = authHeader.split(' ')[1];
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
      const [headerClientId, headerClientSecret] = credentials.split(':');
      
      // Override body params if Basic auth is provided
      if (headerClientId && headerClientSecret) {
        clientId = headerClientId;
        clientSecret = headerClientSecret;
      }
    }
    
    if (!clientId) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'client_id is required'
      });
    }
    
    // Process token request based on grant type
    switch (grantType) {
      case 'authorization_code': {
        // Validate request
        const result = tokenSchemaAuthCode.safeParse(req.body);
        
        if (!result.success) {
          return res.status(400).json({
            error: 'invalid_request',
            error_description: result.error.message
          });
        }
        
        const { code, redirect_uri } = result.data;
        
        tokenResponse = await accessManagerService.issueTokenWithAuthCode(
          code,
          clientId,
          clientSecret || '',
          redirect_uri,
          req
        );
        break;
      }
      
      case 'client_credentials': {
        // Validate request
        const result = tokenSchemaClientCredentials.safeParse(req.body);
        
        if (!result.success) {
          return res.status(400).json({
            error: 'invalid_request',
            error_description: result.error.message
          });
        }
        
        // Parse scopes
        const scopes = req.body.scope ? req.body.scope.split(' ') : [];
        
        tokenResponse = await accessManagerService.issueTokenWithClientCredentials(
          clientId,
          clientSecret || '',
          scopes,
          req
        );
        break;
      }
      
      case 'refresh_token': {
        // Validate request
        const result = tokenSchemaRefreshToken.safeParse(req.body);
        
        if (!result.success) {
          return res.status(400).json({
            error: 'invalid_request',
            error_description: result.error.message
          });
        }
        
        const { refresh_token } = result.data;
        
        tokenResponse = await accessManagerService.issueTokenWithRefreshToken(
          refresh_token,
          clientId,
          clientSecret || '',
          req
        );
        break;
      }
      
      default:
        return res.status(400).json({
          error: 'unsupported_grant_type',
          error_description: `Unsupported grant type: ${grantType}`
        });
    }
    
    return res.json(tokenResponse);
  } catch (error: any) {
    console.error('Token endpoint error:', error);
    
    return res.status(400).json({
      error: 'invalid_request',
      error_description: error.message || 'Error processing token request'
    });
  }
});

/**
 * OAuth2 token introspection endpoint (RFC 7662)
 * Validates tokens and returns metadata
 */
router.post('/introspect', validateBasicAuth, async (req, res) => {
  try {
    const { token, token_type_hint } = req.body;
    
    if (!token) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Token is required'
      });
    }
    
    // Validate token
    const tokenInfo = await accessManagerService.validateToken(token);
    
    return res.json(tokenInfo);
  } catch (error) {
    console.error('Token introspection error:', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: 'An error occurred during token introspection'
    });
  }
});

/**
 * OAuth2 token revocation endpoint (RFC 7009)
 */
router.post('/revoke', async (req, res) => {
  try {
    const { token, token_type_hint } = req.body;
    let { client_id, client_secret } = req.body;
    
    if (!token) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'Token is required'
      });
    }
    
    // Check for Basic auth header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Basic ')) {
      // Extract and decode credentials
      const base64Credentials = authHeader.split(' ')[1];
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
      const [headerClientId, headerClientSecret] = credentials.split(':');
      
      // Override body params if Basic auth is provided
      if (headerClientId && headerClientSecret) {
        client_id = headerClientId;
        client_secret = headerClientSecret;
      }
    }
    
    if (!client_id) {
      return res.status(400).json({
        error: 'invalid_request',
        error_description: 'client_id is required'
      });
    }
    
    // Revoke token
    await accessManagerService.revokeToken(
      token, 
      client_id, 
      client_secret || '', 
      token_type_hint as 'access_token' | 'refresh_token'
    );
    
    // RFC 7009 requires 200 OK with empty body on success
    return res.status(200).send();
  } catch (error) {
    console.error('Token revocation error:', error);
    return res.status(400).json({
      error: 'invalid_request',
      error_description: error.message || 'Error revoking token'
    });
  }
});

/**
 * Dynamic Client Registration endpoint (RFC 7591)
 */
router.post('/register', requireAuth, requirePermission('oauth:client:register'), async (req, res) => {
  try {
    // Validate request
    const result = clientRegistrationSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({
        error: 'invalid_client_metadata',
        error_description: result.error.message
      });
    }
    
    // Register client
    const clientInfo = await accessManagerService.registerClientDynamically(
      req.body,
      req.user!.id
    );
    
    return res.status(201).json(clientInfo);
  } catch (error) {
    console.error('Client registration error:', error);
    return res.status(500).json({
      error: 'invalid_client_metadata',
      error_description: error.message || 'Error registering client'
    });
  }
});

/**
 * Retrieve client by registration token
 */
router.get('/register/:clientId', async (req, res) => {
  // This endpoint should be secured by registration token
  // Implementation is simplified here
  return res.status(501).json({ error: 'Not implemented' });
});

/**
 * Update client by registration token
 */
router.put('/register/:clientId', async (req, res) => {
  // This endpoint should be secured by registration token
  // Implementation is simplified here
  return res.status(501).json({ error: 'Not implemented' });
});

/**
 * Delete client by registration token
 */
router.delete('/register/:clientId', async (req, res) => {
  // This endpoint should be secured by registration token
  // Implementation is simplified here
  return res.status(501).json({ error: 'Not implemented' });
});

/**
 * List registered OAuth clients for current user
 */
router.get('/clients', requireAuth, async (req, res) => {
  // Implementation simplified - should filter by current user
  return res.status(501).json({ error: 'Not implemented' });
});

export default router;