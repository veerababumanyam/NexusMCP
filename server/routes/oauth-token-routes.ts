/**
 * OAuth Token Rotation Routes
 * 
 * Provides API endpoints for managing token rotation policies and monitoring:
 * - Configure rotation policies for OAuth clients
 * - Manually rotate client secrets
 * - View security events and token usage statistics
 * - Configure notification settings
 */

import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth-middleware';
import { validateRequest } from '../middleware/validation-middleware';
import { OAuthTokenRotationService } from '../services/oauth/OAuthTokenRotationService';
import { z } from 'zod';

// Create router
const router = express.Router();
const tokenRotationService = new OAuthTokenRotationService();

// Schema for validating rotation policy configuration
const rotationPolicySchema = z.object({
  clientId: z.number().int().positive(),
  requireRotation: z.boolean(),
  rotationPeriodDays: z.number().int().min(1).max(365).optional(),
  rotationNotificationDays: z.number().int().min(1).max(90).optional()
});

// Schema for manual rotation
const manualRotationSchema = z.object({
  clientId: z.number().int().positive(),
  reason: z.string().optional()
});

// Schema for notification settings
const notificationSettingsSchema = z.object({
  notifyCredentialExpiry: z.boolean().optional(),
  notifySuspiciousActivity: z.boolean().optional(),
  notifyClientDisabled: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
  dashboardNotifications: z.boolean().optional(),
  webhookUrl: z.string().url().optional().nullable().or(z.literal(''))
});

// Schema for resolving security events
const resolveEventSchema = z.object({
  id: z.number().int().positive(),
  notes: z.string().optional()
});

/**
 * Configure rotation policy for a client
 * POST /api/oauth/token-rotation/policy
 */
router.post('/policy', requireAuth, requireAdmin, validateRequest(rotationPolicySchema), async (req, res) => {
  try {
    const { clientId, requireRotation, rotationPeriodDays, rotationNotificationDays } = req.body;
    
    const result = await tokenRotationService.configureRotationPolicy(
      clientId,
      {
        requireRotation,
        rotationPeriodDays,
        rotationNotificationDays
      },
      req.user.id
    );
    
    res.json(result);
  } catch (error) {
    console.error('Error configuring rotation policy:', error);
    res.status(500).json({ error: error.message || 'Failed to configure rotation policy' });
  }
});

/**
 * Manually rotate a client secret
 * POST /api/oauth/token-rotation/rotate
 */
router.post('/rotate', requireAuth, requireAdmin, validateRequest(manualRotationSchema), async (req, res) => {
  try {
    const { clientId, reason } = req.body;
    
    const result = await tokenRotationService.rotateClientSecret(clientId, req.user.id, reason);
    
    res.json({
      message: 'Client secret rotated successfully',
      clientId,
      secretLastRotatedAt: new Date(),
      // Note: We only return the new secret once during rotation
      clientSecret: result.clientSecret
    });
  } catch (error) {
    console.error('Error rotating client secret:', error);
    res.status(500).json({ error: error.message || 'Failed to rotate client secret' });
  }
});

/**
 * Get security events for a client
 * GET /api/oauth/token-rotation/clients/:clientId/events
 */
router.get('/clients/:clientId/events', requireAuth, requireAdmin, async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    
    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    
    // Parse query parameters
    const limit = parseInt(req.query.limit as string) || 100;
    const offset = parseInt(req.query.offset as string) || 0;
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const severity = req.query.severity as string;
    const eventType = req.query.eventType as string;
    const includeResolved = req.query.includeResolved === 'true';
    
    const events = await tokenRotationService.getSecurityEvents(clientId, {
      limit,
      offset,
      startDate,
      endDate,
      severity,
      eventType,
      includeResolved
    });
    
    res.json(events);
  } catch (error) {
    console.error('Error fetching security events:', error);
    res.status(500).json({ error: 'Failed to fetch security events' });
  }
});

/**
 * Resolve a security event
 * POST /api/oauth/token-rotation/events/resolve
 */
router.post('/events/resolve', requireAuth, requireAdmin, validateRequest(resolveEventSchema), async (req, res) => {
  try {
    const { id, notes } = req.body;
    
    const result = await tokenRotationService.resolveSecurityEvent(id, req.user.id, notes);
    
    res.json(result);
  } catch (error) {
    console.error('Error resolving security event:', error);
    res.status(500).json({ error: error.message || 'Failed to resolve security event' });
  }
});

/**
 * Get token usage statistics for a client
 * GET /api/oauth/token-rotation/clients/:clientId/usage
 */
router.get('/clients/:clientId/usage', requireAuth, requireAdmin, async (req, res) => {
  try {
    const clientId = parseInt(req.params.clientId);
    
    if (isNaN(clientId)) {
      return res.status(400).json({ error: 'Invalid client ID' });
    }
    
    // Parse query parameters
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    
    const stats = await tokenRotationService.getTokenUsageStats(clientId, {
      startDate,
      endDate
    });
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching token usage statistics:', error);
    res.status(500).json({ error: 'Failed to fetch token usage statistics' });
  }
});

/**
 * Configure notification settings
 * POST /api/oauth/token-rotation/notifications
 */
router.post('/notifications', requireAuth, validateRequest(notificationSettingsSchema), async (req, res) => {
  try {
    const settings = req.body;
    
    const result = await tokenRotationService.configureNotificationSettings(req.user.id, settings);
    
    res.json(result);
  } catch (error) {
    console.error('Error configuring notification settings:', error);
    res.status(500).json({ error: error.message || 'Failed to configure notification settings' });
  }
});

/**
 * Check for expiring credentials
 * GET /api/oauth/token-rotation/check-expiring
 */
router.get('/check-expiring', requireAuth, requireAdmin, async (req, res) => {
  try {
    const result = await tokenRotationService.checkExpiringCredentials();
    
    res.json(result);
  } catch (error) {
    console.error('Error checking expiring credentials:', error);
    res.status(500).json({ error: error.message || 'Failed to check expiring credentials' });
  }
});

export default router;