/**
 * Enhanced WebSocket client optimized for Replit environment
 * 
 * This implementation provides:
 * 1. Automatic reconnection with exponential backoff
 * 2. Built-in ping/pong mechanism to detect lost connections
 * 3. Connection quality monitoring
 * 4. Replit-specific optimizations
 */

interface ReplitWebSocketOptions {
  url: string;
  protocols?: string | string[];
  autoReconnect?: boolean;
  maxReconnectAttempts?: number;
  reconnectDelayMs?: number;
  pingIntervalMs?: number;
  debug?: boolean;
  onOpen?: (event: Event) => void;
  onMessage?: (event: MessageEvent) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onReconnect?: (attempt: number) => void;
  onReconnectFailed?: () => void;
}

interface ReplitWebSocketState {
  status: 'connecting' | 'open' | 'closing' | 'closed' | 'reconnecting';
  reconnectAttempts: number;
  lastMessageTime: number;
  consecutiveFailures: number;
  pingsSent: number;
  pongsReceived: number;
  isManualClose: boolean;
}

/**
 * Enhanced WebSocket client optimized for Replit environment
 */
export class ReplitWebSocket {
  private ws: WebSocket | null = null;
  private options: Required<ReplitWebSocketOptions>;
  private state: ReplitWebSocketState;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private connectionTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingPings: Map<string, number> = new Map();

  /**
   * Create a new ReplitWebSocket
   */
  constructor(options: ReplitWebSocketOptions) {
    // Set default options
    this.options = {
      url: options.url,
      protocols: options.protocols || [],
      autoReconnect: options.autoReconnect !== false,
      maxReconnectAttempts: options.maxReconnectAttempts || 10,
      reconnectDelayMs: options.reconnectDelayMs || 1000,
      pingIntervalMs: options.pingIntervalMs || 15000,
      debug: options.debug || false,
      onOpen: options.onOpen || (() => {}),
      onMessage: options.onMessage || (() => {}),
      onClose: options.onClose || (() => {}),
      onError: options.onError || (() => {}),
      onReconnect: options.onReconnect || (() => {}),
      onReconnectFailed: options.onReconnectFailed || (() => {})
    };

    this.state = {
      status: 'closed',
      reconnectAttempts: 0,
      lastMessageTime: 0,
      consecutiveFailures: 0,
      pingsSent: 0,
      pongsReceived: 0,
      isManualClose: false
    };

    this.log('ReplitWebSocket created with options:', this.options);
    this.connect();
  }

  /**
   * Connect to WebSocket server
   */
  private connect(): void {
    if (this.ws?.readyState === WebSocket.CONNECTING || this.ws?.readyState === WebSocket.OPEN) {
      this.log('WebSocket is already connecting or connected');
      return;
    }

    this.clearTimers();
    
    try {
      this.state.status = 'connecting';
      this.log('Connecting to WebSocket at', this.options.url);
      
      this.ws = new WebSocket(this.options.url, this.options.protocols);
      
      this.ws.addEventListener('open', this.handleOpen.bind(this));
      this.ws.addEventListener('message', this.handleMessage.bind(this));
      this.ws.addEventListener('close', this.handleClose.bind(this));
      this.ws.addEventListener('error', this.handleError.bind(this));
      
      // Set a connection timeout (10 seconds)
      this.connectionTimeout = setTimeout(() => {
        if (this.state.status === 'connecting') {
          this.log('Connection timeout');
          this.ws?.close(4000, 'Connection timeout');
        }
      }, 10000);
    } catch (error) {
      this.log('Error connecting to WebSocket:', error);
      this.handleError(new ErrorEvent('error', { error }));
    }
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(event: Event): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    this.state.status = 'open';
    this.state.lastMessageTime = Date.now();
    this.state.reconnectAttempts = 0;
    this.log('WebSocket connected successfully');
    
    // Start ping interval
    this.startPingInterval();
    
    // Call user callback
    this.options.onOpen(event);
  }

  /**
   * Handle WebSocket message event
   */
  private handleMessage(event: MessageEvent): void {
    this.state.lastMessageTime = Date.now();
    
    try {
      // Try to parse the message
      if (typeof event.data === 'string') {
        const data = JSON.parse(event.data);
        
        // Handle pong message
        if (data.type === 'pong' && data.id) {
          const pingId = data.id;
          const pingTime = this.pendingPings.get(pingId);
          
          if (pingTime) {
            const latency = Date.now() - pingTime;
            this.pendingPings.delete(pingId);
            this.state.pongsReceived++;
            this.log(`Received pong ${pingId} with latency ${latency}ms`);
          }
          
          // Don't propagate ping/pong messages to user callback
          return;
        }
      }
    } catch (error) {
      // Not a JSON message, or not a pong message
    }
    
    // Call user callback for all other messages
    this.options.onMessage(event);
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    this.clearTimers();
    this.state.status = 'closed';
    
    this.log(`WebSocket closed: ${event.code} ${event.reason}`);
    
    // Call user callback
    this.options.onClose(event);
    
    // If the connection was closed manually, don't reconnect
    if (this.state.isManualClose) {
      this.log('Closure due to internal cleanup, skipping reconnect handling');
      this.state.isManualClose = false;
      return;
    }
    
    // Don't reconnect for certain close codes
    const dontReconnectCodes = [1000, 1001, 1008, 1011];
    
    // For Replit-specific issues, always try to reconnect
    const forceReconnect = event.code === 1006 || // Abnormal closure
                          event.code === 1012 || // Service restart
                          event.code === 1013;   // Try again later
    
    // Handle reconnect
    if ((this.options.autoReconnect && !dontReconnectCodes.includes(event.code)) || forceReconnect) {
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket error event
   */
  private handleError(event: Event): void {
    this.log('WebSocket error:', event);
    
    // Increment consecutive failures
    this.state.consecutiveFailures++;
    
    // Call user callback
    this.options.onError(event);
    
    // If we're already reconnecting or closed, don't reconnect again
    if (this.state.status === 'reconnecting' || this.state.status === 'closed') {
      return;
    }
    
    // If the connection is still open or connecting, close it
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      this.ws.close(3000, 'Error occurred');
    }
  }

  /**
   * Schedule a reconnect
   */
  private scheduleReconnect(): void {
    if (this.state.reconnectAttempts >= this.options.maxReconnectAttempts) {
      this.log(`Max reconnect attempts (${this.options.maxReconnectAttempts}) reached`);
      this.options.onReconnectFailed();
      return;
    }
    
    this.state.status = 'reconnecting';
    this.state.reconnectAttempts++;
    
    // Calculate delay with exponential backoff (capped at 30 seconds)
    const delay = Math.min(
      Math.pow(1.5, this.state.reconnectAttempts) * this.options.reconnectDelayMs,
      30000
    );
    
    this.log(`Attempting to reconnect in ${delay}ms (attempt ${this.state.reconnectAttempts}/${this.options.maxReconnectAttempts})`);
    
    // Clear any existing reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    // Set reconnect timer
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.options.onReconnect(this.state.reconnectAttempts);
      this.connect();
    }, delay);
  }

  /**
   * Start ping interval
   */
  private startPingInterval(): void {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
    }
    
    this.pingTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // Generate ping ID
        const now = Date.now();
        const pingId = `ping-${now}-${Math.random().toString(36).substring(2, 10)}`;
        
        // Store ping time
        this.pendingPings.set(pingId, now);
        this.state.pingsSent++;
        
        // Send ping
        this.send(JSON.stringify({
          type: 'ping',
          id: pingId,
          timestamp: now
        }));
        
        // Set timeout for pong (5 seconds)
        setTimeout(() => {
          if (this.pendingPings.has(pingId)) {
            this.log(`Ping timeout for ${pingId}`);
            this.pendingPings.delete(pingId);
            
            // Check if connection is dead
            const now = Date.now();
            const timeSinceLastMessage = now - this.state.lastMessageTime;
            
            if (timeSinceLastMessage > 30000) { // 30 seconds
              this.log('Connection seems dead, forcing reconnect');
              this.ws?.close(4001, 'Ping timeout');
            }
          }
        }, 5000);
      }
    }, this.options.pingIntervalMs);
  }

  /**
   * Clear all timers
   */
  private clearTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
  }

  /**
   * Send data through the WebSocket
   */
  public send(data: string | ArrayBufferLike | Blob | ArrayBufferView): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      this.log('Cannot send message, WebSocket is not open');
      return false;
    }
    
    try {
      this.ws.send(data);
      return true;
    } catch (error) {
      this.log('Error sending message:', error);
      return false;
    }
  }

  /**
   * Close the WebSocket connection
   */
  public close(code?: number, reason?: string): void {
    this.state.isManualClose = true;
    this.clearTimers();
    
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close(code || 1000, reason || 'Normal closure');
      }
    }
  }

  /**
   * Get current state
   */
  public getState(): Readonly<ReplitWebSocketState> {
    return { ...this.state };
  }

  /**
   * Check if WebSocket is open
   */
  public isOpen(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Manually trigger reconnect
   */
  public reconnect(): void {
    this.log('Manual reconnect triggered');
    
    if (this.ws) {
      this.ws.close(1000, 'Force reconnect');
    }
    
    // Reset reconnect counter to give full reconnect attempts
    this.resetReconnectCounter();
    
    // Immediately try to reconnect
    setTimeout(() => this.connect(), 100);
  }

  /**
   * Reset reconnect counter
   */
  public resetReconnectCounter(): void {
    this.state.reconnectAttempts = 0;
  }

  /**
   * Log message if debug enabled
   */
  private log(...args: any[]): void {
    if (this.options.debug) {
      console.log('[ReplitWebSocket]', ...args);
    }
  }
}

/**
 * Create a WebSocket connection optimized for Replit
 */
export function createReplitWebSocket(
  url: string,
  options: Omit<ReplitWebSocketOptions, 'url'> = {}
): ReplitWebSocket {
  return new ReplitWebSocket({
    url,
    ...options
  });
}

/**
 * Check if running in Replit environment
 */
export function isReplitEnvironment(): boolean {
  // Check if host includes replit.dev or if REPL_ID env variable exists
  if (typeof window !== 'undefined') {
    return window.location.hostname.includes('replit') ||
           window.location.hostname.includes('repl.co');
  }
  return typeof process !== 'undefined' && 'REPL_ID' in process.env;
}