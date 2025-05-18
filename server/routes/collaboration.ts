import { Router } from 'express';
import { collaborationService } from '../services/collaborationService';
import { rateLimitService } from '../services/rateLimitService';
import { z } from 'zod';
import { annotationsInsertSchema, annotationRepliesInsertSchema } from '../../shared/schema_collaboration';

const router = Router();

// Apply rate limits - using simpler rate limit options that match the express-rate-limit package
const apiRateLimit = rateLimitService.create('annotations-api', {
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: 'API rate limit exceeded, please try again later'
});

const createRateLimit = rateLimitService.create('annotations-create', {
  windowMs: 60 * 1000, // 1 minute
  max: 20, // 20 create operations per minute (more limited)
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Creation rate limit exceeded, please try again later'
});

/**
 * Create a new annotation
 * POST /api/annotations
 */
router.post('/annotations', createRateLimit, async (req, res) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = req.user.id;
    const annotation = await collaborationService.createAnnotation(req.body, userId);
    
    return res.status(201).json(annotation);
  } catch (error) {
    console.error('Error creating annotation:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid annotation data', details: error.errors });
    }
    return res.status(500).json({ error: 'Failed to create annotation' });
  }
});

/**
 * Get annotations for a target
 * GET /api/annotations?targetType=policy&targetId=123&workspaceId=456
 */
router.get('/annotations', apiRateLimit, async (req, res) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { targetType, targetId, workspaceId } = req.query;
    
    if (!targetType || !targetId) {
      return res.status(400).json({ error: 'targetType and targetId are required' });
    }
    
    const userId = req.user.id;
    const annotations = await collaborationService.getAnnotations(
      targetType as string,
      targetId as string,
      userId,
      workspaceId ? Number(workspaceId) : undefined
    );
    
    return res.json(annotations);
  } catch (error) {
    console.error('Error fetching annotations:', error);
    return res.status(500).json({ error: 'Failed to fetch annotations' });
  }
});

/**
 * Get a specific annotation
 * GET /api/annotations/:id
 */
router.get('/annotations/:id', apiRateLimit, async (req, res) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = req.user.id;
    const annotationId = parseInt(req.params.id);
    
    if (isNaN(annotationId)) {
      return res.status(400).json({ error: 'Invalid annotation ID' });
    }
    
    const annotation = await collaborationService.getAnnotation(annotationId, userId);
    
    return res.json(annotation);
  } catch (error) {
    console.error('Error fetching annotation:', error);
    if (error instanceof Error && error.message === 'Annotation not found or not accessible') {
      return res.status(404).json({ error: 'Annotation not found or not accessible' });
    }
    return res.status(500).json({ error: 'Failed to fetch annotation' });
  }
});

/**
 * Update an annotation
 * PUT /api/annotations/:id
 */
router.put('/annotations/:id', apiRateLimit, async (req, res) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = req.user.id;
    const annotationId = parseInt(req.params.id);
    
    if (isNaN(annotationId)) {
      return res.status(400).json({ error: 'Invalid annotation ID' });
    }
    
    // Filter out immutable properties
    const { id, creatorId, createdAt, ...updateData } = req.body;
    
    const annotation = await collaborationService.updateAnnotation(annotationId, updateData, userId);
    
    return res.json(annotation);
  } catch (error) {
    console.error('Error updating annotation:', error);
    if (error instanceof Error) {
      if (error.message === 'Annotation not found') {
        return res.status(404).json({ error: 'Annotation not found' });
      }
      if (error.message === 'Not authorized to update this annotation') {
        return res.status(403).json({ error: 'Not authorized to update this annotation' });
      }
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid annotation data', details: error.errors });
    }
    return res.status(500).json({ error: 'Failed to update annotation' });
  }
});

/**
 * Delete an annotation
 * DELETE /api/annotations/:id
 */
router.delete('/annotations/:id', apiRateLimit, async (req, res) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = req.user.id;
    const annotationId = parseInt(req.params.id);
    
    if (isNaN(annotationId)) {
      return res.status(400).json({ error: 'Invalid annotation ID' });
    }
    
    await collaborationService.deleteAnnotation(annotationId, userId);
    
    return res.status(204).end();
  } catch (error) {
    console.error('Error deleting annotation:', error);
    if (error instanceof Error) {
      if (error.message === 'Annotation not found') {
        return res.status(404).json({ error: 'Annotation not found' });
      }
      if (error.message === 'Not authorized to delete this annotation') {
        return res.status(403).json({ error: 'Not authorized to delete this annotation' });
      }
    }
    return res.status(500).json({ error: 'Failed to delete annotation' });
  }
});

/**
 * Add a reply to an annotation
 * POST /api/annotations/:id/replies
 */
router.post('/annotations/:id/replies', createRateLimit, async (req, res) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = req.user.id;
    const annotationId = parseInt(req.params.id);
    
    if (isNaN(annotationId)) {
      return res.status(400).json({ error: 'Invalid annotation ID' });
    }
    
    const { content } = req.body;
    
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    const reply = await collaborationService.addReply(annotationId, content, userId);
    
    return res.status(201).json(reply);
  } catch (error) {
    console.error('Error adding reply:', error);
    if (error instanceof Error && error.message === 'Annotation not found or not accessible') {
      return res.status(404).json({ error: 'Annotation not found or not accessible' });
    }
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid reply data', details: error.errors });
    }
    return res.status(500).json({ error: 'Failed to add reply' });
  }
});

/**
 * Get replies for an annotation
 * GET /api/annotations/:id/replies
 */
router.get('/annotations/:id/replies', apiRateLimit, async (req, res) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = req.user.id;
    const annotationId = parseInt(req.params.id);
    
    if (isNaN(annotationId)) {
      return res.status(400).json({ error: 'Invalid annotation ID' });
    }
    
    // Check if the user has access to the annotation
    await collaborationService.getAnnotation(annotationId, userId);
    
    const replies = await collaborationService.getReplies(annotationId);
    
    return res.json(replies);
  } catch (error) {
    console.error('Error fetching replies:', error);
    if (error instanceof Error && error.message === 'Annotation not found or not accessible') {
      return res.status(404).json({ error: 'Annotation not found or not accessible' });
    }
    return res.status(500).json({ error: 'Failed to fetch replies' });
  }
});

/**
 * Update a reply
 * PUT /api/replies/:id
 */
router.put('/replies/:id', apiRateLimit, async (req, res) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = req.user.id;
    const replyId = parseInt(req.params.id);
    
    if (isNaN(replyId)) {
      return res.status(400).json({ error: 'Invalid reply ID' });
    }
    
    const { content } = req.body;
    
    if (!content || typeof content !== 'string') {
      return res.status(400).json({ error: 'Content is required' });
    }
    
    const reply = await collaborationService.updateReply(replyId, content, userId);
    
    return res.json(reply);
  } catch (error) {
    console.error('Error updating reply:', error);
    if (error instanceof Error) {
      if (error.message === 'Reply not found') {
        return res.status(404).json({ error: 'Reply not found' });
      }
      if (error.message === 'Not authorized to update this reply') {
        return res.status(403).json({ error: 'Not authorized to update this reply' });
      }
    }
    return res.status(500).json({ error: 'Failed to update reply' });
  }
});

/**
 * Delete a reply
 * DELETE /api/replies/:id
 */
router.delete('/replies/:id', apiRateLimit, async (req, res) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = req.user.id;
    const replyId = parseInt(req.params.id);
    
    if (isNaN(replyId)) {
      return res.status(400).json({ error: 'Invalid reply ID' });
    }
    
    await collaborationService.deleteReply(replyId, userId);
    
    return res.status(204).end();
  } catch (error) {
    console.error('Error deleting reply:', error);
    if (error instanceof Error) {
      if (error.message === 'Reply not found') {
        return res.status(404).json({ error: 'Reply not found' });
      }
      if (error.message === 'Not authorized to delete this reply') {
        return res.status(403).json({ error: 'Not authorized to delete this reply' });
      }
    }
    return res.status(500).json({ error: 'Failed to delete reply' });
  }
});

/**
 * Get mentions for the current user
 * GET /api/mentions
 */
router.get('/mentions', apiRateLimit, async (req, res) => {
  try {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = req.user.id;
    const mentions = await collaborationService.getUserMentions(userId);
    
    return res.json(mentions);
  } catch (error) {
    console.error('Error fetching mentions:', error);
    return res.status(500).json({ error: 'Failed to fetch mentions' });
  }
});

export default router;