import { EventEmitter } from 'events';
import { logger } from '../logging/Logger';

/**
 * Event bus for application-wide event handling
 * Allows components to communicate through events without direct coupling
 */
class EventBusService extends EventEmitter {
  constructor() {
    super();
    
    // Set higher event listener limit for enterprise scale
    this.setMaxListeners(50);
    logger.info('Event bus initialized');
  }

  /**
   * Emit an event with payload
   * @param event - Event name
   * @param payload - Event data
   */
  emit(event: string, payload?: any): boolean {
    logger.debug(`Event emitted: ${event}`, { event, metadata: payload });
    return super.emit(event, payload);
  }

  /**
   * Publish an event with payload (alias for emit for compatibility)
   * @param event - Event name
   * @param payload - Event data
   * @param metadata - Additional metadata
   */
  publish(event: string, payload?: any, metadata?: any): boolean {
    logger.debug(`Event published: ${event}`, { event, payload, metadata });
    return this.emit(event, { data: payload, metadata });
  }

  /**
   * Register an event listener
   * @param event - Event name
   * @param listener - Event handler function
   */
  on(event: string, listener: (...args: any[]) => void): this {
    logger.debug(`Event listener registered: ${event}`);
    return super.on(event, listener);
  }

  /**
   * Register a one-time event listener
   * @param event - Event name
   * @param listener - Event handler function
   */
  once(event: string, listener: (...args: any[]) => void): this {
    logger.debug(`One-time event listener registered: ${event}`);
    return super.once(event, listener);
  }

  /**
   * Remove an event listener
   * @param event - Event name
   * @param listener - Event handler function
   */
  off(event: string, listener: (...args: any[]) => void): this {
    logger.debug(`Event listener removed: ${event}`);
    return super.off(event, listener);
  }

  /**
   * Remove all listeners for an event
   * @param event - Event name (optional, if not provided removes all listeners)
   */
  removeAllListeners(event?: string): this {
    if (event) {
      logger.debug(`All listeners removed for event: ${event}`);
    } else {
      logger.debug('All event listeners removed');
    }
    return super.removeAllListeners(event);
  }
}

// Create singleton instance
export const eventBus = new EventBusService();