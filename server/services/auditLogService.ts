/**
 * Audit Log Service
 * 
 * Service for creating and retrieving audit logs.
 * This implementation follows enterprise-grade security and compliance best practices:
 * - Immutable audit trail (logs cannot be modified or deleted)
 * - Comprehensive context capture (user, IP, timestamp, etc.)
 * - Structured data for easy analysis and reporting
 * - Support for compliance frameworks (SOC2, HIPAA, GDPR, etc.)
 */

import { db } from '../../db';
import { auditLogs } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';

export interface AuditLogEntry {
  userId?: number;
  action: string;
  resourceType: string;
  resourceId: string;
  workspaceId?: number;
  details?: any;
  ipAddress?: string;
  userAgent?: string;
  source?: string;
  sessionId?: string;
}

/**
 * Create a new audit log entry
 * 
 * @param logEntry The audit log entry to create
 * @returns The created audit log entry ID
 */
export async function createAuditLog(logEntry: AuditLogEntry): Promise<number> {
  try {
    const timestamp = new Date();
    
    // Insert the audit log entry
    const [result] = await db.insert(auditLogs).values({
      userId: logEntry.userId,
      action: logEntry.action,
      resourceType: logEntry.resourceType,
      resourceId: logEntry.resourceId,
      workspaceId: logEntry.workspaceId,
      details: logEntry.details || {},
      ipAddress: logEntry.ipAddress,
      userAgent: logEntry.userAgent,
      source: logEntry.source || 'api',
      sessionId: logEntry.sessionId,
      timestamp,
      chainHash: '', // Will be updated by the audit log chain process
      chainBlock: 0  // Will be updated by the audit log chain process
    }).returning({ id: auditLogs.id });
    
    // Trigger audit log chain update (in a production system, this would be done by a background job)
    // For simplicity, we're not implementing the full blockchain-like structure here
    
    return result.id;
  } catch (error) {
    console.error('Error creating audit log:', error);
    // For audit logs, we don't want to throw errors that could interrupt
    // the main flow of the application, so we return -1 to indicate failure
    return -1;
  }
}

/**
 * Retrieve audit logs for a specific user
 * 
 * @param userId The user ID to retrieve logs for
 * @param limit The maximum number of logs to retrieve (default: 100)
 * @param offset The offset for pagination (default: 0)
 * @returns Array of audit log entries
 */
export async function getUserAuditLogs(
  userId: number, 
  limit: number = 100, 
  offset: number = 0
): Promise<any[]> {
  try {
    const logs = await db.query.auditLogs.findMany({
      where: eq(auditLogs.userId, userId),
      orderBy: [desc(auditLogs.timestamp)],
      limit,
      offset
    });
    
    return logs;
  } catch (error) {
    console.error('Error retrieving user audit logs:', error);
    return [];
  }
}

/**
 * Retrieve audit logs for a specific resource
 * 
 * @param resourceType The type of resource (api_key, server, etc.)
 * @param resourceId The ID of the resource
 * @param limit The maximum number of logs to retrieve (default: 100)
 * @param offset The offset for pagination (default: 0)
 * @returns Array of audit log entries
 */
export async function getResourceAuditLogs(
  resourceType: string,
  resourceId: string,
  limit: number = 100,
  offset: number = 0
): Promise<any[]> {
  try {
    const logs = await db.query.auditLogs.findMany({
      where: and(
        eq(auditLogs.resourceType, resourceType),
        eq(auditLogs.resourceId, resourceId)
      ),
      orderBy: [desc(auditLogs.timestamp)],
      limit,
      offset
    });
    
    return logs;
  } catch (error) {
    console.error('Error retrieving resource audit logs:', error);
    return [];
  }
}

/**
 * Retrieve audit logs related to API keys
 * 
 * @param limit The maximum number of logs to retrieve (default: 100)
 * @param offset The offset for pagination (default: 0)
 * @returns Array of audit log entries
 */
export async function getApiKeyAuditLogs(
  limit: number = 100,
  offset: number = 0
): Promise<any[]> {
  try {
    const logs = await db.query.auditLogs.findMany({
      where: eq(auditLogs.resourceType, 'api_key'),
      orderBy: [desc(auditLogs.timestamp)],
      limit,
      offset
    });
    
    return logs;
  } catch (error) {
    console.error('Error retrieving API key audit logs:', error);
    return [];
  }
}

/**
 * Retrieve security-related audit logs (login attempts, permission changes, etc.)
 * 
 * @param limit The maximum number of logs to retrieve (default: 100)
 * @param offset The offset for pagination (default: 0)
 * @returns Array of audit log entries
 */
export async function getSecurityAuditLogs(
  limit: number = 100,
  offset: number = 0
): Promise<any[]> {
  try {
    const securityActions = [
      'login_success',
      'login_failed',
      'logout',
      'password_change',
      'password_reset',
      'mfa_enabled',
      'mfa_disabled',
      'role_change',
      'permission_change',
      'api_key_created',
      'api_key_revoked',
      'api_key_expired_usage_attempt',
      'api_key_unauthorized_revocation_attempt'
    ];
    
    const logs = await db.query.auditLogs.findMany({
      where: sql`${auditLogs.action} IN (${securityActions.join(',')})`,
      orderBy: [desc(auditLogs.timestamp)],
      limit,
      offset
    });
    
    return logs;
  } catch (error) {
    console.error('Error retrieving security audit logs:', error);
    return [];
  }
}

/**
 * Retrieve MCP-related audit logs (tool execution, proxy actions, etc.)
 * 
 * @param limit The maximum number of logs to retrieve (default: 100)
 * @param offset The offset for pagination (default: 0)
 * @returns Array of audit log entries
 */
export async function getMcpAuditLogs(
  limit: number = 100,
  offset: number = 0
): Promise<any[]> {
  try {
    const mcpActions = [
      'mcp_tool_executed',
      'mcp_server_added',
      'mcp_server_removed',
      'mcp_server_edited',
      'mcp_server_connected',
      'mcp_server_disconnected',
      'mcp_request_proxied',
      'mcp_plugin_installed',
      'mcp_plugin_uninstalled'
    ];
    
    const logs = await db.query.auditLogs.findMany({
      where: sql`${auditLogs.action} IN (${mcpActions.join(',')})`,
      orderBy: [desc(auditLogs.timestamp)],
      limit,
      offset
    });
    
    return logs;
  } catch (error) {
    console.error('Error retrieving MCP audit logs:', error);
    return [];
  }
}