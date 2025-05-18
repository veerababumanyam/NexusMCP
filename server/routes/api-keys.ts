/**
 * API Keys Routes
 * 
 * Routes for managing API keys:
 * - Create API key
 * - List API keys
 * - Revoke API key
 * - Get API key details
 */

import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { apiKeyService } from '../services/apiKeyService';
import { createAuditLog, getApiKeyAuditLogs } from '../services/auditLogService';

// Create the router
const router = Router();

// Schema for creating a new API key
const createApiKeySchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  scopes: z.array(z.string()).min(1, 'At least one scope is required'),
  workspaceId: z.number().optional(),
  expiresAt: z.string().optional().transform(val => val ? new Date(val) : undefined)
});

/**
 * Create a new API key
 * 
 * POST /api/api-keys
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    // Ensure user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }
    
    // Validate request body
    const validationResult = createApiKeySchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validationResult.error.errors 
      });
    }
    
    const { name, scopes, workspaceId, expiresAt } = validationResult.data;

    // Check if user has permission to create keys with these scopes
    // In a real system, you'd check the user's own permissions here
    const prohibitedScopes = scopes.filter(scope => {
      // Only admins can create keys with admin scopes
      if (scope.startsWith('admin:') && req.user?.role !== 'admin') {
        return true;
      }
      return false;
    });
    
    if (prohibitedScopes.length > 0) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have permission to create API keys with the following scopes',
        prohibitedScopes
      });
    }
    
    // Create the API key
    const result = await apiKeyService.createApiKey(
      req.user.id,
      name,
      scopes,
      workspaceId,
      expiresAt
    );
    
    // Return the key (only returned once, after this the key cannot be retrieved in full)
    res.status(201).json({
      id: result.id,
      key: result.key,
      name,
      scopes,
      workspaceId,
      expiresAt,
      message: 'API key created successfully. Save this key now, it won\'t be displayed again.'
    });
  } catch (error) {
    console.error('Error creating API key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * List all API keys for the current user
 * 
 * GET /api/api-keys
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Ensure user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }
    
    // Get API keys for the user
    const keys = await apiKeyService.listApiKeys(req.user.id);
    
    // Return the keys (without the actual key values)
    res.status(200).json(keys);
  } catch (error) {
    console.error('Error listing API keys:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get API key statistics
 * 
 * GET /api/api-keys/stats
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // Ensure user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }
    
    // Get API key stats for the user
    const stats = await apiKeyService.getApiKeyStats(req.user.id);
    
    // Return the stats
    res.status(200).json(stats);
  } catch (error) {
    console.error('Error getting API key stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Revoke an API key
 * 
 * DELETE /api/api-keys/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    // Ensure user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }
    
    const keyId = parseInt(req.params.id);
    if (isNaN(keyId)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid API key ID' });
    }
    
    // Revoke the API key
    const success = await apiKeyService.revokeApiKey(keyId, req.user.id);
    
    if (!success) {
      return res.status(404).json({ 
        error: 'Not found', 
        message: 'API key not found or you do not have permission to revoke it' 
      });
    }
    
    // Return success
    res.status(200).json({ message: 'API key revoked successfully' });
  } catch (error) {
    console.error('Error revoking API key:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * List all API keys for a workspace (admin only)
 * 
 * GET /api/api-keys/workspace/:id
 */
router.get('/workspace/:id', async (req: Request, res: Response) => {
  try {
    // Ensure user is authenticated and is an admin
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
    }
    
    const workspaceId = parseInt(req.params.id);
    if (isNaN(workspaceId)) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid workspace ID' });
    }
    
    // Get API keys for the workspace
    const keys = await apiKeyService.listWorkspaceApiKeys(workspaceId);
    
    // Return the keys (without the actual key values)
    res.status(200).json(keys);
  } catch (error) {
    console.error('Error listing workspace API keys:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get audit logs for API keys 
 * 
 * GET /api/api-keys/audit-logs
 */
router.get('/audit-logs', async (req: Request, res: Response) => {
  try {
    // Ensure user is authenticated and is an admin
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Authentication required' });
    }
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden', message: 'Admin access required' });
    }
    
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    
    // Get API key audit logs
    const logs = await getApiKeyAuditLogs(limit, offset);
    
    // Return the logs
    res.status(200).json(logs);
  } catch (error) {
    console.error('Error getting API key audit logs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Get documentation for available API key scopes
 * 
 * GET /api/api-keys/scopes
 */
router.get('/scopes', async (req: Request, res: Response) => {
  // Return the available API key scopes
  const scopes = [
    {
      name: 'mcp:access',
      description: 'Access to the MCP proxy, used for tool discovery and execution',
      category: 'MCP'
    },
    {
      name: 'mcp:admin',
      description: 'Administrative access to MCP servers, allows adding/removing servers',
      category: 'MCP',
      adminOnly: true
    },
    {
      name: 'api:read',
      description: 'Read-only access to the API',
      category: 'API'
    },
    {
      name: 'api:write',
      description: 'Write access to the API',
      category: 'API'
    },
    {
      name: 'workspace:read',
      description: 'Read-only access to workspace data',
      category: 'Workspace'
    },
    {
      name: 'workspace:write',
      description: 'Write access to workspace data',
      category: 'Workspace'
    },
    {
      name: 'user:read',
      description: 'Read-only access to user data',
      category: 'User'
    },
    {
      name: 'user:write',
      description: 'Write access to user data',
      category: 'User'
    },
    {
      name: 'audit:read',
      description: 'Read-only access to audit logs',
      category: 'Audit',
      adminOnly: true
    },
    {
      name: 'admin:*',
      description: 'Full administrative access (use with caution)',
      category: 'Admin',
      adminOnly: true
    },
    {
      name: '*',
      description: 'Full access to all resources (use with extreme caution)',
      category: 'Admin',
      adminOnly: true
    }
  ];
  
  res.status(200).json(scopes);
});

export default router;