/**
 * Event Bus Service
 * 
 * A simple event bus implementation for handling application events.
 * Uses the Publish-Subscribe pattern to allow decoupled communication
 * between different parts of the application.
 */
export class EventBus {
  private static instance: EventBus;
  private subscribers: Map<string, Array<(data: any) => Promise<void>>> = new Map();
  
  private constructor() {
    // Private constructor to enforce singleton pattern
  }
  
  /**
   * Get the singleton instance of EventBus
   */
  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }
  
  /**
   * Subscribe to an event
   * @param eventName The name of the event to subscribe to
   * @param callback The function to call when the event is published
   */
  public subscribe(eventName: string, callback: (data: any) => Promise<void>): void {
    if (!this.subscribers.has(eventName)) {
      this.subscribers.set(eventName, []);
    }
    
    this.subscribers.get(eventName)!.push(callback);
    console.log(`Subscribed to event: ${eventName}`);
  }
  
  /**
   * Unsubscribe from an event
   * @param eventName The name of the event to unsubscribe from
   * @param callback The function to unsubscribe
   */
  public unsubscribe(eventName: string, callback: (data: any) => Promise<void>): void {
    if (!this.subscribers.has(eventName)) {
      return;
    }
    
    const callbacks = this.subscribers.get(eventName)!;
    const index = callbacks.indexOf(callback);
    
    if (index !== -1) {
      callbacks.splice(index, 1);
      console.log(`Unsubscribed from event: ${eventName}`);
    }
  }
  
  /**
   * Publish an event
   * @param eventName The name of the event to publish
   * @param data The data to pass to subscribers
   */
  public async publish(eventName: string, data: any): Promise<void> {
    if (!this.subscribers.has(eventName)) {
      return;
    }
    
    const callbacks = this.subscribers.get(eventName)!;
    console.log(`Publishing event: ${eventName} to ${callbacks.length} subscribers`);
    
    // Execute all callbacks in parallel and catch any errors
    await Promise.all(
      callbacks.map(async (callback) => {
        try {
          await callback(data);
        } catch (error) {
          console.error(`Error in event handler for ${eventName}:`, error);
        }
      })
    );
  }
  
  /**
   * Get all event names with active subscribers
   */
  public getEventNames(): string[] {
    return Array.from(this.subscribers.keys());
  }
  
  /**
   * Get subscriber count for a specific event
   * @param eventName The name of the event
   */
  public getSubscriberCount(eventName: string): number {
    if (!this.subscribers.has(eventName)) {
      return 0;
    }
    return this.subscribers.get(eventName)!.length;
  }
  
  /**
   * Reset all subscribers (primarily used for testing)
   */
  public reset(): void {
    this.subscribers.clear();
    console.log('Event bus reset');
  }
}