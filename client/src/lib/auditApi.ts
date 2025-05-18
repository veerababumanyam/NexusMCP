import { apiRequest, getQueryFn, queryClient } from '@/lib/queryClient';
import { EnhancedAuditLog, AuditSettings, AlertEvent } from '@shared/schema_audit';

/**
 * Interface for audit log query options
 */
export interface AuditLogQueryOptions {
  userId?: number;
  workspaceId?: number;
  serverId?: number;
  actions?: string[];
  resourceTypes?: string[];
  resourceId?: string;
  status?: string;
  severity?: string;
  fromDate?: Date;
  toDate?: Date;
  correlationId?: string;
  complianceCategory?: string;
  tags?: string[];
  page?: number;
  limit?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
}

/**
 * Interface for audit log search results
 */
export interface AuditLogSearchResults {
  logs: EnhancedAuditLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Interface for integrity verification results
 */
export interface IntegrityVerificationResults {
  verified: boolean;
  totalChecked: number;
  issueCount: number;
  issues?: Array<{ id: number; reason: string }>;
}

/**
 * Interface for audit archive results
 */
export interface AuditArchiveResults {
  batchId: string;
  recordCount: number;
  fromTimestamp: Date;
  toTimestamp: Date;
}

/**
 * Get audit logs with optional filtering and pagination
 */
export async function getAuditLogs(options: AuditLogQueryOptions = {}): Promise<AuditLogSearchResults> {
  try {
    // Build query params
    const params = new URLSearchParams();
    
    if (options.userId) params.append('userId', options.userId.toString());
    if (options.workspaceId) params.append('workspaceId', options.workspaceId.toString());
    if (options.serverId) params.append('serverId', options.serverId.toString());
    if (options.actions && options.actions.length > 0) {
      options.actions.forEach(action => params.append('actions', action));
    }
    if (options.resourceTypes && options.resourceTypes.length > 0) {
      options.resourceTypes.forEach(type => params.append('resourceTypes', type));
    }
    if (options.resourceId) params.append('resourceId', options.resourceId);
    if (options.status) params.append('status', options.status);
    if (options.severity) params.append('severity', options.severity);
    if (options.fromDate) params.append('fromDate', options.fromDate.toISOString());
    if (options.toDate) params.append('toDate', options.toDate.toISOString());
    if (options.correlationId) params.append('correlationId', options.correlationId);
    if (options.complianceCategory) params.append('complianceCategory', options.complianceCategory);
    if (options.tags && options.tags.length > 0) {
      options.tags.forEach(tag => params.append('tags', tag));
    }
    if (options.page) params.append('page', options.page.toString());
    if (options.limit) params.append('limit', options.limit.toString());
    if (options.orderBy) params.append('orderBy', options.orderBy);
    if (options.orderDirection) params.append('orderDirection', options.orderDirection);
    
    // Get audit logs
    const response = await apiRequest('GET', `/api/audit/logs?${params.toString()}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch audit logs');
  }
}

/**
 * Get a single audit log by ID
 */
export async function getAuditLog(id: number): Promise<EnhancedAuditLog> {
  try {
    const response = await apiRequest('GET', `/api/audit/logs/${id}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching audit log:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch audit log');
  }
}

/**
 * Search audit logs with text matching
 */
export async function searchAuditLogs(
  query: string,
  options: { workspaceId?: number; page?: number; limit?: number } = {}
): Promise<AuditLogSearchResults> {
  try {
    // Build query params
    const params = new URLSearchParams();
    params.append('query', query);
    
    if (options.workspaceId) params.append('workspaceId', options.workspaceId.toString());
    if (options.page) params.append('page', options.page.toString());
    if (options.limit) params.append('limit', options.limit.toString());
    
    // Search audit logs
    const response = await apiRequest('GET', `/api/audit/search?${params.toString()}`);
    return await response.json();
  } catch (error) {
    console.error('Error searching audit logs:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to search audit logs');
  }
}

/**
 * Export audit logs
 */
export async function exportAuditLogs(options: {
  format: 'json' | 'csv';
  workspaceId?: number;
  fromDate?: Date;
  toDate?: Date;
  actions?: string[];
  resourceTypes?: string[];
  severity?: string;
  status?: string;
}): Promise<void> {
  try {
    // Build query params
    const params = new URLSearchParams();
    params.append('format', options.format);
    
    if (options.workspaceId) params.append('workspaceId', options.workspaceId.toString());
    if (options.fromDate) params.append('fromDate', options.fromDate.toISOString());
    if (options.toDate) params.append('toDate', options.toDate.toISOString());
    if (options.actions && options.actions.length > 0) {
      options.actions.forEach(action => params.append('actions', action));
    }
    if (options.resourceTypes && options.resourceTypes.length > 0) {
      options.resourceTypes.forEach(type => params.append('resourceTypes', type));
    }
    if (options.severity) params.append('severity', options.severity);
    if (options.status) params.append('status', options.status);
    
    // Initiate export (this will trigger a download in the browser)
    window.location.href = `/api/audit/export?${params.toString()}`;
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to export audit logs');
  }
}

/**
 * Verify audit log integrity
 */
export async function verifyAuditLogIntegrity(options: {
  workspaceId?: number;
  fromDate?: Date;
  toDate?: Date;
  limit?: number;
}): Promise<IntegrityVerificationResults> {
  try {
    // Send request to verify integrity
    const response = await apiRequest('POST', '/api/audit/verify-integrity', options);
    return await response.json();
  } catch (error) {
    console.error('Error verifying audit log integrity:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to verify audit log integrity');
  }
}

/**
 * Archive audit logs
 */
export async function archiveAuditLogs(options: {
  workspaceId?: number;
  olderThan?: Date;
  limit?: number;
}): Promise<AuditArchiveResults> {
  try {
    // Send request to archive logs
    const response = await apiRequest('POST', '/api/audit/archive', options);
    return await response.json();
  } catch (error) {
    console.error('Error archiving audit logs:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to archive audit logs');
  }
}

/**
 * Get audit log archives
 */
export async function getAuditArchives(workspaceId?: number): Promise<any[]> {
  try {
    // Build query params
    const params = new URLSearchParams();
    if (workspaceId) params.append('workspaceId', workspaceId.toString());
    
    // Get archives
    const response = await apiRequest('GET', `/api/audit/archives?${params.toString()}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching audit archives:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch audit archives');
  }
}

/**
 * Get audit settings for a workspace
 */
export async function getAuditSettings(workspaceId?: number): Promise<AuditSettings> {
  try {
    // Build query params
    const params = new URLSearchParams();
    if (workspaceId) params.append('workspaceId', workspaceId.toString());
    
    // Get settings
    const response = await apiRequest('GET', `/api/audit/settings?${params.toString()}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching audit settings:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch audit settings');
  }
}

/**
 * Update audit settings for a workspace
 */
export async function updateAuditSettings(
  workspaceId: number,
  settings: Partial<AuditSettings>
): Promise<AuditSettings> {
  try {
    // Update settings
    const response = await apiRequest('PUT', `/api/audit/settings/${workspaceId}`, settings);
    
    // Invalidate settings cache
    queryClient.invalidateQueries({ queryKey: ['/api/audit/settings', workspaceId] });
    
    return await response.json();
  } catch (error) {
    console.error('Error updating audit settings:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to update audit settings');
  }
}

/**
 * Get alerts for a workspace
 */
export async function getAlerts(options: {
  workspaceId?: number;
  status?: string;
  severity?: string;
} = {}): Promise<AlertEvent[]> {
  try {
    // Build query params
    const params = new URLSearchParams();
    if (options.workspaceId) params.append('workspaceId', options.workspaceId.toString());
    if (options.status) params.append('status', options.status);
    if (options.severity) params.append('severity', options.severity);
    
    // Get alerts
    const response = await apiRequest('GET', `/api/audit/alerts?${params.toString()}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching alerts:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to fetch alerts');
  }
}

/**
 * Update alert status
 */
export async function updateAlertStatus(
  id: number,
  status: 'acknowledged' | 'resolved' | 'false_positive',
  notes?: string
): Promise<any> {
  try {
    // Update alert status
    const response = await apiRequest('PUT', `/api/audit/alerts/${id}`, { status, notes });
    
    // Invalidate alerts cache
    queryClient.invalidateQueries({ queryKey: ['/api/audit/alerts'] });
    
    return await response.json();
  } catch (error) {
    console.error('Error updating alert status:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to update alert status');
  }
}

/**
 * Generate a compliance report
 */
export async function generateComplianceReport(options: {
  workspaceId: number;
  complianceStandard: 'gdpr' | 'hipaa' | 'sox' | 'pci-dss' | 'iso27001';
  fromDate: Date;
  toDate: Date;
}): Promise<any> {
  try {
    // Generate report
    const response = await apiRequest('POST', '/api/audit/compliance-report', options);
    return await response.json();
  } catch (error) {
    console.error('Error generating compliance report:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to generate compliance report');
  }
}