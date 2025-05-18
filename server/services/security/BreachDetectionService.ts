import { db } from '../../db';
import { eq, and, desc, sql, asc, gte, lte, like, inArray, isNull, isNotNull, or } from 'drizzle-orm';
import { 
  breachDetectionRules, 
  breachDetections, 
  breachEvents, 
  breachIndicators, 
  breachIndicatorLinks,
  BreachDetectionRule,
  BreachDetection,
  BreachEvent,
  BreachIndicator,
  BreachIndicatorLink
} from '@shared/schema_breach_detection';

/**
 * Service for managing breach detection rules and detected breaches
 * Handles breach detection, investigation, and resolution
 */
export class BreachDetectionService {
  /**
   * Get all breach detection rules with optional filtering
   */
  async getDetectionRules(filters: {
    workspaceId?: number;
    status?: string;
    type?: string;
    severity?: string;
    category?: string;
    isGlobal?: boolean;
    searchTerm?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const {
      workspaceId,
      status,
      type,
      severity,
      category,
      isGlobal,
      searchTerm,
      page = 1,
      limit = 50
    } = filters;

    let query = db.select().from(breachDetectionRules);
    const conditions = [];

    if (workspaceId !== undefined) {
      conditions.push(
        or(
          eq(breachDetectionRules.workspaceId, workspaceId),
          eq(breachDetectionRules.isGlobal, true)
        )
      );
    }

    if (status) {
      conditions.push(eq(breachDetectionRules.status, status));
    }

    if (type) {
      conditions.push(eq(breachDetectionRules.type, type));
    }

    if (severity) {
      conditions.push(eq(breachDetectionRules.severity, severity));
    }

    if (category) {
      conditions.push(eq(breachDetectionRules.category, category));
    }

    if (isGlobal !== undefined) {
      conditions.push(eq(breachDetectionRules.isGlobal, isGlobal));
    }

    if (searchTerm) {
      conditions.push(
        or(
          like(breachDetectionRules.name, `%${searchTerm}%`),
          like(breachDetectionRules.description, `%${searchTerm}%`)
        )
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.orderBy(desc(breachDetectionRules.createdAt))
      .limit(limit)
      .offset(offset);

    const results = await query;
    return results;
  }

  /**
   * Get a detection rule by ID
   */
  async getDetectionRuleById(id: number): Promise<BreachDetectionRule | null> {
    const [result] = await db
      .select()
      .from(breachDetectionRules)
      .where(eq(breachDetectionRules.id, id));
    
    return result || null;
  }

  /**
   * Create a new detection rule
   */
  async createDetectionRule(rule: Omit<BreachDetectionRule, 'id' | 'createdAt' | 'updatedAt'>): Promise<BreachDetectionRule> {
    const [result] = await db
      .insert(breachDetectionRules)
      .values({
        ...rule,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return result;
  }

  /**
   * Update a detection rule
   */
  async updateDetectionRule(
    id: number,
    update: Partial<Omit<BreachDetectionRule, 'id' | 'createdAt'>>
  ): Promise<BreachDetectionRule | null> {
    const [result] = await db
      .update(breachDetectionRules)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(breachDetectionRules.id, id))
      .returning();

    return result || null;
  }

  /**
   * Delete a detection rule
   */
  async deleteDetectionRule(id: number): Promise<boolean> {
    try {
      // First check if rule is used in any breach detections
      const breachCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(breachDetections)
        .where(eq(breachDetections.ruleId, id));
      
      if (breachCount[0].count > 0) {
        // If rule is in use, just deactivate it instead of deleting
        await db
          .update(breachDetectionRules)
          .set({ 
            status: 'disabled',
            updatedAt: new Date()
          })
          .where(eq(breachDetectionRules.id, id));
        
        return true;
      }

      // If not in use, delete the rule
      const [deletedRule] = await db
        .delete(breachDetectionRules)
        .where(eq(breachDetectionRules.id, id))
        .returning();

      return !!deletedRule;
    } catch (error) {
      console.error('Error deleting breach detection rule:', error);
      return false;
    }
  }

  /**
   * Get breaches with optional filtering
   */
  async getBreaches(filters: {
    workspaceId?: number;
    ruleId?: number;
    status?: string;
    severity?: string;
    assignedTo?: number;
    fromDate?: Date;
    toDate?: Date;
    source?: string;
    searchTerm?: string;
    page?: number;
    limit?: number;
  } = {}) {
    const {
      workspaceId,
      ruleId,
      status,
      severity,
      assignedTo,
      fromDate,
      toDate,
      source,
      searchTerm,
      page = 1,
      limit = 50
    } = filters;

    let query = db.select().from(breachDetections);
    const conditions = [];

    if (workspaceId !== undefined) {
      conditions.push(eq(breachDetections.workspaceId, workspaceId));
    }

    if (ruleId !== undefined) {
      conditions.push(eq(breachDetections.ruleId, ruleId));
    }

    if (status) {
      conditions.push(eq(breachDetections.status, status));
    }

    if (severity) {
      conditions.push(eq(breachDetections.severity, severity));
    }

    if (assignedTo !== undefined) {
      conditions.push(eq(breachDetections.assignedTo, assignedTo));
    }

    if (fromDate) {
      conditions.push(gte(breachDetections.detectedAt, fromDate));
    }

    if (toDate) {
      conditions.push(lte(breachDetections.detectedAt, toDate));
    }

    if (source) {
      conditions.push(eq(breachDetections.source, source));
    }

    if (searchTerm) {
      conditions.push(
        or(
          like(breachDetections.title, `%${searchTerm}%`),
          like(breachDetections.description, `%${searchTerm}%`)
        )
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.orderBy(desc(breachDetections.detectedAt))
      .limit(limit)
      .offset(offset);

    const results = await query;
    return results;
  }

  /**
   * Get a breach by ID
   */
  async getBreachById(id: number): Promise<BreachDetection | null> {
    const [result] = await db
      .select()
      .from(breachDetections)
      .where(eq(breachDetections.id, id));
    
    return result || null;
  }

  /**
   * Create a new breach detection
   */
  async createBreach(breach: Omit<BreachDetection, 'id' | 'createdAt' | 'updatedAt'>): Promise<BreachDetection> {
    const [result] = await db
      .insert(breachDetections)
      .values({
        ...breach,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    // Add an event for breach creation
    await this.addBreachEvent({
      breachId: result.id,
      eventType: 'detection',
      details: { 
        message: 'Breach was detected',
        source: breach.source,
        severity: breach.severity
      },
      userId: breach.createdBy,
      createdAt: new Date()
    });

    return result;
  }

  /**
   * Update a breach detection
   */
  async updateBreach(
    id: number,
    update: Partial<Omit<BreachDetection, 'id' | 'createdAt'>>
  ): Promise<BreachDetection | null> {
    const [result] = await db
      .update(breachDetections)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(breachDetections.id, id))
      .returning();

    // If the status has changed, add an event
    if (update.status) {
      await this.addBreachEvent({
        breachId: id,
        eventType: 'status-change',
        details: { 
          message: `Breach status changed to ${update.status}`,
          newStatus: update.status
        },
        userId: update.updatedBy || null,
        createdAt: new Date()
      });
    }

    // If assignment has changed, add an event
    if (update.assignedTo !== undefined) {
      await this.addBreachEvent({
        breachId: id,
        eventType: 'update',
        details: { 
          message: update.assignedTo 
            ? `Breach assigned to user ID ${update.assignedTo}`
            : 'Breach unassigned',
          assignedTo: update.assignedTo,
          assignedBy: update.assignedBy
        },
        userId: update.assignedBy || null,
        createdAt: new Date()
      });
    }

    return result || null;
  }

  /**
   * Get breach events
   */
  async getBreachEvents(breachId: number): Promise<BreachEvent[]> {
    const events = await db
      .select()
      .from(breachEvents)
      .where(eq(breachEvents.breachId, breachId))
      .orderBy(desc(breachEvents.createdAt));
    
    return events;
  }

  /**
   * Add a breach event
   */
  async addBreachEvent(event: Omit<BreachEvent, 'id'>): Promise<BreachEvent> {
    const [result] = await db
      .insert(breachEvents)
      .values(event)
      .returning();

    return result;
  }

  /**
   * Get breach indicators
   */
  async getBreachIndicators(filters: {
    workspaceId?: number;
    type?: string;
    severity?: string;
    source?: string;
    searchTerm?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<BreachIndicator[]> {
    const {
      workspaceId,
      type,
      severity,
      source,
      searchTerm,
      page = 1,
      limit = 50
    } = filters;

    let query = db.select().from(breachIndicators);
    const conditions = [];

    if (workspaceId !== undefined) {
      conditions.push(eq(breachIndicators.workspaceId, workspaceId));
    }

    if (type) {
      conditions.push(eq(breachIndicators.indicatorType, type));
    }

    if (severity) {
      conditions.push(eq(breachIndicators.severity, severity));
    }

    if (source) {
      conditions.push(eq(breachIndicators.source, source));
    }

    if (searchTerm) {
      conditions.push(
        or(
          like(breachIndicators.value, `%${searchTerm}%`),
          like(breachIndicators.description, `%${searchTerm}%`)
        )
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Apply pagination
    const offset = (page - 1) * limit;
    query = query.orderBy(desc(breachIndicators.createdAt))
      .limit(limit)
      .offset(offset);

    const results = await query;
    return results;
  }

  /**
   * Create a new breach indicator
   */
  async createBreachIndicator(indicator: Omit<BreachIndicator, 'id' | 'createdAt' | 'updatedAt'>): Promise<BreachIndicator> {
    const [result] = await db
      .insert(breachIndicators)
      .values({
        ...indicator,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();

    return result;
  }

  /**
   * Link an indicator to a breach
   */
  async linkIndicatorToBreach(
    breachId: number, 
    indicatorId: number, 
    confidence: number = 50,
    createdBy?: number
  ): Promise<BreachIndicatorLink> {
    // Check if link already exists
    const [existingLink] = await db
      .select()
      .from(breachIndicatorLinks)
      .where(
        and(
          eq(breachIndicatorLinks.breachId, breachId),
          eq(breachIndicatorLinks.indicatorId, indicatorId)
        )
      );
    
    if (existingLink) {
      // Update confidence if link exists
      const [updatedLink] = await db
        .update(breachIndicatorLinks)
        .set({ confidence })
        .where(eq(breachIndicatorLinks.id, existingLink.id))
        .returning();
      
      return updatedLink;
    }

    // Create new link
    const [result] = await db
      .insert(breachIndicatorLinks)
      .values({
        breachId,
        indicatorId,
        confidence,
        createdBy: createdBy || null,
        createdAt: new Date()
      })
      .returning();

    // Add breach event for the indicator link
    await this.addBreachEvent({
      breachId,
      eventType: 'indicator-linked',
      details: { 
        indicatorId,
        confidence
      },
      userId: createdBy || null,
      createdAt: new Date()
    });

    return result;
  }

  /**
   * Get indicators linked to a breach
   */
  async getBreachLinkedIndicators(breachId: number): Promise<{
    indicator: BreachIndicator;
    link: BreachIndicatorLink;
  }[]> {
    const result = await db
      .select({
        indicator: breachIndicators,
        link: breachIndicatorLinks
      })
      .from(breachIndicatorLinks)
      .innerJoin(breachIndicators, eq(breachIndicatorLinks.indicatorId, breachIndicators.id))
      .where(eq(breachIndicatorLinks.breachId, breachId))
      .orderBy(desc(breachIndicatorLinks.confidence));
    
    return result;
  }

  /**
   * Get breaches linked to an indicator
   */
  async getIndicatorLinkedBreaches(indicatorId: number): Promise<{
    breach: BreachDetection;
    link: BreachIndicatorLink;
  }[]> {
    const result = await db
      .select({
        breach: breachDetections,
        link: breachIndicatorLinks
      })
      .from(breachIndicatorLinks)
      .innerJoin(breachDetections, eq(breachIndicatorLinks.breachId, breachDetections.id))
      .where(eq(breachIndicatorLinks.indicatorId, indicatorId))
      .orderBy(desc(breachIndicatorLinks.confidence));
    
    return result;
  }

  /**
   * Remove indicator link from breach
   */
  async removeIndicatorFromBreach(breachId: number, indicatorId: number): Promise<boolean> {
    const [deletedLink] = await db
      .delete(breachIndicatorLinks)
      .where(
        and(
          eq(breachIndicatorLinks.breachId, breachId),
          eq(breachIndicatorLinks.indicatorId, indicatorId)
        )
      )
      .returning();
    
    return !!deletedLink;
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
    const falsePositiveCount = await this.getBreachCountByStatus('false-positive', workspaceId);

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

    return {
      total,
      open: openCount,
      investigating: investigatingCount,
      contained: containedCount,
      resolved: resolvedCount,
      falsePositive: falsePositiveCount,
      byStatus,
      bySeverity,
      byType
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

    return count;
  }
}

export const breachDetectionService = new BreachDetectionService();