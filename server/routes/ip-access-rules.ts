import express, { Request, Response, NextFunction } from 'express';
import { db } from '../../db';
import { ipAccessRules, insertIpAccessRuleSchema } from '@shared/schema';
import { and, eq } from 'drizzle-orm';
import { createAuditLog } from '../services/auditLogService';

const router = express.Router();

/**
 * Get all IP access rules for a workspace
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const { workspaceId } = req.query;
    
    let query = db.select().from(ipAccessRules);
    
    if (workspaceId && typeof workspaceId === 'string') {
      query = query.where(eq(ipAccessRules.workspaceId, parseInt(workspaceId)));
    }
    
    const rules = await query;
    return res.status(200).json(rules);
  } catch (error) {
    console.error('Error fetching IP access rules:', error);
    return res.status(500).json({ error: 'Failed to fetch IP access rules' });
  }
});

/**
 * Get a specific IP access rule by ID
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const rule = await db.query.ipAccessRules.findFirst({
      where: eq(ipAccessRules.id, parseInt(id))
    });
    
    if (!rule) {
      return res.status(404).json({ error: 'IP access rule not found' });
    }
    
    return res.status(200).json(rule);
  } catch (error) {
    console.error('Error fetching IP access rule:', error);
    return res.status(500).json({ error: 'Failed to fetch IP access rule' });
  }
});

/**
 * Create a new IP access rule
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const validatedData = insertIpAccessRuleSchema.parse(req.body);
    
    // Add the current user as the creator
    const data = {
      ...validatedData,
      createdBy: req.user.id
    };
    
    const [newRule] = await db.insert(ipAccessRules).values(data).returning();
    
    // Create audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'create',
      resource: 'ip_access_rule',
      resourceId: newRule.id.toString(),
      details: {
        type: newRule.type,
        ipValue: newRule.ipValue,
        valueType: newRule.valueType
      }
    });
    
    return res.status(201).json(newRule);
  } catch (error) {
    console.error('Error creating IP access rule:', error);
    return res.status(500).json({ error: 'Failed to create IP access rule' });
  }
});

/**
 * Update an existing IP access rule
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    
    // Validate the data
    const validatedData = insertIpAccessRuleSchema.partial().parse(req.body);
    
    // Check if rule exists
    const existingRule = await db.query.ipAccessRules.findFirst({
      where: eq(ipAccessRules.id, parseInt(id))
    });
    
    if (!existingRule) {
      return res.status(404).json({ error: 'IP access rule not found' });
    }
    
    // Update the rule
    const [updatedRule] = await db
      .update(ipAccessRules)
      .set({
        ...validatedData,
        updatedAt: new Date()
      })
      .where(eq(ipAccessRules.id, parseInt(id)))
      .returning();
    
    // Create audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'update',
      resource: 'ip_access_rule',
      resourceId: updatedRule.id.toString(),
      details: {
        type: updatedRule.type,
        ipValue: updatedRule.ipValue,
        valueType: updatedRule.valueType,
        isActive: updatedRule.isActive
      }
    });
    
    return res.status(200).json(updatedRule);
  } catch (error) {
    console.error('Error updating IP access rule:', error);
    return res.status(500).json({ error: 'Failed to update IP access rule' });
  }
});

/**
 * Delete an IP access rule
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { id } = req.params;
    
    // Check if rule exists
    const existingRule = await db.query.ipAccessRules.findFirst({
      where: eq(ipAccessRules.id, parseInt(id))
    });
    
    if (!existingRule) {
      return res.status(404).json({ error: 'IP access rule not found' });
    }
    
    // Delete the rule
    await db
      .delete(ipAccessRules)
      .where(eq(ipAccessRules.id, parseInt(id)));
    
    // Create audit log
    await createAuditLog({
      userId: req.user.id,
      action: 'delete',
      resource: 'ip_access_rule',
      resourceId: id,
      details: {
        type: existingRule.type,
        ipValue: existingRule.ipValue,
        valueType: existingRule.valueType
      }
    });
    
    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting IP access rule:', error);
    return res.status(500).json({ error: 'Failed to delete IP access rule' });
  }
});

export default router;