/**
 * Circuit Breaker Service
 * 
 * Implements the circuit breaker pattern to isolate failing components
 * and prevent cascading failures across the system.
 * 
 * Features:
 * - Multiple circuit states (CLOSED, OPEN, HALF_OPEN)
 * - Configurable thresholds and timeouts
 * - Automatic recovery and testing
 * - Distributed circuit state with cluster support
 * - Event-based notification system
 */

import { EventEmitter } from 'events';
import { clusterService } from './clusterService';

// Circuit states
export enum CircuitState {
  CLOSED = 'closed',    // Normal operation, requests flow through
  OPEN = 'open',        // Circuit is open, fail-fast without calling service
  HALF_OPEN = 'half-open' // Testing if service is back online
}

// Circuit configuration
export interface CircuitBreakerOptions {
  failureThreshold: number;        // Number of failures before opening circuit
  resetTimeout: number;            // Time in ms to wait before trying half-open
  halfOpenSuccessThreshold: number; // Successes needed to close circuit
  timeout?: number;                // Timeout for requests in ms
  monitorInterval?: number;        // Frequency to check circuit state
  isFailure?: (error: any) => boolean; // Custom failure detection
}

// Circuit stats
export interface CircuitStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: Date | null;
  lastSuccess: Date | null;
  lastStateChange: Date;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rejectedRequests: number;
  averageResponseTime: number;
}

// Default circuit options
const DEFAULT_OPTIONS: CircuitBreakerOptions = {
  failureThreshold: 5,
  resetTimeout: 30000, // 30 seconds
  halfOpenSuccessThreshold: 2,
  timeout: 10000, // 10 seconds
  monitorInterval: 5000, // 5 seconds
};

class CircuitBreaker extends EventEmitter {
  private readonly name: string;
  private readonly options: CircuitBreakerOptions;
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailure: Date | null = null;
  private lastSuccess: Date | null = null;
  private lastStateChange: Date = new Date();
  private resetTimer: NodeJS.Timeout | null = null;
  private monitorTimer: NodeJS.Timeout | null = null;
  private totalRequests: number = 0;
  private successfulRequests: number = 0;
  private failedRequests: number = 0;
  private rejectedRequests: number = 0;
  private responseTimeSamples: number[] = [];
  private readonly maxSamples: number = 100;
  private readonly stateKey: string;

  constructor(name: string, options: Partial<CircuitBreakerOptions> = {}) {
    super();
    this.name = name;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.stateKey = `circuit:${this.name}`;
    
    if (this.options.monitorInterval) {
      this.startMonitoring();
    }
    
    // Try to get state from clustered nodes
    this.syncState();
  }

  /**
   * Execute a function with circuit breaker protection
   */
  public async exec<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;
    
    // Check if circuit is open
    if (this.state === CircuitState.OPEN) {
      this.rejectedRequests++;
      this.emit('rejected', { name: this.name, reason: 'Circuit is open' });
      throw new CircuitBreakerOpenError(`Circuit ${this.name} is open`);
    }
    
    // Use a half-open state to test the service with a single request
    const isHalfOpen = this.state === CircuitState.HALF_OPEN;
    
    try {
      // Apply timeout if configured
      const startTime = Date.now();
      
      let result: T;
      if (this.options.timeout) {
        result = await this.executeWithTimeout(fn);
      } else {
        result = await fn();
      }
      
      const responseTime = Date.now() - startTime;
      this.trackResponseTime(responseTime);
      
      // Success handling
      this.successes++;
      this.successfulRequests++;
      this.lastSuccess = new Date();
      
      // If in half-open state, check if we can close the circuit
      if (isHalfOpen && this.successes >= this.options.halfOpenSuccessThreshold) {
        this.close();
      }
      
      this.emit('success', { name: this.name, responseTime });
      return result;
    } catch (error) {
      // Determine if this error counts as a failure
      const isFailure = this.options.isFailure ? 
        this.options.isFailure(error) : true;
      
      if (isFailure) {
        this.failures++;
        this.failedRequests++;
        this.lastFailure = new Date();
        
        // If we hit the threshold, or this was a failed half-open request, open the circuit
        if (
          (this.state === CircuitState.CLOSED && this.failures >= this.options.failureThreshold) ||
          (isHalfOpen)
        ) {
          this.open();
        }
        
        this.emit('failure', { name: this.name, error });
      }
      
      throw error;
    }
  }

  /**
   * Force circuit to open state
   */
  public open(): void {
    if (this.state !== CircuitState.OPEN) {
      this.state = CircuitState.OPEN;
      this.lastStateChange = new Date();
      this.emit('open', { name: this.name, failures: this.failures });
      
      // Schedule automatic reset to half-open state
      this.scheduleReset();
      
      // Share state with cluster
      this.shareState();
    }
  }

  /**
   * Force circuit to closed state
   */
  public close(): void {
    if (this.state !== CircuitState.CLOSED) {
      this.state = CircuitState.CLOSED;
      this.lastStateChange = new Date();
      this.failures = 0;
      this.successes = 0;
      
      if (this.resetTimer) {
        clearTimeout(this.resetTimer);
        this.resetTimer = null;
      }
      
      this.emit('close', { name: this.name });
      
      // Share state with cluster
      this.shareState();
    }
  }

  /**
   * Set circuit to half-open state for testing service
   */
  public halfOpen(): void {
    if (this.state !== CircuitState.HALF_OPEN) {
      this.state = CircuitState.HALF_OPEN;
      this.lastStateChange = new Date();
      this.successes = 0;
      
      this.emit('half-open', { name: this.name });
      
      // Share state with cluster
      this.shareState();
    }
  }

  /**
   * Reset circuit breaker state
   */
  public reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.lastStateChange = new Date();
    
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
    
    this.emit('reset', { name: this.name });
    this.shareState();
  }

  /**
   * Get current circuit state
   */
  public getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit statistics
   */
  public getStats(): CircuitStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
      lastStateChange: this.lastStateChange,
      totalRequests: this.totalRequests,
      successfulRequests: this.successfulRequests,
      failedRequests: this.failedRequests,
      rejectedRequests: this.rejectedRequests,
      averageResponseTime: this.calculateAverageResponseTime()
    };
  }

  /**
   * Schedule reset to half-open state
   */
  private scheduleReset(): void {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
    }
    
    this.resetTimer = setTimeout(() => {
      if (this.state === CircuitState.OPEN) {
        this.halfOpen();
      }
    }, this.options.resetTimeout);
  }

  /**
   * Execute function with timeout
   */
  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    const timeout = this.options.timeout || DEFAULT_OPTIONS.timeout;
    
    return new Promise<T>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new CircuitBreakerTimeoutError(`Circuit ${this.name} timeout after ${timeout}ms`));
      }, timeout);
      
      fn()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(err => {
          clearTimeout(timeoutId);
          reject(err);
        });
    });
  }

  /**
   * Track response time for statistics
   */
  private trackResponseTime(responseTime: number): void {
    this.responseTimeSamples.push(responseTime);
    
    // Keep array limited
    if (this.responseTimeSamples.length > this.maxSamples) {
      this.responseTimeSamples.shift();
    }
  }

  /**
   * Calculate average response time
   */
  private calculateAverageResponseTime(): number {
    if (this.responseTimeSamples.length === 0) return 0;
    
    const sum = this.responseTimeSamples.reduce((acc, time) => acc + time, 0);
    return sum / this.responseTimeSamples.length;
  }

  /**
   * Start monitoring circuit state
   */
  private startMonitoring(): void {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
    }
    
    this.monitorTimer = setInterval(() => {
      try {
        // Check if we should auto-transition to half-open
        if (
          this.state === CircuitState.OPEN &&
          this.lastStateChange.getTime() + this.options.resetTimeout <= Date.now()
        ) {
          this.halfOpen();
        }
        
        // Emit status event for monitoring
        this.emit('status', this.getStats());
        
        // Sync state with cluster nodes
        this.syncState();
      } catch (error) {
        console.error(`Circuit ${this.name} monitor error:`, error);
      }
    }, this.options.monitorInterval);
  }

  /**
   * Stop monitoring
   */
  public stopMonitoring(): void {
    if (this.monitorTimer) {
      clearInterval(this.monitorTimer);
      this.monitorTimer = null;
    }
    
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  /**
   * Distribute circuit state to other nodes
   */
  private shareState(): void {
    try {
      const selfInfo = clusterService.getSelfInfo();
      
      // Store circuit state in metadata
      const metadata = {
        ...selfInfo.metadata,
        circuits: {
          ...(selfInfo.metadata.circuits || {}),
          [this.name]: {
            state: this.state,
            lastUpdated: new Date().toISOString()
          }
        }
      };
      
      // Update cluster metadata
      clusterService.updateMetadata(metadata).catch(err => {
        console.error(`Failed to share circuit state for ${this.name}:`, err);
      });
    } catch (error) {
      // Ignore if cluster isn't running
    }
  }

  /**
   * Sync state with other nodes in cluster
   */
  private syncState(): void {
    try {
      const nodes = clusterService.getNodes();
      
      // Find newest circuit info across all nodes
      let newestStateInfo: { state: CircuitState, lastUpdated: string } | null = null;
      
      for (const node of nodes) {
        const circuits = node.metadata?.circuits || {};
        const circuitInfo = circuits[this.name];
        
        if (circuitInfo && circuitInfo.state) {
          if (
            !newestStateInfo || 
            new Date(circuitInfo.lastUpdated) > new Date(newestStateInfo.lastUpdated)
          ) {
            newestStateInfo = circuitInfo;
          }
        }
      }
      
      // Update local state if newer found
      if (
        newestStateInfo && 
        newestStateInfo.state !== this.state &&
        new Date(newestStateInfo.lastUpdated) > this.lastStateChange
      ) {
        // Apply remote state
        const prevState = this.state;
        this.state = newestStateInfo.state;
        this.lastStateChange = new Date(newestStateInfo.lastUpdated);
        
        this.emit('state-sync', {
          name: this.name,
          from: prevState,
          to: this.state
        });
      }
    } catch (error) {
      // Ignore if cluster isn't running
    }
  }
}

// Custom error classes
export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

export class CircuitBreakerTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerTimeoutError';
  }
}

// Singleton service to manage multiple circuit breakers
class CircuitBreakerService {
  private breakers: Map<string, CircuitBreaker> = new Map();
  
  /**
   * Get or create circuit breaker
   */
  public getBreaker(name: string, options?: Partial<CircuitBreakerOptions>): CircuitBreaker {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, options));
    }
    
    return this.breakers.get(name) as CircuitBreaker;
  }
  
  /**
   * Get all circuit breakers
   */
  public getAllBreakers(): Map<string, CircuitBreaker> {
    return this.breakers;
  }
  
  /**
   * Get overall health status
   */
  public getHealth(): { healthy: boolean, circuits: Record<string, CircuitState> } {
    const circuits: Record<string, CircuitState> = {};
    let allHealthy = true;
    
    for (const [name, breaker] of this.breakers.entries()) {
      const state = breaker.getState();
      circuits[name] = state;
      
      if (state !== CircuitState.CLOSED) {
        allHealthy = false;
      }
    }
    
    return {
      healthy: allHealthy,
      circuits
    };
  }
  
  /**
   * Reset all circuit breakers
   */
  public resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
  
  /**
   * Shutdown all circuit breakers
   */
  public shutdown(): void {
    for (const breaker of this.breakers.values()) {
      breaker.stopMonitoring();
    }
    this.breakers.clear();
  }
}

// Export singleton instance
export const circuitBreakerService = new CircuitBreakerService();