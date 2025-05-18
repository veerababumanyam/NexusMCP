/**
 * LLM Regulatory Validator Service
 * 
 * This service validates LLM output against financial regulatory requirements:
 * - SEC rules and regulations
 * - FINRA guidelines
 * - MiFID II requirements
 * - Custom internal policy rules
 * 
 * Features:
 * - Pre-validate LLM requests to prevent regulatory violations
 * - Post-validate LLM responses for compliance
 * - Detect and flag potential violations
 * - Auto-block responses with severe violations
 * - Generate detailed compliance reports
 * - Maintain comprehensive audit trails
 */

import { db } from '../../../db';
import { 
  llmRegulationValidators, 
  llmValidationResults, 
  regulatoryFrameworks, 
  regulatoryRules 
} from '../../../shared/schema_financial';
import { and, eq, inArray } from 'drizzle-orm';
import { eventBus, EventType } from '../../eventBus';

interface ValidationOptions {
  userId?: number;
  workspaceId?: number;
  mcpServerId?: number;
  sessionId?: string;
  requestId?: string;
  contextData?: Record<string, any>;
}

interface ValidationResult {
  passed: boolean;
  severity: 'none' | 'low' | 'medium' | 'high' | 'critical';
  actionTaken: 'none' | 'flagged' | 'modified' | 'blocked';
  ruleMatches: {
    ruleId: string;
    frameworkCode: string;
    description: string;
    severity: string;
  }[];
  modifiedOutput?: string;
  details?: string;
  validatorIds: number[];
}

/**
 * LLM Regulatory Validator Service
 * Checks if LLM inputs and outputs comply with financial regulations
 */
export class LlmRegulatoryValidatorService {
  /**
   * Validate LLM input before sending to the model
   * Pre-validation helps prevent sending requests that would result in non-compliant responses
   */
  public async validateInput(
    input: string,
    options: ValidationOptions = {}
  ): Promise<ValidationResult> {
    return this.validate(input, 'input', options);
  }

  /**
   * Validate LLM output for regulatory compliance
   * Post-validation detects violations in model responses
   */
  public async validateOutput(
    output: string,
    options: ValidationOptions = {}
  ): Promise<ValidationResult> {
    return this.validate(output, 'output', options);
  }

  /**
   * Validate LLM request-response pair
   * Complete validation of both input and output, with context of the entire exchange
   */
  public async validateExchange(
    input: string,
    output: string,
    options: ValidationOptions = {}
  ): Promise<ValidationResult> {
    // First check input for potential issues
    const inputResult = await this.validateInput(input, options);
    
    // If input is already blocked, no need to check output
    if (inputResult.actionTaken === 'blocked') {
      return inputResult;
    }
    
    // Then check output for compliance issues
    const outputResult = await this.validateOutput(output, options);
    
    // Record the exchange validation result
    await this.recordValidationResult(
      input,
      output,
      outputResult,
      options
    );
    
    return outputResult;
  }

  /**
   * Core validation logic used by both input and output validators
   */
  private async validate(
    text: string,
    type: 'input' | 'output',
    options: ValidationOptions
  ): Promise<ValidationResult> {
    // Get all active validators
    const validators = await this.getActiveValidators(options.workspaceId);
    
    if (validators.length === 0) {
      return {
        passed: true,
        severity: 'none',
        actionTaken: 'none',
        ruleMatches: [],
        validatorIds: []
      };
    }
    
    const validationResults: ValidationResult[] = [];
    const validatorIds: number[] = [];
    
    // Apply each validator to the text
    for (const validator of validators) {
      const result = await this.applyValidator(validator, text, type);
      validationResults.push(result);
      validatorIds.push(validator.id);
    }
    
    // Aggregate results from all validators
    const aggregateResult = this.aggregateResults(validationResults);
    aggregateResult.validatorIds = validatorIds;
    
    // If this is a output validation, determine action based on severity
    if (type === 'output') {
      aggregateResult.actionTaken = this.determineAction(aggregateResult.severity, validators);
    }
    
    // If the validation failed, raise a compliance event
    if (!aggregateResult.passed) {
      this.raiseComplianceEvent(aggregateResult, text, type, options);
    }
    
    return aggregateResult;
  }

  /**
   * Apply a specific validator to the text
   */
  private async applyValidator(
    validator: typeof llmRegulationValidators.$inferSelect,
    text: string,
    type: 'input' | 'output'
  ): Promise<ValidationResult> {
    try {
      const validatorType = validator.validatorType;
      const validationLogic = validator.validationLogic;
      
      // Set default result
      const result: ValidationResult = {
        passed: true,
        severity: 'none',
        actionTaken: 'none',
        ruleMatches: [],
        validatorIds: [validator.id]
      };
      
      // Apply different validation strategies based on validator type
      switch (validatorType) {
        case 'regex':
          return this.applyRegexValidator(validator, text, type);
        
        case 'keyword':
          return this.applyKeywordValidator(validator, text, type);
          
        case 'semantic':
          return this.applySemanticValidator(validator, text, type);
        
        default:
          console.warn(`Unknown validator type: ${validatorType}`);
          return result;
      }
    } catch (error) {
      console.error(`Error applying validator ${validator.id}:`, error);
      
      // Return a safe default when validation fails
      return {
        passed: true, // Fail open rather than blocking incorrectly
        severity: 'none',
        actionTaken: 'none',
        ruleMatches: [],
        details: `Validator error: ${error.message}`,
        validatorIds: [validator.id]
      };
    }
  }

  /**
   * Apply regex-based validation rules
   */
  private async applyRegexValidator(
    validator: typeof llmRegulationValidators.$inferSelect,
    text: string,
    type: 'input' | 'output'
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      passed: true,
      severity: 'none',
      actionTaken: 'none',
      ruleMatches: [],
      validatorIds: [validator.id]
    };
    
    const logic = validator.validationLogic as any;
    
    if (!logic.patterns || !Array.isArray(logic.patterns)) {
      return result;
    }
    
    // Get framework and rule information for more detailed results
    const frameworkIds = validator.frameworkIds as number[] || [];
    const frameworks = frameworkIds.length > 0 
      ? await this.getFrameworksById(frameworkIds) 
      : [];
    
    const frameworkMap = new Map(
      frameworks.map(f => [f.id, f])
    );
    
    // Check each pattern
    for (const pattern of logic.patterns) {
      try {
        if (!pattern.regex || !pattern.ruleId) continue;
        
        const regex = new RegExp(pattern.regex, pattern.flags || 'i');
        
        if (regex.test(text)) {
          result.passed = false;
          result.severity = pattern.severity || 'medium';
          
          // Look up the rule details if available
          const rule = pattern.ruleId ? await this.getRuleByRuleId(pattern.ruleId) : null;
          const framework = rule && rule.frameworkId && frameworkMap.has(rule.frameworkId) 
            ? frameworkMap.get(rule.frameworkId) 
            : null;
          
          result.ruleMatches.push({
            ruleId: pattern.ruleId,
            frameworkCode: framework?.code || 'UNKNOWN',
            description: pattern.description || rule?.description || `Matched pattern: ${pattern.regex}`,
            severity: pattern.severity || 'medium'
          });
        }
      } catch (error) {
        console.error(`Error applying regex pattern:`, error);
      }
    }
    
    return result;
  }

  /**
   * Apply keyword-based validation rules
   */
  private async applyKeywordValidator(
    validator: typeof llmRegulationValidators.$inferSelect,
    text: string,
    type: 'input' | 'output'
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      passed: true,
      severity: 'none',
      actionTaken: 'none',
      ruleMatches: [],
      validatorIds: [validator.id]
    };
    
    const logic = validator.validationLogic as any;
    
    if (!logic.keywords || !Array.isArray(logic.keywords)) {
      return result;
    }
    
    // Get framework and rule information
    const frameworkIds = validator.frameworkIds as number[] || [];
    const frameworks = frameworkIds.length > 0 
      ? await this.getFrameworksById(frameworkIds) 
      : [];
    
    const frameworkMap = new Map(
      frameworks.map(f => [f.id, f])
    );
    
    // Normalize text for better matching
    const normalizedText = text.toLowerCase();
    
    // Check each keyword or phrase
    for (const keyword of logic.keywords) {
      if (!keyword.term || !keyword.ruleId) continue;
      
      const terms = Array.isArray(keyword.term) ? keyword.term : [keyword.term];
      
      for (const term of terms) {
        if (normalizedText.includes(term.toLowerCase())) {
          result.passed = false;
          result.severity = keyword.severity || 'medium';
          
          // Look up the rule details if available
          const rule = keyword.ruleId ? await this.getRuleByRuleId(keyword.ruleId) : null;
          const framework = rule && rule.frameworkId && frameworkMap.has(rule.frameworkId) 
            ? frameworkMap.get(rule.frameworkId) 
            : null;
          
          result.ruleMatches.push({
            ruleId: keyword.ruleId,
            frameworkCode: framework?.code || 'UNKNOWN',
            description: keyword.description || rule?.description || `Matched keyword: ${term}`,
            severity: keyword.severity || 'medium'
          });
          
          // Only add each rule once even if multiple terms match
          break;
        }
      }
    }
    
    return result;
  }

  /**
   * Apply semantic validation rules using advanced NLP techniques with OpenAI embeddings
   * This implementation uses semantic similarity matching between text and rule descriptions
   */
  private async applySemanticValidator(
    validator: typeof llmRegulationValidators.$inferSelect,
    text: string,
    type: 'input' | 'output'
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      passed: true,
      severity: 'none',
      actionTaken: 'none',
      ruleMatches: [],
      validatorIds: [validator.id]
    };
    
    const logic = validator.validationLogic as any;
    
    if (!logic.rules || !Array.isArray(logic.rules)) {
      return result;
    }
    
    // Get framework information
    const frameworkIds = validator.frameworkIds as number[] || [];
    const frameworks = frameworkIds.length > 0 
      ? await this.getFrameworksById(frameworkIds) 
      : [];
    
    const frameworkMap = new Map(
      frameworks.map(f => [f.id, f])
    );
    
    // First try to use embeddings for semantic analysis
    try {
      // Dynamic import to avoid initialization errors if OpenAI key isn't set
      const { embeddingsService } = await import('./embeddingsService');
      
      // Get text embedding once to compare against all rules
      const textEmbedding = await embeddingsService.getEmbedding(text);
      
      for (const rule of logic.rules) {
        if (!rule.ruleId) continue;
        
        try {
          const dbRule = await this.getRuleByRuleId(rule.ruleId);
          if (!dbRule) continue;
          
          // Get rule embedding and calculate similarity
          const ruleEmbedding = await embeddingsService.getRuleEmbedding(rule.ruleId);
          const similarity = embeddingsService.calculateSimilarity(textEmbedding, ruleEmbedding);
          
          // Check if similarity exceeds threshold
          const threshold = rule.threshold || logic.threshold || 0.75;
          if (similarity >= threshold) {
            result.passed = false;
            result.severity = rule.severity || 'medium';
            
            const framework = dbRule && dbRule.frameworkId && frameworkMap.has(dbRule.frameworkId) 
              ? frameworkMap.get(dbRule.frameworkId) 
              : null;
            
            result.ruleMatches.push({
              ruleId: rule.ruleId,
              frameworkCode: framework?.code || 'UNKNOWN',
              description: rule.description || dbRule?.description || `Semantic similarity match (${(similarity * 100).toFixed(1)}%)`,
              severity: rule.severity || 'medium'
            });
            
            // Add detailed information about the match
            if (!result.details) {
              result.details = '';
            }
            result.details += `Rule ${rule.ruleId}: Similarity ${(similarity * 100).toFixed(1)}% exceeds threshold ${(threshold * 100).toFixed(1)}%\n`;
          }
        } catch (error) {
          console.error(`Error in semantic validation for rule ${rule.ruleId}:`, error);
        }
      }
    } catch (error) {
      console.error('Error using embeddings service, falling back to pattern matching:', error);
      
      // Fallback to pattern matching if embeddings service fails
      for (const rule of logic.rules) {
        if (!rule.ruleId || !rule.patterns) continue;
        
        for (const pattern of rule.patterns) {
          if (typeof pattern !== 'string') continue;
          
          if (text.toLowerCase().includes(pattern.toLowerCase())) {
            result.passed = false;
            result.severity = rule.severity || 'medium';
            
            // Look up the rule details if available
            const dbRule = rule.ruleId ? await this.getRuleByRuleId(rule.ruleId) : null;
            const framework = dbRule && dbRule.frameworkId && frameworkMap.has(dbRule.frameworkId) 
              ? frameworkMap.get(dbRule.frameworkId) 
              : null;
            
            result.ruleMatches.push({
              ruleId: rule.ruleId,
              frameworkCode: framework?.code || 'UNKNOWN',
              description: rule.description || dbRule?.description || `Semantic rule violation (pattern match)`,
              severity: rule.severity || 'medium'
            });
            
            // Only add each rule once even if multiple patterns match
            break;
          }
        }
      }
    }
    
    return result;
  }

  /**
   * Aggregate results from multiple validators
   */
  private aggregateResults(results: ValidationResult[]): ValidationResult {
    const aggregateResult: ValidationResult = {
      passed: true,
      severity: 'none',
      actionTaken: 'none',
      ruleMatches: [],
      validatorIds: []
    };
    
    // Combine all rule matches
    for (const result of results) {
      if (!result.passed) {
        aggregateResult.passed = false;
        
        // Add rule matches, avoiding duplicates
        for (const match of result.ruleMatches) {
          if (!aggregateResult.ruleMatches.some(m => m.ruleId === match.ruleId)) {
            aggregateResult.ruleMatches.push(match);
          }
        }
        
        // Escalate severity to the highest level encountered
        aggregateResult.severity = this.getHighestSeverity(aggregateResult.severity, result.severity);
      }
    }
    
    return aggregateResult;
  }

  /**
   * Determine what action to take based on severity and validator settings
   */
  private determineAction(
    severity: string,
    validators: Array<typeof llmRegulationValidators.$inferSelect>
  ): 'none' | 'flagged' | 'modified' | 'blocked' {
    // Find the strictest validator settings
    let blockThreshold = 'critical';
    let flagThreshold = 'medium';
    
    for (const validator of validators) {
      if (validator.blockSeverity) {
        if (this.isSeverityEqual(validator.blockSeverity, blockThreshold) || 
            this.isSeverityLower(validator.blockSeverity, blockThreshold)) {
          blockThreshold = validator.blockSeverity;
        }
      }
      
      if (validator.flagSeverity) {
        if (this.isSeverityEqual(validator.flagSeverity, flagThreshold) || 
            this.isSeverityLower(validator.flagSeverity, flagThreshold)) {
          flagThreshold = validator.flagSeverity;
        }
      }
    }
    
    // Determine action based on thresholds
    if (this.isSeverityEqual(severity, blockThreshold) || 
        this.isSeverityHigher(severity, blockThreshold)) {
      return 'blocked';
    } else if (this.isSeverityEqual(severity, flagThreshold) || 
               this.isSeverityHigher(severity, flagThreshold)) {
      return 'flagged';
    }
    
    return 'none';
  }

  /**
   * Compare severity levels
   */
  private getSeverityRank(severity: string): number {
    const ranks = {
      'none': 0,
      'low': 1,
      'medium': 2,
      'high': 3,
      'critical': 4
    };
    
    return ranks[severity.toLowerCase()] || 0;
  }
  
  private isSeverityHigher(severity1: string, severity2: string): boolean {
    return this.getSeverityRank(severity1) > this.getSeverityRank(severity2);
  }
  
  private isSeverityEqual(severity1: string, severity2: string): boolean {
    return this.getSeverityRank(severity1) === this.getSeverityRank(severity2);
  }
  
  private isSeverityLower(severity1: string, severity2: string): boolean {
    return this.getSeverityRank(severity1) < this.getSeverityRank(severity2);
  }
  
  private getHighestSeverity(severity1: string, severity2: string): 'none' | 'low' | 'medium' | 'high' | 'critical' {
    const rank1 = this.getSeverityRank(severity1);
    const rank2 = this.getSeverityRank(severity2);
    
    if (rank1 >= rank2) {
      return severity1 as any;
    } else {
      return severity2 as any;
    }
  }

  /**
   * Record the validation result in the database
   */
  private async recordValidationResult(
    inputText: string,
    outputText: string,
    result: ValidationResult,
    options: ValidationOptions
  ): Promise<void> {
    try {
      // Don't record successful validations if there are no rule matches
      if (result.passed && result.ruleMatches.length === 0) {
        return;
      }
      
      const validationRecord = {
        validatorId: result.validatorIds[0], // Use the first validator as primary
        sessionId: options.sessionId,
        requestId: options.requestId,
        inputText: inputText,
        outputText: outputText,
        validationPassed: result.passed,
        severity: result.severity,
        ruleMatches: result.ruleMatches,
        actionTaken: result.actionTaken,
        modifiedOutput: result.modifiedOutput,
        userId: options.userId,
        workspaceId: options.workspaceId,
        mcpServerId: options.mcpServerId,
        metadata: {
          allValidatorIds: result.validatorIds,
          contextData: options.contextData || {}
        }
      };
      
      await db.insert(llmValidationResults).values(validationRecord);
    } catch (error) {
      console.error('Error recording validation result:', error);
    }
  }

  /**
   * Raise a compliance event when a validation fails
   */
  private raiseComplianceEvent(
    result: ValidationResult,
    text: string,
    type: 'input' | 'output',
    options: ValidationOptions
  ): void {
    let eventType: EventType;
    
    switch (result.actionTaken) {
      case 'blocked':
        eventType = 'compliance.violation';
        break;
      case 'flagged':
        eventType = 'compliance.warning';
        break;
      default:
        eventType = 'compliance.detected';
    }
    
    eventBus.emit(eventType, {
      validationResult: result,
      textType: type,
      contextData: options.contextData || {},
      userId: options.userId,
      workspaceId: options.workspaceId,
      sessionId: options.sessionId,
      requestId: options.requestId,
      timestamp: new Date()
    });
  }

  /**
   * Get all active validators for a workspace
   */
  private async getActiveValidators(
    workspaceId?: number
  ): Promise<Array<typeof llmRegulationValidators.$inferSelect>> {
    try {
      // Get system validators (available to all workspaces)
      const systemValidators = await db.query.llmRegulationValidators.findMany({
        where: and(
          eq(llmRegulationValidators.isEnabled, true),
          eq(llmRegulationValidators.isSystem, true)
        )
      });
      
      // If no workspace specified, return just system validators
      if (!workspaceId) {
        return systemValidators;
      }
      
      // Get workspace-specific validators
      const workspaceValidators = await db.query.llmRegulationValidators.findMany({
        where: and(
          eq(llmRegulationValidators.isEnabled, true),
          eq(llmRegulationValidators.workspaceId, workspaceId)
        )
      });
      
      // Combine system and workspace validators
      return [...systemValidators, ...workspaceValidators];
    } catch (error) {
      console.error('Error getting active validators:', error);
      return [];
    }
  }

  /**
   * Get frameworks by their IDs
   */
  private async getFrameworksById(
    frameworkIds: number[]
  ): Promise<Array<typeof regulatoryFrameworks.$inferSelect>> {
    try {
      return await db.query.regulatoryFrameworks.findMany({
        where: inArray(regulatoryFrameworks.id, frameworkIds)
      });
    } catch (error) {
      console.error('Error getting frameworks by ID:', error);
      return [];
    }
  }

  /**
   * Get a regulatory rule by its rule ID (e.g., 'Rule 10b-5')
   */
  private async getRuleByRuleId(
    ruleId: string
  ): Promise<typeof regulatoryRules.$inferSelect | null> {
    try {
      return await db.query.regulatoryRules.findFirst({
        where: eq(regulatoryRules.ruleId, ruleId)
      });
    } catch (error) {
      console.error(`Error getting rule by ID ${ruleId}:`, error);
      return null;
    }
  }

  /**
   * Create a new validator
   */
  public async createValidator(
    validatorData: Omit<typeof llmRegulationValidators.$inferInsert, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<typeof llmRegulationValidators.$inferSelect> {
    try {
      const [newValidator] = await db.insert(llmRegulationValidators).values({
        ...validatorData,
        updatedAt: new Date()
      }).returning();
      
      return newValidator;
    } catch (error) {
      console.error('Error creating validator:', error);
      throw error;
    }
  }

  /**
   * Get a validator by ID
   */
  public async getValidatorById(
    id: number
  ): Promise<typeof llmRegulationValidators.$inferSelect | null> {
    try {
      return await db.query.llmRegulationValidators.findFirst({
        where: eq(llmRegulationValidators.id, id)
      });
    } catch (error) {
      console.error(`Error getting validator by ID ${id}:`, error);
      return null;
    }
  }

  /**
   * Update a validator
   */
  public async updateValidator(
    id: number,
    validatorData: Partial<typeof llmRegulationValidators.$inferInsert>
  ): Promise<typeof llmRegulationValidators.$inferSelect | null> {
    try {
      const [updatedValidator] = await db
        .update(llmRegulationValidators)
        .set({
          ...validatorData,
          updatedAt: new Date()
        })
        .where(eq(llmRegulationValidators.id, id))
        .returning();
      
      return updatedValidator;
    } catch (error) {
      console.error(`Error updating validator ${id}:`, error);
      return null;
    }
  }

  /**
   * Delete a validator
   */
  public async deleteValidator(
    id: number
  ): Promise<boolean> {
    try {
      await db
        .delete(llmRegulationValidators)
        .where(eq(llmRegulationValidators.id, id));
      
      return true;
    } catch (error) {
      console.error(`Error deleting validator ${id}:`, error);
      return false;
    }
  }

  /**
   * Get validation results by criteria
   */
  public async getValidationResults(
    options: {
      userId?: number;
      workspaceId?: number;
      validatorId?: number;
      sessionId?: string;
      requestId?: string;
      startDate?: Date;
      endDate?: Date;
      actionTaken?: string;
      passed?: boolean;
      limit?: number;
      offset?: number;
    }
  ): Promise<Array<typeof llmValidationResults.$inferSelect>> {
    try {
      // Build query conditions
      const conditions = [];
      
      if (options.userId) {
        conditions.push(eq(llmValidationResults.userId, options.userId));
      }
      
      if (options.workspaceId) {
        conditions.push(eq(llmValidationResults.workspaceId, options.workspaceId));
      }
      
      if (options.validatorId) {
        conditions.push(eq(llmValidationResults.validatorId, options.validatorId));
      }
      
      if (options.sessionId) {
        conditions.push(eq(llmValidationResults.sessionId, options.sessionId));
      }
      
      if (options.requestId) {
        conditions.push(eq(llmValidationResults.requestId, options.requestId));
      }
      
      if (options.actionTaken) {
        conditions.push(eq(llmValidationResults.actionTaken, options.actionTaken));
      }
      
      if (options.passed !== undefined) {
        conditions.push(eq(llmValidationResults.validationPassed, options.passed));
      }
      
      const whereClause = conditions.length > 0 
        ? and(...conditions) 
        : undefined;
      
      // Execute query with pagination
      return await db.query.llmValidationResults.findMany({
        where: whereClause,
        limit: options.limit || 100,
        offset: options.offset || 0,
        orderBy: (llvr, { desc }) => [desc(llvr.timestamp)]
      });
    } catch (error) {
      console.error('Error getting validation results:', error);
      return [];
    }
  }
}

// Export singleton instance
export const llmRegulatoryValidatorService = new LlmRegulatoryValidatorService();