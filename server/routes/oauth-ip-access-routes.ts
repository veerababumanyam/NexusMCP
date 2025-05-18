/**
 * OAuth IP Access Control Routes
 * 
 * Provides API endpoints for managing IP-based access control for OAuth2 clients:
 * - Add/remove IPs from allowlists
 * - Configure time-based restrictions
 * - View access logs
 * - Configure auto-revocation settings
 */

import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth-middleware';
import { validateRequest } from '../middleware/validation-middleware';
import { OAuthIpAccessControlService } from '../services/oauth/OAuthIpAccessControlService';
import { EventBus } from '../infrastructure/events/EventBus';
import { oauthIpAllowlistInsertSchema } from '@shared/schema_oauth_ip';
import { z } from 'zod';

// Create router
const router = express.Router();
const eventBus = new EventBus();
const oauthIpAccessService = new OAuthIpAccessControlService(eventBus);

// Schema for validating IP addition request
const addIpSchema = z.object({
  clientId: z.number().int().positive(),
  ipAddress: z.string().regex(/^(?:[0-9]{1,3}\.){3}[0-9]{1,3}(\/[0-9]{1,2})?$/, 'Must be a valid IPv4 address or CIDR notation'),
  description: z.string().optional()
});

// Schema for validating time window addition request
const addTimeWindowSchema = z.object({
  clientId: z.number().int().positive(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, 'Must be in format HH:MM:SS'),
  endTime: z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]$/, 'Must be in format HH:MM:SS'),
  description: z.string().optional()
}).refine(data => data.startTime < data.endTime, {
  message: "Start time must be before end time",
  path: ["endTime"]
});

// Schema for auto-revocation settings
const autoRevocationSchema = z.object({
  clientId: z.number().int().positive(),
  autoRevoke: z.boolean(),
  maxViolations: z.number().int().positive().optional()
});

/**
 * Get all IP allowlist entries for a client
 * GET /api/oauth/ip-access/clients/:clientId/allowlist
 */
router.get('/clients/:clientId/allowlist', requireAuth, requireAdmin, async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    
    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    
    const allowlist = await oauthIpAccessService.getAllowlistByClientId(clientId);
    res.json(allowlist);
  } catch (error) {
    console.error('Error fetching IP allowlist:', error);
    res.status(500).json({ error: 'Failed to fetch IP allowlist' });
  }
});

/**
 * Add IP to allowlist
 * POST /api/oauth/ip-access/allowlist
 */
router.post('/allowlist', requireAuth, requireAdmin, validateRequest(addIpSchema), async (req, res) => {
  try {
    const { clientId, ipAddress, description } = req.body;
    
    const result = await oauthIpAccessService.addIpToAllowlist({
      clientId,
      ipAddress,
      description,
      createdBy: req.user.id
    });
    
    res.status(201).json(result);
  } catch (error) {
    console.error('Error adding IP to allowlist:', error);
    res.status(500).json({ error: error.message || 'Failed to add IP to allowlist' });
  }
});

/**
 * Remove IP from allowlist
 * DELETE /api/oauth/ip-access/allowlist/:id
 */
router.delete('/allowlist/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid allowlist entry ID' });
    }
    
    const result = await oauthIpAccessService.removeIpFromAllowlist(id, req.user.id);
    res.json(result);
  } catch (error) {
    console.error('Error removing IP from allowlist:', error);
    res.status(500).json({ error: error.message || 'Failed to remove IP from allowlist' });
  }
});

/**
 * Get all time restrictions for a client
 * GET /api/oauth/ip-access/clients/:clientId/time-restrictions
 */
router.get('/clients/:clientId/time-restrictions', requireAuth, requireAdmin, async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    
    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    
    const timeRestrictions = await oauthIpAccessService.getTimeRestrictionsByClientId(clientId);
    res.json(timeRestrictions);
  } catch (error) {
    console.error('Error fetching time restrictions:', error);
    res.status(500).json({ error: 'Failed to fetch time restrictions' });
  }
});

/**
 * Add time restriction
 * POST /api/oauth/ip-access/time-restrictions
 */
router.post('/time-restrictions', requireAuth, requireAdmin, validateRequest(addTimeWindowSchema), async (req, res) => {
  try {
    const { clientId, dayOfWeek, startTime, endTime, description } = req.body;
    
    const result = await oauthIpAccessService.addTimeRestriction({
      clientId,
      dayOfWeek,
      startTime,
      endTime,
      description,
      createdBy: req.user.id
    });
    
    res.status(201).json(result);
  } catch (error) {
    console.error('Error adding time restriction:', error);
    res.status(500).json({ error: error.message || 'Failed to add time restriction' });
  }
});

/**
 * Remove time restriction
 * DELETE /api/oauth/ip-access/time-restrictions/:id
 */
router.delete('/time-restrictions/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid time restriction ID' });
    }
    
    const result = await oauthIpAccessService.removeTimeRestriction(id, req.user.id);
    res.json(result);
  } catch (error) {
    console.error('Error removing time restriction:', error);
    res.status(500).json({ error: error.message || 'Failed to remove time restriction' });
  }
});

/**
 * Get access logs for a client
 * GET /api/oauth/ip-access/clients/:clientId/logs
 */
router.get('/clients/:clientId/logs', requireAuth, requireAdmin, async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    
    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    
    // Parse query parameters for filtering
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const accessStatus = req.query.status as string;
    
    const logs = await oauthIpAccessService.getAccessLogs(clientId, {
      limit,
      offset,
      startDate,
      endDate,
      accessStatus
    });
    
    res.json(logs);
  } catch (error) {
    console.error('Error fetching access logs:', error);
    res.status(500).json({ error: 'Failed to fetch access logs' });
  }
});

/**
 * Toggle IP access control for a client
 * POST /api/oauth/ip-access/clients/:clientId/toggle-ip-control
 */
router.post('/clients/:clientId/toggle-ip-control', requireAuth, requireAdmin, async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    
    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    
    const { enforce } = req.body;
    
    if (typeof enforce !== 'boolean') {
      return res.status(400).json({ error: 'Enforce parameter must be a boolean' });
    }
    
    const result = await oauthIpAccessService.toggleIpAccessControl(clientId, enforce, req.user.id);
    res.json(result);
  } catch (error) {
    console.error('Error toggling IP access control:', error);
    res.status(500).json({ error: error.message || 'Failed to toggle IP access control' });
  }
});

/**
 * Toggle time access control for a client
 * POST /api/oauth/ip-access/clients/:clientId/toggle-time-control
 */
router.post('/clients/:clientId/toggle-time-control', requireAuth, requireAdmin, async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    
    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    
    const { enforce } = req.body;
    
    if (typeof enforce !== 'boolean') {
      return res.status(400).json({ error: 'Enforce parameter must be a boolean' });
    }
    
    const result = await oauthIpAccessService.toggleTimeAccessControl(clientId, enforce, req.user.id);
    res.json(result);
  } catch (error) {
    console.error('Error toggling time access control:', error);
    res.status(500).json({ error: error.message || 'Failed to toggle time access control' });
  }
});

/**
 * Configure auto-revocation settings
 * POST /api/oauth/ip-access/clients/:clientId/auto-revocation
 */
router.post('/clients/:clientId/auto-revocation', requireAuth, requireAdmin, validateRequest(autoRevocationSchema), async (req, res) => {
  try {
    const { clientId, autoRevoke, maxViolations } = req.body;
    
    const result = await oauthIpAccessService.configureAutoRevocation(
      clientId,
      {
        autoRevoke,
        maxViolations
      },
      req.user.id
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error configuring auto-revocation:', error);
    res.status(500).json({ error: error.message || 'Failed to configure auto-revocation' });
  }
});

/**
 * Reset violation count for a client
 * POST /api/oauth/ip-access/clients/:clientId/reset-violations
 */
router.post('/clients/:clientId/reset-violations', requireAuth, requireAdmin, async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    
    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    
    const result = await oauthIpAccessService.resetViolationCount(clientId, req.user.id);
    res.json(result);
  } catch (error) {
    console.error('Error resetting violation count:', error);
    res.status(500).json({ error: error.message || 'Failed to reset violation count' });
  }
});

export default router;