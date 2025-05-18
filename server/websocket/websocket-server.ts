import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { Server } from 'http';

/**
 * MCP WebSocket Server implementation
 * Handles WebSocket connections for the MCP Gateway
 */
export class MCPWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<string, WebSocket> = new Map();
  private pingIntervalId: NodeJS.Timeout | null = null;
  private debug: boolean;

  constructor(server: Server, options: { path: string; debug?: boolean } = { path: '/ws' }) {
    this.debug = options.debug || false;

    this.wss = new WebSocketServer({
      server,
      path: options.path
    });

    this.setupEventHandlers();
    this.startPingInterval();

    this.log(`WebSocket server started on path: ${options.path}`);
  }

  /**
   * Set up WebSocket server event handlers
   */
  private setupEventHandlers(): void {
    this.wss.on('connection', (ws, request) => this.handleConnection(ws, request));
    this.wss.on('error', (error) => this.log('WebSocket server error:', error));
    this.wss.on('close', () => {
      this.log('WebSocket server closed');
      this.stopPingInterval();
    });
  }

  /**
   * Handle WebSocket connection
   */
  private handleConnection(ws: WebSocket, request: IncomingMessage): void {
    const clientId = this.generateClientId(request);
    this.clients.set(clientId, ws);

    this.log(`Client connected: ${clientId}, Total clients: ${this.clients.size}`);
    
    // Send welcome message
    ws.send(JSON.stringify({
      type: 'system',
      message: 'Welcome to MCP WebSocket Server',
      timestamp: Date.now(),
      clientId
    }));

    ws.on('message', (data) => this.handleMessage(clientId, ws, data));
    
    ws.on('close', (code, reason) => {
      this.log(`Client disconnected: ${clientId}, Code: ${code}, Reason: ${reason}`);
      this.clients.delete(clientId);
    });
    
    ws.on('error', (error) => {
      this.log(`Client error: ${clientId}`, error);
      this.clients.delete(clientId);
    });
  }

  /**
   * Handle WebSocket message
   */
  private handleMessage(clientId: string, ws: WebSocket, data: WebSocket.Data): void {
    try {
      // Parse message
      const message = JSON.parse(data.toString());
      
      // Handle different message types
      switch (message.type) {
        case 'ping':
          this.handlePing(ws, message);
          break;
        
        case 'message':
          this.log(`Received message from ${clientId}:`, message);
          this.broadcastMessage({
            type: 'message',
            from: clientId,
            content: message.content,
            timestamp: Date.now()
          });
          break;
        
        default:
          this.log(`Received unknown message type from ${clientId}:`, message);
      }
    } catch (error) {
      this.log(`Error handling message from ${clientId}:`, error);
    }
  }

  /**
   * Handle ping message
   */
  private handlePing(ws: WebSocket, pingMessage: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      // Send pong response
      ws.send(JSON.stringify({
        type: 'pong',
        id: pingMessage.id,
        timestamp: Date.now(),
        echo: pingMessage.timestamp
      }));
    }
  }

  /**
   * Generate unique client ID
   */
  private generateClientId(request: IncomingMessage): string {
    const ip = request.socket.remoteAddress || '0.0.0.0';
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    
    return `client-${ip.replace(/[.:]/g, '-')}-${timestamp}-${random}`;
  }

  /**
   * Broadcast message to all connected clients
   */
  public broadcastMessage(message: any): void {
    const messageStr = JSON.stringify(message);
    
    this.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    });
  }

  /**
   * Start ping interval
   */
  private startPingInterval(): void {
    // Send server ping to all clients every 30 seconds
    this.pingIntervalId = setInterval(() => {
      const timestamp = Date.now();
      
      this.clients.forEach((client, clientId) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({
            type: 'server-ping',
            timestamp,
            clients: this.clients.size
          }));
        } else if (client.readyState === WebSocket.CLOSED || client.readyState === WebSocket.CLOSING) {
          this.log(`Removing stale client: ${clientId}`);
          this.clients.delete(clientId);
        }
      });
    }, 30000);
  }

  /**
   * Stop ping interval
   */
  private stopPingInterval(): void {
    if (this.pingIntervalId) {
      clearInterval(this.pingIntervalId);
      this.pingIntervalId = null;
    }
  }

  /**
   * Close the WebSocket server
   */
  public close(): void {
    this.stopPingInterval();
    this.wss.close();
  }

  /**
   * Log message if debug enabled
   */
  private log(...args: any[]): void {
    if (this.debug) {
      console.log('[MCPWebSocketServer]', ...args);
    }
  }
}

/**
 * Create the WebSocket server
 */
export function createWebSocketServer(server: Server, options?: { path: string; debug?: boolean }): MCPWebSocketServer {
  const defaultPath = '/ws/mcp-proxy';
  const wsPath = options?.path || defaultPath;
  
  return new MCPWebSocketServer(server, {
    path: wsPath,
    debug: options?.debug || process.env.NODE_ENV !== 'production'
  });
}