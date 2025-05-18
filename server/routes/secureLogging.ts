/**
 * Secure Session Logging Routes
 * 
 * Enterprise-grade API endpoints for:
 * - Session logging and tracking
 * - Compliance reporting
 * - Real-time analytics
 * - Audit data access
 */

import { Request, Response, Router } from 'express';
import { secureSessionLoggingService } from '../services/secureSessionLoggingService';
import { z } from 'zod';
import { enhancedAuditService } from '../services/enhancedAuditService';
import { rateLimitService, RateLimitType, RateLimitStrategy } from '../services/rateLimitService';
import { db } from '../db';
import { auditIntegrityChecks, auditLogArchives } from '@shared/schema_audit';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * Rate limit middleware for logging API
 */
const loggingRateLimit = rateLimitService.createRateLimiter({
  type: RateLimitType.API,
  strategy: RateLimitStrategy.SLIDING_WINDOW,
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 requests per minute
  keyGenerator: (req) => `session-logging-${req.ip}`
});

/**
 * Start a new MCP session
 * POST /api/logging/sessions
 */
router.post('/sessions', loggingRateLimit, async (req: Request, res: Response) => {
  try {
    const schema = z.object({
      userId: z.number().optional(),
      agentId: z.string().optional(),
      workspaceId: z.number().optional(),
      serverId: z.number().optional(),
      clientType: z.enum(['app', 'browser', 'api', 'agent']),
      clientVersion: z.string().optional(),
      deviceId: z.string().optional(),
      timeZone: z.string().optional(),
      geoLocation: z.object({
        country: z.string().optional(),
        region: z.string().optional(),
        city: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional()
      }).optional(),
      dataSharingConsent: z.boolean().optional(),
      classification: z.enum(['standard', 'sensitive', 'confidential', 'restricted']).optional(),
      complianceContext: z.record(z.any()).optional(),
      tags: z.array(z.string()).optional(),
      appContext: z.record(z.any()).optional(),
      correlationId: z.string().optional(),
      isSystemGenerated: z.boolean().optional()
    });
    
    const data = schema.parse(req.body);
    
    // Add client IP and user agent from request
    const sessionData = {
      ...data,
      clientIp: req.ip,
      userAgent: req.headers['user-agent'],
    };
    
    const sessionId = await secureSessionLoggingService.startSession(sessionData);
    
    res.status(201).json({ sessionId });
    
    // Create audit log for session start
    await enhancedAuditService.createAuditLog({
      userId: data.userId,
      action: 'session_start',
      resourceType: 'session',
      resourceId: sessionId,
      status: 'success',
      workspaceId: data.workspaceId,
      serverId: data.serverId,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string,
      deviceId: data.deviceId,
      sessionId,
      details: {
        clientType: data.clientType,
        classification: data.classification,
        isSystemGenerated: data.isSystemGenerated
      }
    });
  } catch (error) {
    console.error('Error starting session:', error);
    res.status(400).json({ error: error.message });
  }
});

/**
 * End of router definition
 */
export default router;
