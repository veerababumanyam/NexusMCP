/**
 * Financial Anomaly Detection Service
 * 
 * Monitors financial transactions and data access for suspicious activities:
 * - Detects pattern-based anomalies in financial transactions
 * - Monitors unusual user behavior
 * - Enforces trading limits and approval requirements
 * - Generates real-time alerts for potential compliance violations
 * - Creates detailed audit trails for forensic analysis
 */

import { db } from '../../../db';
import { 
  financialAnomalyRules,
  financialAnomalyDetections,
  financialTransactions,
  financialRoles,
  financialUserRoles
} from '../../../shared/schema_financial';
import { users, workspaces } from '../../../shared/schema';
import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { eventBus } from '../../eventBus';
import { secureAuditService as auditService } from '../audit/SecureAuditService';
import { mlAnomalyDetectionService } from './mlAnomalyDetection';

interface AnomalyRuleExecutionContext {
  transaction?: typeof financialTransactions.$inferSelect;
  userId?: number;
  workspaceId?: number;
  sessionId?: string;
  requestId?: string;
  timestamp?: Date;
  additionalData?: Record<string, any>;
}

interface AnomalyDetectionResult {
  detected: boolean;
  rule?: typeof financialAnomalyRules.$inferSelect;
  severity?: string;
  description?: string;
  evidenceData?: Record<string, any>;
}

/**
 * Financial Anomaly Detection Service
 * Monitors for suspicious activities and regulatory violations
 */
export class FinancialAnomalyService {
  /**
   * Analyze a financial transaction for anomalies using both rules and ML
   */
  public async analyzeTransaction(
    transaction: typeof financialTransactions.$inferSelect,
    context: Omit<AnomalyRuleExecutionContext, 'transaction'> = {},
    options: {
      skipRuleBasedDetection?: boolean;
      skipMlDetection?: boolean;
      includeTransactionHistory?: boolean;
    } = {}
  ): Promise<AnomalyDetectionResult[]> {
    try {
      const detections: AnomalyDetectionResult[] = [];
      
      // 1. Perform rule-based detection (traditional approach)
      if (!options.skipRuleBasedDetection) {
        // Get applicable rules for this transaction's workspace
        const rules = await this.getActiveRules('transaction', transaction.workspaceId);
        
        if (rules.length > 0) {
          // Create execution context
          const executionContext: AnomalyRuleExecutionContext = {
            transaction,
            userId: transaction.requestedBy,
            workspaceId: transaction.workspaceId,
            ...context,
            timestamp: context.timestamp || new Date()
          };
          
          // Execute all rules
          const results = await Promise.all(
            rules.map(rule => this.executeRule(rule, executionContext))
          );
          
          // Filter for positive detections and add to overall results
          const ruleDetections = results.filter(result => result.detected);
          detections.push(...ruleDetections);
          
          // Record rule-based anomalies
          for (const detection of ruleDetections) {
            if (detection.rule) {
              await this.recordAnomaly(
                detection.rule.id,
                transaction.transactionId,
                {
                  userId: transaction.requestedBy,
                  workspaceId: transaction.workspaceId,
                  severity: detection.severity,
                  description: detection.description,
                  evidenceData: detection.evidenceData,
                  sessionId: context.sessionId,
                  detectionMethod: 'rule_based'
                }
              );
            }
          }
        }
      }
      
      // 2. Perform ML-based detection if OpenAI API key is available
      if (!options.skipMlDetection && process.env.OPENAI_API_KEY) {
        try {
          // Run ML analysis on the transaction
          const mlAnalysis = await mlAnomalyDetectionService.analyzeTransaction(
            transaction,
            options.includeTransactionHistory ?? true
          );
          
          // If anomaly detected, add to results and record
          if (mlAnalysis.isAnomaly) {
            // Create an ML-based detection result
            const mlDetection: AnomalyDetectionResult = {
              detected: true,
              severity: this.getSeverityFromScore(mlAnalysis.anomalyScore),
              description: mlAnalysis.explanation,
              evidenceData: {
                riskFactors: mlAnalysis.riskFactors,
                suggestedActions: mlAnalysis.suggestedActions,
                anomalyScore: mlAnalysis.anomalyScore,
                confidenceScore: mlAnalysis.confidenceScore,
                detectionMethod: 'ml'
              }
            };
            
            detections.push(mlDetection);
            
            // Record in database for tracking
            await mlAnomalyDetectionService.recordMlDetection(transaction, mlAnalysis);
            
            // Also log the ML detection for auditing
            await auditService.logSecurityEvent({
              eventType: 'ANOMALY_DETECTED',
              severity: mlDetection.severity,
              userId: transaction.requestedBy,
              workspaceId: transaction.workspaceId,
              resourceType: 'FINANCIAL_TRANSACTION',
              resourceId: transaction.transactionId,
              details: {
                description: mlDetection.description,
                detectionMethod: 'ml',
                evidenceData: mlDetection.evidenceData
              }
            });
          }
        } catch (mlError) {
          console.error('Error during ML anomaly detection:', mlError);
          // Continue with rule-based detections even if ML fails
        }
      }
      
      return detections;
    } catch (error) {
      console.error('Error analyzing transaction for anomalies:', error);
      return [];
    }
  }
  
  /**
   * Analyze user activity for anomalies
   */
  public async analyzeUserActivity(
    userId: number,
    activityType: string,
    context: AnomalyRuleExecutionContext = {}
  ): Promise<AnomalyDetectionResult[]> {
    try {
      // Get applicable rules for user behavior
      const rules = await this.getActiveRules('user_behavior', context.workspaceId);
      
      if (rules.length === 0) {
        return [];
      }
      
      // Create execution context
      const executionContext: AnomalyRuleExecutionContext = {
        userId,
        ...context,
        additionalData: {
          ...context.additionalData,
          activityType
        },
        timestamp: context.timestamp || new Date()
      };
      
      // Execute all rules
      const results = await Promise.all(
        rules.map(rule => this.executeRule(rule, executionContext))
      );
      
      // Filter for positive detections
      const detections = results.filter(result => result.detected);
      
      // Record any anomalies detected
      for (const detection of detections) {
        if (detection.rule) {
          await this.recordAnomaly(
            detection.rule.id,
            null, // No transaction ID for user activity
            {
              userId,
              workspaceId: context.workspaceId,
              severity: detection.severity,
              description: detection.description,
              evidenceData: detection.evidenceData,
              sessionId: context.sessionId
            }
          );
        }
      }
      
      return detections;
    } catch (error) {
      console.error('Error analyzing user activity for anomalies:', error);
      return [];
    }
  }

  /**
   * Check trading limits for a user
   */
  public async checkTradingLimits(
    userId: number,
    transactionDetails: {
      type: string;
      amount: number;
      instrumentId?: number;
      instrumentType?: string;
      direction?: string;
    },
    workspaceId?: number
  ): Promise<{
    approved: boolean;
    requiresApproval: boolean;
    limitExceeded: boolean;
    limitInfo?: Record<string, any>;
    reason?: string;
  }> {
    try {
      // Get user's financial roles
      const userRoles = await this.getUserFinancialRoles(userId, workspaceId);
      
      if (userRoles.length === 0) {
        return {
          approved: false,
          requiresApproval: true,
          limitExceeded: true,
          reason: 'No financial roles assigned'
        };
      }
      
      // Extract trading limits from all roles
      const allTradingLimits = userRoles
        .map(role => role.tradingLimits as Record<string, any>)
        .filter(Boolean);
      
      if (allTradingLimits.length === 0) {
        return {
          approved: true,
          requiresApproval: false,
          limitExceeded: false
        };
      }
      
      // Apply the most restrictive limits across roles
      const maxOrderSize = Math.min(
        ...allTradingLimits
          .map(limits => limits.maxOrderSize)
          .filter(Boolean)
          .map(limit => Number(limit))
      );
      
      const requiresApprovalAbove = Math.min(
        ...allTradingLimits
          .map(limits => limits.requiresApprovalAbove)
          .filter(Boolean)
          .map(threshold => Number(threshold))
      );
      
      // Check amount against limits
      const amount = Number(transactionDetails.amount);
      
      if (isNaN(amount)) {
        return {
          approved: false,
          requiresApproval: true,
          limitExceeded: true,
          reason: 'Invalid transaction amount'
        };
      }
      
      // Check for instrument restrictions
      const hasInstrumentRestriction = allTradingLimits.some(limits => {
        if (!limits.instrumentRestrictions) return false;
        
        return limits.instrumentRestrictions.includes(transactionDetails.instrumentType);
      });
      
      // Check for transaction type restrictions
      const hasTransactionTypeRestriction = allTradingLimits.some(limits => {
        if (!limits.transactionTypeRestrictions) return false;
        
        return limits.transactionTypeRestrictions.includes(transactionDetails.type);
      });
      
      // Check approval requirements
      const requiresSpecialApproval = allTradingLimits.some(limits => {
        if (!limits.approvalRequirements) return false;
        
        return (
          (limits.approvalRequirements.largeOrders && amount > requiresApprovalAbove) ||
          (limits.approvalRequirements.newInstruments && hasInstrumentRestriction) ||
          (limits.approvalRequirements[transactionDetails.type])
        );
      });
      
      // Determine final approval status
      if (amount > maxOrderSize) {
        return {
          approved: false,
          requiresApproval: true,
          limitExceeded: true,
          limitInfo: {
            maxOrderSize,
            amount
          },
          reason: `Transaction amount $${amount} exceeds maximum order size $${maxOrderSize}`
        };
      }
      
      if (hasInstrumentRestriction) {
        return {
          approved: false,
          requiresApproval: true,
          limitExceeded: true,
          limitInfo: {
            restrictedInstrumentType: transactionDetails.instrumentType
          },
          reason: `Restricted instrument type: ${transactionDetails.instrumentType}`
        };
      }
      
      if (hasTransactionTypeRestriction) {
        return {
          approved: false,
          requiresApproval: true,
          limitExceeded: true,
          limitInfo: {
            restrictedTransactionType: transactionDetails.type
          },
          reason: `Restricted transaction type: ${transactionDetails.type}`
        };
      }
      
      if (requiresSpecialApproval || amount > requiresApprovalAbove) {
        return {
          approved: false,
          requiresApproval: true,
          limitExceeded: false,
          limitInfo: {
            requiresApprovalAbove,
            amount
          },
          reason: `Transaction amount $${amount} requires approval (threshold: $${requiresApprovalAbove})`
        };
      }
      
      return {
        approved: true,
        requiresApproval: false,
        limitExceeded: false,
        limitInfo: {
          maxOrderSize,
          requiresApprovalAbove,
          amount
        }
      };
    } catch (error) {
      console.error('Error checking trading limits:', error);
      
      return {
        approved: false,
        requiresApproval: true,
        limitExceeded: false,
        reason: `Error checking trading limits: ${error.message}`
      };
    }
  }

  /**
   * Get active anomaly rules by category
   */
  private async getActiveRules(
    category: string,
    workspaceId?: number
  ): Promise<Array<typeof financialAnomalyRules.$inferSelect>> {
    try {
      // Get system-wide rules for this category
      const systemRules = await db.query.financialAnomalyRules.findMany({
        where: and(
          eq(financialAnomalyRules.isEnabled, true),
          eq(financialAnomalyRules.isSystem, true),
          eq(financialAnomalyRules.category, category)
        )
      });
      
      // If no workspace specified, return just system rules
      if (!workspaceId) {
        return systemRules;
      }
      
      // Get workspace-specific rules
      const workspaceRules = await db.query.financialAnomalyRules.findMany({
        where: and(
          eq(financialAnomalyRules.isEnabled, true),
          eq(financialAnomalyRules.workspaceId, workspaceId),
          eq(financialAnomalyRules.category, category)
        )
      });
      
      // Combine system and workspace rules
      return [...systemRules, ...workspaceRules];
    } catch (error) {
      console.error(`Error getting active rules for category ${category}:`, error);
      return [];
    }
  }

  /**
   * Get user's financial roles
   */
  private async getUserFinancialRoles(
    userId: number,
    workspaceId?: number
  ): Promise<Array<typeof financialRoles.$inferSelect>> {
    try {
      // Get user's financial role assignments
      const userRoleAssignments = await db.query.financialUserRoles.findMany({
        where: and(
          eq(financialUserRoles.userId, userId),
          eq(financialUserRoles.status, 'active'),
          workspaceId 
            ? eq(financialUserRoles.workspaceId, workspaceId) 
            : undefined
        )
      });
      
      if (userRoleAssignments.length === 0) {
        return [];
      }
      
      // Get role details
      const roleIds = userRoleAssignments.map(ura => ura.roleId);
      
      return await db.query.financialRoles.findMany({
        where: inArray(financialRoles.id, roleIds)
      });
    } catch (error) {
      console.error(`Error getting financial roles for user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Execute a rule against the provided context
   */
  private async executeRule(
    rule: typeof financialAnomalyRules.$inferSelect,
    context: AnomalyRuleExecutionContext
  ): Promise<AnomalyDetectionResult> {
    try {
      const ruleLogic = rule.ruleLogic as Record<string, any>;
      const ruleType = rule.ruleType;
      
      // Default result - no anomaly detected
      const result: AnomalyDetectionResult = {
        detected: false
      };
      
      // Apply rule based on type
      switch (ruleType) {
        case 'threshold':
          return this.applyThresholdRule(rule, ruleLogic, context);
        
        case 'pattern':
          return this.applyPatternRule(rule, ruleLogic, context);
          
        case 'velocity':
          return this.applyVelocityRule(rule, ruleLogic, context);
          
        case 'combination':
          return this.applyCombinationRule(rule, ruleLogic, context);
          
        default:
          console.warn(`Unknown rule type: ${ruleType}`);
          return result;
      }
    } catch (error) {
      console.error(`Error executing rule ${rule.id}:`, error);
      
      return {
        detected: false
      };
    }
  }

  /**
   * Apply a threshold-based rule
   */
  private async applyThresholdRule(
    rule: typeof financialAnomalyRules.$inferSelect,
    ruleLogic: Record<string, any>,
    context: AnomalyRuleExecutionContext
  ): Promise<AnomalyDetectionResult> {
    const result: AnomalyDetectionResult = {
      detected: false,
      rule,
      severity: rule.severity
    };
    
    if (!context.transaction || !ruleLogic.field || !ruleLogic.threshold) {
      return result;
    }
    
    // Extract field value from transaction
    const fieldValue = this.getNestedValue(context.transaction, ruleLogic.field);
    
    if (fieldValue === undefined) {
      return result;
    }
    
    // Convert to numeric value
    const numericValue = Number(fieldValue);
    
    if (isNaN(numericValue)) {
      return result;
    }
    
    // Check against threshold
    const threshold = Number(ruleLogic.threshold);
    const operator = ruleLogic.operator || '>';
    
    let thresholdExceeded = false;
    
    switch (operator) {
      case '>':
        thresholdExceeded = numericValue > threshold;
        break;
      case '>=':
        thresholdExceeded = numericValue >= threshold;
        break;
      case '<':
        thresholdExceeded = numericValue < threshold;
        break;
      case '<=':
        thresholdExceeded = numericValue <= threshold;
        break;
      case '=':
      case '==':
        thresholdExceeded = numericValue === threshold;
        break;
      case '!=':
        thresholdExceeded = numericValue !== threshold;
        break;
    }
    
    if (thresholdExceeded) {
      result.detected = true;
      result.description = ruleLogic.description || 
        `${rule.name}: ${ruleLogic.field} value ${numericValue} ${operator} threshold ${threshold}`;
      
      result.evidenceData = {
        field: ruleLogic.field,
        value: numericValue,
        threshold,
        operator
      };
    }
    
    return result;
  }

  /**
   * Apply a pattern-based rule
   */
  private async applyPatternRule(
    rule: typeof financialAnomalyRules.$inferSelect,
    ruleLogic: Record<string, any>,
    context: AnomalyRuleExecutionContext
  ): Promise<AnomalyDetectionResult> {
    const result: AnomalyDetectionResult = {
      detected: false,
      rule,
      severity: rule.severity
    };
    
    if (!ruleLogic.patterns || !Array.isArray(ruleLogic.patterns)) {
      return result;
    }
    
    // For transaction patterns
    if (context.transaction) {
      for (const pattern of ruleLogic.patterns) {
        // Check if all conditions in the pattern match
        let allConditionsMatch = true;
        const matchedValues: Record<string, any> = {};
        
        for (const [field, expectedValue] of Object.entries(pattern.conditions || {})) {
          const actualValue = this.getNestedValue(context.transaction, field);
          
          if (actualValue === undefined || actualValue !== expectedValue) {
            allConditionsMatch = false;
            break;
          }
          
          matchedValues[field] = actualValue;
        }
        
        if (allConditionsMatch) {
          result.detected = true;
          result.description = pattern.description || 
            `${rule.name}: Transaction matches suspicious pattern`;
          
          result.evidenceData = {
            patternName: pattern.name || 'Unnamed pattern',
            matchedValues
          };
          
          break;
        }
      }
    }
    
    // For user behavior patterns
    if (context.userId && context.additionalData?.activityType) {
      for (const pattern of ruleLogic.patterns) {
        if (pattern.activityType === context.additionalData.activityType) {
          result.detected = true;
          result.description = pattern.description || 
            `${rule.name}: Suspicious user activity detected: ${context.additionalData.activityType}`;
          
          result.evidenceData = {
            patternName: pattern.name || 'Unnamed pattern',
            activityType: context.additionalData.activityType,
            userId: context.userId
          };
          
          break;
        }
      }
    }
    
    return result;
  }

  /**
   * Apply a velocity-based rule (rate of transactions or activities)
   */
  private async applyVelocityRule(
    rule: typeof financialAnomalyRules.$inferSelect,
    ruleLogic: Record<string, any>,
    context: AnomalyRuleExecutionContext
  ): Promise<AnomalyDetectionResult> {
    const result: AnomalyDetectionResult = {
      detected: false,
      rule,
      severity: rule.severity
    };
    
    if (!context.userId || !ruleLogic.timeWindow || !ruleLogic.maxCount) {
      return result;
    }
    
    // Calculate time window
    const timeWindow = Number(ruleLogic.timeWindow) || 60; // Default 60 minutes
    const startTime = new Date();
    startTime.setMinutes(startTime.getMinutes() - timeWindow);
    
    // Count transactions in time window
    let transactionCount = 0;
    
    if (ruleLogic.transactionType) {
      // Count specific transaction types
      const transactions = await db.query.financialTransactions.findMany({
        where: and(
          eq(financialTransactions.requestedBy, context.userId),
          eq(financialTransactions.type, ruleLogic.transactionType),
          gte(financialTransactions.createdAt, startTime)
        )
      });
      
      transactionCount = transactions.length;
    } else {
      // Count all transactions
      const transactions = await db.query.financialTransactions.findMany({
        where: and(
          eq(financialTransactions.requestedBy, context.userId),
          gte(financialTransactions.createdAt, startTime)
        )
      });
      
      transactionCount = transactions.length;
    }
    
    // Check if count exceeds max allowed
    const maxCount = Number(ruleLogic.maxCount);
    
    if (transactionCount >= maxCount) {
      result.detected = true;
      result.description = ruleLogic.description || 
        `${rule.name}: Transaction velocity exceeds limit (${transactionCount} in ${timeWindow} minutes)`;
      
      result.evidenceData = {
        userId: context.userId,
        transactionCount,
        timeWindow,
        maxAllowed: maxCount,
        transactionType: ruleLogic.transactionType || 'all'
      };
    }
    
    return result;
  }

  /**
   * Apply a combination rule (multiple conditions)
   */
  private async applyCombinationRule(
    rule: typeof financialAnomalyRules.$inferSelect,
    ruleLogic: Record<string, any>,
    context: AnomalyRuleExecutionContext
  ): Promise<AnomalyDetectionResult> {
    const result: AnomalyDetectionResult = {
      detected: false,
      rule,
      severity: rule.severity
    };
    
    if (!ruleLogic.conditions || !Array.isArray(ruleLogic.conditions) || ruleLogic.conditions.length === 0) {
      return result;
    }
    
    // Track which conditions matched
    const matchedConditions: Record<string, any>[] = [];
    
    // Check each condition
    for (const condition of ruleLogic.conditions) {
      if (!condition.type) continue;
      
      let conditionMatched = false;
      
      switch (condition.type) {
        case 'threshold':
          if (context.transaction) {
            const fieldValue = this.getNestedValue(context.transaction, condition.field);
            
            if (fieldValue !== undefined) {
              const numericValue = Number(fieldValue);
              const threshold = Number(condition.threshold);
              
              if (!isNaN(numericValue) && !isNaN(threshold)) {
                conditionMatched = this.compareValues(numericValue, threshold, condition.operator || '>');
                
                if (conditionMatched) {
                  matchedConditions.push({
                    type: 'threshold',
                    field: condition.field,
                    value: numericValue,
                    threshold,
                    operator: condition.operator
                  });
                }
              }
            }
          }
          break;
          
        case 'pattern':
          if (context.transaction && condition.field && condition.value) {
            const fieldValue = this.getNestedValue(context.transaction, condition.field);
            
            conditionMatched = fieldValue === condition.value;
            
            if (conditionMatched) {
              matchedConditions.push({
                type: 'pattern',
                field: condition.field,
                value: fieldValue
              });
            }
          }
          break;
          
        case 'time':
          if (context.timestamp) {
            const hour = context.timestamp.getHours();
            
            if (condition.outsideHours && Array.isArray(condition.outsideHours)) {
              const [startHour, endHour] = condition.outsideHours;
              
              // Check if current hour is outside business hours
              conditionMatched = hour < startHour || hour >= endHour;
              
              if (conditionMatched) {
                matchedConditions.push({
                  type: 'time',
                  hour,
                  outsideBusinessHours: true,
                  businessHours: condition.outsideHours
                });
              }
            }
          }
          break;
      }
    }
    
    // Check if enough conditions matched
    const matchThreshold = ruleLogic.matchThreshold || ruleLogic.conditions.length;
    
    if (matchedConditions.length >= matchThreshold) {
      result.detected = true;
      result.description = ruleLogic.description || 
        `${rule.name}: Multiple suspicious conditions detected`;
      
      result.evidenceData = {
        matchedConditions,
        matchThreshold,
        totalConditions: ruleLogic.conditions.length
      };
    }
    
    return result;
  }

  /**
   * Convert anomaly score to standard severity level
   */
  private getSeverityFromScore(score: number): 'low' | 'medium' | 'high' | 'critical' {
    if (score >= 0.9) return 'critical';
    if (score >= 0.75) return 'high';
    if (score >= 0.6) return 'medium';
    return 'low';
  }
  
  /**
   * Record a detected anomaly
   */
  private async recordAnomaly(
    ruleId: number,
    transactionId: string | null,
    options: {
      userId?: number;
      workspaceId?: number;
      severity: string;
      description: string;
      evidenceData?: Record<string, any>;
      sessionId?: string;
    }
  ): Promise<typeof financialAnomalyDetections.$inferSelect> {
    try {
      // Create anomaly record
      const [anomalyRecord] = await db.insert(financialAnomalyDetections).values({
        ruleId,
        transactionId,
        userId: options.userId,
        workspaceId: options.workspaceId,
        severity: options.severity,
        status: 'new',
        description: options.description,
        evidenceData: options.evidenceData,
        sessionId: options.sessionId,
        detectedAt: new Date()
      }).returning();
      
      // Create audit log entry
      await auditService.createAuditLog({
        userId: options.userId,
        action: 'anomaly.detected',
        resourceType: transactionId ? 'financial_transaction' : 'user_activity',
        resourceId: transactionId || String(options.userId),
        details: {
          anomalyId: anomalyRecord.id,
          ruleId,
          severity: options.severity,
          description: options.description,
          evidenceData: options.evidenceData,
          sessionId: options.sessionId
        },
        workspaceId: options.workspaceId
      });
      
      // Emit event for real-time monitoring
      eventBus.emit(options.severity === 'high' || options.severity === 'critical' 
        ? 'security.breach' 
        : 'security.suspicious.activity', 
      {
        anomalyId: anomalyRecord.id,
        ruleId,
        transactionId,
        userId: options.userId,
        workspaceId: options.workspaceId,
        severity: options.severity,
        description: options.description,
        timestamp: new Date()
      });
      
      return anomalyRecord;
    } catch (error) {
      console.error('Error recording anomaly:', error);
      throw error;
    }
  }

  /**
   * Helper to get nested object values
   */
  private getNestedValue(obj: any, path: string): any {
    const parts = path.split('.');
    let current = obj;
    
    for (const part of parts) {
      if (current === null || current === undefined) {
        return undefined;
      }
      
      current = current[part];
    }
    
    return current;
  }

  /**
   * Helper to compare values
   */
  private compareValues(value1: number, value2: number, operator: string): boolean {
    switch (operator) {
      case '>':
        return value1 > value2;
      case '>=':
        return value1 >= value2;
      case '<':
        return value1 < value2;
      case '<=':
        return value1 <= value2;
      case '=':
      case '==':
        return value1 === value2;
      case '!=':
        return value1 !== value2;
      default:
        return false;
    }
  }

  /**
   * Create a new anomaly rule
   */
  public async createAnomalyRule(
    ruleData: Omit<typeof financialAnomalyRules.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<typeof financialAnomalyRules.$inferSelect> {
    try {
      const [newRule] = await db.insert(financialAnomalyRules).values({
        ...ruleData,
        updatedAt: new Date()
      }).returning();
      
      return newRule;
    } catch (error) {
      console.error('Error creating anomaly rule:', error);
      throw error;
    }
  }

  /**
   * Update an anomaly rule
   */
  public async updateAnomalyRule(
    id: number,
    ruleData: Partial<typeof financialAnomalyRules.$inferInsert>
  ): Promise<typeof financialAnomalyRules.$inferSelect | null> {
    try {
      const [updatedRule] = await db
        .update(financialAnomalyRules)
        .set({
          ...ruleData,
          updatedAt: new Date()
        })
        .where(eq(financialAnomalyRules.id, id))
        .returning();
      
      return updatedRule;
    } catch (error) {
      console.error(`Error updating anomaly rule ${id}:`, error);
      return null;
    }
  }

  /**
   * Delete an anomaly rule
   */
  public async deleteAnomalyRule(
    id: number
  ): Promise<boolean> {
    try {
      await db
        .delete(financialAnomalyRules)
        .where(eq(financialAnomalyRules.id, id));
      
      return true;
    } catch (error) {
      console.error(`Error deleting anomaly rule ${id}:`, error);
      return false;
    }
  }

  /**
   * Get anomaly detections by criteria
   */
  public async getAnomalyDetections(
    options: {
      workspaceId?: number;
      userId?: number;
      severity?: string;
      status?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
      offset?: number;
    }
  ): Promise<Array<typeof financialAnomalyDetections.$inferSelect>> {
    try {
      const conditions = [];
      
      if (options.workspaceId) {
        conditions.push(eq(financialAnomalyDetections.workspaceId, options.workspaceId));
      }
      
      if (options.userId) {
        conditions.push(eq(financialAnomalyDetections.userId, options.userId));
      }
      
      if (options.severity) {
        conditions.push(eq(financialAnomalyDetections.severity, options.severity));
      }
      
      if (options.status) {
        conditions.push(eq(financialAnomalyDetections.status, options.status));
      }
      
      if (options.startDate) {
        conditions.push(gte(financialAnomalyDetections.detectedAt, options.startDate));
      }
      
      if (options.endDate) {
        conditions.push(lte(financialAnomalyDetections.detectedAt, options.endDate));
      }
      
      const whereClause = conditions.length > 0 
        ? and(...conditions) 
        : undefined;
      
      return await db.query.financialAnomalyDetections.findMany({
        where: whereClause,
        orderBy: (anomalies, { desc }) => [desc(anomalies.detectedAt)],
        limit: options.limit || 100,
        offset: options.offset || 0,
        with: {
          rule: true,
          user: true,
          transaction: true
        }
      });
    } catch (error) {
      console.error('Error getting anomaly detections:', error);
      return [];
    }
  }

  /**
   * Update anomaly detection status
   */
  public async updateAnomalyStatus(
    id: number,
    status: string,
    resolutionNotes?: string,
    resolvedBy?: number
  ): Promise<typeof financialAnomalyDetections.$inferSelect | null> {
    try {
      const updateData: Partial<typeof financialAnomalyDetections.$inferInsert> = {
        status
      };
      
      if (status === 'resolved' || status === 'false_positive') {
        updateData.resolvedAt = new Date();
        updateData.resolvedBy = resolvedBy;
        updateData.resolutionNotes = resolutionNotes;
      }
      
      const [updatedAnomaly] = await db
        .update(financialAnomalyDetections)
        .set(updateData)
        .where(eq(financialAnomalyDetections.id, id))
        .returning();
      
      return updatedAnomaly;
    } catch (error) {
      console.error(`Error updating anomaly status ${id}:`, error);
      return null;
    }
  }
}

// Export singleton instance
export const financialAnomalyService = new FinancialAnomalyService();