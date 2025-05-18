import http from "http";
import axios from "axios";
import { Request, Response } from "express";
import { storage } from "./storage";
import { McpServer } from "@shared/schema";
import { WebSocketServer, WebSocket } from "ws";
import { v4 as uuidv4 } from "uuid";
import { circuitBreakerService } from "./services/circuitBreakerService";

import { McpToolDefinition, McpJsonRpcRequest, McpJsonRpcResponse } from './types/mcp-types';

interface McpConnection {
  serverId: number;
  server: McpServer;
  ws: WebSocket | null;
  tools: McpToolDefinition[];
  isConnected: boolean;
  lastError?: string;
  lastConnected?: Date;
  reconnecting?: boolean;
  requestMap: Map<string, { clientId: string, startTime: number }>;
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    totalLatency: number;
    requestsPerTool: Map<string, number>;
  };
}

/**
 * MCP Proxy Service 
 * 
 * Implements the Model Context Protocol (MCP) Proxy functionality
 * for connecting to and managing MCP-compatible servers.
 * 
 * Following the MCP specification:
 * - JSON-RPC 2.0 compatible
 * - WebSocket and HTTP support
 * - Tool discovery and management
 * - Request forwarding and response handling
 */
export class McpProxyService {
  private connections: Map<number, McpConnection> = new Map();
  private wsServer: WebSocketServer | null = null;
  private clients: Map<string, WebSocket> = new Map();
  private streamHandlers: Map<string | number, (chunk: any) => void> = new Map();
  
  constructor() {
    console.log("MCP Proxy Service initialized");
  }
  
  /**
   * Initialize the WebSocket server and load MCP servers
   */
  public initialize(httpServer: http.Server) {
    this.wsServer = new WebSocketServer({ 
      server: httpServer, 
      path: '/ws/mcp-proxy' 
    });
    
    this.wsServer.on('connection', (ws: WebSocket) => {
      const clientId = uuidv4();
      this.clients.set(clientId, ws);
      console.log(`MCP Proxy client connected: ${clientId}`);
      
      // Send initial state
      this.sendServerStatus(ws);
      
      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          await this.handleClientMessage(clientId, ws, data);
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
          ws.send(JSON.stringify({
            type: 'error',
            error: 'Failed to process message'
          }));
        }
      });
      
      ws.on('close', () => {
        console.log(`MCP Proxy client disconnected: ${clientId}`);
        this.clients.delete(clientId);
      });
      
      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
      });
    });
    
    // Load initial servers
    this.loadServers();
    
    // Setup periodic connection checks (every 30 seconds)
    setInterval(() => this.checkConnections(), 30000);
  }
  
  /**
   * Load all MCP servers from the database
   */
  private async loadServers() {
    try {
      const servers = await storage.getAllMcpServers();
      for (const server of servers) {
        this.addServer(server);
        
        // If server is marked as active, try to connect
        if (server.status === 'active') {
          this.connectToServer(server.id);
        }
      }
      console.log(`Loaded ${servers.length} MCP servers from database`);
    } catch (error) {
      console.error('Failed to load MCP servers:', error);
    }
  }
  
  /**
   * Periodic check of all connections
   */
  private async checkConnections() {
    for (const [serverId, connection] of this.connections.entries()) {
      // Check if connection needs to be refreshed
      if (connection.isConnected && connection.ws) {
        if (connection.ws.readyState !== WebSocket.OPEN) {
          console.log(`Reconnecting to server ${serverId} due to closed WebSocket`);
          await this.connectToServer(serverId);
        }
      } else if (connection.server.status === 'active' && !connection.isConnected) {
        // Try to reconnect to active servers
        console.log(`Attempting to connect to active server ${serverId}`);
        await this.connectToServer(serverId);
      }
    }
  }
  
  /**
   * Add a server to the managed connections
   */
  public addServer(server: McpServer): void {
    if (!this.connections.has(server.id)) {
      this.connections.set(server.id, {
        serverId: server.id,
        server,
        ws: null,
        tools: [],
        isConnected: false,
        requestMap: new Map(),
        metrics: {
          totalRequests: 0,
          successfulRequests: 0,
          failedRequests: 0,
          totalLatency: 0,
          requestsPerTool: new Map()
        }
      });
      
      console.log(`Added MCP server: ${server.name} (${server.url})`);
      
      // Broadcast server list update to all clients
      this.broadcastServerStatus();
    }
  }
  
  /**
   * Update a server configuration
   */
  public async updateServer(serverId: number, serverData: Partial<McpServer>): Promise<McpServer | undefined> {
    const updatedServer = await storage.updateMcpServer(serverId, serverData);
    if (updatedServer) {
      const connection = this.connections.get(serverId);
      if (connection) {
        connection.server = updatedServer;
        
        // If status changed, connect or disconnect as needed
        if (serverData.status === 'active' && !connection.isConnected) {
          this.connectToServer(serverId);
        } else if (serverData.status === 'inactive' && connection.isConnected) {
          this.disconnectFromServer(serverId);
        }
      } else {
        this.addServer(updatedServer);
      }
      
      // Broadcast server list update to all clients
      this.broadcastServerStatus();
      console.log(`Updated MCP server ${serverId}: ${updatedServer.name}`);
    }
    return updatedServer;
  }
  
  /**
   * Remove a server from managed connections
   */
  public removeServer(serverId: number): void {
    const connection = this.connections.get(serverId);
    if (connection && connection.ws) {
      connection.ws.close();
    }
    this.connections.delete(serverId);
    
    console.log(`Removed MCP server ${serverId}`);
    
    // Broadcast server list update to all clients
    this.broadcastServerStatus();
  }
  
  /**
   * Connect to an MCP server
   */
  public async connectToServer(serverId: number): Promise<boolean> {
    const connection = this.connections.get(serverId);
    if (!connection) return false;
    
    // Close any existing connection
    if (connection.ws) {
      connection.ws.close();
      connection.ws = null;
    }
    
    try {
      // Skip actual connection for example.com domains (development mode)
      if (connection.server.url.includes('example.com')) {
        console.log(`Development mode: Simulating connection to MCP server ${serverId}`);
        
        // In development mode, simulate a successful connection with mock tools
        connection.isConnected = true;
        connection.lastError = undefined;
        connection.lastConnected = new Date();
        
        // Setup mock tools for development
        connection.tools = [
          {
            name: "mock.echo",
            description: "Echo back the input",
            schema: {
              type: "object",
              properties: {
                message: {
                  type: "string",
                  description: "Message to echo"
                }
              },
              required: ["message"]
            }
          },
          {
            name: "mock.generate",
            description: "Generate text based on prompt",
            schema: {
              type: "object",
              properties: {
                prompt: {
                  type: "string",
                  description: "Prompt for generation"
                },
                max_tokens: {
                  type: "integer",
                  description: "Maximum tokens to generate",
                  default: 100
                }
              },
              required: ["prompt"]
            }
          }
        ];
        
        // Sync mock tools to database
        await this.syncToolsToDatabase(serverId, connection.tools);
        
        this.broadcastServerStatus();
        return true;
      }
      
      // Establish real connection for non-example servers
      const serverUrl = new URL(connection.server.url);
      const wsProtocol = serverUrl.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${serverUrl.host}/mcp`;
      
      console.log(`Connecting to MCP server ${serverId} at ${wsUrl}`);
      
      const ws = new WebSocket(wsUrl, {
        headers: {
          Authorization: `Bearer ${connection.server.apiKey || ''}`,
        }
      });
      
      const connectPromise = new Promise<boolean>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Connection timeout'));
        }, 10000);
        
        ws.on('open', () => {
          clearTimeout(timeout);
          connection.ws = ws;
          connection.isConnected = true;
          connection.lastConnected = new Date();
          connection.lastError = undefined;
          
          console.log(`Connected to MCP server ${serverId}`);
          
          // Request tools list
          ws.send(JSON.stringify({
            jsonrpc: '2.0',
            method: 'mcp.discover',
            id: `discover_${serverId}_${Date.now()}`,
            params: {}
          }));
          
          this.broadcastServerStatus();
          resolve(true);
        });
        
        ws.on('error', (error) => {
          clearTimeout(timeout);
          console.error(`Error connecting to MCP server ${serverId}:`, error);
          connection.lastError = error.message;
          connection.isConnected = false;
          this.broadcastServerStatus();
          reject(error);
        });
        
        ws.on('close', (code, reason) => {
          console.log(`Connection closed to MCP server ${serverId}:`, code, reason.toString());
          connection.isConnected = false;
          connection.ws = null;
          this.broadcastServerStatus();
        });
        
        ws.on('message', (data) => {
          this.handleServerMessage(serverId, data.toString());
        });
      });
      
      return await connectPromise;
    } catch (error) {
      console.error(`Failed to connect to MCP server ${serverId}:`, error);
      connection.lastError = error.message;
      connection.isConnected = false;
      this.broadcastServerStatus();
      return false;
    }
  }
  
  /**
   * Disconnect from an MCP server
   */
  public disconnectFromServer(serverId: number): void {
    const connection = this.connections.get(serverId);
    if (connection && connection.ws) {
      connection.ws.close();
      connection.ws = null;
      connection.isConnected = false;
      
      console.log(`Disconnected from MCP server ${serverId}`);
      this.broadcastServerStatus();
    }
  }
  
  /**
   * Get server status information for UI
   */
  public getServerStatuses() {
    const statuses = [];
    for (const [id, connection] of this.connections) {
      const { metrics } = connection;
      
      // Calculate average latency
      const avgLatency = metrics.totalRequests > 0 
        ? Math.round(metrics.totalLatency / metrics.totalRequests) 
        : 0;
      
      statuses.push({
        id: connection.serverId,
        name: connection.server.name,
        url: connection.server.url,
        status: connection.isConnected ? 'connected' : 'disconnected',
        tools: connection.tools.length,
        lastConnected: connection.lastConnected,
        lastError: connection.lastError,
        type: connection.server.type,
        version: connection.server.version,
        workspaceId: connection.server.workspaceId,
        metrics: {
          totalRequests: metrics.totalRequests,
          successfulRequests: metrics.successfulRequests,
          failedRequests: metrics.failedRequests,
          averageLatency: avgLatency,
          successRate: metrics.totalRequests > 0 
            ? Math.round((metrics.successfulRequests / metrics.totalRequests) * 100) 
            : 0
        }
      });
    }
    return statuses;
  }
  
  /**
   * Get tools available from a specific MCP server
   */
  public getServerTools(serverId: number): McpToolDefinition[] {
    const connection = this.connections.get(serverId);
    if (!connection) return [];
    return connection.tools;
  }
  
  /**
   * Handle incoming message from MCP server
   */
  private handleServerMessage(serverId: number, message: string): void {
    try {
      const data = JSON.parse(message);
      const connection = this.connections.get(serverId);
      if (!connection) return;
      
      // Handle tool discovery response
      if (data.id && data.id.startsWith('discover_') && data.result) {
        console.log(`Received tool discovery response from server ${serverId}:`, 
          data.result.tools ? `${data.result.tools.length} tools found` : "No tools found");
        
        connection.tools = data.result.tools || [];
        
        // Store tools in the database
        this.syncToolsToDatabase(serverId, connection.tools);
        
        // Broadcast server status update to all clients
        this.broadcastServerStatus();
        return;
      }
      
      // Handle regular responses and forward to client
      if (data.id) {
        const requestInfo = connection.requestMap.get(data.id);
        if (requestInfo) {
          const { clientId, startTime } = requestInfo;
          const latency = Date.now() - startTime;
          
          // Update metrics
          if (data.error) {
            connection.metrics.failedRequests++;
          } else {
            connection.metrics.successfulRequests++;
          }
          connection.metrics.totalLatency += latency;
          
          // Forward to the original requesting client
          const clientWs = this.clients.get(clientId);
          if (clientWs && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({
              type: 'mcpResponse',
              serverId,
              requestId: data.id,
              data,
              latency
            }));
          }
          
          // Remove from the request map
          connection.requestMap.delete(data.id);
        } else {
          // Broadcast to all clients if we don't know which client made the request
          this.broadcastToClients({
            type: 'mcpResponse',
            serverId,
            data,
            latency: 0
          });
        }
      }
      
      // Handle streaming responses (chunks)
      if (data.method === 'mcp.chunk' && data.params) {
        const { request_id, chunk } = data.params;
        const requestInfo = connection.requestMap.get(request_id);
        
        if (requestInfo) {
          const { clientId } = requestInfo;
          const clientWs = this.clients.get(clientId);
          
          if (clientWs && clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({
              type: 'mcpStreamChunk',
              serverId,
              requestId: request_id,
              chunk
            }));
          }
        }
      }
    } catch (error) {
      console.error(`Error handling server message from ${serverId}:`, error);
    }
  }
  
  /**
   * Sync tools discovered from MCP server to the database
   */
  private async syncToolsToDatabase(serverId: number, tools: McpToolDefinition[]): Promise<void> {
    try {
      // Get existing tools for this server
      const existingTools = await storage.getToolsByServer(serverId);
      const existingToolNames = new Set(existingTools.map(t => t.name));
      
      console.log(`Syncing ${tools.length} tools from server ${serverId}`);
      
      // Add new tools
      for (const tool of tools) {
        if (!existingToolNames.has(tool.name)) {
          await storage.createTool({
            name: tool.name,
            description: tool.description || '',
            serverId,
            toolType: 'mcp',
            metadata: tool.schema,
            status: 'active'
          });
          console.log(`Added new tool: ${tool.name}`);
        }
      }
      
      // Update metadata for existing tools
      for (const tool of tools) {
        if (existingToolNames.has(tool.name)) {
          const existingTool = existingTools.find(t => t.name === tool.name);
          if (existingTool) {
            await storage.updateTool(existingTool.id, {
              description: tool.description || existingTool.description,
              metadata: tool.schema
            });
            console.log(`Updated existing tool: ${tool.name}`);
          }
        }
      }
    } catch (error) {
      console.error(`Error syncing tools for server ${serverId}:`, error);
    }
  }
  
  /**
   * Handle incoming WebSocket message from client
   */
  private async handleClientMessage(clientId: string, ws: WebSocket, message: any): Promise<void> {
    if (message.type === 'getServerStatus') {
      this.sendServerStatus(ws);
    } 
    else if (message.type === 'connectServer') {
      const success = await this.connectToServer(message.serverId);
      ws.send(JSON.stringify({
        type: 'connectServerResult',
        serverId: message.serverId,
        success
      }));
    }
    else if (message.type === 'disconnectServer') {
      this.disconnectFromServer(message.serverId);
      ws.send(JSON.stringify({
        type: 'disconnectServerResult',
        serverId: message.serverId,
        success: true
      }));
    }
    else if (message.type === 'getServerTools') {
      const tools = this.getServerTools(message.serverId);
      ws.send(JSON.stringify({
        type: 'serverTools',
        serverId: message.serverId,
        tools
      }));
    }
    else if (message.type === 'mcpRequest') {
      this.handleMcpRequest(clientId, ws, message);
    }
    else if (message.type === 'pingServer') {
      this.pingServer(message.serverId)
        .then(pingResult => {
          ws.send(JSON.stringify({
            type: 'pingServerResult',
            serverId: message.serverId,
            ...pingResult
          }));
        });
    }
  }
  
  /**
   * Ping a server to check its health and latency
   */
  private async pingServer(serverId: number): Promise<{ success: boolean, latency?: number, error?: string }> {
    const connection = this.connections.get(serverId);
    if (!connection || !connection.isConnected || !connection.ws) {
      return { success: false, error: 'Server not connected' };
    }
    
    try {
      const pingId = `ping_${serverId}_${Date.now()}`;
      const startTime = Date.now();
      
      // Send ping request
      connection.ws.send(JSON.stringify({
        jsonrpc: '2.0',
        method: 'mcp.ping',
        id: pingId,
        params: {}
      }));
      
      // Wait for response with timeout
      const response = await new Promise<{ success: boolean, latency?: number, error?: string }>((resolve, reject) => {
        const timeout = setTimeout(() => {
          resolve({ success: false, error: 'Ping timeout' });
        }, 5000);
        
        // Set up one-time handler for the ping response
        const handlePingResponse = (data: Buffer) => {
          try {
            const parsedData = JSON.parse(data.toString());
            if (parsedData.id === pingId) {
              clearTimeout(timeout);
              connection.ws?.removeListener('message', handlePingResponse);
              
              const latency = Date.now() - startTime;
              resolve({ 
                success: true, 
                latency,
                ...(parsedData.result || {})
              });
            }
          } catch (err) {
            // Ignore parsing errors, wait for correct message
          }
        };
        
        connection.ws?.on('message', handlePingResponse);
      });
      
      return response;
    } catch (error) {
      console.error(`Error pinging server ${serverId}:`, error);
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Send server status to a specific client
   */
  private sendServerStatus(ws: WebSocket): void {
    ws.send(JSON.stringify({
      type: 'serverStatus',
      servers: this.getServerStatuses()
    }));
  }
  
  /**
   * Broadcast server status to all connected clients
   */
  private broadcastServerStatus(): void {
    const status = {
      type: 'serverStatus',
      servers: this.getServerStatuses()
    };
    
    this.broadcastToClients(status);
  }
  
  /**
   * Broadcast a message to all connected WebSocket clients
   */
  private broadcastToClients(message: any): void {
    const messageStr = JSON.stringify(message);
    for (const [clientId, client] of this.clients.entries()) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(messageStr);
      }
    }
  }
  
  /**
   * Handle MCP request from client
   */
  private async handleMcpRequest(clientId: string, ws: WebSocket, message: any): Promise<void> {
    const { serverId, request, requestId } = message;
    const connection = this.connections.get(serverId);
    
    if (!connection || !connection.isConnected || !connection.ws) {
      ws.send(JSON.stringify({
        type: 'mcpResponse',
        requestId,
        error: 'Server not connected',
        status: 'error'
      }));
      return;
    }
    
    // Get or create a circuit breaker for this server
    const circuitBreakerName = `mcp-server-${serverId}`;
    const circuitBreaker = circuitBreakerService.getBreaker(circuitBreakerName, {
      failureThreshold: 5,               // Open circuit after 5 failures
      resetTimeout: 30000,               // Try half-open after 30 seconds
      halfOpenSuccessThreshold: 2,       // Close circuit after 2 successful requests in half-open state
      timeout: 10000,                    // 10 second timeout for requests
      isFailure: (error: any) => {
        // Define what constitutes a failure for MCP requests
        return true; // Any error is considered a failure
      }
    });
    
    try {
      // Execute with circuit breaker protection
      await circuitBreaker.exec(async () => {
        // Track the request in the connection's request map for response routing
        connection.requestMap.set(requestId, { 
          clientId, 
          startTime: Date.now() 
        });
        
        // Update metrics
        connection.metrics.totalRequests++;
        
        // Track per-tool metrics if request is a tool invocation
        if (request.method === 'mcp.run_tool' && request.params?.tool_name) {
          const toolName = request.params.tool_name;
          const currentCount = connection.metrics.requestsPerTool.get(toolName) || 0;
          connection.metrics.requestsPerTool.set(toolName, currentCount + 1);
        }
        
        // Forward the request to the MCP server
        return new Promise<void>((resolve, reject) => {
          try {
            connection.ws?.send(JSON.stringify(request));
            
            // Log the request
            console.log(`Forwarded MCP request to server ${serverId}:`, 
              request.method, 
              request.params ? 
                (request.params.tool_name ? `tool: ${request.params.tool_name}` : '') : 
                ''
            );
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      });
    } catch (error) {
      // The circuit breaker might be open or the request failed
      console.error(`Error sending request to server ${serverId}:`, error);
      
      // Remove from tracking and update metrics
      connection.requestMap.delete(requestId);
      connection.metrics.failedRequests++;
      
      // Record server state if circuit is open
      if (circuitBreaker.getState() !== 'closed') {
        connection.lastError = `Circuit open: Too many failures detected`;
        
        // If circuit is open, check if we need to reconnect
        if (!connection.reconnecting) {
          connection.reconnecting = true;
          setTimeout(async () => {
            if (connection.ws?.readyState !== WebSocket.OPEN) {
              console.log(`Attempting to reconnect to server ${serverId} due to circuit breaker activation`);
              await this.connectToServer(serverId);
            }
            connection.reconnecting = false;
          }, 5000); // Try reconnect after 5 seconds
        }
      }
      
      // Send error response to client
      let errorMessage = 'Internal server error';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      ws.send(JSON.stringify({
        type: 'mcpResponse',
        requestId,
        error: `Failed to send request: ${errorMessage}`,
        status: 'error'
      }));
    }
  }
  
  /**
   * HTTP handler for the MCP proxy (JSON-RPC over HTTP)
   */
  public async handleHttpProxy(req: Request, res: Response): Promise<void> {
    const serverId = Number(req.params.serverId);
    const connection = this.connections.get(serverId);
    
    if (!connection || !connection.isConnected) {
      return res.status(502).json({
        error: 'Server not connected',
        status: 'error'
      });
    }
    
    // Get or create a circuit breaker for this server's HTTP endpoint
    const circuitBreakerName = `mcp-server-http-${serverId}`;
    const circuitBreaker = circuitBreakerService.getBreaker(circuitBreakerName, {
      failureThreshold: 5,               // Open circuit after 5 failures
      resetTimeout: 30000,               // Try half-open after 30 seconds
      halfOpenSuccessThreshold: 2,       // Close circuit after 2 successful requests in half-open state
      timeout: 30000,                    // 30 second timeout for requests
    });
    
    try {
      // Check if circuit is open
      if (circuitBreaker.getState() === 'open') {
        return res.status(503).json({
          jsonrpc: '2.0',
          id: req.body.id || null,
          error: {
            code: -32000,
            message: 'Service temporarily unavailable (circuit open)'
          }
        });
      }
      
      const requestId = `http_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const requestBody = req.body;
      
      // Ensure the request has a valid JSON-RPC structure
      if (!requestBody.method) {
        return res.status(400).json({
          jsonrpc: '2.0',
          id: requestBody.id || null,
          error: {
            code: -32600,
            message: 'Invalid request: missing method'
          }
        });
      }
      
      // Handle HTTP requests differently from WebSocket
      // For an MCP server with HTTP endpoints, forward the request to the server's HTTP API
      const serverUrl = new URL(connection.server.url);
      const httpUrl = `${serverUrl.protocol}//${serverUrl.host}/mcp`;
      
      // Track metrics
      const startTime = Date.now();
      connection.metrics.totalRequests++;
      
      // Execute with circuit breaker protection
      const response = await circuitBreaker.exec(async () => {
        // Forward the request via HTTP
        return await axios.post(httpUrl, {
          ...requestBody,
          id: requestBody.id || requestId
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${connection.server.apiKey || ''}`
          },
          timeout: 30000 // 30 second timeout
        });
      });
      
      // Update metrics
      const latency = Date.now() - startTime;
      connection.metrics.totalLatency += latency;
      connection.metrics.successfulRequests++;
      
      // Send the response back to the client
      return res.status(response.status).json(response.data);
    } catch (error) {
      console.error(`Error in HTTP proxy for server ${serverId}:`, error);
      
      // Update metrics
      connection.metrics.failedRequests++;
      
      // Record circuit state
      if (circuitBreaker.getState() !== 'closed') {
        connection.lastError = `HTTP Circuit open: Too many failures detected`;
      }
      
      // Determine appropriate error response
      if ('response' in error && error.response) {
        // The request was made and the server responded with a status code
        // outside of the 2xx range
        return res.status(error.response.status).json({
          jsonrpc: '2.0',
          id: req.body.id || null,
          error: {
            code: -32000,
            message: 'MCP server error',
            data: error.response.data
          }
        });
      } else if ('request' in error && error.request) {
        // The request was made but no response was received
        return res.status(504).json({
          jsonrpc: '2.0',
          id: req.body.id || null,
          error: {
            code: -32000,
            message: 'MCP server timeout or no response'
          }
        });
      } else {
        // Something else happened in making the request
        let errorMessage = 'Internal server error';
        if (error instanceof Error) {
          errorMessage = error.message;
        }
        
        return res.status(500).json({
          jsonrpc: '2.0',
          id: req.body.id || null,
          error: {
            code: -32000,
            message: `MCP proxy error: ${errorMessage}`
          }
        });
      }
    }
  }
  
  /**
   * Get server metrics for analytics
   */
  public getServerMetrics() {
    const metrics = [];
    for (const [id, connection] of this.connections) {
      // Convert requestsPerTool Map to a simple object for serialization
      const toolMetrics = {};
      connection.metrics.requestsPerTool.forEach((count, tool) => {
        toolMetrics[tool] = count;
      });
      
      metrics.push({
        serverId: connection.serverId,
        serverName: connection.server.name,
        totalRequests: connection.metrics.totalRequests,
        successfulRequests: connection.metrics.successfulRequests,
        failedRequests: connection.metrics.failedRequests,
        averageLatency: connection.metrics.totalRequests > 0 
          ? Math.round(connection.metrics.totalLatency / connection.metrics.totalRequests) 
          : 0,
        successRate: connection.metrics.totalRequests > 0 
          ? Math.round((connection.metrics.successfulRequests / connection.metrics.totalRequests) * 100) 
          : 0,
        toolMetrics
      });
    }
    return metrics;
  }
  
  /**
   * Reset metrics for a specific server
   */
  public resetServerMetrics(serverId: number): boolean {
    const connection = this.connections.get(serverId);
    if (!connection) return false;
    
    connection.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalLatency: 0,
      requestsPerTool: new Map()
    };
    
    return true;
  }

  /**
   * Register a stream handler for chunked responses
   * @param requestId The ID of the request to track
   * @param handler Function to call for each chunk
   */
  public registerStreamHandler(requestId: string | number, handler: (chunk: any) => void): void {
    this.streamHandlers.set(requestId, handler);
    console.log(`Registered stream handler for request ${requestId}`);
  }

  /**
   * Unregister a stream handler
   * @param requestId The ID of the request
   */
  public unregisterStreamHandler(requestId: string | number): void {
    if (this.streamHandlers.has(requestId)) {
      this.streamHandlers.delete(requestId);
      console.log(`Unregistered stream handler for request ${requestId}`);
    }
  }

  /**
   * Proxy a tool request to an MCP server and collect results
   * @param serverId The ID of the target MCP server
   * @param request The JSON-RPC request to forward
   * @param clientId Identifier for the requesting client
   * @returns Promise resolving to the result of the tool execution
   */
  public async proxyToolRequest(
    serverId: number,
    request: McpJsonRpcRequest,
    clientId: string
  ): Promise<any> {
    const connection = this.connections.get(serverId);
    
    if (!connection || !connection.isConnected || !connection.ws || connection.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`Server ${serverId} not connected`);
    }
    
    // Track request details for metrics
    connection.requestMap.set(request.id.toString(), {
      clientId,
      startTime: Date.now()
    });
    
    // Track tool usage for metrics
    if (request.method === 'mcp.run_tool' && request.params?.tool_name) {
      const toolName = request.params.tool_name;
      const currentCount = connection.metrics.requestsPerTool.get(toolName) || 0;
      connection.metrics.requestsPerTool.set(toolName, currentCount + 1);
    }
    
    connection.metrics.totalRequests++;
    
    // Create promise for handling response
    return new Promise((resolve, reject) => {
      // Set timeout for request
      const timeout = setTimeout(() => {
        reject(new Error('Request timed out'));
        connection.metrics.failedRequests++;
      }, 60000); // 60 second timeout
      
      // Define response handler
      const responseHandler = (message: string) => {
        try {
          const response = JSON.parse(message) as McpJsonRpcResponse;
          
          // Check if this is the response for our request
          if (response.id && response.id === request.id) {
            // Remove listener to avoid memory leaks
            if (connection.ws) {
              connection.ws.removeListener('message', responseHandler);
            }
            
            clearTimeout(timeout);
            
            // Update metrics
            const requestInfo = connection.requestMap.get(request.id.toString());
            if (requestInfo) {
              const latency = Date.now() - requestInfo.startTime;
              connection.metrics.totalLatency += latency;
              connection.requestMap.delete(request.id.toString());
            }
            
            if (response.error) {
              connection.metrics.failedRequests++;
              reject(new Error(response.error.message));
            } else {
              connection.metrics.successfulRequests++;
              resolve(response.result);
            }
          } else if (response.id && response.id.toString().startsWith('chunk_' + request.id)) {
            // This is a chunked response
            const handler = this.streamHandlers.get(request.id);
            if (handler && response.result) {
              handler(response.result);
            }
          }
        } catch (error) {
          console.error('Error processing MCP server response:', error);
        }
      };
      
      // Add listener for this request
      if (connection.ws) {
        connection.ws.addListener('message', responseHandler);
        
        // Send the request
        try {
          connection.ws.send(JSON.stringify(request));
        } catch (error) {
          clearTimeout(timeout);
          connection.metrics.failedRequests++;
          if (connection.ws) {
            connection.ws.removeListener('message', responseHandler);
          }
          reject(new Error('Failed to send request'));
        }
      } else {
        clearTimeout(timeout);
        connection.metrics.failedRequests++;
        reject(new Error('Server connection not available'));
      }
    });
  }

  /**
   * Ping an MCP server to check health and measure latency
   * @param serverId The ID of the server to ping
   * @returns Promise resolving to ping result
   */
  public pingServer(serverId: number): Promise<{ success: boolean, latency?: number, error?: string }> {
    const connection = this.connections.get(serverId);
    
    if (!connection || !connection.isConnected || !connection.ws || connection.ws.readyState !== WebSocket.OPEN) {
      return Promise.resolve({ 
        success: false, 
        error: connection?.lastError || 'Server not connected' 
      });
    }
    
    try {
      const pingId = `ping_${serverId}_${Date.now()}`;
      const startTime = Date.now();
      
      const pingRequest: McpJsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'mcp.ping',
        id: pingId,
        params: {}
      };
      
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          if (connection.ws) {
            connection.ws.removeListener('message', handlePingResponse);
          }
          resolve({ 
            success: false, 
            error: 'Ping timeout' 
          });
        }, 5000);
        
        const handlePingResponse = (data: Buffer) => {
          try {
            const response = JSON.parse(data.toString()) as McpJsonRpcResponse;
            if (response.id === pingId) {
              clearTimeout(timeout);
              
              if (connection.ws) {
                connection.ws.removeListener('message', handlePingResponse);
              }
              
              const latency = Date.now() - startTime;
              
              if (response.error) {
                resolve({ 
                  success: false, 
                  latency, 
                  error: response.error.message 
                });
              } else {
                resolve({ 
                  success: true, 
                  latency 
                });
              }
            }
          } catch (error) {
            // Ignore errors for non-ping responses
          }
        };
        
        if (connection.ws) {
          connection.ws.addListener('message', handlePingResponse);
          connection.ws.send(JSON.stringify(pingRequest));
        } else {
          clearTimeout(timeout);
          resolve({ 
            success: false, 
            error: 'Server connection not available' 
          });
        }
      });
    } catch (error) {
      return Promise.resolve({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}

// Create a singleton instance
export const mcpProxyService = new McpProxyService();
