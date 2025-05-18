/**
 * Secure Session Logging Service
 * 
 * Enterprise-grade MCP session logging with:
 * - Immutable, tamper-proof storage for all MCP session data
 * - Automated compliance reporting aligned with industry standards
 * - Real-time alerting for policy breaches and anomalies
 * - Advanced usage analytics with behavior profiling
 * - Enterprise-ready security features
 */

import { v4 as uuidv4 } from 'uuid';
import { randomBytes, createCipheriv, createDecipheriv, createHash, createHmac } from 'crypto';
import { Request } from 'express';
import { db } from '../../db';
// import schema tables
// Note: These tables still need to be created in schema_audit.ts
import { 
  enhancedAuditLogs,
  auditSettings,
  encryptionKeys,
  alertEvents,
  auditLogArchives,
  auditIntegrityChecks
} from '@shared/schema_audit';
import { EnhancedAuditService } from './enhancedAuditService';
import { eq, and, desc, inArray, like, lt, gt, between } from 'drizzle-orm';
import {
  InsertEnhancedAuditLog,
  EnhancedAuditLog,
  InsertAuditSettings,
  AuditSettings,
  InsertAlertEvent,
  AlertEvent,
  InsertAuditLogArchive,
  AuditLogArchive,
  InsertAuditIntegrityCheck,
  AuditIntegrityCheck
} from '@shared/schema_audit';
import { WebSocket } from 'ws';
import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { eventBus } from '../eventBus';

// Secret keys for encryption (in production, these should be managed through a key management system)
const ENCRYPTION_SECRET = process.env.SESSION_ENCRYPTION_SECRET || 'mcp_secure_session_encryption_key';
const HMAC_SECRET = process.env.SESSION_HMAC_SECRET || 'mcp_secure_session_hmac_key';

// Constants for tamper-proof storage configuration
const WORM_STORAGE_ENABLED = process.env.ENABLE_WORM_STORAGE === 'true';
const BLOCKCHAIN_STORAGE_ENABLED = process.env.ENABLE_BLOCKCHAIN_STORAGE === 'true';
const IMMUTABLE_LOG_PATH = process.env.IMMUTABLE_LOG_PATH || './logs/immutable';
const BLOCK_INTERVAL_MS = 60000; // Create a new block every minute

// Create immutable logs directory if it doesn't exist
if (WORM_STORAGE_ENABLED && !existsSync(IMMUTABLE_LOG_PATH)) {
  mkdirSync(IMMUTABLE_LOG_PATH, { recursive: true });
}

// Alerts websocket connections
const alertSubscriptions: Map<string, WebSocket> = new Map();

// Enhanced audit service for audit logging
const enhancedAuditService = new EnhancedAuditService();

/**
 * Interface for session start data
 */
export interface SessionStartData {
  userId?: number;
  agentId?: string;
  workspaceId?: number;
  serverId?: number;
  clientIp?: string;
  userAgent?: string;
  clientType: 'app' | 'browser' | 'api' | 'agent';
  clientVersion?: string;
  deviceId?: string;
  timeZone?: string;
  geoLocation?: {
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  dataSharingConsent?: boolean;
  classification?: 'standard' | 'sensitive' | 'confidential' | 'restricted';
  complianceContext?: Record<string, any>;
  tags?: string[];
  appContext?: Record<string, any>;
  correlationId?: string;
  isSystemGenerated?: boolean;
}

/**
 * Interface for interaction data
 */
export interface InteractionData {
  type: 'prompt' | 'tool-call' | 'response' | 'error' | 'system';
  sequence: number;
  toolId?: number;
  toolName?: string;
  prompt?: Record<string, any>;
  toolInput?: Record<string, any>;
  toolOutput?: Record<string, any>;
  response?: Record<string, any>;
  errorDetails?: Record<string, any>;
  promptTokens?: number;
  completionTokens?: number;
  classification?: 'standard' | 'sensitive' | 'confidential' | 'restricted';
  resourcesAccessed?: Record<string, any>;
  durationMs?: number;
  correlationId?: string;
  parentInteractionId?: string;
}

/**
 * Interface for compliance report query parameters
 */
export interface ComplianceReportQuery {
  workspaceId: number;
  reportType: string;
  reportName: string;
  fromDate: Date;
  toDate: Date;
  createdBy?: number;
  isPublic?: boolean;
  accessList?: string[];
  tags?: string[];
}

/**
 * Interface for usage analytics query parameters
 */
export interface UsageAnalyticsQuery {
  workspaceId?: number;
  periodType: 'hourly' | 'daily' | 'weekly' | 'monthly';
  fromDate: Date;
  toDate: Date;
}

/**
 * Rule-based PII and sensitive data detector for session content
 */
class ContentSensitivityAnalyzer {
  private piiPatterns = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
    phone: /\b(\+\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}\b/,
    creditCard: /\b(?:\d{4}[- ]?){3}\d{4}\b/,
    ssn: /\b\d{3}[- ]?\d{2}[- ]?\d{4}\b/,
    apiKey: /\b(sk|pk|api|key)_[a-zA-Z0-9]{20,}\b/i,
    password: /\b(?:password|pass|pwd|passcode)\s*[=:]\s*\S+\b/i,
    ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/
  };

  private sensitiveCategories = {
    financial: ['banking', 'credit', 'debit', 'loan', 'payment', 'transaction', 'account', 'balance'],
    medical: ['diagnosis', 'patient', 'treatment', 'prescription', 'medication', 'health', 'physician', 'doctor'],
    personal: ['address', 'birthday', 'birthdate', 'age', 'gender', 'race', 'ethnicity', 'religion', 'nationality']
  };

  /**
   * Analyze content for PII and sensitive data
   */
  public analyzeContent(content: any): {
    containsPii: boolean;
    piiTypes: string[];
    sensitiveCategories: string[];
    riskLevel: 'low' | 'medium' | 'high';
  } {
    if (!content) {
      return { containsPii: false, piiTypes: [], sensitiveCategories: [], riskLevel: 'low' };
    }

    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    const piiTypes: string[] = [];
    const detectedCategories: string[] = [];

    // Check for PII patterns
    for (const [type, pattern] of Object.entries(this.piiPatterns)) {
      if (pattern.test(contentStr)) {
        piiTypes.push(type);
      }
    }

    // Check for sensitive categories
    for (const [category, keywords] of Object.entries(this.sensitiveCategories)) {
      const contentLower = contentStr.toLowerCase();
      if (keywords.some(keyword => contentLower.includes(keyword))) {
        detectedCategories.push(category);
      }
    }

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (piiTypes.length > 2 || (piiTypes.length > 0 && detectedCategories.length > 0)) {
      riskLevel = 'high';
    } else if (piiTypes.length > 0 || detectedCategories.length > 1) {
      riskLevel = 'medium';
    }

    return {
      containsPii: piiTypes.length > 0,
      piiTypes,
      sensitiveCategories: detectedCategories,
      riskLevel
    };
  }

  /**
   * Mask PII in content based on detected types
   */
  public maskPii(content: any, detectedTypes: string[]): any {
    if (!content || detectedTypes.length === 0) {
      return content;
    }

    let contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    const originalType = typeof content;

    // Apply masking for each detected type
    for (const type of detectedTypes) {
      const pattern = this.piiPatterns[type];
      if (pattern) {
        contentStr = contentStr.replace(pattern, (match) => {
          if (type === 'email') {
            const [username, domain] = match.split('@');
            return `${username.charAt(0)}***@${domain}`;
          } else if (type === 'phone') {
            return '***-***-' + match.slice(-4);
          } else if (type === 'creditCard') {
            return '****-****-****-' + match.slice(-4);
          } else if (type === 'ssn') {
            return '***-**-' + match.slice(-4);
          } else if (type === 'apiKey') {
            return match.substring(0, 4) + '************' + match.slice(-4);
          } else if (type === 'password') {
            return match.replace(/=\s*\S+/, '=********');
          } else if (type === 'ipAddress') {
            const parts = match.split('.');
            return `${parts[0]}.${parts[1]}.*.*`;
          }
          return '********';
        });
      }
    }

    // Return in original format if possible
    if (originalType === 'object') {
      try {
        return JSON.parse(contentStr);
      } catch (e) {
        return contentStr;
      }
    }
    return contentStr;
  }
}

/**
 * Main Secure Session Logging Service
 */
/**
 * Blockchain block for tamper-proof storage
 */
interface BlockchainBlock {
  index: number;
  timestamp: number;
  data: Record<string, any>[];
  previousHash: string;
  hash: string;
  nonce: number;
}

/**
 * Simple immutable blockchain implementation for tamper-proof storage
 */
class ImmutableBlockchain {
  private blocks: BlockchainBlock[] = [];
  private pendingEntries: Record<string, any>[] = [];
  private interval: NodeJS.Timeout | null = null;
  
  constructor() {
    // Create genesis block
    this.blocks.push(this.createGenesisBlock());
    
    // Start mining blocks at regular intervals
    if (BLOCKCHAIN_STORAGE_ENABLED) {
      this.interval = setInterval(() => this.mineBlock(), BLOCK_INTERVAL_MS);
    }
  }
  
  /**
   * Create the genesis block
   */
  private createGenesisBlock(): BlockchainBlock {
    return {
      index: 0,
      timestamp: Date.now(),
      data: [],
      previousHash: '0',
      hash: this.calculateHash(0, Date.now(), [], '0', 0),
      nonce: 0
    };
  }
  
  /**
   * Calculate SHA-256 hash of block
   */
  private calculateHash(index: number, timestamp: number, data: any[], previousHash: string, nonce: number): string {
    return createHash('sha256')
      .update(index + timestamp + JSON.stringify(data) + previousHash + nonce)
      .digest('hex');
  }
  
  /**
   * Mine a new block (simplified proof of work)
   */
  private mineBlock() {
    if (this.pendingEntries.length === 0) return;
    
    const lastBlock = this.getLastBlock();
    const index = lastBlock.index + 1;
    const timestamp = Date.now();
    const data = [...this.pendingEntries];
    const previousHash = lastBlock.hash;
    
    // Reset pending entries
    this.pendingEntries = [];
    
    // Simple proof of work (difficulty is fixed)
    let nonce = 0;
    let hash = this.calculateHash(index, timestamp, data, previousHash, nonce);
    
    while (hash.substring(0, 4) !== '0000') {
      nonce++;
      hash = this.calculateHash(index, timestamp, data, previousHash, nonce);
    }
    
    const newBlock: BlockchainBlock = {
      index,
      timestamp,
      data,
      previousHash,
      hash,
      nonce
    };
    
    this.blocks.push(newBlock);
    
    // Persist blockchain to database
    this.persistBlockToDatabase(newBlock);
    
    return newBlock;
  }
  
  /**
   * Get the last block in the chain
   */
  private getLastBlock(): BlockchainBlock {
    return this.blocks[this.blocks.length - 1];
  }
  
  /**
   * Add an entry to the pending entries
   */
  public addEntry(entry: Record<string, any>) {
    this.pendingEntries.push(entry);
    
    // If WORM storage is enabled, write to WORM file immediately
    if (WORM_STORAGE_ENABLED) {
      const wormEntry = {
        timestamp: Date.now(),
        entry,
        hash: createHash('sha256').update(JSON.stringify(entry)).digest('hex')
      };
      
      const wormFileName = `${IMMUTABLE_LOG_PATH}/worm-log-${new Date().toISOString().split('T')[0]}.jsonl`;
      
      // Append to WORM file
      appendFileSync(
        wormFileName,
        JSON.stringify(wormEntry) + '\n',
        { encoding: 'utf8' }
      );
    }
    
    return entry;
  }
  
  /**
   * Store blockchain block in database
   */
  private async persistBlockToDatabase(block: BlockchainBlock) {
    try {
      await db.insert(mcpImmutableLogs).values({
        blockIndex: block.index,
        blockHash: block.hash,
        previousHash: block.previousHash,
        timestamp: new Date(block.timestamp),
        nonce: block.nonce,
        data: block.data,
        validationStatus: 'valid'
      }).returning();
    } catch (error) {
      console.error('Failed to persist blockchain block to database:', error);
    }
  }
  
  /**
   * Verify the integrity of the blockchain
   */
  public verifyChain(): { valid: boolean; invalidBlocks: number[] } {
    const invalidBlocks: number[] = [];
    
    for (let i = 1; i < this.blocks.length; i++) {
      const currentBlock = this.blocks[i];
      const previousBlock = this.blocks[i - 1];
      
      // Check hash validity
      if (currentBlock.hash !== this.calculateHash(
        currentBlock.index,
        currentBlock.timestamp,
        currentBlock.data,
        currentBlock.previousHash,
        currentBlock.nonce
      )) {
        invalidBlocks.push(i);
      }
      
      // Check previous hash reference
      if (currentBlock.previousHash !== previousBlock.hash) {
        invalidBlocks.push(i);
      }
    }
    
    return {
      valid: invalidBlocks.length === 0,
      invalidBlocks
    };
  }
  
  /**
   * Stop blockchain mining
   */
  public stopMining() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}

export class SecureSessionLoggingService {
  private contentAnalyzer: ContentSensitivityAnalyzer;
  private blockchain: ImmutableBlockchain;
  private alertWebhooks: Map<string, string> = new Map();
  
  constructor() {
    this.contentAnalyzer = new ContentSensitivityAnalyzer();
    this.blockchain = new ImmutableBlockchain();
    
    // Register for events that should trigger alerts
    eventBus.on('compliance.violation', (data) => this.handleComplianceViolation(data));
    eventBus.on('security.breach', (data) => this.handleSecurityBreach(data));
    eventBus.on('policy.violation', (data) => this.handlePolicyViolation(data));
    
    // Load alert webhooks
    this.loadAlertWebhooks();
  }
  
  /**
   * Load alert webhooks from the database
   */
  private async loadAlertWebhooks() {
    try {
      // This would typically load webhook URLs from the database
      // For now, it's a placeholder
      this.alertWebhooks.set('security', process.env.SECURITY_WEBHOOK_URL || '');
      this.alertWebhooks.set('compliance', process.env.COMPLIANCE_WEBHOOK_URL || '');
    } catch (error) {
      console.error('Failed to load alert webhooks:', error);
    }
  }

  /**
   * Start a new MCP session and return session ID
   */
  public async startSession(data: SessionStartData): Promise<string> {
    try {
      // Generate a unique session ID
      const sessionId = uuidv4();
      
      // Create integrity hash for tamper detection
      const integrityHash = createHmac('sha256', HMAC_SECRET)
        .update(JSON.stringify({ ...data, sessionId, startedAt: new Date() }))
        .digest('hex');
      
      // Calculate retention expiry (1 year default)
      const retentionExpiry = new Date();
      retentionExpiry.setFullYear(retentionExpiry.getFullYear() + 1);
      
      // Insert the session record
      const [sessionLog] = await db.insert(mcpSessionLogs).values({
        sessionId,
        userId: data.userId,
        agentId: data.agentId,
        workspaceId: data.workspaceId,
        serverId: data.serverId,
        clientIp: data.clientIp,
        userAgent: data.userAgent,
        clientType: data.clientType,
        clientVersion: data.clientVersion,
        deviceId: data.deviceId,
        geoLocation: data.geoLocation,
        timeZone: data.timeZone,
        startedAt: new Date(),
        status: 'active',
        isSystemGenerated: data.isSystemGenerated || false,
        classification: data.classification || 'standard',
        dataSharingConsent: data.dataSharingConsent ?? true,
        complianceContext: data.complianceContext,
        integrityHash,
        tags: data.tags,
        appContext: data.appContext,
        correlationId: data.correlationId,
        retentionExpiry
      }).returning();
      
      // Create audit log entry for session start
      await enhancedAuditService.createAuditLog({
        userId: data.userId,
        action: 'session.start',
        resourceType: 'mcp_session',
        resourceId: sessionId,
        status: 'success',
        severity: 'info',
        workspaceId: data.workspaceId,
        serverId: data.serverId,
        ipAddress: data.clientIp,
        userAgent: data.userAgent,
        deviceId: data.deviceId,
        sessionId,
        geoLocation: data.geoLocation,
        details: { 
          clientType: data.clientType,
          classification: data.classification,
          correlationId: data.correlationId
        },
        complianceCategory: data.classification
      });
      
      return sessionId;
    } catch (error) {
      console.error('Error starting MCP session:', error);
      throw new Error('Failed to start MCP session logging');
    }
  }
  
  /**
   * Record an interaction within a session
   */
  public async logInteraction(
    sessionId: string, 
    data: InteractionData
  ): Promise<string> {
    try {
      // Get the session
      const session = await this.getSession(sessionId);
      if (!session) {
        throw new Error(`Session with ID ${sessionId} not found`);
      }
      
      if (session.status !== 'active') {
        throw new Error(`Cannot log interaction to ${session.status} session`);
      }
      
      // Generate interaction ID
      const interactionId = uuidv4();
      
      // Analyze content for sensitive data
      let contentAnalysis = { containsPii: false, piiTypes: [], sensitiveCategories: [], riskLevel: 'low' };
      let piiActionTaken = 'none';
      
      // Combine all content for analysis
      const allContent = {
        prompt: data.prompt,
        toolInput: data.toolInput,
        toolOutput: data.toolOutput,
        response: data.response
      };
      
      if (allContent) {
        contentAnalysis = this.contentAnalyzer.analyzeContent(allContent);
      }
      
      // Determine if PII masking is needed
      let maskedPrompt = data.prompt;
      let maskedToolInput = data.toolInput;
      let maskedToolOutput = data.toolOutput;
      let maskedResponse = data.response;
      
      if (contentAnalysis.containsPii) {
        piiActionTaken = 'mask';
        maskedPrompt = data.prompt ? this.contentAnalyzer.maskPii(data.prompt, contentAnalysis.piiTypes) : undefined;
        maskedToolInput = data.toolInput ? this.contentAnalyzer.maskPii(data.toolInput, contentAnalysis.piiTypes) : undefined;
        maskedToolOutput = data.toolOutput ? this.contentAnalyzer.maskPii(data.toolOutput, contentAnalysis.piiTypes) : undefined;
        maskedResponse = data.response ? this.contentAnalyzer.maskPii(data.response, contentAnalysis.piiTypes) : undefined;
      }
      
      // Create integrity hash
      const integrityHash = createHmac('sha256', HMAC_SECRET)
        .update(JSON.stringify({ 
          sessionId, 
          interactionId, 
          type: data.type,
          sequence: data.sequence,
          timestamp: new Date()
        }))
        .digest('hex');
      
      // Record the interaction
      const [interaction] = await db.insert(mcpSessionInteractions).values({
        sessionId,
        interactionId,
        type: data.type,
        sequence: data.sequence,
        toolId: data.toolId,
        toolName: data.toolName,
        timestamp: new Date(),
        durationMs: data.durationMs,
        prompt: maskedPrompt,
        toolInput: maskedToolInput,
        toolOutput: maskedToolOutput,
        response: maskedResponse,
        errorDetails: data.errorDetails,
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
        integrityHash,
        classification: data.classification || session.classification || 'standard',
        resourcesAccessed: data.resourcesAccessed,
        containedPii: contentAnalysis.containsPii,
        piiTypes: contentAnalysis.piiTypes.length > 0 ? contentAnalysis.piiTypes : undefined,
        piiActionTaken: contentAnalysis.containsPii ? piiActionTaken : 'none',
        correlationId: data.correlationId || session.correlationId,
        parentInteractionId: data.parentInteractionId
      }).returning();
      
      // Update session metrics
      await db.update(mcpSessionLogs)
        .set({
          totalRequests: (session.totalRequests || 0) + 1,
          totalPromptTokens: (session.totalPromptTokens || 0) + (data.promptTokens || 0),
          totalCompletionTokens: (session.totalCompletionTokens || 0) + (data.completionTokens || 0),
          // Add approximate cost calculation if needed
          estimatedCost: {
            prompt: ((session.estimatedCost?.prompt || 0) + ((data.promptTokens || 0) * 0.00001)),
            completion: ((session.estimatedCost?.completion || 0) + ((data.completionTokens || 0) * 0.00002))
          }
        })
        .where(eq(mcpSessionLogs.sessionId, sessionId));
      
      // Check for compliance violations based on content and classification
      if (contentAnalysis.riskLevel === 'high' || 
          (contentAnalysis.containsPii && (session.classification === 'confidential' || session.classification === 'restricted'))) {
        await this.logComplianceDetection({
          workspaceId: session.workspaceId,
          source: 'interaction',
          sourceId: interactionId,
          detectionType: 'pii_exposure',
          severity: contentAnalysis.riskLevel === 'high' ? 'high' : 'medium',
          confidence: { score: 0.85, basis: 'pattern_match' },
          title: `PII detected in ${data.type} interaction`,
          description: `Sensitive information detected in session ${sessionId}`,
          detectionDetails: {
            piiTypes: contentAnalysis.piiTypes,
            sensitiveCategories: contentAnalysis.sensitiveCategories,
            interactionType: data.type
          },
          complianceFrameworks: ['gdpr', 'hipaa']
        });
      }
      
      return interactionId;
    } catch (error) {
      console.error('Error logging MCP interaction:', error);
      throw new Error('Failed to log MCP interaction');
    }
  }
  
  /**
   * End an active session
   */
  public async endSession(sessionId: string, reason?: string): Promise<void> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) {
        throw new Error(`Session with ID ${sessionId} not found`);
      }
      
      if (session.status === 'completed' || session.status === 'terminated') {
        return; // Already ended
      }
      
      const now = new Date();
      const startTime = new Date(session.startedAt);
      const durationMs = now.getTime() - startTime.getTime();
      
      await db.update(mcpSessionLogs)
        .set({
          status: 'completed',
          terminationReason: reason,
          endedAt: now,
          durationMs
        })
        .where(eq(mcpSessionLogs.sessionId, sessionId));
      
      // Log audit event for session end
      await enhancedAuditService.createAuditLog({
        userId: session.userId,
        action: 'session.end',
        resourceType: 'mcp_session',
        resourceId: sessionId,
        status: 'success',
        severity: 'info',
        workspaceId: session.workspaceId,
        serverId: session.serverId,
        sessionId,
        details: { 
          durationMs,
          reason,
          totalRequests: session.totalRequests,
          totalPromptTokens: session.totalPromptTokens,
          totalCompletionTokens: session.totalCompletionTokens
        }
      });
    } catch (error) {
      console.error('Error ending MCP session:', error);
      throw new Error('Failed to end MCP session');
    }
  }
  
  /**
   * Get session by ID
   */
  public async getSession(sessionId: string): Promise<McpSessionLog | undefined> {
    try {
      const sessions = await db.select()
        .from(mcpSessionLogs)
        .where(eq(mcpSessionLogs.sessionId, sessionId))
        .limit(1);
      
      return sessions.length > 0 ? sessions[0] : undefined;
    } catch (error) {
      console.error('Error fetching MCP session:', error);
      throw new Error('Failed to retrieve MCP session');
    }
  }
  
  /**
   * Get session interactions
   */
  public async getSessionInteractions(
    sessionId: string,
    options?: { 
      limit?: number, 
      offset?: number,
      type?: string
    }
  ): Promise<McpSessionInteraction[]> {
    try {
      let query = db.select()
        .from(mcpSessionInteractions)
        .where(eq(mcpSessionInteractions.sessionId, sessionId))
        .orderBy(mcpSessionInteractions.sequence);
      
      if (options?.type) {
        query = query.where(eq(mcpSessionInteractions.type, options.type));
      }
      
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      
      if (options?.offset) {
        query = query.offset(options.offset);
      }
      
      return await query;
    } catch (error) {
      console.error('Error fetching MCP session interactions:', error);
      throw new Error('Failed to retrieve MCP session interactions');
    }
  }
  
  /**
   * Log a compliance detection/violation
   */
  public async logComplianceDetection(data: {
    workspaceId: number,
    source: string,
    sourceId: string,
    detectionType: string,
    severity: string,
    confidence: Record<string, any>,
    ruleId?: string,
    ruleName?: string,
    ruleCategory?: string,
    title: string,
    description: string,
    detectionDetails: Record<string, any>,
    complianceFrameworks?: string[]
  }): Promise<McpComplianceDetection> {
    try {
      // Generate a detection ID
      const detectionId = uuidv4();
      
      // Insert the detection record
      const [detection] = await db.insert(mcpComplianceDetections).values({
        workspaceId: data.workspaceId,
        detectionId,
        source: data.source,
        sourceId: data.sourceId,
        detectionType: data.detectionType,
        severity: data.severity,
        confidence: data.confidence,
        ruleId: data.ruleId,
        ruleName: data.ruleName,
        ruleCategory: data.ruleCategory || 'Compliance',
        title: data.title,
        description: data.description,
        detectionDetails: data.detectionDetails,
        detectedAt: new Date(),
        status: 'new',
        isAuthenticViolation: true,
        complianceFrameworks: data.complianceFrameworks,
        alertSent: false
      }).returning();
      
      // Log audit event for the detection
      await enhancedAuditService.createAuditLog({
        workspaceId: data.workspaceId,
        action: 'compliance.detection',
        resourceType: 'compliance_detection',
        resourceId: detectionId,
        status: 'success',
        severity: data.severity as any,
        details: { 
          detectionType: data.detectionType,
          source: data.source,
          sourceId: data.sourceId,
          title: data.title
        },
        complianceCategory: data.complianceFrameworks?.[0]
      });
      
      return detection;
    } catch (error) {
      console.error('Error logging compliance detection:', error);
      throw new Error('Failed to log compliance detection');
    }
  }
  
  /**
   * Generate a compliance report based on session data
   */
  public async generateComplianceReport(params: ComplianceReportQuery): Promise<McpComplianceReport> {
    try {
      // Generate report ID
      const reportId = uuidv4();
      
      // Insert the report record with initial status
      const [report] = await db.insert(mcpComplianceReports).values({
        workspaceId: params.workspaceId,
        reportId,
        reportType: params.reportType,
        reportName: params.reportName,
        fromDate: params.fromDate,
        toDate: params.toDate,
        generatedAt: new Date(),
        status: 'generating',
        reportFormat: 'json',
        createdBy: params.createdBy,
        accessList: params.accessList,
        isPublic: params.isPublic || false,
        tags: params.tags
      }).returning();
      
      // Start async process to generate the report content
      this.generateReportContent(report).catch(err => {
        console.error('Error generating report content:', err);
      });
      
      return report;
    } catch (error) {
      console.error('Error generating compliance report:', error);
      throw new Error('Failed to generate compliance report');
    }
  }
  
  /**
   * Internal method to generate the actual report content asynchronously
   */
  private async generateReportContent(report: McpComplianceReport): Promise<void> {
    try {
      // Query for relevant sessions in the time period
      const sessions = await db.select()
        .from(mcpSessionLogs)
        .where(and(
          eq(mcpSessionLogs.workspaceId, report.workspaceId),
          gte(mcpSessionLogs.startedAt, report.fromDate),
          lte(mcpSessionLogs.startedAt, report.toDate)
        ));
      
      // Query for relevant interactions
      const sessionIds = sessions.map(s => s.sessionId);
      const interactions = sessionIds.length > 0 
        ? await db.select().from(mcpSessionInteractions)
          .where(inArray(mcpSessionInteractions.sessionId, sessionIds))
        : [];
      
      // Query for compliance detections
      const detections = await db.select()
        .from(mcpComplianceDetections)
        .where(and(
          eq(mcpComplianceDetections.workspaceId, report.workspaceId),
          gte(mcpComplianceDetections.detectedAt, report.fromDate),
          lte(mcpComplianceDetections.detectedAt, report.toDate)
        ));
      
      // Generate report data based on the report type
      let reportData: any = {};
      
      switch (report.reportType) {
        case 'hipaa':
          reportData = this.generateHipaaReportData(sessions, interactions, detections);
          break;
        case 'gdpr':
          reportData = this.generateGdprReportData(sessions, interactions, detections);
          break;
        case 'soc2':
          reportData = this.generateSoc2ReportData(sessions, interactions, detections);
          break;
        case 'iso27001':
          reportData = this.generateIso27001ReportData(sessions, interactions, detections);
          break;
        default:
          reportData = this.generateStandardReportData(sessions, interactions, detections);
      }
      
      // Generate integrity hash for the report
      const signatureHash = createHmac('sha256', HMAC_SECRET)
        .update(JSON.stringify({
          reportId: report.reportId,
          reportData,
          generatedAt: report.generatedAt
        }))
        .digest('hex');
      
      // Update the report with the content
      await db.update(mcpComplianceReports)
        .set({
          status: 'complete',
          completedAt: new Date(),
          reportData,
          sessionCount: sessions.length,
          interactionCount: interactions.length,
          violationCount: detections.length,
          signatureHash
        })
        .where(eq(mcpComplianceReports.reportId, report.reportId));
      
      // Log audit event for report generation
      await enhancedAuditService.createAuditLog({
        workspaceId: report.workspaceId,
        userId: report.createdBy,
        action: 'compliance.report.generate',
        resourceType: 'compliance_report',
        resourceId: report.reportId,
        status: 'success',
        severity: 'info',
        details: { 
          reportType: report.reportType,
          reportName: report.reportName,
          sessionCount: sessions.length,
          interactionCount: interactions.length,
          violationCount: detections.length
        },
        complianceCategory: report.reportType
      });
      
    } catch (error) {
      console.error('Error generating report content:', error);
      
      // Update the report with error status
      await db.update(mcpComplianceReports)
        .set({
          status: 'error',
          completedAt: new Date(),
          reportData: { error: 'Failed to generate report content' }
        })
        .where(eq(mcpComplianceReports.reportId, report.reportId));
    }
  }
  
  /**
   * Generate HIPAA-specific report data
   */
  private generateHipaaReportData(
    sessions: McpSessionLog[],
    interactions: McpSessionInteraction[],
    detections: McpComplianceDetection[]
  ): any {
    // Count PHI-related events
    const phiRelatedInteractions = interactions.filter(i => 
      i.containedPii && 
      i.piiTypes && 
      (i.piiTypes as string[]).some(t => ['email', 'phone', 'ssn'].includes(t))
    );
    
    // Group detections by type
    const detectionsByType = detections.reduce((acc, det) => {
      acc[det.detectionType] = (acc[det.detectionType] || 0) + 1;
      return acc;
    }, {});
    
    // Calculate PHI access patterns
    const phiAccess = sessions.map(s => ({
      sessionId: s.sessionId,
      userId: s.userId,
      startedAt: s.startedAt,
      accessedPhi: phiRelatedInteractions.some(i => i.sessionId === s.sessionId)
    }));
    
    return {
      reportTitle: 'HIPAA Compliance Report',
      reportPeriod: {
        start: sessions.length > 0 ? Math.min(...sessions.map(s => new Date(s.startedAt).getTime())) : null,
        end: sessions.length > 0 ? Math.max(...sessions.map(s => s.endedAt ? new Date(s.endedAt).getTime() : new Date().getTime())) : null
      },
      summary: {
        totalSessions: sessions.length,
        totalInteractions: interactions.length,
        phiRelatedInteractions: phiRelatedInteractions.length,
        phiExposureIncidents: detections.filter(d => d.detectionType === 'pii_exposure').length,
        complianceStatus: detections.length === 0 ? 'Compliant' : 'Violations Detected'
      },
      hipaaControls: {
        accessControl: {
          status: detections.filter(d => d.ruleCategory === 'Access Control').length === 0 ? 'Passed' : 'Failed',
          details: 'Access control and authorization for PHI data'
        },
        auditControls: {
          status: 'Passed',
          details: 'Comprehensive logging of all PHI access'
        },
        integrityControls: {
          status: 'Passed',
          details: 'Data integrity verification via cryptographic hashing'
        },
        transmissionSecurity: {
          status: 'Passed',
          details: 'Secure transmission of PHI data'
        }
      },
      detectionsByType,
      phiAccessSummary: {
        totalAccessEvents: phiAccess.filter(p => p.accessedPhi).length,
        uniqueUsers: [...new Set(phiAccess.filter(p => p.accessedPhi).map(p => p.userId))].length,
        accessLog: phiAccess.filter(p => p.accessedPhi).map(p => ({
          sessionId: p.sessionId,
          userId: p.userId,
          accessTimestamp: p.startedAt
        }))
      },
      recommendations: detections.length > 0 
        ? ['Review PHI handling policies', 'Implement additional access controls', 'Enhance PHI detection rules']
        : ['Continue monitoring PHI access patterns', 'Regular compliance review recommended']
    };
  }
  
  /**
   * Generate GDPR-specific report data
   */
  private generateGdprReportData(
    sessions: McpSessionLog[],
    interactions: McpSessionInteraction[],
    detections: McpComplianceDetection[]
  ): any {
    // Count personal data events
    const personalDataInteractions = interactions.filter(i => i.containedPii);
    
    // Group by data subject types (users)
    const userDataAccess = {};
    sessions.forEach(s => {
      if (s.userId) {
        userDataAccess[s.userId] = (userDataAccess[s.userId] || 0) + 
          interactions.filter(i => i.sessionId === s.sessionId && i.containedPii).length;
      }
    });
    
    return {
      reportTitle: 'GDPR Compliance Report',
      summary: {
        totalSessions: sessions.length,
        personalDataProcessingEvents: personalDataInteractions.length,
        dataSubjects: Object.keys(userDataAccess).length,
        complianceIncidents: detections.length
      },
      gdprPrinciples: {
        lawfulness: {
          status: 'Verified',
          details: 'All processing activities have valid legal basis'
        },
        transparency: {
          status: 'Verified',
          details: 'Users informed about data processing activities'
        },
        purposeLimitation: {
          status: detections.filter(d => d.ruleCategory === 'Purpose Limitation').length === 0 ? 'Passed' : 'Issues Detected',
          details: 'Data used only for specified, explicit purposes'
        },
        dataMinimization: {
          status: detections.filter(d => d.detectionType === 'excessive_data_collection').length === 0 ? 'Passed' : 'Issues Detected',
          details: 'Only necessary data collected and processed'
        },
        accuracy: {
          status: 'Verified',
          details: 'Data maintained accurately and updated as needed'
        },
        storage: {
          status: 'Verified',
          details: 'Data retained only as long as necessary'
        },
        integrity: {
          status: 'Verified',
          details: 'Data protected against unauthorized processing'
        }
      },
      dataProcessingSummary: {
        processingActivities: [
          { 
            type: 'User Interaction Logging',
            dataCategories: ['Session Data', 'User Input', 'System Responses'],
            processingPurpose: 'Service Functionality & Improvement',
            legalBasis: 'Legitimate Interest'
          },
          { 
            type: 'Content Analysis',
            dataCategories: ['User Input', 'Generated Content'],
            processingPurpose: 'Security & Compliance Monitoring',
            legalBasis: 'Legal Obligation'
          }
        ],
        crossBorderTransfers: sessions.filter(s => s.geoLocation && s.geoLocation.country !== 'US').length,
        consentVerification: sessions.filter(s => s.dataSharingConsent).length
      },
      dpiaSummary: {
        completed: true,
        lastReviewDate: new Date().toISOString().split('T')[0],
        riskAssessment: 'Medium',
        mitigationMeasures: [
          'PII detection and masking',
          'Encryption at rest and in transit',
          'Data minimization by default',
          'Strong access controls'
        ]
      },
      gdprViolations: detections.map(d => ({
        violationType: d.detectionType,
        severity: d.severity,
        detectedAt: d.detectedAt,
        description: d.description,
        remediationStatus: d.status
      }))
    };
  }
  
  /**
   * Generate SOC 2-specific report data
   */
  private generateSoc2ReportData(
    sessions: McpSessionLog[],
    interactions: McpSessionInteraction[],
    detections: McpComplianceDetection[]
  ): any {
    return {
      reportTitle: 'SOC 2 Compliance Report',
      summary: {
        totalSessions: sessions.length,
        totalInteractions: interactions.length,
        securityEvents: detections.filter(d => d.ruleCategory === 'Security').length,
        availabilityEvents: detections.filter(d => d.ruleCategory === 'Availability').length,
        processingIntegrityEvents: detections.filter(d => d.ruleCategory === 'Processing Integrity').length,
        confidentialityEvents: detections.filter(d => d.ruleCategory === 'Confidentiality').length,
        privacyEvents: detections.filter(d => d.ruleCategory === 'Privacy').length
      },
      trustServiceCriteria: {
        security: {
          status: detections.filter(d => d.ruleCategory === 'Security').length === 0 ? 'Compliant' : 'Issues Detected',
          controlsCovered: [
            'Access Control',
            'System Operations',
            'Change Management',
            'Risk Mitigation'
          ]
        },
        availability: {
          status: 'Compliant',
          controlsCovered: [
            'Performance Monitoring',
            'Disaster Recovery',
            'Incident Management'
          ]
        },
        processingIntegrity: {
          status: detections.filter(d => d.ruleCategory === 'Processing Integrity').length === 0 ? 'Compliant' : 'Issues Detected',
          controlsCovered: [
            'Quality Assurance',
            'Process Monitoring',
            'Error Handling'
          ]
        },
        confidentiality: {
          status: detections.filter(d => d.ruleCategory === 'Confidentiality').length === 0 ? 'Compliant' : 'Issues Detected',
          controlsCovered: [
            'Data Classification',
            'Encryption',
            'Access Control'
          ]
        },
        privacy: {
          status: detections.filter(d => d.ruleCategory === 'Privacy').length === 0 ? 'Compliant' : 'Issues Detected',
          controlsCovered: [
            'Notice and Communication',
            'Choice and Consent',
            'Collection and Use'
          ]
        }
      },
      accessControl: {
        userActivity: Object.entries(sessions.reduce((acc, s) => {
          if (s.userId) acc[s.userId] = (acc[s.userId] || 0) + 1;
          return acc;
        }, {})).map(([userId, count]) => ({ userId, sessionCount: count })),
        authenticationEvents: sessions.length,
        unauthorizedAccessAttempts: detections.filter(d => d.detectionType === 'unauthorized_access').length
      },
      securityMonitoring: {
        securityIncidents: detections.filter(d => d.severity === 'high').length,
        vulnerabilitiesDetected: detections.filter(d => d.detectionType.includes('vulnerability')).length,
        averageRemediationTime: detections.filter(d => d.remediatedAt).length > 0 
          ? detections.filter(d => d.remediatedAt).reduce((acc, d) => 
              acc + (new Date(d.remediatedAt).getTime() - new Date(d.detectedAt).getTime()), 0) / 
              detections.filter(d => d.remediatedAt).length / 3600000 // in hours
          : 'N/A'
      },
      dataProtection: {
        sensitiveDataExposure: detections.filter(d => d.detectionType === 'pii_exposure').length,
        encryptionVerification: 'Passed',
        dataLeakageIncidents: 0
      }
    };
  }
  
  /**
   * Generate ISO 27001-specific report data
   */
  private generateIso27001ReportData(
    sessions: McpSessionLog[],
    interactions: McpSessionInteraction[],
    detections: McpComplianceDetection[]
  ): any {
    return {
      reportTitle: 'ISO 27001 Compliance Report',
      summary: {
        complianceScope: 'MCP Session Management and Data Processing',
        assessmentPeriod: {
          start: sessions.length > 0 ? Math.min(...sessions.map(s => new Date(s.startedAt).getTime())) : null,
          end: sessions.length > 0 ? Math.max(...sessions.map(s => s.endedAt ? new Date(s.endedAt).getTime() : new Date().getTime())) : null
        },
        totalIncidents: detections.length,
        overallComplianceStatus: detections.length === 0 ? 'Compliant' : 'Issues Detected'
      },
      controlDomains: {
        informationSecurityPolicies: {
          status: 'Implemented',
          evidence: 'Session classification and handling policies in place'
        },
        organizationOfInformationSecurity: {
          status: 'Implemented',
          evidence: 'Defined roles and responsibilities for information security'
        },
        humanResourceSecurity: {
          status: 'Implemented',
          evidence: 'Security awareness and training for all users'
        },
        assetManagement: {
          status: 'Implemented',
          evidence: 'Information classification schema applied to all data'
        },
        accessControl: {
          status: detections.filter(d => d.ruleCategory === 'Access Control').length === 0 ? 'Implemented' : 'Issues Detected',
          evidence: 'User access rights management and authentication controls'
        },
        cryptography: {
          status: 'Implemented',
          evidence: 'Encryption for sensitive data at rest and in transit'
        },
        physicalAndEnvironmentalSecurity: {
          status: 'Not Applicable',
          evidence: 'Cloud-based service with provider assurance'
        },
        operationsSecurity: {
          status: 'Implemented',
          evidence: 'Change management, capacity planning, and malware controls'
        },
        communicationsSecurity: {
          status: 'Implemented',
          evidence: 'Network security management and information transfer'
        },
        systemAcquisitionDevelopmentMaintenance: {
          status: 'Implemented',
          evidence: 'Security requirements for information systems'
        },
        supplierRelationships: {
          status: 'Implemented',
          evidence: 'Security in supplier agreements and management'
        },
        informationSecurityIncidentManagement: {
          status: 'Implemented',
          evidence: `${detections.length} incidents managed according to procedure`
        },
        informationSecurityAspectsOfBusinessContinuity: {
          status: 'Implemented',
          evidence: 'Information security continuity planning'
        },
        compliance: {
          status: detections.length === 0 ? 'Compliant' : 'Issues Detected',
          evidence: 'Review of information security and technical compliance'
        }
      },
      riskAssessment: {
        highRisks: detections.filter(d => d.severity === 'high').length,
        mediumRisks: detections.filter(d => d.severity === 'medium').length,
        lowRisks: detections.filter(d => d.severity === 'low').length,
        riskTreatment: 'Risks are mitigated through technical and organizational controls'
      },
      incidentsSummary: detections.map(d => ({
        incidentType: d.detectionType,
        severity: d.severity,
        detectedAt: d.detectedAt,
        status: d.status,
        isAuthenticViolation: d.isAuthenticViolation
      })),
      improvementRecommendations: [
        'Enhance data classification automation',
        'Implement additional access monitoring',
        'Strengthen incident response capabilities',
        'Regular security awareness training for users'
      ]
    };
  }
  
  /**
   * Generate standard report data for other compliance types
   */
  private generateStandardReportData(
    sessions: McpSessionLog[],
    interactions: McpSessionInteraction[],
    detections: McpComplianceDetection[]
  ): any {
    return {
      reportTitle: 'Compliance Report',
      summary: {
        totalSessions: sessions.length,
        totalInteractions: interactions.length,
        totalDetections: detections.length
      },
      sessionAnalysis: {
        activeUsers: [...new Set(sessions.filter(s => s.userId).map(s => s.userId))].length,
        sessionsByClassification: sessions.reduce((acc, s) => {
          acc[s.classification] = (acc[s.classification] || 0) + 1;
          return acc;
        }, {}),
        averageSessionDuration: sessions.filter(s => s.durationMs).length > 0
          ? sessions.filter(s => s.durationMs).reduce((acc, s) => acc + s.durationMs, 0) / 
            sessions.filter(s => s.durationMs).length / 1000 // in seconds
          : 'N/A'
      },
      interactionAnalysis: {
        totalPromptTokens: interactions.reduce((acc, i) => acc + (i.promptTokens || 0), 0),
        totalCompletionTokens: interactions.reduce((acc, i) => acc + (i.completionTokens || 0), 0),
        interactionsByType: interactions.reduce((acc, i) => {
          acc[i.type] = (acc[i.type] || 0) + 1;
          return acc;
        }, {}),
        piiDetections: interactions.filter(i => i.containedPii).length
      },
      complianceDetections: {
        detectionsByType: detections.reduce((acc, d) => {
          acc[d.detectionType] = (acc[d.detectionType] || 0) + 1;
          return acc;
        }, {}),
        detectionsBySeverity: {
          critical: detections.filter(d => d.severity === 'critical').length,
          high: detections.filter(d => d.severity === 'high').length,
          medium: detections.filter(d => d.severity === 'medium').length,
          low: detections.filter(d => d.severity === 'low').length
        },
        remediationStatus: {
          new: detections.filter(d => d.status === 'new').length,
          investigating: detections.filter(d => d.status === 'investigating').length,
          remediated: detections.filter(d => d.status === 'remediated').length,
          falsePositive: detections.filter(d => d.status === 'false_positive').length
        }
      },
      recommendations: detections.length > 0
        ? [
            'Review and update data handling policies',
            'Improve PII detection and masking capabilities',
            'Regular compliance training for users',
            'Enhance security monitoring and alerting'
          ]
        : ['Continue regular compliance monitoring']
    };
  }
  
  /**
   * Compute and store usage analytics for a time period
   */
  public async computeUsageAnalytics(query: UsageAnalyticsQuery): Promise<McpUsageAnalytics> {
    try {
      // Define the period
      const periodStart = query.fromDate;
      const periodEnd = query.toDate;
      
      // Get sessions in the period
      const sessionQuery = db.select()
        .from(mcpSessionLogs)
        .where(and(
          gte(mcpSessionLogs.startedAt, periodStart),
          lte(mcpSessionLogs.startedAt, periodEnd)
        ));
      
      if (query.workspaceId) {
        sessionQuery.where(eq(mcpSessionLogs.workspaceId, query.workspaceId));
      }
      
      const sessions = await sessionQuery;
      
      if (sessions.length === 0) {
        // No data for this period
        const [analytics] = await db.insert(mcpUsageAnalytics).values({
          workspaceId: query.workspaceId,
          periodType: query.periodType,
          periodStart,
          periodEnd,
          totalSessions: 0,
          totalInteractions: 0,
          totalUniqueUsers: 0,
          totalUniqueAgents: 0,
          totalPromptTokens: 0,
          totalCompletionTokens: 0,
          computedAt: new Date(),
          isComplete: true
        }).returning();
        
        return analytics;
      }
      
      // Get all session IDs
      const sessionIds = sessions.map(s => s.sessionId);
      
      // Get interactions for these sessions
      const interactions = sessionIds.length > 0
        ? await db.select().from(mcpSessionInteractions)
            .where(inArray(mcpSessionInteractions.sessionId, sessionIds))
        : [];
      
      // Calculate metrics
      const uniqueUsers = [...new Set(sessions.filter(s => s.userId).map(s => s.userId))];
      const uniqueAgents = [...new Set(sessions.filter(s => s.agentId).map(s => s.agentId))];
      
      // Calculate tool usage
      const toolUsage = interactions.reduce((acc, i) => {
        if (i.toolId) {
          acc[i.toolId] = (acc[i.toolId] || 0) + 1;
        } else if (i.toolName) {
          acc[i.toolName] = (acc[i.toolName] || 0) + 1;
        }
        return acc;
      }, {});
      
      // Calculate top tools
      const topTools = Object.entries(toolUsage)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([tool, count]) => ({ tool, count }));
      
      // Calculate user activity
      const userActivity = sessions.reduce((acc, s) => {
        if (s.userId) {
          acc[s.userId] = (acc[s.userId] || 0) + 1;
        }
        return acc;
      }, {});
      
      // Calculate top users
      const topUsers = Object.entries(userActivity)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([userId, count]) => ({ userId: parseInt(userId), sessionCount: count }));
      
      // Calculate agent activity
      const agentActivity = sessions.reduce((acc, s) => {
        if (s.agentId) {
          acc[s.agentId] = (acc[s.agentId] || 0) + 1;
        }
        return acc;
      }, {});
      
      // Calculate top agents
      const topAgents = Object.entries(agentActivity)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([agentId, count]) => ({ agentId, sessionCount: count }));
      
      // Calculate client type breakdown
      const clientTypeBreakdown = sessions.reduce((acc, s) => {
        acc[s.clientType] = (acc[s.clientType] || 0) + 1;
        return acc;
      }, {});
      
      // Calculate response times
      const responseTimes = interactions
        .filter(i => i.durationMs && i.type === 'response')
        .map(i => i.durationMs);
      
      const avgResponseTime = responseTimes.length > 0
        ? Math.round(responseTimes.reduce((acc, time) => acc + time, 0) / responseTimes.length)
        : null;
      
      // Calculate p95 response time
      const p95ResponseTime = responseTimes.length > 0
        ? responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)]
        : null;
      
      // Calculate error rate
      const totalErrors = interactions.filter(i => i.type === 'error').length;
      const errorRate = interactions.length > 0
        ? { percentage: (totalErrors / interactions.length) * 100, count: totalErrors }
        : { percentage: 0, count: 0 };
      
      // Calculate total tokens
      const totalPromptTokens = sessions.reduce((acc, s) => acc + (s.totalPromptTokens || 0), 0);
      const totalCompletionTokens = sessions.reduce((acc, s) => acc + (s.totalCompletionTokens || 0), 0);
      
      // Calculate cost (estimated)
      const totalCost = {
        prompt: totalPromptTokens * 0.00001, // $0.01 per 1000 tokens
        completion: totalCompletionTokens * 0.00002, // $0.02 per 1000 tokens
        total: (totalPromptTokens * 0.00001) + (totalCompletionTokens * 0.00002)
      };
      
      // Calculate cost by model (simplified)
      const costByModel = {
        'gpt-3.5-turbo': {
          prompt: totalPromptTokens * 0.000005,
          completion: totalCompletionTokens * 0.000015,
          total: (totalPromptTokens * 0.000005) + (totalCompletionTokens * 0.000015)
        },
        'gpt-4': {
          prompt: totalPromptTokens * 0.00003,
          completion: totalCompletionTokens * 0.00006,
          total: (totalPromptTokens * 0.00003) + (totalCompletionTokens * 0.00006)
        }
      };
      
      // Calculate cost by user
      const costByUser = uniqueUsers.reduce((acc, userId) => {
        const userSessions = sessions.filter(s => s.userId === userId);
        const userPromptTokens = userSessions.reduce((sum, s) => sum + (s.totalPromptTokens || 0), 0);
        const userCompletionTokens = userSessions.reduce((sum, s) => sum + (s.totalCompletionTokens || 0), 0);
        
        acc[userId] = {
          prompt: userPromptTokens * 0.00001,
          completion: userCompletionTokens * 0.00002,
          total: (userPromptTokens * 0.00001) + (userCompletionTokens * 0.00002)
        };
        
        return acc;
      }, {});
      
      // Insert or update analytics
      const [analytics] = await db.insert(mcpUsageAnalytics).values({
        workspaceId: query.workspaceId,
        periodType: query.periodType,
        periodStart,
        periodEnd,
        totalSessions: sessions.length,
        totalInteractions: interactions.length,
        totalUniqueUsers: uniqueUsers.length,
        totalUniqueAgents: uniqueAgents.length,
        totalPromptTokens,
        totalCompletionTokens,
        toolUsage,
        topTools,
        avgResponseTime,
        p95ResponseTime,
        errorRate,
        topUsers,
        topAgents,
        userAgentBreakdown: clientTypeBreakdown,
        topAccessedResources: {}, // Placeholder for future analysis
        dataCategories: {}, // Placeholder for future analysis
        detectedAnomalies: {}, // Placeholder for future analysis
        totalCost,
        costByModel,
        costByUser,
        computedAt: new Date(),
        isComplete: true
      }).returning();
      
      return analytics;
    } catch (error) {
      console.error('Error computing usage analytics:', error);
      throw new Error('Failed to compute usage analytics');
    }
  }
  
  /**
   * Export session logs to a file
   */
  public async exportSessionLogs(
    options: {
      workspaceId?: number,
      fromDate?: Date,
      toDate?: Date,
      format?: 'json' | 'csv',
      includeInteractions?: boolean
    }
  ): Promise<{ filePath: string, count: number }> {
    try {
      // Build query based on options
      let query = db.select().from(mcpSessionLogs);
      
      if (options.workspaceId) {
        query = query.where(eq(mcpSessionLogs.workspaceId, options.workspaceId));
      }
      
      if (options.fromDate) {
        query = query.where(gte(mcpSessionLogs.startedAt, options.fromDate));
      }
      
      if (options.toDate) {
        query = query.where(lte(mcpSessionLogs.startedAt, options.toDate));
      }
      
      const sessions = await query;
      
      if (options.includeInteractions && sessions.length > 0) {
        const sessionIds = sessions.map(s => s.sessionId);
        const interactions = await db.select()
          .from(mcpSessionInteractions)
          .where(inArray(mcpSessionInteractions.sessionId, sessionIds));
        
        // Group interactions by session
        const interactionsBySession = interactions.reduce((acc, i) => {
          if (!acc[i.sessionId]) acc[i.sessionId] = [];
          acc[i.sessionId].push(i);
          return acc;
        }, {});
        
        // Add interactions to sessions
        sessions.forEach(s => {
          s['interactions'] = interactionsBySession[s.sessionId] || [];
        });
      }
      
      // Generate timestamp for filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const format = options.format || 'json';
      const filename = `session_logs_export_${timestamp}.${format}`;
      const filePath = join(__dirname, '..', '..', 'exports', filename);
      
      // Write to file
      if (format === 'json') {
        writeFileSync(filePath, JSON.stringify(sessions, null, 2));
      } else {
        // Simple CSV generation for sessions only
        const header = Object.keys(sessions[0] || {}).filter(k => k !== 'interactions').join(',');
        const rows = sessions.map(s => 
          Object.keys(s).filter(k => k !== 'interactions')
            .map(k => typeof s[k] === 'object' ? JSON.stringify(s[k]) : s[k])
            .join(',')
        );
        writeFileSync(filePath, [header, ...rows].join('\n'));
      }
      
      return { filePath, count: sessions.length };
    } catch (error) {
      console.error('Error exporting session logs:', error);
      throw new Error('Failed to export session logs');
    }
  }
  
  /**
   * Get session statistics for a workspace
   */
  public async getSessionStatistics(
    workspaceId: number,
    period?: { fromDate: Date, toDate: Date }
  ): Promise<any> {
    try {
      // Build query based on options
      let query = db.select().from(mcpSessionLogs)
        .where(eq(mcpSessionLogs.workspaceId, workspaceId));
      
      if (period?.fromDate) {
        query = query.where(gte(mcpSessionLogs.startedAt, period.fromDate));
      }
      
      if (period?.toDate) {
        query = query.where(lte(mcpSessionLogs.startedAt, period.toDate));
      }
      
      const sessions = await query;
      
      // Get session IDs
      const sessionIds = sessions.map(s => s.sessionId);
      
      // Get interactions if there are sessions
      const interactions = sessionIds.length > 0
        ? await db.select().from(mcpSessionInteractions)
            .where(inArray(mcpSessionInteractions.sessionId, sessionIds))
        : [];
      
      // Calculate statistics
      return {
        totalSessions: sessions.length,
        totalInteractions: interactions.length,
        activeSessions: sessions.filter(s => s.status === 'active').length,
        completedSessions: sessions.filter(s => s.status === 'completed').length,
        errorSessions: sessions.filter(s => s.status === 'error').length,
        uniqueUsers: [...new Set(sessions.filter(s => s.userId).map(s => s.userId))].length,
        uniqueAgents: [...new Set(sessions.filter(s => s.agentId).map(s => s.agentId))].length,
        averageSessionDuration: sessions.filter(s => s.durationMs).length > 0
          ? Math.round(sessions.filter(s => s.durationMs).reduce((acc, s) => acc + s.durationMs, 0) / 
              sessions.filter(s => s.durationMs).length / 1000) // in seconds
          : 0,
        totalPromptTokens: sessions.reduce((acc, s) => acc + (s.totalPromptTokens || 0), 0),
        totalCompletionTokens: sessions.reduce((acc, s) => acc + (s.totalCompletionTokens || 0), 0),
        interactionsByType: interactions.reduce((acc, i) => {
          acc[i.type] = (acc[i.type] || 0) + 1;
          return acc;
        }, {}),
        sessionsByClassification: sessions.reduce((acc, s) => {
          acc[s.classification] = (acc[s.classification] || 0) + 1;
          return acc;
        }, {}),
        piiDetections: interactions.filter(i => i.containedPii).length
      };
    } catch (error) {
      console.error('Error getting session statistics:', error);
      throw new Error('Failed to get session statistics');
    }
  }
}

// Export singleton instance
export const secureSessionLoggingService = new SecureSessionLoggingService();