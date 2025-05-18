/**
 * OAuth 2.0 API Routes
 * 
 * Implements OAuth 2.0 endpoints for:
 * - Client registration and management
 * - Token issuance using the Client Credentials flow
 * - Token validation
 * - Token revocation
 */

import { Router, Request, Response } from 'express';
import { OAuth2ClientCredentialsService } from '../services/oauth/OAuth2ClientCredentialsService';
import * as schema from '@shared/schema_oauth';
import { z } from 'zod';

const router = Router();
const oauthService = new OAuth2ClientCredentialsService();

/**
 * Register a new OAuth client
 * POST /api/oauth/clients
 */
router.post('/clients', async (req: Request, res: Response) => {
  try {
    // Authenticate request
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Validate request body
    try {
      schema.oauthClientSchema.parse(req.body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request', details: error.errors });
      }
      throw error;
    }
    
    // Add the authenticated user ID as the creator
    const clientData = {
      ...req.body,
      createdBy: req.user?.id
    };
    
    // Register the client
    const client = await oauthService.registerClient(clientData);
    
    return res.status(201).json(client);
  } catch (error) {
    console.error('Error registering OAuth client:', error);
    return res.status(500).json({ 
      error: 'Failed to register client',
      message: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

/**
 * Get all OAuth clients
 * GET /api/oauth/clients
 */
router.get('/clients', async (req: Request, res: Response) => {
  try {
    // Authenticate request
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Extract workspace ID from query params if present
    const workspaceId = req.query.workspace_id ? 
      parseInt(req.query.workspace_id as string) : undefined;
    
    // Get clients
    const clients = await oauthService.listClients(workspaceId);
    
    return res.status(200).json(clients);
  } catch (error) {
    console.error('Error getting OAuth clients:', error);
    return res.status(500).json({ 
      error: 'Failed to get clients',
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * Get a specific OAuth client
 * GET /api/oauth/clients/:id
 */
router.get('/clients/:id', async (req: Request, res: Response) => {
  try {
    // Authenticate request
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const clientId = parseInt(req.params.id);
    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    
    // Get client
    const client = await oauthService.getClientById(clientId);
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    return res.status(200).json(client);
  } catch (error) {
    console.error('Error getting OAuth client:', error);
    return res.status(500).json({
      error: 'Failed to get client',
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * Update an OAuth client
 * PATCH /api/oauth/clients/:id
 */
router.patch('/clients/:id', async (req: Request, res: Response) => {
  try {
    // Authenticate request
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const clientId = parseInt(req.params.id);
    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    
    // Update client
    const client = await oauthService.updateClient(clientId, req.body);
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    return res.status(200).json(client);
  } catch (error) {
    console.error('Error updating OAuth client:', error);
    return res.status(500).json({
      error: 'Failed to update client',
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * Delete an OAuth client
 * DELETE /api/oauth/clients/:id
 */
router.delete('/clients/:id', async (req: Request, res: Response) => {
  try {
    // Authenticate request
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const clientId = parseInt(req.params.id);
    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    
    // Delete client
    const success = await oauthService.deleteClient(clientId);
    
    if (!success) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    return res.status(204).end();
  } catch (error) {
    console.error('Error deleting OAuth client:', error);
    return res.status(500).json({
      error: 'Failed to delete client',
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * Enable or disable an OAuth client
 * PATCH /api/oauth/clients/:id/status
 */
router.patch('/clients/:id/status', async (req: Request, res: Response) => {
  try {
    // Authenticate request
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const clientId = parseInt(req.params.id);
    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    
    // Validate request body
    const statusSchema = z.object({
      enabled: z.boolean()
    });
    
    try {
      statusSchema.parse(req.body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid request', details: error.errors });
      }
      throw error;
    }
    
    // Update client status
    const success = await oauthService.setClientStatus(clientId, req.body.enabled);
    
    if (!success) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    return res.status(200).json({ status: req.body.enabled ? 'enabled' : 'disabled' });
  } catch (error) {
    console.error('Error updating OAuth client status:', error);
    return res.status(500).json({
      error: 'Failed to update client status',
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * Revoke all tokens for a client
 * POST /api/oauth/clients/:id/revoke-tokens
 */
router.post('/clients/:id/revoke-tokens', async (req: Request, res: Response) => {
  try {
    // Authenticate request
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const clientId = parseInt(req.params.id);
    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    
    // Revoke tokens
    const count = await oauthService.revokeClientTokens(clientId);
    
    return res.status(200).json({ revoked: count });
  } catch (error) {
    console.error('Error revoking client tokens:', error);
    return res.status(500).json({
      error: 'Failed to revoke tokens',
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
});

/**
 * OAuth 2.0 Token Endpoint
 * POST /api/oauth/token
 * 
 * This endpoint implements the OAuth 2.0 token issuance for the Client Credentials flow.
 * It does not require authentication as clients will authenticate with their client ID and secret.
 */
router.post('/token', async (req: Request, res: Response) => {
  try {
    // Validate token request
    try {
      schema.tokenRequestSchema.parse(req.body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'invalid_request',
          error_description: 'Invalid request parameters'
        });
      }
      throw error;
    }
    
    // Only support client_credentials grant type
    if (req.body.grant_type !== 'client_credentials') {
      return res.status(400).json({
        error: 'unsupported_grant_type',
        error_description: 'Only client_credentials grant type is supported'
      });
    }
    
    // Issue token
    const token = await oauthService.issueToken(
      req.body.client_id,
      req.body.client_secret,
      req.body.scope
    );
    
    if (!token) {
      return res.status(401).json({
        error: 'invalid_client',
        error_description: 'Invalid client credentials'
      });
    }
    
    return res.status(200).json(token);
  } catch (error) {
    console.error('Error issuing token:', error);
    return res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error'
    });
  }
});

/**
 * Token Introspection Endpoint
 * POST /api/oauth/introspect
 * 
 * Allows clients to validate tokens and get information about them
 */
router.post('/introspect', async (req: Request, res: Response) => {
  try {
    // Validate request
    const introspectionSchema = z.object({
      token: z.string()
    });
    
    try {
      introspectionSchema.parse(req.body);
    } catch (error) {
      return res.status(400).json({ 
        active: false,
        error: 'invalid_request'
      });
    }
    
    // Validate token
    const tokenInfo = await oauthService.validateToken(req.body.token);
    
    if (!tokenInfo) {
      return res.status(200).json({ active: false });
    }
    
    // Return token info
    return res.status(200).json({
      active: true,
      client_id: tokenInfo.clientId,
      scope: tokenInfo.scopes.join(' '),
      exp: Math.floor(Date.now() / 1000) + 3600 // Example expiry
    });
  } catch (error) {
    console.error('Error introspecting token:', error);
    return res.status(500).json({
      active: false,
      error: 'server_error'
    });
  }
});

/**
 * Token Revocation Endpoint
 * POST /api/oauth/revoke
 * 
 * Allows clients to revoke their tokens
 */
router.post('/revoke', async (req: Request, res: Response) => {
  try {
    // Validate request
    const revocationSchema = z.object({
      token: z.string(),
      client_id: z.string(),
      client_secret: z.string()
    });
    
    try {
      revocationSchema.parse(req.body);
    } catch (error) {
      return res.status(400).json({ 
        error: 'invalid_request'
      });
    }
    
    // Authenticate client
    const client = await oauthService.getClientByClientId(req.body.client_id);
    
    if (!client || client.clientSecret !== req.body.client_secret) {
      return res.status(401).json({
        error: 'invalid_client'
      });
    }
    
    // Revoke token
    await oauthService.revokeToken(req.body.token);
    
    // Always return success, even if token wasn't found (RFC 7009)
    return res.status(200).end();
  } catch (error) {
    console.error('Error revoking token:', error);
    return res.status(500).json({
      error: 'server_error'
    });
  }
});

// Export router
export default router;