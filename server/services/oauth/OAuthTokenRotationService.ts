/**
 * OAuth2 Token Rotation Service
 * 
 * Provides functionality to:
 * 1. Manage credential rotation policies
 * 2. Enforce token and secret expiration
 * 3. Track and log token usage statistics
 * 4. Monitor for suspicious activities
 * 5. Generate security events and notifications
 */

import { db } from '@db';
import { 
  oauthClientSecretHistory, 
  oauthTokenUsageStats,
  oauthSecurityEvents,
  oauthNotificationSettings,
  oauthSecurityEventsInsertSchema,
  oauthTokenUsageStatsInsertSchema
} from '@shared/schema_oauth_rotation';
import { oauthClients, oauthAccessTokens } from '@shared/schema_oauth';
import { eq, and, or, sql, gte, lte, between, lt, desc } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { scrypt, randomBytes, timingSafeEqual } from 'crypto';
import { promisify } from 'util';
import { eventBus } from '../../infrastructure/events/EventBus';

// Secret hashing utilities
const scryptAsync = promisify(scrypt);

async function hashSecret(secret: string) {
  const salt = randomBytes(16).toString('hex');
  const buf = (await scryptAsync(secret, salt, 64)) as Buffer;
  return `${buf.toString('hex')}.${salt}`;
}

// Token Rotation Events
export const TOKEN_ROTATION_EVENTS = {
  SECRET_CREATED: 'oauth.token_rotation.secret_created',
  SECRET_ROTATED: 'oauth.token_rotation.secret_rotated',
  SECRET_EXPIRING: 'oauth.token_rotation.secret_expiring',
  SECRET_EXPIRED: 'oauth.token_rotation.secret_expired',
  SUSPICIOUS_ACTIVITY: 'oauth.token_rotation.suspicious_activity',
  SECURITY_EVENT: 'oauth.token_rotation.security_event',
  USAGE_THRESHOLD_EXCEEDED: 'oauth.token_rotation.usage_threshold_exceeded'
};

// Usage thresholds for alerting
const USAGE_THRESHOLDS = {
  HIGH_TOKEN_REQUESTS: 500, // Requests per day
  EXCESSIVE_TOKEN_DENIALS: 50, // Denials per day
  SUSTAINED_HIGH_USAGE: 5000 // API requests per day
};

export class OAuthTokenRotationService {
  constructor() {
    console.log('OAuth Token Rotation Service initialized');
    
    // Register for events
    eventBus.on('oauth.token.created', this.recordTokenCreation.bind(this));
    eventBus.on('oauth.token.denied', this.recordTokenDenial.bind(this));
    eventBus.on('oauth.token.used', this.recordTokenUsage.bind(this));
    eventBus.on('oauth.ip_access.violation', this.recordSecurityEvent.bind(this));
    
    // Initialize scheduled tasks
    this.initializeScheduledTasks();
  }

  /**
   * Initialize scheduled background tasks
   */
  private initializeScheduledTasks() {
    // Check for expiring credentials daily
    setInterval(this.checkExpiringCredentials.bind(this), 24 * 60 * 60 * 1000);
    
    // Analyze token usage patterns hourly
    setInterval(this.analyzeTokenUsagePatterns.bind(this), 60 * 60 * 1000);
  }

  /**
   * Generate a new client secret
   */
  generateClientSecret(): string {
    // Generate a strong secret with prefix for easy identification
    const uuid = uuidv4();
    const random = randomBytes(16).toString('hex');
    return `mcp-secret-${uuid}-${random}`;
  }

  /**
   * Create a new client secret and store it
   */
  async createClientSecret(clientId: number, userId?: number): Promise<{clientSecret: string}> {
    try {
      // Generate new client secret
      const clientSecret = this.generateClientSecret();
      const clientSecretHash = await hashSecret(clientSecret);
      
      // Update client with new secret
      await db.update(oauthClients)
        .set({
          clientSecret: clientSecretHash,
          secretLastRotatedAt: new Date(),
          secretExpiresAt: this.calculateExpiryDate(clientId),
          updatedAt: new Date(),
          updatedBy: userId
        })
        .where(eq(oauthClients.id, clientId));
      
      // Record in history
      await db.insert(oauthClientSecretHistory)
        .values({
          clientId,
          clientSecretHash,
          createdAt: new Date(),
          createdBy: userId,
          rotationReason: 'initial_creation'
        });
      
      // Emit event for new secret
      eventBus.emit(TOKEN_ROTATION_EVENTS.SECRET_CREATED, {
        clientId,
        userId,
        timestamp: new Date()
      });
      
      return { clientSecret };
    } catch (error) {
      console.error('Error creating client secret:', error);
      throw new Error('Failed to create client secret');
    }
  }

  /**
   * Rotate an existing client secret
   */
  async rotateClientSecret(clientId: number, userId?: number, reason?: string): Promise<{clientSecret: string}> {
    try {
      // Get current client to preserve settings
      const client = await db.query.oauthClients.findFirst({
        where: eq(oauthClients.id, clientId)
      });
      
      if (!client) {
        throw new Error(`OAuth client with ID ${clientId} not found`);
      }
      
      // Store the current secret in history before replacing it
      if (client.clientSecret) {
        await db.insert(oauthClientSecretHistory)
          .values({
            clientId,
            clientSecretHash: client.clientSecret,
            createdAt: client.secretLastRotatedAt || client.createdAt,
            expiredAt: new Date(),
            createdBy: client.updatedBy || userId,
            rotationReason: reason || 'manual_rotation'
          });
      }
      
      // Generate new client secret
      const clientSecret = this.generateClientSecret();
      const clientSecretHash = await hashSecret(clientSecret);
      
      // Update client with new secret
      await db.update(oauthClients)
        .set({
          clientSecret: clientSecretHash,
          secretLastRotatedAt: new Date(),
          secretExpiresAt: this.calculateExpiryDate(clientId),
          updatedAt: new Date(),
          updatedBy: userId
        })
        .where(eq(oauthClients.id, clientId));
      
      // Emit event for rotated secret
      eventBus.emit(TOKEN_ROTATION_EVENTS.SECRET_ROTATED, {
        clientId,
        userId,
        reason: reason || 'manual_rotation',
        timestamp: new Date()
      });
      
      // Create security event for the rotation
      await this.createSecurityEvent({
        clientId,
        eventType: 'credential_rotation',
        severity: 'info',
        description: `Client credentials were rotated. Reason: ${reason || 'manual_rotation'}`,
        details: {
          reason: reason || 'manual_rotation',
          rotatedBy: userId
        }
      });
      
      return { clientSecret };
    } catch (error) {
      console.error('Error rotating client secret:', error);
      throw new Error('Failed to rotate client secret');
    }
  }

  /**
   * Configure rotation policy for a client
   */
  async configureRotationPolicy(
    clientId: number,
    policy: {
      requireRotation: boolean;
      rotationPeriodDays?: number;
      rotationNotificationDays?: number;
    },
    userId?: number
  ) {
    try {
      // Check if client exists
      const client = await db.query.oauthClients.findFirst({
        where: eq(oauthClients.id, clientId)
      });
      
      if (!client) {
        throw new Error(`OAuth client with ID ${clientId} not found`);
      }
      
      // Update rotation policy
      const [updated] = await db.update(oauthClients)
        .set({
          requireRotation: policy.requireRotation,
          rotationPeriodDays: policy.rotationPeriodDays || 90,
          rotationNotificationDays: policy.rotationNotificationDays || 15,
          updatedAt: new Date(),
          updatedBy: userId,
          // If enabling rotation, set expiry date based on last rotation or creation date
          ...(policy.requireRotation && !client.secretExpiresAt ? {
            secretExpiresAt: this.calculateExpiryDate(
              clientId, 
              client.secretLastRotatedAt || client.createdAt, 
              policy.rotationPeriodDays
            )
          } : {})
        })
        .where(eq(oauthClients.id, clientId))
        .returning();
      
      return updated;
    } catch (error) {
      console.error('Error configuring rotation policy:', error);
      throw new Error('Failed to configure rotation policy');
    }
  }

  /**
   * Calculate expiry date for a client secret based on rotation policy
   */
  private calculateExpiryDate(clientId: number, baseDate?: Date, overridePeriodDays?: number): Date {
    const now = new Date();
    const base = baseDate || now;
    
    // Use override period if provided, otherwise get from client settings or use default
    let periodDays = overridePeriodDays || 90; // Default is 90 days
    
    try {
      // Try to get client's rotation period
      const client = db.query.oauthClients.findFirst({
        where: eq(oauthClients.id, clientId)
      });
      
      if (client && client.rotationPeriodDays) {
        periodDays = client.rotationPeriodDays;
      }
    } catch (error) {
      console.warn(`Could not get rotation period for client ${clientId}, using default of ${periodDays} days`);
    }
    
    // Calculate expiry date
    const expiryDate = new Date(base);
    expiryDate.setDate(expiryDate.getDate() + periodDays);
    
    return expiryDate;
  }

  /**
   * Check for expiring credentials and generate notifications
   */
  async checkExpiringCredentials() {
    try {
      const now = new Date();
      
      // Find clients with expiring credentials
      const expiringClients = await db.query.oauthClients.findMany({
        where: and(
          eq(oauthClients.requireRotation, true),
          not(eq(oauthClients.secretExpiresAt, null)),
          // Find clients whose secrets expire within their notification period
          sql`${oauthClients.secretExpiresAt} <= (${now} + (${oauthClients.rotationNotificationDays} * interval '1 day'))`,
          sql`${oauthClients.secretExpiresAt} > ${now}`
        )
      });
      
      // Find clients with expired credentials
      const expiredClients = await db.query.oauthClients.findMany({
        where: and(
          eq(oauthClients.requireRotation, true),
          not(eq(oauthClients.secretExpiresAt, null)),
          lt(oauthClients.secretExpiresAt, now)
        )
      });
      
      // Process expiring clients
      for (const client of expiringClients) {
        const daysUntilExpiry = Math.ceil(
          (client.secretExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        // Create security event for expiring credentials
        await this.createSecurityEvent({
          clientId: client.id,
          eventType: 'rotation_reminder',
          severity: daysUntilExpiry <= 5 ? 'warning' : 'info',
          description: `Client credentials will expire in ${daysUntilExpiry} days`,
          details: {
            daysUntilExpiry,
            expiresAt: client.secretExpiresAt,
            lastRotatedAt: client.secretLastRotatedAt
          }
        });
        
        // Emit event for expiring secret
        eventBus.emit(TOKEN_ROTATION_EVENTS.SECRET_EXPIRING, {
          clientId: client.id,
          expiresAt: client.secretExpiresAt,
          daysUntilExpiry
        });
      }
      
      // Process expired clients
      for (const client of expiredClients) {
        // Create security event for expired credentials
        await this.createSecurityEvent({
          clientId: client.id,
          eventType: 'credential_expired',
          severity: 'critical',
          description: `Client credentials have expired`,
          details: {
            expiresAt: client.secretExpiresAt,
            lastRotatedAt: client.secretLastRotatedAt,
            daysSinceExpiry: Math.ceil(
              (now.getTime() - client.secretExpiresAt.getTime()) / (1000 * 60 * 60 * 24)
            )
          }
        });
        
        // Emit event for expired secret
        eventBus.emit(TOKEN_ROTATION_EVENTS.SECRET_EXPIRED, {
          clientId: client.id,
          expiresAt: client.secretExpiresAt
        });
      }
      
      return {
        expiringCount: expiringClients.length,
        expiredCount: expiredClients.length
      };
    } catch (error) {
      console.error('Error checking expiring credentials:', error);
      throw new Error('Failed to check expiring credentials');
    }
  }

  /**
   * Record token creation event
   */
  async recordTokenCreation(data: { clientId: number; ipAddress?: string }) {
    try {
      const { clientId, ipAddress } = data;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get or create usage stats record for today
      const existingStats = await db.query.oauthTokenUsageStats.findFirst({
        where: and(
          eq(oauthTokenUsageStats.clientId, clientId),
          eq(oauthTokenUsageStats.date, today)
        )
      });
      
      if (existingStats) {
        // Update existing record
        await db.update(oauthTokenUsageStats)
          .set({
            tokenRequests: existingStats.tokenRequests + 1,
            // Increment unique IPs if this IP is not already counted
            uniqueIps: ipAddress ? existingStats.uniqueIps + 1 : existingStats.uniqueIps
          })
          .where(
            and(
              eq(oauthTokenUsageStats.id, existingStats.id),
              // Optimistic concurrency check
              eq(oauthTokenUsageStats.tokenRequests, existingStats.tokenRequests)
            )
          );
      } else {
        // Create new record
        await db.insert(oauthTokenUsageStats)
          .values({
            clientId,
            date: today,
            tokenRequests: 1,
            uniqueIps: ipAddress ? 1 : 0
          });
      }
    } catch (error) {
      console.error('Error recording token creation:', error);
      // Don't throw here - we don't want to fail the token creation process
    }
  }

  /**
   * Record token denial event
   */
  async recordTokenDenial(data: { clientId: number; reason: string; ipAddress?: string }) {
    try {
      const { clientId, reason, ipAddress } = data;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get or create usage stats record for today
      const existingStats = await db.query.oauthTokenUsageStats.findFirst({
        where: and(
          eq(oauthTokenUsageStats.clientId, clientId),
          eq(oauthTokenUsageStats.date, today)
        )
      });
      
      if (existingStats) {
        // Update existing record
        await db.update(oauthTokenUsageStats)
          .set({
            tokenDenials: existingStats.tokenDenials + 1
          })
          .where(
            and(
              eq(oauthTokenUsageStats.id, existingStats.id),
              // Optimistic concurrency check
              eq(oauthTokenUsageStats.tokenDenials, existingStats.tokenDenials)
            )
          );
      } else {
        // Create new record
        await db.insert(oauthTokenUsageStats)
          .values({
            clientId,
            date: today,
            tokenDenials: 1
          });
      }
      
      // If there are many denials, create a security event
      if (existingStats && existingStats.tokenDenials >= USAGE_THRESHOLDS.EXCESSIVE_TOKEN_DENIALS) {
        await this.createSecurityEvent({
          clientId,
          eventType: 'excessive_token_denials',
          severity: 'warning',
          description: `Excessive token request denials detected: ${existingStats.tokenDenials + 1}`,
          details: {
            denialCount: existingStats.tokenDenials + 1,
            latestReason: reason,
            ipAddress
          }
        });
        
        // Emit security event
        eventBus.emit(TOKEN_ROTATION_EVENTS.USAGE_THRESHOLD_EXCEEDED, {
          clientId,
          metric: 'token_denials',
          value: existingStats.tokenDenials + 1,
          threshold: USAGE_THRESHOLDS.EXCESSIVE_TOKEN_DENIALS
        });
      }
    } catch (error) {
      console.error('Error recording token denial:', error);
      // Don't throw here - we don't want to fail the process
    }
  }

  /**
   * Record token usage event
   */
  async recordTokenUsage(data: { clientId: number; tokenId: number; ipAddress?: string }) {
    try {
      const { clientId, ipAddress } = data;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Get or create usage stats record for today
      const existingStats = await db.query.oauthTokenUsageStats.findFirst({
        where: and(
          eq(oauthTokenUsageStats.clientId, clientId),
          eq(oauthTokenUsageStats.date, today)
        )
      });
      
      if (existingStats) {
        // Update existing record
        await db.update(oauthTokenUsageStats)
          .set({
            apiRequests: existingStats.apiRequests + 1
          })
          .where(
            and(
              eq(oauthTokenUsageStats.id, existingStats.id),
              // Optimistic concurrency check
              eq(oauthTokenUsageStats.apiRequests, existingStats.apiRequests)
            )
          );
          
        // Check if usage exceeds threshold
        if (existingStats.apiRequests >= USAGE_THRESHOLDS.SUSTAINED_HIGH_USAGE) {
          await this.createSecurityEvent({
            clientId,
            eventType: 'high_api_usage',
            severity: 'info',
            description: `Sustained high API usage detected: ${existingStats.apiRequests + 1} requests today`,
            details: {
              requestCount: existingStats.apiRequests + 1,
              threshold: USAGE_THRESHOLDS.SUSTAINED_HIGH_USAGE
            }
          });
          
          // Emit usage threshold event
          eventBus.emit(TOKEN_ROTATION_EVENTS.USAGE_THRESHOLD_EXCEEDED, {
            clientId,
            metric: 'api_requests',
            value: existingStats.apiRequests + 1,
            threshold: USAGE_THRESHOLDS.SUSTAINED_HIGH_USAGE
          });
        }
      } else {
        // Create new record
        await db.insert(oauthTokenUsageStats)
          .values({
            clientId,
            date: today,
            apiRequests: 1
          });
      }
    } catch (error) {
      console.error('Error recording token usage:', error);
      // Don't throw here - we don't want to fail the API call
    }
  }

  /**
   * Record security event
   */
  async recordSecurityEvent(data: { clientId: number; tokenId?: number; reason: string; ipAddress?: string }) {
    try {
      const { clientId, tokenId, reason, ipAddress } = data;
      
      // Create security event
      await this.createSecurityEvent({
        clientId,
        tokenId,
        eventType: 'ip_violation',
        severity: 'warning',
        description: `IP access violation: ${reason}`,
        details: {
          reason,
          ipAddress
        }
      });
    } catch (error) {
      console.error('Error recording security event:', error);
      // Don't throw here - we don't want to fail the parent process
    }
  }

  /**
   * Create a security event
   */
  async createSecurityEvent(data: {
    clientId: number;
    tokenId?: number;
    eventType: string;
    severity: 'info' | 'warning' | 'critical';
    description: string;
    details?: Record<string, any>;
  }) {
    try {
      // Create the security event
      const securityEvent = {
        clientId: data.clientId,
        tokenId: data.tokenId,
        eventType: data.eventType,
        eventTime: new Date(),
        severity: data.severity,
        description: data.description,
        details: data.details ? JSON.stringify(data.details) : null
      };
      
      // Insert into database
      const [inserted] = await db.insert(oauthSecurityEvents)
        .values(securityEvent)
        .returning();
      
      // Emit event
      eventBus.emit(TOKEN_ROTATION_EVENTS.SECURITY_EVENT, {
        ...securityEvent,
        id: inserted.id
      });
      
      // Send notifications based on severity and users' preferences
      if (data.severity !== 'info') {
        await this.sendEventNotifications(inserted);
      }
      
      return inserted;
    } catch (error) {
      console.error('Error creating security event:', error);
      throw new Error('Failed to create security event');
    }
  }

  /**
   * Send notifications for a security event
   */
  private async sendEventNotifications(event: any) {
    try {
      // Get notification settings for users
      const notificationSettings = await db.query.oauthNotificationSettings.findMany({
        where: or(
          and(eq(oauthNotificationSettings.notifyCredentialExpiry, true), eq(event.eventType, 'rotation_reminder')),
          and(eq(oauthNotificationSettings.notifyCredentialExpiry, true), eq(event.eventType, 'credential_expired')),
          and(eq(oauthNotificationSettings.notifySuspiciousActivity, true), eq(event.severity, 'warning')),
          and(eq(oauthNotificationSettings.notifySuspiciousActivity, true), eq(event.severity, 'critical')),
          and(eq(oauthNotificationSettings.notifyClientDisabled, true), eq(event.eventType, 'client_disabled'))
        )
      });
      
      // Process each notification setting
      for (const setting of notificationSettings) {
        // Process email notifications
        if (setting.emailNotifications && setting.userId) {
          // Queue email notification
          eventBus.emit('notification.email.queue', {
            userId: setting.userId,
            subject: `MCP Security Alert: ${event.description}`,
            body: `
              <h2>OAuth Security Event</h2>
              <p><strong>Severity:</strong> ${event.severity}</p>
              <p><strong>Event Type:</strong> ${event.eventType}</p>
              <p><strong>Description:</strong> ${event.description}</p>
              <p><strong>Time:</strong> ${event.eventTime.toISOString()}</p>
              ${event.details ? `<p><strong>Details:</strong> <pre>${JSON.stringify(JSON.parse(event.details), null, 2)}</pre></p>` : ''}
              <p>Please review this security event in the MCP management console.</p>
            `,
            eventId: event.id
          });
        }
        
        // Process webhook notifications
        if (setting.webhookUrl) {
          // Queue webhook notification
          eventBus.emit('notification.webhook.queue', {
            url: setting.webhookUrl,
            payload: {
              event_type: 'oauth_security_event',
              severity: event.severity,
              description: event.description,
              event_time: event.eventTime.toISOString(),
              details: event.details ? JSON.parse(event.details) : null,
              event_id: event.id
            },
            eventId: event.id
          });
        }
      }
    } catch (error) {
      console.error('Error sending event notifications:', error);
      // Don't throw here - we don't want to fail if notifications fail
    }
  }

  /**
   * Configure notification settings for a user
   */
  async configureNotificationSettings(
    userId: number,
    settings: {
      notifyCredentialExpiry?: boolean;
      notifySuspiciousActivity?: boolean;
      notifyClientDisabled?: boolean;
      emailNotifications?: boolean;
      dashboardNotifications?: boolean;
      webhookUrl?: string;
    }
  ) {
    try {
      // Check if settings already exist for this user
      const existingSettings = await db.query.oauthNotificationSettings.findFirst({
        where: eq(oauthNotificationSettings.userId, userId)
      });
      
      if (existingSettings) {
        // Update existing settings
        const [updated] = await db.update(oauthNotificationSettings)
          .set({
            ...settings,
            updatedAt: new Date()
          })
          .where(eq(oauthNotificationSettings.id, existingSettings.id))
          .returning();
          
        return updated;
      } else {
        // Create new settings
        const [inserted] = await db.insert(oauthNotificationSettings)
          .values({
            userId,
            notifyCredentialExpiry: settings.notifyCredentialExpiry ?? true,
            notifySuspiciousActivity: settings.notifySuspiciousActivity ?? true,
            notifyClientDisabled: settings.notifyClientDisabled ?? true,
            emailNotifications: settings.emailNotifications ?? true,
            dashboardNotifications: settings.dashboardNotifications ?? true,
            webhookUrl: settings.webhookUrl,
            createdAt: new Date(),
            updatedAt: new Date()
          })
          .returning();
          
        return inserted;
      }
    } catch (error) {
      console.error('Error configuring notification settings:', error);
      throw new Error('Failed to configure notification settings');
    }
  }

  /**
   * Get security events for a client
   */
  async getSecurityEvents(
    clientId: number,
    options: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
      severity?: string;
      eventType?: string;
      includeResolved?: boolean;
    } = {}
  ) {
    try {
      const {
        limit = 100,
        offset = 0,
        startDate,
        endDate,
        severity,
        eventType,
        includeResolved = false
      } = options;
      
      // Build query conditions
      const conditions = [eq(oauthSecurityEvents.clientId, clientId)];
      
      if (!includeResolved) {
        conditions.push(eq(oauthSecurityEvents.resolvedAt, null));
      }
      
      if (startDate && endDate) {
        conditions.push(between(oauthSecurityEvents.eventTime, startDate, endDate));
      } else if (startDate) {
        conditions.push(gte(oauthSecurityEvents.eventTime, startDate));
      } else if (endDate) {
        conditions.push(lte(oauthSecurityEvents.eventTime, endDate));
      }
      
      if (severity) {
        conditions.push(eq(oauthSecurityEvents.severity, severity));
      }
      
      if (eventType) {
        conditions.push(eq(oauthSecurityEvents.eventType, eventType));
      }
      
      // Execute query
      const events = await db.query.oauthSecurityEvents.findMany({
        where: and(...conditions),
        limit,
        offset,
        orderBy: [desc(oauthSecurityEvents.eventTime)]
      });
      
      // Get total count for pagination
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(oauthSecurityEvents)
        .where(and(...conditions));
      
      return {
        events,
        total: countResult.count,
        limit,
        offset
      };
    } catch (error) {
      console.error('Error getting security events:', error);
      throw new Error('Failed to get security events');
    }
  }

  /**
   * Resolve a security event
   */
  async resolveSecurityEvent(id: number, userId: number, notes?: string) {
    try {
      const [updated] = await db.update(oauthSecurityEvents)
        .set({
          resolvedAt: new Date(),
          resolvedBy: userId,
          resolutionNotes: notes
        })
        .where(eq(oauthSecurityEvents.id, id))
        .returning();
        
      if (!updated) {
        throw new Error(`Security event with ID ${id} not found`);
      }
      
      return updated;
    } catch (error) {
      console.error('Error resolving security event:', error);
      throw new Error('Failed to resolve security event');
    }
  }

  /**
   * Get token usage statistics for a client
   */
  async getTokenUsageStats(
    clientId: number,
    options: {
      startDate?: Date;
      endDate?: Date;
    } = {}
  ) {
    try {
      const { startDate, endDate } = options;
      const now = new Date();
      
      // Default to last 30 days if no dates specified
      const start = startDate || new Date(now.setDate(now.getDate() - 30));
      const end = endDate || new Date();
      
      // Get daily stats
      const stats = await db.query.oauthTokenUsageStats.findMany({
        where: and(
          eq(oauthTokenUsageStats.clientId, clientId),
          between(oauthTokenUsageStats.date, start, end)
        ),
        orderBy: [desc(oauthTokenUsageStats.date)]
      });
      
      // Calculate summary metrics
      let totalRequests = 0;
      let totalDenials = 0;
      let totalApiRequests = 0;
      let maxDailyRequests = 0;
      let maxDailyDenials = 0;
      let maxDailyApiRequests = 0;
      
      stats.forEach(day => {
        totalRequests += day.tokenRequests;
        totalDenials += day.tokenDenials;
        totalApiRequests += day.apiRequests;
        
        maxDailyRequests = Math.max(maxDailyRequests, day.tokenRequests);
        maxDailyDenials = Math.max(maxDailyDenials, day.tokenDenials);
        maxDailyApiRequests = Math.max(maxDailyApiRequests, day.apiRequests);
      });
      
      return {
        dailyStats: stats,
        summary: {
          totalRequests,
          totalDenials,
          totalApiRequests,
          maxDailyRequests,
          maxDailyDenials,
          maxDailyApiRequests,
          daysInPeriod: stats.length,
          denialRate: totalRequests > 0 ? totalDenials / totalRequests : 0
        }
      };
    } catch (error) {
      console.error('Error getting token usage stats:', error);
      throw new Error('Failed to get token usage stats');
    }
  }

  /**
   * Analyze token usage patterns to detect anomalies
   */
  private async analyzeTokenUsagePatterns() {
    try {
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);
      
      // Get active clients
      const activeClients = await db.query.oauthClients.findMany({
        where: eq(oauthClients.isEnabled, true)
      });
      
      for (const client of activeClients) {
        // Get usage for today and past week
        const todayStats = await db.query.oauthTokenUsageStats.findFirst({
          where: and(
            eq(oauthTokenUsageStats.clientId, client.id),
            eq(oauthTokenUsageStats.date, today)
          )
        });
        
        // Skip if no activity today
        if (!todayStats) continue;
        
        // Get past week's stats (excluding today)
        const pastWeekStart = new Date(today);
        pastWeekStart.setDate(pastWeekStart.getDate() - 7);
        
        const pastWeekStats = await db.query.oauthTokenUsageStats.findMany({
          where: and(
            eq(oauthTokenUsageStats.clientId, client.id),
            between(oauthTokenUsageStats.date, pastWeekStart, now),
            not(eq(oauthTokenUsageStats.date, today))
          )
        });
        
        // Calculate average daily metrics
        const avgDays = pastWeekStats.length;
        if (avgDays === 0) continue; // Skip if no historical data
        
        const avgRequests = pastWeekStats.reduce((sum, day) => sum + day.tokenRequests, 0) / avgDays;
        const avgDenials = pastWeekStats.reduce((sum, day) => sum + day.tokenDenials, 0) / avgDays;
        const avgApiRequests = pastWeekStats.reduce((sum, day) => sum + day.apiRequests, 0) / avgDays;
        
        // Check for significant deviations (3x average)
        if (todayStats.tokenRequests > avgRequests * 3 && todayStats.tokenRequests > 50) {
          await this.createSecurityEvent({
            clientId: client.id,
            eventType: 'abnormal_token_requests',
            severity: 'warning',
            description: `Abnormal increase in token requests detected: ${todayStats.tokenRequests} (avg: ${avgRequests.toFixed(1)})`,
            details: {
              current: todayStats.tokenRequests,
              average: avgRequests,
              percentIncrease: ((todayStats.tokenRequests / avgRequests) * 100).toFixed(1)
            }
          });
          
          // Emit suspicious activity event
          eventBus.emit(TOKEN_ROTATION_EVENTS.SUSPICIOUS_ACTIVITY, {
            clientId: client.id,
            activityType: 'abnormal_token_requests',
            severity: 'warning',
            details: {
              current: todayStats.tokenRequests,
              average: avgRequests
            }
          });
        }
        
        // Check for high denial rate compared to historical
        const todayDenialRate = todayStats.tokenRequests > 0 ? 
          todayStats.tokenDenials / todayStats.tokenRequests : 0;
        
        const pastDenialRates = pastWeekStats.map(day => 
          day.tokenRequests > 0 ? day.tokenDenials / day.tokenRequests : 0
        );
        
        const avgDenialRate = pastDenialRates.reduce((sum, rate) => sum + rate, 0) / avgDays;
        
        if (todayDenialRate > avgDenialRate * 3 && todayDenialRate > 0.2 && todayStats.tokenRequests > 10) {
          await this.createSecurityEvent({
            clientId: client.id,
            eventType: 'high_denial_rate',
            severity: 'warning',
            description: `High token denial rate detected: ${(todayDenialRate * 100).toFixed(1)}% (avg: ${(avgDenialRate * 100).toFixed(1)}%)`,
            details: {
              currentRate: todayDenialRate,
              averageRate: avgDenialRate,
              denials: todayStats.tokenDenials,
              requests: todayStats.tokenRequests
            }
          });
          
          // Emit suspicious activity event
          eventBus.emit(TOKEN_ROTATION_EVENTS.SUSPICIOUS_ACTIVITY, {
            clientId: client.id,
            activityType: 'high_denial_rate',
            severity: 'warning',
            details: {
              currentRate: todayDenialRate,
              averageRate: avgDenialRate
            }
          });
        }
      }
    } catch (error) {
      console.error('Error analyzing token usage patterns:', error);
      // Don't throw here - this is a background process
    }
  }
}