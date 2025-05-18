/**
 * Enterprise WebSocket Service
 * 
 * A production-grade WebSocket client implementation with:
 * - Resilient connection management
 * - Automatic reconnection with exponential backoff
 * - Event-based messaging architecture
 * - Complete type safety
 * - Connection monitoring and health checks
 * - Security features
 * - Comprehensive logging
 */

import { v4 as uuidv4 } from 'uuid';

// WebSocket Event Types
export type WebSocketEventType = 
  | 'connected'
  | 'disconnected'
  | 'message'
  | 'error'
  | 'status_update'
  | 'tool_update'
  | 'reconnecting'
  | 'reconnect_failed'
  | 'ping'
  | 'pong';

// WebSocket Event Base (common properties)
interface WebSocketEventBase {
  timestamp: number;
}

// WebSocket Event Properties
interface WebSocketConnectedEvent extends WebSocketEventBase {
  connectionId: string;
}

interface WebSocketDisconnectedEvent extends WebSocketEventBase {
  code: number;
  reason: string;
  wasClean: boolean;
}

interface WebSocketMessageEvent extends WebSocketEventBase {
  data: any;
  messageId: string;
}

interface WebSocketErrorEvent extends WebSocketEventBase {
  error: any;
}

interface WebSocketStatusUpdateEvent extends WebSocketEventBase {
  servers: any[];
}

interface WebSocketToolUpdateEvent extends WebSocketEventBase {
  tools: any[];
}

interface WebSocketReconnectingEvent extends WebSocketEventBase {
  attempt: number;
  maxAttempts: number;
  delay: number;
}

interface WebSocketReconnectFailedEvent extends WebSocketEventBase {
  attempts: number;
}

interface WebSocketPingEvent extends WebSocketEventBase {
  id: string;
}

interface WebSocketPongEvent extends WebSocketEventBase {
  id: string;
  latency: number;
}

// WebSocket Event Object
export type WebSocketEvent = 
  | ({ type: 'connected' } & WebSocketConnectedEvent)
  | ({ type: 'disconnected' } & WebSocketDisconnectedEvent)
  | ({ type: 'message' } & WebSocketMessageEvent)
  | ({ type: 'error' } & WebSocketErrorEvent)
  | ({ type: 'status_update' } & WebSocketStatusUpdateEvent)
  | ({ type: 'tool_update' } & WebSocketToolUpdateEvent)
  | ({ type: 'reconnecting' } & WebSocketReconnectingEvent)
  | ({ type: 'reconnect_failed' } & WebSocketReconnectFailedEvent)
  | ({ type: 'ping' } & WebSocketPingEvent)
  | ({ type: 'pong' } & WebSocketPongEvent);

// Connection States
export enum ConnectionState {
  DISCONNECTED = 'DISCONNECTED',
  CONNECTING = 'CONNECTING',
  CONNECTED = 'CONNECTED',
  RECONNECTING = 'RECONNECTING',
  CLOSING = 'CLOSING',
  FAILED = 'FAILED'
}

// WebSocket Message Type
export interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

// Configuration Options
export interface WebSocketServiceConfig {
  // Connection settings
  endpoint: string;                    // WebSocket endpoint path
  autoConnect: boolean;                // Connect automatically on instantiation
  secure: boolean;                     // Force WSS (secure WebSocket)
  
  // Reconnection settings
  reconnect: boolean;                  // Enable automatic reconnection
  reconnectAttempts: number;           // Maximum reconnection attempts
  initialReconnectDelay: number;       // Initial delay before reconnect (ms)
  maxReconnectDelay: number;           // Maximum reconnect delay (ms)
  reconnectBackoffMultiplier: number;  // Multiplier for exponential backoff
  reconnectOnServerClose: boolean;     // Reconnect when server initiates close
  
  // Health check settings
  healthCheck: boolean;                // Enable connection health checks
  healthCheckInterval: number;         // Interval between health checks (ms)
  healthCheckTimeout: number;          // Timeout for health check response (ms)
  
  // Message handling
  processIncomingMessages: boolean;    // Process incoming messages automatically
  bufferOfflineMessages: boolean;      // Buffer messages when offline
  maxBufferSize: number;               // Maximum number of buffered messages
  
  // Debugging
  debug: boolean;                      // Enable detailed logging
  
  // Advanced settings
  protocols: string[];                 // WebSocket sub-protocols
  binaryType: BinaryType;              // Binary type for binary messages
  
  // Security settings
  tokenProvider?: () => Promise<string> | string; // Function to get auth token
  heartbeatEnabled: boolean;           // Enable heartbeat for connection monitoring
  heartbeatInterval: number;           // Heartbeat interval (ms)
}

// Default configuration
const DEFAULT_CONFIG: WebSocketServiceConfig = {
  endpoint: '/ws',
  autoConnect: true,
  secure: false,
  
  reconnect: true,
  reconnectAttempts: 10,
  initialReconnectDelay: 1000,
  maxReconnectDelay: 30000,
  reconnectBackoffMultiplier: 1.5,
  reconnectOnServerClose: true,
  
  healthCheck: true,
  healthCheckInterval: 30000,
  healthCheckTimeout: 5000,
  
  processIncomingMessages: true,
  bufferOfflineMessages: true,
  maxBufferSize: 100,
  
  debug: false,
  
  protocols: [],
  binaryType: 'blob',
  
  heartbeatEnabled: true,
  heartbeatInterval: 15000,
};

// Connection Statistics
export interface ConnectionStats {
  connectionAttempts: number;
  successfulConnections: number;
  disconnections: number;
  reconnectionAttempts: number;
  messagesReceived: number;
  messagesSent: number;
  errors: number;
  averageLatency: number;
  connectionUptime: number;
  lastConnectedAt: number | null;
  lastDisconnectedAt: number | null;
}

// WebSocket Service class
export class EnterpriseWebSocketService {
  private socket: WebSocket | null = null;
  private config: WebSocketServiceConfig;
  private connectionState: ConnectionState = ConnectionState.DISCONNECTED;
  private eventListeners: Map<WebSocketEventType, Array<(event: WebSocketEvent) => void>> = new Map();
  private reconnectTimer: number | null = null;
  private reconnectAttempt: number = 0;
  private healthCheckTimer: number | null = null;
  private heartbeatTimer: number | null = null;
  private pendingPings: Map<string, { timestamp: number }> = new Map();
  private messageBuffer: WebSocketMessage[] = [];
  private connectionId: string = '';
  private connectionStartTime: number = 0;
  
  // Statistics
  private stats: ConnectionStats = {
    connectionAttempts: 0,
    successfulConnections: 0,
    disconnections: 0,
    reconnectionAttempts: 0,
    messagesReceived: 0,
    messagesSent: 0,
    errors: 0,
    averageLatency: 0,
    connectionUptime: 0,
    lastConnectedAt: null,
    lastDisconnectedAt: null,
  };
  
  // Latency measurements
  private latencyMeasurements: number[] = [];
  
  /**
   * Create a new WebSocket service
   */
  constructor(config: Partial<WebSocketServiceConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize the connection if auto-connect is enabled
    if (this.config.autoConnect) {
      this.connect();
    }
    
    // Handle page visibility changes to optimize reconnection behavior
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
    }
    
    // Handle beforeunload to clean up connections
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
    }
  }
  
  /**
   * Connect to the WebSocket server
   */
  public connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)) {
      this.log('WebSocket is already connecting or connected');
      return;
    }
    
    // Clear any existing reconnect timer
    this.clearReconnectTimer();
    
    // Update connection state
    this.setConnectionState(ConnectionState.CONNECTING);
    
    // Generate a new connection ID
    this.connectionId = uuidv4();
    
    // Update statistics
    this.stats.connectionAttempts++;
    
    try {
      const url = this.buildWebSocketUrl();
      this.log(`Connecting to WebSocket at ${url}`);
      
      // Create WebSocket connection
      this.socket = new WebSocket(url, this.config.protocols);
      
      // Configure binary type
      this.socket.binaryType = this.config.binaryType;
      
      // Set up event handlers
      this.socket.onopen = this.handleOpen.bind(this);
      this.socket.onmessage = this.handleMessage.bind(this);
      this.socket.onclose = this.handleClose.bind(this);
      this.socket.onerror = this.handleError.bind(this);
    } catch (error) {
      this.log('Failed to create WebSocket connection:', error);
      this.setConnectionState(ConnectionState.FAILED);
      this.notifyListeners('error', { error, timestamp: Date.now() });
      this.scheduleReconnect();
    }
  }
  
  /**
   * Disconnect from the WebSocket server
   */
  public disconnect(code: number = 1000, reason: string = 'Client disconnected'): void {
    // Update connection state
    this.setConnectionState(ConnectionState.CLOSING);
    
    // Clear all timers
    this.clearAllTimers();
    
    // Close the socket if it exists and is connected
    if (this.socket) {
      if (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN) {
        this.socket.close(code, reason);
      }
      
      // Clean up event handlers
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket = null;
    }
    
    // Update connection state
    this.setConnectionState(ConnectionState.DISCONNECTED);
    this.resetReconnectAttempt();
    
    // Update statistics
    this.stats.disconnections++;
    this.stats.lastDisconnectedAt = Date.now();
    
    // Calculate connection uptime if we were connected
    if (this.connectionStartTime > 0) {
      const uptime = Date.now() - this.connectionStartTime;
      this.stats.connectionUptime = uptime;
      this.connectionStartTime = 0;
    }
  }
  
  /**
   * Send a message to the WebSocket server
   */
  public send(message: WebSocketMessage | string): boolean {
    // If there's no socket or it's not connected
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      // Buffer the message if configured to do so
      if (this.config.bufferOfflineMessages) {
        const msgObj = typeof message === 'string' ? JSON.parse(message) : message;
        if (this.messageBuffer.length < this.config.maxBufferSize) {
          this.messageBuffer.push(msgObj);
          this.log(`Message buffered (${this.messageBuffer.length}/${this.config.maxBufferSize})`);
          return true;
        } else {
          this.log('Message buffer is full, dropping message');
          return false;
        }
      }
      
      this.log('Cannot send message, socket is not open');
      return false;
    }
    
    try {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      this.socket.send(messageStr);
      
      // Update statistics
      this.stats.messagesSent++;
      
      return true;
    } catch (error) {
      this.log('Error sending message:', error);
      this.notifyListeners('error', { error, timestamp: Date.now() });
      return false;
    }
  }
  
  /**
   * Subscribe to WebSocket events
   */
  public on(eventType: WebSocketEventType, listener: (event: WebSocketEvent) => void): () => void {
    // Get or create the array of listeners for this event type
    const listeners = this.eventListeners.get(eventType) || [];
    
    // Add the new listener
    listeners.push(listener);
    
    // Update the map
    this.eventListeners.set(eventType, listeners);
    
    // Return unsubscribe function
    return () => {
      const updatedListeners = this.eventListeners.get(eventType) || [];
      this.eventListeners.set(
        eventType,
        updatedListeners.filter(l => l !== listener)
      );
    };
  }
  
  /**
   * Check if the WebSocket is connected
   */
  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
  
  /**
   * Get the current WebSocket state
   */
  public getState(): ConnectionState {
    return this.connectionState;
  }
  
  /**
   * Get connection statistics
   */
  public getStats(): ConnectionStats {
    // Calculate current uptime if connected
    if (this.isConnected() && this.connectionStartTime > 0) {
      const currentUptime = Date.now() - this.connectionStartTime;
      return { ...this.stats, connectionUptime: currentUptime };
    }
    
    return { ...this.stats };
  }
  
  /**
   * Force a reconnection
   */
  public forceReconnect(): void {
    this.log('Forcing reconnection...');
    
    // Disconnect first
    this.disconnect(1000, 'Force reconnect');
    
    // Reset reconnect attempt counter
    this.resetReconnectAttempt();
    
    // Connect again
    this.connect();
  }
  
  /**
   * Send a ping to measure latency
   */
  public ping(): string {
    const pingId = uuidv4();
    const timestamp = Date.now();
    
    this.pendingPings.set(pingId, { timestamp });
    
    const pingMessage = {
      type: 'ping',
      id: pingId,
      timestamp
    };
    
    this.send(pingMessage);
    this.notifyListeners('ping', { id: pingId, timestamp });
    
    return pingId;
  }
  
  /**
   * Flush buffered messages
   */
  public flushMessageBuffer(): boolean {
    if (!this.isConnected() || this.messageBuffer.length === 0) {
      return false;
    }
    
    this.log(`Flushing message buffer (${this.messageBuffer.length} messages)`);
    
    // Clone and clear the buffer
    const messages = [...this.messageBuffer];
    this.messageBuffer = [];
    
    // Send all buffered messages
    let success = true;
    for (const message of messages) {
      if (!this.send(message)) {
        success = false;
        break;
      }
    }
    
    return success;
  }
  
  /**
   * Clear the message buffer without sending
   */
  public clearMessageBuffer(): void {
    this.messageBuffer = [];
    this.log('Message buffer cleared');
  }
  
  // Private methods
  
  /**
   * Build the WebSocket URL
   */
  private buildWebSocketUrl(): string {
    // Start with the protocol
    const protocol = this.config.secure || window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    
    // Get the host
    const host = window.location.host;
    
    // Normalize the endpoint
    const endpoint = this.config.endpoint.startsWith('/') ? this.config.endpoint : `/${this.config.endpoint}`;
    
    // Add authentication token if provided
    let url = `${protocol}//${host}${endpoint}`;
    
    // Add connection ID as query parameter
    url += url.includes('?') ? '&' : '?';
    url += `connectionId=${this.connectionId}`;
    
    // Add timestamp to prevent caching
    url += `&t=${Date.now()}`;
    
    // If we have a token provider, add the token
    if (this.config.tokenProvider) {
      const token = this.resolveToken();
      if (token) {
        url += `&token=${encodeURIComponent(token)}`;
      }
    }
    
    return url;
  }
  
  /**
   * Resolve authentication token
   */
  private resolveToken(): string | null {
    if (!this.config.tokenProvider) {
      return null;
    }
    
    try {
      const token = this.config.tokenProvider();
      if (token instanceof Promise) {
        // For the moment, we'll return null and let the promise handle it
        token.then(t => this.log('Token resolved asynchronously'));
        return null;
      }
      return token;
    } catch (error) {
      this.log('Error resolving token:', error);
      return null;
    }
  }
  
  /**
   * Update the connection state
   */
  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.log(`Connection state changed: ${this.connectionState} -> ${state}`);
      this.connectionState = state;
    }
  }
  
  /**
   * Start the health check interval
   */
  private startHealthCheck(): void {
    if (!this.config.healthCheck) {
      return;
    }
    
    // Clear any existing health check
    this.clearHealthCheckTimer();
    
    // Set up new health check interval
    this.healthCheckTimer = window.setInterval(() => {
      this.performHealthCheck();
    }, this.config.healthCheckInterval);
  }
  
  /**
   * Perform a health check
   */
  private performHealthCheck(): void {
    // Only perform health check if connected
    if (!this.isConnected()) {
      return;
    }
    
    // Send a ping to measure latency
    this.ping();
    
    // Check for stale pending pings (timed out)
    const now = Date.now();
    this.pendingPings.forEach((pingData, id) => {
      if (now - pingData.timestamp > this.config.healthCheckTimeout) {
        this.log(`Ping ${id} timed out`);
        this.pendingPings.delete(id);
        
        // Connection might be stale, force reconnect
        this.forceReconnect();
      }
    });
  }
  
  /**
   * Start the heartbeat interval
   */
  private startHeartbeat(): void {
    if (!this.config.heartbeatEnabled) {
      return;
    }
    
    // Clear any existing heartbeat
    this.clearHeartbeatTimer();
    
    // Set up new heartbeat interval
    this.heartbeatTimer = window.setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);
  }
  
  /**
   * Send a heartbeat message
   */
  private sendHeartbeat(): void {
    if (!this.isConnected()) {
      return;
    }
    
    this.send({
      type: 'heartbeat',
      timestamp: Date.now()
    });
  }
  
  /**
   * Clear the reconnect timer
   */
  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
  
  /**
   * Clear the health check timer
   */
  private clearHealthCheckTimer(): void {
    if (this.healthCheckTimer !== null) {
      window.clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;
    }
  }
  
  /**
   * Clear the heartbeat timer
   */
  private clearHeartbeatTimer(): void {
    if (this.heartbeatTimer !== null) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
  
  /**
   * Clear all timers
   */
  private clearAllTimers(): void {
    this.clearReconnectTimer();
    this.clearHealthCheckTimer();
    this.clearHeartbeatTimer();
  }
  
  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    // Don't reconnect if it's disabled
    if (!this.config.reconnect) {
      return;
    }
    
    // Clear any existing reconnect timer
    this.clearReconnectTimer();
    
    // Check if we've reached the maximum reconnect attempts
    if (this.reconnectAttempt >= this.config.reconnectAttempts) {
      this.log(`Maximum reconnect attempts (${this.config.reconnectAttempts}) reached, giving up`);
      this.setConnectionState(ConnectionState.FAILED);
      this.notifyListeners('reconnect_failed', { 
        attempts: this.reconnectAttempt,
        timestamp: Date.now()
      });
      return;
    }
    
    // Increment reconnect attempt counter
    this.reconnectAttempt++;
    
    // Update statistics
    this.stats.reconnectionAttempts++;
    
    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.config.initialReconnectDelay * Math.pow(this.config.reconnectBackoffMultiplier, this.reconnectAttempt - 1),
      this.config.maxReconnectDelay
    );
    
    // Add some randomness to prevent all clients reconnecting simultaneously (jitter)
    const jitter = 0.1 * delay * Math.random();
    const reconnectDelay = Math.floor(delay + jitter);
    
    this.log(`Will attempt reconnection in ${reconnectDelay}ms (attempt ${this.reconnectAttempt}/${this.config.reconnectAttempts})`);
    
    // Update connection state
    this.setConnectionState(ConnectionState.RECONNECTING);
    
    // Notify listeners
    this.notifyListeners('reconnecting', {
      attempt: this.reconnectAttempt,
      maxAttempts: this.config.reconnectAttempts,
      delay: reconnectDelay,
      timestamp: Date.now()
    });
    
    // Schedule the reconnect
    this.reconnectTimer = window.setTimeout(() => {
      this.log('Attempting to reconnect...');
      this.connect();
    }, reconnectDelay);
  }
  
  /**
   * Reset the reconnect attempt counter
   */
  private resetReconnectAttempt(): void {
    this.reconnectAttempt = 0;
  }
  
  /**
   * Notify all listeners of an event
   */
  private notifyListeners<T extends WebSocketEventType>(
    eventType: T,
    event: T extends 'connected' ? Omit<WebSocketConnectedEvent, 'timestamp'> :
           T extends 'disconnected' ? Omit<WebSocketDisconnectedEvent, 'timestamp'> :
           T extends 'message' ? Omit<WebSocketMessageEvent, 'timestamp'> :
           T extends 'error' ? Omit<WebSocketErrorEvent, 'timestamp'> :
           T extends 'status_update' ? Omit<WebSocketStatusUpdateEvent, 'timestamp'> :
           T extends 'tool_update' ? Omit<WebSocketToolUpdateEvent, 'timestamp'> :
           T extends 'reconnecting' ? Omit<WebSocketReconnectingEvent, 'timestamp'> :
           T extends 'reconnect_failed' ? Omit<WebSocketReconnectFailedEvent, 'timestamp'> :
           T extends 'ping' ? Omit<WebSocketPingEvent, 'timestamp'> :
           T extends 'pong' ? Omit<WebSocketPongEvent, 'timestamp'> :
           never
  ): void {
    const listeners = this.eventListeners.get(eventType) || [];
    const fullEvent = { 
      type: eventType, 
      timestamp: Date.now(),
      ...event 
    } as WebSocketEvent;
    
    listeners.forEach(listener => {
      try {
        listener(fullEvent);
      } catch (error) {
        this.log('Error in event listener:', error);
      }
    });
  }
  
  /**
   * Process an incoming message
   */
  private processMessage(data: string | ArrayBuffer): void {
    // Skip processing if configured not to
    if (!this.config.processIncomingMessages) {
      return;
    }
    
    try {
      // Parse JSON message
      const message = typeof data === 'string' ? JSON.parse(data) : data;
      
      // Handle special message types
      if (message.type === 'pong' && message.id) {
        this.handlePongMessage(message);
        return;
      } else if (message.type === 'server_status' || message.type === 'serverStatus') {
        this.notifyListeners('status_update', {
          servers: message.servers || [],
          timestamp: Date.now()
        });
        return;
      } else if (message.type === 'tools_updated' || message.type === 'serverTools') {
        this.notifyListeners('tool_update', {
          tools: message.tools || [],
          timestamp: Date.now()
        });
        return;
      }
      
      // For all other messages, pass to message event listeners
      this.notifyListeners('message', {
        data: message,
        messageId: message.messageId || uuidv4(),
        timestamp: Date.now()
      });
    } catch (error) {
      this.log('Error processing message:', error, data);
      
      // If it's not JSON, still notify with raw data
      if (typeof data === 'string') {
        this.notifyListeners('message', {
          data: { type: 'raw', content: data },
          messageId: uuidv4(),
          timestamp: Date.now()
        });
      }
    }
  }
  
  /**
   * Handle a pong message response
   */
  private handlePongMessage(message: { id: string, [key: string]: any }): void {
    const pingData = this.pendingPings.get(message.id);
    if (pingData) {
      const latency = Date.now() - pingData.timestamp;
      this.pendingPings.delete(message.id);
      
      // Add to latency measurements
      this.latencyMeasurements.push(latency);
      
      // Keep only the last 10 measurements
      if (this.latencyMeasurements.length > 10) {
        this.latencyMeasurements.shift();
      }
      
      // Calculate average latency
      const sum = this.latencyMeasurements.reduce((a, b) => a + b, 0);
      this.stats.averageLatency = sum / this.latencyMeasurements.length;
      
      // Notify listeners
      this.notifyListeners('pong', {
        id: message.id,
        latency,
        timestamp: Date.now()
      });
    }
  }
  
  /**
   * Handle visibility change event
   */
  private handleVisibilityChange(): void {
    if (document.visibilityState === 'visible') {
      // Page is now visible, reconnect if we're not connected
      if (this.connectionState !== ConnectionState.CONNECTED && 
          this.connectionState !== ConnectionState.CONNECTING) {
        this.log('Page became visible, attempting to reconnect');
        this.forceReconnect();
      }
    }
  }
  
  /**
   * Handle beforeunload event
   */
  private handleBeforeUnload(): void {
    // Clean disconnect when the page is unloaded
    this.disconnect(1000, 'Page unloaded');
  }
  
  // WebSocket event handlers
  
  /**
   * Handle WebSocket connection open
   */
  private handleOpen(event: Event): void {
    this.log('WebSocket connected successfully');
    
    // Update connection state
    this.setConnectionState(ConnectionState.CONNECTED);
    
    // Reset reconnect attempts
    this.resetReconnectAttempt();
    
    // Update statistics
    this.stats.successfulConnections++;
    this.stats.lastConnectedAt = Date.now();
    this.connectionStartTime = Date.now();
    
    // Start timers
    this.startHealthCheck();
    this.startHeartbeat();
    
    // Flush message buffer
    if (this.config.bufferOfflineMessages && this.messageBuffer.length > 0) {
      this.flushMessageBuffer();
    }
    
    // Notify listeners
    this.notifyListeners('connected', {
      connectionId: this.connectionId,
      timestamp: Date.now()
    });
    
    // Request initial status
    this.send({
      type: 'status_request',
      timestamp: Date.now()
    });
  }
  
  /**
   * Handle WebSocket message
   */
  private handleMessage(event: MessageEvent): void {
    // Update statistics
    this.stats.messagesReceived++;
    
    // Process the message
    this.processMessage(event.data);
  }
  
  /**
   * Handle WebSocket close
   */
  private handleClose(event: CloseEvent): void {
    this.log(`WebSocket closed: ${event.code} ${event.reason}`);
    
    // Update connection state
    this.setConnectionState(ConnectionState.DISCONNECTED);
    
    // Clear timers
    this.clearHealthCheckTimer();
    this.clearHeartbeatTimer();
    
    // Update statistics
    this.stats.disconnections++;
    this.stats.lastDisconnectedAt = Date.now();
    
    // Calculate connection uptime if we were connected
    if (this.connectionStartTime > 0) {
      const uptime = Date.now() - this.connectionStartTime;
      this.stats.connectionUptime = uptime;
      this.connectionStartTime = 0;
    }
    
    // Notify listeners
    this.notifyListeners('disconnected', {
      code: event.code,
      reason: event.reason,
      wasClean: event.wasClean,
      timestamp: Date.now()
    });
    
    // Determine if we should reconnect
    let shouldReconnect = this.config.reconnect;
    
    // Don't reconnect for normal closure (1000) unless configured to do so
    if (event.code === 1000 && !this.config.reconnectOnServerClose) {
      shouldReconnect = false;
    }
    
    // Schedule reconnect if needed
    if (shouldReconnect) {
      this.scheduleReconnect();
    }
  }
  
  /**
   * Handle WebSocket error
   */
  private handleError(event: Event): void {
    this.log('WebSocket error occurred:', event);
    
    // Update statistics
    this.stats.errors++;
    
    // Notify listeners
    this.notifyListeners('error', {
      error: event,
      timestamp: Date.now()
    });
  }
  
  /**
   * Conditional logging
   */
  private log(...args: any[]): void {
    if (this.config.debug) {
      console.log(`[Enterprise WS]`, ...args);
    }
  }
}

// Create singleton instances for common WebSocket endpoints
export const mcpWebSocket = new EnterpriseWebSocketService({
  endpoint: '/ws/mcp-proxy',
  debug: true,
  reconnectAttempts: 5,
  healthCheckInterval: 15000,
  bufferOfflineMessages: true
});

export const eventsWebSocket = new EnterpriseWebSocketService({
  endpoint: '/ws/events',
  debug: true,
  autoConnect: false, // Don't connect automatically
  reconnectAttempts: 3
});

export const testWebSocket = new EnterpriseWebSocketService({
  endpoint: '/ws',
  debug: true,
  autoConnect: false, // Don't connect automatically
  reconnectAttempts: 3,
  healthCheck: false
});

export default EnterpriseWebSocketService;