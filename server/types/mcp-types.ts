/**
 * MCP Protocol Type Definitions
 */

export interface McpToolDefinition {
  name: string;
  description: string;
  schema: any;
  server_id?: number;
  server_name?: string;
}

export interface McpPromptDefinition {
  name: string;
  description: string;
  content: string;
  metadata?: Record<string, any>;
}

export interface McpResourceDefinition {
  name: string;
  description: string;
  type: string;
  metadata?: Record<string, any>;
}

export interface McpJsonRpcRequest {
  jsonrpc: '2.0';
  method: string;
  params?: any;
  id: string | number;
}

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

export interface McpJsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: any;
}

// Specific method parameter types
export interface McpRunToolParams {
  tool_name: string;
  params: any;
}

export interface McpRunPromptParams {
  prompt_name: string;
  variables: Record<string, any>;
}

export interface McpGetResourceParams {
  resource_name: string;
}

// Streaming response types
export interface McpChunkParams {
  request_id: string | number;
  chunk: any;
}

// Status response type
export interface McpStatusInfo {
  version: string;
  tools_count: number;
  prompts_count: number;
  resources_count: number;
}