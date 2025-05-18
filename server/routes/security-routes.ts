/**
 * Security Scanner API Routes
 * 
 * This file defines the Express routes for the security scanner functionality:
 * - Managing scanners (CRUD operations)
 * - Managing scan targets (CRUD operations)
 * - Initiating and managing scans
 * - Viewing and managing vulnerabilities
 */

import express, { Request, Response } from 'express';
import { SecurityScannerService } from '../services/security/SecurityScannerService';
import { requireAuth, requirePermission } from '../auth';
import { logger } from '../utils/logger';

const router = express.Router();
const securityScannerService = new SecurityScannerService();

/**
 * Security scanner routes
 */

// Get all security scanners
router.get('/scanners', requireAuth, async (req: Request, res: Response) => {
  try {
    // Get the workspace ID from the authenticated user or query parameter
    const workspaceId = req.query.workspaceId ? parseInt(req.query.workspaceId as string) : undefined;
    
    const scanners = await securityScannerService.getScanners(workspaceId);
    res.json(scanners);
  } catch (error) {
    logger.error('Error in GET /security/scanners:', error);
    res.status(500).json({ error: 'Failed to get scanners' });
  }
});

// Get a single security scanner
router.get('/scanners/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const scanner = await securityScannerService.getScanner(id);
    
    if (!scanner) {
      return res.status(404).json({ error: 'Scanner not found' });
    }
    
    res.json(scanner);
  } catch (error) {
    logger.error(`Error in GET /security/scanners/${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to get scanner' });
  }
});

// Create a new security scanner
router.post('/scanners', requireAuth, async (req: Request, res: Response) => {
  try {
    // Get the user ID from the authenticated user
    const userId = req.user?.id;
    
    // Add the user ID to the request body as the creator
    const data = {
      ...req.body,
      createdBy: userId,
      updatedBy: userId
    };
    
    const newScanner = await securityScannerService.createScanner(data);
    res.status(201).json(newScanner);
  } catch (error) {
    logger.error('Error in POST /security/scanners:', error);
    
    // Handle validation errors
    if (error instanceof Error && error.message.startsWith('Validation error:')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to create scanner' });
  }
});

// Update a security scanner
router.put('/scanners/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user?.id;
    
    // Add the user ID to the request body as the updater
    const data = {
      ...req.body,
      updatedBy: userId
    };
    
    const updatedScanner = await securityScannerService.updateScanner(id, data);
    
    if (!updatedScanner) {
      return res.status(404).json({ error: 'Scanner not found' });
    }
    
    res.json(updatedScanner);
  } catch (error) {
    logger.error(`Error in PUT /security/scanners/${req.params.id}:`, error);
    
    // Handle validation errors
    if (error instanceof Error && error.message.startsWith('Validation error:')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to update scanner' });
  }
});

// Delete a security scanner
router.delete('/scanners/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const success = await securityScannerService.deleteScanner(id);
    
    if (!success) {
      return res.status(404).json({ error: 'Scanner not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    logger.error(`Error in DELETE /security/scanners/${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete scanner' });
  }
});

/**
 * Scan target routes
 */

// Get all scan targets
router.get('/targets', requireAuth, async (req: Request, res: Response) => {
  try {
    // Get the workspace ID from the authenticated user or query parameter
    const workspaceId = req.query.workspaceId ? parseInt(req.query.workspaceId as string) : undefined;
    
    const targets = await securityScannerService.getScanTargets(workspaceId);
    res.json(targets);
  } catch (error) {
    logger.error('Error in GET /security/targets:', error);
    res.status(500).json({ error: 'Failed to get scan targets' });
  }
});

// Get a single scan target
router.get('/targets/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const target = await securityScannerService.getScanTarget(id);
    
    if (!target) {
      return res.status(404).json({ error: 'Target not found' });
    }
    
    res.json(target);
  } catch (error) {
    logger.error(`Error in GET /security/targets/${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to get target' });
  }
});

// Create a new scan target
router.post('/targets', requireAuth, async (req: Request, res: Response) => {
  try {
    // Get the user ID from the authenticated user
    const userId = req.user?.id;
    
    // Add the user ID to the request body as the creator
    const data = {
      ...req.body,
      createdBy: userId,
      updatedBy: userId
    };
    
    const newTarget = await securityScannerService.createScanTarget(data);
    res.status(201).json(newTarget);
  } catch (error) {
    logger.error('Error in POST /security/targets:', error);
    
    // Handle validation errors
    if (error instanceof Error && error.message.startsWith('Validation error:')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to create target' });
  }
});

// Update a scan target
router.put('/targets/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const userId = req.user?.id;
    
    // Add the user ID to the request body as the updater
    const data = {
      ...req.body,
      updatedBy: userId
    };
    
    const updatedTarget = await securityScannerService.updateScanTarget(id, data);
    
    if (!updatedTarget) {
      return res.status(404).json({ error: 'Target not found' });
    }
    
    res.json(updatedTarget);
  } catch (error) {
    logger.error(`Error in PUT /security/targets/${req.params.id}:`, error);
    
    // Handle validation errors
    if (error instanceof Error && error.message.startsWith('Validation error:')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to update target' });
  }
});

// Delete a scan target
router.delete('/targets/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const success = await securityScannerService.deleteScanTarget(id);
    
    if (!success) {
      return res.status(404).json({ error: 'Target not found' });
    }
    
    res.status(204).send();
  } catch (error) {
    logger.error(`Error in DELETE /security/targets/${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete target' });
  }
});

/**
 * Scan results and vulnerabilities routes
 */

// Get scan results for a scanner
router.get('/scanners/:scannerId/results', requireAuth, async (req: Request, res: Response) => {
  try {
    const scannerId = parseInt(req.params.scannerId);
    
    // Verify that the scanner exists
    const scanner = await securityScannerService.getScanner(scannerId);
    if (!scanner) {
      return res.status(404).json({ error: 'Scanner not found' });
    }
    
    const results = await securityScannerService.getScanResults(scannerId);
    res.json(results);
  } catch (error) {
    logger.error(`Error in GET /security/scanners/${req.params.scannerId}/results:`, error);
    res.status(500).json({ error: 'Failed to get scan results' });
  }
});

// Get vulnerabilities for a scan result
router.get('/scan-results/:resultId/vulnerabilities', requireAuth, async (req: Request, res: Response) => {
  try {
    const resultId = parseInt(req.params.resultId);
    const vulnerabilities = await securityScannerService.getScanVulnerabilities(resultId);
    res.json(vulnerabilities);
  } catch (error) {
    logger.error(`Error in GET /security/scan-results/${req.params.resultId}/vulnerabilities:`, error);
    res.status(500).json({ error: 'Failed to get vulnerabilities' });
  }
});

// Start a new scan
router.post('/scanners/:scannerId/scan', requireAuth, async (req: Request, res: Response) => {
  try {
    const scannerId = parseInt(req.params.scannerId);
    const { targetId } = req.body;
    
    if (!targetId) {
      return res.status(400).json({ error: 'Target ID is required' });
    }
    
    const userId = req.user?.id;
    const scanResult = await securityScannerService.startScan(scannerId, parseInt(targetId), userId);
    
    res.status(201).json(scanResult);
  } catch (error) {
    logger.error(`Error in POST /security/scanners/${req.params.scannerId}/scan:`, error);
    
    // Handle specific errors
    if (error instanceof Error) {
      if (error.message === 'Scanner not found') {
        return res.status(404).json({ error: 'Scanner not found' });
      }
      if (error.message === 'Target not found') {
        return res.status(404).json({ error: 'Target not found' });
      }
    }
    
    res.status(500).json({ error: 'Failed to start scan' });
  }
});

// Update vulnerability status
router.patch('/vulnerabilities/:id/status', requireAuth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    
    const updatedVulnerability = await securityScannerService.updateVulnerabilityStatus(id, status);
    
    if (!updatedVulnerability) {
      return res.status(404).json({ error: 'Vulnerability not found' });
    }
    
    res.json(updatedVulnerability);
  } catch (error) {
    logger.error(`Error in PATCH /security/vulnerabilities/${req.params.id}/status:`, error);
    res.status(500).json({ error: 'Failed to update vulnerability status' });
  }
});

export default router;