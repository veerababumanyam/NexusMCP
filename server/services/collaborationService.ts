/**
 * Collaboration Service
 * 
 * Handles operations related to real-time collaboration features
 * such as annotations, replies, and mentions.
 * Includes real-time annotation layer functionality.
 */

import { db } from '../../db';
import { eq, and, isNull, or } from 'drizzle-orm';
import * as schema from '../../shared/schema_collaboration';
import { z } from 'zod';
import { WebSocketServiceFactory, WebSocketServiceType } from './websocket/WebSocketServiceFactory';
import { eventBus } from '../eventBus';

export class CollaborationService {
  private wsFactory: WebSocketServiceFactory | null = null;
  
  /**
   * Set the WebSocket factory instance
   * This should be called during application initialization
   */
  setWebSocketFactory(factory: WebSocketServiceFactory): void {
    this.wsFactory = factory;
    console.log('WebSocket factory set in collaboration service');
    
    // Subscribe to relevant events
    this.subscribeToEvents();
  }
  
  /**
   * Subscribe to relevant events for real-time collaboration
   */
  private subscribeToEvents(): void {
    // Listen for annotation events
    eventBus.on('annotation.created', (event) => this.broadcastAnnotationEvent('annotation_created', event.data));
    eventBus.on('annotation.updated', (event) => this.broadcastAnnotationEvent('annotation_updated', event.data));
    eventBus.on('annotation.deleted', (event) => this.broadcastAnnotationEvent('annotation_deleted', event.data));
    
    // Listen for reply events
    eventBus.on('reply.created', (event) => this.broadcastAnnotationEvent('reply_created', event.data));
    eventBus.on('reply.updated', (event) => this.broadcastAnnotationEvent('reply_updated', event.data));
    eventBus.on('reply.deleted', (event) => this.broadcastAnnotationEvent('reply_deleted', event.data));
    
    // Listen for mention events
    eventBus.on('mention.created', (event) => this.broadcastAnnotationEvent('mention_created', event.data));
  }
  
  /**
   * Broadcast an annotation-related event to relevant clients
   */
  private broadcastAnnotationEvent(eventType: string, data: any): void {
    if (!this.wsFactory) {
      console.warn('WebSocket factory not set, unable to broadcast annotation event');
      return;
    }
    
    const collaborationService = this.wsFactory.getService(WebSocketServiceType.COLLABORATION);
    if (!collaborationService) {
      console.warn('Collaboration WebSocket service not available');
      return;
    }
    
    // Broadcast to relevant workspace or target
    let filterFn;
    
    if (data.workspaceId) {
      // If workspace-specific, send only to clients in that workspace
      filterFn = (client: any) => client.workspaceId === data.workspaceId;
    } else if (data.targetType && data.targetId) {
      // If target-specific, send to clients viewing that target
      filterFn = (client: any) => {
        const activeTargets = client.attributes?.get('activeTargets') || [];
        return activeTargets.some((target: any) => 
          target.type === data.targetType && target.id === data.targetId
        );
      };
    }
    
    // Prepare the message
    const message = {
      type: eventType,
      data,
      timestamp: new Date().toISOString()
    };
    
    // Broadcast the message with appropriate filtering
    if (filterFn) {
      collaborationService.broadcast(message, filterFn);
    } else {
      // If no specific target, broadcast to all authenticated clients
      collaborationService.broadcast(message, (client: any) => client.isAuthenticated);
    }
  }
  /**
   * Create a new annotation
   * 
   * @param data Annotation data to create
   * @param userId ID of the user creating the annotation
   * @returns The created annotation
   */
  async createAnnotation(data: Partial<schema.AnnotationInsert>, userId: number) {
    // Validate data
    const validatedData = schema.annotationsInsertSchema.parse({
      ...data,
      creatorId: userId
    });

    // Insert annotation
    const [annotation] = await db.insert(schema.annotations)
      .values(validatedData)
      .returning();
      
    // Emit event for real-time updates
    eventBus.emit('annotation.created', {
      userId,
      workspaceId: annotation.workspaceId,
      targetType: annotation.targetType,
      targetId: annotation.targetId,
      data: annotation
    });

    return annotation;
  }

  /**
   * Get annotations for a specific target
   * 
   * @param targetType The type of target (document, policy, agent, etc.)
   * @param targetId The ID of the target
   * @param userId The ID of the current user (for permission checks)
   * @param workspaceId Optional workspace ID to filter by
   * @returns Array of annotations
   */
  async getAnnotations(targetType: string, targetId: string, userId: number, workspaceId?: number) {
    // Query for annotations matching the target
    // Include only public annotations or those created by the current user
    let query = db.select()
      .from(schema.annotations)
      .where(
        and(
          eq(schema.annotations.targetType, targetType),
          eq(schema.annotations.targetId, targetId),
          or(
            eq(schema.annotations.isPrivate, false),
            eq(schema.annotations.creatorId, userId)
          )
        )
      );

    // Filter by workspace if provided
    if (workspaceId) {
      query = query.where(eq(schema.annotations.workspaceId, workspaceId));
    }

    const annotations = await query;
    return annotations;
  }

  /**
   * Get a single annotation by ID
   * 
   * @param id The annotation ID
   * @param userId The ID of the current user (for permission checks)
   * @returns The annotation if found and accessible
   */
  async getAnnotation(id: number, userId: number) {
    const annotation = await db.query.annotations.findFirst({
      where: and(
        eq(schema.annotations.id, id),
        or(
          eq(schema.annotations.isPrivate, false),
          eq(schema.annotations.creatorId, userId)
        )
      )
    });

    if (!annotation) {
      throw new Error('Annotation not found or not accessible');
    }

    return annotation;
  }

  /**
   * Update an annotation
   * 
   * @param id The annotation ID
   * @param data The data to update
   * @param userId The ID of the current user (for permission checks)
   * @returns The updated annotation
   */
  async updateAnnotation(id: number, data: Partial<schema.AnnotationInsert>, userId: number) {
    // First check if the annotation exists and user has permission
    const annotation = await db.query.annotations.findFirst({
      where: eq(schema.annotations.id, id)
    });

    if (!annotation) {
      throw new Error('Annotation not found');
    }

    if (annotation.creatorId !== userId) {
      throw new Error('Not authorized to update this annotation');
    }

    // Update the annotation
    const [updatedAnnotation] = await db.update(schema.annotations)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(schema.annotations.id, id))
      .returning();
      
    // Emit event for real-time updates
    eventBus.emit('annotation.updated', {
      userId,
      workspaceId: updatedAnnotation.workspaceId,
      targetType: updatedAnnotation.targetType,
      targetId: updatedAnnotation.targetId,
      data: updatedAnnotation
    });

    return updatedAnnotation;
  }

  /**
   * Delete an annotation
   * 
   * @param id The annotation ID
   * @param userId The ID of the current user (for permission checks)
   * @returns Success flag
   */
  async deleteAnnotation(id: number, userId: number) {
    // First check if the annotation exists and user has permission
    const annotation = await db.query.annotations.findFirst({
      where: eq(schema.annotations.id, id)
    });

    if (!annotation) {
      throw new Error('Annotation not found');
    }

    if (annotation.creatorId !== userId) {
      throw new Error('Not authorized to delete this annotation');
    }
    
    // Store annotation details before deletion for event emission
    const { workspaceId, targetType, targetId } = annotation;

    // Delete the annotation (replies will be cascade deleted)
    await db.delete(schema.annotations)
      .where(eq(schema.annotations.id, id));
      
    // Emit event for real-time updates
    eventBus.emit('annotation.deleted', {
      userId,
      workspaceId,
      targetType,
      targetId,
      data: { id, targetType, targetId }
    });

    return true;
  }

  /**
   * Add a reply to an annotation
   * 
   * @param annotationId The annotation ID
   * @param content The reply content
   * @param userId The ID of the user creating the reply
   * @returns The created reply
   */
  async addReply(annotationId: number, content: string, userId: number) {
    // Check if annotation exists and user has access
    const annotation = await this.getAnnotation(annotationId, userId);

    // Validate data
    const validatedData = schema.annotationRepliesInsertSchema.parse({
      annotationId,
      content,
      userId
    });

    // Insert reply
    const [reply] = await db.insert(schema.annotationReplies)
      .values(validatedData)
      .returning();
      
    // Emit event for real-time updates
    eventBus.emit('reply.created', {
      userId,
      workspaceId: annotation.workspaceId,
      targetType: annotation.targetType,
      targetId: annotation.targetId,
      annotationId,
      data: reply
    });

    return reply;
  }

  /**
   * Get replies for an annotation
   * 
   * @param annotationId The annotation ID
   * @returns Array of replies
   */
  async getReplies(annotationId: number) {
    const replies = await db.query.annotationReplies.findMany({
      where: eq(schema.annotationReplies.annotationId, annotationId),
      orderBy: (replies) => replies.createdAt
    });

    return replies;
  }

  /**
   * Update a reply
   * 
   * @param replyId The reply ID
   * @param content The new content
   * @param userId The ID of the current user (for permission checks)
   * @returns The updated reply
   */
  async updateReply(replyId: number, content: string, userId: number) {
    // First check if the reply exists and user has permission
    const reply = await db.query.annotationReplies.findFirst({
      where: eq(schema.annotationReplies.id, replyId)
    });

    if (!reply) {
      throw new Error('Reply not found');
    }

    if (reply.userId !== userId) {
      throw new Error('Not authorized to update this reply');
    }
    
    // Get annotation info for the event
    const annotation = await db.query.annotations.findFirst({
      where: eq(schema.annotations.id, reply.annotationId)
    });
    
    if (!annotation) {
      throw new Error('Parent annotation not found');
    }

    // Update the reply
    const [updatedReply] = await db.update(schema.annotationReplies)
      .set({
        content,
        updatedAt: new Date()
      })
      .where(eq(schema.annotationReplies.id, replyId))
      .returning();
      
    // Emit event for real-time updates
    eventBus.emit('reply.updated', {
      userId,
      workspaceId: annotation.workspaceId,
      targetType: annotation.targetType,
      targetId: annotation.targetId,
      annotationId: reply.annotationId,
      data: updatedReply
    });

    return updatedReply;
  }

  /**
   * Delete a reply
   * 
   * @param replyId The reply ID
   * @param userId The ID of the current user (for permission checks)
   * @returns Success flag
   */
  async deleteReply(replyId: number, userId: number) {
    // First check if the reply exists and user has permission
    const reply = await db.query.annotationReplies.findFirst({
      where: eq(schema.annotationReplies.id, replyId)
    });

    if (!reply) {
      throw new Error('Reply not found');
    }

    if (reply.userId !== userId) {
      throw new Error('Not authorized to delete this reply');
    }
    
    // Get annotation info for the event
    const annotation = await db.query.annotations.findFirst({
      where: eq(schema.annotations.id, reply.annotationId)
    });
    
    if (!annotation) {
      throw new Error('Parent annotation not found');
    }

    // Delete the reply
    await db.delete(schema.annotationReplies)
      .where(eq(schema.annotationReplies.id, replyId));
      
    // Emit event for real-time updates
    eventBus.emit('reply.deleted', {
      userId,
      workspaceId: annotation.workspaceId,
      targetType: annotation.targetType,
      targetId: annotation.targetId,
      annotationId: reply.annotationId,
      data: { id: replyId, annotationId: reply.annotationId }
    });

    return true;
  }

  /**
   * Add a mention to an annotation or reply
   * 
   * @param data Mention data (annotationId or replyId must be provided)
   * @returns The created mention
   */
  async addMention(data: schema.AnnotationMentionInsert) {
    // Validate data - either annotationId or replyId must be provided
    if (!data.annotationId && !data.replyId) {
      throw new Error('Either annotationId or replyId must be provided');
    }

    // Insert mention
    const [mention] = await db.insert(schema.annotationMentions)
      .values(data)
      .returning();
      
    // Get the associated annotation or reply for context
    let annotation = null;
    let targetType = null;
    let targetId = null;
    let workspaceId = null;
    
    if (data.annotationId) {
      annotation = await db.query.annotations.findFirst({
        where: eq(schema.annotations.id, data.annotationId)
      });
      if (annotation) {
        targetType = annotation.targetType;
        targetId = annotation.targetId;
        workspaceId = annotation.workspaceId;
      }
    } else if (data.replyId) {
      const reply = await db.query.annotationReplies.findFirst({
        where: eq(schema.annotationReplies.id, data.replyId)
      });
      
      if (reply) {
        annotation = await db.query.annotations.findFirst({
          where: eq(schema.annotations.id, reply.annotationId)
        });
        
        if (annotation) {
          targetType = annotation.targetType;
          targetId = annotation.targetId;
          workspaceId = annotation.workspaceId;
        }
      }
    }
    
    // Emit event for real-time updates if we have context
    if (targetType && targetId) {
      eventBus.emit('mention.created', {
        userId: data.mentionedBy,
        mentionedUserId: data.userId,
        workspaceId,
        targetType,
        targetId,
        annotationId: data.annotationId,
        replyId: data.replyId,
        data: mention
      });
    }

    return mention;
  }

  /**
   * Get mentions for a user
   * 
   * @param userId The user ID
   * @returns Array of mentions with associated annotations/replies
   */
  async getUserMentions(userId: number) {
    const mentions = await db.query.annotationMentions.findMany({
      where: eq(schema.annotationMentions.userId, userId),
      with: {
        annotation: true,
        reply: true
      }
    });

    return mentions;
  }
}

export const collaborationService = new CollaborationService();