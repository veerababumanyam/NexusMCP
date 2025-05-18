/**
 * MCP Core Service
 * 
 * Central orchestration service that manages MCP servers and routes tool requests
 * Implements the Model Context Protocol (MCP) specification
 */

import { eventBus, EventType } from '../eventBus';
import { db } from '../../db';
import { auditLogs } from '@shared/schema';
import { createAuditLog } from './auditLogService';
import { McpProxyService } from './mcp-proxy-service';

export interface ToolMetadata {
  id: string;
  name: string;
  description: string;
  version: string;
  vendor?: string;
  capabilities: string[];
  requiredParams: {
    name: string;
    type: string;
    description: string;
    required: boolean;
  }[];
  policyTags?: string[];
  category?: string;
  serverId: number;
}

export interface ToolExecutionRequest {
  toolId: string;
  params: Record<string, any>;
  userId: number;
  workspaceId?: number;
  correlationId?: string;
}

export interface ToolExecutionResponse {
  result: any;
  status: 'success' | 'error';
  message?: string;
  executionTime?: number;
}

export class McpCoreService {
  private toolCache: Map<string, ToolMetadata> = new Map();
  
  constructor(private mcpProxyService: McpProxyService) {
    this.setupEventListeners();
  }

  private setupEventListeners() {
    // Listen for tool discovery events
    eventBus.on('mcp.tool.discovered', (event) => {
      const { tools, serverId } = event.data;
      this.updateToolCache(tools, serverId);
    });

    // Listen for server status changes
    eventBus.on('mcp.server.status.changed', (event) => {
      const { serverId, status } = event.data;
      if (status !== 'connected') {
        // Remove tools from disconnected servers
        this.removeServerTools(serverId);
      }
    });
  }

  /**
   * Request tool metadata from all connected servers
   */
  public async requestAllToolMetadata(): Promise<ToolMetadata[]> {
    // Clear the cache before requesting fresh data
    this.toolCache.clear();
    
    // Request tools from all servers via proxy service
    const allServerTools = await this.mcpProxyService.discoverAllTools();
    
    // Process and cache the tools
    allServerTools.forEach(serverTools => {
      if (serverTools.tools && serverTools.serverId) {
        this.updateToolCache(serverTools.tools, serverTools.serverId);
      }
    });
    
    // Return all cached tools
    return Array.from(this.toolCache.values());
  }

  /**
   * Get filtered tool list based on user's permissions
   */
  public async getFilteredToolList(userId: number): Promise<ToolMetadata[]> {
    // Get all tools
    let tools = Array.from(this.toolCache.values());
    
    if (tools.length === 0) {
      // Cache is empty, fetch fresh data
      tools = await this.requestAllToolMetadata();
    }
    
    // TODO: Apply permission filtering based on the policy engine
    // This will be implemented with the Policy service
    
    return tools;
  }
  
  /**
   * Execute a tool on an MCP server
   */
  public async executeTool(request: ToolExecutionRequest): Promise<ToolExecutionResponse> {
    const { toolId, params, userId, workspaceId, correlationId } = request;
    
    // Find the tool in the cache
    const toolMetadata = this.toolCache.get(toolId);
    if (!toolMetadata) {
      throw new Error(`Tool not found: ${toolId}`);
    }
    
    // Get the server ID from the tool metadata
    const serverId = toolMetadata.serverId;
    
    try {
      // Log the request
      await createAuditLog({
        userId,
        action: 'call_tool',
        resourceType: 'mcp_tool',
        resourceId: toolId,
        details: {
          serverId,
          toolId,
          params: JSON.stringify(params),
          correlationId
        }
      });
      
      // Execute the tool via proxy service
      const startTime = Date.now();
      const result = await this.mcpProxyService.callTool(serverId, toolId, params);
      const executionTime = Date.now() - startTime;
      
      // Log the successful execution
      await createAuditLog({
        userId,
        action: 'tool_executed',
        resourceType: 'mcp_tool',
        resourceId: toolId,
        details: {
          serverId,
          toolId,
          executionTime,
          status: 'success',
          correlationId
        }
      });
      
      return {
        result,
        status: 'success',
        executionTime
      };
    } catch (error) {
      // Log the failed execution
      await createAuditLog({
        userId,
        action: 'tool_execution_failed',
        resourceType: 'mcp_tool',
        resourceId: toolId,
        details: {
          serverId,
          toolId,
          error: error.message,
          status: 'error',
          correlationId
        }
      });
      
      throw error;
    }
  }
  
  /**
   * Update the tool cache with tools from a server
   */
  private updateToolCache(tools: any[], serverId: number): void {
    tools.forEach(tool => {
      // Add server ID to the tool metadata
      const toolWithServer = {
        ...tool,
        serverId
      };
      
      // Cache the tool by ID
      this.toolCache.set(tool.id, toolWithServer);
      
      // Emit event for each tool
      eventBus.emit('mcp.tool.updated', {
        tool: toolWithServer
      });
    });
  }
  
  /**
   * Remove tools from a specific server from the cache
   */
  private removeServerTools(serverId: number): void {
    // Find all tools belonging to this server
    const serverTools = Array.from(this.toolCache.values())
      .filter(tool => tool.serverId === serverId);
    
    // Remove them from the cache
    serverTools.forEach(tool => {
      this.toolCache.delete(tool.id);
      
      // Emit event for each removed tool
      eventBus.emit('mcp.tool.deprecated', {
        toolId: tool.id,
        serverId
      });
    });
  }
}

// Create and export singleton instance
let mcpCoreService: McpCoreService;

export function initMcpCoreService(mcpProxyService: McpProxyService): McpCoreService {
  if (!mcpCoreService) {
    mcpCoreService = new McpCoreService(mcpProxyService);
  }
  return mcpCoreService;
}

export function getMcpCoreService(): McpCoreService {
  if (!mcpCoreService) {
    throw new Error('MCP Core Service not initialized');
  }
  return mcpCoreService;
}