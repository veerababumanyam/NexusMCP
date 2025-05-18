/**
 * Base Entity Class for Domain-Driven Design
 * 
 * This abstract class implements the core Entity concept from DDD.
 * - Entities have identity that spans multiple state transformations
 * - Entities are the cornerstone of the domain model
 * - Entities encapsulate domain logic and are immutable from outside
 * 
 * References:
 * - Domain-Driven Design: Tackling Complexity in the Heart of Software (Eric Evans)
 * - Implementing Domain-Driven Design (Vaughn Vernon)
 */

import { randomUUID } from 'crypto';
import { DomainEvent } from '../events/DomainEvent';

export abstract class Entity<T> {
  protected _id: number | string;
  protected props: T;
  private _domainEvents: DomainEvent[] = [];
  
  constructor(props: T, id?: number | string) {
    this._id = id || randomUUID();
    this.props = props;
  }
  
  /**
   * Get entity ID
   */
  get id(): number | string {
    return this._id;
  }
  
  /**
   * Add a domain event to this entity's collection
   * @param domainEvent The event to register
   */
  protected addDomainEvent(domainEvent: DomainEvent): void {
    this._domainEvents.push(domainEvent);
  }
  
  /**
   * Clear all domain events from this entity
   */
  public clearEvents(): void {
    this._domainEvents = [];
  }
  
  /**
   * Get all domain events
   */
  public getDomainEvents(): DomainEvent[] {
    return [...this._domainEvents];
  }
  
  /**
   * Check if this entity equals another entity
   * Default implementation compares IDs
   */
  public equals(entity?: Entity<T>): boolean {
    if (entity === null || entity === undefined) {
      return false;
    }
    
    if (this === entity) {
      return true;
    }
    
    return this.id === entity.id;
  }
}