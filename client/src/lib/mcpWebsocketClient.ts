/**
 * Enterprise-Grade WebSocket Client for MCP Server Connection
 * 
 * Features:
 * - Robust connection management
 * - Auto-reconnection with exponential backoff
 * - Connection health monitoring
 * - Event-based architecture
 * - Type-safe message handling
 * - Security features (TLS configuration)
 */

// Import WebSocket fixes using named imports
import { createStableWebSocketUrl, monitorConnection, ConnectionQualityMetrics } from './websocketUtil';

// Define event types
export type WebSocketEvent = 
  | { type: 'connected' }
  | { type: 'disconnected', code: number, reason: string }
  | { type: 'message', data: any }
  | { type: 'error', error: any }
  | { type: 'status_update', servers: any[] }
  | { type: 'tool_update', tools: any[] }
  | { type: 'connection_quality', metrics: ConnectionQualityMetrics };

interface WebSocketClientConfig {
  maxReconnectAttempts?: number;
  initialReconnectDelay?: number;
  maxReconnectDelay?: number;
  reconnectBackoffMultiplier?: number;
  statusCheckInterval?: number;
  path?: string;
}

type EventHandler = (event: WebSocketEvent) => void;

// WebSocket client implementation
export class McpWebSocketClient {
  private socket: WebSocket | null = null;
  private eventHandlers: EventHandler[] = [];
  private reconnectAttempt: number = 0;
  private reconnectTimer: number | null = null;
  private checkStatusInterval: number | null = null;
  private intentionalClose: boolean = false;

  // Configuration with defaults
  private config: Required<WebSocketClientConfig> = {
    maxReconnectAttempts: 5,
    initialReconnectDelay: 1000, // 1 second
    maxReconnectDelay: 30000,    // 30 seconds
    reconnectBackoffMultiplier: 1.5,
    statusCheckInterval: 30000,  // 30 seconds
    path: '/ws/mcp-proxy'  // This needs to match a registered WebSocket server path on the backend
  };

  constructor(config?: WebSocketClientConfig) {
    // Override default configuration with provided values
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }

  // Variable to hold the connection monitor cleanup function
  private connectionMonitor: (() => void) | null = null;

  /**
   * Connect to the WebSocket server
   */
  public connect(): void {
    // If already connected or connecting, don't attempt to reconnect
    if (this.socket) {
      if (this.socket.readyState === WebSocket.OPEN) {
        console.log('[MCP Client] WebSocket is already connected');
        return;
      } else if (this.socket.readyState === WebSocket.CONNECTING) {
        console.log('[MCP Client] WebSocket is already connecting');
        
        // In Replit environment, check for stalled connections
        if (this.isInReplitEnvironment()) {
          setTimeout(() => {
            // If socket is still in CONNECTING state after timeout, it might be stalled
            if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
              console.log('[MCP Client] Connection attempt appears stalled, resetting...');
              try {
                this.socket.close(1000, 'Connection stalled');
              } catch (e) {
                // Ignore errors
              }
              this.socket = null;
              // Retry connection after cleanup
              this.connect();
            }
          }, 5000); // 5 second timeout for stalled connections
        }
        return;
      }
      
      // If socket exists but is in CLOSING or CLOSED state, clean it up first
      console.log('[MCP Client] Cleaning up existing socket before creating a new one');
      // Remove event listeners first to prevent unexpected callbacks
      this.socket.onopen = null;
      this.socket.onclose = null;
      this.socket.onerror = null;
      this.socket.onmessage = null;
      
      // Then try to close it (only if not closed already)
      if (this.socket.readyState !== WebSocket.CLOSED) {
        try {
          // Flag to prevent reconnection loop in the close handler
          const previousIntentionalClose = this.intentionalClose;
          this.intentionalClose = true; // Temporarily mark as intentional
          
          this.socket.close(1000, 'Cleaning up before new connection');
          
          // Wait a small moment to ensure the close event has fired
          setTimeout(() => {
            this.intentionalClose = previousIntentionalClose; 
          }, 50);
        } catch (e) {
          // Ignore errors during cleanup
          console.warn('[MCP Client] Error during socket cleanup:', e);
        }
      }
      this.socket = null;
    }

    // Reset the intentional close flag when initiating a new connection
    this.intentionalClose = false;

    try {
      // Cleanup any existing connection monitor
      if (this.connectionMonitor) {
        this.connectionMonitor();
        this.connectionMonitor = null;
      }

      // Get the WebSocket path from config
      const path = this.config.path;
      
      // Special handling for Replit environment to improve reliability
      let wsUrl;
      if (this.isInReplitEnvironment()) {
        // Use direct approach for Replit with enhanced error handling
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        const normalizedPath = path?.startsWith('/') ? path : `/${path || '/ws/mcp-proxy'}`;
        
        // For Replit environment, ensure we're always using wss protocol and the correct host
        const replitHost = host.includes('replit') ? host : `${host}.replit.dev`;
        wsUrl = `${protocol}//${replitHost}${normalizedPath}`;
        console.log(`[MCP Client] Replit environment detected, using optimized WebSocket URL: ${wsUrl}`);
      } else {
        // Use the standardized URL creation function from websocketFix for other environments
        wsUrl = createStableWebSocketUrl(path);
      }

      console.log(`[MCP Client] Connecting to WebSocket at ${wsUrl}`);

      // Create a new WebSocket connection
      this.socket = new WebSocket(wsUrl);
      
      // Set up connection timeout (shorter for Replit environment)
      const timeoutDuration = this.isInReplitEnvironment() ? 5000 : 10000;
      
      const connectionTimeout = window.setTimeout(() => {
        // If we're still connecting after timeout period, force close and reconnect
        if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
          console.log(`[MCP Client] Connection attempt timed out after ${timeoutDuration/1000} seconds`);
          
          // Close the socket with a clean code to avoid triggering reconnect within the close handler
          if (this.socket) {
            try {
              // Set intentional flag to prevent reconnection loop
              this.intentionalClose = true;
              this.socket.close(1000, 'Connection timeout');
              
              // Reset the flag after a small delay to ensure the close event has been processed
              setTimeout(() => {
                this.intentionalClose = false;
              }, 50);
            } catch (err) {
              console.error('[MCP Client] Error closing socket after timeout:', err);
              this.intentionalClose = false;
            }
            
            // Clear the reference and schedule reconnect
            this.socket = null;
            
            // Use environment-specific reconnection strategy
            if (this.isInReplitEnvironment()) {
              console.log('[MCP Client] Using Replit-optimized reconnection after timeout');
              this.reconnectWithDelay(1000); // Quick reconnect for Replit
            } else {
              this.scheduleReconnect();
            }
          }
        }
      }, timeoutDuration);

      // Set up event handlers
      this.socket.onopen = (event) => {
        // Clear the connection timeout since we connected successfully
        window.clearTimeout(connectionTimeout);
        this.handleOpen(event);
        
        // Set up enhanced connection quality monitoring
        if (this.socket) {
          // If in Replit environment, we need special connection monitoring settings
          const isReplit = this.isInReplitEnvironment();
          
          const monitorSettings = isReplit ? {
            // For Replit environment, use extremely relaxed parameters
            pingInterval: 60000,   // Much less frequent pings (60 seconds) to reduce overhead
            pongTimeout: 30000,    // Much longer timeout waiting for pongs
            poorLatencyThreshold: 20000,     // 20 seconds is considered "poor" latency
            criticalLatencyThreshold: 60000, // 60 seconds is considered "critical" latency
            packetLossThreshold: 99,         // Only react to extreme packet loss (99%)
            maxPingHistory: 3                // Minimal history for faster reaction to recent changes
          } : {
            // Standard settings for normal environments
            pingInterval: 10000,  // 10 seconds
            pongTimeout: 5000,    // 5 seconds
            poorLatencyThreshold: 500,
            criticalLatencyThreshold: 2000,
            packetLossThreshold: 30,
            maxPingHistory: 10
          };
          
          this.connectionMonitor = monitorConnection(this.socket, (event) => {
            if (event.type === 'reconnect') {
              console.log('[MCP Client] Connection monitor triggered reconnect');
              this.forceReconnect();
            } else if (event.type === 'metrics' && event.metrics) {
              // Forward connection quality metrics to subscribers
              this.notifySubscribers({
                type: 'connection_quality',
                metrics: event.metrics
              });
              
              // Log critical connection quality issues
              if (event.metrics.stability < 50) {
                console.warn(`[MCP Client] Connection stability critical: ${event.metrics.stability.toFixed(1)}%`);
                
                // In Replit, don't automatically reconnect on every stability issue
                // Only manual reconnection or extreme packet loss should trigger reconnect
                if (isReplit) {
                  // Only reconnect automatically if loss is extreme and we've observed it for a while
                  if (event.metrics.packetLoss >= 98 && event.metrics.pingHistory.length >= 3) {
                    console.log('[MCP Client] Extreme packet loss detected in Replit, forcing reconnect');
                    this.forceReconnect();
                  } else {
                    console.log(`[MCP Client] Connection is stable enough for Replit (${event.metrics.stability.toFixed(1)}%)`);
                  }
                }
              }
            }
          }, monitorSettings);
        }
      };
      
      this.socket.onmessage = this.handleMessage.bind(this);
      
      this.socket.onclose = (event) => {
        // Clear the connection timeout if close happens before timeout
        window.clearTimeout(connectionTimeout);
        
        // Clean up the connection monitor
        if (this.connectionMonitor) {
          this.connectionMonitor();
          this.connectionMonitor = null;
        }
        
        this.handleClose(event);
      };
      
      this.socket.onerror = (event) => {
        // Don't clear the timeout here as we may still connect successfully after an error
        this.handleError(event);
      };

      // Start the status check interval
      this.startStatusCheck();
    } catch (error) {
      console.error('[MCP Client] Failed to create WebSocket connection:', error);
      this.scheduleReconnect();
    }
  }
  
  /**
   * Disconnect from the WebSocket server
   */
  public disconnect(): void {
    // Set intentional close flag BEFORE any socket operations
    this.intentionalClose = true;
    
    console.log('[MCP Client] Intentional disconnect requested');
    
    // Clean up connection monitor
    if (this.connectionMonitor) {
      console.log('[MCP Client] Cleaning up connection monitor');
      this.connectionMonitor();
      this.connectionMonitor = null;
    }
    
    // Clear any pending reconnects
    if (this.reconnectTimer !== null) {
      console.log('[MCP Client] Clearing pending reconnect timer');
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Clear status check interval
    if (this.checkStatusInterval !== null) {
      console.log('[MCP Client] Clearing status check interval');
      window.clearInterval(this.checkStatusInterval);
      this.checkStatusInterval = null;
    }

    // Close the socket if it exists and is connected
    if (this.socket) {
      const currentState = this.getState();
      console.log(`[MCP Client] Closing socket in state: ${currentState}`);
      
      if (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN) {
        try {
          this.socket.close(1000, 'Intentional disconnect by client');
        } catch (e) {
          console.error('[MCP Client] Error while closing socket:', e);
        }
      }
      
      // Remove all event handlers to prevent any callbacks
      if (this.socket) {
        this.socket.onopen = null;
        this.socket.onclose = null;
        this.socket.onerror = null;
        this.socket.onmessage = null;
      }
    }

    this.socket = null;
    this.reconnectAttempt = 0;
    
    console.log('[MCP Client] Disconnect completed');
  }

  /**
   * Send a message to the WebSocket server
   */
  public send(message: any): boolean {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      console.warn('[MCP Client] Cannot send message, socket is not open');
      return false;
    }

    try {
      const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
      this.socket.send(messageStr);
      return true;
    } catch (error) {
      console.error('[MCP Client] Error sending message:', error);
      return false;
    }
  }

  /**
   * Subscribe to WebSocket events
   */
  public subscribe(handler: EventHandler): () => void {
    this.eventHandlers.push(handler);

    // Return unsubscribe function
    return () => {
      this.eventHandlers = this.eventHandlers.filter(h => h !== handler);
    };
  }

  /**
   * Check if the WebSocket is connected
   */
  public isConnected(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
  }
  
  /**
   * Check if the WebSocket is connecting
   */
  public isConnecting(): boolean {
    return this.socket !== null && this.socket.readyState === WebSocket.CONNECTING;
  }

  /**
   * Get the current WebSocket state
   */
  public getState(): string {
    if (!this.socket) return 'CLOSED';

    switch (this.socket.readyState) {
      case WebSocket.CONNECTING: return 'CONNECTING';
      case WebSocket.OPEN: return 'OPEN';
      case WebSocket.CLOSING: return 'CLOSING';
      case WebSocket.CLOSED: return 'CLOSED';
      default: return 'UNKNOWN';
    }
  }

  /**
   * Start the periodic status check
   */
  private startStatusCheck(): void {
    // Clear any existing interval
    if (this.checkStatusInterval !== null) {
      window.clearInterval(this.checkStatusInterval);
    }

    // Set up a new interval
    this.checkStatusInterval = window.setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.send({ type: 'status_request' });
      }
    }, this.config.statusCheckInterval);
  }

  // WebSocket event handlers
  private handleOpen(event: Event): void {
    console.log('[MCP Client] WebSocket connected successfully');
    
    // Reset reconnect attempts
    this.reconnectAttempt = 0;
    
    // Record successful connection time for abnormal closure tracking
    if (typeof window !== 'undefined') {
      // @ts-ignore - custom property to track abnormal closures
      if (window.__mcpAbnormalClosures) {
        // @ts-ignore
        window.__mcpAbnormalClosures.lastSuccessfulConnection = Date.now();
        // Reset consecutive counter on successful connection
        // @ts-ignore
        window.__mcpAbnormalClosures.consecutiveCount = 0;
      }
    }
    
    // Notify subscribers
    this.notifySubscribers({ type: 'connected' });
    
    // Request initial status
    this.send({ type: 'status_request' });
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const data = JSON.parse(event.data);
      
      console.log('[MCP Client] Received message type:', data.type);
      
      // Handle special message types
      switch (data.type) {
        case 'server_status':
        case 'serverStatus':
          console.log('[MCP Client] Received server status with', data.servers ? data.servers.length : 0, 'servers');
          this.notifySubscribers({ type: 'status_update', servers: data.servers || [] });
          break;
          
        case 'tools_updated':
        case 'serverTools':
          console.log('[MCP Client] Received tool update with', data.tools ? data.tools.length : 0, 'tools');
          this.notifySubscribers({ type: 'tool_update', tools: data.tools || [] });
          break;
          
        case 'pong':
          // Handle ping-pong for connection monitoring
          if (data.metrics) {
            // If the server sent connection quality metrics, forward them
            const connectionMetrics: ConnectionQualityMetrics = {
              latency: data.rtt || 0,
              packetLoss: 0, // We'll calculate this from our ping history
              stability: 100, // Default to 100% stable until we have more data
              lastUpdated: new Date(),
              connectionAge: data.metrics.connectionAge || 0,
              pingHistory: []
            };
            
            // Forward server metrics to subscribers
            this.notifySubscribers({ 
              type: 'connection_quality', 
              metrics: connectionMetrics 
            });
          }
          break;
          
        case 'server_ping':
          // Respond to server pings immediately with a client pong
          // This helps with bidirectional connection quality monitoring
          this.send({
            type: 'client_pong',
            id: data.id, // Echo back the same ID
            timestamp: Date.now(),
            clientTime: new Date().toISOString(),
            originalServerTime: data.serverTime,
            roundTripTime: data.timestamp ? Date.now() - data.timestamp : null,
            // Include basic client metrics
            metrics: {
              userAgent: navigator.userAgent,
              connectionState: this.getState(),
              networkType: (navigator as any).connection?.type || 'unknown',
              isReplit: this.isInReplitEnvironment()
            }
          });
          break;
          
        default:
          // Pass other messages to subscribers
          console.log('[MCP Client] Received general message:', data);
          this.notifySubscribers({ type: 'message', data });
          break;
      }
    } catch (error) {
      console.error('[MCP Client] Error parsing message:', error, event.data);
      
      // Try to still deliver as raw data in case of parse error
      try {
        this.notifySubscribers({ 
          type: 'message', 
          data: { 
            type: 'unparsed', 
            rawData: event.data 
          } 
        });
      } catch (e) {
        console.error('[MCP Client] Failed to deliver unparsed message');
      }
    }
  }

  private handleClose(event: CloseEvent): void {
    console.log(`[MCP Client] WebSocket closed: ${event.code} ${event.reason || ''}`);
    
    // Check for internal cleanup messages to avoid reconnection loops
    if (event.reason === 'Cleaning up before new connection' || 
        event.reason === 'Cleaning up before reconnect' || 
        event.reason === 'Force reconnect') {
      console.log('[MCP Client] Closure due to internal cleanup, skipping reconnect handling');
      return;
    }
    
    // Notify subscribers
    this.notifySubscribers({ 
      type: 'disconnected', 
      code: event.code, 
      reason: event.reason 
    });
    
    // Don't attempt to reconnect if this was an intentional close
    if (this.intentionalClose) {
      console.log('[MCP Client] Intentional close, not reconnecting');
      return;
    }
    
    // Check for reconnection loop
    if (typeof window !== 'undefined') {
      // @ts-ignore - Using a custom property on window for tracking reconnects
      if (!window.__mcpCloseCount) {
        // @ts-ignore
        window.__mcpCloseCount = 0;
        // @ts-ignore
        window.__mcpCloseTimestamp = Date.now();
      }
      
      // @ts-ignore
      window.__mcpCloseCount++;
      
      // Calculate how many closes we've seen in the last 5 seconds
      // @ts-ignore
      const timeSinceFirstClose = Date.now() - window.__mcpCloseTimestamp;
      // @ts-ignore
      const closesPerSecond = window.__mcpCloseCount / (timeSinceFirstClose / 1000);
      
      // If we detect we're in a reconnection loop (too many closes in a short time)
      // @ts-ignore
      if (window.__mcpCloseCount > 3 && closesPerSecond > 0.5) {
        // @ts-ignore
        console.log(`[MCP Client] Possible close loop detected (${window.__mcpCloseCount} closes in ${timeSinceFirstClose/1000}s). Taking a break...`);
        // Reset the counter but wait longer to attempt the next reconnection
        // @ts-ignore
        window.__mcpCloseCount = 0; 
        // @ts-ignore
        window.__mcpCloseTimestamp = Date.now();
        
        // Use a longer delay to break the cycle
        console.log('[MCP Client] Scheduling delayed reconnect to break potential loop');
        setTimeout(() => {
          this.reconnectWithDelay(5000); // 5 second cooling period
        }, 1000);
        
        return;
      }
    }
    
    // Check for abnormal closure or server restart
    switch (event.code) {
      case 1000: // Normal closure
        // Only reconnect on normal closure if it wasn't from any of our internal actions
        if (!event.reason || 
            (event.reason !== 'Intentional disconnect by client' && 
             event.reason !== 'Cleaning up before new connection' && 
             event.reason !== 'Cleanup before reconnect' &&
             event.reason !== 'Force reconnect')) {
          console.log('[MCP Client] Normal closure, but unintentional - scheduling reconnect');
          this.scheduleReconnect();
        } else {
          console.log(`[MCP Client] Skipping reconnect for intentional action: ${event.reason}`);
        }
        break;
        
      case 1001: // Going away
        // Server is restarting or going away
        console.log('[MCP Client] Server going away (code 1001), scheduling quick reconnect');
        this.reconnectWithDelay(1000);
        break;
        
      case 1006: // Abnormal closure
        console.log('[MCP Client] Abnormal closure detected (code 1006)');
        
        // If intentional close was flagged, don't reconnect
        if (this.intentionalClose) {
          console.log('[MCP Client] Intentional close, not reconnecting');
          return;
        }
        
        // Track abnormal closures to detect recurring issues
        if (typeof window !== 'undefined') {
          // @ts-ignore - custom property to track abnormal closures
          if (!window.__mcpAbnormalClosures) {
            // @ts-ignore
            window.__mcpAbnormalClosures = {
              count: 0,
              consecutiveCount: 0,
              timestamp: Date.now(),
              lastClosureTime: 0,
              lastSuccessfulConnection: 0
            };
          }
          
          const now = Date.now();
          // @ts-ignore
          const timeSinceLastClosure = now - window.__mcpAbnormalClosures.lastClosureTime;
          
          // Reset consecutive counter if it's been a while since last closure
          if (timeSinceLastClosure > 30000) { // More than 30 seconds (increased from 10s for Replit)
            // @ts-ignore
            window.__mcpAbnormalClosures.consecutiveCount = 0;
          }
          
          // @ts-ignore
          window.__mcpAbnormalClosures.count++;
          // @ts-ignore
          window.__mcpAbnormalClosures.consecutiveCount++;
          // @ts-ignore
          window.__mcpAbnormalClosures.lastClosureTime = now;
          
          // @ts-ignore
          console.log(`[MCP Client] Abnormal closure #${window.__mcpAbnormalClosures.consecutiveCount} (total: ${window.__mcpAbnormalClosures.count})`);
          
          // For Replit environments, implement a much more relaxed circuit breaker
          const isReplit = this.isInReplitEnvironment();
          const circuitBreakerThreshold = isReplit ? 15 : 5; // Higher threshold for Replit
          
          // Apply circuit breaker pattern for too many abnormal closures in succession
          // @ts-ignore
          if (window.__mcpAbnormalClosures.consecutiveCount > circuitBreakerThreshold) {
            // Use more aggressive backoff with much longer delays
            const baseTime = isReplit ? 5000 : 5000; // Base delay is the same
            const multiplier = isReplit ? 1.2 : 1.5; // But slower growth for Replit
            const maxTime = isReplit ? 15000 : 30000; // Lower max time for Replit
            
            const backoffTime = Math.min(baseTime * Math.pow(multiplier, 
              // @ts-ignore
              window.__mcpAbnormalClosures.consecutiveCount - circuitBreakerThreshold), maxTime);
            
            // Add jitter to avoid thundering herd problems
            const jitter = (Math.random() * 0.3) - 0.15; // ±15% jitter
            const finalBackoffTime = Math.round(backoffTime * (1 + jitter));
              
            console.log(`[MCP Client] Circuit breaker activated - taking a break (${Math.round(finalBackoffTime/1000)}s) due to ${
              // @ts-ignore
              window.__mcpAbnormalClosures.consecutiveCount} consecutive abnormal closures`);
              
            // Hard reset socket state after the break
            setTimeout(() => {
              console.log('[MCP Client] Circuit breaker timeout complete, attempting fresh connection');
              this.reconnectAttempt = 0; // Reset counter for fresh start
              // @ts-ignore
              window.__mcpAbnormalClosures.consecutiveCount = 0; // Reset consecutive counter
              this.connect();
            }, finalBackoffTime);
            
            return; // Skip immediate reconnection
          }
        }
        
        // For Replit environment, use a smarter adaptive strategy for abnormal closures
        if (this.isInReplitEnvironment()) {
          console.log('[MCP Client] Replit environment detected, using fixed delay reconnection strategy');
          
          // Progressive fixed delay based on consecutive failures but capped for Replit
          // @ts-ignore
          const consecutiveFailures = window.__mcpAbnormalClosures?.consecutiveCount || 1;
          
          // Use a gentler growth curve with higher base and lower max for Replit
          // This creates more stable delay times without excessive waiting
          const baseDelay = 1000; // 1 second base
          const maxDelay = 3000;  // 3 second max (lowered from 5 seconds)
          
          // Add jitter to prevent connection storms (±20%)
          const jitter = (Math.random() * 0.4) - 0.2;
          
          // Linear growth with slight progression instead of exponential for Replit
          // This prevents the delay from growing too quickly with consecutive failures
          const adaptiveDelay = Math.min(
            baseDelay + (consecutiveFailures * 200), 
            maxDelay
          );
          
          // Apply jitter to the final delay
          const finalDelay = Math.round(adaptiveDelay * (1 + jitter));
          
          console.log(`[MCP Client] Using adaptive delay for Replit: ${finalDelay}ms (base: ${adaptiveDelay}ms with ${(jitter*100).toFixed(1)}% jitter)`);
          this.reconnectWithDelay(finalDelay);
        } else {
          // For other environments, use a progressive delay based on attempt count
          const quickReconnectDelay = this.reconnectAttempt < 2 ? 1000 : 2000;
          console.log(`[MCP Client] Using progressive delay: ${quickReconnectDelay}ms`);
          this.reconnectWithDelay(quickReconnectDelay);
        }
        break;
        
      case 1012: // Server restart
        console.log('[MCP Client] Server restarting (code 1012), scheduling quick reconnect');
        this.reconnectWithDelay(1500);
        break;
        
      case 1008: // Policy violation
      case 1011: // Internal error
        // These indicate server-side issues - use a more conservative approach
        console.log(`[MCP Client] Server error (code ${event.code}), scheduling slower reconnect`);
        const serverErrorDelay = 3000; // 3 seconds for server errors
        this.reconnectWithDelay(serverErrorDelay);
        break;
        
      default:
        // Any other close code - use standard exponential backoff
        console.log(`[MCP Client] Unintentional close with code ${event.code}, scheduling standard reconnect`);
        this.scheduleReconnect();
        break;
    }
  }
  
  /**
   * Check if we're in a Replit environment
   */
  private isInReplitEnvironment(): boolean {
    const host = window.location.host;
    return (
      host.includes('replit.dev') || 
      host.includes('replit.app') ||
      host.includes('repl.co') || 
      host.includes('id.repl.co') ||
      host.includes('worf.replit.dev')
    );
  }

  private handleError(event: Event): void {
    console.error('[MCP Client] WebSocket error occurred');
    
    // Notify subscribers
    this.notifySubscribers({ 
      type: 'error', 
      error: event
    });
    
    // For Replit environment, handle errors differently
    if (this.isInReplitEnvironment()) {
      // In Replit, WebSocket errors are often temporary network issues
      // Schedule a quick reconnect instead of waiting for the close event
      console.log('[MCP Client] Detected error in Replit environment, scheduling quick reconnect');
      
      // Use a very short delay to avoid reconnect storms
      setTimeout(() => {
        if (this.socket?.readyState === WebSocket.CLOSED) {
          // Socket already closed, use normal reconnect flow
          this.scheduleReconnect();
        } else if (this.socket?.readyState === WebSocket.CONNECTING) {
          // Socket is still trying to connect, force close and try again
          try {
            this.socket.close(1000, 'Reconnecting after error');
          } catch (e) {
            console.error('[MCP Client] Error closing socket after error:', e);
          }
          
          this.scheduleReconnect();
        }
        // Don't force reconnect if socket is OPEN - the error might be non-fatal
      }, 500);
    }
  }

  /**
   * Schedule a reconnection attempt with exponential backoff
   */
  private scheduleReconnect(): void {
    // Clear any existing reconnect timer
    if (this.reconnectTimer !== null) {
      console.log('[MCP Client] Clearing existing reconnect timer');
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Check if we've reached the maximum reconnect attempts
    if (this.reconnectAttempt >= this.config.maxReconnectAttempts) {
      console.log(`[MCP Client] Maximum reconnect attempts (${this.config.maxReconnectAttempts}) reached, giving up`);
      return;
    }
    
    // Setup advanced reconnection loop detection and circuit breaking
    if (typeof window !== 'undefined') {
      // @ts-ignore - Using a custom property on window for tracking reconnects
      if (!window.__mcpReconnectCount) {
        // @ts-ignore
        window.__mcpReconnectCount = {
          total: 0,          // Total reconnect attempts
          window: 0,         // Reconnects in the current time window
          timestamp: Date.now(),
          lastReconnectTime: 0,
          coolingPeriods: 0, // Number of cooling periods we've triggered
          consecutiveAttempts: 0 // Consecutive attempts without a successful connection
        };
      }

      const now = Date.now();
      // @ts-ignore
      const timeSinceFirstReconnect = now - window.__mcpReconnectCount.timestamp;
      // @ts-ignore
      const timeSinceLastReconnect = now - window.__mcpReconnectCount.lastReconnectTime;

      // Reset window counter if it's been more than 10 seconds
      if (timeSinceFirstReconnect > 10000) {
        // @ts-ignore
        window.__mcpReconnectCount.timestamp = now;
        // @ts-ignore
        window.__mcpReconnectCount.window = 0;
      }

      // Reset consecutive counter if it's been a long time since last reconnect
      if (timeSinceLastReconnect > 30000) { // More than 30 seconds
        // @ts-ignore
        window.__mcpReconnectCount.consecutiveAttempts = 0;
        // @ts-ignore
        window.__mcpReconnectCount.coolingPeriods = 0;
      }

      // Increment reconnect counters
      // @ts-ignore
      window.__mcpReconnectCount.total++;
      // @ts-ignore
      window.__mcpReconnectCount.window++;
      // @ts-ignore
      window.__mcpReconnectCount.consecutiveAttempts++;
      // @ts-ignore
      window.__mcpReconnectCount.lastReconnectTime = now;

      // Calculate reconnects per second in current window
      // @ts-ignore
      const reconnectsPerSecond = window.__mcpReconnectCount.window / (timeSinceFirstReconnect / 1000);

      // Advanced exponential circuit breaker pattern
      // @ts-ignore
      const consecutiveAttempts = window.__mcpReconnectCount.consecutiveAttempts;
      // @ts-ignore
      const previousCoolingPeriods = window.__mcpReconnectCount.coolingPeriods;

      // Detect severe reconnection storm (many reconnects in short time)
      // @ts-ignore
      if (window.__mcpReconnectCount.window > 5 && reconnectsPerSecond > 0.5) {
        // @ts-ignore
        console.log(`[MCP Client] Possible reconnection loop detected (${window.__mcpReconnectCount.window} attempts in ${timeSinceFirstReconnect/1000}s). Taking a break...`);
        
        // Increase cooling period exponentially based on previous cooling periods
        const coolingPeriodDuration = Math.min(5000 * Math.pow(1.5, previousCoolingPeriods), 30000);
        
        // @ts-ignore
        window.__mcpReconnectCount.coolingPeriods++;
        // @ts-ignore
        window.__mcpReconnectCount.window = 0;
        // @ts-ignore
        window.__mcpReconnectCount.timestamp = now;
        
        console.log(`[MCP Client] Applying circuit breaker with ${coolingPeriodDuration/1000}s cooling period`);
        
        // Schedule delayed reconnect with full reset
        this.reconnectTimer = window.setTimeout(() => {
          console.log('[MCP Client] Resuming connection attempts after cooling period with clean state');
          this.reconnectAttempt = 0; // Reset counter for fresh start
          this.connect();
        }, coolingPeriodDuration);
        
        return;
      }
    }
    
    // Use different reconnection strategies for different environments
    if (this.isInReplitEnvironment()) {
      // For Replit, use a more conservative fixed delay approach
      // This is more reliable in Replit's environment where network conditions can be variable
      const fixedDelay = 1000; // Fixed 1-second delay for Replit
      console.log(`[MCP Client] Replit environment detected, using fixed delay reconnection strategy`);
      console.log(`[MCP Client] Will attempt reconnection in ${fixedDelay}ms (fixed delay)`);
      
      // Schedule the reconnect with safeguards against loops
      this.reconnectTimer = window.setTimeout(() => {
        this.reconnectTimer = null;
        
        // Bail if we already have a connection in any state other than CLOSED
        if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
          console.log(`[MCP Client] Skipping reconnect as socket is in ${this.getReadyStateString(this.socket.readyState)} state`);
          return;
        }
        
        this.reconnectAttempt++;
        
        // Force cleanup of socket reference before connecting to avoid "already connecting" errors
        if (this.socket) {
          console.log('[MCP Client] Cleaning up existing socket before reconnection');
          this.socket.onopen = null;
          this.socket.onclose = null;
          this.socket.onerror = null;
          this.socket.onmessage = null;
          
          try {
            // Set a flag to prevent the close handler from scheduling another reconnect
            this.intentionalClose = true;
            this.socket.close(1000, 'Cleanup before reconnect');
            
            // Reset the flag after a small delay to ensure the close event has been processed
            setTimeout(() => {
              this.intentionalClose = false;
            }, 50);
          } catch (e) {
            // Ignore errors during cleanup
            console.warn('[MCP Client] Error during socket cleanup:', e);
          }
          
          this.socket = null;
        }
        
        // Ensure we don't already have an active connection before connecting
        if (!this.isConnected() && !this.isConnecting()) {
          console.log('[MCP Client] Attempting to reconnect with fixed delay...');
          this.connect();
        } else {
          console.log(`[MCP Client] Skipping reconnect as connection is ${this.isConnected() ? 'already active' : 'in progress'}`);
        }
      }, fixedDelay);
    } else {
      // For regular environments, use normal exponential backoff with jitter
      // Calculate delay with exponential backoff
      const delay = Math.min(
        this.config.initialReconnectDelay * Math.pow(this.config.reconnectBackoffMultiplier, this.reconnectAttempt),
        this.config.maxReconnectDelay
      );

      // Add some randomness to prevent all clients reconnecting simultaneously
      const jitter = 0.1 * delay * Math.random();
      const reconnectDelay = Math.floor(delay + jitter);

      console.log(`[MCP Client] Will attempt reconnection in ${reconnectDelay}ms (attempt ${this.reconnectAttempt + 1}/${this.config.maxReconnectAttempts})`);

      // Schedule the reconnect with the same safeguards as above
      this.reconnectTimer = window.setTimeout(() => {
        this.reconnectTimer = null;
        
        // Bail if we already have a connection in any state other than CLOSED
        if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
          console.log(`[MCP Client] Skipping reconnect as socket is in ${this.getReadyStateString(this.socket.readyState)} state`);
          return;
        }
        
        this.reconnectAttempt++;
        
        // Force cleanup of socket reference before connecting to avoid "already connecting" errors
        if (this.socket) {
          console.log('[MCP Client] Cleaning up existing socket before reconnection');
          this.socket.onopen = null;
          this.socket.onclose = null;
          this.socket.onerror = null;
          this.socket.onmessage = null;
          
          try {
            // Set a flag to prevent the close handler from scheduling another reconnect
            this.intentionalClose = true;
            this.socket.close(1000, 'Cleanup before reconnect');
            
            // Reset the flag after a small delay to ensure the close event has been processed
            setTimeout(() => {
              this.intentionalClose = false;
            }, 50);
          } catch (e) {
            // Ignore errors during cleanup
            console.warn('[MCP Client] Error during socket cleanup:', e);
          }
          
          this.socket = null;
        }
        
        // Ensure we don't already have an active connection before connecting
        if (!this.isConnected() && !this.isConnecting()) {
          console.log('[MCP Client] Attempting to reconnect...');
          this.connect();
        } else {
          console.log(`[MCP Client] Skipping reconnect as connection is ${this.isConnected() ? 'already active' : 'in progress'}`);
        }
      }, reconnectDelay);
    }
  }
  
  /**
   * Convert WebSocket readyState to a readable string
   */
  private getReadyStateString(readyState: number): string {
    switch (readyState) {
      case WebSocket.CONNECTING: return 'CONNECTING';
      case WebSocket.OPEN: return 'OPEN';
      case WebSocket.CLOSING: return 'CLOSING';
      case WebSocket.CLOSED: return 'CLOSED';
      default: return `UNKNOWN (${readyState})`;
    }
  }

  /**
   * Notify all subscribers of an event
   */
  private notifySubscribers(event: WebSocketEvent): void {
    this.eventHandlers.forEach(handler => {
      try {
        handler(event);
      } catch (error) {
        console.error('[MCP Client] Error in event handler:', error);
      }
    });
  }

  /**
   * Reconnect with a specific delay instead of using exponential backoff
   * @param delay The delay in milliseconds
   */
  private reconnectWithDelay(delay: number): void {
    // Clear any existing reconnect timer
    if (this.reconnectTimer !== null) {
      console.log('[MCP Client] Clearing existing reconnect timer');
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    console.log(`[MCP Client] Will attempt reconnection in ${delay}ms (fixed delay)`);
    
    // Schedule the reconnect with fixed delay
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectAttempt++; // Still increment the attempt count
      
      // Bail if we already have a connection in any state other than CLOSED
      if (this.socket && this.socket.readyState !== WebSocket.CLOSED) {
        console.log(`[MCP Client] Skipping reconnect as socket is in ${this.getReadyStateString(this.socket.readyState)} state`);
        return;
      }
      
      // Force cleanup of socket reference before connecting to avoid "already connecting" errors
      if (this.socket) {
        console.log('[MCP Client] Cleaning up existing socket before reconnection');
        this.socket.onopen = null;
        this.socket.onclose = null;
        this.socket.onerror = null;
        this.socket.onmessage = null;
        
        try {
          // Set a flag to prevent the close handler from scheduling another reconnect
          this.intentionalClose = true;
          this.socket.close(1000, 'Cleanup before reconnect');
          
          // Reset the flag after a small delay to ensure the close event has been processed
          setTimeout(() => {
            this.intentionalClose = false;
          }, 50);
        } catch (e) {
          // Ignore errors during cleanup
          console.warn('[MCP Client] Error during socket cleanup:', e);
        }
        
        this.socket = null;
      }
      
      // Ensure we don't already have an active connection before connecting
      if (!this.isConnected() && !this.isConnecting()) {
        console.log('[MCP Client] Attempting to reconnect with fixed delay...');
        this.connect();
      } else {
        console.log(`[MCP Client] Skipping reconnect as connection is ${this.isConnected() ? 'already active' : 'in progress'}`);
      }
    }, delay);
  }

  /**
   * Force a reconnection
   */
  public forceReconnect(): void {
    console.log('[MCP Client] Forcing reconnection...');
    
    // Clean up connection monitor first
    if (this.connectionMonitor) {
      this.connectionMonitor();
      this.connectionMonitor = null;
    }
    
    // Get the current socket state
    const socketState = this.getState();
    console.log(`[MCP Client] Current socket state before force reconnect: ${socketState}`);
    
    // Mark as intentional close to prevent reconnection logic from reconnection loop
    this.intentionalClose = true;
    
    // Close current connection if open
    if (this.socket) {
      try {
        this.socket.close(1000, 'Force reconnect');
      } catch (error) {
        console.error('[MCP Client] Error closing socket:', error);
      }
      
      // Always null out the socket reference to avoid "already connecting" errors
      this.socket = null;
    }
    
    // Reset reconnect attempt count
    this.reconnectAttempt = 0;
    
    // Clear any pending reconnect timers
    if (this.reconnectTimer !== null) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // For Replit environment, use a more robust reconnection strategy
    const reconnectDelay = this.isInReplitEnvironment() ? 1000 : 200;
    
    // Wait a brief moment before reconnecting to allow the closing to complete
    setTimeout(() => {
      // Reset intentional close flag before connecting
      this.intentionalClose = false;
      
      // Check if socket is completely closed before reconnecting
      if (this.socket === null || this.socket.readyState === WebSocket.CLOSED) {
        console.log('[MCP Client] Closure due to internal cleanup, skipping reconnect handling');
        // Connect again
        this.connect();
      } else {
        console.log('[MCP Client] Socket not fully closed yet, scheduling delayed reconnect');
        // Give it a bit more time and try again
        setTimeout(() => {
          this.socket = null; // Force cleanup
          this.intentionalClose = false;
          this.connect();
        }, 500);
      }
    }, reconnectDelay);
  }
}

// Create and export a singleton instance for the application
export const mcpClient = new McpWebSocketClient();