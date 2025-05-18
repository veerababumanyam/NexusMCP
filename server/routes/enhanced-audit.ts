/**
 * Enhanced Audit Logging Routes
 * 
 * Enterprise-grade audit log management with:
 * - Comprehensive log searching and filtering
 * - Log export in multiple formats
 * - Integrity verification
 * - Archive management
 * - Compliance reporting
 */

import { Router, Request, Response } from 'express';
import { enhancedAuditService } from '../services/enhancedAuditService';
import { createAuditLogFromRequest } from '../services/enhancedAuditService';
import { z } from 'zod';

// Create router
const router = Router();

// Validation schemas
const searchAuditLogsSchema = z.object({
  workspaceId: z.coerce.number().optional(),
  query: z.string().optional(),
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(50),
});

const getAuditLogsSchema = z.object({
  workspaceId: z.coerce.number().optional(),
  userId: z.coerce.number().optional(),
  serverId: z.coerce.number().optional(),
  actions: z.array(z.string()).optional(),
  resourceTypes: z.array(z.string()).optional(),
  resourceId: z.string().optional(),
  status: z.string().optional(),
  severity: z.string().optional(),
  correlationId: z.string().optional(),
  complianceCategory: z.string().optional(),
  fromDate: z.string().optional().transform(str => str ? new Date(str) : undefined),
  toDate: z.string().optional().transform(str => str ? new Date(str) : undefined),
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(50),
  orderBy: z.string().optional().default('createdAt'),
  orderDirection: z.enum(['asc', 'desc']).optional().default('desc'),
});

const exportLogsSchema = z.object({
  workspaceId: z.coerce.number().optional(),
  format: z.enum(['json', 'csv']).default('json'),
  fromDate: z.string().optional().transform(str => str ? new Date(str) : undefined),
  toDate: z.string().optional().transform(str => str ? new Date(str) : undefined),
  actions: z.array(z.string()).optional(),
  resourceTypes: z.array(z.string()).optional(),
  status: z.string().optional(),
  severity: z.string().optional(),
});

const verifyIntegritySchema = z.object({
  workspaceId: z.coerce.number().optional(),
  fromDate: z.string().optional().transform(str => str ? new Date(str) : undefined),
  toDate: z.string().optional().transform(str => str ? new Date(str) : undefined),
  limit: z.coerce.number().optional().default(100),
});

const archiveLogsSchema = z.object({
  workspaceId: z.coerce.number().optional(),
  olderThan: z.string().optional().transform(str => str ? new Date(str) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)),
  limit: z.coerce.number().optional().default(1000),
});

const complianceReportSchema = z.object({
  workspaceId: z.coerce.number(),
  complianceStandard: z.enum(['gdpr', 'hipaa', 'sox', 'pci-dss', 'iso27001']),
  fromDate: z.string().transform(str => new Date(str)),
  toDate: z.string().transform(str => new Date(str)),
});

const updateAuditSettingsSchema = z.object({
  workspaceId: z.coerce.number(),
  retentionPeriodDays: z.coerce.number().optional(),
  encryptionEnabled: z.boolean().optional(),
  maskPii: z.boolean().optional(),
  logLevel: z.string().optional(),
  alertingEnabled: z.boolean().optional(),
});

const updateAlertStatusSchema = z.object({
  status: z.enum(['acknowledged', 'resolved', 'false_positive']),
  notes: z.string().optional(),
});

/**
 * Get audit logs with filtering and pagination
 * GET /api/audit/logs
 */
router.get('/logs', async (req: Request, res: Response) => {
  try {
    // Validate query parameters
    const validatedParams = getAuditLogsSchema.parse(req.query);
    
    // Check for required permissions
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // If workspaceId is provided, ensure user has access
    if (validatedParams.workspaceId) {
      // In a real implementation, would check user's workspace permissions
      // For now, we'll assume the user has access to all workspaces
    }
    
    // Convert array parameters from string if needed
    let actions = validatedParams.actions;
    if (typeof req.query.actions === 'string') {
      actions = [req.query.actions];
    }
    
    let resourceTypes = validatedParams.resourceTypes;
    if (typeof req.query.resourceTypes === 'string') {
      resourceTypes = [req.query.resourceTypes];
    }
    
    // Perform query
    const result = await enhancedAuditService.getAuditLogs({
      ...validatedParams,
      actions,
      resourceTypes,
    });
    
    // Return result
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get a specific audit log by ID
 * GET /api/audit/logs/:id
 */
router.get('/logs/:id', async (req: Request, res: Response) => {
  try {
    // Validate ID
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }
    
    // Check for required permissions
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Get log
    const log = await enhancedAuditService.getAuditLog(id);
    
    // Check if log exists
    if (!log) {
      return res.status(404).json({ error: 'Audit log not found' });
    }
    
    // Return log
    return res.status(200).json(log);
  } catch (error) {
    console.error('Error fetching audit log:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Search audit logs with text-based search
 * GET /api/audit/search
 */
router.get('/search', async (req: Request, res: Response) => {
  try {
    // Validate query parameters
    const validatedParams = searchAuditLogsSchema.parse(req.query);
    
    // Check for required permissions
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // If workspaceId is provided, ensure user has access
    if (validatedParams.workspaceId) {
      // In a real implementation, would check user's workspace permissions
      // For now, we'll assume the user has access to all workspaces
    }
    
    // If no query is provided, return error
    if (!validatedParams.query) {
      return res.status(400).json({ error: 'Search query is required' });
    }
    
    // Perform search
    const result = await enhancedAuditService.searchAuditLogs({
      workspaceId: validatedParams.workspaceId,
      query: validatedParams.query,
      page: validatedParams.page,
      limit: validatedParams.limit,
    });
    
    // Add search to audit log
    await createAuditLogFromRequest(
      req,
      'search',
      'audit_logs',
      undefined,
      { query: validatedParams.query },
      validatedParams,
      { resultCount: result.total },
      { severity: 'info' }
    );
    
    // Return search results
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error searching audit logs:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Export audit logs in various formats
 * GET /api/audit/export
 */
router.get('/export', async (req: Request, res: Response) => {
  try {
    // Validate query parameters
    const validatedParams = exportLogsSchema.parse(req.query);
    
    // Check for required permissions
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // If workspaceId is provided, ensure user has access
    if (validatedParams.workspaceId) {
      // In a real implementation, would check user's workspace permissions
      // For now, we'll assume the user has access to all workspaces
    }
    
    // Convert array parameters from string if needed
    let actions = validatedParams.actions;
    if (typeof req.query.actions === 'string') {
      actions = [req.query.actions];
    }
    
    let resourceTypes = validatedParams.resourceTypes;
    if (typeof req.query.resourceTypes === 'string') {
      resourceTypes = [req.query.resourceTypes];
    }
    
    // Get logs based on filters using the dedicated export function
    const logs = await enhancedAuditService.exportAuditLogs({
      workspaceId: validatedParams.workspaceId,
      fromDate: validatedParams.fromDate,
      toDate: validatedParams.toDate,
      actions,
      resourceTypes,
      status: validatedParams.status,
      severity: validatedParams.severity,
      limit: 10000, // Use higher limit for exports
    });
    
    // Create a result object to match existing code structure
    const result = {
      logs,
      total: logs.length,
      page: 1,
      limit: 10000,
      totalPages: 1
    };
    
    // Format logs based on requested format
    if (validatedParams.format === 'csv') {
      // Set response headers
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${new Date().toISOString()}.csv"`);
      
      // Create CSV header
      const csvHeader = 'ID,Timestamp,User ID,Action,Resource Type,Resource ID,Status,Severity,Workspace ID,IP Address,Correlation ID\n';
      
      // Create CSV data
      const csvData = result.logs.map(log => {
        const row = [
          log.id,
          log.createdAt,
          log.userId || '',
          log.action,
          log.resourceType,
          log.resourceId || '',
          log.status,
          log.severity,
          log.workspaceId || '',
          log.ipAddress || '',
          log.correlationId || ''
        ];
        
        // Escape commas and quotes
        return row.map(cell => {
          const cellStr = String(cell);
          if (cellStr.includes(',') || cellStr.includes('"')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        }).join(',');
      }).join('\n');
      
      // Send CSV response
      return res.send(csvHeader + csvData);
    } else {
      // Set response headers
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="audit_logs_${new Date().toISOString()}.json"`);
      
      // Send JSON response
      return res.json({ 
        exportedAt: new Date(),
        logs: result.logs,
        total: result.total
      });
    }
  } catch (error) {
    console.error('Error exporting audit logs:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Verify the integrity of audit logs
 * POST /api/audit/verify-integrity
 */
router.post('/verify-integrity', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedParams = verifyIntegritySchema.parse(req.body);
    
    // Check for required permissions
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Ensure user has admin permissions
    // In a real implementation, would check user's admin permissions
    // For now, we'll assume the user has admin access
    
    // Verify integrity
    const result = await enhancedAuditService.verifyAuditLogIntegrity(validatedParams);
    
    // Add verification to audit log
    await createAuditLogFromRequest(
      req,
      'verify',
      'audit_logs',
      undefined,
      { 
        verified: result.verified,
        totalChecked: result.totalChecked,
        issueCount: result.issueCount
      },
      validatedParams,
      result,
      { 
        severity: result.verified ? 'info' : 'high',
        status: result.verified ? 'success' : 'failure'
      }
    );
    
    // Return verification result
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error verifying audit logs:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Archive audit logs
 * POST /api/audit/archive
 */
router.post('/archive', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedParams = archiveLogsSchema.parse(req.body);
    
    // Check for required permissions
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Ensure user has admin permissions
    // In a real implementation, would check user's admin permissions
    // For now, we'll assume the user has admin access
    
    // Archive logs
    const result = await enhancedAuditService.archiveAuditLogs(validatedParams);
    
    // Add archiving to audit log
    await createAuditLogFromRequest(
      req,
      'archive',
      'audit_logs',
      undefined,
      { 
        batchId: result.batchId,
        recordCount: result.recordCount
      },
      validatedParams,
      result,
      { severity: 'info' }
    );
    
    // Return archiving result
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error archiving audit logs:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get audit log archives
 * GET /api/audit/archives
 */
router.get('/archives', async (req: Request, res: Response) => {
  try {
    // Parse query parameters
    const workspaceId = req.query.workspaceId 
      ? parseInt(req.query.workspaceId as string) 
      : undefined;
    
    // Check for required permissions
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Ensure user has admin permissions
    // In a real implementation, would check user's admin permissions
    // For now, we'll assume the user has admin access
    
    // Get archives
    const archives = await enhancedAuditService.getAuditArchives(workspaceId);
    
    // Return archives
    return res.status(200).json(archives);
  } catch (error) {
    console.error('Error getting audit archives:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Generate a compliance report
 * POST /api/audit/compliance-report
 */
router.post('/compliance-report', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedParams = complianceReportSchema.parse(req.body);
    
    // Check for required permissions
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Ensure user has admin permissions
    // In a real implementation, would check user's admin permissions
    // For now, we'll assume the user has admin access
    
    // Generate report
    const result = await enhancedAuditService.generateComplianceReport(validatedParams);
    
    // Add report generation to audit log
    await createAuditLogFromRequest(
      req,
      'generate',
      'compliance_report',
      result.reportId,
      { 
        standard: validatedParams.complianceStandard,
        workspaceId: validatedParams.workspaceId
      },
      validatedParams,
      result,
      { severity: 'info' }
    );
    
    // Return report result
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error generating compliance report:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get audit settings
 * GET /api/audit/settings
 */
router.get('/settings', async (req: Request, res: Response) => {
  try {
    // Parse query parameters
    const workspaceId = req.query.workspaceId 
      ? parseInt(req.query.workspaceId as string) 
      : undefined;
    
    // Check for required permissions
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Get settings
    const settings = await enhancedAuditService.getAuditSettings(workspaceId);
    
    // Return settings
    return res.status(200).json(settings);
  } catch (error) {
    console.error('Error getting audit settings:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Update audit settings
 * PUT /api/audit/settings/:workspaceId
 */
router.put('/settings/:workspaceId', async (req: Request, res: Response) => {
  try {
    // Validate path parameter
    const workspaceId = parseInt(req.params.workspaceId);
    if (isNaN(workspaceId)) {
      return res.status(400).json({ error: 'Invalid workspace ID' });
    }
    
    // Validate request body
    const validatedParams = updateAuditSettingsSchema.safeParse(req.body);
    if (!validatedParams.success) {
      return res.status(400).json({ 
        error: 'Invalid request body',
        details: validatedParams.error.errors
      });
    }
    
    // Check for required permissions
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Ensure user has admin permissions
    // In a real implementation, would check user's admin permissions
    // For now, we'll assume the user has admin access
    
    // Update settings
    const settings = await enhancedAuditService.updateAuditSettings(
      workspaceId,
      validatedParams.data
    );
    
    // Add settings update to audit log
    await createAuditLogFromRequest(
      req,
      'update',
      'audit_settings',
      workspaceId.toString(),
      { 
        workspaceId,
        settings: validatedParams.data
      },
      req.body,
      settings,
      { severity: 'medium' }
    );
    
    // Return updated settings
    return res.status(200).json(settings);
  } catch (error) {
    console.error('Error updating audit settings:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get alerts
 * GET /api/audit/alerts
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    // Parse query parameters
    const options = {
      workspaceId: req.query.workspaceId ? parseInt(req.query.workspaceId as string) : undefined,
      status: req.query.status as string,
      severity: req.query.severity as string
    };
    
    // Check for required permissions
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Get alerts
    const alerts = await enhancedAuditService.getAlerts(options);
    
    // Return alerts
    return res.status(200).json(alerts);
  } catch (error) {
    console.error('Error getting alerts:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Update alert status
 * PUT /api/audit/alerts/:id
 */
router.put('/alerts/:id', async (req: Request, res: Response) => {
  try {
    // Validate path parameter
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid alert ID' });
    }
    
    // Validate request body
    const validatedParams = updateAlertStatusSchema.safeParse(req.body);
    if (!validatedParams.success) {
      return res.status(400).json({ 
        error: 'Invalid request body',
        details: validatedParams.error.errors
      });
    }
    
    // Check for required permissions
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Update alert status
    const updatedAlert = await enhancedAuditService.updateAlertStatus(
      id,
      validatedParams.data.status,
      validatedParams.data.notes
    );
    
    // Add alert update to audit log
    await createAuditLogFromRequest(
      req,
      'update',
      'alert',
      id.toString(),
      { 
        alertId: id,
        status: validatedParams.data.status
      },
      req.body,
      updatedAlert,
      { severity: 'medium' }
    );
    
    // Return updated alert
    return res.status(200).json(updatedAlert);
  } catch (error) {
    console.error('Error updating alert status:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Export router
export default router;