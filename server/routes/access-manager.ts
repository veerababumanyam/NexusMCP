/**
 * Access Manager Admin Routes
 * Provides administrative controls for OAuth clients, certificates, tokens, 
 * and audit logs with role-based permissions
 */

import { Router, Request, Response, NextFunction } from 'express';
import { accessManagerService } from '../services/access-manager-service';
import { rbacService } from '../services/rbac-service';
import { z } from 'zod';
import { db } from '../../db';
import { eq } from 'drizzle-orm';
import { 
  oauthClients, 
  mtlsCertificates,
  oauthAccessTokens,
  oauthRefreshTokens 
} from '../../shared/schema_access';

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

// Validation schemas
const createClientSchema = z.object({
  clientName: z.string().min(3, "Client name must be at least 3 characters"),
  redirectUris: z.array(z.string().url("Must be a valid URL")).min(1, "At least one redirect URI is required"),
  grantTypes: z.array(z.enum(["authorization_code", "client_credentials", "refresh_token", "password"])).min(1, "At least one grant type is required"),
  scopes: z.array(z.string().min(1, "Scope cannot be empty")).min(1, "At least one scope is required"),
  isConfidential: z.boolean().default(true),
  isAutoApprove: z.boolean().default(false),
  metadata: z.record(z.any()).optional()
});

const updateClientSchema = z.object({
  clientName: z.string().min(3, "Client name must be at least 3 characters").optional(),
  redirectUris: z.array(z.string().url("Must be a valid URL")).min(1, "At least one redirect URI is required").optional(),
  grantTypes: z.array(z.enum(["authorization_code", "client_credentials", "refresh_token", "password"])).min(1, "At least one grant type is required").optional(),
  scopes: z.array(z.string().min(1, "Scope cannot be empty")).min(1, "At least one scope is required").optional(),
  isConfidential: z.boolean().optional(),
  isAutoApprove: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
  metadata: z.record(z.any()).optional()
});

const createCertificateSchema = z.object({
  clientId: z.string().uuid("Must be a valid UUID"),
  thumbprint: z.string().min(8, "Certificate thumbprint must be at least 8 characters"),
  subject: z.string().min(3, "Subject must be at least 3 characters"),
  issuer: z.string().min(3, "Issuer must be at least 3 characters"),
  serial: z.string().min(3, "Serial must be at least 3 characters"),
  notBefore: z.string().transform((val) => new Date(val)),
  notAfter: z.string().transform((val) => new Date(val))
});

const auditLogsFilterSchema = z.object({
  userId: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  clientId: z.string().optional().transform(val => val ? parseInt(val) : undefined),
  eventType: z.string().optional(),
  startDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  endDate: z.string().optional().transform(val => val ? new Date(val) : undefined),
  complianceOnly: z.boolean().default(false).optional(),
  limit: z.number().int().positive().max(1000).default(100).optional(),
  offset: z.number().int().nonnegative().default(0).optional()
});

const exportLogsSchema = z.object({
  startDate: z.string().transform(val => new Date(val)),
  endDate: z.string().transform(val => new Date(val)),
  format: z.enum(['json', 'csv']).default('json').optional(),
  complianceOnly: z.boolean().default(true).optional()
});

/**
 * Get all OAuth clients
 */
router.get('/clients', requireAuth, requirePermission('oauth:client:read'), async (req, res) => {
  try {
    // Get all clients from database
    const clients = await db.query.oauthClients.findMany({
      orderBy: (clients, { desc }) => [desc(clients.createdAt)]
    });
    
    // Remove sensitive data for response
    const sanitizedClients = clients.map(client => {
      const { clientSecret, ...restClient } = client;
      return {
        ...restClient,
        clientSecret: client.isConfidential ? '••••••••' : 'public-client'
      };
    });
    
    return res.json(sanitizedClients);
  } catch (error) {
    console.error('Error fetching OAuth clients:', error);
    return res.status(500).json({ error: 'Error fetching OAuth clients' });
  }
});

/**
 * Create new OAuth client
 */
router.post('/clients', requireAuth, requirePermission('oauth:client:create'), async (req, res) => {
  try {
    // Validate request
    const result = createClientSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ 
        error: 'Invalid request data',
        details: result.error.format() 
      });
    }
    
    // Create client
    const { clientName, redirectUris, grantTypes, scopes, isConfidential, isAutoApprove, metadata } = result.data;
    
    const newClient = await accessManagerService.createClient(
      clientName,
      redirectUris,
      grantTypes,
      scopes,
      isConfidential,
      req.user!.id,
      metadata
    );
    
    // Return client info (mask client secret for response)
    const { clientSecret, ...clientInfo } = newClient;
    return res.status(201).json({
      ...clientInfo,
      clientSecret: isConfidential ? '••••••••' : 'public-client'
    });
  } catch (error) {
    console.error('Error creating OAuth client:', error);
    return res.status(500).json({ error: 'Error creating OAuth client' });
  }
});

/**
 * Get single OAuth client
 */
router.get('/clients/:id', requireAuth, requirePermission('oauth:client:read'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get client from database
    const client = await accessManagerService.getClientById(id);
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    // Remove sensitive data for response
    const { clientSecret, ...clientInfo } = client;
    
    return res.json({
      ...clientInfo,
      clientSecret: client.isConfidential ? '••••••••' : 'public-client'
    });
  } catch (error) {
    console.error('Error fetching OAuth client:', error);
    return res.status(500).json({ error: 'Error fetching OAuth client' });
  }
});

/**
 * Update OAuth client
 */
router.put('/clients/:id', requireAuth, requirePermission('oauth:client:update'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate request
    const result = updateClientSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ 
        error: 'Invalid request data',
        details: result.error.format() 
      });
    }
    
    // Get client from database
    const client = await accessManagerService.getClientById(id);
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    // Update client
    const [updatedClient] = await db
      .update(oauthClients)
      .set({
        ...result.data,
        updatedAt: new Date()
      })
      .where(eq(oauthClients.clientId, id))
      .returning();
    
    if (!updatedClient) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    // Create audit log
    await accessManagerService.createAuditLog(
      'client.updated',
      req.user!.id,
      updatedClient.id,
      {
        complianceRelevant: true,
        details: {
          changes: result.data
        }
      },
      req
    );
    
    // Remove sensitive data for response
    const { clientSecret, ...clientInfo } = updatedClient;
    
    return res.json({
      ...clientInfo,
      clientSecret: updatedClient.isConfidential ? '••••••••' : 'public-client'
    });
  } catch (error) {
    console.error('Error updating OAuth client:', error);
    return res.status(500).json({ error: 'Error updating OAuth client' });
  }
});

/**
 * Delete OAuth client
 */
router.delete('/clients/:id', requireAuth, requirePermission('oauth:client:delete'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get client from database to verify it exists
    const client = await accessManagerService.getClientById(id);
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    // Get tokens for this client to delete
    const accessTokens = await db.select().from(oauthAccessTokens).where(eq(oauthAccessTokens.clientId, client.id));
    const accessTokenIds = accessTokens.map(token => token.id);
    
    // Delete in order to maintain referential integrity
    await db.delete(oauthRefreshTokens).where(eq(oauthRefreshTokens.clientId, client.id));
    await db.delete(oauthAccessTokens).where(eq(oauthAccessTokens.clientId, client.id));
    await db.delete(mtlsCertificates).where(eq(mtlsCertificates.clientId, client.id));
    
    // Finally delete the client
    await db.delete(oauthClients).where(eq(oauthClients.id, client.id));
    
    // Create audit log
    await accessManagerService.createAuditLog(
      'client.deleted',
      req.user!.id,
      undefined,
      {
        complianceRelevant: true,
        details: {
          clientId: client.clientId,
          clientName: client.clientName,
          tokensRevoked: accessTokens.length
        }
      },
      req
    );
    
    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting OAuth client:', error);
    return res.status(500).json({ error: 'Error deleting OAuth client' });
  }
});

/**
 * Regenerate client secret
 */
router.post('/clients/:id/regenerate-secret', requireAuth, requirePermission('oauth:client:update'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get client from database
    const client = await accessManagerService.getClientById(id);
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    if (!client.isConfidential) {
      return res.status(400).json({ error: 'Cannot regenerate secret for public client' });
    }
    
    // Generate new client secret
    const { randomBytes } = require('crypto');
    const newSecret = randomBytes(32).toString('hex');
    
    // Update client with new secret
    const [updatedClient] = await db
      .update(oauthClients)
      .set({
        clientSecret: newSecret,
        updatedAt: new Date()
      })
      .where(eq(oauthClients.clientId, id))
      .returning();
    
    if (!updatedClient) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    // Create audit log
    await accessManagerService.createAuditLog(
      'client.secret.regenerated',
      req.user!.id,
      updatedClient.id,
      {
        complianceRelevant: true
      },
      req
    );
    
    // Return the new client secret (only time it's shown in full)
    return res.json({
      clientId: updatedClient.clientId,
      clientSecret: newSecret
    });
  } catch (error) {
    console.error('Error regenerating client secret:', error);
    return res.status(500).json({ error: 'Error regenerating client secret' });
  }
});

/**
 * Register client certificate for mTLS
 */
router.post('/certificates', requireAuth, requirePermission('oauth:certificate:create'), async (req, res) => {
  try {
    // Validate request
    const result = createCertificateSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ 
        error: 'Invalid request data',
        details: result.error.format() 
      });
    }
    
    const { clientId, thumbprint, subject, issuer, serial, notBefore, notAfter } = result.data;
    
    // Register certificate
    const certificate = await accessManagerService.registerClientCertificate(
      clientId,
      {
        thumbprint,
        subject,
        issuer,
        serial,
        notBefore,
        notAfter
      }
    );
    
    return res.status(201).json(certificate);
  } catch (error) {
    console.error('Error registering client certificate:', error);
    return res.status(500).json({ error: 'Error registering client certificate' });
  }
});

/**
 * Get client certificates
 */
router.get('/clients/:id/certificates', requireAuth, requirePermission('oauth:certificate:read'), async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get client from database
    const client = await accessManagerService.getClientById(id);
    
    if (!client) {
      return res.status(404).json({ error: 'Client not found' });
    }
    
    // Get certificates for this client
    const certificates = await db.query.mtlsCertificates.findMany({
      where: (certs, { eq }) => eq(certs.clientId, client.id),
      orderBy: (certs, { desc }) => [desc(certs.createdAt)]
    });
    
    return res.json(certificates);
  } catch (error) {
    console.error('Error fetching client certificates:', error);
    return res.status(500).json({ error: 'Error fetching client certificates' });
  }
});

/**
 * Enable/disable client certificate
 */
router.patch('/certificates/:id', requireAuth, requirePermission('oauth:certificate:update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { isEnabled } = req.body;
    
    if (isEnabled === undefined) {
      return res.status(400).json({ error: 'isEnabled is required' });
    }
    
    // Update certificate
    const [updatedCertificate] = await db
      .update(mtlsCertificates)
      .set({
        isEnabled,
        updatedAt: new Date()
      })
      .where(eq(mtlsCertificates.id, parseInt(id)))
      .returning();
    
    if (!updatedCertificate) {
      return res.status(404).json({ error: 'Certificate not found' });
    }
    
    // Create audit log
    await accessManagerService.createAuditLog(
      isEnabled ? 'certificate.enabled' : 'certificate.disabled',
      req.user!.id,
      updatedCertificate.clientId,
      {
        complianceRelevant: true,
        details: {
          certificateId: updatedCertificate.id,
          thumbprint: updatedCertificate.certificateThumbprint
        }
      },
      req
    );
    
    return res.json(updatedCertificate);
  } catch (error) {
    console.error('Error updating client certificate:', error);
    return res.status(500).json({ error: 'Error updating client certificate' });
  }
});

/**
 * Get audit logs with filtering
 */
router.get('/audit-logs', requireAuth, requirePermission('oauth:audit:read'), async (req, res) => {
  try {
    // Validate query parameters
    const result = auditLogsFilterSchema.safeParse(req.query);
    
    if (!result.success) {
      return res.status(400).json({ 
        error: 'Invalid query parameters',
        details: result.error.format() 
      });
    }
    
    // Get audit logs
    const logs = await accessManagerService.getAuditLogs(result.data);
    
    return res.json(logs);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return res.status(500).json({ error: 'Error fetching audit logs' });
  }
});

/**
 * Export audit logs for compliance
 */
router.post('/audit-logs/export', requireAuth, requirePermission('oauth:audit:export'), async (req, res) => {
  try {
    // Validate request
    const result = exportLogsSchema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({ 
        error: 'Invalid request data',
        details: result.error.format() 
      });
    }
    
    // Export logs
    const exportResult = await accessManagerService.exportAuditLogs(result.data);
    
    // Set appropriate content type
    if (exportResult.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
      return res.send(exportResult.data);
    }
    
    return res.json(exportResult);
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    return res.status(500).json({ error: 'Error exporting audit logs' });
  }
});

/**
 * Get OAuth token usage statistics (for dashboard)
 */
router.get('/stats/token-usage', requireAuth, requirePermission('oauth:stats:read'), async (req, res) => {
  try {
    // Implementation simplified - would aggregate token usage data
    return res.status(501).json({ error: 'Not implemented' });
  } catch (error) {
    console.error('Error fetching token usage statistics:', error);
    return res.status(500).json({ error: 'Error fetching token usage statistics' });
  }
});

export default router;