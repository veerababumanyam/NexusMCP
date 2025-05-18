/**
 * Connection Pool Service
 * 
 * Manages a pool of MCP server connections with advanced load balancing,
 * health monitoring, and circuit breaker functionality for enterprise-grade reliability.
 */

import { EventEmitter } from 'events';
import { WebSocket } from 'ws';
import { circuitBreakerService, CircuitBreaker, CircuitState } from './circuitBreakerService';
import { rateLimitService, RateLimitType, RateLimitStrategy } from './rateLimitService';
import { db } from '../../db';
import { mcpServers } from '@shared/schema';
import { eq } from 'drizzle-orm';

export enum LoadBalancingStrategy {
  ROUND_ROBIN = 'round-robin',
  LEAST_CONNECTIONS = 'least-connections',
  LEAST_FAILURES = 'least-failures',
  WEIGHTED_ROUND_ROBIN = 'weighted-round-robin',
  RANDOM = 'random',
  CONSISTENT_HASH = 'consistent-hash'
}

export enum HealthCheckStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy'
}

export interface ConnectionPoolConfig {
  loadBalancingStrategy: LoadBalancingStrategy;
  healthCheckIntervalMs: number;
  healthCheckTimeoutMs: number;
  failureThreshold: number;
  recoveryThreshold: number;
  maxConnectionsPerServer: number;
  connectionTimeoutMs: number;
  enableCircuitBreaker: boolean;
  retryBackoffMs: number;
  maxRetries: number;
}

export interface ServerPoolItem {
  id: number;
  name: string;
  url: string;
  weight: number;
  isActive: boolean;
  maxConnections: number;
  currentConnections: number;
  healthCheckStatus: HealthCheckStatus;
  lastHealthCheckTime: Date | null;
  failureCount: number;
  successCount: number;
  totalRequests: number;
  averageResponseTimeMs: number;
  tags: string[];
  circuitBreaker: CircuitBreaker;
  lastError: string | null;
  connectionHistory: {
    timestamp: Date;
    status: 'connected' | 'disconnected';
    error?: string;
  }[];
}

const DEFAULT_POOL_CONFIG: ConnectionPoolConfig = {
  loadBalancingStrategy: LoadBalancingStrategy.ROUND_ROBIN,
  healthCheckIntervalMs: 30000, // 30 seconds
  healthCheckTimeoutMs: 5000, // 5 seconds
  failureThreshold: 3,
  recoveryThreshold: 2,
  maxConnectionsPerServer: 5,
  connectionTimeoutMs: 10000, // 10 seconds
  enableCircuitBreaker: true,
  retryBackoffMs: 1000, // 1 second
  maxRetries: 3
};

class ConnectionPoolService extends EventEmitter {
  private readonly servers: Map<number, ServerPoolItem> = new Map();
  private config: ConnectionPoolConfig = { ...DEFAULT_POOL_CONFIG };
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private roundRobinCounter = 0;
  private isInitialized = false;

  constructor() {
    super();
    // Set up custom events
    this.on('serverAdded', (serverId: number) => {
      console.log(`Server ${serverId} added to connection pool`);
    });
    this.on('serverRemoved', (serverId: number) => {
      console.log(`Server ${serverId} removed from connection pool`);
    });
    this.on('serverStatusChanged', (serverId: number, status: HealthCheckStatus) => {
      console.log(`Server ${serverId} status changed to ${status}`);
    });
    this.on('connectionLimitReached', (serverId: number) => {
      console.log(`Connection limit reached for server ${serverId}`);
    });
  }

  /**
   * Initialize the connection pool service
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Load configuration from database or environment
    await this.loadConfiguration();
    
    // Load server pool from database
    await this.loadServers();
    
    // Start health check monitoring
    this.startHealthChecks();
    
    this.isInitialized = true;
    console.log('ConnectionPoolService initialized with', this.servers.size, 'servers');
  }

  /**
   * Load connection pool configuration
   */
  private async loadConfiguration(): Promise<void> {
    // TODO: Load from database or config file
    // For now, use defaults
    this.config = { ...DEFAULT_POOL_CONFIG };
  }

  /**
   * Load servers from database into the pool
   */
  private async loadServers(): Promise<void> {
    try {
      const dbServers = await db.query.mcpServers.findMany();
      
      for (const server of dbServers) {
        this.addServer(server.id, {
          name: server.name,
          url: server.url,
          weight: server.weight || 1,
          isActive: server.isActive ?? true
        });
      }
    } catch (error) {
      console.error('Failed to load servers from database:', error);
    }
  }

  /**
   * Add a server to the connection pool
   */
  public addServer(
    id: number, 
    options: { 
      name: string, 
      url: string, 
      weight?: number, 
      isActive?: boolean,
      maxConnections?: number 
    }
  ): ServerPoolItem {
    const circuitBreaker = circuitBreakerService.getBreaker(`server-${id}`, {
      failureThreshold: this.config.failureThreshold,
      resetTimeout: this.config.healthCheckIntervalMs,
      halfOpenSuccessThreshold: this.config.recoveryThreshold
    });

    const server: ServerPoolItem = {
      id,
      name: options.name,
      url: options.url,
      weight: options.weight || 1,
      isActive: options.isActive !== false,
      maxConnections: options.maxConnections || this.config.maxConnectionsPerServer,
      currentConnections: 0,
      healthCheckStatus: HealthCheckStatus.HEALTHY,
      lastHealthCheckTime: null,
      failureCount: 0,
      successCount: 0,
      totalRequests: 0,
      averageResponseTimeMs: 0,
      tags: [],
      circuitBreaker,
      lastError: null,
      connectionHistory: []
    };

    this.servers.set(id, server);
    this.emit('serverAdded', id);

    return server;
  }

  /**
   * Remove a server from the pool
   */
  public removeServer(id: number): boolean {
    const success = this.servers.delete(id);
    if (success) {
      this.emit('serverRemoved', id);
    }
    return success;
  }

  /**
   * Get a server from the pool
   */
  public getServer(id: number): ServerPoolItem | undefined {
    return this.servers.get(id);
  }

  /**
   * Get all servers in the pool
   */
  public getAllServers(): ServerPoolItem[] {
    return Array.from(this.servers.values());
  }

  /**
   * Get summary statistics for the connection pool
   */
  public getPoolStats(): {
    totalServers: number;
    activeServers: number;
    healthyServers: number;
    totalConnections: number;
    averageResponseTime: number;
    strategyUsed: LoadBalancingStrategy;
  } {
    const servers = this.getAllServers();
    const activeServers = servers.filter(s => s.isActive);
    const healthyServers = servers.filter(s => 
      s.isActive && s.healthCheckStatus === HealthCheckStatus.HEALTHY
    );
    
    const totalConnections = servers.reduce((sum, s) => sum + s.currentConnections, 0);
    
    // Calculate average response time across all servers
    const totalResponseTime = servers.reduce((sum, s) => {
      return sum + (s.averageResponseTimeMs * s.totalRequests);
    }, 0);
    const totalRequests = servers.reduce((sum, s) => sum + s.totalRequests, 0);
    const averageResponseTime = totalRequests > 0 
      ? totalResponseTime / totalRequests 
      : 0;
    
    return {
      totalServers: servers.length,
      activeServers: activeServers.length,
      healthyServers: healthyServers.length,
      totalConnections,
      averageResponseTime,
      strategyUsed: this.config.loadBalancingStrategy
    };
  }

  /**
   * Get the current connection pool configuration
   */
  public getConfiguration(): ConnectionPoolConfig {
    return { ...this.config };
  }

  /**
   * Update the connection pool configuration
   */
  public async updateConfiguration(config: Partial<ConnectionPoolConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    
    // Restart health checks with new interval if it changed
    if (this.healthCheckInterval && config.healthCheckIntervalMs) {
      this.stopHealthChecks();
      this.startHealthChecks();
    }

    // TODO: Persist configuration changes

    // Update circuit breakers if thresholds changed
    if (config.failureThreshold || config.recoveryThreshold) {
      this.servers.forEach(server => {
        // Only update if the values changed
        if (
          (config.failureThreshold && config.failureThreshold !== server.circuitBreaker.getOptions().failureThreshold) ||
          (config.recoveryThreshold && config.recoveryThreshold !== server.circuitBreaker.getOptions().halfOpenSuccessThreshold)
        ) {
          circuitBreakerService.getBreaker(`server-${server.id}`, {
            failureThreshold: this.config.failureThreshold,
            resetTimeout: this.config.healthCheckIntervalMs,
            halfOpenSuccessThreshold: this.config.recoveryThreshold
          });
        }
      });
    }
  }

  /**
   * Set the load balancing strategy
   */
  public setLoadBalancingStrategy(strategy: LoadBalancingStrategy): void {
    this.config.loadBalancingStrategy = strategy;
    console.log(`Load balancing strategy set to ${strategy}`);
  }

  /**
   * Get a server based on the current load balancing strategy
   */
  public getNextServer(): ServerPoolItem | null {
    const availableServers = this.getAllServers().filter(server => 
      server.isActive && 
      server.healthCheckStatus !== HealthCheckStatus.UNHEALTHY &&
      server.currentConnections < server.maxConnections &&
      server.circuitBreaker.getState() !== CircuitState.OPEN
    );
    
    if (availableServers.length === 0) {
      return null;
    }
    
    // If only one server, return it
    if (availableServers.length === 1) {
      return availableServers[0];
    }
    
    // Select based on strategy
    switch (this.config.loadBalancingStrategy) {
      case LoadBalancingStrategy.ROUND_ROBIN:
        return this.getRoundRobinServer(availableServers);
        
      case LoadBalancingStrategy.LEAST_CONNECTIONS:
        return this.getLeastConnectionsServer(availableServers);
        
      case LoadBalancingStrategy.LEAST_FAILURES:
        return this.getLeastFailuresServer(availableServers);
        
      case LoadBalancingStrategy.WEIGHTED_ROUND_ROBIN:
        return this.getWeightedRoundRobinServer(availableServers);
        
      case LoadBalancingStrategy.RANDOM:
        return this.getRandomServer(availableServers);
        
      default:
        // Default to round robin
        return this.getRoundRobinServer(availableServers);
    }
  }

  /**
   * Round-robin server selection
   */
  private getRoundRobinServer(servers: ServerPoolItem[]): ServerPoolItem {
    this.roundRobinCounter = (this.roundRobinCounter + 1) % servers.length;
    return servers[this.roundRobinCounter];
  }

  /**
   * Least connections server selection
   */
  private getLeastConnectionsServer(servers: ServerPoolItem[]): ServerPoolItem {
    return servers.reduce((min, server) => 
      server.currentConnections < min.currentConnections ? server : min, 
      servers[0]
    );
  }

  /**
   * Least failures server selection
   */
  private getLeastFailuresServer(servers: ServerPoolItem[]): ServerPoolItem {
    return servers.reduce((min, server) => 
      server.failureCount < min.failureCount ? server : min, 
      servers[0]
    );
  }

  /**
   * Weighted round-robin server selection
   */
  private getWeightedRoundRobinServer(servers: ServerPoolItem[]): ServerPoolItem {
    // Create a list with each server appearing according to its weight
    const weightedList: ServerPoolItem[] = [];
    servers.forEach(server => {
      for (let i = 0; i < server.weight; i++) {
        weightedList.push(server);
      }
    });
    
    // Use round-robin on the weighted list
    this.roundRobinCounter = (this.roundRobinCounter + 1) % weightedList.length;
    return weightedList[this.roundRobinCounter];
  }

  /**
   * Random server selection
   */
  private getRandomServer(servers: ServerPoolItem[]): ServerPoolItem {
    const randomIndex = Math.floor(Math.random() * servers.length);
    return servers[randomIndex];
  }

  /**
   * Start periodic health checks for all servers
   */
  private startHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.healthCheckInterval = setInterval(() => {
      this.checkAllServersHealth();
    }, this.config.healthCheckIntervalMs);
    
    // Run an initial health check
    this.checkAllServersHealth();
  }

  /**
   * Stop health checks
   */
  private stopHealthChecks(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Check health of all servers in the pool
   */
  private async checkAllServersHealth(): Promise<void> {
    const servers = this.getAllServers();
    const checkPromises = servers.map(server => this.checkServerHealth(server.id));
    
    try {
      await Promise.all(checkPromises);
    } catch (error) {
      console.error('Error during health checks:', error);
    }
  }

  /**
   * Check health of a specific server
   */
  public async checkServerHealth(serverId: number): Promise<HealthCheckStatus> {
    const server = this.servers.get(serverId);
    if (!server || !server.isActive) {
      return HealthCheckStatus.UNHEALTHY;
    }
    
    try {
      // Track start time for response time calculation
      const startTime = Date.now();
      
      // Set timeout for health check
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Health check timeout')), this.config.healthCheckTimeoutMs);
      });
      
      // Perform actual health check
      const checkPromise = this.performHealthCheck(server);
      
      // Race the health check against the timeout
      await Promise.race([checkPromise, timeoutPromise]);
      
      // Calculate response time
      const responseTime = Date.now() - startTime;
      
      // Update server stats with success
      this.updateServerStats(server, {
        successCount: server.successCount + 1,
        failureCount: 0, // Reset failures after success
        lastHealthCheckTime: new Date(),
        healthCheckStatus: HealthCheckStatus.HEALTHY,
        averageResponseTimeMs: this.calculateAverageResponseTime(server, responseTime),
        lastError: null
      });

      // If circuit breaker is in half-open state, close it after successful health check
      if (server.circuitBreaker.getState() === CircuitState.HALF_OPEN) {
        server.circuitBreaker.close();
      }
      
      return HealthCheckStatus.HEALTHY;
    } catch (error) {
      // Update server stats with failure
      this.updateServerStats(server, {
        failureCount: server.failureCount + 1,
        lastHealthCheckTime: new Date(),
        lastError: error instanceof Error ? error.message : String(error)
      });
      
      // Determine health status based on failure count
      let status: HealthCheckStatus;
      if (server.failureCount >= this.config.failureThreshold) {
        status = HealthCheckStatus.UNHEALTHY;
        // Open circuit breaker if enabled
        if (this.config.enableCircuitBreaker) {
          server.circuitBreaker.open();
        }
      } else if (server.failureCount > 0) {
        status = HealthCheckStatus.DEGRADED;
      } else {
        status = HealthCheckStatus.HEALTHY;
      }
      
      this.updateServerStats(server, { healthCheckStatus: status });
      
      return status;
    }
  }

  /**
   * Perform an actual health check on a server
   */
  private async performHealthCheck(server: ServerPoolItem): Promise<void> {
    // TODO: Implement actual health check logic
    // This could be a ping, a specific health endpoint check, etc.
    
    // For now, just simulate success/failure based on server ID for demo
    return new Promise((resolve, reject) => {
      // Simulate an occasional random failure (10% chance)
      const randomFailure = Math.random() < 0.1;
      
      if (randomFailure) {
        reject(new Error('Simulated health check failure'));
      } else {
        resolve();
      }
    });
  }

  /**
   * Calculate average response time with exponential moving average
   */
  private calculateAverageResponseTime(server: ServerPoolItem, newResponseTime: number): number {
    // Use exponential weighted moving average for smoother transitions
    const alpha = 0.2; // Smoothing factor
    
    if (server.totalRequests === 0) {
      return newResponseTime;
    }
    
    return (alpha * newResponseTime) + ((1 - alpha) * server.averageResponseTimeMs);
  }

  /**
   * Update a server's statistics
   */
  private updateServerStats(server: ServerPoolItem, updates: Partial<ServerPoolItem>): void {
    const oldStatus = server.healthCheckStatus;
    
    Object.assign(server, updates);
    
    // Emit event if health status changed
    if (updates.healthCheckStatus && updates.healthCheckStatus !== oldStatus) {
      this.emit('serverStatusChanged', server.id, updates.healthCheckStatus);
    }
  }

  /**
   * Increment connection count for a server
   */
  public incrementConnections(serverId: number): boolean {
    const server = this.servers.get(serverId);
    if (!server) return false;
    
    // Check if connection limit reached
    if (server.currentConnections >= server.maxConnections) {
      this.emit('connectionLimitReached', serverId);
      return false;
    }
    
    server.currentConnections++;
    return true;
  }

  /**
   * Decrement connection count for a server
   */
  public decrementConnections(serverId: number): void {
    const server = this.servers.get(serverId);
    if (!server) return;
    
    if (server.currentConnections > 0) {
      server.currentConnections--;
    }
  }

  /**
   * Track request success for a server
   */
  public trackRequestSuccess(serverId: number, responseTimeMs: number): void {
    const server = this.servers.get(serverId);
    if (!server) return;
    
    server.successCount++;
    server.totalRequests++;
    server.averageResponseTimeMs = this.calculateAverageResponseTime(server, responseTimeMs);
  }

  /**
   * Track request failure for a server
   */
  public trackRequestFailure(serverId: number, error: string): void {
    const server = this.servers.get(serverId);
    if (!server) return;
    
    server.failureCount++;
    server.totalRequests++;
    server.lastError = error;
    
    // Add to connection history
    server.connectionHistory.push({
      timestamp: new Date(),
      status: 'disconnected',
      error
    });
    
    // Limit history size
    if (server.connectionHistory.length > 100) {
      server.connectionHistory.shift();
    }
  }

  /**
   * Set server active state
   */
  public setServerActive(serverId: number, isActive: boolean): boolean {
    const server = this.servers.get(serverId);
    if (!server) return false;
    
    server.isActive = isActive;
    
    // If activating, reset failure count
    if (isActive) {
      server.failureCount = 0;
      this.checkServerHealth(serverId).catch(err => 
        console.error(`Error checking health for server ${serverId}:`, err)
      );
    }
    
    return true;
  }

  /**
   * Update server weight
   */
  public setServerWeight(serverId: number, weight: number): boolean {
    const server = this.servers.get(serverId);
    if (!server) return false;
    
    server.weight = Math.max(1, weight); // Weight must be at least 1
    return true;
  }

  /**
   * Manually attempt recovery for a server
   */
  public async attemptServerRecovery(serverId: number): Promise<boolean> {
    const server = this.servers.get(serverId);
    if (!server) return false;
    
    // Set to half-open state to allow test traffic
    server.circuitBreaker.halfOpen();
    
    // Check health
    const status = await this.checkServerHealth(serverId);
    
    // Return whether recovery was successful
    return status === HealthCheckStatus.HEALTHY;
  }

  /**
   * Shutdown the connection pool service
   */
  public shutdown(): void {
    this.stopHealthChecks();
    this.isInitialized = false;
    console.log('ConnectionPoolService shut down');
  }
}

export const connectionPoolService = new ConnectionPoolService();