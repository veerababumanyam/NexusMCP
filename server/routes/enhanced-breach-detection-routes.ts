/**
 * Enhanced Breach Detection API Routes
 * Provides endpoints for monitoring, reporting, and managing security breaches
 */
import { Request, Response, Router } from 'express';
import { db } from '../../db';
import { 
  breachDetections, 
  breachEvents, 
  breachDetectionRules,
  securityMetrics,
  breachIndicators,
  breachStatusSchema,
  breachSeveritySchema,
  breachDetectionTypeSchema,
  breachOverviewFilterSchema
} from '../../shared/schema_breach_detection';
import { eq, and, desc, gte, lte, like, or, inArray, sql } from 'drizzle-orm';

// Create router instance
const router = Router();

// Get breach detection overview statistics
router.get('/overview', getBreachOverview);

// Get breach detections with optional filtering
router.get('/breaches', getBreachDetections);

// Get specific breach detection by ID
router.get('/breaches/:id', getBreachDetectionById);

// Get events for a specific breach
router.get('/breaches/:id/events', getBreachEvents);

// Get all breach detection rules
router.get('/rules', getBreachRules);

// Get specific rule by ID
router.get('/rules/:id', getRuleById);

// Get security metrics
router.get('/metrics', getSecurityMetrics);

// Create new breach detection event (manual or system detection)
router.post('/breaches', createBreachDetection);

// Update breach detection status
router.patch('/breaches/:id', updateBreachDetection);

// Add event to a breach
router.post('/breaches/:id/events', addBreachEvent);

// Create new breach detection rule
router.post('/rules', createBreachRule);

// Update breach detection rule
router.patch('/rules/:id', updateBreachRule);

// Export the router
export default router;

/**
 * Get breach detection overview statistics
 */
async function getBreachOverview(req: Request, res: Response) {
  try {
    // Default empty values in case there's no data yet
    const summary = {
      total: 0,
      open: 0,
      critical: 0,
      highSeverity: 0
    };
    
    const result = {
      summary,
      bySeverity: [],
      byStatus: [],
      byType: [],
      bySource: [],
      recentDetections: [],
      criticalMetrics: []
    };
    
    // Check if the breach_detections table exists
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'breach_detections'
      )
    `);
    
    const exists = tableExists.rows && tableExists.rows[0] && tableExists.rows[0].exists === true;
    
    if (!exists) {
      // Return empty statistics if table doesn't exist
      return res.json(result);
    }
    
    try {
      // Get counts by severity using raw SQL to avoid ORM issues
      const severityCountsResult = await db.execute(sql`
        SELECT severity, COUNT(*) as count 
        FROM breach_detections 
        GROUP BY severity
      `);
      
      if (severityCountsResult.rows) {
        result.bySeverity = severityCountsResult.rows;
      }
      
      // Get counts by status
      const statusCountsResult = await db.execute(sql`
        SELECT status, COUNT(*) as count 
        FROM breach_detections 
        GROUP BY status
      `);
      
      if (statusCountsResult.rows) {
        result.byStatus = statusCountsResult.rows;
      }
      
      // Get counts by type
      const typeCountsResult = await db.execute(sql`
        SELECT detection_type as type, COUNT(*) as count 
        FROM breach_detections 
        GROUP BY detection_type
      `);
      
      if (typeCountsResult.rows) {
        result.byType = typeCountsResult.rows;
      }
      
      // Get counts by source
      const sourceCountsResult = await db.execute(sql`
        SELECT source, COUNT(*) as count 
        FROM breach_detections 
        GROUP BY source
      `);
      
      if (sourceCountsResult.rows) {
        result.bySource = sourceCountsResult.rows;
      }
      
      // Get recent detections
      const recentDetectionsResult = await db.execute(sql`
        SELECT * FROM breach_detections 
        ORDER BY detected_at DESC 
        LIMIT 5
      `);
      
      if (recentDetectionsResult.rows) {
        result.recentDetections = recentDetectionsResult.rows;
      }
      
      // Get summary counts
      const totalCountResult = await db.execute(sql`SELECT COUNT(*) FROM breach_detections`);
      summary.total = parseInt(totalCountResult.rows?.[0]?.count) || 0;
      
      const openCountResult = await db.execute(sql`
        SELECT COUNT(*) FROM breach_detections WHERE status = 'open'
      `);
      summary.open = parseInt(openCountResult.rows?.[0]?.count) || 0;
      
      const criticalCountResult = await db.execute(sql`
        SELECT COUNT(*) FROM breach_detections WHERE severity = 'critical'
      `);
      summary.critical = parseInt(criticalCountResult.rows?.[0]?.count) || 0;
      
      const highCountResult = await db.execute(sql`
        SELECT COUNT(*) FROM breach_detections WHERE severity = 'high'
      `);
      summary.highSeverity = parseInt(highCountResult.rows?.[0]?.count) || 0;
      
      // Get security metrics if the table exists
      const metricsTableExists = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'security_metrics'
        )
      `);
      
      const metricsExist = metricsTableExists.rows?.[0]?.exists === true;
      
      if (metricsExist) {
        const metricsResult = await db.execute(sql`
          SELECT * FROM security_metrics 
          ORDER BY timestamp DESC 
          LIMIT 5
        `);
        
        if (metricsResult.rows) {
          result.criticalMetrics = metricsResult.rows;
        }
      }
    } catch (err) {
      console.error('Error querying breach detection data:', err);
      // Continue with whatever data we have instead of failing
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error getting breach overview:', error);
    // Don't return an error, return empty data
    res.json({
      summary: { total: 0, open: 0, critical: 0, highSeverity: 0 },
      bySeverity: [],
      byStatus: [],
      byType: [],
      bySource: [],
      recentDetections: [],
      criticalMetrics: []
    });
  }
}

/**
 * Get breach detections with optional filtering
 */
async function getBreachDetections(req: Request, res: Response) {
  try {
    // Check if the breach_detections table exists
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'breach_detections'
      )
    `);
    
    const exists = tableExists.rows && tableExists.rows[0] && tableExists.rows[0].exists === true;
    
    if (!exists) {
      // Return empty array if table doesn't exist yet
      return res.json([]);
    }
    
    const {
      status,
      severity,
      type,
      startDate,
      endDate,
      source,
      workspaceId
    } = req.query;
    
    // Validate filters
    const parsedFilters = breachOverviewFilterSchema.safeParse(req.query);
    if (!parsedFilters.success) {
      return res.status(400).json({ error: 'Invalid filter parameters', details: parsedFilters.error });
    }
    
    // Build query with filters
    let query = db.select().from(breachDetections);
    
    if (status && status !== 'all') {
      query = query.where(eq(breachDetections.status, status as string));
    }
    
    if (severity && severity !== 'all') {
      query = query.where(eq(breachDetections.severity, severity as string));
    }
    
    if (type && type !== 'all') {
      query = query.where(eq(breachDetections.detectionType, type as string));
    }
    
    if (startDate) {
      query = query.where(gte(breachDetections.detectedAt, new Date(startDate as string)));
    }
    
    if (endDate) {
      query = query.where(lte(breachDetections.detectedAt, new Date(endDate as string)));
    }
    
    if (source && source !== 'all') {
      query = query.where(eq(breachDetections.source, source as string));
    }
    
    if (workspaceId) {
      query = query.where(eq(breachDetections.workspaceId, Number(workspaceId)));
    }
    
    // Execute query with ordering
    const results = await query.orderBy(desc(breachDetections.detectedAt));
    
    res.json(results);
  } catch (error) {
    console.error('Error getting breach detections:', error);
    // Don't return a 500 error, return an empty array instead
    res.json([]);
  }
}

/**
 * Get specific breach detection by ID
 */
async function getBreachDetectionById(req: Request, res: Response) {
  try {
    // Check if the breach_detections table exists
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'breach_detections'
      )
    `);
    
    const exists = tableExists.rows?.[0]?.exists === true;
    
    if (!exists) {
      return res.status(404).json({ error: 'Breach detection not found' });
    }
    
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid breach detection ID' });
    }
    
    try {
      const breachDetection = await db.select()
        .from(breachDetections)
        .where(eq(breachDetections.id, id))
        .limit(1);
        
      if (!breachDetection.length) {
        return res.status(404).json({ error: 'Breach detection not found' });
      }
      
      // Get rule if applicable
      let rule = null;
      if (breachDetection[0].ruleId) {
        try {
          const rulesTableExists = await db.execute(sql`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_schema = 'public' 
              AND table_name = 'breach_detection_rules'
            )
          `);
          
          const rulesExist = rulesTableExists.rows?.[0]?.exists === true;
          
          if (rulesExist) {
            const ruleResult = await db.select()
              .from(breachDetectionRules)
              .where(eq(breachDetectionRules.id, breachDetection[0].ruleId))
              .limit(1);
            
            if (ruleResult.length) {
              rule = ruleResult[0];
            }
          }
        } catch (err) {
          console.error('Error fetching rule:', err);
        }
      }
      
      // Get events
      let events = [];
      try {
        const eventsTableExists = await db.execute(sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'breach_events'
          )
        `);
        
        const eventsExist = eventsTableExists.rows?.[0]?.exists === true;
        
        if (eventsExist) {
          events = await db.select()
            .from(breachEvents)
            .where(eq(breachEvents.breachId, id))
            .orderBy(desc(breachEvents.timestamp));
        }
      } catch (err) {
        console.error('Error fetching events:', err);
      }
      
      res.json({
        ...breachDetection[0],
        rule,
        events
      });
    } catch (err) {
      console.error('Error executing breach detection query:', err);
      return res.status(404).json({ error: 'Breach detection not found' });
    }
  } catch (error) {
    console.error('Error getting breach detection by ID:', error);
    res.status(404).json({ error: 'Breach detection not found' });
  }
}

/**
 * Get events for a specific breach
 */
async function getBreachEvents(req: Request, res: Response) {
  try {
    // Check if the breach_events table exists
    const tableExists = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'breach_events'
      )
    `);
    
    const exists = tableExists.rows?.[0]?.exists === true;
    
    if (!exists) {
      return res.json([]);
    }
    
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid breach detection ID' });
    }
    
    const events = await db.select()
      .from(breachEvents)
      .where(eq(breachEvents.breachId, id))
      .orderBy(desc(breachEvents.timestamp));
    
    res.json(events);
  } catch (error) {
    console.error('Error getting breach events:', error);
    res.json([]);
  }
}

/**
 * Get all breach detection rules
 */
async function getBreachRules(req: Request, res: Response) {
  try {
    const rules = await db.select()
      .from(breachDetectionRules)
      .orderBy(breachDetectionRules.name);
    
    res.json(rules);
  } catch (error) {
    console.error('Error getting breach rules:', error);
    res.status(500).json({ error: 'Failed to retrieve breach rules' });
  }
}

/**
 * Get specific rule by ID
 */
async function getRuleById(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid rule ID' });
    }
    
    const rule = await db.select()
      .from(breachDetectionRules)
      .where(eq(breachDetectionRules.id, id))
      .limit(1);
      
    if (!rule.length) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    
    // Get detections that used this rule
    const detections = await db.select()
      .from(breachDetections)
      .where(eq(breachDetections.ruleId, id))
      .orderBy(desc(breachDetections.detectedAt))
      .limit(10);
    
    res.json({
      ...rule[0],
      recentDetections: detections
    });
  } catch (error) {
    console.error('Error getting rule by ID:', error);
    res.status(500).json({ error: 'Failed to retrieve rule' });
  }
}

/**
 * Get security metrics
 */
async function getSecurityMetrics(req: Request, res: Response) {
  try {
    const { category, metricType, timeframe } = req.query;
    
    let query = db.select().from(securityMetrics);
    
    if (category) {
      query = query.where(eq(securityMetrics.category, category as string));
    }
    
    if (metricType) {
      query = query.where(eq(securityMetrics.metricType, metricType as string));
    }
    
    if (timeframe) {
      // Get metrics for the last X hours
      const hours = parseInt(timeframe as string);
      if (!isNaN(hours)) {
        const fromDate = new Date();
        fromDate.setHours(fromDate.getHours() - hours);
        query = query.where(gte(securityMetrics.timestamp, fromDate));
      }
    }
    
    const metrics = await query.orderBy(desc(securityMetrics.timestamp));
    
    res.json(metrics);
  } catch (error) {
    console.error('Error getting security metrics:', error);
    res.status(500).json({ error: 'Failed to retrieve security metrics' });
  }
}

/**
 * Create new breach detection event (manual or system detection)
 */
async function createBreachDetection(req: Request, res: Response) {
  try {
    const newDetection = req.body;
    
    // Check required fields
    if (!newDetection.title || !newDetection.detectionType || !newDetection.source) {
      return res.status(400).json({ error: 'Missing required fields for breach detection' });
    }
    
    // Insert the breach detection
    const result = await db.insert(breachDetections).values({
      title: newDetection.title,
      detectionType: newDetection.detectionType,
      description: newDetection.description,
      severity: newDetection.severity || 'medium',
      status: newDetection.status || 'open',
      source: newDetection.source,
      ruleId: newDetection.ruleId,
      workspaceId: newDetection.workspaceId,
      affectedResources: newDetection.affectedResources,
      evidence: newDetection.evidence,
      createdBy: newDetection.createdBy
    }).returning();
    
    // Add initial detection event
    if (result.length > 0) {
      await db.insert(breachEvents).values({
        breachId: result[0].id,
        eventType: 'detection',
        userId: newDetection.createdBy,
        details: JSON.stringify({
          message: "Breach initially detected",
          severity: newDetection.severity || 'medium',
          detectedBy: newDetection.createdBy ? "user" : "system"
        })
      });
    }
    
    res.status(201).json(result[0]);
  } catch (error) {
    console.error('Error creating breach detection:', error);
    res.status(500).json({ error: 'Failed to create breach detection' });
  }
}

/**
 * Update breach detection status
 */
async function updateBreachDetection(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid breach detection ID' });
    }
    
    const updates = req.body;
    
    // Check if breach exists
    const existing = await db.select()
      .from(breachDetections)
      .where(eq(breachDetections.id, id))
      .limit(1);
      
    if (!existing.length) {
      return res.status(404).json({ error: 'Breach detection not found' });
    }
    
    // Update the breach
    const result = await db.update(breachDetections)
      .set({
        status: updates.status !== undefined ? updates.status : existing[0].status,
        severity: updates.severity !== undefined ? updates.severity : existing[0].severity,
        resolution: updates.resolution,
        resolutionNotes: updates.resolutionNotes,
        resolvedAt: updates.status === 'resolved' ? new Date() : existing[0].resolvedAt,
        resolvedBy: updates.status === 'resolved' ? updates.updatedBy : existing[0].resolvedBy,
        updatedAt: new Date(),
        updatedBy: updates.updatedBy
      })
      .where(eq(breachDetections.id, id))
      .returning();
    
    // Add status update event if status changed
    if (updates.status && updates.status !== existing[0].status) {
      await db.insert(breachEvents).values({
        breachId: id,
        eventType: updates.status === 'resolved' ? 'resolution' : 'status_change',
        userId: updates.updatedBy,
        details: JSON.stringify({
          message: `Status changed from ${existing[0].status} to ${updates.status}`,
          previousStatus: existing[0].status,
          newStatus: updates.status,
          resolution: updates.resolution,
          resolutionNotes: updates.resolutionNotes
        })
      });
    }
    
    res.json(result[0]);
  } catch (error) {
    console.error('Error updating breach detection:', error);
    res.status(500).json({ error: 'Failed to update breach detection' });
  }
}

/**
 * Add event to a breach
 */
async function addBreachEvent(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid breach detection ID' });
    }
    
    const { eventType, details, userId } = req.body;
    
    if (!eventType) {
      return res.status(400).json({ error: 'Event type is required' });
    }
    
    // Check if breach exists
    const existing = await db.select()
      .from(breachDetections)
      .where(eq(breachDetections.id, id))
      .limit(1);
      
    if (!existing.length) {
      return res.status(404).json({ error: 'Breach detection not found' });
    }
    
    // Add the event
    const result = await db.insert(breachEvents).values({
      breachId: id,
      eventType,
      userId,
      details: details ? JSON.stringify(details) : null
    }).returning();
    
    // Update breach updated_at
    await db.update(breachDetections)
      .set({ updatedAt: new Date() })
      .where(eq(breachDetections.id, id));
    
    res.status(201).json(result[0]);
  } catch (error) {
    console.error('Error adding breach event:', error);
    res.status(500).json({ error: 'Failed to add breach event' });
  }
}

/**
 * Create new breach detection rule
 */
async function createBreachRule(req: Request, res: Response) {
  try {
    const newRule = req.body;
    
    // Check required fields
    if (!newRule.name || !newRule.type || !newRule.definition) {
      return res.status(400).json({ error: 'Missing required fields for breach rule' });
    }
    
    // Insert the rule
    const result = await db.insert(breachDetectionRules).values({
      name: newRule.name,
      description: newRule.description,
      type: newRule.type,
      definition: typeof newRule.definition === 'string' ? newRule.definition : JSON.stringify(newRule.definition),
      workspaceId: newRule.workspaceId,
      category: newRule.category,
      severity: newRule.severity || 'medium',
      status: newRule.status || 'enabled',
      isGlobal: newRule.isGlobal !== undefined ? newRule.isGlobal : false,
      thresholds: newRule.thresholds,
      metadata: newRule.metadata,
      createdBy: newRule.createdBy
    }).returning();
    
    res.status(201).json(result[0]);
  } catch (error) {
    console.error('Error creating breach rule:', error);
    res.status(500).json({ error: 'Failed to create breach rule' });
  }
}

/**
 * Update breach detection rule
 */
async function updateBreachRule(req: Request, res: Response) {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid rule ID' });
    }
    
    const updates = req.body;
    
    // Check if rule exists
    const existing = await db.select()
      .from(breachDetectionRules)
      .where(eq(breachDetectionRules.id, id))
      .limit(1);
      
    if (!existing.length) {
      return res.status(404).json({ error: 'Rule not found' });
    }
    
    // Update the rule
    const result = await db.update(breachDetectionRules)
      .set({
        name: updates.name !== undefined ? updates.name : existing[0].name,
        description: updates.description !== undefined ? updates.description : existing[0].description,
        type: updates.type !== undefined ? updates.type : existing[0].type,
        definition: updates.definition !== undefined ? 
          (typeof updates.definition === 'string' ? updates.definition : JSON.stringify(updates.definition)) : 
          existing[0].definition,
        workspaceId: updates.workspaceId !== undefined ? updates.workspaceId : existing[0].workspaceId,
        category: updates.category !== undefined ? updates.category : existing[0].category,
        severity: updates.severity !== undefined ? updates.severity : existing[0].severity,
        status: updates.status !== undefined ? updates.status : existing[0].status,
        isGlobal: updates.isGlobal !== undefined ? updates.isGlobal : existing[0].isGlobal,
        thresholds: updates.thresholds !== undefined ? updates.thresholds : existing[0].thresholds,
        metadata: updates.metadata !== undefined ? updates.metadata : existing[0].metadata,
        updatedAt: new Date(),
        updatedBy: updates.updatedBy
      })
      .where(eq(breachDetectionRules.id, id))
      .returning();
    
    res.json(result[0]);
  } catch (error) {
    console.error('Error updating breach rule:', error);
    res.status(500).json({ error: 'Failed to update breach rule' });
  }
}