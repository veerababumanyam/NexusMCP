/**
 * Domain Event Base Class
 * 
 * This abstract class implements the core DomainEvent concept for Event-Driven Architecture.
 * - Domain events represent something meaningful that happened in the domain
 * - They are immutable and represent past occurrences
 * - They carry data about what happened and when
 * 
 * References:
 * - Domain-Driven Design: Tackling Complexity in the Heart of Software (Eric Evans)
 * - Implementing Domain-Driven Design (Vaughn Vernon)
 */

import { randomUUID } from 'crypto';

export interface EventMetadata {
  userId?: number;
  correlationId?: string;
  causationId?: string;
  source: string;
  timestamp?: Date;
}

export abstract class DomainEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly timestamp: Date;
  readonly metadata: EventMetadata;
  
  constructor(eventType: string, metadata: EventMetadata) {
    this.eventId = randomUUID();
    this.eventType = eventType;
    this.timestamp = metadata.timestamp || new Date();
    this.metadata = {
      ...metadata,
      timestamp: this.timestamp
    };
  }
  
  /**
   * Get stringified representation of the event data
   * Implement in derived classes to include event-specific data
   */
  abstract serialize(): string;
}