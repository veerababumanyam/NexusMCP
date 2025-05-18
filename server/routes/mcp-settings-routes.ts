/**
 * MCP Settings Routes
 * 
 * API routes for managing global MCP server settings:
 * - /api/mcp-servers/settings/security: Security policies (TLS, OAuth, API keys, IP filtering)
 * - /api/mcp-servers/settings/connection: Connection parameters (timeouts, retries, circuit breaking)
 * - /api/mcp-servers/settings/resource: Resource allocation (request limits, load balancing)
 * - /api/mcp-servers/settings/advanced: Advanced settings (logging, compression, buffering)
 */

import { Router } from 'express';
import { McpSettingsService } from '../services/mcp-settings-service';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { createAuditLog } from '../services/auditLogService';

// Input validation schemas
const securitySettingsSchema = z.object({
  enforceTls: z.boolean().default(true),
  apiKeyRotationDays: z.number().min(1).max(365).default(90),
  enforceOAuth: z.boolean().default(false),
  allowedAuthMethods: z.array(z.string()).default(["api_key", "oauth", "basic"]),
  ipAllowList: z.string().default(""),
  ipDenyList: z.string().default(""),
  enforceIpFilter: z.boolean().default(false),
});

const connectionSettingsSchema = z.object({
  maxConnectionsPerServer: z.number().min(1).max(1000).default(100),
  connectionTimeoutSeconds: z.number().min(5).max(300).default(30),
  retryAttemptsOnFailure: z.number().min(0).max(10).default(3),
  retryDelaySeconds: z.number().min(1).max(60).default(5),
  enableCircuitBreaker: z.boolean().default(true),
  monitorHeartbeatIntervalSeconds: z.number().min(5).max(300).default(60),
});

const resourceSettingsSchema = z.object({
  maxConcurrentRequests: z.number().min(1).max(1000).default(50),
  requestTimeoutSeconds: z.number().min(1).max(300).default(30),
  maxRequestSizeKb: z.number().min(1).max(10240).default(1024),
  enableLoadBalancing: z.boolean().default(true),
  loadBalancingStrategy: z.enum(["round_robin", "least_connections", "weighted"]).default("least_connections"),
});

const advancedSettingsSchema = z.object({
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  enableRequestCompression: z.boolean().default(true),
  enableResponseCompression: z.boolean().default(true),
  proxyBufferSizeKb: z.number().min(4).max(1024).default(64),
  enableTelemetry: z.boolean().default(true),
  telemetryInterval: z.number().min(10).max(3600).default(60),
});

export function registerMcpSettingsRoutes(router: Router, settingsService: McpSettingsService) {
  /**
   * Get security settings
   * GET /api/mcp-servers/settings/security
   */
  router.get('/mcp-servers/settings/security', async (req, res) => {
    try {
      const settings = await settingsService.getSecuritySettings();
      res.json(settings);
    } catch (error) {
      logger.error('Error getting security settings:', error);
      res.status(500).json({ error: 'Failed to get security settings' });
    }
  });

  /**
   * Update security settings
   * PUT /api/mcp-servers/settings/security
   */
  router.put('/mcp-servers/settings/security', async (req, res) => {
    try {
      const settings = securitySettingsSchema.parse(req.body);
      const updatedSettings = await settingsService.updateSecuritySettings(settings);
      
      // Create audit log for security settings change
      if (req.user) {
        await createAuditLog({
          userId: req.user.id,
          action: 'mcp_settings_update',
          resourceType: 'settings',
          resourceId: 'security',
          details: {
            settings: updatedSettings
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          source: 'web'
        });
      }
      
      res.json(updatedSettings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid security settings', details: error.errors });
      }
      
      logger.error('Error updating security settings:', error);
      res.status(500).json({ error: 'Failed to update security settings' });
    }
  });

  /**
   * Get connection settings
   * GET /api/mcp-servers/settings/connection
   */
  router.get('/mcp-servers/settings/connection', async (req, res) => {
    try {
      const settings = await settingsService.getConnectionSettings();
      res.json(settings);
    } catch (error) {
      logger.error('Error getting connection settings:', error);
      res.status(500).json({ error: 'Failed to get connection settings' });
    }
  });

  /**
   * Update connection settings
   * PUT /api/mcp-servers/settings/connection
   */
  router.put('/mcp-servers/settings/connection', async (req, res) => {
    try {
      const settings = connectionSettingsSchema.parse(req.body);
      const updatedSettings = await settingsService.updateConnectionSettings(settings);
      
      // Create audit log for connection settings change
      if (req.user) {
        await createAuditLog(req, 'mcp_settings_update', {
          type: 'connection',
          settings: updatedSettings
        });
      }
      
      res.json(updatedSettings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid connection settings', details: error.errors });
      }
      
      logger.error('Error updating connection settings:', error);
      res.status(500).json({ error: 'Failed to update connection settings' });
    }
  });

  /**
   * Get resource settings
   * GET /api/mcp-servers/settings/resource
   */
  router.get('/mcp-servers/settings/resource', async (req, res) => {
    try {
      const settings = await settingsService.getResourceSettings();
      res.json(settings);
    } catch (error) {
      logger.error('Error getting resource settings:', error);
      res.status(500).json({ error: 'Failed to get resource settings' });
    }
  });

  /**
   * Update resource settings
   * PUT /api/mcp-servers/settings/resource
   */
  router.put('/mcp-servers/settings/resource', async (req, res) => {
    try {
      const settings = resourceSettingsSchema.parse(req.body);
      const updatedSettings = await settingsService.updateResourceSettings(settings);
      
      // Create audit log for resource settings change
      if (req.user) {
        await createAuditLog(req, 'mcp_settings_update', {
          type: 'resource',
          settings: updatedSettings
        });
      }
      
      res.json(updatedSettings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid resource settings', details: error.errors });
      }
      
      logger.error('Error updating resource settings:', error);
      res.status(500).json({ error: 'Failed to update resource settings' });
    }
  });

  /**
   * Get advanced settings
   * GET /api/mcp-servers/settings/advanced
   */
  router.get('/mcp-servers/settings/advanced', async (req, res) => {
    try {
      const settings = await settingsService.getAdvancedSettings();
      res.json(settings);
    } catch (error) {
      logger.error('Error getting advanced settings:', error);
      res.status(500).json({ error: 'Failed to get advanced settings' });
    }
  });

  /**
   * Update advanced settings
   * PUT /api/mcp-servers/settings/advanced
   */
  router.put('/mcp-servers/settings/advanced', async (req, res) => {
    try {
      const settings = advancedSettingsSchema.parse(req.body);
      const updatedSettings = await settingsService.updateAdvancedSettings(settings);
      
      // Create audit log for advanced settings change
      if (req.user) {
        await createAuditLog(req, 'mcp_settings_update', {
          type: 'advanced',
          settings: updatedSettings
        });
      }
      
      res.json(updatedSettings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Invalid advanced settings', details: error.errors });
      }
      
      logger.error('Error updating advanced settings:', error);
      res.status(500).json({ error: 'Failed to update advanced settings' });
    }
  });
}

/**
 * Create an audit log entry for settings changes
 */
async function createAuditLog(req: any, action: string, data: any) {
  try {
    const userId = req.user?.id;
    if (!userId) return;
    
    // Import audit logging function
    const { createAuditEntry } = require('../services/audit-service');
    
    // Create audit log entry
    await createAuditEntry({
      userId,
      action,
      resourceType: 'mcp_settings',
      resourceId: data.type,
      data,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });
  } catch (error) {
    logger.error('Error creating audit log for settings change:', error);
  }
}