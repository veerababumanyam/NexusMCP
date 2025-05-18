/**
 * Base Service - Application Layer
 * 
 * Provides common functionality for all application services
 * - Logging
 * - Error handling
 * - Event publishing
 */

import { eventBus } from '../../infrastructure/events/EventBus';
import { SecurityContext } from '../../infrastructure/security/ZeroTrustConfig';

export abstract class BaseService {
  /**
   * Publish domain event with standard metadata
   */
  protected async publishEvent<T = any>(
    eventType: string,
    payload: T,
    securityContext?: SecurityContext
  ): Promise<string> {
    return eventBus.publish(
      eventType,
      payload,
      {
        userId: securityContext?.userId,
        correlationId: securityContext?.requestId,
        source: this.constructor.name
      }
    );
  }
  
  /**
   * Log service activity with standardized format
   */
  protected logActivity(
    action: string,
    details: Record<string, any>,
    securityContext?: SecurityContext,
    level: 'info' | 'warn' | 'error' = 'info'
  ): void {
    const logData = {
      timestamp: new Date().toISOString(),
      service: this.constructor.name,
      action,
      user: securityContext?.userId,
      ip: securityContext?.ipAddress,
      requestId: securityContext?.requestId,
      ...details
    };
    
    // In production, would use a proper logging system
    switch (level) {
      case 'warn':
        console.warn(JSON.stringify(logData));
        break;
      case 'error':
        console.error(JSON.stringify(logData));
        break;
      default:
        console.log(JSON.stringify(logData));
    }
  }
  
  /**
   * Handle errors in a consistent way
   */
  protected handleError(error: unknown, securityContext?: SecurityContext): never {
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Unknown error occurred';
      
    const errorDetails = {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      context: securityContext ? {
        userId: securityContext.userId,
        requestId: securityContext.requestId,
        ipAddress: securityContext.ipAddress
      } : undefined
    };
    
    this.logActivity('error_occurred', errorDetails, securityContext, 'error');
    
    // Publish error event for monitoring
    this.publishEvent('error.service', errorDetails, securityContext)
      .catch(e => console.error('Failed to publish error event:', e));
    
    throw error instanceof Error ? error : new Error(errorMessage);
  }
}