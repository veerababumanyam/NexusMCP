/**
 * MCP Protocol Type Definitions
 * 
 * Model Context Protocol (MCP) type definitions for the MCP Gateway/Proxy
 */

import { z } from "zod";

// MCP Tool Definition
export interface McpToolDefinition {
  name: string;
  description: string;
  schema: any;
  server_id?: number;
  server_name?: string;
}

// MCP Prompt Definition
export interface McpPromptDefinition {
  name: string;
  description: string;
  content: string;
  metadata?: Record<string, any>;
}

// MCP Resource Definition
export interface McpResourceDefinition {
  name: string;
  description: string;
  type: string;
  metadata?: Record<string, any>;
}

// JSON-RPC Request
export interface McpJsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id: string | number;
}

// JSON-RPC Response
export interface McpJsonRpcResponse {
  jsonrpc: '2.0';
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
  id: string | number | null;
}

// JSON-RPC Notification
export interface McpJsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

// MCP Run Tool Parameters
export interface McpRunToolParams {
  tool_name: string;
  params: any;
}

// MCP Run Prompt Parameters
export interface McpRunPromptParams {
  prompt_name: string;
  variables: Record<string, any>;
}

// MCP Get Resource Parameters
export interface McpGetResourceParams {
  resource_name: string;
}

// MCP Chunk Parameters
export interface McpChunkParams {
  request_id: string | number;
  chunk: any;
}

// MCP Status Info
export interface McpStatusInfo {
  version: string;
  tools_count: number;
  prompts_count: number;
  resources_count: number;
}

// Zod schemas for validation
export const mcpToolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  schema: z.any(),
  server_id: z.number().optional(),
  server_name: z.string().optional()
});

export const mcpJsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  method: z.string(),
  params: z.any().optional(),
  id: z.union([z.string(), z.number()])
});

export const mcpJsonRpcResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  result: z.any().optional(),
  error: z.object({
    code: z.number(),
    message: z.string(),
    data: z.any().optional()
  }).optional(),
  id: z.union([z.string(), z.number(), z.null()])
});

export const mcpRunToolParamsSchema = z.object({
  tool_name: z.string(),
  params: z.any()
});

// Derive types from schemas
export type McpToolDefinitionZ = z.infer<typeof mcpToolDefinitionSchema>;
export type McpJsonRpcRequestZ = z.infer<typeof mcpJsonRpcRequestSchema>;
export type McpJsonRpcResponseZ = z.infer<typeof mcpJsonRpcResponseSchema>;
export type McpRunToolParamsZ = z.infer<typeof mcpRunToolParamsSchema>;