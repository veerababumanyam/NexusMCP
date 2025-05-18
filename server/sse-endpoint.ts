import { Request, Response } from 'express';
import { EventEmitter } from 'events';
import { v4 as uuidv4 } from 'uuid';
import { McpToolDefinition, McpJsonRpcRequest } from '@shared/schema';
import { mcpProxyService } from './mcp-proxy';
import { storage } from './storage';
import { apiKeyService } from './services/apiKeyService';
import { createAuditLog } from './services/auditLogService';

interface SseClient {
  id: string;
  res: Response;
  userId: number;
  workspaceId?: number;
  lastEventId?: string;
  isAuthenticated: boolean;
}

/**
 * SSE Endpoint Service
 * 
 * Implements the Server-Sent Events (SSE) endpoint for MCP clients
 * following the Model Context Protocol (MCP) specification
 */
class SseEndpointService {
  private clients: Map<string, SseClient> = new Map();
  private events: EventEmitter = new EventEmitter();
  private heartbeatInterval: NodeJS.Timeout | null = null;
  
  constructor() {
    console.log("SSE Endpoint Service initialized");
    
    // Set up heartbeat to keep connections alive
    this.heartbeatInterval = setInterval(() => {
      this.broadcastHeartbeat();
    }, 30000); // Send heartbeat every 30 seconds
    
    // Increase max listeners to avoid memory leak warnings
    this.events.setMaxListeners(100);
  }
  
  /**
   * Initialize SSE connection for a client
   */
  public handleSseConnection(req: Request, res: Response): void {
    // Extract API key from various sources
    const apiKey = this.extractApiKey(req);
    
    if (!apiKey) {
      res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'API key is required. Provide either an Authorization Bearer header or api_key query parameter.',
        docs: 'https://docs.nexusmcp.com/api-authentication'
      });
      return;
    }
    
    // Validate the API key using the API key service
    this.validateApiKey(apiKey)
      .then(({ isValid, userId, workspaceId, scopes }) => {
        if (!isValid) {
          res.status(401).json({ 
            error: 'Unauthorized', 
            message: 'Invalid or expired API key'
          });
          return;
        }
        
        // Verify that the API key has the necessary scope for MCP access
        if (!scopes.includes('mcp:access') && !scopes.includes('*')) {
          res.status(403).json({
            error: 'Forbidden',
            message: 'API key does not have the required permissions for MCP access',
            requiredScopes: ['mcp:access'],
            docs: 'https://docs.nexusmcp.com/api-scopes'
          });
          return;
        }
        
        // Set up SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no'); // For Nginx proxying
        
        // Create a new client
        const clientId = uuidv4();
        const client: SseClient = {
          id: clientId,
          res,
          userId,
          workspaceId,
          lastEventId: req.headers['last-event-id'] as string,
          isAuthenticated: true
        };
        
        // Store the client
        this.clients.set(clientId, client);
        console.log(`SSE client connected: ${clientId}, User ID: ${userId}`);
        
        // Send initial connection acknowledgment
        this.sendEvent(client, 'connection', { 
          status: 'connected',
          clientId,
          timestamp: new Date().toISOString()
        });
        
        // Send server status
        const statuses = mcpProxyService.getServerStatuses();
        this.sendEvent(client, 'server_status', { servers: statuses });
        
        // Listen for client disconnect
        req.on('close', () => {
          this.clients.delete(clientId);
          console.log(`SSE client disconnected: ${clientId}`);
        });
        
        // Send initial heartbeat
        this.sendEvent(client, 'heartbeat', { timestamp: new Date().toISOString() });
      })
      .catch(error => {
        console.error('Error authenticating API key:', error);
        res.status(500).json({ error: 'Internal server error' });
      });
  }
  
  /**
   * Handle MCP JSON-RPC request from client
   */
  public async handleMcpRequest(req: Request, res: Response): Promise<void> {
    // Extract API key from various sources
    const apiKey = this.extractApiKey(req);
    
    if (!apiKey) {
      res.status(401).json({ 
        error: 'Unauthorized', 
        message: 'API key is required. Provide either an Authorization Bearer header or api_key query parameter.',
        docs: 'https://docs.nexusmcp.com/api-authentication'
      });
      return;
    }
    
    try {
      // Validate the API key using the API key service
      const { isValid, userId, workspaceId, scopes } = await this.validateApiKey(apiKey);
      
      if (!isValid) {
        res.status(401).json({ 
          error: 'Unauthorized', 
          message: 'Invalid or expired API key'
        });
        return;
      }
      
      // Verify that the API key has the necessary scope for MCP access
      if (!scopes.includes('mcp:access') && !scopes.includes('*')) {
        res.status(403).json({
          error: 'Forbidden',
          message: 'API key does not have the required permissions for MCP access',
          requiredScopes: ['mcp:access'],
          docs: 'https://docs.nexusmcp.com/api-scopes'
        });
        return;
      }
      
      // Process the MCP request
      const jsonRpcRequest: McpJsonRpcRequest = {
        ...req.body,
        jsonrpc: '2.0' // Ensure we have the correct jsonrpc version
      };
      
      // Validate JSON-RPC request
      if (!jsonRpcRequest.method || !jsonRpcRequest.id) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32600, message: 'Invalid Request' },
          id: jsonRpcRequest.id || null
        });
        return;
      }
      
      // Handle MCP method requests
      switch (jsonRpcRequest.method) {
        case 'mcp.discover':
          this.handleDiscoverRequest(req, res, jsonRpcRequest, workspaceId);
          break;
          
        case 'mcp.run_tool':
          this.handleRunToolRequest(req, res, jsonRpcRequest, userId, workspaceId);
          break;
          
        case 'mcp.ping':
          // Simple ping-pong
          res.status(200).json({
            jsonrpc: '2.0',
            result: { timestamp: new Date().toISOString() },
            id: jsonRpcRequest.id
          });
          break;
          
        default:
          res.status(400).json({
            jsonrpc: '2.0',
            error: { code: -32601, message: 'Method not found' },
            id: jsonRpcRequest.id
          });
      }
    } catch (error) {
      console.error('Error handling MCP request:', error);
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal error' },
        id: req.body.id || null
      });
    }
  }
  
  /**
   * Handle tool discovery request
   */
  private async handleDiscoverRequest(
    req: Request,
    res: Response,
    jsonRpcRequest: McpJsonRpcRequest,
    workspaceId?: number
  ): Promise<void> {
    try {
      // Get all tool definitions from available servers
      const tools: McpToolDefinition[] = [];
      
      // Get servers for this workspace
      const servers = workspaceId 
        ? await storage.getMcpServersByWorkspace(workspaceId)
        : await storage.getAllMcpServers();
      
      // Collect tools from each server
      for (const server of servers) {
        const serverTools = mcpProxyService.getServerTools(server.id);
        
        // Add server identifier to the tool name to avoid collisions
        const prefixedTools = serverTools.map(tool => ({
          ...tool,
          name: `${server.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.${tool.name}`,
          server_id: server.id,
          server_name: server.name
        }));
        
        tools.push(...prefixedTools);
      }
      
      // Respond with the tools list
      res.status(200).json({
        jsonrpc: '2.0',
        result: {
          tools
        },
        id: jsonRpcRequest.id
      });
    } catch (error) {
      console.error('Error handling discover request:', error);
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal error' },
        id: jsonRpcRequest.id
      });
    }
  }
  
  /**
   * Handle tool execution request
   */
  private async handleRunToolRequest(
    req: Request,
    res: Response,
    jsonRpcRequest: McpJsonRpcRequest,
    userId: number,
    workspaceId?: number
  ): Promise<void> {
    try {
      const { tool_name, params } = jsonRpcRequest.params;
      
      if (!tool_name) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32602, message: 'Invalid params - tool_name required' },
          id: jsonRpcRequest.id
        });
        return;
      }
      
      // Determine which server to route this to
      // Parse the server name from the tool name (assuming format: server_name.tool_name)
      const dotIndex = tool_name.indexOf('.');
      if (dotIndex === -1) {
        res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32602, message: 'Invalid tool name format' },
          id: jsonRpcRequest.id
        });
        return;
      }
      
      const serverPrefix = tool_name.substring(0, dotIndex);
      const actualToolName = tool_name.substring(dotIndex + 1);
      
      // Find the server by name prefix
      const servers = workspaceId 
        ? await storage.getMcpServersByWorkspace(workspaceId)
        : await storage.getAllMcpServers();
      
      const matchingServer = servers.find(server => 
        server.name.toLowerCase().replace(/[^a-z0-9]/g, '_') === serverPrefix
      );
      
      if (!matchingServer) {
        res.status(404).json({
          jsonrpc: '2.0',
          error: { code: -32602, message: 'Server not found for the given tool' },
          id: jsonRpcRequest.id
        });
        return;
      }
      
      // Create a stream controller to handle chunked responses
      let closed = false;
      
      // Set up SSE headers for streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      // Handle client disconnect
      req.on('close', () => {
        closed = true;
        // Any cleanup needed
      });
      
      // Prepare a modified request to send to the actual MCP server
      const modifiedRequest: McpJsonRpcRequest = {
        jsonrpc: '2.0',
        method: 'mcp.run_tool',
        params: {
          tool_name: actualToolName,
          params
        },
        id: jsonRpcRequest.id
      };
      
      // Create a handler for chunked responses
      const handleChunk = (chunk: any) => {
        if (closed) return;
        this.sendSseChunk(res, 'chunk', {
          request_id: jsonRpcRequest.id,
          chunk
        });
      };
      
      // Register for streaming responses
      mcpProxyService.registerStreamHandler(jsonRpcRequest.id, handleChunk);
      
      // Send the request to the MCP server
      const result = await mcpProxyService.proxyToolRequest(
        matchingServer.id,
        modifiedRequest,
        userId.toString()
      );
      
      // If we get here, we've received a complete response
      mcpProxyService.unregisterStreamHandler(jsonRpcRequest.id);
      
      // Send the final response
      this.sendSseChunk(res, 'result', {
        request_id: jsonRpcRequest.id,
        result
      });
      
      // End SSE stream
      this.sendSseChunk(res, 'end', {
        request_id: jsonRpcRequest.id
      });
      
      // Close the connection
      res.end();
    } catch (error) {
      console.error('Error handling run_tool request:', error);
      this.sendSseChunk(res, 'error', {
        request_id: jsonRpcRequest.id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error instanceof Error ? error.message : String(error)
        }
      });
      res.end();
    }
  }
  
  /**
   * Validate API key against storage
   */
  /**
   * Extract API key from request using multiple methods
   * Supports both header-based and URL-based transmission
   */
  private extractApiKey(req: Request): string | null {
    // Check Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7); // Remove 'Bearer ' prefix
    }

    // Check X-API-Key header (common convention)
    const apiKeyHeader = req.headers['x-api-key'];
    if (apiKeyHeader) {
      return Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
    }

    // Check URL query parameter
    if (req.query.api_key) {
      return req.query.api_key as string;
    }

    return null;
  }

  /**
   * Validate API key using the API key service
   */
  private async validateApiKey(apiKey: string): Promise<{ 
    isValid: boolean; 
    userId: number;
    workspaceId?: number;
    scopes: string[];
  }> {
    try {
      // Use the API key service to validate the key
      const keyData = await apiKeyService.verifyApiKey(apiKey);
      
      if (!keyData) {
        return { isValid: false, userId: 0, scopes: [] };
      }
      
      // Return validated data
      return { 
        isValid: true, 
        userId: keyData.userId,
        workspaceId: keyData.workspaceId,
        scopes: keyData.scopes
      };
    } catch (error) {
      console.error('Error validating API key:', error);
      return { isValid: false, userId: 0, scopes: [] };
    }
  }
  
  /**
   * Send an event to a specific client
   */
  private sendEvent(client: SseClient, event: string, data: any): void {
    if (!client.res.closed) {
      const eventId = uuidv4();
      client.res.write(`id: ${eventId}\n`);
      client.res.write(`event: ${event}\n`);
      client.res.write(`data: ${JSON.stringify(data)}\n\n`);
      client.lastEventId = eventId;
    }
  }
  
  /**
   * Send an SSE chunk to a response object
   */
  private sendSseChunk(res: Response, event: string, data: any): void {
    if (!res.closed) {
      const eventId = uuidv4();
      res.write(`id: ${eventId}\n`);
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  }
  
  /**
   * Broadcast an event to all clients
   */
  public broadcastEvent(event: string, data: any, workspaceId?: number): void {
    for (const [clientId, client] of this.clients.entries()) {
      // If workspaceId is specified, only send to clients in that workspace
      if (workspaceId && client.workspaceId !== workspaceId) {
        continue;
      }
      
      this.sendEvent(client, event, data);
    }
  }
  
  /**
   * Send heartbeat to keep connections alive
   */
  private broadcastHeartbeat(): void {
    const heartbeatData = {
      timestamp: new Date().toISOString()
    };
    
    for (const [clientId, client] of this.clients.entries()) {
      this.sendEvent(client, 'heartbeat', heartbeatData);
    }
  }
  
  /**
   * Clean up resources
   */
  public shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Close all client connections
    for (const [clientId, client] of this.clients.entries()) {
      if (!client.res.closed) {
        client.res.end();
      }
    }
    
    this.clients.clear();
    this.events.removeAllListeners();
  }
}

export const sseEndpointService = new SseEndpointService();