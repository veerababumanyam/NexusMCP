/**
 * Enhanced Security Routes
 * 
 * This file contains integrated security routes for:
 * 1. Enhanced Breach Detection
 * 2. Integration with OAuth security events
 * 3. Integration with IP Access Control
 * 4. Integration with Monitoring and Alerting
 */

import express from 'express';
import { enhancedBreachDetectionService } from '../services/security/EnhancedBreachDetectionService';
import { oauthIpAccessControlService } from '../services/oauth/OAuthIpAccessControlService';
import { oauthMonitoringService } from '../services/oauth/OAuthMonitoringService';
import { oauthTokenRotationService } from '../services/oauth/OAuthTokenRotationService';
import { breachDetectionRulesInsertSchema, breachDetectionsInsertSchema } from '@shared/schema_breach_detection';
import { validate } from '../middleware/validation-middleware';
import { authenticate } from '../middleware/auth-middleware';

const router = express.Router();

// Add authentication middleware
router.use(authenticate);

// =================== Breach Detection Routes ===================

/**
 * Get breaches with optional filtering
 */
router.get('/breaches', async (req, res) => {
  try {
    const {
      workspaceId,
      status,
      severity,
      type,
      source,
      from,
      to,
      search,
      page,
      limit,
      sortBy,
      sortOrder
    } = req.query;
    
    const filters: any = {};
    
    // Parse workspace ID
    if (workspaceId) {
      filters.workspaceId = parseInt(workspaceId as string);
    }
    
    // Filter by status
    if (status) {
      filters.status = status;
    }
    
    // Filter by severity
    if (severity) {
      filters.severity = severity;
    }
    
    // Filter by type
    if (type) {
      filters.type = type;
    }
    
    // Filter by source
    if (source) {
      filters.source = source;
    }
    
    // Handle date filtering
    if (from) {
      filters.from = new Date(from as string);
    }
    
    if (to) {
      filters.to = new Date(to as string);
    }
    
    // Handle search
    if (search) {
      filters.search = search;
    }
    
    // Handle pagination
    if (page) {
      filters.page = parseInt(page as string);
    }
    
    if (limit) {
      filters.limit = parseInt(limit as string);
    }
    
    // Handle sorting
    if (sortBy) {
      filters.sortBy = sortBy;
    }
    
    if (sortOrder) {
      filters.sortOrder = sortOrder === 'asc' ? 'asc' : 'desc';
    }
    
    const breaches = await enhancedBreachDetectionService.getBreachDetections(filters);
    res.json(breaches);
  } catch (error) {
    console.error('Error getting breaches:', error);
    res.status(500).json({ error: 'Failed to get breaches' });
  }
});

/**
 * Get breach statistics
 */
router.get('/breaches/stats', async (req, res) => {
  try {
    const { workspaceId } = req.query;
    
    const workspaceIdParam = workspaceId 
      ? parseInt(workspaceId as string) 
      : undefined;
    
    const stats = await enhancedBreachDetectionService.getBreachStats(workspaceIdParam);
    res.json(stats);
  } catch (error) {
    console.error('Error getting breach statistics:', error);
    res.status(500).json({ error: 'Failed to get breach statistics' });
  }
});

/**
 * Get a specific breach by ID
 */
router.get('/breaches/:id', async (req, res) => {
  try {
    const breachId = parseInt(req.params.id);
    const breach = await enhancedBreachDetectionService.getBreachById(breachId);
    
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
router.post('/breaches', validate(breachDetectionsInsertSchema), async (req, res) => {
  try {
    const breachData = {
      title: req.body.title,
      detectionType: req.body.detectionType,
      detectedAt: req.body.detectedAt || new Date(),
      workspaceId: req.body.workspaceId || null,
      description: req.body.description || null,
      severity: req.body.severity || 'medium',
      status: req.body.status || 'open',
      affectedResources: req.body.affectedResources || [],
      evidence: req.body.evidence || {},
      source: req.body.source || 'manual',
      ruleId: req.body.ruleId || null,
      createdBy: req.user?.id || null
    };
    
    const breach = await enhancedBreachDetectionService.createBreach(breachData);
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
    const existingBreach = await enhancedBreachDetectionService.getBreachById(breachId);
    if (!existingBreach) {
      return res.status(404).json({ error: 'Breach not found' });
    }
    
    // Update breach
    const breach = await enhancedBreachDetectionService.updateBreach(breachId, {
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
 * Get events for a breach
 */
router.get('/breaches/:id/events', async (req, res) => {
  try {
    const breachId = parseInt(req.params.id);
    const events = await enhancedBreachDetectionService.getBreachEvents(breachId);
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
    
    const event = await enhancedBreachDetectionService.addBreachEvent({
      breachId,
      eventType,
      details,
      userId: req.user?.id || null
    });
    
    res.status(201).json(event);
  } catch (error) {
    console.error(`Error adding event to breach ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to add breach event' });
  }
});

/**
 * Resolve a breach
 */
router.post('/breaches/:id/resolve', async (req, res) => {
  try {
    const breachId = parseInt(req.params.id);
    const { notes, resolution } = req.body;
    
    const breach = await enhancedBreachDetectionService.updateBreach(breachId, {
      status: 'resolved',
      resolvedAt: new Date(),
      resolvedBy: req.user?.id || null,
      resolutionNotes: notes || null,
      updatedBy: req.user?.id || null,
      resolution: resolution || 'resolved'
    });
    
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
 * Mark a breach as false positive
 */
router.post('/breaches/:id/false-positive', async (req, res) => {
  try {
    const breachId = parseInt(req.params.id);
    const { notes } = req.body;
    
    const breach = await enhancedBreachDetectionService.updateBreach(breachId, {
      status: 'false_positive',
      resolvedAt: new Date(),
      resolvedBy: req.user?.id || null,
      resolutionNotes: notes || 'Marked as false positive',
      updatedBy: req.user?.id || null
    });
    
    if (!breach) {
      return res.status(404).json({ error: 'Breach not found' });
    }
    
    res.json(breach);
  } catch (error) {
    console.error(`Error marking breach ${req.params.id} as false positive:`, error);
    res.status(500).json({ error: 'Failed to mark breach as false positive' });
  }
});

// =================== Breach Detection Rule Routes ===================

/**
 * Get all breach detection rules
 */
router.get('/breach-rules', async (req, res) => {
  try {
    const { workspaceId, status, type } = req.query;
    
    const filters: any = {};
    
    if (workspaceId) {
      filters.workspaceId = parseInt(workspaceId as string);
    }
    
    if (status) {
      filters.status = status;
    }
    
    if (type) {
      filters.type = type;
    }
    
    const rules = await enhancedBreachDetectionService.getBreachDetectionRules(filters);
    res.json(rules);
  } catch (error) {
    console.error('Error getting breach detection rules:', error);
    res.status(500).json({ error: 'Failed to get breach detection rules' });
  }
});

/**
 * Get a specific breach detection rule
 */
router.get('/breach-rules/:id', async (req, res) => {
  try {
    const ruleId = parseInt(req.params.id);
    const rule = await enhancedBreachDetectionService.getBreachDetectionRuleById(ruleId);
    
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    
    res.json(rule);
  } catch (error) {
    console.error(`Error getting rule ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to get rule' });
  }
});

/**
 * Create a new breach detection rule
 */
router.post('/breach-rules', validate(breachDetectionRulesInsertSchema), async (req, res) => {
  try {
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
      thresholds: req.body.thresholds || null,
      metadata: req.body.metadata || {},
      createdBy: req.user?.id || null,
      updatedBy: req.user?.id || null
    };
    
    const rule = await enhancedBreachDetectionService.createBreachDetectionRule(ruleData);
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
    const existingRule = await enhancedBreachDetectionService.getBreachDetectionRuleById(ruleId);
    if (!existingRule) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    
    // Update rule
    const rule = await enhancedBreachDetectionService.updateBreachDetectionRule(ruleId, {
      ...req.body,
      updatedBy: req.user?.id || null
    });
    
    res.json(rule);
  } catch (error) {
    console.error(`Error updating rule ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to update rule' });
  }
});

/**
 * Delete a breach detection rule
 */
router.delete('/breach-rules/:id', async (req, res) => {
  try {
    const ruleId = parseInt(req.params.id);
    const success = await enhancedBreachDetectionService.deleteBreachDetectionRule(ruleId);
    
    if (!success) {
      return res.status(404).json({ error: 'Rule not found or cannot be deleted' });
    }
    
    res.status(204).send();
  } catch (error) {
    console.error(`Error deleting rule ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete rule' });
  }
});

/**
 * Test a breach detection rule
 */
router.post('/breach-rules/:id/test', async (req, res) => {
  try {
    const ruleId = parseInt(req.params.id);
    
    // Check if rule exists
    const existingRule = await enhancedBreachDetectionService.getBreachDetectionRuleById(ruleId);
    if (!existingRule) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    
    // Test the rule
    const testResults = await enhancedBreachDetectionService.testBreachDetectionRule(ruleId);
    res.json(testResults);
  } catch (error) {
    console.error(`Error testing rule ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to test rule' });
  }
});

// =================== Integrated Security Routes ===================

/**
 * Get security overview (combined stats from multiple security systems)
 */
router.get('/overview', async (req, res) => {
  try {
    const { workspaceId } = req.query;
    
    const workspaceIdParam = workspaceId 
      ? parseInt(workspaceId as string) 
      : undefined;
    
    // Get breach stats
    const breachStats = await enhancedBreachDetectionService.getBreachStats(workspaceIdParam);
    
    // Get IP access control stats
    const ipAccessStats = await oauthIpAccessControlService.getAccessStats();
    
    // Get monitoring stats
    const monitoringStats = await oauthMonitoringService.getHealthCheckSummary();
    
    // Get token usage stats
    const tokenStats = await oauthTokenRotationService.getTokenUsageStats();
    
    // Combine into a unified security overview
    res.json({
      breachDetection: breachStats,
      ipAccess: ipAccessStats,
      monitoring: monitoringStats,
      tokenUsage: tokenStats,
      securityScore: calculateSecurityScore(breachStats, ipAccessStats, monitoringStats),
      recommendedActions: generateRecommendedActions(breachStats, ipAccessStats, monitoringStats)
    });
  } catch (error) {
    console.error('Error getting security overview:', error);
    res.status(500).json({ error: 'Failed to get security overview' });
  }
});

/**
 * Calculate a security score based on various metrics
 */
function calculateSecurityScore(
  breachStats: any, 
  ipAccessStats: any, 
  monitoringStats: any
): number {
  let score = 100; // Start with perfect score
  
  // Reduce score based on open breaches
  if (breachStats.open > 0) {
    score -= Math.min(30, breachStats.open * 5); // Max 30 point reduction
  }
  
  // Reduce score based on critical/high severity breaches
  if (breachStats.bySeverity?.critical > 0) {
    score -= Math.min(20, breachStats.bySeverity.critical * 10); // Max 20 point reduction
  }
  
  if (breachStats.bySeverity?.high > 0) {
    score -= Math.min(15, breachStats.bySeverity.high * 5); // Max 15 point reduction
  }
  
  // Reduce score based on IP access violations
  if (ipAccessStats.violationsLast24h > 10) {
    score -= Math.min(15, ipAccessStats.violationsLast24h / 2);
  }
  
  // Reduce score based on monitoring health
  if (monitoringStats.overall?.unhealthy > 0) {
    score -= Math.min(20, monitoringStats.overall.unhealthy * 5);
  }
  
  return Math.max(0, Math.round(score)); // Ensure score is between 0-100
}

/**
 * Generate recommended actions based on security status
 */
function generateRecommendedActions(
  breachStats: any, 
  ipAccessStats: any, 
  monitoringStats: any
): Array<{ priority: 'critical' | 'high' | 'medium' | 'low', action: string }> {
  const recommendations: Array<{ priority: 'critical' | 'high' | 'medium' | 'low', action: string }> = [];
  
  // Critical breaches
  if (breachStats.bySeverity?.critical > 0) {
    recommendations.push({
      priority: 'critical',
      action: `Investigate ${breachStats.bySeverity.critical} critical security breaches`
    });
  }
  
  // High severity breaches
  if (breachStats.bySeverity?.high > 0) {
    recommendations.push({
      priority: 'high',
      action: `Review ${breachStats.bySeverity.high} high severity security breaches`
    });
  }
  
  // IP access violations
  if (ipAccessStats.violationsLast24h > 10) {
    recommendations.push({
      priority: 'high',
      action: `Review ${ipAccessStats.violationsLast24h} IP access violations in the last 24 hours`
    });
  }
  
  // Unhealthy monitoring
  if (monitoringStats.overall?.unhealthy > 0) {
    recommendations.push({
      priority: 'high',
      action: `Fix ${monitoringStats.overall.unhealthy} unhealthy monitoring services`
    });
  }
  
  // Token usage
  if (ipAccessStats.suspiciousActivity > 0) {
    recommendations.push({
      priority: 'medium',
      action: `Investigate ${ipAccessStats.suspiciousActivity} suspicious activities`
    });
  }
  
  // Add more general recommendations if needed
  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'low',
      action: 'Perform regular security reviews and audits'
    });
  }
  
  return recommendations;
}

export default router;