import express from 'express';
import { certificateManagementService } from '../services/security/CertificateManagementService';
import { securityScannerService } from '../services/security/SecurityScannerService';
import { breachDetectionService } from '../services/security/BreachDetectionService';
import { db } from '../db';
import { z } from 'zod';
import { eq } from 'drizzle-orm';

// Import necessary schemas
import { 
  securityScannersInsertSchema, 
  scanVulnerabilitiesInsertSchema,
  scanTargetsInsertSchema
} from '@shared/schema_security_scanner';

import { 
  breachDetectionRulesInsertSchema,
  breachDetectionsInsertSchema,
  breachEventsInsertSchema,
  breachIndicatorsInsertSchema
} from '@shared/schema_breach_detection';

import { createSecurityCertificatesSchema } from '@shared/schema_security_certificates';

// Create a schema for certificate upload
const certificateUploadSchema = z.object({
  name: z.string().min(1, "Certificate name is required"),
  type: z.enum(["ssl", "client", "ca", "signing"]),
  domains: z.array(z.string()).optional(),
  certificate: z.string(),
  privateKey: z.string().optional(),
  passphrase: z.string().optional(),
  issuer: z.string().optional(),
  validFrom: z.string().optional(),
  validTo: z.string().optional(),
  autoRenew: z.boolean().optional(),
  workspaceId: z.number().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

const router = express.Router();

// =================== Security Scanner Routes ===================

/**
 * Get all security scanners with optional filtering
 */
router.get('/scanners', async (req, res) => {
  try {
    const { workspaceId, status, type } = req.query;
    
    const filters: any = {};
    if (workspaceId) filters.workspaceId = parseInt(workspaceId as string);
    if (status) filters.status = status;
    if (type) filters.scannerType = type;
    
    const scanners = await securityScannerService.getScanners(filters);
    res.json(scanners);
  } catch (error) {
    console.error('Error getting scanners:', error);
    res.status(500).json({ error: 'Failed to get scanners' });
  }
});

/**
 * Get a specific scanner by ID
 */
router.get('/scanners/:id', async (req, res) => {
  try {
    const scannerId = parseInt(req.params.id);
    const scanner = await securityScannerService.getScannerById(scannerId);
    
    if (!scanner) {
      return res.status(404).json({ error: 'Scanner not found' });
    }
    
    res.json(scanner);
  } catch (error) {
    console.error(`Error getting scanner ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to get scanner' });
  }
});

/**
 * Create a new security scanner
 */
router.post('/scanners', async (req, res) => {
  try {
    // Validate input
    const validateData = securityScannersInsertSchema.safeParse(req.body);
    
    if (!validateData.success) {
      return res.status(400).json({ errors: validateData.error.format() });
    }
    
    const scannerData = {
      name: req.body.name,
      scannerType: req.body.scannerType,
      workspaceId: req.body.workspaceId || null,
      status: req.body.status || 'enabled',
      description: req.body.description || null,
      config: req.body.config || {},
      credentials: req.body.credentials || {},
      scheduleConfig: req.body.scheduleConfig || {},
      createdBy: req.user?.id || null,
      updatedBy: req.user?.id || null,
    };
    
    const scanner = await securityScannerService.createScanner(scannerData);
    res.status(201).json(scanner);
  } catch (error) {
    console.error('Error creating scanner:', error);
    res.status(500).json({ error: 'Failed to create scanner' });
  }
});

/**
 * Update a security scanner
 */
router.put('/scanners/:id', async (req, res) => {
  try {
    const scannerId = parseInt(req.params.id);
    
    // Check if scanner exists
    const existingScanner = await securityScannerService.getScannerById(scannerId);
    if (!existingScanner) {
      return res.status(404).json({ error: 'Scanner not found' });
    }
    
    // Update scanner
    const scanner = await securityScannerService.updateScanner(scannerId, {
      ...req.body,
      updatedBy: req.user?.id || null
    });
    
    res.json(scanner);
  } catch (error) {
    console.error(`Error updating scanner ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update scanner' });
  }
});

/**
 * Delete a security scanner
 */
router.delete('/scanners/:id', async (req, res) => {
  try {
    const scannerId = parseInt(req.params.id);
    const success = await securityScannerService.deleteScanner(scannerId, req.user?.id);
    
    if (!success) {
      return res.status(404).json({ error: 'Scanner not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error(`Error deleting scanner ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete scanner' });
  }
});

/**
 * Start a scan with a specific scanner
 */
router.post('/scanners/:id/scan', async (req, res) => {
  try {
    const scannerId = parseInt(req.params.id);
    const { targetId } = req.body;
    
    if (!targetId) {
      return res.status(400).json({ error: 'Target ID is required' });
    }
    
    const scan = await securityScannerService.startScan(scannerId, parseInt(targetId), req.user?.id);
    res.status(202).json(scan);
  } catch (error) {
    console.error(`Error starting scan with scanner ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to start scan' });
  }
});

/**
 * Get scan results by scanner ID
 */
router.get('/scanners/:id/results', async (req, res) => {
  try {
    const scannerId = parseInt(req.params.id);
    const results = await securityScannerService.getScanResults(scannerId);
    res.json(results);
  } catch (error) {
    console.error(`Error getting scan results for scanner ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to get scan results' });
  }
});

/**
 * Get scan result details
 */
router.get('/scan-results/:id', async (req, res) => {
  try {
    const resultId = parseInt(req.params.id);
    const result = await securityScannerService.getScanResultById(resultId);
    
    if (!result) {
      return res.status(404).json({ error: 'Scan result not found' });
    }
    
    res.json(result);
  } catch (error) {
    console.error(`Error getting scan result ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to get scan result' });
  }
});

/**
 * Get vulnerabilities for a scan result
 */
router.get('/scan-results/:id/vulnerabilities', async (req, res) => {
  try {
    const resultId = parseInt(req.params.id);
    const vulnerabilities = await securityScannerService.getVulnerabilities({ scanResultId: resultId });
    res.json(vulnerabilities);
  } catch (error) {
    console.error(`Error getting vulnerabilities for scan result ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to get vulnerabilities' });
  }
});

/**
 * Create a vulnerability
 */
router.post('/vulnerabilities', async (req, res) => {
  try {
    // Validate input
    const validateData = scanVulnerabilitiesInsertSchema.safeParse(req.body);
    
    if (!validateData.success) {
      return res.status(400).json({ errors: validateData.error.format() });
    }
    
    const vulnerabilityData = {
      scanResultId: req.body.scanResultId,
      title: req.body.title,
      severity: req.body.severity,
      description: req.body.description || null,
      status: req.body.status || null,
      cve: req.body.cve || null,
      details: req.body.details || {},
      remediationSteps: req.body.remediationSteps || null,
      assignedTo: req.body.assignedTo || null,
      createdBy: req.user?.id || null,
      updatedBy: req.user?.id || null,
    };
    
    const vulnerability = await securityScannerService.createVulnerability(vulnerabilityData);
    res.status(201).json(vulnerability);
  } catch (error) {
    console.error('Error creating vulnerability:', error);
    res.status(500).json({ error: 'Failed to create vulnerability' });
  }
});

/**
 * Update a vulnerability
 */
router.put('/vulnerabilities/:id', async (req, res) => {
  try {
    const vulnerabilityId = parseInt(req.params.id);
    
    // Check if vulnerability exists
    const existingVulnerability = await securityScannerService.getVulnerabilityById(vulnerabilityId);
    if (!existingVulnerability) {
      return res.status(404).json({ error: 'Vulnerability not found' });
    }
    
    // Update vulnerability
    const vulnerability = await securityScannerService.updateVulnerability(vulnerabilityId, {
      ...req.body,
      updatedBy: req.user?.id || null
    });
    
    res.json(vulnerability);
  } catch (error) {
    console.error(`Error updating vulnerability ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update vulnerability' });
  }
});

/**
 * Get scan targets
 */
router.get('/targets', async (req, res) => {
  try {
    const { workspaceId, targetType } = req.query;
    
    const filters: any = {};
    if (workspaceId) filters.workspaceId = parseInt(workspaceId as string);
    if (targetType) filters.targetType = targetType;
    
    const targets = await securityScannerService.getTargets(filters);
    res.json(targets);
  } catch (error) {
    console.error('Error getting scan targets:', error);
    res.status(500).json({ error: 'Failed to get scan targets' });
  }
});

/**
 * Create a scan target
 */
router.post('/targets', async (req, res) => {
  try {
    // Validate input
    const validateData = scanTargetsInsertSchema.safeParse(req.body);
    
    if (!validateData.success) {
      return res.status(400).json({ errors: validateData.error.format() });
    }
    
    const targetData = {
      name: req.body.name,
      value: req.body.value,
      targetType: req.body.targetType,
      workspaceId: req.body.workspaceId || null,
      description: req.body.description || null,
      config: req.body.config || {},
      credentials: req.body.credentials || {},
      createdBy: req.user?.id || null,
      updatedBy: req.user?.id || null,
    };
    
    const target = await securityScannerService.createTarget(targetData);
    res.status(201).json(target);
  } catch (error) {
    console.error('Error creating scan target:', error);
    res.status(500).json({ error: 'Failed to create scan target' });
  }
});

/**
 * Update a scan target
 */
router.put('/targets/:id', async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    
    // Check if target exists
    const existingTarget = await securityScannerService.getTargetById(targetId);
    if (!existingTarget) {
      return res.status(404).json({ error: 'Target not found' });
    }
    
    // Update target
    const target = await securityScannerService.updateTarget(targetId, {
      ...req.body,
      updatedBy: req.user?.id || null
    });
    
    res.json(target);
  } catch (error) {
    console.error(`Error updating scan target ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update scan target' });
  }
});

/**
 * Delete a scan target
 */
router.delete('/targets/:id', async (req, res) => {
  try {
    const targetId = parseInt(req.params.id);
    const success = await securityScannerService.deleteTarget(targetId);
    
    if (!success) {
      return res.status(404).json({ error: 'Target not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error(`Error deleting scan target ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete scan target' });
  }
});

// =================== Breach Detection Routes ===================

/**
 * Get all breach detection rules with optional filtering
 */
router.get('/breach-rules', async (req, res) => {
  try {
    const { workspaceId, type, status } = req.query;
    
    const filters: any = {};
    if (workspaceId) filters.workspaceId = parseInt(workspaceId as string);
    if (type) filters.type = type;
    if (status) filters.status = status;
    
    const rules = await breachDetectionService.getBreachDetectionRules(filters);
    res.json(rules);
  } catch (error) {
    console.error('Error getting breach detection rules:', error);
    res.status(500).json({ error: 'Failed to get breach detection rules' });
  }
});

/**
 * Get a specific breach detection rule by ID
 */
router.get('/breach-rules/:id', async (req, res) => {
  try {
    const ruleId = parseInt(req.params.id);
    const rule = await breachDetectionService.getBreachDetectionRuleById(ruleId);
    
    if (!rule) {
      return res.status(404).json({ error: 'Breach detection rule not found' });
    }
    
    res.json(rule);
  } catch (error) {
    console.error(`Error getting breach detection rule ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to get breach detection rule' });
  }
});

/**
 * Create a new breach detection rule
 */
router.post('/breach-rules', async (req, res) => {
  try {
    // Validate input
    const validateData = breachDetectionRulesInsertSchema.safeParse(req.body);
    
    if (!validateData.success) {
      return res.status(400).json({ errors: validateData.error.format() });
    }
    
    const ruleData = {
      name: req.body.name,
      type: req.body.type,
      definition: req.body.definition,
      workspaceId: req.body.workspaceId || null,
      description: req.body.description || null,
      category: req.body.category || null,
      severity: req.body.severity || 'medium',
      status: req.body.status || 'enabled',
      isGlobal: req.body.isGlobal || false,
      threshold: req.body.threshold || null,
      timeWindow: req.body.timeWindow || null,
      actions: req.body.actions || [],
      metadata: req.body.metadata || {},
      createdBy: req.user?.id || null,
      updatedBy: req.user?.id || null
    };
    
    const rule = await breachDetectionService.createBreachDetectionRule(ruleData);
    res.status(201).json(rule);
  } catch (error) {
    console.error('Error creating breach detection rule:', error);
    res.status(500).json({ error: 'Failed to create breach detection rule' });
  }
});

/**
 * Update a breach detection rule
 */
router.put('/breach-rules/:id', async (req, res) => {
  try {
    const ruleId = parseInt(req.params.id);
    
    // Check if rule exists
    const existingRule = await breachDetectionService.getBreachDetectionRuleById(ruleId);
    if (!existingRule) {
      return res.status(404).json({ error: 'Breach detection rule not found' });
    }
    
    // Update rule
    const rule = await breachDetectionService.updateBreachDetectionRule(ruleId, {
      ...req.body,
      updatedBy: req.user?.id || null
    });
    
    res.json(rule);
  } catch (error) {
    console.error(`Error updating breach detection rule ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update breach detection rule' });
  }
});

/**
 * Delete a breach detection rule
 */
router.delete('/breach-rules/:id', async (req, res) => {
  try {
    const ruleId = parseInt(req.params.id);
    const success = await breachDetectionService.deleteBreachDetectionRule(ruleId);
    
    if (!success) {
      return res.status(404).json({ error: 'Breach detection rule not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error(`Error deleting breach detection rule ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete breach detection rule' });
  }
});

/**
 * Get breaches with optional filtering
 */
router.get('/breaches', async (req, res) => {
  try {
    const { workspaceId, status, severity, from, to } = req.query;
    
    const filters: any = {};
    if (workspaceId) filters.workspaceId = parseInt(workspaceId as string);
    if (status) filters.status = status;
    if (severity) filters.severity = severity;
    
    // Handle date filtering
    if (from) {
      filters.detectedFrom = new Date(from as string);
    }
    
    if (to) {
      filters.detectedTo = new Date(to as string);
    }
    
    const breaches = await breachDetectionService.getBreachDetections(filters);
    res.json(breaches);
  } catch (error) {
    console.error('Error getting breaches:', error);
    res.status(500).json({ error: 'Failed to get breaches' });
  }
});

/**
 * Get a specific breach by ID
 */
router.get('/breaches/:id', async (req, res) => {
  try {
    const breachId = parseInt(req.params.id);
    const breach = await breachDetectionService.getBreachDetectionById(breachId);
    
    if (!breach) {
      return res.status(404).json({ error: 'Breach not found' });
    }
    
    res.json(breach);
  } catch (error) {
    console.error(`Error getting breach ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to get breach' });
  }
});

/**
 * Create a new breach detection
 */
router.post('/breaches', async (req, res) => {
  try {
    // Validate input
    const validateData = breachDetectionsInsertSchema.safeParse(req.body);
    
    if (!validateData.success) {
      return res.status(400).json({ errors: validateData.error.format() });
    }
    
    const breachData = {
      title: req.body.title,
      detectionType: req.body.detectionType,
      detectedAt: req.body.detectedAt || new Date(),
      workspaceId: req.body.workspaceId || null,
      description: req.body.description || null,
      severity: req.body.severity || 'medium',
      status: req.body.status || 'new',
      affectedResources: req.body.affectedResources || [],
      context: req.body.context || {},
      source: req.body.source || null,
      sourceIp: req.body.sourceIp || null,
      impact: req.body.impact || null,
      assignedTo: req.body.assignedTo || null,
      ruleId: req.body.ruleId || null,
      resolved: req.body.resolved || false,
      resolvedAt: req.body.resolvedAt || null,
      resolvedBy: req.body.resolvedBy || null,
      resolutionNotes: req.body.resolutionNotes || null,
      createdBy: req.user?.id || null,
      updatedBy: req.user?.id || null
    };
    
    const breach = await breachDetectionService.createBreachDetection(breachData);
    res.status(201).json(breach);
  } catch (error) {
    console.error('Error creating breach detection:', error);
    res.status(500).json({ error: 'Failed to create breach detection' });
  }
});

/**
 * Update a breach detection
 */
router.put('/breaches/:id', async (req, res) => {
  try {
    const breachId = parseInt(req.params.id);
    
    // Check if breach exists
    const existingBreach = await breachDetectionService.getBreachDetectionById(breachId);
    if (!existingBreach) {
      return res.status(404).json({ error: 'Breach not found' });
    }
    
    // Update breach
    const breach = await breachDetectionService.updateBreachDetection(breachId, {
      ...req.body,
      updatedBy: req.user?.id || null
    });
    
    res.json(breach);
  } catch (error) {
    console.error(`Error updating breach ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update breach' });
  }
});

/**
 * Resolve a breach
 */
router.post('/breaches/:id/resolve', async (req, res) => {
  try {
    const breachId = parseInt(req.params.id);
    const { notes } = req.body;
    
    const breach = await breachDetectionService.resolveBreach(
      breachId, 
      req.user?.id || null, 
      notes || null
    );
    
    if (!breach) {
      return res.status(404).json({ error: 'Breach not found' });
    }
    
    res.json(breach);
  } catch (error) {
    console.error(`Error resolving breach ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to resolve breach' });
  }
});

/**
 * Get events for a breach
 */
router.get('/breaches/:id/events', async (req, res) => {
  try {
    const breachId = parseInt(req.params.id);
    const events = await breachDetectionService.getBreachEvents(breachId);
    res.json(events);
  } catch (error) {
    console.error(`Error getting events for breach ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to get breach events' });
  }
});

/**
 * Add an event to a breach
 */
router.post('/breaches/:id/events', async (req, res) => {
  try {
    const breachId = parseInt(req.params.id);
    const { eventType, details } = req.body;
    
    if (!eventType || !details) {
      return res.status(400).json({ error: 'Event type and details are required' });
    }
    
    const event = await breachDetectionService.addBreachEvent(
      breachId,
      eventType,
      details,
      req.user?.id || null
    );
    
    res.status(201).json(event);
  } catch (error) {
    console.error(`Error adding event to breach ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to add breach event' });
  }
});

/**
 * Get breach indicators with optional filtering
 */
router.get('/indicators', async (req, res) => {
  try {
    const { workspaceId, type, value } = req.query;
    
    const filters: any = {};
    if (workspaceId) filters.workspaceId = parseInt(workspaceId as string);
    if (type) filters.indicatorType = type;
    if (value) filters.value = value;
    
    const indicators = await breachDetectionService.getBreachIndicators(filters);
    res.json(indicators);
  } catch (error) {
    console.error('Error getting breach indicators:', error);
    res.status(500).json({ error: 'Failed to get breach indicators' });
  }
});

/**
 * Create a new breach indicator
 */
router.post('/indicators', async (req, res) => {
  try {
    // Validate input
    const validateData = breachIndicatorsInsertSchema.safeParse(req.body);
    
    if (!validateData.success) {
      return res.status(400).json({ errors: validateData.error.format() });
    }
    
    const indicatorData = {
      indicatorType: req.body.indicatorType,
      value: req.body.value,
      workspaceId: req.body.workspaceId || null,
      description: req.body.description || null,
      severity: req.body.severity || 'medium',
      context: req.body.context || {},
      source: req.body.source || null,
      expiresAt: req.body.expiresAt || null,
      confidence: req.body.confidence || 0.5,
      tags: req.body.tags || null,
      createdBy: req.user?.id || null,
      updatedBy: req.user?.id || null
    };
    
    const indicator = await breachDetectionService.createBreachIndicator(indicatorData);
    res.status(201).json(indicator);
  } catch (error) {
    console.error('Error creating breach indicator:', error);
    res.status(500).json({ error: 'Failed to create breach indicator' });
  }
});

/**
 * Link an indicator to a breach
 */
router.post('/breaches/:breachId/indicators/:indicatorId', async (req, res) => {
  try {
    const breachId = parseInt(req.params.breachId);
    const indicatorId = parseInt(req.params.indicatorId);
    
    const link = await breachDetectionService.linkIndicatorToBreach(breachId, indicatorId);
    res.status(201).json(link);
  } catch (error) {
    console.error(`Error linking indicator ${req.params.indicatorId} to breach ${req.params.breachId}:`, error);
    res.status(500).json({ error: 'Failed to link indicator to breach' });
  }
});

/**
 * Unlink an indicator from a breach
 */
router.delete('/breaches/:breachId/indicators/:indicatorId', async (req, res) => {
  try {
    const breachId = parseInt(req.params.breachId);
    const indicatorId = parseInt(req.params.indicatorId);
    
    const success = await breachDetectionService.unlinkIndicatorFromBreach(breachId, indicatorId);
    
    if (!success) {
      return res.status(404).json({ error: 'Link not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error(`Error unlinking indicator ${req.params.indicatorId} from breach ${req.params.breachId}:`, error);
    res.status(500).json({ error: 'Failed to unlink indicator from breach' });
  }
});

/**
 * Get indicators for a breach
 */
router.get('/breaches/:id/indicators', async (req, res) => {
  try {
    const breachId = parseInt(req.params.id);
    const indicators = await breachDetectionService.getIndicatorsForBreach(breachId);
    res.json(indicators);
  } catch (error) {
    console.error(`Error getting indicators for breach ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to get breach indicators' });
  }
});

// =================== Certificate Management Routes ===================

/**
 * Get all certificates with optional filtering
 */
router.get('/certificates', async (req, res) => {
  try {
    const { workspaceId, type, status, expiringSoon } = req.query;
    
    const filters: any = {};
    if (workspaceId) filters.workspaceId = parseInt(workspaceId as string);
    if (type) filters.type = type;
    if (status) filters.status = status;
    
    // Check for certificates expiring soon
    if (expiringSoon === 'true') {
      const days = req.query.days ? parseInt(req.query.days as string) : 30;
      const expiringCerts = await certificateManagementService.getExpiringCertificates(days);
      return res.json(expiringCerts);
    }
    
    const certificates = await certificateManagementService.getCertificates(filters);
    res.json(certificates);
  } catch (error) {
    console.error('Error getting certificates:', error);
    res.status(500).json({ error: 'Failed to get certificates' });
  }
});

/**
 * Get a specific certificate by ID
 */
router.get('/certificates/:id', async (req, res) => {
  try {
    const certId = parseInt(req.params.id);
    const certificate = await certificateManagementService.getCertificateById(certId);
    
    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found' });
    }
    
    res.json(certificate);
  } catch (error) {
    console.error(`Error getting certificate ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to get certificate' });
  }
});

/**
 * Create a new certificate
 */
router.post('/certificates', async (req, res) => {
  try {
    // Validate input
    const validateData = certificateUploadSchema.safeParse(req.body);
    
    if (!validateData.success) {
      return res.status(400).json({ errors: validateData.error.format() });
    }
    
    const certificateData = {
      type: req.body.type,
      name: req.body.name,
      certificate: req.body.certificate,
      workspaceId: req.body.workspaceId || null,
      status: req.body.status || 'active',
      privateKey: req.body.privateKey || null,
      passphrase: req.body.passphrase || null,
      issuer: req.body.issuer || null,
      validFrom: req.body.validFrom || null,
      validTo: req.body.validTo || null,
      domains: req.body.domains ? req.body.domains.join(',') : null,
      autoRenew: req.body.autoRenew || false,
      tags: req.body.tags || null,
      createdBy: req.user?.id || null,
      updatedBy: req.user?.id || null,
      isRevoked: false,
      revokedAt: null,
      revokedBy: null,
      revokedReason: null,
      lastRenewalAt: null,
      renewalAttempts: 0,
      fingerprint: null,
      metadata: {},
    };
    
    const certificate = await certificateManagementService.createCertificate(certificateData);
    res.status(201).json(certificate);
  } catch (error) {
    console.error('Error creating certificate:', error);
    res.status(500).json({ error: 'Failed to create certificate' });
  }
});

/**
 * Update a certificate
 */
router.put('/certificates/:id', async (req, res) => {
  try {
    const certId = parseInt(req.params.id);
    
    // Check if certificate exists
    const existingCert = await certificateManagementService.getCertificateById(certId);
    if (!existingCert) {
      return res.status(404).json({ error: 'Certificate not found' });
    }
    
    // Update certificate
    const certificate = await certificateManagementService.updateCertificate(certId, {
      ...req.body,
      updatedBy: req.user?.id || null
    });
    
    res.json(certificate);
  } catch (error) {
    console.error(`Error updating certificate ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update certificate' });
  }
});

/**
 * Delete a certificate
 */
router.delete('/certificates/:id', async (req, res) => {
  try {
    const certId = parseInt(req.params.id);
    const success = await certificateManagementService.deleteCertificate(certId, req.user?.id);
    
    if (!success) {
      return res.status(404).json({ error: 'Certificate not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error(`Error deleting certificate ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete certificate' });
  }
});

/**
 * Revoke a certificate
 */
router.post('/certificates/:id/revoke', async (req, res) => {
  try {
    const certId = parseInt(req.params.id);
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ error: 'Revocation reason is required' });
    }
    
    const certificate = await certificateManagementService.revokeCertificate(
      certId,
      reason,
      req.user?.id || null
    );
    
    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found' });
    }
    
    res.json(certificate);
  } catch (error) {
    console.error(`Error revoking certificate ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to revoke certificate' });
  }
});

/**
 * Renew a certificate
 */
router.post('/certificates/:id/renew', async (req, res) => {
  try {
    const certId = parseInt(req.params.id);
    const certificate = await certificateManagementService.renewCertificate(
      certId,
      req.user?.id || null
    );
    
    if (!certificate) {
      return res.status(404).json({ error: 'Certificate not found' });
    }
    
    res.json(certificate);
  } catch (error) {
    console.error(`Error renewing certificate ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to renew certificate' });
  }
});

/**
 * Get certificate history
 */
router.get('/certificates/:id/history', async (req, res) => {
  try {
    const certId = parseInt(req.params.id);
    const history = await certificateManagementService.getCertificateHistory(certId);
    res.json(history);
  } catch (error) {
    console.error(`Error getting history for certificate ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to get certificate history' });
  }
});

/**
 * Get certificate expiration statistics
 */
router.get('/certificates/stats/expiration', async (req, res) => {
  try {
    const { workspaceId } = req.query;
    const workspaceIdNum = workspaceId ? parseInt(workspaceId as string) : undefined;
    
    const stats = await certificateManagementService.getExpirationStats(workspaceIdNum);
    res.json(stats);
  } catch (error) {
    console.error('Error getting certificate expiration statistics:', error);
    res.status(500).json({ error: 'Failed to get certificate statistics' });
  }
});

export default router;