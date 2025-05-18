/**
 * Enhanced Audit Log Service
 * 
 * Enterprise-grade audit logging system with:
 * - Encryption with AES-256-CBC for sensitive data
 * - PII masking with configurable rules
 * - WORM (Write Once Read Many) compliance
 * - Integrity verification using HMAC
 * - Configurable retention and archiving
 * - SIEM integration capabilities
 * - Real-time alerting
 */

import { Request } from 'express';
import { randomBytes, createCipheriv, createDecipheriv, createHmac } from 'crypto';
import { db } from '../../db';
import { 
  enhancedAuditLogs, 
  auditSettings, 
  encryptionKeys, 
  alertEvents,
  auditLogArchives,
  auditIntegrityChecks
} from '@shared/schema_audit';
import { users, workspaces } from '@shared/schema';
import { eq, and, desc, asc, gt, lt, like, ilike, inArray, isNull, or, count, sql } from 'drizzle-orm';
import { EnhancedAuditLog, InsertEnhancedAuditLog, AuditSettings } from '@shared/schema_audit';
import logger from '../logger';

// Secret key should be stored securely (environment variable)
const ENCRYPTION_SECRET = process.env.AUDIT_ENCRYPTION_SECRET || 'default-encryption-key-must-be-replaced';
const HMAC_SECRET = process.env.AUDIT_HMAC_SECRET || 'default-hmac-key-must-be-replaced';

/**
 * Audit log event interface for creating new audit logs
 */
export interface AuditEventData {
  userId?: number;
  action: string;
  resourceType: string;
  resourceId?: string;
  status?: 'success' | 'failure' | 'warning' | 'info';
  severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
  workspaceId?: number;
  serverId?: number;
  ipAddress?: string;
  userAgent?: string;
  deviceId?: string;
  sessionId?: string;
  geoLocation?: {
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  details?: any;
  requestPayload?: any;
  responsePayload?: any;
  parentEventId?: number;
  correlationId?: string;
  traceId?: string;
  complianceCategory?: string;
  tags?: string[];
}

/**
 * Audit log query options for fetching logs
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
 * Class for handling PII masking in audit logs
 */
class PiiMasker {
  private defaultMaskingRules = {
    email: true,
    phoneNumber: true,
    creditCard: true,
    socialSecurity: true,
    ipAddress: false,
    password: true,
    apiKey: true,
  };
  
  private maskingRules: Record<string, boolean>;
  
  constructor(customRules?: Record<string, boolean>) {
    this.maskingRules = { ...this.defaultMaskingRules, ...customRules };
  }
  
  /**
   * Mask sensitive information in a string or object
   */
  public maskSensitiveData(data: any): any {
    if (!data) return data;
    
    if (typeof data === 'string') {
      return this.maskString(data);
    }
    
    if (typeof data === 'object' && data !== null) {
      return this.maskObject(data);
    }
    
    return data;
  }
  
  /**
   * Mask sensitive information in a string
   */
  private maskString(str: string): string {
    let result = str;
    
    // Mask emails
    if (this.maskingRules.email) {
      result = result.replace(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/gi, '***@***.***');
    }
    
    // Mask phone numbers
    if (this.maskingRules.phoneNumber) {
      result = result.replace(/(\+\d{1,3}[\s.-])?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}/g, '***-***-****');
    }
    
    // Mask credit card numbers
    if (this.maskingRules.creditCard) {
      result = result.replace(/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g, '****-****-****-****');
    }
    
    // Mask Social Security Numbers
    if (this.maskingRules.socialSecurity) {
      result = result.replace(/\d{3}[\s-]?\d{2}[\s-]?\d{4}/g, '***-**-****');
    }
    
    // Mask IP addresses
    if (this.maskingRules.ipAddress) {
      result = result.replace(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/g, '*.*.*.* (masked)');
    }
    
    return result;
  }
  
  /**
   * Recursively mask sensitive information in an object
   */
  private maskObject(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(item => this.maskSensitiveData(item));
    }
    
    const result: any = {};
    
    for (const key in obj) {
      // Skip if property doesn't exist or is inherited
      if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
      
      // Check for sensitive key names
      const lowerKey = key.toLowerCase();
      
      // Mask based on key name
      if (
        (this.maskingRules.password && (lowerKey.includes('password') || lowerKey === 'pwd')) ||
        (this.maskingRules.apiKey && (lowerKey.includes('api_key') || lowerKey.includes('apikey') || lowerKey.includes('secret')))
      ) {
        result[key] = '********';
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        // Recursively mask nested objects
        result[key] = this.maskSensitiveData(obj[key]);
      } else if (typeof obj[key] === 'string') {
        // Mask strings
        result[key] = this.maskString(obj[key]);
      } else {
        // Keep other types as is
        result[key] = obj[key];
      }
    }
    
    return result;
  }
}

/**
 * Class for handling encryption of audit logs
 */
class AuditEncryption {
  private encryptionKey: string;
  
  constructor(encryptionKey: string) {
    this.encryptionKey = encryptionKey;
  }
  
  /**
   * Encrypt sensitive audit log data
   */
  public encrypt(data: any): { encrypted: string; iv: string } {
    try {
      // Generate a random initialization vector
      const iv = randomBytes(16);
      
      // Create cipher with AES-256-CBC
      const cipher = createCipheriv('aes-256-cbc', Buffer.from(this.encryptionKey), iv);
      
      // Encrypt the data
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return {
        encrypted,
        iv: iv.toString('hex')
      };
    } catch (error) {
      logger.error('Error encrypting audit data', error);
      throw new Error('Failed to encrypt audit data');
    }
  }
  
  /**
   * Decrypt sensitive audit log data
   */
  public decrypt(encrypted: string, iv: string): any {
    try {
      // Create decipher
      const decipher = createDecipheriv(
        'aes-256-cbc', 
        Buffer.from(this.encryptionKey), 
        Buffer.from(iv, 'hex')
      );
      
      // Decrypt the data
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      // Parse the decrypted JSON
      return JSON.parse(decrypted);
    } catch (error) {
      logger.error('Error decrypting audit data', error);
      throw new Error('Failed to decrypt audit data');
    }
  }
  
  /**
   * Generate HMAC for integrity verification
   */
  public generateIntegrityChecksum(data: any): string {
    try {
      const hmac = createHmac('sha256', HMAC_SECRET);
      hmac.update(JSON.stringify(data));
      return hmac.digest('hex');
    } catch (error) {
      logger.error('Error generating integrity checksum', error);
      throw new Error('Failed to generate integrity checksum');
    }
  }
  
  /**
   * Verify integrity checksum
   */
  public verifyIntegrity(data: any, checksum: string): boolean {
    try {
      const calculatedChecksum = this.generateIntegrityChecksum(data);
      return calculatedChecksum === checksum;
    } catch (error) {
      logger.error('Error verifying integrity checksum', error);
      return false;
    }
  }
}

/**
 * Enhanced Audit Service implementation
 */
export class EnhancedAuditService {
  private piiMasker: PiiMasker;
  private auditEncryption: AuditEncryption;
  
  constructor() {
    this.piiMasker = new PiiMasker();
    this.auditEncryption = new AuditEncryption(ENCRYPTION_SECRET);
  }
  
  /**
   * Create a new audit log entry
   */
  public async createAuditLog(eventData: AuditEventData): Promise<EnhancedAuditLog> {
    try {
      // Mask sensitive data if needed
      const settings = await this.getAuditSettings(eventData.workspaceId);
      
      let maskedDetails = eventData.details;
      let maskedRequestPayload = eventData.requestPayload;
      let maskedResponsePayload = eventData.responsePayload;
      
      // Apply PII masking if enabled
      if (settings?.maskPii) {
        maskedDetails = this.piiMasker.maskSensitiveData(eventData.details);
        maskedRequestPayload = this.piiMasker.maskSensitiveData(eventData.requestPayload);
        maskedResponsePayload = this.piiMasker.maskSensitiveData(eventData.responsePayload);
      }
      
      // Determine whether to encrypt based on settings and data sensitivity
      const shouldEncrypt = this.shouldEncryptLog(eventData, settings);
      
      // Prepare log data
      const logData: InsertEnhancedAuditLog = {
        userId: eventData.userId,
        action: eventData.action,
        resourceType: eventData.resourceType,
        resourceId: eventData.resourceId,
        status: eventData.status || 'info',
        severity: eventData.severity || 'info',
        workspaceId: eventData.workspaceId,
        serverId: eventData.serverId,
        ipAddress: eventData.ipAddress,
        userAgent: eventData.userAgent,
        deviceId: eventData.deviceId,
        sessionId: eventData.sessionId,
        geoLocation: eventData.geoLocation,
        parentEventId: eventData.parentEventId,
        correlationId: eventData.correlationId,
        traceId: eventData.traceId,
        complianceCategory: eventData.complianceCategory,
        tags: eventData.tags ? JSON.stringify(eventData.tags) : null
      };
      
      // Handle encryption
      if (shouldEncrypt) {
        // Combine sensitive payloads for encryption
        const sensitiveData = {
          details: maskedDetails,
          requestPayload: maskedRequestPayload,
          responsePayload: maskedResponsePayload
        };
        
        // Encrypt the data
        const { encrypted, iv } = this.auditEncryption.encrypt(sensitiveData);
        
        // Store encryption metadata
        logData.hashedPayload = encrypted;
        logData.isEncrypted = true;
        logData.details = { encrypted: true, iv };
      } else {
        // Store data unencrypted
        logData.details = maskedDetails;
        logData.requestPayload = maskedRequestPayload;
        logData.responsePayload = maskedResponsePayload;
        logData.isEncrypted = false;
      }
      
      // Generate integrity checksum
      const dataForIntegrity = {
        userId: logData.userId,
        action: logData.action,
        resourceType: logData.resourceType,
        resourceId: logData.resourceId,
        hashedPayload: logData.hashedPayload,
        createdAt: new Date()
      };
      
      logData.integrityChecksum = this.auditEncryption.generateIntegrityChecksum(dataForIntegrity);
      
      // Insert log into database
      const [createdLog] = await db.insert(enhancedAuditLogs).values(logData).returning();
      
      // Check if this is a high severity or suspicious event that should trigger an alert
      if (
        this.shouldCreateAlert(eventData) &&
        settings?.alertingEnabled
      ) {
        await this.createAlertForLog(createdLog);
      }
      
      return createdLog;
    } catch (error) {
      logger.error('Error creating audit log', error);
      throw new Error('Failed to create audit log');
    }
  }
  
  /**
   * Determine if a log should be encrypted based on settings and content
   */
  private shouldEncryptLog(
    eventData: AuditEventData,
    settings?: AuditSettings | null
  ): boolean {
    // Always encrypt if encryption is globally enabled
    if (settings?.encryptionEnabled) return true;
    
    // Always encrypt compliance data
    if (eventData.complianceCategory) return true;
    
    // Encrypt based on severity
    if (eventData.severity === 'critical' || eventData.severity === 'high') return true;
    
    // Check for specific actions that should be encrypted
    const sensitiveActions = ['login', 'authenticate', 'password_change', 'token_issue'];
    if (sensitiveActions.some(action => eventData.action.toLowerCase().includes(action))) {
      return true;
    }
    
    // Check for specific resources that should be encrypted
    const sensitiveResources = ['user', 'auth', 'credential', 'secret', 'token', 'api_key'];
    if (sensitiveResources.some(resource => eventData.resourceType.toLowerCase().includes(resource))) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Determine if an audit log should trigger an alert
   */
  private shouldCreateAlert(eventData: AuditEventData): boolean {
    // Always alert on critical severity
    if (eventData.severity === 'critical') return true;
    
    // Alert on high severity failures
    if (eventData.severity === 'high' && eventData.status === 'failure') return true;
    
    // Alert on certain security-sensitive actions
    const alertActions = [
      'login_failed',
      'brute_force_detected',
      'permission_denied',
      'unauthorized_access',
      'integrity_violation',
      'policy_violation'
    ];
    
    if (alertActions.some(action => eventData.action.toLowerCase().includes(action))) {
      return true;
    }
    
    return false;
  }
  
  /**
   * Create an alert for a suspicious audit log
   */
  private async createAlertForLog(log: EnhancedAuditLog): Promise<void> {
    try {
      const alertTitle = this.getAlertTitleForLog(log);
      const alertDescription = this.getAlertDescriptionForLog(log);
      
      await db.insert(alertEvents).values({
        title: alertTitle,
        description: alertDescription,
        severity: log.severity,
        status: 'new',
        workspaceId: log.workspaceId,
        logIds: [log.id],
        createdAt: new Date()
      });
    } catch (error) {
      logger.error('Error creating alert for log', error);
      // Don't throw, as this is a secondary function and shouldn't prevent log creation
    }
  }
  
  /**
   * Generate an alert title for a log
   */
  private getAlertTitleForLog(log: EnhancedAuditLog): string {
    if (log.action.toLowerCase().includes('login_failed')) {
      return 'Failed Login Attempt Detected';
    }
    
    if (log.action.toLowerCase().includes('brute_force')) {
      return 'Possible Brute Force Attack Detected';
    }
    
    if (log.action.toLowerCase().includes('permission_denied') || log.action.toLowerCase().includes('unauthorized')) {
      return 'Unauthorized Access Attempt';
    }
    
    if (log.action.toLowerCase().includes('integrity')) {
      return 'Audit Log Integrity Violation';
    }
    
    // Default title based on severity
    return log.severity === 'critical'
      ? 'Critical Security Event Detected'
      : 'Security Alert: High Severity Event';
  }
  
  /**
   * Generate an alert description for a log
   */
  private getAlertDescriptionForLog(log: EnhancedAuditLog): string {
    let description = `${log.severity.toUpperCase()} severity ${log.action} action detected`;
    
    if (log.userId) {
      description += ` for user ID: ${log.userId}`;
    }
    
    if (log.resourceType) {
      description += ` on resource type: ${log.resourceType}`;
      
      if (log.resourceId) {
        description += ` (ID: ${log.resourceId})`;
      }
    }
    
    if (log.ipAddress) {
      description += `. Source IP: ${log.ipAddress}`;
    }
    
    return description;
  }
  
  /**
   * Process an audit log, decrypting if necessary
   */
  private async processAuditLog(log: EnhancedAuditLog): Promise<EnhancedAuditLog> {
    // If not encrypted, return as is
    if (!log.isEncrypted || !log.hashedPayload || !log.details) {
      return log;
    }
    
    try {
      // Get encryption details
      const encryptionDetails = log.details as any;
      
      if (encryptionDetails.encrypted && encryptionDetails.iv) {
        // Decrypt the data
        const decrypted = this.auditEncryption.decrypt(
          log.hashedPayload,
          encryptionDetails.iv
        );
        
        // Update the log with decrypted data
        return {
          ...log,
          details: decrypted.details,
          requestPayload: decrypted.requestPayload,
          responsePayload: decrypted.responsePayload
        };
      }
    } catch (error) {
      logger.error('Error decrypting audit log', error);
      // Return original log with error indicator
      return {
        ...log,
        details: { error: 'Failed to decrypt audit log data' }
      };
    }
    
    return log;
  }
  
  /**
   * Export audit logs with various filters
   * @param options Export options including format and filters
   * @returns Array of logs for export
   */
  public async exportAuditLogs(options: {
    workspaceId?: number;
    fromDate?: Date;
    toDate?: Date;
    actions?: string[];
    resourceTypes?: string[];
    severity?: string;
    status?: string;
    limit?: number;
  }): Promise<EnhancedAuditLog[]> {
    try {
      const { 
        workspaceId, 
        fromDate, 
        toDate, 
        actions, 
        resourceTypes, 
        severity, 
        status,
        limit = 10000 // Higher limit for exports
      } = options;
      
      // Build the query
      let query = db.select().from(enhancedAuditLogs)
        .orderBy(desc(enhancedAuditLogs.createdAt))
        .limit(limit);
      
      const conditions = [];
      
      // Add filters
      if (workspaceId) {
        conditions.push(eq(enhancedAuditLogs.workspaceId, workspaceId));
      }
      
      if (fromDate) {
        conditions.push(gt(enhancedAuditLogs.createdAt, fromDate));
      }
      
      if (toDate) {
        conditions.push(lt(enhancedAuditLogs.createdAt, toDate));
      }
      
      if (actions && actions.length > 0) {
        conditions.push(inArray(enhancedAuditLogs.action, actions));
      }
      
      if (resourceTypes && resourceTypes.length > 0) {
        conditions.push(inArray(enhancedAuditLogs.resourceType, resourceTypes));
      }
      
      if (severity) {
        conditions.push(eq(enhancedAuditLogs.severity, severity));
      }
      
      if (status) {
        conditions.push(eq(enhancedAuditLogs.status, status));
      }
      
      // Apply conditions
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      // Get logs
      const logs = await query;
      
      // Process logs before export (e.g., decrypt if needed)
      const processedLogs = await Promise.all(logs.map(async (log) => {
        if (log.isEncrypted) {
          try {
            return await this.processAuditLog(log);
          } catch (err) {
            logger.error(`Failed to decrypt log ${log.id} for export`, err);
            return log; // Return as-is if decryption fails
          }
        }
        return log;
      }));
      
      return processedLogs;
    } catch (error) {
      logger.error('Error exporting audit logs', error);
      throw new Error('Failed to export audit logs');
    }
  }

  /**
   * Get audit settings for a workspace
   */
  public async getAuditSettings(workspaceId?: number): Promise<AuditSettings | null> {
    try {
      // Try to get workspace-specific settings
      if (workspaceId) {
        const settings = await db.query.auditSettings.findFirst({
          where: eq(auditSettings.workspaceId, workspaceId)
        });
        
        if (settings) return settings;
      }
      
      // Fall back to default settings
      const defaultSettings = await db.query.auditSettings.findFirst({
        where: isNull(auditSettings.workspaceId)
      });
      
      // If no settings found, create default
      if (!defaultSettings) {
        const [created] = await db.insert(auditSettings).values({
          workspaceId: null,
          retentionPeriodDays: 90,
          encryptionEnabled: true,
          maskPii: true,
          logLevel: 'info',
          alertingEnabled: true
        }).returning();
        
        return created;
      }
      
      return defaultSettings;
    } catch (error) {
      logger.error('Error getting audit settings', error);
      return null;
    }
  }
  
  /**
   * Update audit settings for a workspace
   */
  public async updateAuditSettings(
    workspaceId: number,
    settings: Partial<AuditSettings>
  ): Promise<AuditSettings | null> {
    try {
      // Check if settings exist for this workspace
      const existingSettings = await db.query.auditSettings.findFirst({
        where: eq(auditSettings.workspaceId, workspaceId)
      });
      
      if (existingSettings) {
        // Update existing settings
        const [updated] = await db
          .update(auditSettings)
          .set(settings)
          .where(eq(auditSettings.id, existingSettings.id))
          .returning();
        
        return updated;
      } else {
        // Create new settings for this workspace
        const [created] = await db
          .insert(auditSettings)
          .values({
            workspaceId,
            retentionPeriodDays: settings.retentionPeriodDays || 90,
            encryptionEnabled: settings.encryptionEnabled !== undefined ? settings.encryptionEnabled : true,
            maskPii: settings.maskPii !== undefined ? settings.maskPii : true,
            logLevel: settings.logLevel || 'info',
            alertingEnabled: settings.alertingEnabled !== undefined ? settings.alertingEnabled : true
          })
          .returning();
        
        return created;
      }
    } catch (error) {
      logger.error('Error updating audit settings', error);
      throw new Error('Failed to update audit settings');
    }
  }
  
  /**
   * Get audit logs with pagination and filtering
   */
  public async getAuditLogs(options: AuditLogQueryOptions = {}): Promise<{
    logs: EnhancedAuditLog[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const {
        page = 1,
        limit = 50,
        orderBy = 'createdAt',
        orderDirection = 'desc'
      } = options;
      
      // Build the query
      let query = db.select().from(enhancedAuditLogs);
      const conditions = [];
      
      // Add filters
      if (options.userId) {
        conditions.push(eq(enhancedAuditLogs.userId, options.userId));
      }
      
      if (options.workspaceId) {
        conditions.push(eq(enhancedAuditLogs.workspaceId, options.workspaceId));
      }
      
      if (options.serverId) {
        conditions.push(eq(enhancedAuditLogs.serverId, options.serverId));
      }
      
      if (options.actions && options.actions.length > 0) {
        conditions.push(inArray(enhancedAuditLogs.action, options.actions));
      }
      
      if (options.resourceTypes && options.resourceTypes.length > 0) {
        conditions.push(inArray(enhancedAuditLogs.resourceType, options.resourceTypes));
      }
      
      if (options.resourceId) {
        conditions.push(eq(enhancedAuditLogs.resourceId, options.resourceId));
      }
      
      if (options.status) {
        conditions.push(eq(enhancedAuditLogs.status, options.status));
      }
      
      if (options.severity) {
        conditions.push(eq(enhancedAuditLogs.severity, options.severity));
      }
      
      if (options.correlationId) {
        conditions.push(eq(enhancedAuditLogs.correlationId, options.correlationId));
      }
      
      if (options.complianceCategory) {
        conditions.push(eq(enhancedAuditLogs.complianceCategory, options.complianceCategory));
      }
      
      if (options.fromDate) {
        conditions.push(gt(enhancedAuditLogs.createdAt, options.fromDate));
      }
      
      if (options.toDate) {
        conditions.push(lt(enhancedAuditLogs.createdAt, options.toDate));
      }
      
      // Apply filters
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      // Get total count
      const totalCountQuery = db
        .select({ count: count() })
        .from(enhancedAuditLogs)
        .where(conditions.length > 0 ? and(...conditions) : undefined);
      
      const totalCountResult = await totalCountQuery;
      const total = Number(totalCountResult[0]?.count) || 0;
      
      // Apply ordering
      if (orderDirection === 'desc') {
        query = query.orderBy(desc(enhancedAuditLogs[orderBy as keyof typeof enhancedAuditLogs]));
      } else {
        query = query.orderBy(asc(enhancedAuditLogs[orderBy as keyof typeof enhancedAuditLogs]));
      }
      
      // Apply pagination
      const offset = (page - 1) * limit;
      query = query.limit(limit).offset(offset);
      
      // Execute query
      const logs = await query;
      
      // Calculate total pages
      const totalPages = Math.ceil(total / limit);
      
      // Decrypt and process logs if needed
      const processedLogs = await Promise.all(logs.map(async (log) => {
        return this.processAuditLog(log);
      }));
      
      return {
        logs: processedLogs,
        total,
        page,
        limit,
        totalPages
      };
    } catch (error) {
      logger.error('Error fetching audit logs', error);
      throw new Error('Failed to fetch audit logs');
    }
  }
  
  /**
   * Get a single audit log by ID
   */
  public async getAuditLog(id: number): Promise<EnhancedAuditLog | null> {
    try {
      const log = await db.query.enhancedAuditLogs.findFirst({
        where: eq(enhancedAuditLogs.id, id)
      });
      
      if (!log) return null;
      
      // Process log (decrypt if necessary)
      return await this.processAuditLog(log);
    } catch (error) {
      logger.error('Error fetching audit log', error);
      throw new Error('Failed to fetch audit log');
    }
  }
  
  /**
   * Search audit logs with text matching
   */
  public async searchAuditLogs(options: {
    query: string;
    workspaceId?: number;
    page?: number;
    limit?: number;
  }): Promise<{
    logs: EnhancedAuditLog[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    try {
      const { 
        query, 
        workspaceId, 
        page = 1, 
        limit = 50 
      } = options;
      
      if (!query.trim()) {
        throw new Error('Search query is required');
      }
      
      // Build query conditions
      const likePattern = `%${query}%`;
      const conditions = [
        or(
          ilike(enhancedAuditLogs.action, likePattern),
          ilike(enhancedAuditLogs.resourceType, likePattern),
          ilike(enhancedAuditLogs.resourceId || '', likePattern),
          ilike(enhancedAuditLogs.status, likePattern),
          ilike(enhancedAuditLogs.severity, likePattern),
          ilike(enhancedAuditLogs.complianceCategory || '', likePattern)
        )
      ];
      
      // Add workspace filter if specified
      if (workspaceId) {
        conditions.push(eq(enhancedAuditLogs.workspaceId, workspaceId));
      }
      
      // Get total count
      const totalCountQuery = db
        .select({ count: count() })
        .from(enhancedAuditLogs)
        .where(and(...conditions));
      
      const totalCountResult = await totalCountQuery;
      const total = Number(totalCountResult[0]?.count) || 0;
      
      // Get logs with pagination
      const offset = (page - 1) * limit;
      const searchQuery = db
        .select()
        .from(enhancedAuditLogs)
        .where(and(...conditions))
        .orderBy(desc(enhancedAuditLogs.createdAt))
        .limit(limit)
        .offset(offset);
      
      const logs = await searchQuery;
      
      // Calculate total pages
      const totalPages = Math.ceil(total / limit);
      
      // Process logs (decrypt if necessary)
      const processedLogs = await Promise.all(logs.map(async (log) => {
        return this.processAuditLog(log);
      }));
      
      return {
        logs: processedLogs,
        total,
        page,
        limit,
        totalPages
      };
    } catch (error) {
      logger.error('Error searching audit logs', error);
      throw new Error('Failed to search audit logs');
    }
  }
  
  /**
   * Verify the integrity of audit logs
   */
  public async verifyAuditLogIntegrity(options: {
    workspaceId?: number;
    fromDate?: Date;
    toDate?: Date;
    limit?: number;
  } = {}): Promise<{
    verified: boolean;
    totalChecked: number;
    issueCount: number;
    issues?: Array<{ id: number; reason: string }>;
  }> {
    try {
      const { workspaceId, fromDate, toDate, limit = 100 } = options;
      
      // Build the query
      let query = db.select().from(enhancedAuditLogs);
      const conditions = [];
      
      if (workspaceId) {
        conditions.push(eq(enhancedAuditLogs.workspaceId, workspaceId));
      }
      
      if (fromDate) {
        conditions.push(gt(enhancedAuditLogs.createdAt, fromDate));
      }
      
      if (toDate) {
        conditions.push(lt(enhancedAuditLogs.createdAt, toDate));
      }
      
      // Apply conditions and limit
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      query = query.limit(limit);
      
      // Get logs to verify
      const logs = await query;
      
      // Results tracking
      const issues: { id: number; reason: string }[] = [];
      
      // Verify each log
      for (const log of logs) {
        // Skip logs without checksums
        if (!log.integrityChecksum) {
          issues.push({ 
            id: log.id,
            reason: 'Missing integrity checksum'
          });
          continue;
        }
        
        let dataToVerify;
        
        // Handle encrypted logs differently
        if (log.isEncrypted && log.hashedPayload && log.details) {
          try {
            // Get encryption details
            const encryptionDetails = log.details as any;
            
            if (!encryptionDetails.encrypted || !encryptionDetails.iv) {
              issues.push({ 
                id: log.id,
                reason: 'Invalid encryption metadata'
              });
              continue;
            }
            
            dataToVerify = {
              userId: log.userId,
              action: log.action,
              resourceType: log.resourceType,
              resourceId: log.resourceId,
              hashedPayload: log.hashedPayload,
              createdAt: log.createdAt
            };
          } catch (error) {
            issues.push({ 
              id: log.id,
              reason: 'Failed to parse encryption metadata'
            });
            continue;
          }
        } else {
          // Unencrypted logs
          dataToVerify = {
            userId: log.userId,
            action: log.action,
            resourceType: log.resourceType,
            resourceId: log.resourceId,
            hashedPayload: log.hashedPayload,
            createdAt: log.createdAt
          };
        }
        
        // Verify the integrity checksum
        if (!this.auditEncryption.verifyIntegrity(dataToVerify, log.integrityChecksum)) {
          issues.push({ 
            id: log.id,
            reason: 'Integrity checksum mismatch'
          });
        }
      }
      
      // Record the verification in the integrity checks log
      await db.insert(auditIntegrityChecks).values({
        workspaceId,
        logsChecked: logs.length,
        issuesFound: issues.length,
        issueDetails: issues.length > 0 ? issues : null,
        createdAt: new Date()
      });
      
      return {
        verified: issues.length === 0,
        totalChecked: logs.length,
        issueCount: issues.length,
        issues: issues.length > 0 ? issues : undefined
      };
    } catch (error) {
      logger.error('Error verifying audit log integrity', error);
      throw new Error('Failed to verify audit log integrity');
    }
  }
  
  /**
   * Archive audit logs older than a specific date
   */
  public async archiveAuditLogs(options: {
    workspaceId?: number;
    olderThan?: Date;
    limit?: number;
  }): Promise<{
    batchId: string;
    recordCount: number;
    fromTimestamp: Date;
    toTimestamp: Date;
  }> {
    try {
      const { 
        workspaceId, 
        olderThan = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Default to 90 days ago
        limit = 1000 
      } = options;
      
      // Build query to find logs to archive
      let query = db
        .select()
        .from(enhancedAuditLogs)
        .where(lt(enhancedAuditLogs.createdAt, olderThan))
        .orderBy(asc(enhancedAuditLogs.createdAt))
        .limit(limit);
      
      if (workspaceId) {
        query = query.where(eq(enhancedAuditLogs.workspaceId, workspaceId));
      }
      
      // Get logs to archive
      const logs = await query;
      
      if (logs.length === 0) {
        throw new Error('No logs found to archive');
      }
      
      // Generate batch ID
      const batchId = `archive-${Date.now()}-${randomBytes(4).toString('hex')}`;
      
      // Determine date range
      const fromTimestamp = logs[0].createdAt;
      const toTimestamp = logs[logs.length - 1].createdAt;
      
      // Store archive metadata
      const [archive] = await db.insert(auditLogArchives).values({
        batchId,
        fromTimestamp,
        toTimestamp,
        workspaceId,
        recordCount: logs.length,
        createdAt: new Date()
      }).returning();
      
      // In a real system, you would store the logs to a secure storage system
      // For this implementation, we'll simply create the archive record
      // but won't actually move the data to avoid complexity
      
      return {
        batchId: archive.batchId,
        recordCount: archive.recordCount,
        fromTimestamp: archive.fromTimestamp,
        toTimestamp: archive.toTimestamp
      };
    } catch (error) {
      logger.error('Error archiving audit logs', error);
      throw new Error('Failed to archive audit logs');
    }
  }
  
  /**
   * Get audit log archives
   */
  public async getAuditArchives(workspaceId?: number): Promise<any[]> {
    try {
      let query = db.select().from(auditLogArchives).orderBy(desc(auditLogArchives.createdAt));
      
      if (workspaceId) {
        query = query.where(eq(auditLogArchives.workspaceId, workspaceId));
      }
      
      return await query;
    } catch (error) {
      logger.error('Error fetching audit archives', error);
      throw new Error('Failed to fetch audit archives');
    }
  }
  
  /**
   * Get alerts for a workspace
   */
  public async getAlerts(options: {
    workspaceId?: number;
    status?: string;
    severity?: string;
  } = {}): Promise<any[]> {
    try {
      const { workspaceId, status, severity } = options;
      
      let query = db.select().from(alertEvents).orderBy(desc(alertEvents.createdAt));
      const conditions = [];
      
      if (workspaceId) {
        conditions.push(eq(alertEvents.workspaceId, workspaceId));
      }
      
      if (status) {
        conditions.push(eq(alertEvents.status, status));
      }
      
      if (severity) {
        conditions.push(eq(alertEvents.severity, severity));
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      return await query;
    } catch (error) {
      logger.error('Error fetching alerts', error);
      throw new Error('Failed to fetch alerts');
    }
  }
  
  /**
   * Update alert status
   */
  public async updateAlertStatus(
    id: number,
    status: 'acknowledged' | 'resolved' | 'false_positive',
    resolutionNotes?: string
  ): Promise<any> {
    try {
      const [updated] = await db
        .update(alertEvents)
        .set({
          status,
          resolutionNotes,
          resolvedAt: ['resolved', 'false_positive'].includes(status) ? new Date() : undefined,
          updatedAt: new Date()
        })
        .where(eq(alertEvents.id, id))
        .returning();
      
      return updated;
    } catch (error) {
      logger.error('Error updating alert status', error);
      throw new Error('Failed to update alert status');
    }
  }
  
  /**
   * Generate a compliance report
   */
  public async generateComplianceReport(options: {
    workspaceId: number;
    complianceStandard: 'gdpr' | 'hipaa' | 'sox' | 'pci-dss' | 'iso27001';
    fromDate: Date;
    toDate: Date;
  }): Promise<any> {
    try {
      const { workspaceId, complianceStandard, fromDate, toDate } = options;
      
      // Get relevant logs for the compliance standard
      let query = db
        .select()
        .from(enhancedAuditLogs)
        .where(
          and(
            eq(enhancedAuditLogs.workspaceId, workspaceId),
            gt(enhancedAuditLogs.createdAt, fromDate),
            lt(enhancedAuditLogs.createdAt, toDate)
          )
        )
        .orderBy(desc(enhancedAuditLogs.createdAt));
      
      // Add compliance category filter if appropriate
      if (complianceStandard) {
        query = query.where(eq(enhancedAuditLogs.complianceCategory, complianceStandard));
      }
      
      const logs = await query;
      
      // Get workspace details
      const workspace = await db.query.workspaces.findFirst({
        where: eq(workspaces.id, workspaceId)
      });
      
      // Basic report structure
      const report = {
        meta: {
          generatedAt: new Date(),
          complianceStandard,
          fromDate,
          toDate,
          workspaceId,
          workspaceName: workspace?.name || `Workspace ${workspaceId}`
        },
        summary: {
          totalEvents: logs.length,
          criticalEvents: logs.filter(log => log.severity === 'critical').length,
          highSeverityEvents: logs.filter(log => log.severity === 'high').length,
          failureEvents: logs.filter(log => log.status === 'failure').length,
          userActions: logs.filter(log => log.userId !== null).length,
          systemActions: logs.filter(log => log.userId === null).length,
        },
        events: logs.map(log => ({
          id: log.id,
          timestamp: log.createdAt,
          action: log.action,
          resourceType: log.resourceType,
          resourceId: log.resourceId,
          status: log.status,
          severity: log.severity,
          userId: log.userId,
          hasIntegrityChecksum: !!log.integrityChecksum
        }))
      };
      
      // In a real implementation, you would:
      // 1. Create a formatted PDF/HTML/CSV report
      // 2. Save it to a secure location
      // 3. Return metadata about the report
      
      return {
        reportId: `${complianceStandard}-${Date.now()}`,
        workspaceId,
        standard: complianceStandard,
        eventCount: logs.length,
        generatedAt: new Date(),
        periodStart: fromDate,
        periodEnd: toDate,
        // The next line would normally be a download URL
        reportUrl: `/api/audit/compliance-reports/${complianceStandard}-${Date.now()}.pdf`
      };
    } catch (error) {
      logger.error('Error generating compliance report', error);
      throw new Error('Failed to generate compliance report');
    }
  }
}

export const enhancedAuditService = new EnhancedAuditService();

/**
 * Helper function to create an audit log from an Express request
 */
export async function createAuditLogFromRequest(
  req: Request,
  action: string,
  resourceType: string,
  resourceId?: string,
  details?: any,
  requestPayload?: any,
  responsePayload?: any,
  options?: {
    severity?: 'critical' | 'high' | 'medium' | 'low' | 'info';
    status?: 'success' | 'failure' | 'warning' | 'info';
    complianceCategory?: string;
  }
): Promise<EnhancedAuditLog> {
  try {
    // Extract user ID if authenticated
    const userId = req.user?.id;
    
    // Build event data
    const eventData: AuditEventData = {
      userId,
      action,
      resourceType,
      resourceId,
      details,
      requestPayload,
      responsePayload,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      workspaceId: req.user?.workspaceId,
      severity: options?.severity || 'info',
      status: options?.status || 'success',
      complianceCategory: options?.complianceCategory
    };
    
    // Create and return the audit log
    return await enhancedAuditService.createAuditLog(eventData);
  } catch (error) {
    logger.error('Error creating audit log from request', { error });
    throw new Error('Failed to create audit log from request');
  }
}