/**
 * WebSocket Upgrade Handler
 * 
 * Coordinates WebSocket upgrade requests to ensure only one WebSocket server
 * handles each connection based on the requested path.
 */

import { IncomingMessage, Server as HttpServer } from 'http';
import { ServerOptions, WebSocketServer } from 'ws';
import { Socket } from 'net';
import url from 'url';

interface RegisteredWebSocketServer {
  path: string;
  server: WebSocketServer;
}

/**
 * WebSocket Upgrade Handler
 * 
 * Manages upgrade requests to WebSocket connections to prevent
 * conflicts when multiple WebSocket servers are running.
 */
export class WebSocketUpgradeHandler {
  private static instance: WebSocketUpgradeHandler;
  private registeredServers: RegisteredWebSocketServer[] = [];
  private initialized: boolean = false;

  /**
   * Get the singleton instance of the WebSocketUpgradeHandler
   */
  public static getInstance(): WebSocketUpgradeHandler {
    if (!WebSocketUpgradeHandler.instance) {
      WebSocketUpgradeHandler.instance = new WebSocketUpgradeHandler();
    }
    return WebSocketUpgradeHandler.instance;
  }

  /**
   * Initialize the upgrade handler to listen for upgrade events
   */
  public initialize(httpServer: HttpServer): void {
    if (this.initialized) {
      return;
    }

    // Remove default upgrade listeners from httpServer
    httpServer.removeAllListeners('upgrade');

    // Add our custom upgrade handler
    httpServer.on('upgrade', (request: IncomingMessage, socket: Socket, head: Buffer) => {
      this.handleUpgrade(request, socket, head);
    });

    this.initialized = true;
    console.log('WebSocket Upgrade Handler initialized');
  }

  /**
   * Register a WebSocket server to handle a specific path
   */
  public registerServer(path: string, options: Omit<ServerOptions, 'noServer' | 'server'>): WebSocketServer {
    // Check if a server is already handling this path
    const existingServer = this.registeredServers.find(server => server.path === path);
    if (existingServer) {
      throw new Error(`A WebSocket server is already registered for path: ${path}`);
    }

    // Create a new WebSocket server without attaching it to the HTTP server
    const wsServer = new WebSocketServer({
      ...options,
      noServer: true, // Crucial to prevent automatic handling of upgrades
    });

    // Register the server
    this.registeredServers.push({
      path,
      server: wsServer
    });

    console.log(`WebSocket server registered for path: ${path}`);
    return wsServer;
  }

  /**
   * Handle an upgrade request and route it to the appropriate WebSocket server
   */
  private handleUpgrade(request: IncomingMessage, socket: Socket, head: Buffer): void {
    const pathname = url.parse(request.url || '').pathname || '';
    
    // Find a registered server that handles this path
    const server = this.registeredServers.find(server => {
      return pathname === server.path || pathname.startsWith(`${server.path}/`);
    });

    if (server) {
      // Pass the upgrade to the appropriate WebSocket server
      server.server.handleUpgrade(request, socket, head, (ws) => {
        // Emit a connection event on the target server
        server.server.emit('connection', ws, request);
      });
    } else {
      // No WebSocket server found for this path
      console.warn(`No WebSocket server registered for path: ${pathname}`);
      // Close the connection
      socket.destroy();
    }
  }

  /**
   * Unregister a WebSocket server
   */
  public unregisterServer(path: string): boolean {
    const index = this.registeredServers.findIndex(server => server.path === path);
    if (index !== -1) {
      // Close the server and remove it from the list
      this.registeredServers[index].server.close();
      this.registeredServers.splice(index, 1);
      console.log(`WebSocket server unregistered for path: ${path}`);
      return true;
    }
    return false;
  }

  /**
   * Close all registered WebSocket servers
   */
  public closeAll(): void {
    this.registeredServers.forEach(server => {
      server.server.close();
    });
    this.registeredServers = [];
    console.log('All WebSocket servers closed');
  }
}