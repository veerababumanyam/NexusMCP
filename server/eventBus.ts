/**
 * Enterprise Event Bus Implementation
 * 
 * Centralized event dispatcher for system-wide events with:
 * - Typed event registration and subscription
 * - Async event handling
 * - Support for local and distributed event propagation
 * - Event filtering and routing
 * - Observability and monitoring
 */

import EventEmitter from 'events';

// Define common event types
export type EventType = 
  // System events
  | 'system.startup'
  | 'system.shutdown'
  | 'system.config.changed'
  
  // Authentication events
  | 'auth.login'
  | 'auth.logout'
  | 'auth.mfa.required'
  | 'auth.password.changed'
  | 'auth.failed'
  
  // User and permission events
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'role.assigned'
  | 'role.revoked'
  | 'permission.granted'
  | 'permission.revoked'
  
  // Workspace events
  | 'workspace.created'
  | 'workspace.updated'
  | 'workspace.deleted'
  | 'workspace.member.added'
  | 'workspace.member.removed'
  | 'workspace.member.role.changed'
  
  // MCP server events
  | 'mcp.server.registered'
  | 'mcp.server.updated'
  | 'mcp.server.removed'
  | 'mcp.server.status.changed'
  | 'mcp.tool.discovered'
  | 'mcp.tool.updated'
  | 'mcp.tool.deprecated'
  
  // Agent events
  | 'agent.registered'
  | 'agent.updated'
  | 'agent.deregistered'
  | 'agent.execution.started'
  | 'agent.execution.completed'
  | 'agent.execution.failed'
  | 'agent.a2a.message'
  
  // Session events
  | 'session.started'
  | 'session.ended'
  | 'session.interaction.logged'
  
  // Workflow events
  | 'workflow.template.created'
  | 'workflow.template.updated'
  | 'workflow.template.deployed'
  | 'workflow.template.deleted'
  | 'workflow.instance.created'
  | 'workflow.instance.completed'
  | 'workflow.instance.failed'
  | 'workflow.node.execution.started'
  | 'workflow.node.execution.completed'
  | 'workflow.node.execution.failed'
  
  // Compliance events
  | 'compliance.violation'
  | 'compliance.report.generated'
  | 'compliance.scan.completed'
  
  // Security events
  | 'security.breach'
  | 'security.suspicious.activity'
  
  // Policy events
  | 'policy.created'
  | 'policy.updated'
  | 'policy.deleted'
  | 'policy.violation'
  | 'policy.enforced'
  
  // Collaboration events
  | 'annotation.created'
  | 'annotation.updated'
  | 'annotation.deleted'
  | 'reply.created'
  | 'reply.updated'
  | 'reply.deleted'
  | 'mention.created'
  
  // WebSocket events
  | 'ws.client.connected'
  | 'ws.client.disconnected' 
  | 'ws.client.error'
  | 'ws.server.error'
  | 'ws.message.received'
  | 'ws.message.sent'
  | 'ws.rate.limit.exceeded'
  
  // System monitoring events
  | 'system.resource.threshold'
  | 'system.error';

interface EventOptions {
  // Control flags
  propagate?: boolean;   // Whether to propagate to other nodes in a cluster
  sync?: boolean;        // Whether to handle synchronously
  priority?: number;     // Event priority (1-10, 10 being highest)
  
  // Metadata
  sourceNode?: string;   // Node ID where event originated
  correlationId?: string; // For tracking related events
  userId?: number;       // User who triggered the event
  workspaceId?: number;  // Associated workspace
}

// Event context including event data and metadata
export interface EventContext<T = any> {
  eventType: EventType;
  data: T;
  timestamp: Date;
  options?: EventOptions;
}

// Event handler function type
export type EventHandler<T = any> = (event: EventContext<T>) => void | Promise<void>;

/**
 * Event Bus implementation with typed events
 */
class EventBus {
  private emitter: EventEmitter;
  private handlers: Map<EventType, EventHandler[]>;
  private nodeId: string;
  
  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100); // Allow many listeners
    this.handlers = new Map();
    this.nodeId = this.generateNodeId();
    
    console.log('Event Bus initialized');
  }
  
  /**
   * Generate a unique node ID
   */
  private generateNodeId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }
  
  /**
   * Subscribe to an event
   */
  public on<T = any>(eventType: EventType, handler: EventHandler<T>): void {
    // Add to handlers map
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler as EventHandler);
    
    // Subscribe to emitter
    this.emitter.on(eventType, async (eventContext: EventContext<T>) => {
      try {
        await handler(eventContext);
      } catch (error) {
        console.error(`Error in event handler for ${eventType}:`, error);
        // Re-emit as system error
        this.emit('system.error', { 
          message: `Error handling event ${eventType}`, 
          originalEvent: eventType,
          error 
        });
      }
    });
    
    console.log(`Subscribed to event: ${eventType}`);
  }
  
  /**
   * Emit an event
   */
  public emit<T = any>(eventType: EventType, data: T, options?: EventOptions): void {
    const eventContext: EventContext<T> = {
      eventType,
      data,
      timestamp: new Date(),
      options: {
        ...options,
        sourceNode: this.nodeId
      }
    };
    
    this.emitter.emit(eventType, eventContext);
  }
  
  /**
   * Remove an event handler
   */
  public off(eventType: EventType, handler?: EventHandler): void {
    if (handler) {
      // Remove specific handler
      this.emitter.off(eventType, handler);
      
      // Update handlers map
      const handlers = this.handlers.get(eventType);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index !== -1) {
          handlers.splice(index, 1);
        }
      }
    } else {
      // Remove all handlers for this event type
      this.emitter.removeAllListeners(eventType);
      this.handlers.delete(eventType);
    }
  }
  
  /**
   * Get all registered event types
   */
  public getRegisteredEventTypes(): EventType[] {
    return Array.from(this.handlers.keys());
  }
  
  /**
   * Get count of handlers for an event type
   */
  public getHandlerCount(eventType: EventType): number {
    return this.handlers.get(eventType)?.length || 0;
  }
}

// Singleton instance
export const eventBus = new EventBus();