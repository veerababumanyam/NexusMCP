/**
 * Audit Service
 * 
 * Provides a unified interface for logging audit events across the application.
 * Supports different event types, severity levels, and detailed contextual information.
 */

import { db } from '@db';
import { auditLogs } from '@shared/schema';

export interface AuditLogData {
  action: string;
  userId?: number;
  workspaceId?: number | null;
  serverId?: number;
  resourceId?: string;
  resourceType?: string;
  targetType?: string;
  targetId?: number | string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  status?: 'success' | 'failure';
  ip?: string;
  userAgent?: string;
  details?: any;
}

/**
 * Create an audit log entry
 */
export async function createAuditLog(data: AuditLogData): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      action: data.action,
      userId: data.userId || null,
      workspaceId: data.workspaceId || null,
      serverId: data.serverId || null,
      resourceId: data.resourceId || null,
      resourceType: data.resourceType || null,
      targetType: data.targetType || null,
      targetId: data.targetId?.toString() || null,
      severity: data.severity || 'info',
      status: data.status || 'success',
      ip: data.ip || null,
      userAgent: data.userAgent || null,
      details: data.details || null,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error creating audit log:', error);
    // We don't throw here to prevent audit logging failures from affecting the main application flow
  }
}

/**
 * Get audit logs with filtering and pagination
 */
export async function getAuditLogs({
  workspaceId,
  userId,
  action,
  resourceType,
  resourceId,
  severity,
  status,
  startTime,
  endTime,
  page = 1,
  limit = 50,
  sortField = 'timestamp',
  sortOrder = 'desc'
}: {
  workspaceId?: number;
  userId?: number;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  severity?: 'info' | 'warning' | 'error' | 'critical';
  status?: 'success' | 'failure';
  startTime?: Date;
  endTime?: Date;
  page?: number;
  limit?: number;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}) {
  try {
    let query = db.select().from(auditLogs);
    
    // Apply filters
    if (workspaceId) {
      query = query.where(eq(auditLogs.workspaceId, workspaceId));
    }
    
    if (userId) {
      query = query.where(eq(auditLogs.userId, userId));
    }
    
    if (action) {
      query = query.where(eq(auditLogs.action, action));
    }
    
    if (resourceType) {
      query = query.where(eq(auditLogs.resourceType, resourceType));
    }
    
    if (resourceId) {
      query = query.where(eq(auditLogs.resourceId, resourceId));
    }
    
    if (severity) {
      query = query.where(eq(auditLogs.severity, severity));
    }
    
    if (status) {
      query = query.where(eq(auditLogs.status, status));
    }
    
    if (startTime && endTime) {
      query = query.where(
        and(
          gte(auditLogs.timestamp, startTime),
          lte(auditLogs.timestamp, endTime)
        )
      );
    } else if (startTime) {
      query = query.where(gte(auditLogs.timestamp, startTime));
    } else if (endTime) {
      query = query.where(lte(auditLogs.timestamp, endTime));
    }
    
    // Count total matching records (without pagination)
    const countQuery = db.select({ count: count() }).from(auditLogs);
    
    // Apply the same filters to count query
    let filteredCountQuery = countQuery;
    if (workspaceId) {
      filteredCountQuery = filteredCountQuery.where(eq(auditLogs.workspaceId, workspaceId));
    }
    
    if (userId) {
      filteredCountQuery = filteredCountQuery.where(eq(auditLogs.userId, userId));
    }
    
    if (action) {
      filteredCountQuery = filteredCountQuery.where(eq(auditLogs.action, action));
    }
    
    if (resourceType) {
      filteredCountQuery = filteredCountQuery.where(eq(auditLogs.resourceType, resourceType));
    }
    
    if (resourceId) {
      filteredCountQuery = filteredCountQuery.where(eq(auditLogs.resourceId, resourceId));
    }
    
    if (severity) {
      filteredCountQuery = filteredCountQuery.where(eq(auditLogs.severity, severity));
    }
    
    if (status) {
      filteredCountQuery = filteredCountQuery.where(eq(auditLogs.status, status));
    }
    
    if (startTime && endTime) {
      filteredCountQuery = filteredCountQuery.where(
        and(
          gte(auditLogs.timestamp, startTime),
          lte(auditLogs.timestamp, endTime)
        )
      );
    } else if (startTime) {
      filteredCountQuery = filteredCountQuery.where(gte(auditLogs.timestamp, startTime));
    } else if (endTime) {
      filteredCountQuery = filteredCountQuery.where(lte(auditLogs.timestamp, endTime));
    }
    
    const totalCountResult = await filteredCountQuery;
    const totalCount = totalCountResult[0]?.count || 0;
    
    // Apply sorting
    if (sortField === 'timestamp') {
      query = query.orderBy(
        sortOrder === 'asc' ? asc(auditLogs.timestamp) : desc(auditLogs.timestamp)
      );
    } else if (sortField === 'action') {
      query = query.orderBy(
        sortOrder === 'asc' ? asc(auditLogs.action) : desc(auditLogs.action)
      );
    } else if (sortField === 'severity') {
      query = query.orderBy(
        sortOrder === 'asc' ? asc(auditLogs.severity) : desc(auditLogs.severity)
      );
    } else if (sortField === 'status') {
      query = query.orderBy(
        sortOrder === 'asc' ? asc(auditLogs.status) : desc(auditLogs.status)
      );
    }
    
    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.limit(limit).offset(offset);
    
    // Execute query
    const logs = await query;
    
    return {
      logs,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    };
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    throw error;
  }
}

// Import missing operators
import { eq, and, gte, lte, asc, desc, count } from 'drizzle-orm';