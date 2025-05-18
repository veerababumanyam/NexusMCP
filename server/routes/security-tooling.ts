/**
 * Security Tooling Routes
 * 
 * API endpoints for integrating with:
 * - Security Information and Event Management (SIEM) systems
 * - Secrets Management solutions
 * - Cloud Access Security Broker (CASB) platforms
 */

import express from 'express';
import { z } from 'zod';
import { securityToolingFormSchema } from '@shared/schema_security_tooling';
import securityToolingService from '../services/integrations/SecurityToolingService';
import { getChildLogger } from '../utils/logger';
import { logger } from '../utils/logger';

// Import our middleware
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/permissions';

const router = express.Router();
const securityLogger = getChildLogger(logger, { component: 'SecurityToolingRoutes' });

// Middleware to require authentication for all routes
router.use(requireAuth);

/**
 * CASB Integration Routes
 */

// Get all CASB integrations
router.get('/casb', requirePermission('admin.integrations.casb.read'), async (req, res) => {
  try {
    securityLogger.info('Fetching CASB integrations');
    const integrations = await securityToolingService.getIntegrationsByType('casb');
    res.json(integrations);
  } catch (error) {
    securityLogger.error('Error fetching CASB integrations', { error });
    res.status(500).json({ message: 'Failed to fetch CASB integrations', error: error.message });
  }
});

// Get CASB integration by ID
router.get('/casb/:id', requirePermission('admin.integrations.casb.read'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    securityLogger.info('Fetching CASB integration by ID', { id });
    
    const integration = await securityToolingService.getIntegrationById(id);
    
    if (!integration) {
      return res.status(404).json({ message: 'CASB integration not found' });
    }
    
    if (integration.type !== 'casb') {
      return res.status(400).json({ message: 'Integration is not a CASB platform' });
    }
    
    res.json(integration);
  } catch (error) {
    securityLogger.error('Error fetching CASB integration by ID', { error, id: req.params.id });
    res.status(500).json({ message: 'Failed to fetch CASB integration', error: error.message });
  }
});

// Create a new CASB integration
router.post('/casb', requirePermission('admin.integrations.casb.create'), async (req, res) => {
  try {
    securityLogger.info('Creating new CASB integration', { system: req.body.system });
    
    // Validate request body
    const data = securityToolingFormSchema.parse(req.body);
    
    if (data.type !== 'casb') {
      return res.status(400).json({ message: 'Invalid integration type, expected "casb"' });
    }
    
    // Create integration
    const integration = await securityToolingService.createIntegration({
      ...data,
      createdBy: req.user?.id,
      updatedBy: req.user?.id
    });
    
    res.status(201).json(integration);
  } catch (error) {
    if (error instanceof z.ZodError) {
      securityLogger.warn('Validation error creating CASB integration', { error: error.errors });
      return res.status(400).json({ message: 'Invalid CASB integration data', errors: error.errors });
    }
    
    securityLogger.error('Error creating CASB integration', { error });
    res.status(500).json({ message: 'Failed to create CASB integration', error: error.message });
  }
});

// Update a CASB integration
router.put('/casb/:id', requirePermission('admin.integrations.casb.update'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    securityLogger.info('Updating CASB integration', { id });
    
    // Check if integration exists
    const existingIntegration = await securityToolingService.getIntegrationById(id);
    
    if (!existingIntegration) {
      return res.status(404).json({ message: 'CASB integration not found' });
    }
    
    if (existingIntegration.type !== 'casb') {
      return res.status(400).json({ message: 'Integration is not a CASB platform' });
    }
    
    // Validate request body
    const data = securityToolingFormSchema.parse(req.body);
    
    if (data.type !== 'casb') {
      return res.status(400).json({ message: 'Invalid integration type, expected "casb"' });
    }
    
    // Update integration
    const updatedIntegration = await securityToolingService.updateIntegration(id, {
      ...data,
      updatedBy: req.user?.id
    });
    
    res.json(updatedIntegration);
  } catch (error) {
    if (error instanceof z.ZodError) {
      securityLogger.warn('Validation error updating CASB integration', { error: error.errors, id: req.params.id });
      return res.status(400).json({ message: 'Invalid CASB integration data', errors: error.errors });
    }
    
    securityLogger.error('Error updating CASB integration', { error, id: req.params.id });
    res.status(500).json({ message: 'Failed to update CASB integration', error: error.message });
  }
});

// Delete a CASB integration
router.delete('/casb/:id', requirePermission('admin.integrations.casb.delete'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    securityLogger.info('Deleting CASB integration', { id });
    
    // Check if integration exists
    const existingIntegration = await securityToolingService.getIntegrationById(id);
    
    if (!existingIntegration) {
      return res.status(404).json({ message: 'CASB integration not found' });
    }
    
    if (existingIntegration.type !== 'casb') {
      return res.status(400).json({ message: 'Integration is not a CASB platform' });
    }
    
    // Delete integration
    await securityToolingService.deleteIntegration(id);
    
    res.status(204).end();
  } catch (error) {
    securityLogger.error('Error deleting CASB integration', { error, id: req.params.id });
    res.status(500).json({ message: 'Failed to delete CASB integration', error: error.message });
  }
});

// Test a CASB connection
router.post('/casb/test', requirePermission('admin.integrations.casb.create'), async (req, res) => {
  try {
    securityLogger.info('Testing CASB connection', { system: req.body.system });
    
    // Validate request body
    const data = securityToolingFormSchema.parse(req.body);
    
    if (data.type !== 'casb') {
      return res.status(400).json({ message: 'Invalid integration type, expected "casb"' });
    }
    
    // Test connection
    const result = await securityToolingService.testCasbConnection(data);
    
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      securityLogger.warn('Validation error testing CASB connection', { error: error.errors });
      return res.status(400).json({ message: 'Invalid CASB integration data', errors: error.errors });
    }
    
    securityLogger.error('Error testing CASB connection', { error });
    res.status(500).json({ message: 'Failed to test CASB connection', error: error.message });
  }
});

// Enforce CASB policies
router.post('/casb/:id/enforce-policies', requirePermission('admin.integrations.casb.use'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    securityLogger.info('Enforcing CASB policies', { id });
    
    // Check if integration exists
    const existingIntegration = await securityToolingService.getIntegrationById(id);
    
    if (!existingIntegration) {
      return res.status(404).json({ message: 'CASB integration not found' });
    }
    
    if (existingIntegration.type !== 'casb') {
      return res.status(400).json({ message: 'Integration is not a CASB platform' });
    }
    
    // Enforce policies
    const result = await securityToolingService.enforceCasbPolicies(id);
    
    res.json(result);
  } catch (error) {
    securityLogger.error('Error enforcing CASB policies', { error, id: req.params.id });
    res.status(500).json({ message: 'Failed to enforce CASB policies', error: error.message });
  }
});

/**
 * SIEM Integration Routes
 */

// Get all SIEM integrations
router.get('/siem', requirePermission('admin.integrations.siem.read'), async (req, res) => {
  try {
    securityLogger.info('Fetching SIEM integrations');
    const integrations = await securityToolingService.getIntegrationsByType('siem');
    res.json(integrations);
  } catch (error) {
    securityLogger.error('Error fetching SIEM integrations', { error });
    res.status(500).json({ message: 'Failed to fetch SIEM integrations', error: error.message });
  }
});

// Get SIEM integration by ID
router.get('/siem/:id', requirePermission('admin.integrations.siem.read'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    securityLogger.info('Fetching SIEM integration by ID', { id });
    
    const integration = await securityToolingService.getIntegrationById(id);
    
    if (!integration) {
      return res.status(404).json({ message: 'SIEM integration not found' });
    }
    
    if (integration.type !== 'siem') {
      return res.status(400).json({ message: 'Integration is not a SIEM system' });
    }
    
    res.json(integration);
  } catch (error) {
    securityLogger.error('Error fetching SIEM integration by ID', { error, id: req.params.id });
    res.status(500).json({ message: 'Failed to fetch SIEM integration', error: error.message });
  }
});

// Create a new SIEM integration
router.post('/siem', requirePermission('admin.integrations.siem.create'), async (req, res) => {
  try {
    securityLogger.info('Creating new SIEM integration', { system: req.body.system });
    
    // Validate request body
    const data = securityToolingFormSchema.parse(req.body);
    
    if (data.type !== 'siem') {
      return res.status(400).json({ message: 'Invalid integration type, expected "siem"' });
    }
    
    // Create integration
    const integration = await securityToolingService.createIntegration({
      ...data,
      createdBy: req.user?.id,
      updatedBy: req.user?.id
    });
    
    res.status(201).json(integration);
  } catch (error) {
    if (error instanceof z.ZodError) {
      securityLogger.warn('Validation error creating SIEM integration', { error: error.errors });
      return res.status(400).json({ message: 'Invalid SIEM integration data', errors: error.errors });
    }
    
    securityLogger.error('Error creating SIEM integration', { error });
    res.status(500).json({ message: 'Failed to create SIEM integration', error: error.message });
  }
});

// Test a SIEM connection
router.post('/siem/test', requirePermission('admin.integrations.siem.create'), async (req, res) => {
  try {
    securityLogger.info('Testing SIEM connection', { system: req.body.system });
    
    // Validate request body
    const data = securityToolingFormSchema.parse(req.body);
    
    if (data.type !== 'siem') {
      return res.status(400).json({ message: 'Invalid integration type, expected "siem"' });
    }
    
    // Test connection
    const result = await securityToolingService.testSiemConnection(data);
    
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      securityLogger.warn('Validation error testing SIEM connection', { error: error.errors });
      return res.status(400).json({ message: 'Invalid SIEM integration data', errors: error.errors });
    }
    
    securityLogger.error('Error testing SIEM connection', { error });
    res.status(500).json({ message: 'Failed to test SIEM connection', error: error.message });
  }
});

/**
 * Secrets Manager Routes
 */

// Get all Secrets Manager integrations
router.get('/secrets', requirePermission('admin.integrations.secrets.read'), async (req, res) => {
  try {
    securityLogger.info('Fetching Secrets Manager integrations');
    const integrations = await securityToolingService.getIntegrationsByType('secrets');
    res.json(integrations);
  } catch (error) {
    securityLogger.error('Error fetching Secrets Manager integrations', { error });
    res.status(500).json({ message: 'Failed to fetch Secrets Manager integrations', error: error.message });
  }
});

// Create a new Secrets Manager integration
router.post('/secrets', requirePermission('admin.integrations.secrets.create'), async (req, res) => {
  try {
    securityLogger.info('Creating new Secrets Manager integration', { system: req.body.system });
    
    // Validate request body
    const data = securityToolingFormSchema.parse(req.body);
    
    if (data.type !== 'secrets') {
      return res.status(400).json({ message: 'Invalid integration type, expected "secrets"' });
    }
    
    // Create integration
    const integration = await securityToolingService.createIntegration({
      ...data,
      createdBy: req.user?.id,
      updatedBy: req.user?.id
    });
    
    res.status(201).json(integration);
  } catch (error) {
    if (error instanceof z.ZodError) {
      securityLogger.warn('Validation error creating Secrets Manager integration', { error: error.errors });
      return res.status(400).json({ message: 'Invalid Secrets Manager integration data', errors: error.errors });
    }
    
    securityLogger.error('Error creating Secrets Manager integration', { error });
    res.status(500).json({ message: 'Failed to create Secrets Manager integration', error: error.message });
  }
});

// Test a Secrets Manager connection
router.post('/secrets/test', requirePermission('admin.integrations.secrets.create'), async (req, res) => {
  try {
    securityLogger.info('Testing Secrets Manager connection', { system: req.body.system });
    
    // Validate request body
    const data = securityToolingFormSchema.parse(req.body);
    
    if (data.type !== 'secrets') {
      return res.status(400).json({ message: 'Invalid integration type, expected "secrets"' });
    }
    
    // Test connection
    const result = await securityToolingService.testSecretsConnection(data);
    
    res.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      securityLogger.warn('Validation error testing Secrets Manager connection', { error: error.errors });
      return res.status(400).json({ message: 'Invalid Secrets Manager integration data', errors: error.errors });
    }
    
    securityLogger.error('Error testing Secrets Manager connection', { error });
    res.status(500).json({ message: 'Failed to test Secrets Manager connection', error: error.message });
  }
});

export default router;