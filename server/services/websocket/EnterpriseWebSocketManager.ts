/**
 * Enterprise WebSocket Manager
 * 
 * A comprehensive WebSocket server implementation with:
 * - Type-safe message handling
 * - Connection pooling and management
 * - Authentication and authorization
 * - Heartbeat and health monitoring
 * - Secure message validation
 * - Rate limiting
 * - Metrics and telemetry
 * - Scoped message broadcasting
 */

import { WebSocketServer, WebSocket, ServerOptions } from 'ws';
import { Server as HttpServer, IncomingMessage } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { eventBus, EventType } from '../../eventBus';
import { createHash } from 'crypto';
import { URL } from 'url';

// Connection States
export enum ConnectionState {
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  CLOSING = 'CLOSING',
  CLOSED = 'CLOSED'
}

// Client information structure
export interface WebSocketClient {
  id: string;
  socket: WebSocket;
  userId: string | null;
  lastActivity: number;
  isAuthenticated: boolean;
  connectionState: ConnectionState;
  ipAddress: string;
  userAgent: string;
  connectionStartTime: number;
  pingCount: number;
  pongCount: number;
  messagesSent: number;
  messagesReceived: number;
  disconnectReason?: string;
  disconnectCode?: number;
  authTokenHash?: string;
  workspaceId?: number;
  scopes?: string[];
  tags: Map<string, string>;
  attributes: Map<string, any>;
}

// Configuration options
export interface WebSocketManagerConfig {
  // Server settings
  path: string;
  maxPayload: number;
  compression: boolean;
  
  // Authentication
  authRequired: boolean;
  anonymousConnectionsAllowed: boolean;
  validateAuthToken?: (token: string) => Promise<boolean>;
  
  // Security settings
  enableRateLimiting: boolean;
  maxConnectionsPerIp: number;
  maxMessagesPerMinute: number;
  
  // Timeouts and intervals
  connectionTimeout: number; // ms
  pingInterval: number; // ms
  pingTimeout: number; // ms
  clientCleanupInterval: number; // ms
  
  // Advanced settings
  maxBackpressureSize: number;
  serializeMessages: boolean;
}

// Default configuration
const DEFAULT_CONFIG: WebSocketManagerConfig = {
  path: '/ws',
  maxPayload: 64 * 1024, // 64KB
  compression: false,
  
  authRequired: false,
  anonymousConnectionsAllowed: true,
  
  enableRateLimiting: true,
  maxConnectionsPerIp: 20,
  maxMessagesPerMinute: 300,
  
  connectionTimeout: 30000, // 30 seconds
  pingInterval: 30000, // 30 seconds
  pingTimeout: 10000, // 10 seconds
  clientCleanupInterval: 60000, // 60 seconds
  
  maxBackpressureSize: 1024 * 1024, // 1MB
  serializeMessages: true
};

// Message interfaces
export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

// Message handler type
export type MessageHandler = (
  message: WebSocketMessage,
  client: WebSocketClient,
  manager: EnterpriseWebSocketManager
) => void | Promise<void>;

// Client filter type
export type ClientFilter = (client: WebSocketClient) => boolean;

/**
 * Enterprise WebSocket Manager
 */
export class EnterpriseWebSocketManager {
  private wss: WebSocketServer;
  private config: WebSocketManagerConfig;
  private clients: Map<string, WebSocketClient> = new Map();
  private messageHandlers: Map<string, MessageHandler[]> = new Map();
  private clientCleanupInterval: NodeJS.Timer | null = null;
  private ipConnectionCounts: Map<string, number> = new Map();
  private messageRateLimiter: Map<string, { count: number, resetTime: number }> = new Map();
  private closed: boolean = false;
  
  // Metrics
  private metrics = {
    totalConnectionsCreated: 0,
    totalConnectionsClosed: 0,
    authenticationFailures: 0,
    rateLimitExceeded: 0,
    messagesProcessed: 0,
    messagesDropped: 0,
    errors: 0
  };
  
  /**
   * Create a new WebSocket manager
   */
  constructor(
    httpServer: HttpServer,
    config: Partial<WebSocketManagerConfig> = {}
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Create the WebSocket server
    const wsOptions: ServerOptions = {
      server: httpServer,
      path: this.config.path,
      maxPayload: this.config.maxPayload,
      perMessageDeflate: this.config.compression,
      clientTracking: true,
      verifyClient: this.verifyClient.bind(this)
    };
    
    this.wss = new WebSocketServer(wsOptions);
    
    // Set up event handlers
    this.wss.on('connection', this.handleConnection.bind(this));
    this.wss.on('error', this.handleServerError.bind(this));
    
    // Start client cleanup interval
    this.startClientCleanup();
    
    console.log(`WebSocket server initialized at ${this.config.path}`);
  }
  
  /**
   * Add a message handler for a specific message type
   */
  public addMessageHandler(messageType: string, handler: MessageHandler): void {
    const handlers = this.messageHandlers.get(messageType) || [];
    handlers.push(handler);
    this.messageHandlers.set(messageType, handlers);
  }
  
  /**
   * Remove a message handler
   */
  public removeMessageHandler(messageType: string, handler: MessageHandler): boolean {
    const handlers = this.messageHandlers.get(messageType);
    if (!handlers) {
      return false;
    }
    
    const filteredHandlers = handlers.filter(h => h !== handler);
    this.messageHandlers.set(messageType, filteredHandlers);
    return handlers.length !== filteredHandlers.length;
  }
  
  /**
   * Send a message to a specific client
   */
  public sendToClient(clientId: string, message: WebSocketMessage): boolean {
    const client = this.clients.get(clientId);
    if (!client || client.socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    
    return this.sendMessage(client, message);
  }
  
  /**
   * Send a message to all clients
   */
  public broadcast(message: WebSocketMessage, filter?: ClientFilter): void {
    this.clients.forEach(client => {
      if (client.socket.readyState === WebSocket.OPEN) {
        if (!filter || filter(client)) {
          this.sendMessage(client, message);
        }
      }
    });
  }
  
  /**
   * Send a message to clients in a specific workspace
   */
  public broadcastToWorkspace(workspaceId: number, message: WebSocketMessage): void {
    this.broadcast(message, client => client.workspaceId === workspaceId);
  }
  
  /**
   * Send a message to clients with specific scopes
   */
  public broadcastToScope(scope: string, message: WebSocketMessage): void {
    this.broadcast(message, client => client.scopes?.includes(scope) ?? false);
  }
  
  /**
   * Send a message to authenticated clients
   */
  public broadcastToAuthenticated(message: WebSocketMessage): void {
    this.broadcast(message, client => client.isAuthenticated);
  }
  
  /**
   * Get client by ID
   */
  public getClient(clientId: string): WebSocketClient | undefined {
    return this.clients.get(clientId);
  }
  
  /**
   * Get all clients
   */
  public getAllClients(): WebSocketClient[] {
    return Array.from(this.clients.values());
  }
  
  /**
   * Get client count
   */
  public getClientCount(): number {
    return this.clients.size;
  }
  
  /**
   * Get metrics
   */
  public getMetrics(): typeof this.metrics & { currentConnections: number } {
    return {
      ...this.metrics,
      currentConnections: this.clients.size
    };
  }
  
  /**
   * Set client attribute
   */
  public setClientAttribute(clientId: string, key: string, value: any): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }
    
    client.attributes.set(key, value);
    return true;
  }
  
  /**
   * Set client tag
   */
  public setClientTag(clientId: string, key: string, value: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }
    
    client.tags.set(key, value);
    return true;
  }
  
  /**
   * Disconnect a client
   */
  public disconnectClient(clientId: string, code: number = 1000, reason: string = 'Server disconnected'): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      return false;
    }
    
    this.closeConnection(client, code, reason);
    return true;
  }
  
  /**
   * Shutdown the WebSocket server
   */
  public close(code: number = 1000, reason: string = 'Server shutting down'): Promise<void> {
    return new Promise((resolve) => {
      if (this.closed) {
        resolve();
        return;
      }
      
      this.closed = true;
      
      // Stop client cleanup
      if (this.clientCleanupInterval) {
        clearInterval(this.clientCleanupInterval);
        this.clientCleanupInterval = null;
      }
      
      // Disconnect all clients
      this.clients.forEach(client => {
        this.closeConnection(client, code, reason);
      });
      
      // Close the server
      this.wss.close(() => {
        console.log(`WebSocket server at ${this.config.path} closed`);
        resolve();
      });
    });
  }
  
  /**
   * Ping all clients to check if they're still connected
   */
  public pingAll(): void {
    console.log(`Pinging ${this.clients.size} clients`);
    this.clients.forEach(client => {
      if (client.socket.readyState === WebSocket.OPEN) {
        this.pingClient(client);
      }
    });
  }
  
  // Private methods
  
  /**
   * Verify client connection
   */
  private verifyClient(info: { origin: string; secure: boolean; req: IncomingMessage }): boolean | Promise<boolean> {
    const ip = this.getClientIp(info.req);
    
    // Check rate limiting
    if (this.config.enableRateLimiting) {
      const connectionCount = this.ipConnectionCounts.get(ip) || 0;
      if (connectionCount >= this.config.maxConnectionsPerIp) {
        console.log(`Connection rejected: too many connections from IP ${ip}`);
        this.metrics.rateLimitExceeded++;
        return false;
      }
    }
    
    // Increment connection count for this IP
    this.ipConnectionCounts.set(ip, (this.ipConnectionCounts.get(ip) || 0) + 1);
    
    // If auth is required, check auth token
    if (this.config.authRequired) {
      // Get token from query string
      const url = new URL(info.req.url || '/', `http://${info.req.headers.host}`);
      const token = url.searchParams.get('token');
      
      if (!token) {
        // If auth is required but no token provided, reject unless anonymous connections allowed
        if (!this.config.anonymousConnectionsAllowed) {
          console.log('Connection rejected: authentication required');
          this.metrics.authenticationFailures++;
          return false;
        }
      } else if (this.config.validateAuthToken) {
        // Validate token if validator is provided
        return this.config.validateAuthToken(token)
          .then(valid => {
            if (!valid) {
              console.log('Connection rejected: invalid authentication token');
              this.metrics.authenticationFailures++;
            }
            return valid;
          })
          .catch(err => {
            console.error('Error validating auth token:', err);
            this.metrics.errors++;
            return false;
          });
      }
    }
    
    return true;
  }
  
  /**
   * Handle new WebSocket connection
   */
  private handleConnection(socket: WebSocket, request: IncomingMessage): void {
    // Generate a unique ID for this client
    const clientId = uuidv4();
    
    // Parse the URL to get query parameters
    const url = new URL(request.url || '/', `http://${request.headers.host}`);
    
    // Parse connection ID from query if provided, otherwise use generated ID
    const connectionId = url.searchParams.get('connectionId') || clientId;
    
    // Get authentication token if provided
    const token = url.searchParams.get('token');
    
    // Create client object
    const client: WebSocketClient = {
      id: clientId,
      socket,
      userId: null,
      lastActivity: Date.now(),
      isAuthenticated: false,
      connectionState: ConnectionState.CONNECTING,
      ipAddress: this.getClientIp(request),
      userAgent: request.headers['user-agent'] || 'Unknown',
      connectionStartTime: Date.now(),
      pingCount: 0,
      pongCount: 0,
      messagesSent: 0,
      messagesReceived: 0,
      authTokenHash: token ? this.hashToken(token) : undefined,
      tags: new Map(),
      attributes: new Map()
    };
    
    // Set connection ID as a tag
    client.tags.set('connectionId', connectionId);
    
    // Store client in map
    this.clients.set(clientId, client);
    
    // Update metrics
    this.metrics.totalConnectionsCreated++;
    
    console.log(`WebSocket client connected: ${clientId} (${client.ipAddress})`);
    
    // Set up client event handlers
    socket.on('message', (data: WebSocket.Data) => this.handleClientMessage(clientId, data));
    socket.on('close', (code: number, reason: string) => this.handleClientClose(clientId, code, reason));
    socket.on('error', (error: Error) => this.handleClientError(clientId, error));
    socket.on('pong', () => this.handleClientPong(clientId));
    
    // Update connection state
    client.connectionState = ConnectionState.CONNECTED;
    
    // Set ping timeout
    setTimeout(() => this.pingClient(client), this.config.pingInterval);
    
    // Emit event
    eventBus.emit('ws.client.connected', {
      clientId,
      ipAddress: client.ipAddress,
      userAgent: client.userAgent,
      connectionId: connectionId,
      authenticated: client.isAuthenticated
    });
    
    // Send welcome message
    this.sendMessage(client, {
      type: 'connection_established',
      clientId,
      serverTime: new Date().toISOString(),
      message: 'Welcome to Enterprise WebSocket Server'
    });
  }
  
  /**
   * Handle client message
   */
  private handleClientMessage(clientId: string, data: WebSocket.Data): void {
    const client = this.clients.get(clientId);
    if (!client) {
      console.error(`Received message from unknown client: ${clientId}`);
      return;
    }
    
    // Update last activity timestamp
    client.lastActivity = Date.now();
    client.messagesReceived++;
    
    // Check rate limiting
    if (this.config.enableRateLimiting && !this.checkMessageRateLimit(client)) {
      console.warn(`Rate limit exceeded for client ${clientId}`);
      this.metrics.messagesDropped++;
      this.sendMessage(client, {
        type: 'error',
        error: 'rate_limit_exceeded',
        message: 'Message rate limit exceeded'
      });
      return;
    }
    
    try {
      // Parse JSON message
      const message = typeof data === 'string' ? JSON.parse(data) : data;
      
      // Update metrics
      this.metrics.messagesProcessed++;
      
      // Handle special message types
      if (message.type === 'ping') {
        this.handlePingMessage(client, message);
        return;
      }
      
      // Process message
      this.processMessage(client, message);
    } catch (error) {
      console.error(`Error processing message from client ${clientId}:`, error);
      this.metrics.errors++;
      this.sendMessage(client, {
        type: 'error',
        error: 'invalid_message',
        message: 'Failed to parse message'
      });
    }
  }
  
  /**
   * Process client message
   */
  private async processMessage(client: WebSocketClient, message: WebSocketMessage): Promise<void> {
    const { type } = message;
    if (!type) {
      this.sendMessage(client, {
        type: 'error',
        error: 'invalid_message',
        message: 'Message type is required'
      });
      return;
    }
    
    // Get handlers for this message type
    const handlers = this.messageHandlers.get(type);
    if (!handlers || handlers.length === 0) {
      // No handlers for this message type
      console.warn(`No handlers for message type: ${type}`);
      return;
    }
    
    // Execute handlers
    try {
      for (const handler of handlers) {
        await Promise.resolve(handler(message, client, this));
      }
    } catch (error) {
      console.error(`Error handling message type ${type}:`, error);
      this.metrics.errors++;
      this.sendMessage(client, {
        type: 'error',
        error: 'handler_error',
        message: 'Error processing message'
      });
    }
  }
  
  /**
   * Handle enhanced ping message from client with connection quality monitoring
   */
  private handlePingMessage(client: WebSocketClient, message: WebSocketMessage): void {
    // Update ping statistics
    client.pingCount++;
    
    // Calculate the round-trip time if timestamp is provided
    let rtt = 0;
    if (message.timestamp && typeof message.timestamp === 'number') {
      rtt = Date.now() - message.timestamp;
      
      // Track RTT in client attributes for metrics
      const rttHistory = client.attributes.get('rttHistory') || [];
      if (Array.isArray(rttHistory)) {
        // Keep last 10 measurements
        if (rttHistory.length >= 10) {
          rttHistory.shift();
        }
        rttHistory.push(rtt);
        client.attributes.set('rttHistory', rttHistory);
        
        // Calculate average RTT
        const avgRtt = rttHistory.reduce((sum, val) => sum + val, 0) / rttHistory.length;
        client.attributes.set('avgRtt', avgRtt);
      } else {
        client.attributes.set('rttHistory', [rtt]);
        client.attributes.set('avgRtt', rtt);
      }
    }
    
    // Send pong response with enhanced metrics
    this.sendMessage(client, {
      type: 'pong',
      id: message.id || uuidv4(),
      serverTime: new Date().toISOString(),
      receivedAt: Date.now(),
      rtt: rtt,
      metrics: {
        connectionAge: Date.now() - client.connectionStartTime,
        messagesReceived: client.messagesReceived,
        messagesSent: client.messagesSent,
        pingCount: client.pingCount,
        pongCount: client.pongCount,
        averageRtt: client.attributes.get('avgRtt') || 0,
        serverLoad: this.getServerLoad()
      }
    });
    
    // Log detailed ping metrics periodically
    if (client.pingCount % 10 === 0) {
      console.log(`WebSocket client ${client.id} connection metrics:
        Age: ${Math.floor((Date.now() - client.connectionStartTime) / 1000)}s
        Ping/Pong: ${client.pingCount}/${client.pongCount}
        Messages: ${client.messagesReceived} received, ${client.messagesSent} sent
        Avg RTT: ${client.attributes.get('avgRtt') || 0}ms
      `);
    }
  }
  
  /**
   * Get current server load as a percentage (0-100)
   * Higher values indicate higher load
   */
  private getServerLoad(): number {
    // Calculate server load based on active connections and message processing
    const connectionLoad = Math.min(100, (this.clients.size / 1000) * 100); // Assume 1000 connections is max
    const messageLoad = Math.min(100, (this.metrics.messagesProcessed % 10000) / 100); // Reset counter every 10000 msgs
    
    // Combine metrics with higher weight to connections
    return Math.min(100, (connectionLoad * 0.7) + (messageLoad * 0.3));
  }
  
  /**
   * Handle client close
   */
  private handleClientClose(clientId: string, code: number, reason: string): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }
    
    // Update client state
    client.connectionState = ConnectionState.CLOSED;
    client.disconnectCode = code;
    client.disconnectReason = reason;
    
    // Remove client
    this.clients.delete(clientId);
    
    // Decrement IP connection count
    const ip = client.ipAddress;
    const count = this.ipConnectionCounts.get(ip) || 0;
    if (count > 0) {
      this.ipConnectionCounts.set(ip, count - 1);
    }
    
    // Update metrics
    this.metrics.totalConnectionsClosed++;
    
    console.log(`WebSocket client disconnected: ${clientId} (${code} - ${reason || 'No reason'})`);
    
    // Emit event
    eventBus.emit('ws.client.disconnected', {
      clientId,
      code,
      reason,
      duration: Date.now() - client.connectionStartTime,
      messagesSent: client.messagesSent,
      messagesReceived: client.messagesReceived
    });
  }
  
  /**
   * Handle client error
   */
  private handleClientError(clientId: string, error: Error): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }
    
    console.error(`WebSocket client error: ${clientId}`, error);
    
    // Update metrics
    this.metrics.errors++;
    
    // Emit event
    eventBus.emit('ws.client.error', {
      clientId,
      error: error.message
    });
  }
  
  /**
   * Handle client pong response
   */
  private handleClientPong(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) {
      return;
    }
    
    // Update client state
    client.lastActivity = Date.now();
    client.pongCount++;
  }
  
  /**
   * Handle server error
   */
  private handleServerError(error: Error): void {
    console.error('WebSocket server error:', error);
    
    // Update metrics
    this.metrics.errors++;
    
    // Emit event
    eventBus.emit('ws.server.error', {
      error: error.message
    });
  }
  
  /**
   * Send a message to a client
   */
  private sendMessage(client: WebSocketClient, message: WebSocketMessage): boolean {
    if (client.socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    
    try {
      // Prepare the message
      const messageStr = this.config.serializeMessages ? 
        JSON.stringify(message) : message;
      
      // Check backpressure
      if (client.socket.bufferedAmount > this.config.maxBackpressureSize) {
        console.warn(`High backpressure for client ${client.id}: ${client.socket.bufferedAmount} bytes`);
        return false;
      }
      
      // Send the message
      client.socket.send(messageStr);
      
      // Update client state
      client.lastActivity = Date.now();
      client.messagesSent++;
      
      return true;
    } catch (error) {
      console.error(`Error sending message to client ${client.id}:`, error);
      this.metrics.errors++;
      return false;
    }
  }
  
  /**
   * Ping a client to check if it's still connected
   * This uses both WebSocket protocol pings and application-level ping messages
   * for comprehensive connection monitoring
   */
  private pingClient(client: WebSocketClient): void {
    if (client.socket.readyState !== WebSocket.OPEN) {
      return;
    }
    
    try {
      // Increment ping count
      client.pingCount++;
      
      // Send WebSocket protocol ping
      client.socket.ping();
      
      // Also send application-level ping message for enhanced monitoring
      // This allows us to measure RTT and other metrics with more precision
      this.sendMessage(client, {
        type: 'server_ping',
        id: `server-ping-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        timestamp: Date.now(),
        serverTime: new Date().toISOString(),
        metrics: {
          clientCount: this.clients.size,
          serverLoad: this.getServerLoad(),
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024 // MB
        }
      });
      
      // Set ping timeout with scaling based on connection history
      // For clients with history of slowness, give them more time
      const avgRtt = client.attributes.get('avgRtt') || 0;
      const dynamicTimeout = Math.max(
        this.config.pingTimeout,
        avgRtt * 4 + 1000 // At least 4x the average RTT plus 1 second
      );
      
      setTimeout(() => {
        // If we haven't received a pong since the last ping
        if (client.pingCount > client.pongCount) {
          // If client has high latency, give it more chances before disconnecting
          const missedPings = client.attributes.get('missedPings') || 0;
          const rttHistory = client.attributes.get('rttHistory') || [];
          const isHighLatencyClient = avgRtt > 500 || rttHistory.some((rtt: number) => rtt > 1000);
          
          if (isHighLatencyClient && missedPings < 2) {
            // Give high-latency clients more chances
            console.log(`Ping timeout for high-latency client ${client.id}, chance ${missedPings + 1}/3`);
            client.attributes.set('missedPings', missedPings + 1);
          } else {
            // Reset missed pings counter
            client.attributes.set('missedPings', 0);
            
            // Log and close connection
            console.log(`Ping timeout for client ${client.id}, closing connection`);
            this.closeConnection(client, 1001, 'Ping timeout');
          }
        } else {
          // Reset missed pings counter on successful ping
          client.attributes.set('missedPings', 0);
        }
      }, dynamicTimeout);
      
      // Schedule next ping with jitter to prevent thundering herd
      const jitter = Math.random() * 0.3 * this.config.pingInterval; // 0-30% jitter
      const nextPingDelay = this.config.pingInterval + jitter;
      
      setTimeout(() => {
        if (this.clients.has(client.id)) {
          this.pingClient(client);
        }
      }, nextPingDelay);
      
      // Log low-frequency ping metrics (every 5 pings)
      if (client.pingCount % 5 === 0) {
        const lostPings = Math.max(0, client.pingCount - client.pongCount);
        const lossRate = client.pingCount > 0 ? (lostPings / client.pingCount) * 100 : 0;
        
        console.log(`Client ${client.id} ping stats: ${client.pongCount}/${client.pingCount} received (${lossRate.toFixed(1)}% loss), avg RTT: ${avgRtt.toFixed(1)}ms`);
        
        // Track packet loss stats
        client.attributes.set('packetLossRate', lossRate);
      }
    } catch (error) {
      console.error(`Error pinging client ${client.id}:`, error);
      this.metrics.errors++;
    }
  }
  
  /**
   * Check message rate limit for a client
   */
  private checkMessageRateLimit(client: WebSocketClient): boolean {
    if (!this.config.enableRateLimiting) {
      return true;
    }
    
    const now = Date.now();
    const clientId = client.id;
    
    // Get or initialize rate limiter entry
    let entry = this.messageRateLimiter.get(clientId);
    if (!entry) {
      entry = { count: 0, resetTime: now + 60000 }; // 1 minute
      this.messageRateLimiter.set(clientId, entry);
    }
    
    // Reset counter if time expired
    if (now > entry.resetTime) {
      entry.count = 0;
      entry.resetTime = now + 60000;
    }
    
    // Increment count
    entry.count++;
    
    // Check if limit exceeded
    return entry.count <= this.config.maxMessagesPerMinute;
  }
  
  /**
   * Start client cleanup interval
   */
  private startClientCleanup(): void {
    this.clientCleanupInterval = setInterval(() => {
      this.cleanupInactiveClients();
    }, this.config.clientCleanupInterval);
  }
  
  /**
   * Cleanup inactive clients
   */
  private cleanupInactiveClients(): void {
    const now = Date.now();
    
    this.clients.forEach(client => {
      // Check if client is inactive
      if (now - client.lastActivity > this.config.connectionTimeout) {
        console.log(`Closing inactive client: ${client.id}`);
        this.closeConnection(client, 1000, 'Connection timeout due to inactivity');
      }
    });
    
    // Clean up message rate limiter
    this.messageRateLimiter.forEach((entry, clientId) => {
      if (now > entry.resetTime && !this.clients.has(clientId)) {
        this.messageRateLimiter.delete(clientId);
      }
    });
  }
  
  /**
   * Close a client connection
   */
  private closeConnection(client: WebSocketClient, code: number, reason: string): void {
    if (client.connectionState === ConnectionState.CLOSING || 
        client.connectionState === ConnectionState.CLOSED) {
      return;
    }
    
    // Update client state
    client.connectionState = ConnectionState.CLOSING;
    client.disconnectCode = code;
    client.disconnectReason = reason;
    
    try {
      // Close the connection
      client.socket.close(code, reason);
    } catch (error) {
      console.error(`Error closing connection for client ${client.id}:`, error);
      this.metrics.errors++;
    }
  }
  
  /**
   * Get client IP address
   */
  private getClientIp(request: IncomingMessage): string {
    // Try X-Forwarded-For header
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = typeof forwardedFor === 'string' ? forwardedFor.split(',') : forwardedFor[0]?.split(',');
      if (ips && ips.length > 0) {
        return ips[0].trim();
      }
    }
    
    // Try request socket remote address
    return (request.socket.remoteAddress || '0.0.0.0').replace(/^::ffff:/, '');
  }
  
  /**
   * Hash an authentication token
   */
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}

export default EnterpriseWebSocketManager;