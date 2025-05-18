/**
 * Financial Services API Routes
 * 
 * Provides endpoints for:
 * - Secure financial data feeds with client access permissions
 * - Regulatory compliance with SEC, FINRA, MiFID II
 * - Financial role-based access control
 * - LLM output validation against financial regulations
 * - Financial transaction anomaly detection
 */

import express, { Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { llmRegulatoryValidatorService } from '../services/financial/llmRegulatoryValidatorService';
import { secureDataFeedService } from '../services/financial/secureDataFeedService';
import { financialAnomalyService } from '../services/financial/financialAnomalyService';
import { db } from '../../db';
import { 
  llmRegulationValidators,
  llmValidationResults,
  regulatoryFrameworks,
  regulatoryRules,
  financialInstruments
} from '../../shared/schema_financial';
import { rateLimit } from 'express-rate-limit';

// Import helpers
import { asyncHandler } from '../utils/asyncHandler';
import { rbacService } from '../services/rbac-service';

// Create router
const router = express.Router();

/**
 * Register Financial API routes
 */
export function registerFinancialRoutes(app: express.Express): express.Router {
  // Authentication and authorization middleware
  // Create simpler versions if app.locals.auth is not defined
  const requireAuth = app.locals.auth?.requireAuth || 
    ((req: Request, res: Response, next: Function) => {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      next();
    });
    
  const requirePermission = app.locals.auth?.requirePermission || 
    ((permission: string) => (req: Request, res: Response, next: Function) => {
      // Simplified permission check - in a real app we'd check permissions
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      next();
    });
  
  // Rate limiting configuration
  const standardRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests, please try again later'
  });
  
  const sensitiveRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // limit each IP to 50 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Too many requests for sensitive financial operations, please try again later'
  });

  /**
   * Middleware to require financial service permission
   */
  const requireFinancialPermission = (permission: string) => {
    return async (req: Request, res: Response, next: Function) => {
      try {
        if (!req.isAuthenticated()) {
          return res.status(401).json({ message: 'Authentication required' });
        }
        
        const userId = req.user.id;
        const workspaceId = req.query.workspaceId || req.body.workspaceId;
        
        // Check for specific financial permission
        const hasPermission = await rbacService.hasPermission(
          userId,
          `financial.${permission}`,
          workspaceId ? parseInt(workspaceId as string) : undefined
        );
        
        if (!hasPermission) {
          return res.status(403).json({ 
            message: `Missing required financial permission: ${permission}` 
          });
        }
        
        next();
      } catch (error) {
        next(error);
      }
    };
  };

  // =====================================================================
  // LLM Regulatory Validator Routes
  // =====================================================================
  
  /**
   * Create a new regulatory validator
   */
  router.post('/validators', 
    requireAuth,
    requireFinancialPermission('validators.create'),
    [
      body('name').isString().notEmpty().withMessage('Name is required'),
      body('description').isString().optional(),
      body('frameworkIds').isArray().optional(),
      body('validatorType').isString().notEmpty().withMessage('Validator type is required'),
      body('validationLogic').isObject().notEmpty().withMessage('Validation logic is required'),
      body('blockSeverity').isString().optional(),
      body('flagSeverity').isString().optional(),
      body('isEnabled').isBoolean().optional(),
      body('isSystem').isBoolean().optional(),
      body('workspaceId').isNumeric().optional()
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      try {
        const validatorData = {
          ...req.body,
          createdBy: req.user.id
        };
        
        const newValidator = await llmRegulatoryValidatorService.createValidator(validatorData);
        
        res.status(201).json(newValidator);
      } catch (error) {
        console.error('Error creating validator:', error);
        res.status(500).json({ 
          message: 'Failed to create validator', 
          error: error.message 
        });
      }
    })
  );
  
  /**
   * Get all validators
   */
  router.get('/validators',
    requireAuth,
    requireFinancialPermission('validators.view'),
    asyncHandler(async (req: Request, res: Response) => {
      try {
        const workspaceId = req.query.workspaceId 
          ? parseInt(req.query.workspaceId as string) 
          : undefined;
          
        const validators = await db.query.llmRegulationValidators.findMany({
          where: workspaceId 
            ? (validators) => 
                llmRegulationValidators.workspaceId.equals(workspaceId) 
            : undefined,
          orderBy: (validators, { desc }) => [desc(validators.updatedAt)]
        });
        
        res.json(validators);
      } catch (error) {
        console.error('Error fetching validators:', error);
        res.status(500).json({ 
          message: 'Failed to fetch validators', 
          error: error.message 
        });
      }
    })
  );
  
  /**
   * Get validator by ID
   */
  router.get('/validators/:id',
    requireAuth,
    requireFinancialPermission('validators.view'),
    asyncHandler(async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const validator = await llmRegulatoryValidatorService.getValidatorById(id);
        
        if (!validator) {
          return res.status(404).json({ message: 'Validator not found' });
        }
        
        res.json(validator);
      } catch (error) {
        console.error('Error fetching validator:', error);
        res.status(500).json({ 
          message: 'Failed to fetch validator', 
          error: error.message 
        });
      }
    })
  );
  
  /**
   * Update validator
   */
  router.put('/validators/:id',
    requireAuth,
    requireFinancialPermission('validators.update'),
    [
      param('id').isNumeric().withMessage('Invalid validator ID'),
      body('name').isString().optional(),
      body('description').isString().optional(),
      body('frameworkIds').isArray().optional(),
      body('validatorType').isString().optional(),
      body('validationLogic').isObject().optional(),
      body('blockSeverity').isString().optional(),
      body('flagSeverity').isString().optional(),
      body('isEnabled').isBoolean().optional()
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      try {
        const id = parseInt(req.params.id);
        const updatedValidator = await llmRegulatoryValidatorService.updateValidator(id, req.body);
        
        if (!updatedValidator) {
          return res.status(404).json({ message: 'Validator not found' });
        }
        
        res.json(updatedValidator);
      } catch (error) {
        console.error('Error updating validator:', error);
        res.status(500).json({ 
          message: 'Failed to update validator', 
          error: error.message 
        });
      }
    })
  );
  
  /**
   * Delete validator
   */
  router.delete('/validators/:id',
    requireAuth,
    requireFinancialPermission('validators.delete'),
    asyncHandler(async (req: Request, res: Response) => {
      try {
        const id = parseInt(req.params.id);
        const success = await llmRegulatoryValidatorService.deleteValidator(id);
        
        if (!success) {
          return res.status(404).json({ message: 'Validator not found' });
        }
        
        res.status(204).end();
      } catch (error) {
        console.error('Error deleting validator:', error);
        res.status(500).json({ 
          message: 'Failed to delete validator', 
          error: error.message 
        });
      }
    })
  );
  
  /**
   * Validate LLM content against financial regulations
   */
  router.post('/validate',
    requireAuth,
    [
      body('input').isString().optional(),
      body('output').isString().optional(),
      body('sessionId').isString().optional(),
      body('requestId').isString().optional(),
      body('mcpServerId').isNumeric().optional(),
      body('workspaceId').isNumeric().optional(),
      body('contextData').isObject().optional()
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      try {
        const { input, output, sessionId, requestId, mcpServerId, workspaceId, contextData } = req.body;
        
        // At least one of input or output must be provided
        if (!input && !output) {
          return res.status(400).json({ 
            message: 'At least one of input or output must be provided' 
          });
        }
        
        const options = {
          userId: req.user.id,
          sessionId,
          requestId,
          mcpServerId: mcpServerId ? parseInt(mcpServerId) : undefined,
          workspaceId: workspaceId ? parseInt(workspaceId) : undefined,
          contextData
        };
        
        let result;
        
        if (input && output) {
          // Validate both input and output
          result = await llmRegulatoryValidatorService.validateExchange(input, output, options);
        } else if (input) {
          // Validate just input
          result = await llmRegulatoryValidatorService.validateInput(input, options);
        } else {
          // Validate just output
          result = await llmRegulatoryValidatorService.validateOutput(output, options);
        }
        
        res.json(result);
      } catch (error) {
        console.error('Error validating content:', error);
        res.status(500).json({ 
          message: 'Failed to validate content', 
          error: error.message 
        });
      }
    })
  );
  
  /**
   * Get validation results
   */
  router.get('/validation-results',
    requireAuth,
    requireFinancialPermission('validation_results.view'),
    [
      query('userId').isNumeric().optional(),
      query('validatorId').isNumeric().optional(),
      query('sessionId').isString().optional(),
      query('workspaceId').isNumeric().optional(),
      query('passed').isBoolean().optional(),
      query('actionTaken').isString().optional(),
      query('limit').isNumeric().optional(),
      query('offset').isNumeric().optional()
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      try {
        const options = {
          userId: req.query.userId ? parseInt(req.query.userId as string) : undefined,
          workspaceId: req.query.workspaceId ? parseInt(req.query.workspaceId as string) : undefined,
          validatorId: req.query.validatorId ? parseInt(req.query.validatorId as string) : undefined,
          sessionId: req.query.sessionId as string,
          requestId: req.query.requestId as string,
          passed: req.query.passed ? req.query.passed === 'true' : undefined,
          actionTaken: req.query.actionTaken as string,
          limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
          offset: req.query.offset ? parseInt(req.query.offset as string) : 0
        };
        
        const results = await llmRegulatoryValidatorService.getValidationResults(options);
        
        res.json(results);
      } catch (error) {
        console.error('Error fetching validation results:', error);
        res.status(500).json({ 
          message: 'Failed to fetch validation results', 
          error: error.message 
        });
      }
    })
  );

  // =====================================================================
  // Secure Data Feed Routes
  // =====================================================================
  
  /**
   * Get accessible data sources
   */
  router.get('/data-sources',
    requireAuth,
    requireFinancialPermission('data_sources.view'),
    asyncHandler(async (req: Request, res: Response) => {
      try {
        const workspaceId = req.query.workspaceId 
          ? parseInt(req.query.workspaceId as string) 
          : undefined;
          
        const accessibleSources = await secureDataFeedService.getAccessibleDataSources({
          userId: req.user.id,
          workspaceId
        });
        
        res.json(accessibleSources);
      } catch (error) {
        console.error('Error fetching data sources:', error);
        res.status(500).json({ 
          message: 'Failed to fetch data sources', 
          error: error.message 
        });
      }
    })
  );
  
  /**
   * Create a new data source
   */
  router.post('/data-sources',
    requireAuth,
    requireFinancialPermission('data_sources.create'),
    [
      body('name').isString().notEmpty().withMessage('Name is required'),
      body('description').isString().optional(),
      body('provider').isString().notEmpty().withMessage('Provider is required'),
      body('sourceType').isString().notEmpty().withMessage('Source type is required'),
      body('connectionDetails').isObject().optional(),
      body('status').isString().optional(),
      body('refreshFrequency').isString().optional(),
      body('refreshSchedule').isObject().optional(),
      body('dataFormat').isString().optional(),
      body('requiresAuthentication').isBoolean().optional(),
      body('authMethod').isString().optional(),
      body('credentials').isObject().optional(),
      body('workspaceId').isNumeric().optional()
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      try {
        const dataSourceData = {
          ...req.body,
          createdBy: req.user.id
        };
        
        const newDataSource = await secureDataFeedService.createDataSource(dataSourceData);
        
        res.status(201).json(newDataSource);
      } catch (error) {
        console.error('Error creating data source:', error);
        res.status(500).json({ 
          message: 'Failed to create data source', 
          error: error.message 
        });
      }
    })
  );
  
  /**
   * Query data from a source
   */
  router.post('/data-sources/:id/query',
    requireAuth,
    sensitiveRateLimit,
    [
      param('id').isNumeric().withMessage('Invalid data source ID'),
      body('filters').isObject().optional(),
      body('permissionLevel').isString().optional(),
      body('limit').isNumeric().optional(),
      body('offset').isNumeric().optional(),
      body('workspaceId').isNumeric().optional()
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      try {
        const sourceId = parseInt(req.params.id);
        const sessionId = req.sessionID;
        const requestId = `query_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
        
        const options = {
          userId: req.user.id,
          sourceId,
          filters: req.body.filters,
          permissionLevel: req.body.permissionLevel || 'read',
          workspaceId: req.body.workspaceId ? parseInt(req.body.workspaceId) : undefined,
          limit: req.body.limit ? parseInt(req.body.limit) : 100,
          offset: req.body.offset ? parseInt(req.body.offset) : 0,
          sessionId,
          requestId
        };
        
        const result = await secureDataFeedService.queryDataSource(options);
        
        res.json(result);
      } catch (error) {
        console.error('Error querying data source:', error);
        res.status(error.message.includes('Access denied') ? 403 : 500).json({ 
          message: error.message || 'Failed to query data source'
        });
      }
    })
  );
  
  /**
   * Grant permission to a data source
   */
  router.post('/data-sources/:id/permissions',
    requireAuth,
    requireFinancialPermission('data_sources.manage_permissions'),
    [
      param('id').isNumeric().withMessage('Invalid data source ID'),
      body('userId').isNumeric().optional(),
      body('roleId').isNumeric().optional(),
      body('workspaceId').isNumeric().optional(),
      body('permissionLevel').isString().notEmpty().withMessage('Permission level is required'),
      body('dataFilters').isObject().optional(),
      body('accessRestrictions').isObject().optional(),
      body('dataClassification').isString().optional(),
      body('auditRequirement').isString().optional(),
      body('expiresAt').isString().optional().custom((value) => {
        if (!value) return true;
        const date = new Date(value);
        return !isNaN(date.getTime());
      }).withMessage('expiresAt must be a valid date string')
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      try {
        // Either userId or roleId must be provided
        if (!req.body.userId && !req.body.roleId) {
          return res.status(400).json({ 
            message: 'Either userId or roleId must be provided' 
          });
        }
        
        const permissionData = {
          ...req.body,
          sourceId: parseInt(req.params.id),
          createdBy: req.user.id
        };
        
        const newPermission = await secureDataFeedService.grantDataSourcePermission(permissionData);
        
        res.status(201).json(newPermission);
      } catch (error) {
        console.error('Error granting permission:', error);
        res.status(500).json({ 
          message: 'Failed to grant permission', 
          error: error.message 
        });
      }
    })
  );

  // =====================================================================
  // Financial Anomaly Detection Routes
  // =====================================================================
  
  /**
   * Create anomaly rule
   */
  router.post('/anomaly-rules',
    requireAuth,
    requireFinancialPermission('anomaly_rules.create'),
    [
      body('name').isString().notEmpty().withMessage('Name is required'),
      body('description').isString().optional(),
      body('ruleType').isString().notEmpty().withMessage('Rule type is required'),
      body('ruleLogic').isObject().notEmpty().withMessage('Rule logic is required'),
      body('severity').isString().optional(),
      body('category').isString().notEmpty().withMessage('Category is required'),
      body('detectionPhase').isString().optional(),
      body('notificationTargets').isArray().optional(),
      body('isEnabled').isBoolean().optional(),
      body('workspaceId').isNumeric().optional()
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      try {
        const ruleData = {
          ...req.body,
          createdBy: req.user.id
        };
        
        const newRule = await financialAnomalyService.createAnomalyRule(ruleData);
        
        res.status(201).json(newRule);
      } catch (error) {
        console.error('Error creating anomaly rule:', error);
        res.status(500).json({ 
          message: 'Failed to create anomaly rule', 
          error: error.message 
        });
      }
    })
  );
  
  /**
   * Get anomaly detections
   */
  router.get('/anomaly-detections',
    requireAuth,
    requireFinancialPermission('anomalies.view'),
    [
      query('workspaceId').isNumeric().optional(),
      query('userId').isNumeric().optional(),
      query('severity').isString().optional(),
      query('status').isString().optional(),
      query('startDate').isString().optional().custom((value) => {
        if (!value) return true;
        const date = new Date(value);
        return !isNaN(date.getTime());
      }).withMessage('startDate must be a valid date string'),
      query('endDate').isString().optional().custom((value) => {
        if (!value) return true;
        const date = new Date(value);
        return !isNaN(date.getTime());
      }).withMessage('endDate must be a valid date string'),
      query('limit').isNumeric().optional(),
      query('offset').isNumeric().optional()
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      try {
        const options = {
          workspaceId: req.query.workspaceId ? parseInt(req.query.workspaceId as string) : undefined,
          userId: req.query.userId ? parseInt(req.query.userId as string) : undefined,
          severity: req.query.severity as string,
          status: req.query.status as string,
          startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
          endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
          limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
          offset: req.query.offset ? parseInt(req.query.offset as string) : 0
        };
        
        const anomalies = await financialAnomalyService.getAnomalyDetections(options);
        
        res.json(anomalies);
      } catch (error) {
        console.error('Error fetching anomaly detections:', error);
        res.status(500).json({ 
          message: 'Failed to fetch anomaly detections', 
          error: error.message 
        });
      }
    })
  );
  
  /**
   * Update anomaly detection status
   */
  router.patch('/anomaly-detections/:id/status',
    requireAuth,
    requireFinancialPermission('anomalies.manage'),
    [
      param('id').isNumeric().withMessage('Invalid anomaly detection ID'),
      body('status').isString().notEmpty().withMessage('Status is required'),
      body('resolutionNotes').isString().optional()
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      try {
        const id = parseInt(req.params.id);
        const { status, resolutionNotes } = req.body;
        
        const updatedAnomaly = await financialAnomalyService.updateAnomalyStatus(
          id,
          status,
          resolutionNotes,
          req.user.id
        );
        
        if (!updatedAnomaly) {
          return res.status(404).json({ message: 'Anomaly detection not found' });
        }
        
        res.json(updatedAnomaly);
      } catch (error) {
        console.error('Error updating anomaly status:', error);
        res.status(500).json({ 
          message: 'Failed to update anomaly status', 
          error: error.message 
        });
      }
    })
  );
  
  /**
   * Check trading limits
   */
  router.post('/check-trading-limits',
    requireAuth,
    [
      body('type').isString().notEmpty().withMessage('Transaction type is required'),
      body('amount').isNumeric().withMessage('Amount is required and must be a number'),
      body('instrumentId').isNumeric().optional(),
      body('instrumentType').isString().optional(),
      body('direction').isString().optional(),
      body('workspaceId').isNumeric().optional()
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      try {
        const transactionDetails = {
          type: req.body.type,
          amount: Number(req.body.amount),
          instrumentId: req.body.instrumentId ? parseInt(req.body.instrumentId) : undefined,
          instrumentType: req.body.instrumentType,
          direction: req.body.direction
        };
        
        const workspaceId = req.body.workspaceId ? parseInt(req.body.workspaceId) : undefined;
        
        const result = await financialAnomalyService.checkTradingLimits(
          req.user.id,
          transactionDetails,
          workspaceId
        );
        
        res.json(result);
      } catch (error) {
        console.error('Error checking trading limits:', error);
        res.status(500).json({ 
          message: 'Failed to check trading limits', 
          error: error.message 
        });
      }
    })
  );

  /**
   * Test ML-based anomaly detection
   * This endpoint allows testing the ML-powered anomaly detection functionality
   * with provided transaction details
   */
  router.post('/anomaly-detection/ml-test',
    requireAuth,
    requireFinancialPermission('anomalies.test'),
    [
      body('transaction').isObject().notEmpty().withMessage('Transaction data is required'),
      body('includeTransactionHistory').isBoolean().optional(),
      body('transaction.transactionId').isString().notEmpty().withMessage('Transaction ID is required'),
      body('transaction.type').isString().notEmpty().withMessage('Transaction type is required'),
      body('transaction.amount').isNumeric().withMessage('Transaction amount must be a number'),
      body('transaction.status').isString().optional(),
      body('transaction.currency').isString().optional(),
      body('transaction.counterparty').isString().optional(),
      body('transaction.description').isString().optional(),
      body('transaction.metadata').isObject().optional()
    ],
    asyncHandler(async (req: Request, res: Response) => {
      // Validate OpenAI API key is available
      if (!process.env.OPENAI_API_KEY) {
        return res.status(400).json({
          message: 'OpenAI API key is required for ML-based anomaly detection',
          error: 'Missing OPENAI_API_KEY environment variable'
        });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      try {
        // Create a financial transaction with the provided data and user information
        const transactionData = {
          ...req.body.transaction,
          requestedBy: req.user.id,
          workspaceId: req.body.workspaceId || req.user.workspaceId || 1,
          createdAt: new Date()
        };
        
        // Run ML analysis only without rule-based detection
        const detections = await financialAnomalyService.analyzeTransaction(
          transactionData, 
          {
            userId: req.user.id,
            sessionId: req.body.sessionId,
            requestId: req.body.requestId
          },
          {
            skipRuleBasedDetection: true,
            includeTransactionHistory: req.body.includeTransactionHistory !== false
          }
        );
        
        // Return results
        res.json({
          transaction: transactionData,
          detections,
          ml_analysis_performed: true,
          detections_count: detections.length
        });
      } catch (error) {
        console.error('Error testing ML anomaly detection:', error);
        res.status(500).json({ 
          message: 'Failed to test ML anomaly detection', 
          error: error.message 
        });
      }
    })
  );

  // =====================================================================
  // Regulatory Framework Routes
  // =====================================================================
  
  /**
   * Get regulatory frameworks
   */
  router.get('/regulatory-frameworks',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      try {
        const frameworks = await db.query.regulatoryFrameworks.findMany({
          orderBy: (frameworks, { asc }) => [asc(frameworks.name)]
        });
        
        res.json(frameworks);
      } catch (error) {
        console.error('Error fetching regulatory frameworks:', error);
        res.status(500).json({ 
          message: 'Failed to fetch regulatory frameworks', 
          error: error.message 
        });
      }
    })
  );
  
  /**
   * Get regulatory rules for a framework
   */
  router.get('/regulatory-frameworks/:id/rules',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      try {
        const frameworkId = parseInt(req.params.id);
        
        const rules = await db.query.regulatoryRules.findMany({
          where: (rules) => 
            regulatoryRules.frameworkId.equals(frameworkId),
          orderBy: (rules, { asc }) => [asc(rules.ruleId)]
        });
        
        res.json(rules);
      } catch (error) {
        console.error('Error fetching regulatory rules:', error);
        res.status(500).json({ 
          message: 'Failed to fetch regulatory rules', 
          error: error.message 
        });
      }
    })
  );
  
  /**
   * Check OpenAI API integration status
   */
  router.get('/settings/openai-status',
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      try {
        const hasApiKey = !!process.env.OPENAI_API_KEY;
        res.json({
          enabled: hasApiKey,
          message: hasApiKey 
            ? 'OpenAI API key is configured' 
            : 'OpenAI API key is not configured'
        });
      } catch (error) {
        console.error('Error checking OpenAI API status:', error);
        res.status(500).json({ 
          message: 'Failed to check OpenAI API status', 
          error: error.message 
        });
      }
    })
  );

  /**
   * Search for financial instruments
   */
  router.get('/instruments/search',
    requireAuth,
    requireFinancialPermission('instruments.view'),
    [
      query('q').isString().notEmpty().withMessage('Search query is required'),
      query('type').isString().optional(),
      query('exchange').isString().optional(),
      query('currency').isString().optional(),
      query('active').isBoolean().optional().toBoolean(),
      query('limit').isNumeric().optional(),
      query('offset').isNumeric().optional()
    ],
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      try {
        const options = {
          type: req.query.type as string,
          exchange: req.query.exchange as string,
          currency: req.query.currency as string,
          active: req.query.active as boolean,
          limit: req.query.limit ? parseInt(req.query.limit as string) : 100,
          offset: req.query.offset ? parseInt(req.query.offset as string) : 0
        };
        
        const results = await secureDataFeedService.searchInstruments(
          req.query.q as string,
          options
        );
        
        res.json(results);
      } catch (error) {
        console.error('Error searching instruments:', error);
        res.status(500).json({ 
          message: 'Failed to search instruments', 
          error: error.message 
        });
      }
    })
  );

  // Register routes
  app.use('/api/financial', router);
  
  console.log('Financial routes registered');
  
  return router;
}