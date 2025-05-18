/**
 * MCP Tool Controller
 * 
 * Handles MCP tool discovery and execution
 * Manages tool capabilities and permissions
 */

import { Request, Response } from 'express';
import { z } from 'zod';
import { mcpProxyService } from '../services/mcp-proxy-service';
import { getMcpCoreService } from '../services/mcp-core-service';
import { policyService } from '../services/policy-service';
import { createAuditLog } from '../services/auditLogService';

// Schema for tool execution request
const toolExecutionSchema = z.object({
  toolId: z.string(),
  params: z.record(z.any()).optional(),
  workspaceId: z.number().int().positive().optional(),
  correlationId: z.string().optional()
});

export class McpToolController {
  /**
   * List all available tools for the authenticated user
   */
  public async listTools(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required'
        });
      }
      
      // Get filtered tools based on user permissions
      const tools = await mcpProxyService.getFilteredToolsForUser(userId);
      
      // Create audit log
      await createAuditLog({
        userId,
        action: 'list_tools',
        resourceType: 'mcp_tools',
        resourceId: 'all', // Required field
        details: {
          count: tools.length
        }
      });
      
      return res.json({
        tools
      });
    } catch (error) {
      console.error('Error listing tools:', error);
      return res.status(500).json({
        error: 'Failed to list tools'
      });
    }
  }
  
  /**
   * Get detailed information about a specific tool
   */
  public async getTool(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required'
        });
      }
      
      const toolId = req.params.id;
      
      if (!toolId) {
        return res.status(400).json({
          error: 'Tool ID is required'
        });
      }
      
      // Get all tools for the user
      const tools = await mcpProxyService.getFilteredToolsForUser(userId);
      
      // Find the specific tool
      const tool = tools.find(t => t.id === toolId);
      
      if (!tool) {
        return res.status(404).json({
          error: 'Tool not found or access denied'
        });
      }
      
      // Create audit log
      await createAuditLog({
        userId,
        action: 'get_tool',
        resourceType: 'mcp_tool',
        resourceId: toolId
      });
      
      return res.json({
        tool
      });
    } catch (error) {
      console.error('Error getting tool:', error);
      return res.status(500).json({
        error: 'Failed to get tool information'
      });
    }
  }
  
  /**
   * Execute a tool with the provided parameters
   */
  public async executeTool(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required'
        });
      }
      
      // Validate request body
      const validation = toolExecutionSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          error: 'Invalid tool execution request',
          details: validation.error.format()
        });
      }
      
      const { toolId, params, workspaceId, correlationId } = validation.data;
      
      // Get the MCP Core Service
      const mcpCoreService = getMcpCoreService();
      
      // Execute the tool
      const result = await mcpCoreService.executeTool({
        toolId,
        params: params || {},
        userId,
        workspaceId,
        correlationId
      });
      
      return res.json(result);
    } catch (error) {
      console.error('Error executing tool:', error);
      
      // Audit the failure
      await createAuditLog({
        userId: req.user?.id,
        action: 'tool_execution_failed',
        resourceType: 'mcp_tool',
        resourceId: req.body.toolId || 'unknown',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      });
      
      return res.status(500).json({
        error: 'Failed to execute tool',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  
  /**
   * Discover/refresh tools from all connected servers
   */
  public async discoverTools(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required'
        });
      }
      
      // Get the MCP Core Service
      const mcpCoreService = getMcpCoreService();
      
      // Discover all tools
      const tools = await mcpCoreService.requestAllToolMetadata();
      
      // Create audit log
      await createAuditLog({
        userId,
        action: 'discover_tools',
        resourceType: 'mcp_tools',
        resourceId: 'all', // Required field
        details: {
          count: tools.length
        }
      });
      
      return res.json({
        success: true,
        count: tools.length,
        message: 'Tools discovered successfully'
      });
    } catch (error) {
      console.error('Error discovering tools:', error);
      return res.status(500).json({
        error: 'Failed to discover tools'
      });
    }
  }
  
  /**
   * Get tool categories and related metadata
   */
  public async getToolCategories(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required'
        });
      }
      
      // Get all tools for the user
      const tools = await mcpProxyService.getFilteredToolsForUser(userId);
      
      // Extract and count categories
      const categories = tools.reduce((acc, tool) => {
        const category = tool.category || 'Uncategorized';
        
        if (!acc[category]) {
          acc[category] = {
            name: category,
            count: 0,
            tools: []
          };
        }
        
        acc[category].count++;
        acc[category].tools.push({
          id: tool.id,
          name: tool.name
        });
        
        return acc;
      }, {});
      
      return res.json({
        categories: Object.values(categories)
      });
    } catch (error) {
      console.error('Error getting tool categories:', error);
      return res.status(500).json({
        error: 'Failed to get tool categories'
      });
    }
  }
}

// Export singleton instance
export const mcpToolController = new McpToolController();