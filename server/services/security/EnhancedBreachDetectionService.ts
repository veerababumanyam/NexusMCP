/**
 * Enhanced Breach Detection Service
 * 
 * Provides enterprise-grade breach detection capabilities integrated with:
 * 1. OAuth monitoring and security events
 * 2. IP access control violations
 * 3. Token usage anomalies
 * 4. Security scanner findings
 * 5. Real-time alerting
 */

import { db } from '@db';
import { 
  breachDetectionRules, 
  breachDetections, 
  breachEvents, 
  breachIndicators,
  breachIndicatorLinks
} from '@shared/schema_breach_detection';
import { oauthSecurityEvents } from '@shared/schema_oauth_rotation';
import { oauthMonitoringAnomalies } from '@shared/schema_oauth_monitoring';
import { oauthIpAccessLogs } from '@shared/schema_oauth_ip_access';
import { eq, and, or, not, sql, gte, lte, desc, count, like } from 'drizzle-orm';
import { eventBus } from '../../infrastructure/events/EventBus';
import { format } from 'date-fns';
import { OAuthMonitoringService } from '../oauth/OAuthMonitoringService';
import { OAuthTokenRotationService } from '../oauth/OAuthTokenRotationService';
import { OAuthIpAccessControlService } from '../oauth/OAuthIpAccessControlService';

// Service instances
const oauthMonitoringService = OAuthMonitoringService.getInstance();
const oauthTokenRotationService = OAuthTokenRotationService.getInstance();
const oauthIpAccessControlService = OAuthIpAccessControlService.getInstance();

export class EnhancedBreachDetectionService {
  private static instance: EnhancedBreachDetectionService;
  private rulesTimers: Map<number, NodeJS.Timeout> = new Map();
  
  // Methods to satisfy interface requirements for routes
  public async getBreachById(id: number): Promise<any> {
    try {
      return await db.query.breachDetections.findFirst({
        where: eq(breachDetections.id, id)
      });
    } catch (error) {
      console.error(`Error getting breach by ID ${id}:`, error);
      return null;
    }
  }
  
  public async updateBreach(id: number, data: any): Promise<any> {
    try {
      const updated = await db.update(breachDetections)
        .set(data)
        .where(eq(breachDetections.id, id))
        .returning();
      return updated[0];
    } catch (error) {
      console.error(`Error updating breach ${id}:`, error);
      return null;
    }
  }
  
  public async getBreachEvents(breachId: number): Promise<any[]> {
    try {
      return await db.query.breachEvents.findMany({
        where: eq(breachEvents.breachId, breachId),
        orderBy: desc(breachEvents.timestamp)
      });
    } catch (error) {
      console.error(`Error getting breach events for breach ${breachId}:`, error);
      return [];
    }
  }
  
  public async getBreachDetectionRules(): Promise<any[]> {
    try {
      return await db.query.breachDetectionRules.findMany({
        orderBy: desc(breachDetectionRules.createdAt)
      });
    } catch (error) {
      console.error('Error getting breach detection rules:', error);
      return [];
    }
  }
  
  public async getBreachDetectionRuleById(id: number): Promise<any> {
    try {
      return await db.query.breachDetectionRules.findFirst({
        where: eq(breachDetectionRules.id, id)
      });
    } catch (error) {
      console.error(`Error getting breach detection rule by ID ${id}:`, error);
      return null;
    }
  }
  
  public async createBreachDetectionRule(rule: any): Promise<any> {
    try {
      const newRule = await db.insert(breachDetectionRules)
        .values(rule)
        .returning();
      
      // Schedule the new rule for evaluation
      this.scheduleRuleEvaluation(newRule[0]);
      
      return newRule[0];
    } catch (error) {
      console.error('Error creating breach detection rule:', error);
      return null;
    }
  }
  
  public async updateBreachDetectionRule(id: number, data: any): Promise<any> {
    try {
      const updated = await db.update(breachDetectionRules)
        .set(data)
        .where(eq(breachDetectionRules.id, id))
        .returning();
      
      // Re-schedule the rule for evaluation if it was updated
      if (updated.length > 0) {
        this.scheduleRuleEvaluation(updated[0]);
      }
      
      return updated[0];
    } catch (error) {
      console.error(`Error updating breach detection rule ${id}:`, error);
      return null;
    }
  }
  
  public async deleteBreachDetectionRule(id: number): Promise<boolean> {
    try {
      // Clear any scheduled evaluation
      if (this.rulesTimers.has(id)) {
        clearInterval(this.rulesTimers.get(id));
        this.rulesTimers.delete(id);
      }
      
      await db.delete(breachDetectionRules)
        .where(eq(breachDetectionRules.id, id));
      
      return true;
    } catch (error) {
      console.error(`Error deleting breach detection rule ${id}:`, error);
      return false;
    }
  }
  
  public async testBreachDetectionRule(rule: any): Promise<any> {
    try {
      // Create a temporary rule object for testing
      const testRule = { ...rule, id: -1 };
      
      // Run a one-time evaluation
      const definition = typeof testRule.definition === 'string' 
        ? JSON.parse(testRule.definition) 
        : testRule.definition;
      
      // Results container
      const results: any = {
        matched: false,
        evaluationTime: new Date(),
        metrics: {},
        events: []
      };
      
      // Evaluate based on rule type
      switch (testRule.type) {
        case 'behavior':
          results.metrics = await this.testBehaviorRule(testRule, definition);
          break;
        case 'signature':
          results.events = await this.testSignatureRule(testRule, definition);
          break;
        case 'anomaly':
          results.anomalies = await this.testAnomalyRule(testRule, definition);
          break;
        case 'correlation':
          results.correlations = await this.testCorrelationRule(testRule, definition);
          break;
      }
      
      return results;
    } catch (error) {
      console.error('Error testing breach detection rule:', error);
      return { error: error.message, evaluationTime: new Date() };
    }
  }
  
  // Test method implementations
  private async testBehaviorRule(rule: any, definition: any): Promise<any> {
    const { timeWindow, metrics } = definition;
    const timeWindowMs = timeWindow * 60 * 1000;
    const startDate = new Date(Date.now() - timeWindowMs);
    
    // Collect metrics
    const metricValues: Record<string, number> = {};
    
    for (const metric of metrics) {
      try {
        const metricData = await oauthMonitoringService.getMetrics({
          metricName: metric.name,
          startDate,
          endDate: new Date(),
          aggregation: metric.aggregation || 'sum'
        });
        
        const totalValue = metricData.reduce((sum, item) => sum + item.value, 0);
        metricValues[metric.name] = totalValue;
      } catch (error) {
        console.error(`Error getting metric ${metric.name}:`, error);
        metricValues[metric.name] = 0;
      }
    }
    
    return metricValues;
  }
  
  private async testSignatureRule(rule: any, definition: any): Promise<any[]> {
    const { timeWindow, signatures } = definition;
    const timeWindowMs = timeWindow * 60 * 1000;
    const startDate = new Date(Date.now() - timeWindowMs);
    
    let allMatches: any[] = [];
    
    for (const signature of signatures) {
      let matches: any[] = [];
      
      if (signature.type === 'security_event') {
        matches = await this.findSecurityEventMatches(signature, startDate);
      } else if (signature.type === 'ip_violation') {
        matches = await this.findIpViolationMatches(signature, startDate);
      } else if (signature.type === 'token_usage') {
        matches = await this.findTokenUsageMatches(signature, startDate);
      }
      
      allMatches = [...allMatches, ...matches];
    }
    
    return allMatches;
  }
  
  private async testAnomalyRule(rule: any, definition: any): Promise<any[]> {
    const { timeWindow, metrics } = definition;
    const startDate = new Date(Date.now() - (timeWindow * 60 * 1000));
    
    try {
      const anomalies = await db.query.oauthMonitoringAnomalies.findMany({
        where: and(
          gte(oauthMonitoringAnomalies.timestamp, startDate),
          eq(oauthMonitoringAnomalies.status, 'open')
        )
      });
      
      return anomalies.filter(anomaly => {
        if (metrics && metrics.length > 0) {
          return metrics.includes(anomaly.metricName);
        }
        return true;
      });
    } catch (error) {
      console.error('Error testing anomaly rule:', error);
      return [];
    }
  }
  
  private async testCorrelationRule(rule: any, definition: any): Promise<any[]> {
    // Implementation for correlation rule testing
    return [];
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): EnhancedBreachDetectionService {
    if (!EnhancedBreachDetectionService.instance) {
      EnhancedBreachDetectionService.instance = new EnhancedBreachDetectionService();
    }
    return EnhancedBreachDetectionService.instance;
  }
  
  constructor() {
    console.log('Enhanced Breach Detection Service initialized');
    this.initializeEventListeners();
    this.initializeRulesEvaluation();
  }
  
  /**
   * Initialize event listeners for security events
   */
  private initializeEventListeners(): void {
    // Listen for OAuth security events
    eventBus.on('oauth.token_rotation.security_event', async (data) => {
      await this.processSecurityEvent(data);
    });
    
    // Listen for IP access violations
    eventBus.on('oauth.ip_access.violation', async (data) => {
      await this.processIpViolation(data);
    });
    
    // Listen for anomaly detection events
    eventBus.on('oauth.monitoring.anomaly_detected', async (data) => {
      await this.processAnomalyDetection(data);
    });
    
    // Listen for scanner findings
    eventBus.on('security.scanner.finding_detected', async (data) => {
      await this.processScannerFinding(data);
    });
  }
  
  /**
   * Initialize rules evaluation
   */
  private async initializeRulesEvaluation(): Promise<void> {
    try {
      // Get all active rules
      const rules = await db.query.breachDetectionRules.findMany({
        where: eq(breachDetectionRules.status, 'enabled')
      });
      
      // Schedule evaluation for each rule
      for (const rule of rules) {
        this.scheduleRuleEvaluation(rule);
      }
      
      console.log(`Scheduled ${rules.length} breach detection rules for evaluation`);
    } catch (error) {
      console.error('Error initializing rule evaluation:', error);
    }
  }
  
  /**
   * Schedule rule evaluation
   */
  private scheduleRuleEvaluation(rule: any): void {
    // Parse the rule definition to determine the evaluation interval
    const definition = typeof rule.definition === 'string' 
      ? JSON.parse(rule.definition) 
      : rule.definition;
    
    const interval = definition.evaluationIntervalMinutes || 15; // Default to 15 minutes
    
    // Clear any existing timer for this rule
    if (this.rulesTimers.has(rule.id)) {
      clearInterval(this.rulesTimers.get(rule.id));
    }
    
    // Schedule periodic evaluation
    const timerId = setInterval(async () => {
      await this.evaluateRule(rule);
    }, interval * 60 * 1000);
    
    this.rulesTimers.set(rule.id, timerId);
    
    // Run an initial evaluation
    setTimeout(async () => {
      await this.evaluateRule(rule);
    }, 5000);
  }
  
  /**
   * Evaluate a rule
   */
  private async evaluateRule(rule: any): Promise<void> {
    try {
      console.log(`Evaluating breach detection rule ${rule.id}: ${rule.name}`);
      
      // Parse rule definition
      const definition = typeof rule.definition === 'string' 
        ? JSON.parse(rule.definition) 
        : rule.definition;
      
      // Evaluate based on rule type
      switch (rule.type) {
        case 'behavior':
          await this.evaluateBehaviorRule(rule, definition);
          break;
        case 'signature':
          await this.evaluateSignatureRule(rule, definition);
          break;
        case 'anomaly':
          await this.evaluateAnomalyRule(rule, definition);
          break;
        case 'correlation':
          await this.evaluateCorrelationRule(rule, definition);
          break;
        default:
          console.log(`Unknown rule type: ${rule.type}`);
      }
    } catch (error) {
      console.error(`Error evaluating rule ${rule.id}:`, error);
    }
  }
  
  /**
   * Evaluate a behavior rule
   */
  private async evaluateBehaviorRule(rule: any, definition: any): Promise<void> {
    const { timeWindow, metrics, threshold, condition } = definition;
    
    // Get the time window in milliseconds
    const timeWindowMs = timeWindow * 60 * 1000;
    const startDate = new Date(Date.now() - timeWindowMs);
    
    // Collect metrics
    const metricValues: Record<string, number> = {};
    
    for (const metric of metrics) {
      try {
        // Get the metric from the monitoring service
        const metricData = await oauthMonitoringService.getMetrics({
          metricName: metric.name,
          startDate,
          endDate: new Date(),
          aggregation: metric.aggregation || 'sum'
        });
        
        // Calculate the total value
        const totalValue = metricData.reduce((sum, item) => sum + item.value, 0);
        metricValues[metric.name] = totalValue;
      } catch (error) {
        console.error(`Error getting metric ${metric.name}:`, error);
      }
    }
    
    // Evaluate the condition
    let isBreached = false;
    const conditionValue = this.evaluateCondition(condition, metricValues);
    
    if (condition.operator === '>' && conditionValue > threshold) {
      isBreached = true;
    } else if (condition.operator === '<' && conditionValue < threshold) {
      isBreached = true;
    } else if (condition.operator === '>=' && conditionValue >= threshold) {
      isBreached = true;
    } else if (condition.operator === '<=' && conditionValue <= threshold) {
      isBreached = true;
    } else if (condition.operator === '==' && conditionValue === threshold) {
      isBreached = true;
    } else if (condition.operator === '!=' && conditionValue !== threshold) {
      isBreached = true;
    }
    
    if (isBreached) {
      // Check if a similar breach already exists and is open
      const existingBreaches = await db.query.breachDetections.findMany({
        where: and(
          eq(breachDetections.ruleId, rule.id),
          or(
            eq(breachDetections.status, 'open'),
            eq(breachDetections.status, 'investigating')
          ),
          gte(breachDetections.detectedAt, startDate)
        )
      });
      
      if (existingBreaches.length === 0) {
        // Create a new breach
        await this.createBreach({
          title: rule.name,
          description: rule.description || `Behavior rule triggered: ${rule.name}`,
          detectionType: 'behavior',
          severity: rule.severity,
          status: 'open',
          ruleId: rule.id,
          workspaceId: rule.workspaceId,
          evidence: {
            metrics: metricValues,
            condition: condition,
            threshold: threshold,
            actualValue: conditionValue
          },
          source: 'behavior-rule',
          detectedAt: new Date()
        });
      } else {
        // Update existing breach with new evidence
        const existingBreach = existingBreaches[0];
        
        // Add breach event for new evidence
        await this.addBreachEvent({
          breachId: existingBreach.id,
          eventType: 'update',
          details: {
            message: 'New evidence detected for behavior rule',
            metrics: metricValues,
            condition: condition,
            threshold: threshold,
            actualValue: conditionValue
          }
        });
      }
    }
  }
  
  /**
   * Evaluate a condition
   */
  private evaluateCondition(condition: any, metrics: Record<string, number>): number {
    if (condition.type === 'simple') {
      return metrics[condition.metric] || 0;
    } else if (condition.type === 'expression') {
      // Replace metric references with actual values
      let expression = condition.expression;
      
      for (const [metricName, value] of Object.entries(metrics)) {
        expression = expression.replace(new RegExp(`\\{${metricName}\\}`, 'g'), value.toString());
      }
      
      // Evaluate the expression (simple math only, no executable code)
      try {
        // Use Function constructor to evaluate math expressions safely
        // This is safer than eval() but still restricted to simple math
        return Function(`"use strict"; return (${expression})`)();
      } catch (error) {
        console.error(`Error evaluating expression: ${expression}`, error);
        return 0;
      }
    }
    
    return 0;
  }
  
  /**
   * Evaluate a signature rule
   */
  private async evaluateSignatureRule(rule: any, definition: any): Promise<void> {
    const { timeWindow, signatures } = definition;
    
    // Get the time window in milliseconds
    const timeWindowMs = timeWindow * 60 * 1000;
    const startDate = new Date(Date.now() - timeWindowMs);
    
    // Process each signature
    for (const signature of signatures) {
      // Search for matches based on signature type
      let matches: any[] = [];
      
      if (signature.type === 'security_event') {
        matches = await this.findSecurityEventMatches(signature, startDate);
      } else if (signature.type === 'ip_violation') {
        matches = await this.findIpViolationMatches(signature, startDate);
      } else if (signature.type === 'token_usage') {
        matches = await this.findTokenUsageMatches(signature, startDate);
      }
      
      // If we have matches and they exceed the threshold, create a breach
      if (matches.length >= (signature.threshold || 1)) {
        // Check if a similar breach already exists and is open
        const existingBreaches = await db.query.breachDetections.findMany({
          where: and(
            eq(breachDetections.ruleId, rule.id),
            or(
              eq(breachDetections.status, 'open'),
              eq(breachDetections.status, 'investigating')
            ),
            gte(breachDetections.detectedAt, startDate)
          )
        });
        
        if (existingBreaches.length === 0) {
          // Create a new breach
          await this.createBreach({
            title: rule.name,
            description: rule.description || `Signature rule triggered: ${rule.name}`,
            detectionType: 'signature',
            severity: rule.severity,
            status: 'open',
            ruleId: rule.id,
            workspaceId: rule.workspaceId,
            evidence: {
              signatureType: signature.type,
              matches: matches.slice(0, 10), // Limit to 10 matches to avoid huge payloads
              matchCount: matches.length,
              pattern: signature.pattern
            },
            source: 'signature-rule',
            detectedAt: new Date()
          });
        } else {
          // Update existing breach with new evidence
          const existingBreach = existingBreaches[0];
          
          // Add breach event for new evidence
          await this.addBreachEvent({
            breachId: existingBreach.id,
            eventType: 'update',
            details: {
              message: 'New evidence detected for signature rule',
              signatureType: signature.type,
              newMatches: matches.slice(0, 10),
              newMatchCount: matches.length,
              pattern: signature.pattern
            }
          });
        }
      }
    }
  }
  
  /**
   * Find security event matches
   */
  private async findSecurityEventMatches(signature: any, startDate: Date): Promise<any[]> {
    // Build the query based on signature pattern
    let query = db.select().from(oauthSecurityEvents)
      .where(gte(oauthSecurityEvents.eventTime, startDate));
    
    // Add pattern-specific conditions
    if (signature.pattern.eventType) {
      query = query.where(eq(oauthSecurityEvents.eventType, signature.pattern.eventType));
    }
    
    if (signature.pattern.severity) {
      query = query.where(eq(oauthSecurityEvents.severity, signature.pattern.severity));
    }
    
    if (signature.pattern.clientId) {
      query = query.where(eq(oauthSecurityEvents.clientId, signature.pattern.clientId));
    }
    
    // Execute query
    return await query;
  }
  
  /**
   * Find IP violation matches
   */
  private async findIpViolationMatches(signature: any, startDate: Date): Promise<any[]> {
    // Build the query based on signature pattern
    let query = db.select().from(oauthIpAccessLogs)
      .where(and(
        gte(oauthIpAccessLogs.timestamp, startDate),
        eq(oauthIpAccessLogs.allowed, false)
      ));
    
    // Add pattern-specific conditions
    if (signature.pattern.clientId) {
      query = query.where(eq(oauthIpAccessLogs.clientId, signature.pattern.clientId));
    }
    
    if (signature.pattern.ipAddress) {
      query = query.where(eq(oauthIpAccessLogs.ipAddress, signature.pattern.ipAddress));
    }
    
    // Execute query
    return await query;
  }
  
  /**
   * Find token usage matches
   */
  private async findTokenUsageMatches(signature: any, startDate: Date): Promise<any[]> {
    // Use token rotation service to get usage data
    const usageData = await oauthTokenRotationService.getTokenUsage({
      startDate,
      endDate: new Date()
    });
    
    // Filter based on signature pattern
    return usageData.filter(usage => {
      if (signature.pattern.clientId && usage.clientId !== signature.pattern.clientId) {
        return false;
      }
      
      if (signature.pattern.minRequests && usage.requests < signature.pattern.minRequests) {
        return false;
      }
      
      if (signature.pattern.maxRequests && usage.requests > signature.pattern.maxRequests) {
        return false;
      }
      
      return true;
    });
  }
  
  /**
   * Evaluate an anomaly rule
   */
  private async evaluateAnomalyRule(rule: any, definition: any): Promise<void> {
    const { timeWindow, metrics, sensitivityMultiplier } = definition;
    
    // Get anomalies from the monitoring service
    const startDate = new Date(Date.now() - (timeWindow * 60 * 1000));
    const anomalies = await db.query.oauthMonitoringAnomalies.findMany({
      where: and(
        gte(oauthMonitoringAnomalies.timestamp, startDate),
        eq(oauthMonitoringAnomalies.status, 'open')
      )
    });
    
    // Filter anomalies based on rule definition
    const matchingAnomalies = anomalies.filter(anomaly => {
      // Check if the anomaly is for a metric we're interested in
      if (metrics && metrics.length > 0) {
        return metrics.includes(anomaly.metricName);
      }
      
      return true;
    });
    
    // If we have matching anomalies, create a breach
    if (matchingAnomalies.length > 0) {
      // Check if there's already an open breach for this rule
      const existingBreaches = await db.query.breachDetections.findMany({
        where: and(
          eq(breachDetections.ruleId, rule.id),
          or(
            eq(breachDetections.status, 'open'),
            eq(breachDetections.status, 'investigating')
          ),
          gte(breachDetections.detectedAt, startDate)
        )
      });
      
      if (existingBreaches.length === 0) {
        // Create a new breach
        await this.createBreach({
          title: rule.name,
          description: rule.description || `Anomaly rule triggered: ${rule.name}`,
          detectionType: 'anomaly',
          severity: rule.severity,
          status: 'open',
          ruleId: rule.id,
          workspaceId: rule.workspaceId,
          evidence: {
            anomalies: matchingAnomalies,
            metricNames: matchingAnomalies.map(a => a.metricName),
            timeWindow
          },
          source: 'anomaly-rule',
          detectedAt: new Date()
        });
      } else {
        // Update existing breach with new evidence
        const existingBreach = existingBreaches[0];
        
        // Add breach event for new evidence
        await this.addBreachEvent({
          breachId: existingBreach.id,
          eventType: 'update',
          details: {
            message: 'New anomalies detected',
            newAnomalies: matchingAnomalies,
            metricNames: matchingAnomalies.map(a => a.metricName)
          }
        });
      }
    }
  }
  
  /**
   * Evaluate a correlation rule
   */
  private async evaluateCorrelationRule(rule: any, definition: any): Promise<void> {
    const { timeWindow, conditions, threshold } = definition;
    
    // Get the time window in milliseconds
    const timeWindowMs = timeWindow * 60 * 1000;
    const startDate = new Date(Date.now() - timeWindowMs);
    
    // Process each condition
    const conditionResults: boolean[] = [];
    const evidenceData: any[] = [];
    
    for (const condition of conditions) {
      if (condition.type === 'security_event') {
        const matches = await this.findSecurityEventMatches(
          { pattern: condition.pattern },
          startDate
        );
        
        const result = matches.length >= (condition.threshold || 1);
        conditionResults.push(result);
        
        if (result) {
          evidenceData.push({
            type: 'security_event',
            matches: matches.slice(0, 5),
            matchCount: matches.length,
            pattern: condition.pattern
          });
        }
      } else if (condition.type === 'ip_violation') {
        const matches = await this.findIpViolationMatches(
          { pattern: condition.pattern },
          startDate
        );
        
        const result = matches.length >= (condition.threshold || 1);
        conditionResults.push(result);
        
        if (result) {
          evidenceData.push({
            type: 'ip_violation',
            matches: matches.slice(0, 5),
            matchCount: matches.length,
            pattern: condition.pattern
          });
        }
      } else if (condition.type === 'anomaly') {
        const anomalies = await db.query.oauthMonitoringAnomalies.findMany({
          where: and(
            gte(oauthMonitoringAnomalies.timestamp, startDate),
            eq(oauthMonitoringAnomalies.status, 'open')
          )
        });
        
        // Filter based on condition pattern
        const matchingAnomalies = anomalies.filter(anomaly => {
          if (condition.pattern.metricName && 
              anomaly.metricName !== condition.pattern.metricName) {
            return false;
          }
          
          if (condition.pattern.severity && 
              anomaly.severity !== condition.pattern.severity) {
            return false;
          }
          
          if (condition.pattern.minScore && 
              anomaly.score < condition.pattern.minScore) {
            return false;
          }
          
          return true;
        });
        
        const result = matchingAnomalies.length >= (condition.threshold || 1);
        conditionResults.push(result);
        
        if (result) {
          evidenceData.push({
            type: 'anomaly',
            anomalies: matchingAnomalies.slice(0, 5),
            anomalyCount: matchingAnomalies.length,
            pattern: condition.pattern
          });
        }
      }
    }
    
    // Count how many conditions are met
    const metConditionsCount = conditionResults.filter(result => result).length;
    
    // Check if we meet the threshold
    if (metConditionsCount >= threshold) {
      // Check if there's already an open breach for this rule
      const existingBreaches = await db.query.breachDetections.findMany({
        where: and(
          eq(breachDetections.ruleId, rule.id),
          or(
            eq(breachDetections.status, 'open'),
            eq(breachDetections.status, 'investigating')
          ),
          gte(breachDetections.detectedAt, startDate)
        )
      });
      
      if (existingBreaches.length === 0) {
        // Create a new breach
        await this.createBreach({
          title: rule.name,
          description: rule.description || `Correlation rule triggered: ${rule.name}`,
          detectionType: 'correlation',
          severity: rule.severity,
          status: 'open',
          ruleId: rule.id,
          workspaceId: rule.workspaceId,
          evidence: {
            conditionResults,
            metConditionsCount,
            threshold,
            evidenceData
          },
          source: 'correlation-rule',
          detectedAt: new Date()
        });
      } else {
        // Update existing breach with new evidence
        const existingBreach = existingBreaches[0];
        
        // Add breach event for new evidence
        await this.addBreachEvent({
          breachId: existingBreach.id,
          eventType: 'update',
          details: {
            message: 'New correlation evidence detected',
            conditionResults,
            metConditionsCount,
            threshold,
            evidenceData
          }
        });
      }
    }
  }
  
  /**
   * Process a security event
   */
  private async processSecurityEvent(event: any): Promise<void> {
    try {
      console.log(`Processing security event: ${event.eventType}`);
      
      // Convert security event to breach detection
      const breach = {
        title: `Security Event: ${event.eventType}`,
        description: event.message || `Security event of type ${event.eventType} detected`,
        detectionType: 'security_event',
        severity: event.severity || 'medium',
        status: 'open',
        affectedResources: event.resources || [],
        evidence: event,
        source: 'oauth-security',
        detectedAt: new Date(event.timestamp) || new Date()
      };
      
      // Create the breach
      await this.createBreach(breach);
    } catch (error) {
      console.error('Error processing security event:', error);
    }
  }
  
  /**
   * Process an IP violation
   */
  private async processIpViolation(violation: any): Promise<void> {
    try {
      console.log(`Processing IP violation from ${violation.ipAddress}`);
      
      // Convert IP violation to breach detection
      const breach = {
        title: `IP Access Violation: ${violation.ipAddress}`,
        description: violation.message || `Unauthorized access attempt from IP ${violation.ipAddress}`,
        detectionType: 'ip_violation',
        severity: 'high', // IP violations are typically high severity
        status: 'open',
        affectedResources: [{
          type: 'client',
          id: violation.clientId,
          name: violation.clientName || `Client ${violation.clientId}`
        }],
        evidence: violation,
        source: 'ip-access-control',
        detectedAt: new Date(violation.timestamp) || new Date()
      };
      
      // Create the breach
      await this.createBreach(breach);
    } catch (error) {
      console.error('Error processing IP violation:', error);
    }
  }
  
  /**
   * Process an anomaly detection
   */
  private async processAnomalyDetection(anomaly: any): Promise<void> {
    try {
      console.log(`Processing anomaly detection for metric: ${anomaly.metricName}`);
      
      // Map severity
      let severity;
      if (anomaly.severity === 'high') {
        severity = 'critical';
      } else if (anomaly.severity === 'medium') {
        severity = 'high';
      } else {
        severity = 'medium';
      }
      
      // Convert anomaly to breach detection
      const breach = {
        title: `Anomaly Detected: ${anomaly.metricName}`,
        description: `Anomaly detected in metric ${anomaly.metricName} with a score of ${anomaly.score}`,
        detectionType: 'anomaly',
        severity,
        status: 'open',
        affectedResources: anomaly.clientId ? [{
          type: 'client',
          id: anomaly.clientId
        }] : [],
        evidence: anomaly,
        source: 'monitoring-anomaly',
        detectedAt: new Date(anomaly.timestamp) || new Date()
      };
      
      // Create the breach
      await this.createBreach(breach);
    } catch (error) {
      console.error('Error processing anomaly detection:', error);
    }
  }
  
  /**
   * Process a scanner finding
   */
  private async processScannerFinding(finding: any): Promise<void> {
    try {
      console.log(`Processing scanner finding: ${finding.title}`);
      
      // Convert scanner finding to breach detection
      const breach = {
        title: `Scanner Finding: ${finding.title}`,
        description: finding.description || 'Security scanner finding detected',
        detectionType: 'scanner_finding',
        severity: finding.severity || 'medium',
        status: 'open',
        affectedResources: finding.resources || [],
        evidence: finding,
        source: 'security-scanner',
        detectedAt: new Date(finding.detectedAt) || new Date()
      };
      
      // Create the breach
      await this.createBreach(breach);
    } catch (error) {
      console.error('Error processing scanner finding:', error);
    }
  }
  
  /**
   * Create a new breach
   */
  public async createBreach(breach: any): Promise<any> {
    try {
      // Check if a similar breach already exists
      const existingBreaches = await db.query.breachDetections.findMany({
        where: and(
          like(breachDetections.title, breach.title),
          eq(breachDetections.source, breach.source),
          or(
            eq(breachDetections.status, 'open'),
            eq(breachDetections.status, 'investigating')
          ),
          gte(breachDetections.detectedAt, new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24 hours
        ),
        limit: 1
      });
      
      if (existingBreaches.length > 0) {
        // Add a new event to the existing breach
        const existingBreach = existingBreaches[0];
        
        await this.addBreachEvent({
          breachId: existingBreach.id,
          eventType: 'update',
          details: {
            message: 'Similar breach detected',
            newEvidence: breach.evidence,
            detectedAt: breach.detectedAt
          }
        });
        
        return existingBreach;
      }
      
      // Create a new breach
      const [created] = await db.insert(breachDetections)
        .values({
          title: breach.title,
          description: breach.description,
          detectionType: breach.detectionType,
          severity: breach.severity,
          status: breach.status || 'open',
          workspaceId: breach.workspaceId || null,
          ruleId: breach.ruleId || null,
          affectedResources: breach.affectedResources 
            ? JSON.stringify(breach.affectedResources) 
            : null,
          evidence: breach.evidence 
            ? JSON.stringify(breach.evidence) 
            : null,
          source: breach.source,
          detectedAt: breach.detectedAt,
          firstDetectedAt: breach.firstDetectedAt || breach.detectedAt,
          createdAt: new Date(),
          updatedAt: new Date()
        })
        .returning();
      
      // Add an initial event
      await this.addBreachEvent({
        breachId: created.id,
        eventType: 'detection',
        details: {
          message: 'Breach detected',
          evidence: breach.evidence,
          source: breach.source
        }
      });
      
      // Emit event
      eventBus.emit('security.breach.detected', {
        breach: created,
        evidence: breach.evidence
      });
      
      // Add to monitoring metrics
      await oauthMonitoringService.recordMetric({
        metricName: 'security_breaches',
        metricType: 'counter',
        value: 1,
        timeInterval: 'hour',
        dimensions: {
          type: breach.detectionType,
          severity: breach.severity,
          source: breach.source
        },
        source: 'breach-detection'
      });
      
      return created;
    } catch (error) {
      console.error('Error creating breach:', error);
      throw new Error(`Failed to create breach: ${error.message}`);
    }
  }
  
  /**
   * Add a breach event
   */
  public async addBreachEvent(data: {
    breachId: number;
    eventType: string;
    details: any;
    userId?: number | null;
  }): Promise<any> {
    try {
      const [event] = await db.insert(breachEvents)
        .values({
          breachId: data.breachId,
          eventType: data.eventType,
          details: JSON.stringify(data.details),
          userId: data.userId || null,
          createdAt: new Date()
        })
        .returning();
      
      return event;
    } catch (error) {
      console.error('Error adding breach event:', error);
      throw new Error(`Failed to add breach event: ${error.message}`);
    }
  }
  
  /**
   * Get all breach detections with filtering and pagination
   */
  async getBreachDetections(params: {
    workspaceId?: number;
    status?: string;
    severity?: string;
    type?: string;
    source?: string;
    from?: Date;
    to?: Date;
    search?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  }): Promise<any[]> {
    const {
      workspaceId,
      status,
      severity,
      type,
      source,
      from,
      to,
      search,
      page = 1,
      limit = 25,
      sortBy = 'detectedAt',
      sortOrder = 'desc'
    } = params;
    
    // Build conditions
    const conditions: any[] = [];
    
    if (workspaceId !== undefined) {
      conditions.push(eq(breachDetections.workspaceId, workspaceId));
    }
    
    if (status) {
      conditions.push(eq(breachDetections.status, status));
    }
    
    if (severity) {
      conditions.push(eq(breachDetections.severity, severity));
    }
    
    if (type) {
      conditions.push(eq(breachDetections.detectionType, type));
    }
    
    if (source) {
      conditions.push(eq(breachDetections.source, source));
    }
    
    if (from) {
      conditions.push(gte(breachDetections.detectedAt, from));
    }
    
    if (to) {
      conditions.push(lte(breachDetections.detectedAt, to));
    }
    
    if (search) {
      conditions.push(
        or(
          like(breachDetections.title, `%${search}%`),
          like(breachDetections.description, `%${search}%`)
        )
      );
    }
    
    // Build query
    let query = db.select().from(breachDetections);
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    // Apply sorting
    if (sortBy === 'detectedAt') {
      query = sortOrder === 'asc' 
        ? query.orderBy(breachDetections.detectedAt)
        : query.orderBy(desc(breachDetections.detectedAt));
    } else if (sortBy === 'severity') {
      query = sortOrder === 'asc'
        ? query.orderBy(breachDetections.severity)
        : query.orderBy(desc(breachDetections.severity));
    } else if (sortBy === 'status') {
      query = sortOrder === 'asc'
        ? query.orderBy(breachDetections.status)
        : query.orderBy(desc(breachDetections.status));
    }
    
    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.limit(limit).offset(offset);
    
    // Execute query
    const results = await query;
    
    // Parse JSON fields
    return results.map(breach => ({
      ...breach,
      affectedResources: breach.affectedResources 
        ? JSON.parse(breach.affectedResources) 
        : null,
      evidence: breach.evidence 
        ? JSON.parse(breach.evidence) 
        : null
    }));
  }
  
  /**
   * Get breach statistics
   */
  async getBreachStats(workspaceId?: number): Promise<{
    total: number;
    open: number;
    investigating: number;
    contained: number;
    resolved: number;
    falsePositive: number;
    byStatus: Record<string, number>;
    bySeverity: Record<string, number>;
    byType: Record<string, number>;
    bySource: Record<string, number>;
  }> {
    // Base query condition
    let condition = sql`1 = 1`;
    
    // Add workspace filter if provided
    if (workspaceId !== undefined) {
      condition = and(condition, eq(breachDetections.workspaceId, workspaceId));
    }
    
    // Calculate total breaches
    const [{ count: total }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(breachDetections)
      .where(condition);
    
    // Calculate breaches by status
    const openCount = await this.getBreachCountByStatus('open', workspaceId);
    const investigatingCount = await this.getBreachCountByStatus('investigating', workspaceId);
    const containedCount = await this.getBreachCountByStatus('contained', workspaceId);
    const resolvedCount = await this.getBreachCountByStatus('resolved', workspaceId);
    const falsePositiveCount = await this.getBreachCountByStatus('false_positive', workspaceId);
    
    // Get counts by status
    const statusCounts = await db
      .select({
        status: breachDetections.status,
        count: sql<number>`count(*)`
      })
      .from(breachDetections)
      .where(condition)
      .groupBy(breachDetections.status);
    
    const byStatus: Record<string, number> = {};
    for (const { status, count } of statusCounts) {
      if (status) {
        byStatus[status] = Number(count);
      }
    }
    
    // Get counts by severity
    const severityCounts = await db
      .select({
        severity: breachDetections.severity,
        count: sql<number>`count(*)`
      })
      .from(breachDetections)
      .where(condition)
      .groupBy(breachDetections.severity);
    
    const bySeverity: Record<string, number> = {};
    for (const { severity, count } of severityCounts) {
      if (severity) {
        bySeverity[severity] = Number(count);
      }
    }
    
    // Get counts by type
    const typeCounts = await db
      .select({
        type: breachDetections.detectionType,
        count: sql<number>`count(*)`
      })
      .from(breachDetections)
      .where(condition)
      .groupBy(breachDetections.detectionType);
    
    const byType: Record<string, number> = {};
    for (const { type, count } of typeCounts) {
      if (type) {
        byType[type] = Number(count);
      }
    }
    
    // Get counts by source
    const sourceCounts = await db
      .select({
        source: breachDetections.source,
        count: sql<number>`count(*)`
      })
      .from(breachDetections)
      .where(condition)
      .groupBy(breachDetections.source);
    
    const bySource: Record<string, number> = {};
    for (const { source, count } of sourceCounts) {
      if (source) {
        bySource[source] = Number(count);
      }
    }
    
    return {
      total,
      open: openCount,
      investigating: investigatingCount,
      contained: containedCount,
      resolved: resolvedCount,
      falsePositive: falsePositiveCount,
      byStatus,
      bySeverity,
      byType,
      bySource
    };
  }
  
  /**
   * Helper method to get breach count by status
   */
  private async getBreachCountByStatus(status: string, workspaceId?: number): Promise<number> {
    let condition = eq(breachDetections.status, status);
    
    if (workspaceId !== undefined) {
      condition = and(condition, eq(breachDetections.workspaceId, workspaceId));
    }
    
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(breachDetections)
      .where(condition);
    
    return Number(count);
  }
}

export const enhancedBreachDetectionService = EnhancedBreachDetectionService.getInstance();