/**
 * OAuth2 IP Access Control Service
 * 
 * Provides functionality to:
 * 1. Manage IP allowlists for OAuth2 clients
 * 2. Validate access requests against IP allowlists
 * 3. Track and log access attempts
 * 4. Enforce time-based access restrictions
 * 5. Monitor for suspicious access patterns
 */

import { db } from '@db';
import { 
  oauthIpAllowlist, 
  oauthIpAccessLogs, 
  oauthClientActivationWindows,
  oauthIpAllowlistInsertSchema,
  oauthIpAccessLogsInsertSchema
} from '@shared/schema_oauth_ip';
import { oauthClients, oauthAccessTokens } from '@shared/schema_oauth';
import { EventBus } from '../../infrastructure/events/EventBus';
import { eq, and, inArray, between, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import { isIPv4, cidrSubnet } from 'ip';

// IP Access Control Events
export const IP_ACCESS_EVENTS = {
  ALLOWED: 'oauth.ip_access.allowed',
  DENIED: 'oauth.ip_access.denied',
  VIOLATION: 'oauth.ip_access.violation',
  CLIENT_DISABLED: 'oauth.ip_access.client_disabled'
};

// IP Check Result Types
export enum IPCheckResult {
  ALLOWED = 'allowed',
  DENIED_IP = 'denied_ip',
  DENIED_TIME = 'denied_time',
  NOT_ENFORCED = 'not_enforced'
}

interface IPCheckOptions {
  ipAddress: string;
  clientId: number;
  tokenId?: number;
  userAgent?: string;
  requestPath?: string;
}

export class OAuthIpAccessControlService {
  constructor(private eventBus: EventBus) {
    console.log('OAuth IP Access Control Service initialized');
  }

  /**
   * Add an IP to a client's allowlist
   */
  async addIpToAllowlist(data: {
    clientId: number;
    ipAddress: string;
    description?: string;
    createdBy?: number;
  }) {
    try {
      // Validate the IP address
      const parsedData = oauthIpAllowlistInsertSchema.parse({
        clientId: data.clientId,
        ipAddress: data.ipAddress,
        description: data.description,
        createdBy: data.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
        enabled: true
      });

      // Check if the client exists
      const client = await db.query.oauthClients.findFirst({
        where: eq(oauthClients.id, data.clientId)
      });

      if (!client) {
        throw new Error(`OAuth client with ID ${data.clientId} not found`);
      }

      // Check if this IP is already in the allowlist
      const existingEntry = await db.query.oauthIpAllowlist.findFirst({
        where: and(
          eq(oauthIpAllowlist.clientId, data.clientId),
          eq(oauthIpAllowlist.ipAddress, data.ipAddress)
        )
      });

      if (existingEntry) {
        // If disabled, enable it again
        if (!existingEntry.enabled) {
          const [updated] = await db
            .update(oauthIpAllowlist)
            .set({
              enabled: true,
              updatedAt: new Date(),
              updatedBy: data.createdBy
            })
            .where(eq(oauthIpAllowlist.id, existingEntry.id))
            .returning();
          
          return updated;
        }
        
        return existingEntry;
      }

      // Insert the new IP allowlist entry
      const [inserted] = await db.insert(oauthIpAllowlist)
        .values(parsedData)
        .returning();

      // Enable IP allowlist enforcement if this is the first IP added
      const allowlistCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(oauthIpAllowlist)
        .where(eq(oauthIpAllowlist.clientId, data.clientId));

      if (allowlistCount[0].count === 1) {
        await db
          .update(oauthClients)
          .set({ enforceIpAllowlist: true })
          .where(eq(oauthClients.id, data.clientId));
      }

      return inserted;
    } catch (error) {
      console.error('Error adding IP to allowlist:', error);
      throw error;
    }
  }

  /**
   * Remove an IP from a client's allowlist
   */
  async removeIpFromAllowlist(id: number, userId?: number) {
    try {
      // Soft delete by disabling
      const [updated] = await db
        .update(oauthIpAllowlist)
        .set({
          enabled: false,
          updatedAt: new Date(),
          updatedBy: userId
        })
        .where(eq(oauthIpAllowlist.id, id))
        .returning();

      if (!updated) {
        throw new Error(`IP allowlist entry with ID ${id} not found`);
      }

      // Check if there are any IPs left in the allowlist
      const allowlistCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(oauthIpAllowlist)
        .where(
          and(
            eq(oauthIpAllowlist.clientId, updated.clientId),
            eq(oauthIpAllowlist.enabled, true)
          )
        );

      // If no IPs left, disable enforcement
      if (allowlistCount[0].count === 0) {
        await db
          .update(oauthClients)
          .set({ enforceIpAllowlist: false })
          .where(eq(oauthClients.id, updated.clientId));
      }

      return updated;
    } catch (error) {
      console.error('Error removing IP from allowlist:', error);
      throw error;
    }
  }

  /**
   * Check if an IP is allowed to access for a client
   */
  async checkIpAccess(options: IPCheckOptions): Promise<IPCheckResult> {
    try {
      const { ipAddress, clientId, tokenId, userAgent, requestPath } = options;

      // Check if the client exists and has IP restrictions enabled
      const client = await db.query.oauthClients.findFirst({
        where: eq(oauthClients.id, clientId)
      });

      if (!client) {
        throw new Error(`OAuth client with ID ${clientId} not found`);
      }

      // If IP allowlist is not enforced, allow access
      if (!client.enforceIpAllowlist) {
        // Log the access attempt
        await this.logAccessAttempt({
          clientId,
          tokenId,
          ipAddress,
          userAgent: userAgent || '',
          requestPath: requestPath || '/api/oauth/token',
          accessStatus: IPCheckResult.NOT_ENFORCED
        });

        return IPCheckResult.NOT_ENFORCED;
      }

      // Check time restrictions if enabled
      if (client.enforceTimeRestrictions) {
        const isWithinTimeWindow = await this.checkTimeRestrictions(clientId);
        if (!isWithinTimeWindow) {
          // Log the time-based denial
          await this.logAccessAttempt({
            clientId,
            tokenId,
            ipAddress,
            userAgent: userAgent || '',
            requestPath: requestPath || '/api/oauth/token',
            accessStatus: IPCheckResult.DENIED_TIME,
            details: { reason: 'Outside allowed time window' }
          });

          // Emit violation event
          this.eventBus.emit(IP_ACCESS_EVENTS.DENIED, {
            clientId,
            tokenId,
            ipAddress,
            reason: 'time_restriction'
          });

          // Update violation count
          await this.updateViolationCount(clientId, client);

          return IPCheckResult.DENIED_TIME;
        }
      }

      // Get allowed IPs for this client
      const allowedIps = await db.query.oauthIpAllowlist.findMany({
        where: and(
          eq(oauthIpAllowlist.clientId, clientId),
          eq(oauthIpAllowlist.enabled, true)
        )
      });

      // Check if IP is in the allowlist
      const isAllowed = this.isIpAllowed(ipAddress, allowedIps.map(ip => ip.ipAddress));

      if (isAllowed) {
        // Log the allowed access
        await this.logAccessAttempt({
          clientId,
          tokenId,
          ipAddress,
          userAgent: userAgent || '',
          requestPath: requestPath || '/api/oauth/token',
          accessStatus: IPCheckResult.ALLOWED
        });

        // Emit allowed event
        this.eventBus.emit(IP_ACCESS_EVENTS.ALLOWED, {
          clientId,
          tokenId,
          ipAddress
        });

        return IPCheckResult.ALLOWED;
      } else {
        // Log the IP-based denial
        await this.logAccessAttempt({
          clientId,
          tokenId,
          ipAddress,
          userAgent: userAgent || '',
          requestPath: requestPath || '/api/oauth/token',
          accessStatus: IPCheckResult.DENIED_IP,
          details: { reason: 'IP not in allowlist' }
        });

        // Emit violation event
        this.eventBus.emit(IP_ACCESS_EVENTS.VIOLATION, {
          clientId,
          tokenId,
          ipAddress,
          reason: 'ip_not_allowed'
        });

        // Update violation count
        await this.updateViolationCount(clientId, client);

        return IPCheckResult.DENIED_IP;
      }
    } catch (error) {
      console.error('Error checking IP access:', error);
      throw error;
    }
  }

  /**
   * Update violation count and potentially disable client if max violations exceeded
   */
  private async updateViolationCount(clientId: number, client: any) {
    const violationCount = (client.violationCount || 0) + 1;
    const lastViolationAt = new Date();

    // Update client with new violation count
    await db
      .update(oauthClients)
      .set({
        violationCount,
        lastViolationAt
      })
      .where(eq(oauthClients.id, clientId));

    // Check if max violations exceeded
    if (client.autoRevokeOnViolation && violationCount >= client.maxViolations) {
      // Disable the client
      await db
        .update(oauthClients)
        .set({
          isEnabled: false
        })
        .where(eq(oauthClients.id, clientId));

      // Revoke all active tokens for this client
      await db
        .update(oauthAccessTokens)
        .set({
          isRevoked: true
        })
        .where(
          and(
            eq(oauthAccessTokens.clientId, clientId),
            eq(oauthAccessTokens.isRevoked, false)
          )
        );

      // Emit client disabled event
      this.eventBus.emit(IP_ACCESS_EVENTS.CLIENT_DISABLED, {
        clientId,
        reason: 'max_violations_exceeded',
        violationCount
      });
    }
  }

  /**
   * Check if the current time is within allowed time windows for a client
   */
  private async checkTimeRestrictions(clientId: number): Promise<boolean> {
    // Get current date/time information
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0-6, Sunday to Saturday
    const currentTime = now.toTimeString().split(' ')[0]; // HH:MM:SS

    // Get time windows for this client and day
    const timeWindows = await db.query.oauthClientActivationWindows.findMany({
      where: and(
        eq(oauthClientActivationWindows.clientId, clientId),
        eq(oauthClientActivationWindows.dayOfWeek, dayOfWeek),
        eq(oauthClientActivationWindows.enabled, true)
      )
    });

    // If no time windows defined for this day, default to allowed
    if (timeWindows.length === 0) {
      return true;
    }

    // Check if current time is within any of the defined windows
    for (const window of timeWindows) {
      const startTime = window.startTime.toString();
      const endTime = window.endTime.toString();

      if (currentTime >= startTime && currentTime <= endTime) {
        return true;
      }
    }

    return false;
  }

  /**
   * Add a time restriction window for a client
   */
  async addTimeRestriction(data: {
    clientId: number;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    description?: string;
    createdBy?: number;
  }) {
    try {
      // Convert time strings to proper time objects
      const startTime = new Date(`1970-01-01T${data.startTime}`);
      const endTime = new Date(`1970-01-01T${data.endTime}`);

      // Validate the data
      const parsedData = {
        clientId: data.clientId,
        dayOfWeek: data.dayOfWeek,
        startTime,
        endTime,
        description: data.description,
        createdBy: data.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
        enabled: true
      };

      // Check if the client exists
      const client = await db.query.oauthClients.findFirst({
        where: eq(oauthClients.id, data.clientId)
      });

      if (!client) {
        throw new Error(`OAuth client with ID ${data.clientId} not found`);
      }

      // Insert the new time restriction
      const [inserted] = await db.insert(oauthClientActivationWindows)
        .values(parsedData)
        .returning();

      // Enable time restriction enforcement if this is the first window added
      const windowCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(oauthClientActivationWindows)
        .where(eq(oauthClientActivationWindows.clientId, data.clientId));

      if (windowCount[0].count === 1) {
        await db
          .update(oauthClients)
          .set({ enforceTimeRestrictions: true })
          .where(eq(oauthClients.id, data.clientId));
      }

      return inserted;
    } catch (error) {
      console.error('Error adding time restriction:', error);
      throw error;
    }
  }

  /**
   * Remove a time restriction window
   */
  async removeTimeRestriction(id: number, userId?: number) {
    try {
      // Soft delete by disabling
      const [updated] = await db
        .update(oauthClientActivationWindows)
        .set({
          enabled: false,
          updatedAt: new Date(),
          updatedBy: userId
        })
        .where(eq(oauthClientActivationWindows.id, id))
        .returning();

      if (!updated) {
        throw new Error(`Time restriction with ID ${id} not found`);
      }

      // Check if there are any time windows left
      const windowCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(oauthClientActivationWindows)
        .where(
          and(
            eq(oauthClientActivationWindows.clientId, updated.clientId),
            eq(oauthClientActivationWindows.enabled, true)
          )
        );

      // If no windows left, disable enforcement
      if (windowCount[0].count === 0) {
        await db
          .update(oauthClients)
          .set({ enforceTimeRestrictions: false })
          .where(eq(oauthClients.id, updated.clientId));
      }

      return updated;
    } catch (error) {
      console.error('Error removing time restriction:', error);
      throw error;
    }
  }

  /**
   * Reset violation count for a client
   */
  async resetViolationCount(clientId: number, userId?: number) {
    try {
      const [updated] = await db
        .update(oauthClients)
        .set({
          violationCount: 0,
          updatedAt: new Date(),
          updatedBy: userId
        })
        .where(eq(oauthClients.id, clientId))
        .returning();

      if (!updated) {
        throw new Error(`OAuth client with ID ${clientId} not found`);
      }

      return updated;
    } catch (error) {
      console.error('Error resetting violation count:', error);
      throw error;
    }
  }

  /**
   * Get access logs for a client
   */
  async getAccessLogs(
    clientId: number,
    options: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
      accessStatus?: string;
    } = {}
  ) {
    try {
      const {
        limit = 100,
        offset = 0,
        startDate,
        endDate,
        accessStatus
      } = options;

      // Build query with filter conditions
      let query = db.select().from(oauthIpAccessLogs)
        .where(eq(oauthIpAccessLogs.clientId, clientId))
        .limit(limit)
        .offset(offset)
        .orderBy(sql`${oauthIpAccessLogs.timestamp} DESC`);

      // Add date range filter if provided
      if (startDate && endDate) {
        query = query.where(
          between(oauthIpAccessLogs.timestamp, startDate, endDate)
        );
      } else if (startDate) {
        query = query.where(
          sql`${oauthIpAccessLogs.timestamp} >= ${startDate}`
        );
      } else if (endDate) {
        query = query.where(
          sql`${oauthIpAccessLogs.timestamp} <= ${endDate}`
        );
      }

      // Add access status filter if provided
      if (accessStatus) {
        query = query.where(eq(oauthIpAccessLogs.accessStatus, accessStatus));
      }

      // Execute query
      const logs = await query;

      // Count total matching records for pagination
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(oauthIpAccessLogs)
        .where(eq(oauthIpAccessLogs.clientId, clientId));

      return {
        logs,
        total: countResult.count,
        limit,
        offset
      };
    } catch (error) {
      console.error('Error getting access logs:', error);
      throw error;
    }
  }

  /**
   * Log an access attempt
   */
  private async logAccessAttempt(data: {
    clientId: number;
    tokenId?: number;
    ipAddress: string;
    userAgent: string;
    requestPath: string;
    accessStatus: string;
    details?: Record<string, any>;
  }) {
    try {
      const parsedData = {
        clientId: data.clientId,
        tokenId: data.tokenId,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        requestPath: data.requestPath,
        accessStatus: data.accessStatus,
        timestamp: new Date(),
        details: data.details ? JSON.stringify(data.details) : null
      };

      await db.insert(oauthIpAccessLogs).values(parsedData);
    } catch (error) {
      console.error('Error logging access attempt:', error);
      // Don't throw here - we don't want to fail the main operation
    }
  }

  /**
   * Check if an IP address is in the allowlist
   */
  private isIpAllowed(ipAddress: string, allowedIps: string[]): boolean {
    // If there are no allowed IPs, default to denied
    if (!allowedIps.length) {
      return false;
    }

    // Handle exact IP matches
    if (allowedIps.includes(ipAddress)) {
      return true;
    }

    // Handle CIDR notation (e.g., 10.0.0.0/24)
    // First verify this is a valid IPv4 address
    if (!isIPv4(ipAddress)) {
      return false;
    }

    for (const allowedIp of allowedIps) {
      // Check if this is a CIDR range
      if (allowedIp.includes('/')) {
        try {
          const subnet = cidrSubnet(allowedIp);
          if (subnet.contains(ipAddress)) {
            return true;
          }
        } catch (error) {
          console.error(`Invalid CIDR notation: ${allowedIp}`, error);
          // Continue to next IP in case of error
        }
      }
    }

    return false;
  }

  /**
   * Toggle IP-based access control for a client
   */
  async toggleIpAccessControl(clientId: number, enforce: boolean, userId?: number) {
    try {
      // Check if client exists
      const client = await db.query.oauthClients.findFirst({
        where: eq(oauthClients.id, clientId)
      });

      if (!client) {
        throw new Error(`OAuth client with ID ${clientId} not found`);
      }

      // If enabling enforcement, check that there's at least one IP in the allowlist
      if (enforce) {
        const [countResult] = await db
          .select({ count: sql<number>`count(*)` })
          .from(oauthIpAllowlist)
          .where(
            and(
              eq(oauthIpAllowlist.clientId, clientId),
              eq(oauthIpAllowlist.enabled, true)
            )
          );

        if (countResult.count === 0) {
          throw new Error('Cannot enable IP enforcement without at least one IP in the allowlist');
        }
      }

      // Update client
      const [updated] = await db
        .update(oauthClients)
        .set({
          enforceIpAllowlist: enforce,
          updatedAt: new Date(),
          updatedBy: userId
        })
        .where(eq(oauthClients.id, clientId))
        .returning();

      return updated;
    } catch (error) {
      console.error('Error toggling IP access control:', error);
      throw error;
    }
  }

  /**
   * Toggle time-based access control for a client
   */
  async toggleTimeAccessControl(clientId: number, enforce: boolean, userId?: number) {
    try {
      // Check if client exists
      const client = await db.query.oauthClients.findFirst({
        where: eq(oauthClients.id, clientId)
      });

      if (!client) {
        throw new Error(`OAuth client with ID ${clientId} not found`);
      }

      // If enabling enforcement, check that there's at least one time window defined
      if (enforce) {
        const [countResult] = await db
          .select({ count: sql<number>`count(*)` })
          .from(oauthClientActivationWindows)
          .where(
            and(
              eq(oauthClientActivationWindows.clientId, clientId),
              eq(oauthClientActivationWindows.enabled, true)
            )
          );

        if (countResult.count === 0) {
          throw new Error('Cannot enable time restrictions without at least one time window defined');
        }
      }

      // Update client
      const [updated] = await db
        .update(oauthClients)
        .set({
          enforceTimeRestrictions: enforce,
          updatedAt: new Date(),
          updatedBy: userId
        })
        .where(eq(oauthClients.id, clientId))
        .returning();

      return updated;
    } catch (error) {
      console.error('Error toggling time access control:', error);
      throw error;
    }
  }

  /**
   * Configure auto-revocation settings for a client
   */
  async configureAutoRevocation(
    clientId: number,
    settings: {
      autoRevoke: boolean;
      maxViolations?: number;
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

      // Update client
      const [updated] = await db
        .update(oauthClients)
        .set({
          autoRevokeOnViolation: settings.autoRevoke,
          maxViolations: settings.maxViolations || 5, // Default to 5 if not specified
          updatedAt: new Date(),
          updatedBy: userId
        })
        .where(eq(oauthClients.id, clientId))
        .returning();

      return updated;
    } catch (error) {
      console.error('Error configuring auto revocation:', error);
      throw error;
    }
  }
}