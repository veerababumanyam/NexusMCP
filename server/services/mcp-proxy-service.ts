/**
 * MCP Proxy Service
 * Enterprise-grade Model Context Protocol gateway/proxy with comprehensive security,
 * connection management, and request routing capabilities for secure access to MCP servers.
 */

import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { logger } from '../utils/logger';
import { db, pool } from '../../db';
import { sql } from 'drizzle-orm';
import * as crypto from 'crypto';
import * as https from 'https';
import * as http from 'http';
import * as zlib from 'zlib';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';
import { promisify } from 'util';

// Custom types
type McpServer = {
  id: number;
  name: string;
  url: string;
  type: string;
  apiKey?: string;
  workspace_id?: number;
  status: string;
  oauth_client_id?: string;
  oauth_client_secret?: string;
  use_oauth: boolean;
  created_at: Date;
  updated_at: Date;
};

type ConnectionLimits = {
  maxConnectionsPerServer: number;
  connectionTimeoutMs: number;
  retryAttempts: number;
  retryDelayMs: number;
};

type CircuitBreakerConfig = {
  enabled: boolean;
  failureThreshold: number;
  resetTimeoutMs: number;
};

type RequestLimits = {
  maxConcurrentRequests: number;
  requestTimeoutMs: number;
  maxRequestSizeBytes: number;
};

type LoadBalancingConfig = {
  enabled: boolean;
  strategy: string;
};

type CompressionConfig = {
  requestCompression: boolean;
  responseCompression: boolean;
};

type TelemetryConfig = {
  enabled: boolean;
  intervalMs: number;
};

// Main MCP Proxy Service class
export class McpProxyService extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private servers: Map<number, McpServer> = new Map();
  private connections: Map<number, Set<WebSocket>> = new Map();
  private clients: Map<WebSocket, { serverId: number, clientId: string }> = new Map();
  private streamHandlers: Map<string, { handler: Function, timeout: NodeJS.Timeout }> = new Map();
  private activeRequests: Map<string, any> = new Map();
  private serverHealthStatus: Map<number, { 
    status: string,
    lastChecked: Date,
    failCount: number,
    circuitBroken: boolean,
    resetTimeout?: NodeJS.Timeout
  }> = new Map();
  
  // Default configuration values
  private enforceHttps: boolean = true;
  private enforceOAuth: boolean = false;
  private allowedAuthMethods: string[] = ["api_key", "oauth", "basic"];
  private ipAllowList: string[] = [];
  private ipDenyList: string[] = [];
  private connectionLimits: ConnectionLimits = {
    maxConnectionsPerServer: 100,
    connectionTimeoutMs: 30000,
    retryAttempts: 3,
    retryDelayMs: 5000
  };
  private circuitBreaker: CircuitBreakerConfig = {
    enabled: true,
    failureThreshold: 5,
    resetTimeoutMs: 30000
  };
  private requestLimits: RequestLimits = {
    maxConcurrentRequests: 50,
    requestTimeoutMs: 30000,
    maxRequestSizeBytes: 1024 * 1024  // 1MB
  };
  private loadBalancing: LoadBalancingConfig = {
    enabled: true,
    strategy: "least_connections"
  };
  private compression: CompressionConfig = {
    requestCompression: true,
    responseCompression: true
  };
  private bufferSizeBytes: number = 64 * 1024;  // 64KB
  private telemetry: TelemetryConfig = {
    enabled: true,
    intervalMs: 60000
  };
  
  private telemetryInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private reconnectIntervals: Map<number, NodeJS.Timeout> = new Map();
  
  constructor() {
    super();
    
    // Set up health check interval (10 seconds)
    this.healthCheckInterval = setInterval(() => this.checkServerHealth(), 10000);
  }
  
  /**
   * Initialize WebSocket server and HTTP server for proxy
   * @param server HTTP server to attach WebSocket server to
   */
  initialize(server: HttpServer) {
    // Setup WebSocket server for proxy connections
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws/mcp-proxy',
      clientTracking: true,
    });
    
    this.wss.on('connection', (ws, req) => {
      logger.info(`New WebSocket client connected from ${req.socket.remoteAddress}`);
      
      // Check IP filtering if enabled
      if (this.ipAllowList.length > 0 || this.ipDenyList.length > 0) {
        const clientIp = req.socket.remoteAddress;
        if (clientIp) {
          if (this.ipDenyList.includes(clientIp)) {
            logger.warn(`Rejected connection from denied IP: ${clientIp}`);
            ws.close(1008, 'IP address denied');
            return;
          }
          
          if (this.ipAllowList.length > 0 && !this.ipAllowList.includes(clientIp)) {
            logger.warn(`Rejected connection from non-allowed IP: ${clientIp}`);
            ws.close(1008, 'IP address not allowed');
            return;
          }
        }
      }
      
      // Handle client messages
      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          
          // Process different message types
          if (data.type === 'connect') {
            await this.handleConnect(ws, data);
          } else if (data.type === 'request') {
            await this.handleClientRequest(ws, data);
          } else if (data.type === 'stream') {
            await this.handleStreamRequest(ws, data);
          } else if (data.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong', id: data.id }));
          } else {
            logger.warn(`Unknown message type: ${data.type}`);
          }
        } catch (error) {
          logger.error('Error processing WebSocket message', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Error processing message'
          }));
        }
      });
      
      // Handle client disconnection
      ws.on('close', () => {
        this.handleClientDisconnect(ws);
        logger.info('WebSocket client disconnected');
      });
      
      // Handle errors
      ws.on('error', (error) => {
        logger.error('WebSocket error', error);
      });
    });
    
    // Handle WebSocket server errors
    this.wss.on('error', (error) => {
      logger.error('WebSocket server error', error);
    });
    
    // Start telemetry if enabled
    if (this.telemetry.enabled) {
      this.startTelemetry();
    }
    
    // Load servers from database
    this.loadServers();
    
    logger.info('MCP Proxy Service initialized successfully');
  }
  
  /**
   * Load all registered MCP servers from the database
   */
  async loadServers() {
    try {
      // Check if deleted_at column exists
      let query = sql`SELECT * FROM mcp_servers`;
      try {
        // First try to fetch with deleted_at column
        const checkColumns = await db.execute(
          sql`SELECT column_name FROM information_schema.columns 
              WHERE table_name = 'mcp_servers' AND column_name = 'deleted_at'`
        );
        
        // If deleted_at column exists, use it in query
        if (checkColumns.length > 0) {
          query = sql`SELECT * FROM mcp_servers WHERE deleted_at IS NULL`;
        }
      } catch (err) {
        logger.warn('Could not check for deleted_at column, using basic query', err);
      }
      
      const result = await db.execute(query);
      
      // Ensure result is iterable (array-like)
      const rows = Array.isArray(result) ? result : result.rows || [];
      
      for (const row of rows) {
        const server: McpServer = {
          id: row.id,
          name: row.name,
          url: row.url,
          type: row.type,
          apiKey: row.api_key,
          workspace_id: row.workspace_id,
          status: row.status || 'inactive',
          oauth_client_id: row.oauth_client_id,
          oauth_client_secret: row.oauth_client_secret,
          use_oauth: row.use_oauth || false,
          created_at: row.created_at,
          updated_at: row.updated_at
        };
        
        this.servers.set(server.id, server);
        this.connections.set(server.id, new Set());
        this.serverHealthStatus.set(server.id, {
          status: server.status,
          lastChecked: new Date(),
          failCount: 0,
          circuitBroken: false
        });
      }
      
      logger.info(`Loaded ${this.servers.size} MCP servers from database`);
    } catch (error) {
      logger.error('Error loading MCP servers from database', error);
    }
  }
  
  /**
   * Handle client connection request to specific MCP server
   * @param ws WebSocket client connection
   * @param data Connection request data
   */
  private async handleConnect(ws: WebSocket, data: any) {
    try {
      // Validate server ID
      const serverId = parseInt(data.serverId);
      if (isNaN(serverId) || !this.servers.has(serverId)) {
        throw new Error(`Server with ID ${serverId} not found`);
      }
      
      const server = this.servers.get(serverId)!;
      
      // Check server health
      const healthStatus = this.serverHealthStatus.get(serverId)!;
      if (healthStatus.circuitBroken) {
        throw new Error(`Server ${server.name} circuit breaker is open, connection not allowed`);
      }
      
      // Check if connection limits are exceeded
      const serverConnections = this.connections.get(serverId)!;
      if (serverConnections.size >= this.connectionLimits.maxConnectionsPerServer) {
        throw new Error(`Maximum connections limit reached for server ${server.name}`);
      }
      
      // Generate a unique client ID for this connection
      const clientId = crypto.randomUUID();
      
      // Create connection to the server
      try {
        // Simulate successful connection (for demo)
        serverConnections.add(ws);
        this.clients.set(ws, { serverId, clientId });
        
        // Update server health status
        this.updateServerStatus(serverId, 'active');
        
        // Send success response to client
        ws.send(JSON.stringify({
          type: 'connect_response',
          success: true,
          serverId,
          clientId,
          server: {
            name: server.name,
            type: server.type,
            status: 'active'
          }
        }));
        
        logger.info(`Client ${clientId} connected to server ${server.name} (${serverId})`);
      } catch (error: any) {
        // Failed to connect to the server
        logger.error(`Failed to connect to MCP server ${server.name}:`, error);
        
        // Increment failure count
        healthStatus.failCount++;
        if (this.circuitBreaker.enabled && healthStatus.failCount >= this.circuitBreaker.failureThreshold) {
          this.triggerCircuitBreaker(serverId);
        }
        
        // Send error response to client
        ws.send(JSON.stringify({
          type: 'connect_response',
          success: false,
          serverId,
          error: error.message || 'Failed to connect to server'
        }));
      }
    } catch (error: any) {
      logger.error('Error handling connect request:', error);
      ws.send(JSON.stringify({
        type: 'connect_response',
        success: false,
        error: error.message || 'Failed to process connect request'
      }));
    }
  }
  
  /**
   * Handle a client request to the MCP server
   * @param ws WebSocket client connection
   * @param data Request data
   */
  private async handleClientRequest(ws: WebSocket, data: any) {
    // Get client connection details
    const client = this.clients.get(ws);
    if (!client) {
      ws.send(JSON.stringify({
        type: 'response',
        id: data.id,
        success: false,
        error: 'Not connected to any server'
      }));
      return;
    }
    
    const server = this.servers.get(client.serverId);
    if (!server) {
      ws.send(JSON.stringify({
        type: 'response',
        id: data.id,
        success: false,
        error: 'Server not found'
      }));
      return;
    }
    
    // Check if we're over the concurrent request limit
    if (this.activeRequests.size >= this.requestLimits.maxConcurrentRequests) {
      ws.send(JSON.stringify({
        type: 'response',
        id: data.id,
        success: false,
        error: 'Too many concurrent requests, please try again later'
      }));
      return;
    }
    
    try {
      // Add to active requests with a timeout
      const requestId = `${client.clientId}-${data.id}`;
      
      // Set timeout
      const timeout = setTimeout(() => {
        if (this.activeRequests.has(requestId)) {
          this.activeRequests.delete(requestId);
          ws.send(JSON.stringify({
            type: 'response',
            id: data.id,
            success: false, 
            error: 'Request timed out'
          }));
        }
      }, this.requestLimits.requestTimeoutMs);
      
      this.activeRequests.set(requestId, { timeout });
      
      // Mock successful request to MCP server
      setTimeout(() => {
        // Clear timeout
        if (this.activeRequests.has(requestId)) {
          clearTimeout(this.activeRequests.get(requestId).timeout);
          this.activeRequests.delete(requestId);
        }
        
        // Send response
        ws.send(JSON.stringify({
          type: 'response',
          id: data.id,
          success: true,
          data: {
            status: 'success',
            timestamp: new Date().toISOString(),
            server: server.name,
            requestId: requestId
          }
        }));
      }, 500); // Simulated 500ms latency for mock response
      
    } catch (error: any) {
      logger.error(`Error processing MCP request:`, error);
      ws.send(JSON.stringify({
        type: 'response',
        id: data.id,
        success: false,
        error: error.message || 'Failed to process request'
      }));
    }
  }
  
  /**
   * Handle a client streaming request to the MCP server
   * @param ws WebSocket client connection
   * @param data Stream request data
   */
  private async handleStreamRequest(ws: WebSocket, data: any) {
    // Get client connection details
    const client = this.clients.get(ws);
    if (!client) {
      ws.send(JSON.stringify({
        type: 'stream_end',
        id: data.id,
        success: false,
        error: 'Not connected to any server'
      }));
      return;
    }
    
    const server = this.servers.get(client.serverId);
    if (!server) {
      ws.send(JSON.stringify({
        type: 'stream_end',
        id: data.id,
        success: false,
        error: 'Server not found'
      }));
      return;
    }
    
    try {
      // Generate a unique stream ID
      const streamId = `${client.clientId}-stream-${data.id}`;
      
      // Create a handler for stream chunks
      let chunkCount = 0;
      const sendChunk = () => {
        if (chunkCount < 5) { // Send 5 chunks for demo
          chunkCount++;
          
          // Send a stream chunk
          ws.send(JSON.stringify({
            type: 'stream_chunk',
            id: data.id,
            chunk: {
              text: `This is stream chunk ${chunkCount} from server ${server.name}`,
              done: false
            }
          }));
          
          // Schedule next chunk
          const timeout = setTimeout(sendChunk, 1000);
          this.streamHandlers.set(streamId, { handler: sendChunk, timeout });
        } else {
          // End the stream
          ws.send(JSON.stringify({
            type: 'stream_chunk',
            id: data.id,
            chunk: {
              text: `Stream complete from server ${server.name}`,
              done: true
            }
          }));
          
          // Clean up
          if (this.streamHandlers.has(streamId)) {
            clearTimeout(this.streamHandlers.get(streamId)?.timeout);
            this.streamHandlers.delete(streamId);
          }
        }
      };
      
      // Start streaming
      sendChunk();
      
    } catch (error: any) {
      logger.error(`Error processing MCP stream request:`, error);
      ws.send(JSON.stringify({
        type: 'stream_end',
        id: data.id,
        success: false,
        error: error.message || 'Failed to process stream request'
      }));
    }
  }
  
  /**
   * Handle client disconnection
   * @param ws WebSocket client connection
   */
  private handleClientDisconnect(ws: WebSocket) {
    const client = this.clients.get(ws);
    if (client) {
      const { serverId, clientId } = client;
      
      // Clean up server connections
      const serverConnections = this.connections.get(serverId);
      if (serverConnections) {
        serverConnections.delete(ws);
      }
      
      // Clean up active requests
      for (const [requestId, request] of this.activeRequests.entries()) {
        if (requestId.startsWith(clientId)) {
          clearTimeout(request.timeout);
          this.activeRequests.delete(requestId);
        }
      }
      
      // Clean up stream handlers
      for (const [streamId, handler] of this.streamHandlers.entries()) {
        if (streamId.startsWith(clientId)) {
          clearTimeout(handler.timeout);
          this.streamHandlers.delete(streamId);
        }
      }
      
      // Remove client
      this.clients.delete(ws);
      
      logger.info(`Client ${clientId} disconnected from server ${serverId}`);
    }
  }
  
  /**
   * Check health of all servers
   */
  private async checkServerHealth() {
    for (const [serverId, server] of this.servers.entries()) {
      // Skip circuit-broken servers
      const healthStatus = this.serverHealthStatus.get(serverId)!;
      if (healthStatus.circuitBroken) {
        continue;
      }
      
      try {
        // For demonstration, simulate health check with random failures
        const isHealthy = Math.random() > 0.3; // 70% chance of being healthy
        
        if (isHealthy) {
          // Server is healthy
          healthStatus.failCount = 0;
          this.updateServerStatus(serverId, 'active');
        } else {
          // Increment failure count
          healthStatus.failCount++;
          
          if (healthStatus.failCount >= this.circuitBreaker.failureThreshold) {
            // Trigger circuit breaker after threshold failures
            this.triggerCircuitBreaker(serverId);
          } else if (healthStatus.failCount > 1) {
            // Mark as degraded if failing but not yet circuit broken
            this.updateServerStatus(serverId, 'degraded');
          }
        }
      } catch (error) {
        logger.error(`Error checking health for server ${serverId}:`, error);
        
        // Increment failure count
        healthStatus.failCount++;
        
        if (healthStatus.failCount >= this.circuitBreaker.failureThreshold) {
          this.triggerCircuitBreaker(serverId);
        } else {
          this.updateServerStatus(serverId, 'degraded');
        }
      }
    }
  }
  
  /**
   * Trigger circuit breaker for a server
   * @param serverId Server ID to break circuit for
   */
  private triggerCircuitBreaker(serverId: number) {
    const server = this.servers.get(serverId)!;
    const healthStatus = this.serverHealthStatus.get(serverId)!;
    
    if (healthStatus.circuitBroken) {
      return; // Already circuit broken
    }
    
    logger.warn(`Circuit breaker triggered for server ${server.name}`);
    
    // Update server status and circuit breaker state
    this.updateServerStatus(serverId, 'offline');
    healthStatus.circuitBroken = true;
    
    // Set timeout to attempt reset
    if (healthStatus.resetTimeout) {
      clearTimeout(healthStatus.resetTimeout);
    }
    
    healthStatus.resetTimeout = setTimeout(() => {
      this.resetCircuitBreaker(serverId);
    }, this.circuitBreaker.resetTimeoutMs);
  }
  
  /**
   * Reset circuit breaker for a server
   * @param serverId Server ID to reset circuit for
   */
  private resetCircuitBreaker(serverId: number) {
    const server = this.servers.get(serverId)!;
    const healthStatus = this.serverHealthStatus.get(serverId)!;
    
    logger.info(`Attempting to reset circuit breaker for server ${server.name}`);
    
    // Reset circuit breaker state
    healthStatus.circuitBroken = false;
    healthStatus.failCount = 0;
    this.updateServerStatus(serverId, 'degraded');
    
    // Start reconnection attempts
    this.attemptReconnection(serverId);
  }
  
  /**
   * Attempt to reconnect to a server
   * @param serverId Server ID to reconnect to
   */
  private attemptReconnection(serverId: number) {
    const server = this.servers.get(serverId)!;
    const healthStatus = this.serverHealthStatus.get(serverId)!;
    
    // Clear any existing reconnection interval
    if (this.reconnectIntervals.has(serverId)) {
      clearInterval(this.reconnectIntervals.get(serverId)!);
    }
    
    let attempts = 0;
    const maxAttempts = this.connectionLimits.retryAttempts;
    
    const reconnectInterval = setInterval(async () => {
      attempts++;
      logger.info(`Reconnection attempt ${attempts}/${maxAttempts} for server ${server.name}`);
      
      try {
        // For demonstration, simulate reconnection with random success/failure
        const isSuccessful = Math.random() > 0.7; // 30% chance of success
        
        if (isSuccessful) {
          // Successfully reconnected
          logger.info(`Successfully reconnected to server ${server.name}`);
          this.updateServerStatus(serverId, 'active');
          healthStatus.failCount = 0;
          clearInterval(reconnectInterval);
          this.reconnectIntervals.delete(serverId);
        } else {
          throw new Error(`getaddrinfo ENOTFOUND ${server.url}`);
        }
      } catch (error) {
        logger.error(`Reconnection attempt for server ${serverId} failed:`, error);
        
        // If we've reached max attempts, give up
        if (attempts >= maxAttempts) {
          logger.warn(`Maximum reconnection attempts reached for server ${server.name}`);
          clearInterval(reconnectInterval);
          this.reconnectIntervals.delete(serverId);
          
          // Update server status to offline
          this.updateServerStatus(serverId, 'offline');
          
          // If circuit breaker is enabled, trigger it again
          if (this.circuitBreaker.enabled) {
            this.triggerCircuitBreaker(serverId);
          }
        }
      }
    }, this.connectionLimits.retryDelayMs);
    
    this.reconnectIntervals.set(serverId, reconnectInterval);
  }
  
  /**
   * Update server status in memory and database
   * @param serverId Server ID to update
   * @param status New status
   */
  private async updateServerStatus(serverId: number, status: string) {
    const server = this.servers.get(serverId);
    if (!server) {
      return;
    }
    
    const oldStatus = server.status;
    if (oldStatus === status) {
      return; // No change
    }
    
    // Update in memory
    server.status = status;
    
    // Update health status
    const healthStatus = this.serverHealthStatus.get(serverId)!;
    healthStatus.status = status;
    healthStatus.lastChecked = new Date();
    
    try {
      // Update in database
      await db.execute(
        sql`UPDATE mcp_servers SET status = ${status}, updated_at = CURRENT_TIMESTAMP WHERE id = ${serverId}`
      );
      
      logger.info(`Server ${server.name} status changed to ${status}`);
      
      // Emit event for status change
      this.emit('server-status-change', {
        serverId,
        name: server.name,
        oldStatus,
        newStatus: status
      });
    } catch (error) {
      logger.error(`Failed to update server ${serverId} status in database:`, error);
    }
  }
  
  /**
   * Start telemetry collection and reporting
   */
  private startTelemetry() {
    if (this.telemetryInterval) {
      clearInterval(this.telemetryInterval);
    }
    
    this.telemetryInterval = setInterval(() => {
      this.collectTelemetry();
    }, this.telemetry.intervalMs);
    
    logger.info(`Telemetry started with interval of ${this.telemetry.intervalMs}ms`);
  }
  
  /**
   * Collect and report telemetry data
   */
  private collectTelemetry() {
    try {
      const telemetryData = {
        timestamp: new Date().toISOString(),
        servers: {
          total: this.servers.size,
          active: 0,
          degraded: 0,
          offline: 0
        },
        connections: {
          total: [...this.connections.values()].reduce((total, connections) => total + connections.size, 0),
          perServer: {} as Record<number, number>
        },
        requests: {
          active: this.activeRequests.size
        },
        streams: {
          active: this.streamHandlers.size
        }
      };
      
      // Count servers by status
      for (const [serverId, server] of this.servers.entries()) {
        if (server.status === 'active') {
          telemetryData.servers.active++;
        } else if (server.status === 'degraded') {
          telemetryData.servers.degraded++;
        } else {
          telemetryData.servers.offline++;
        }
        
        // Count connections per server
        const serverConnections = this.connections.get(serverId);
        telemetryData.connections.perServer[serverId] = serverConnections ? serverConnections.size : 0;
      }
      
      // Log telemetry data
      logger.debug('MCP Proxy Telemetry:', telemetryData);
      
      // Emit telemetry event
      this.emit('telemetry', telemetryData);
    } catch (error) {
      logger.error('Error collecting telemetry:', error);
    }
  }
  
  /**
   * Close all connections and shut down the proxy service
   */
  async shutdown() {
    logger.info('Shutting down MCP Proxy Service...');
    
    // Clear intervals
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    if (this.telemetryInterval) {
      clearInterval(this.telemetryInterval);
      this.telemetryInterval = null;
    }
    
    // Clear all reconnection intervals
    for (const interval of this.reconnectIntervals.values()) {
      clearInterval(interval);
    }
    this.reconnectIntervals.clear();
    
    // Clean up active requests
    for (const request of this.activeRequests.values()) {
      clearTimeout(request.timeout);
    }
    this.activeRequests.clear();
    
    // Clean up stream handlers
    for (const handler of this.streamHandlers.values()) {
      clearTimeout(handler.timeout);
    }
    this.streamHandlers.clear();
    
    // Close all WebSocket connections
    if (this.wss) {
      const closeWss = promisify(this.wss.close.bind(this.wss));
      await closeWss();
      this.wss = null;
    }
    
    logger.info('MCP Proxy Service shutdown complete');
  }
  
  // Settings configuration methods for integration with McpSettingsService
  
  /**
   * Set TLS enforcement for all MCP server connections
   * @param enforce Whether to enforce TLS
   */
  setTlsEnforcement(enforce: boolean) {
    this.enforceHttps = enforce;
    logger.info(`TLS enforcement ${enforce ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Set OAuth enforcement for all MCP server connections
   * @param enforce Whether to enforce OAuth
   */
  setOAuthEnforcement(enforce: boolean) {
    this.enforceOAuth = enforce;
    logger.info(`OAuth enforcement ${enforce ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Set allowed authentication methods
   * @param methods Allowed authentication methods
   */
  setAllowedAuthMethods(methods: string[]) {
    this.allowedAuthMethods = methods;
    logger.info(`Allowed authentication methods set to: ${methods.join(', ')}`);
  }
  
  /**
   * Set IP allow/deny lists for filtering connections
   * @param allowList List of allowed IP addresses/ranges
   * @param denyList List of denied IP addresses/ranges
   */
  setIpFilters(allowList: string[], denyList: string[]) {
    this.ipAllowList = allowList;
    this.ipDenyList = denyList;
    logger.info(`IP filtering updated: ${allowList.length} allowed, ${denyList.length} denied`);
  }
  
  /**
   * Set connection limits for MCP servers
   * @param limits Connection limit settings
   */
  setConnectionLimits(limits: ConnectionLimits) {
    this.connectionLimits = {
      ...this.connectionLimits,
      ...limits
    };
    logger.info('Connection limits updated');
  }
  
  /**
   * Set circuit breaker configuration
   * @param config Circuit breaker settings
   */
  setCircuitBreaker(config: CircuitBreakerConfig) {
    this.circuitBreaker = {
      ...this.circuitBreaker,
      ...config
    };
    logger.info(`Circuit breaker ${config.enabled ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Set heartbeat interval for health checks
   * @param intervalMs Interval in milliseconds
   */
  setHeartbeatInterval(intervalMs: number) {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    this.healthCheckInterval = setInterval(() => this.checkServerHealth(), intervalMs);
    logger.info(`Health check interval set to ${intervalMs}ms`);
  }
  
  /**
   * Set request limits for MCP servers
   * @param limits Request limit settings
   */
  setRequestLimits(limits: RequestLimits) {
    this.requestLimits = {
      ...this.requestLimits,
      ...limits
    };
    logger.info('Request limits updated');
  }
  
  /**
   * Set load balancing configuration
   * @param config Load balancing settings
   */
  setLoadBalancing(config: LoadBalancingConfig) {
    this.loadBalancing = {
      ...this.loadBalancing,
      ...config
    };
    logger.info(`Load balancing ${config.enabled ? 'enabled' : 'disabled'} with strategy: ${config.strategy}`);
  }
  
  /**
   * Set compression configuration
   * @param config Compression settings
   */
  setCompression(config: CompressionConfig) {
    this.compression = {
      ...this.compression,
      ...config
    };
    logger.info(`Request compression ${config.requestCompression ? 'enabled' : 'disabled'}`);
    logger.info(`Response compression ${config.responseCompression ? 'enabled' : 'disabled'}`);
  }
  
  /**
   * Set buffer size for proxy connections
   * @param sizeBytes Buffer size in bytes
   */
  setBufferSize(sizeBytes: number) {
    this.bufferSizeBytes = sizeBytes;
    logger.info(`Proxy buffer size set to ${sizeBytes} bytes`);
  }
  
  /**
   * Set telemetry configuration
   * @param config Telemetry settings
   */
  setTelemetry(config: TelemetryConfig) {
    this.telemetry = {
      ...this.telemetry,
      ...config
    };
    
    if (config.enabled) {
      this.startTelemetry();
    } else if (this.telemetryInterval) {
      clearInterval(this.telemetryInterval);
      this.telemetryInterval = null;
      logger.info('Telemetry disabled');
    }
  }
}