/**
 * WebSocket Setup Utility
 * 
 * This module provides a wrapper for initializing WebSocket connections
 * with proper error handling and browser compatibility fixes.
 */

import * as websocketFix from './websocketFix';

/**
 * Setup the MCP WebSocket connection
 * This is the main connection to the MCP Proxy service
 */
export function setupMcpWebSocketConnection() {
  return websocketFix.createReconnectingWebSocket(
    websocketFix.createStableWebSocketUrl('/ws/mcp-proxy'),
    5, // Max reconnect attempts
    2000, // Initial reconnect delay in ms
    (event: Event) => {
      console.log('[MCP WebSocket] Connected');
    },
    (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string);
        console.log('[MCP WebSocket] Message:', data.type);
      } catch (error) {
        console.warn('[MCP WebSocket] Received non-JSON message');
      }
    },
    (event: CloseEvent) => {
      console.log(`[MCP WebSocket] Closed: ${event.code} ${event.reason}`);
    },
    (event: Event) => {
      console.error('[MCP WebSocket] Error:', event);
    }
  );
}

/**
 * Check if WebSocket API is supported in the current browser
 */
export function isWebSocketSupported(): boolean {
  return typeof WebSocket !== 'undefined';
}

/**
 * Safely parse a WebSocket message as JSON
 * Returns null if the message cannot be parsed
 */
export function safeParseWebSocketMessage(data: string): any {
  try {
    return JSON.parse(data);
  } catch (error) {
    console.error('[WebSocket] Error parsing message:', error);
    return null;
  }
}

/**
 * Safely send a message over WebSocket
 * Automatically handles converting objects to JSON
 */
export function safeSendWebSocketMessage(socket: WebSocket | null, message: any): boolean {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return false;
  }
  
  try {
    const messageStr = typeof message === 'string' 
      ? message 
      : JSON.stringify(message);
    
    socket.send(messageStr);
    return true;
  } catch (error) {
    console.error('[WebSocket] Error sending message:', error);
    return false;
  }
}

/**
 * Create heartbeat mechanism to keep WebSocket alive
 * Sends a ping message at regular intervals
 */
export function setupWebSocketHeartbeat(
  socket: WebSocket,
  intervalMs: number = 30000,
  pingMessage: any = { type: 'ping' }
): () => void {
  const pingInterval = setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      safeSendWebSocketMessage(socket, pingMessage);
    }
  }, intervalMs);
  
  return () => clearInterval(pingInterval);
}

/**
 * Simple event emitter for WebSocket events
 */
export class WebSocketEventEmitter {
  private listeners: Map<string, Array<(data: any) => void>> = new Map();
  
  on(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(callback);
  }
  
  off(event: string, callback: (data: any) => void): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }
  
  emit(event: string, data: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }
  
  clear(): void {
    this.listeners.clear();
  }
}

/**
 * Enhanced WebSocket client with event emitter pattern
 */
export class EnhancedWebSocketClient {
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: (() => void) | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts: number;
  private reconnectDelayMs: number;
  
  // Event emitter for WebSocket events
  public events = new WebSocketEventEmitter();
  
  constructor(
    url: string,
    maxReconnectAttempts: number = 5,
    reconnectDelayMs: number = 2000
  ) {
    this.url = url;
    this.maxReconnectAttempts = maxReconnectAttempts;
    this.reconnectDelayMs = reconnectDelayMs;
  }
  
  /**
   * Connect to the WebSocket server
   */
  connect(): void {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }
    
    try {
      // Use WebSocket fix utilities
      const fixedUrl = websocketFix.createStableWebSocketUrl(this.url);
      this.socket = new WebSocket(fixedUrl);
      
      this.socket.onopen = (event) => {
        this.reconnectAttempts = 0;
        this.setupHeartbeat();
        this.events.emit('open', event);
      };
      
      this.socket.onmessage = (event) => {
        const data = safeParseWebSocketMessage(event.data);
        if (data) {
          this.events.emit('message', data);
          
          // Also emit specific event for the message type
          if (data.type) {
            this.events.emit(data.type, data);
          }
        }
      };
      
      this.socket.onclose = (event) => {
        this.clearHeartbeat();
        this.events.emit('close', event);
        
        if (event.code !== 1000) {
          this.attemptReconnect();
        }
      };
      
      this.socket.onerror = (event) => {
        this.events.emit('error', event);
      };
      
    } catch (error) {
      console.error('[EnhancedWebSocket] Connection error:', error);
      this.events.emit('error', error);
      this.attemptReconnect();
    }
  }
  
  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.clearHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.reconnectAttempts = 0;
  }
  
  /**
   * Send a message to the WebSocket server
   */
  send(message: any): boolean {
    return safeSendWebSocketMessage(this.socket, message);
  }
  
  /**
   * Get the current socket instance
   */
  getSocket(): WebSocket | null {
    return this.socket;
  }
  
  /**
   * Set up heartbeat mechanism
   */
  private setupHeartbeat(): void {
    this.clearHeartbeat();
    if (this.socket) {
      this.heartbeatTimer = setupWebSocketHeartbeat(this.socket);
    }
  }
  
  /**
   * Clear heartbeat mechanism
   */
  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      this.heartbeatTimer();
      this.heartbeatTimer = null;
    }
  }
  
  /**
   * Attempt to reconnect to the WebSocket server
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.events.emit('reconnect_failed', { attempts: this.reconnectAttempts });
      return;
    }
    
    this.reconnectAttempts++;
    const delay = this.reconnectDelayMs * Math.pow(1.5, this.reconnectAttempts - 1);
    
    this.events.emit('reconnect_attempt', { 
      attempt: this.reconnectAttempts, 
      maxAttempts: this.maxReconnectAttempts,
      delay
    });
    
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }
}

// Export a default instance for convenience
export default {
  isWebSocketSupported,
  safeParseWebSocketMessage,
  safeSendWebSocketMessage,
  setupWebSocketHeartbeat,
  setupMcpWebSocketConnection,
  EnhancedWebSocketClient
};