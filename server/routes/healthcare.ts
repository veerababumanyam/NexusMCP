/**
 * Healthcare API Routes
 * 
 * HIPAA-compliant API routes for healthcare integrations including:
 * - EHR system connections
 * - PHI data access with consent management
 * - Redaction rules management
 * - Clinical plugin registry
 * - Audit logging
 */
import { Router, Request, Response, NextFunction } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { db } from '../../db';
import { 
  clinicalPlugins,
  clinicalPluginUsageLogs,
  ehrIntegrations as ehrSystems, 
  availableEhrIntegrations
} from '@shared/schema_healthcare';

// Define types that are missing from schema_healthcare.ts
// These will be properly defined in the schema later
const phiRedactionRules = {} as any;
const phiConsents = {} as any;
const phiAccessControls = {} as any;
const clinicalPluginInstances = {} as any;
const ehrSystemsInsertSchema = {} as any;
const phiRedactionRulesInsertSchema = {} as any;
const phiConsentsInsertSchema = {} as any;
const ehrSystemTypes = ['EPIC', 'CERNER', 'FHIR'] as const;
const phiCategories = ['DEMOGRAPHICS', 'CLINICAL_NOTES', 'MEDICATIONS', 'LAB_RESULTS', 'DIAGNOSES'] as const;
const consentTypes = ['RESEARCH', 'MARKETING', 'TREATMENT', 'PAYMENT', 'OPERATIONS'] as const;

type PhiCategory = typeof phiCategories[number];
import { eq, and } from 'drizzle-orm';
import { ZodError } from 'zod';
import { ehrIntegrationService } from '../services/healthcare/EhrIntegrationService';
import { phiRedactionService } from '../services/healthcare/PhiRedactionService';
import { hipaaAuditService } from '../services/healthcare/HipaaAuditService';
import { clinicalPluginService } from '../services/healthcare/ClinicalPluginService';
import { eventBus } from '../eventBus';

export const healthcareRouter = Router();

// Middleware to verify HIPAA compliance context
const verifyHipaaContext = (req: Request, res: Response, next: NextFunction) => {
  // Skip compliance check for certain operations that don't involve direct PHI
  const exemptRoutes = [
    '/phi/redaction-rules',
    '/system-settings'
  ];
  
  // Check if the current route is exempt from requiring an access reason
  const currentPath = req.path;
  if (exemptRoutes.some(route => currentPath.includes(route))) {
    return next();
  }
  
  // Ensure access reason is provided for PHI access
  if (!req.body.accessReason && !req.query.accessReason) {
    return res.status(400).json({
      error: 'Access reason is required for PHI operations',
      code: 'HIPAA_COMPLIANCE_ERROR'
    });
  }
  
  // Add user IP and agent for audit logging
  req.body.ipAddress = req.ip;
  req.body.userAgent = req.get('user-agent');
  
  next();
};

// Middleware to check specific healthcare permissions
const requireHealthcarePermission = (permission: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // This would check for specific healthcare permissions
    // For simplicity, we'll assume admin can do everything
    if (req.user && req.user.roles?.some(r => r.name === 'admin')) {
      return next();
    }
    
    // Check for the specific permission
    const hasPermission = req.user && req.user.permissions?.includes(permission);
    
    if (!hasPermission) {
      return res.status(403).json({
        error: 'Insufficient permissions for healthcare operations',
        requiredPermission: permission
      });
    }
    
    next();
  };
};

/*
 * EHR Systems API Routes
 */

// Get all EHR systems for a workspace
healthcareRouter.get(
  '/ehr-systems',
  requireHealthcarePermission('healthcare:ehr:read'),
  async (req: Request, res: Response) => {
    try {
      const workspaceId = parseInt(req.query.workspaceId as string);
      
      if (!workspaceId) {
        return res.status(400).json({ error: 'Workspace ID is required' });
      }
      
      const systems = await db.query.ehrSystems.findMany({
        where: eq(ehrSystems.workspaceId, workspaceId)
      });
      
      return res.json(systems);
    } catch (error) {
      console.error('Error fetching EHR systems:', error);
      return res.status(500).json({ error: 'Failed to fetch EHR systems' });
    }
  }
);

// Create a new EHR system connection
healthcareRouter.post(
  '/ehr-systems',
  requireHealthcarePermission('healthcare:ehr:create'),
  [
    body('workspaceId').isInt({ min: 1 }),
    body('name').isString().notEmpty(),
    body('systemType').isIn(ehrSystemTypes),
    body('baseUrl').isURL(),
    body('authType').isString()
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      // Validate with Zod schema
      const validatedData = ehrSystemsInsertSchema.parse({
        ...req.body,
        createdBy: req.user!.id,
        updatedBy: req.user!.id
      });
      
      // Insert the new EHR system
      const [newSystem] = await db.insert(ehrSystems).values(validatedData).returning();
      
      // Emit event for the new EHR system
      eventBus.emit('healthcare.ehr.connected', {
        systemId: newSystem.id,
        name: newSystem.name,
        type: newSystem.systemType,
        workspaceId: newSystem.workspaceId,
        userId: req.user!.id
      });
      
      return res.status(201).json(newSystem);
    } catch (error) {
      console.error('Error creating EHR system:', error);
      
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      
      return res.status(500).json({ error: 'Failed to create EHR system' });
    }
  }
);

// Get EHR system by ID
healthcareRouter.get(
  '/ehr-systems/:id',
  requireHealthcarePermission('healthcare:ehr:read'),
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      const system = await db.query.ehrSystems.findFirst({
        where: eq(ehrSystems.id, id)
      });
      
      if (!system) {
        return res.status(404).json({ error: 'EHR system not found' });
      }
      
      return res.json(system);
    } catch (error) {
      console.error('Error fetching EHR system:', error);
      return res.status(500).json({ error: 'Failed to fetch EHR system' });
    }
  }
);

// Update EHR system
healthcareRouter.patch(
  '/ehr-systems/:id',
  requireHealthcarePermission('healthcare:ehr:update'),
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check if system exists
      const existingSystem = await db.query.ehrSystems.findFirst({
        where: eq(ehrSystems.id, id)
      });
      
      if (!existingSystem) {
        return res.status(404).json({ error: 'EHR system not found' });
      }
      
      // Update with the provided fields
      const updatedData = {
        ...req.body,
        updatedBy: req.user!.id,
        updatedAt: new Date()
      };
      
      // Remove id if present
      delete updatedData.id;
      
      const [updated] = await db.update(ehrSystems)
        .set(updatedData)
        .where(eq(ehrSystems.id, id))
        .returning();
      
      return res.json(updated);
    } catch (error) {
      console.error('Error updating EHR system:', error);
      return res.status(500).json({ error: 'Failed to update EHR system' });
    }
  }
);

// Delete EHR system
healthcareRouter.delete(
  '/ehr-systems/:id',
  requireHealthcarePermission('healthcare:ehr:delete'),
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check if system exists
      const existingSystem = await db.query.ehrSystems.findFirst({
        where: eq(ehrSystems.id, id)
      });
      
      if (!existingSystem) {
        return res.status(404).json({ error: 'EHR system not found' });
      }
      
      // Instead of deleting, we'll mark it as inactive
      const [updated] = await db.update(ehrSystems)
        .set({
          isActive: false,
          updatedBy: req.user!.id,
          updatedAt: new Date()
        })
        .where(eq(ehrSystems.id, id))
        .returning();
      
      return res.json({ success: true, message: 'EHR system deactivated' });
    } catch (error) {
      console.error('Error deleting EHR system:', error);
      return res.status(500).json({ error: 'Failed to delete EHR system' });
    }
  }
);

/*
 * PHI Data Access API Routes
 */

// Get patient data from EHR with PHI handling
healthcareRouter.get(
  '/patient-data',
  requireHealthcarePermission('healthcare:phi:read'),
  verifyHipaaContext,
  [
    query('ehrSystemId').isInt({ min: 1 }),
    query('patientId').isString().notEmpty(),
    query('resourceType').isString().notEmpty(),
    query('category').isIn(phiCategories),
    query('accessReason').isString().notEmpty()
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const ehrSystemId = parseInt(req.query.ehrSystemId as string);
      const patientId = req.query.patientId as string;
      const resourceType = req.query.resourceType as string;
      const category = req.query.category as PhiCategory;
      const accessReason = req.query.accessReason as string;
      const redactPhi = req.query.redactPhi === 'true';
      const onPremiseOnly = req.query.onPremiseOnly === 'true';
      const consentId = req.query.consentId ? parseInt(req.query.consentId as string) : undefined;
      
      // Call EHR integration service to get patient data
      const result = await ehrIntegrationService.getPatientData(
        ehrSystemId,
        patientId,
        resourceType,
        category,
        {
          userId: req.user!.id,
          patientIdentifier: patientId,
          resourceType,
          accessReason,
          ipAddress: req.ip,
          userAgent: req.get('user-agent'),
          redactPhi,
          onPremiseOnly,
          consentId
        }
      );
      
      return res.json(result);
    } catch (error) {
      console.error('Error fetching patient data:', error);
      return res.status(500).json({ error: 'Failed to fetch patient data', message: error.message });
    }
  }
);

// Process and redact text with PHI
healthcareRouter.post(
  '/redact-text',
  requireHealthcarePermission('healthcare:phi:redact'),
  verifyHipaaContext,
  [
    body('text').isString().notEmpty(),
    body('workspaceId').isInt({ min: 1 }),
    body('patientIdentifier').optional().isString(),
    body('ehrSystemId').optional().isInt({ min: 1 }),
    body('preserveFormat').optional().isBoolean(),
    body('onPremiseOnly').optional().isBoolean()
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const {
        text,
        workspaceId,
        patientIdentifier,
        ehrSystemId,
        preserveFormat = false,
        onPremiseOnly = false
      } = req.body;
      
      // Call PHI redaction service
      const result = await phiRedactionService.redactPhi(text, {
        workspaceId,
        userId: req.user!.id,
        patientIdentifier,
        ehrSystemId,
        preserveFormat,
        onPremiseOnly,
        recordAudit: !!patientIdentifier
      });
      
      return res.json(result);
    } catch (error) {
      console.error('Error redacting PHI:', error);
      return res.status(500).json({ error: 'Failed to redact PHI', message: error.message });
    }
  }
);

/*
 * PHI Redaction Rules API Routes
 */

// Get all PHI redaction rules
healthcareRouter.get(
  '/phi/redaction-rules',
  requireHealthcarePermission('healthcare:phi:manage'),
  async (req: Request, res: Response) => {
    try {
      // Optional workspace ID filter
      const workspaceId = req.query.workspaceId 
        ? parseInt(req.query.workspaceId as string) 
        : undefined;
      
      let rules;
      if (workspaceId) {
        rules = await db.query.phiRedactionRules.findMany({
          where: eq(phiRedactionRules.workspaceId, workspaceId)
        });
      } else {
        // If no workspace specified, get all rules (with limit)
        rules = await db.query.phiRedactionRules.findMany({
          limit: 100,
          orderBy: [
            desc(phiRedactionRules.isEnabled),
            asc(phiRedactionRules.phiCategory),
            asc(phiRedactionRules.name)
          ]
        });
      }
      
      // Record the audit event
      await hipaaAuditService.createAuditLog({
        userId: req.user?.id,
        action: 'VIEW',
        resource: 'PHI_REDACTION_RULES',
        resourceId: null,
        workspaceId: workspaceId,
        description: `User viewed PHI redaction rules${workspaceId ? ` for workspace ${workspaceId}` : ''}`,
        ipAddress: req.ip,
        userAgent: req.get('user-agent') || 'Unknown'
      });
      
      return res.json(rules);
    } catch (error) {
      console.error('Error fetching PHI redaction rules:', error);
      return res.status(500).json({ error: 'Failed to fetch PHI redaction rules' });
    }
  }
);

// Get a specific PHI redaction rule by ID
healthcareRouter.get(
  '/phi/redaction-rules/:id',
  requireHealthcarePermission('healthcare:phi:manage'),
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      const rule = await db.query.phiRedactionRules.findFirst({
        where: eq(phiRedactionRules.id, id)
      });
      
      if (!rule) {
        return res.status(404).json({ error: 'PHI redaction rule not found' });
      }
      
      return res.json(rule);
    } catch (error) {
      console.error('Error fetching PHI redaction rule:', error);
      return res.status(500).json({ error: 'Failed to fetch PHI redaction rule' });
    }
  }
);

// Test PHI redaction with a specific rule
healthcareRouter.post(
  '/phi/test-redaction',
  requireHealthcarePermission('healthcare:phi:manage'),
  async (req: Request, res: Response) => {
    try {
      const { text, ruleId } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'Text to redact is required' });
      }
      
      // If rule ID is provided, get it from the database
      let rule = null;
      if (ruleId) {
        rule = await db.query.phiRedactionRules.findFirst({
          where: eq(phiRedactionRules.id, ruleId)
        });
        
        if (!rule) {
          return res.status(404).json({ error: 'PHI redaction rule not found' });
        }
      }
      
      // Use the rule to redact text
      let redactedText = text;
      
      if (rule) {
        try {
          const pattern = rule.isRegex 
            ? new RegExp(rule.pattern, rule.isCaseSensitive ? 'g' : 'gi')
            : rule.pattern;
          
          if (rule.isRegex) {
            redactedText = text.replace(pattern, rule.replacementText || '[REDACTED]');
          } else {
            // String-based replacement with case sensitivity option
            const searchText = rule.pattern;
            const replaceText = rule.replacementText || '[REDACTED]';
            
            if (rule.isCaseSensitive) {
              // Case-sensitive direct replacement
              redactedText = text.split(searchText).join(replaceText);
            } else {
              // Case-insensitive replacement
              const regex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
              redactedText = text.replace(regex, replaceText);
            }
          }
        } catch (regexError) {
          console.error('Invalid regex pattern:', regexError);
          return res.status(400).json({ 
            error: 'Invalid regex pattern', 
            message: regexError.message,
            originalText: text
          });
        }
      }
      
      return res.json({
        originalText: text,
        redactedText,
        rule: rule ? {
          id: rule.id,
          name: rule.name,
          pattern: rule.pattern,
          isRegex: rule.isRegex,
          phiCategory: rule.phiCategory
        } : null
      });
    } catch (error) {
      console.error('Error testing PHI redaction:', error);
      return res.status(500).json({ error: 'Failed to test PHI redaction' });
    }
  }
);

// Create a new PHI redaction rule
healthcareRouter.post(
  '/phi/redaction-rules',
  requireHealthcarePermission('healthcare:phi:manage'),
  [
    body('name').isString().notEmpty().withMessage('Name is required'),
    body('pattern').isString().notEmpty().withMessage('Pattern is required'),
    body('phiCategory').isString().notEmpty().withMessage('PHI category is required'),
    body('severity').isString().withMessage('Severity must be a string'),
    body('replacementText').isString().optional(),
    body('isRegex').isBoolean().optional(),
    body('isCaseSensitive').isBoolean().optional(),
    body('isEnabled').isBoolean().optional(),
    body('workspaceId').isInt().optional()
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      // Validate with Zod schema
      const validatedData = phiRedactionRulesInsertSchema.parse({
        ...req.body,
        createdBy: req.user!.id
      });
      
      // Insert the new redaction rule
      const [newRule] = await db.insert(phiRedactionRules).values(validatedData).returning();
      
      // Clear the rules cache for this workspace
      phiRedactionService.clearCache(newRule.workspaceId);
      
      return res.status(201).json(newRule);
    } catch (error) {
      console.error('Error creating redaction rule:', error);
      
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      
      return res.status(500).json({ error: 'Failed to create redaction rule' });
    }
  }
);

// Update a redaction rule
healthcareRouter.patch(
  '/phi/redaction-rules/:id',
  requireHealthcarePermission('healthcare:phi:manage'),
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check if rule exists
      const existingRule = await db.query.phiRedactionRules.findFirst({
        where: eq(phiRedactionRules.id, id)
      });
      
      if (!existingRule) {
        return res.status(404).json({ error: 'Redaction rule not found' });
      }
      
      // Update with the provided fields
      const updatedData = {
        ...req.body,
        updatedAt: new Date()
      };
      
      // Remove id if present
      delete updatedData.id;
      
      const [updated] = await db.update(phiRedactionRules)
        .set(updatedData)
        .where(eq(phiRedactionRules.id, id))
        .returning();
      
      // Clear the rules cache for this workspace
      phiRedactionService.clearCache(updated.workspaceId);
      
      return res.json(updated);
    } catch (error) {
      console.error('Error updating redaction rule:', error);
      return res.status(500).json({ error: 'Failed to update redaction rule' });
    }
  }
);

// Delete a redaction rule
healthcareRouter.delete(
  '/phi/redaction-rules/:id',
  requireHealthcarePermission('healthcare:phi:manage'),
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      
      // Check if rule exists
      const existingRule = await db.query.phiRedactionRules.findFirst({
        where: eq(phiRedactionRules.id, id)
      });
      
      if (!existingRule) {
        return res.status(404).json({ error: 'Redaction rule not found' });
      }
      
      // Instead of deleting, we'll mark it as disabled
      const [updated] = await db.update(phiRedactionRules)
        .set({
          isEnabled: false,
          updatedAt: new Date()
        })
        .where(eq(phiRedactionRules.id, id))
        .returning();
      
      // Clear the rules cache for this workspace
      phiRedactionService.clearCache(updated.workspaceId);
      
      return res.json({ success: true, message: 'Redaction rule disabled' });
    } catch (error) {
      console.error('Error disabling redaction rule:', error);
      return res.status(500).json({ error: 'Failed to disable redaction rule' });
    }
  }
);

/*
 * PHI Consent Management API Routes
 */

// Get patient consents
healthcareRouter.get(
  '/consents',
  requireHealthcarePermission('healthcare:consent:read'),
  async (req: Request, res: Response) => {
    try {
      const patientId = req.query.patientId as string;
      const ehrSystemId = req.query.ehrSystemId ? parseInt(req.query.ehrSystemId as string) : undefined;
      
      const whereClause: any[] = [];
      
      if (patientId) {
        whereClause.push(eq(phiConsents.patientIdentifier, patientId));
      }
      
      if (ehrSystemId) {
        whereClause.push(eq(phiConsents.ehrSystemId, ehrSystemId));
      }
      
      const consents = await db.query.phiConsents.findMany({
        where: whereClause.length > 0 ? and(...whereClause) : undefined
      });
      
      return res.json(consents);
    } catch (error) {
      console.error('Error fetching consents:', error);
      return res.status(500).json({ error: 'Failed to fetch consents' });
    }
  }
);

// Create a new patient consent
healthcareRouter.post(
  '/consents',
  requireHealthcarePermission('healthcare:consent:create'),
  [
    body('patientIdentifier').isString().notEmpty(),
    body('ehrSystemId').isInt({ min: 1 }),
    body('consentType').isIn(consentTypes),
    body('consentScope').isString().notEmpty()
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      // Validate with Zod schema
      const validatedData = phiConsentsInsertSchema.parse({
        ...req.body,
        verifiedBy: req.user!.id,
        verifiedAt: new Date()
      });
      
      // Insert the new consent record
      const [newConsent] = await db.insert(phiConsents).values(validatedData).returning();
      
      // Log the consent creation
      await hipaaAuditService.recordAuditEvent({
        userId: req.user!.id,
        patientIdentifier: newConsent.patientIdentifier,
        ehrSystemId: newConsent.ehrSystemId,
        phiCategory: 'DEMOGRAPHICS',
        action: 'CONSENT_RECORDED',
        resourceType: 'CONSENT',
        resourceId: newConsent.id.toString(),
        accessMethod: 'API',
        accessReason: 'CONSENT_MANAGEMENT',
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
      
      return res.status(201).json(newConsent);
    } catch (error) {
      console.error('Error creating consent:', error);
      
      if (error instanceof ZodError) {
        return res.status(400).json({ error: 'Validation error', details: error.errors });
      }
      
      return res.status(500).json({ error: 'Failed to create consent record' });
    }
  }
);

// Revoke a patient consent
healthcareRouter.post(
  '/consents/:id/revoke',
  requireHealthcarePermission('healthcare:consent:revoke'),
  [
    body('revokeReason').isString().notEmpty()
  ],
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { revokeReason } = req.body;
      
      // Check if consent exists
      const existingConsent = await db.query.phiConsents.findFirst({
        where: eq(phiConsents.id, id)
      });
      
      if (!existingConsent) {
        return res.status(404).json({ error: 'Consent record not found' });
      }
      
      if (existingConsent.isRevoked) {
        return res.status(400).json({ error: 'Consent is already revoked' });
      }
      
      // Update the consent to revoked status
      const [updated] = await db.update(phiConsents)
        .set({
          isRevoked: true,
          revokedBy: req.user!.id,
          revokedAt: new Date(),
          notes: `${existingConsent.notes || ''}\n[REVOKED] ${revokeReason}`
        })
        .where(eq(phiConsents.id, id))
        .returning();
      
      // Log the consent revocation
      await hipaaAuditService.recordAuditEvent({
        userId: req.user!.id,
        patientIdentifier: updated.patientIdentifier,
        ehrSystemId: updated.ehrSystemId,
        phiCategory: 'DEMOGRAPHICS',
        action: 'CONSENT_REVOKED',
        resourceType: 'CONSENT',
        resourceId: updated.id.toString(),
        accessMethod: 'API',
        accessReason: 'CONSENT_MANAGEMENT',
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
      
      return res.json({
        success: true,
        message: 'Consent revoked successfully',
        consent: updated
      });
    } catch (error) {
      console.error('Error revoking consent:', error);
      return res.status(500).json({ error: 'Failed to revoke consent' });
    }
  }
);

/*
 * Clinical Plugins API Routes
 */

// Get available clinical plugins
healthcareRouter.get(
  '/plugins',
  requireHealthcarePermission('healthcare:plugins:read'),
  async (req: Request, res: Response) => {
    try {
      const workspaceId = parseInt(req.query.workspaceId as string);
      const pluginType = req.query.type as string;
      const ehrSystemId = req.query.ehrSystemId ? parseInt(req.query.ehrSystemId as string) : undefined;
      const enabled = req.query.enabled === 'true';
      
      if (!workspaceId) {
        return res.status(400).json({ error: 'Workspace ID is required' });
      }
      
      const plugins = await clinicalPluginService.getAvailablePlugins(workspaceId, {
        pluginType,
        ehrSystemId,
        enabled
      });
      
      return res.json(plugins);
    } catch (error) {
      console.error('Error fetching clinical plugins:', error);
      return res.status(500).json({ error: 'Failed to fetch clinical plugins' });
    }
  }
);

// Install a new clinical plugin
healthcareRouter.post(
  '/plugins',
  requireHealthcarePermission('healthcare:plugins:create'),
  [
    body('name').isString().notEmpty(),
    body('pluginType').isString().notEmpty(),
    body('version').isString().notEmpty(),
    body('entryPoint').isString().notEmpty()
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const newPlugin = await clinicalPluginService.installPlugin({
        ...req.body,
        userId: req.user!.id
      });
      
      return res.status(201).json(newPlugin);
    } catch (error) {
      console.error('Error installing clinical plugin:', error);
      return res.status(500).json({ error: 'Failed to install clinical plugin', message: error.message });
    }
  }
);

// Get plugin instances for a workspace
healthcareRouter.get(
  '/plugin-instances',
  requireHealthcarePermission('healthcare:plugins:read'),
  async (req: Request, res: Response) => {
    try {
      const workspaceId = parseInt(req.query.workspaceId as string);
      
      if (!workspaceId) {
        return res.status(400).json({ error: 'Workspace ID is required' });
      }
      
      const instances = await clinicalPluginService.getWorkspacePluginInstances(workspaceId);
      
      return res.json(instances);
    } catch (error) {
      console.error('Error fetching plugin instances:', error);
      return res.status(500).json({ error: 'Failed to fetch plugin instances' });
    }
  }
);

// Create a new plugin instance
healthcareRouter.post(
  '/plugin-instances',
  requireHealthcarePermission('healthcare:plugins:create'),
  [
    body('pluginId').isInt({ min: 1 }),
    body('workspaceId').isInt({ min: 1 }),
    body('name').isString().notEmpty(),
    body('configuration').isObject()
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const { pluginId, workspaceId, name, configuration } = req.body;
      
      const newInstance = await clinicalPluginService.createPluginInstance(
        pluginId,
        workspaceId,
        name,
        configuration,
        req.user!.id
      );
      
      return res.status(201).json(newInstance);
    } catch (error) {
      console.error('Error creating plugin instance:', error);
      return res.status(500).json({ error: 'Failed to create plugin instance', message: error.message });
    }
  }
);

// Execute a plugin
healthcareRouter.post(
  '/plugin-instances/:id/execute',
  requireHealthcarePermission('healthcare:plugins:execute'),
  verifyHipaaContext,
  [
    param('id').isInt({ min: 1 }),
    body('workspaceId').isInt({ min: 1 }),
    body('parameters').isObject().optional(),
    body('patientIdentifier').isString().optional(),
    body('ehrSystemId').isInt({ min: 1 }).optional(),
    body('accessReason').isString().notEmpty()
  ],
  async (req: Request, res: Response) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }
      
      const instanceId = parseInt(req.params.id);
      const {
        workspaceId,
        parameters,
        patientIdentifier,
        ehrSystemId,
        accessReason
      } = req.body;
      
      const result = await clinicalPluginService.executePlugin(instanceId, {
        userId: req.user!.id,
        workspaceId,
        instanceId,
        patientIdentifier,
        ehrSystemId,
        parameters,
        accessReason,
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
      
      return res.json(result);
    } catch (error) {
      console.error('Error executing plugin:', error);
      return res.status(500).json({ error: 'Failed to execute plugin', message: error.message });
    }
  }
);

/*
 * HIPAA Audit Log API Routes
 */

// Get audit logs
healthcareRouter.get(
  '/audit-logs',
  requireHealthcarePermission('healthcare:audit:read'),
  async (req: Request, res: Response) => {
    try {
      // TODO: Implement pagination, filtering, etc.
      const patientId = req.query.patientId as string;
      const limit = parseInt(req.query.limit as string) || 100;
      
      // This is a simplified query - in production, you'd want more filters and pagination
      const logs = await db.query.phiAuditLogs.findMany({
        where: patientId ? eq(phiAuditLogs.patientIdentifier, patientId) : undefined,
        orderBy: [{ createdAt: 'desc' as const }],
        limit
      });
      
      return res.json(logs);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      return res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
  }
);

// Approve a PHI access event
healthcareRouter.post(
  '/audit-logs/:id/approve',
  requireHealthcarePermission('healthcare:audit:approve'),
  [
    param('id').isInt({ min: 1 }),
    body('approvalNotes').isString().optional()
  ],
  async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      const { approvalNotes } = req.body;
      
      const success = await hipaaAuditService.recordApproval({
        auditLogId: id,
        approverId: req.user!.id,
        approvalNotes,
        approvalMethod: 'API',
        ipAddress: req.ip,
        userAgent: req.get('user-agent')
      });
      
      if (!success) {
        return res.status(400).json({ error: 'Failed to approve audit log' });
      }
      
      return res.json({ success: true, message: 'Audit log approved successfully' });
    } catch (error) {
      console.error('Error approving audit log:', error);
      return res.status(500).json({ error: 'Failed to approve audit log' });
    }
  }
);

// Verify audit log chain integrity
healthcareRouter.get(
  '/audit-logs/verify-integrity',
  requireHealthcarePermission('healthcare:audit:verify'),
  async (req: Request, res: Response) => {
    try {
      const startId = req.query.startId ? parseInt(req.query.startId as string) : undefined;
      
      const result = await hipaaAuditService.validateIntegrity(startId);
      
      return res.json(result);
    } catch (error) {
      console.error('Error verifying audit log integrity:', error);
      return res.status(500).json({ error: 'Failed to verify audit log integrity' });
    }
  }
);

export default healthcareRouter;