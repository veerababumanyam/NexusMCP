/**
 * WebSocket Utility Functions for MCP
 * Provides helper functions for WebSocket communication and monitoring.
 */

/**
 * Generate a unique ping ID
 * @returns Unique ping ID
 */
export function generatePingId(): string {
  return `ping-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

/**
 * Calculate exponential backoff time
 * @param attempt - Attempt number (starting from 1)
 * @param baseDelay - Base delay in ms
 * @param maxDelay - Maximum delay in ms
 * @returns Delay in ms
 */
export function calculateBackoff(
  attempt: number,
  baseDelay: number = 1000,
  maxDelay: number = 30000
): number {
  return Math.min(
    Math.floor(baseDelay * Math.pow(1.5, attempt)),
    maxDelay
  );
}

/**
 * Check WebSocket connection quality
 * @param pingTimes - Array of ping times (ms)
 * @param successRatio - Ratio of successful pings/pongs (0-1)
 * @returns Object containing quality indicators
 */
export function checkConnectionQuality(
  pingTimes: number[],
  successRatio: number
): { quality: number; issues: string[] } {
  const issues: string[] = [];
  
  // No data yet
  if (pingTimes.length === 0) {
    return { quality: 100, issues: [] };
  }
  
  // Calculate metrics
  const avgPing = pingTimes.reduce((sum, time) => sum + time, 0) / pingTimes.length;
  const variance = calculateVariance(pingTimes);
  const jitter = Math.sqrt(variance);
  
  // Check for poor connection
  if (avgPing > 300) {
    issues.push(`High latency detected (avg: ${avgPing.toFixed(1)}ms)`);
  }
  
  if (jitter > 100) {
    issues.push(`High jitter detected (±${jitter.toFixed(1)}ms)`);
  }
  
  if (successRatio < 0.9) {
    issues.push(`Message loss detected (${((1 - successRatio) * 100).toFixed(1)}% lost)`);
  }
  
  // Calculate quality score (100 = perfect, 0 = unusable)
  let quality = 100;
  
  // Reduce quality score based on average ping (0-40% penalty)
  quality -= Math.min(40, avgPing / 10);
  
  // Reduce quality score based on jitter (0-30% penalty)
  quality -= Math.min(30, jitter / 5);
  
  // Reduce quality score based on message loss (0-30% penalty)
  quality -= Math.min(30, (1 - successRatio) * 100);
  
  return {
    quality: Math.max(0, Math.round(quality)),
    issues
  };
}

/**
 * Calculate variance of an array of numbers
 * @param values - Array of numbers
 * @returns Variance
 */
function calculateVariance(values: number[]): number {
  const avg = values.reduce((sum, val) => sum + val, 0) / values.length;
  const squareDiffs = values.map(value => {
    const diff = value - avg;
    return diff * diff;
  });
  return squareDiffs.reduce((sum, val) => sum + val, 0) / values.length;
}

/**
 * Format a websocket URL based on the current page URL
 * @param path - WebSocket path
 * @param isReplit - Whether running in Replit environment
 * @returns Formatted WebSocket URL
 */
export function formatWebSocketUrl(path: string, isReplit: boolean): string {
  if (typeof window === 'undefined') {
    return path; // Server-side
  }
  
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const hostname = window.location.host;
  
  // Ensure path starts with a slash
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  
  return `${protocol}//${hostname}${normalizedPath}`;
}

/**
 * Create a stable WebSocket URL specifically for Replit environment
 * This handles the quirks of Replit's proxy setup
 * 
 * @param path WebSocket path (e.g., '/ws' or '/ws/mcp-proxy')
 * @returns Formatted WebSocket URL optimized for stability
 */
export function createStableWebSocketUrl(path: string): string {
  // Detect if running in Replit environment
  const isReplit = typeof window !== 'undefined' && window.location.hostname.includes('replit');
  
  return formatWebSocketUrl(path, isReplit);
}

/**
 * Monitor WebSocket connection quality
 * @param socket WebSocket to monitor
 * @param callback Function to call on connection status change
 * @returns Cleanup function to stop monitoring
 */
export function monitorConnection(socket: WebSocket, callback: (event: { type: string }) => void): () => void {
  const pingIntervalId = setInterval(() => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      try {
        // Send ping to keep connection alive
        const pingId = generatePingId();
        socket.send(JSON.stringify({
          type: 'ping',
          id: pingId,
          timestamp: Date.now()
        }));
      } catch (error) {
        console.error('Error sending ping:', error);
        callback({ type: 'error' });
      }
    } else if (socket && socket.readyState !== WebSocket.CONNECTING) {
      callback({ type: 'closed' });
    }
  }, 30000); // 30 second ping interval
  
  // Return cleanup function
  return () => {
    clearInterval(pingIntervalId);
  };
}

/**
 * Connection quality metrics interface
 */
export interface ConnectionQualityMetrics {
  pingTimes: number[];
  avgPing: number;
  successRate: number;
  quality: number;
  isStable: boolean;
}

/**
 * Apply Replit-specific WebSocket fixes and enhancements
 * @returns Object with utility functions
 */
export function installWebSocketFixes() {
  const isReplit = typeof window !== 'undefined' && window.location.hostname.includes('replit');
  console.log(`[WebSocket Fix] Installing WebSocket fixes. Replit environment detected: ${isReplit}`);
  
  // Keep track of reconnect attempts
  let reconnectCount = 0;
  let reconnectMaxAttempts = 5;
  let lastSuccessfulConnection = 0;
  
  // Reset reconnect count after 60 seconds of stability
  const STABILITY_THRESHOLD = 60000; // 60 seconds
  
  setInterval(() => {
    if (Date.now() - lastSuccessfulConnection > STABILITY_THRESHOLD && reconnectCount > 0) {
      console.log('[WebSocket Fix] Resetting reconnect count after stability period');
      reconnectCount = 0;
    }
  }, 30000);
  
  // Return utility functions
  return {
    /**
     * Create WebSocket with Replit-specific optimizations
     */
    createReliableSocket(url: string, protocols?: string | string[]): WebSocket {
      if (isReplit) {
        console.log(`[WebSocket Fix] Creating optimized WebSocket for Replit: ${url}`);
      }
      
      const socket = new WebSocket(url, protocols);
      
      socket.addEventListener('open', () => {
        lastSuccessfulConnection = Date.now();
        console.log(`[WebSocket Fix] Connection established to ${url}`);
      });
      
      return socket;
    },
    
    /**
     * Handle reconnection with exponential backoff
     */
    handleReconnect(url: string, protocols?: string | string[]): { 
      shouldReconnect: boolean, 
      reconnectDelay: number,
      createSocket: () => WebSocket 
    } {
      // Increment reconnect count
      reconnectCount++;
      
      // Calculate backoff time
      const baseDelay = isReplit ? 2000 : 1000;
      const reconnectDelay = calculateBackoff(reconnectCount, baseDelay, 30000);
      
      // Check if we should stop trying
      const shouldReconnect = reconnectCount <= reconnectMaxAttempts;
      
      console.log(`[WebSocket Fix] Attempting to reconnect in ${reconnectDelay}ms (attempt ${reconnectCount}/${reconnectMaxAttempts})`);
      
      // Create a new socket function
      const createSocket = () => new WebSocket(url, protocols);
      
      return {
        shouldReconnect,
        reconnectDelay,
        createSocket
      };
    },
    
    /**
     * Reset reconnection counter
     */
    resetReconnectCount() {
      reconnectCount = 0;
    }
  };
}

/**
 * Creates a reconnecting WebSocket that automatically reconnects on disconnection
 * 
 * @param url WebSocket URL to connect to
 * @param protocols WebSocket protocols
 * @param options Options for reconnection behavior
 * @returns Enhanced WebSocket with reconnection capabilities
 */
export function createReconnectingWebSocket(
  url: string,
  protocols?: string | string[],
  options: {
    maxAttempts?: number;
    reconnectInterval?: number;
    maxReconnectInterval?: number;
  } = {}
): WebSocket {
  // Default options
  const maxAttempts = options.maxAttempts || 5;
  const reconnectInterval = options.reconnectInterval || 1000;
  const maxReconnectInterval = options.maxReconnectInterval || 30000;
  
  // Create WebSocket
  const socket = new WebSocket(url, protocols);
  
  // Keep track of reconnection attempts
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  
  // Function to reconnect
  const reconnect = () => {
    if (reconnectAttempts >= maxAttempts) {
      console.log(`[WebSocket Fix] Maximum reconnection attempts (${maxAttempts}) reached`);
      return;
    }
    
    // Clear any existing timers
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
    
    // Calculate backoff
    const delay = Math.min(
      reconnectInterval * Math.pow(1.5, reconnectAttempts),
      maxReconnectInterval
    );
    
    reconnectAttempts++;
    console.log(`[WebSocket Fix] Attempting to reconnect in ${delay}ms (attempt ${reconnectAttempts}/${maxAttempts})`);
    
    reconnectTimer = setTimeout(() => {
      console.log(`[WebSocket Fix] Reconnecting...`);
      // Create new socket (this will replace the old one)
      const newSocket = createReconnectingWebSocket(url, protocols, options);
      
      // Copy over all event handlers from old socket to new one
      // This ensures continuity of event handling
      const oldSocketEvents = (socket as any)._events;
      if (oldSocketEvents) {
        Object.keys(oldSocketEvents).forEach(eventName => {
          const handlers = oldSocketEvents[eventName];
          if (Array.isArray(handlers)) {
            handlers.forEach(handler => {
              newSocket.addEventListener(eventName, handler);
            });
          } else if (typeof handlers === 'function') {
            newSocket.addEventListener(eventName, handlers);
          }
        });
      }
      
      // Replace old socket with new socket (hacky but effective)
      Object.defineProperty(socket, 'readyState', {
        get: () => newSocket.readyState
      });
      
      ['send', 'close'].forEach(method => {
        (socket as any)[method] = (...args: any[]) => {
          return (newSocket as any)[method](...args);
        };
      });
    }, delay);
  };
  
  // Handle disconnection
  socket.addEventListener('close', event => {
    // Don't reconnect if closure was clean/intentional
    if (event.code === 1000 || event.code === 1001) {
      console.log(`[WebSocket Fix] Clean close, not reconnecting: ${event.code} ${event.reason}`);
      return;
    }
    
    reconnect();
  });
  
  // Reset reconnect attempts on successful connection
  socket.addEventListener('open', () => {
    console.log(`[WebSocket Fix] Connection established`);
    reconnectAttempts = 0;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  });
  
  return socket;
}